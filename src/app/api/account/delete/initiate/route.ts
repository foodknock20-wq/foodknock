// src/app/api/account/delete/initiate/route.ts
//
// Step 1 of the two-call account-deletion protocol: FRESH re-authentication.
//
//   POST /api/account/delete/initiate   body: { password }
//
// Requires a valid session AND the account's current password (password is
// the only auth method on this app — every account has one; see auth flow).
// On success it mints a short-lived (10 min), session-bound deletion-intent
// token that the final /confirm step requires. A stale session alone can
// never reach deletion — this step must succeed first, and its token
// expires quickly.
//
// Security:
//   • Generic error copy — never reveals whether the account exists or why
//     auth failed (anti-enumeration; this is a logged-in self-service flow
//     but we keep the discipline consistent with login).
//   • Rate-limited per user + IP to throttle password guessing.
//   • Admin accounts are refused (customer flow only).
//   • The password is never logged, echoed, or stored.

import { NextResponse } from "next/server";
import crypto from "crypto";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import User from "@/models/User";
import { getSessionUser } from "@/lib/apiAuth";
import { comparePassword, signDeletionToken } from "@/lib/auth";
import { isRateLimited, getClientIp } from "@/lib/rateLimit";

const schema = z.object({
    password: z.string().min(1).max(200),
});

function extractToken(req: Request): string | null {
    const cookieHeader = req.headers.get("cookie") ?? "";
    const match = cookieHeader.match(/(?:^|;\s*)token=([^;]+)/);
    return match ? decodeURIComponent(match[1]) : null;
}

export async function POST(req: Request) {
    try {
        const session = getSessionUser(req);
        const rawToken = extractToken(req);
        if (!session || !rawToken) {
            return NextResponse.json({ success: false, message: "Not authenticated." }, { status: 401 });
        }

        const body = await req.json().catch(() => null);
        const parsed = schema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json({ success: false, message: "Password is required." }, { status: 400 });
        }

        // Throttle re-auth attempts: 10 per hour per user, plus a per-IP ceiling.
        const ip = getClientIp(req);
        const overLimit =
            (await isRateLimited(`acctdel:u:${session.userId}`, 10, 60 * 60 * 1000)) ||
            (await isRateLimited(`acctdel:ip:${ip}`, 30, 60 * 60 * 1000));
        if (overLimit) {
            return NextResponse.json(
                { success: false, message: "Too many attempts. Please try again later." },
                { status: 429 }
            );
        }

        await connectDB();
        const user = await User.findById(session.userId)
            .select("password role isActive")
            .lean<{ password?: string; role?: string; isActive?: boolean } | null>();

        if (!user || user.isActive === false || !user.password) {
            return NextResponse.json({ success: false, message: "Could not verify your password." }, { status: 401 });
        }

        if (user.role === "admin") {
            return NextResponse.json(
                { success: false, message: "Admin accounts can't be deleted from here." },
                { status: 403 }
            );
        }

        const ok = await comparePassword(parsed.data.password, user.password);
        if (!ok) {
            return NextResponse.json({ success: false, message: "Could not verify your password." }, { status: 401 });
        }

        // ── Single-use server-stored nonce ─────────────────────────────────
        // Generate a fresh, unpredictable nonce; store ONLY its hash (plus a
        // 10-min expiry) on the user, atomically. This $set overwrites any
        // previously issued intent, so issuing a new intent invalidates the
        // old one, and concurrent initiations are last-write-wins — only the
        // token whose raw nonce matches the currently-stored hash can later
        // be consumed. The raw nonce is returned ONLY inside the signed
        // token below and is never logged.
        const nonce = crypto.randomBytes(32).toString("hex");
        const nonceHash = crypto.createHash("sha256").update(nonce).digest("hex");
        const nonceExpiresAt = new Date(Date.now() + 10 * 60 * 1000);

        await User.updateOne(
            { _id: session.userId },
            {
                $set: {
                    "accountDeletion.nonceHash": nonceHash,
                    "accountDeletion.nonceExpiresAt": nonceExpiresAt,
                },
            }
        );

        // Bind the intent token to THIS session token so a token leaked to a
        // different device/session cannot be replayed at the confirm step.
        const sid = crypto.createHash("sha256").update(rawToken).digest("hex");
        const deletionToken = signDeletionToken({ userId: session.userId, sid, nonce });

        return NextResponse.json({ success: true, deletionToken });
    } catch (err) {
        console.error("ACCOUNT_DELETE_INITIATE_ERROR", err);
        return NextResponse.json({ success: false, message: "Something went wrong. Please try again." }, { status: 500 });
    }
}
