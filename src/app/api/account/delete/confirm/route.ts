// src/app/api/account/delete/confirm/route.ts
//
// Step 2 (final) of the two-call account-deletion protocol.
//
//   POST /api/account/delete/confirm   body: { deletionToken, acknowledge }
//
// Requires ALL of:
//   • a valid session,
//   • a valid, non-expired, session-bound deletion-intent token minted by
//     /initiate (which itself required a fresh password re-auth), and
//   • an explicit acknowledge:true (the UI's final-confirmation checkbox —
//     supplements, never replaces, the server checks above).
//
// On success it runs the idempotent deletion orchestration
// (src/lib/accountDeletion.ts) and clears the session cookie so the now-
// deleted account's JWT can no longer act. Deletion of an already-deleted
// account returns success (idempotent retry-safe).

import { NextResponse } from "next/server";
import crypto from "crypto";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import User from "@/models/User";
import { getSessionUser } from "@/lib/apiAuth";
import { verifyDeletionToken } from "@/lib/auth";
import { deleteAccount } from "@/lib/accountDeletion";

const schema = z.object({
    deletionToken: z.string().min(1),
    acknowledge: z.literal(true),
});

function extractToken(req: Request): string | null {
    const cookieHeader = req.headers.get("cookie") ?? "";
    const match = cookieHeader.match(/(?:^|;\s*)token=([^;]+)/);
    return match ? decodeURIComponent(match[1]) : null;
}

function clearedCookie(res: NextResponse): NextResponse {
    res.cookies.set("token", "", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        expires: new Date(0),
    });
    return res;
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
            return NextResponse.json(
                { success: false, message: "Please confirm you understand this is permanent." },
                { status: 400 }
            );
        }

        // Verify the deletion-intent token: signature, expiry, purpose.
        let decoded: { userId: string; sid: string; nonce: string };
        try {
            decoded = verifyDeletionToken(parsed.data.deletionToken);
        } catch {
            return NextResponse.json(
                { success: false, message: "Your confirmation expired. Please start again." },
                { status: 401 }
            );
        }

        // Must be the same user as the session, and bound to the same session
        // token it was minted for.
        const sid = crypto.createHash("sha256").update(rawToken).digest("hex");
        if (decoded.userId !== session.userId || decoded.sid !== sid) {
            return NextResponse.json(
                { success: false, message: "Your confirmation is no longer valid. Please start again." },
                { status: 401 }
            );
        }

        // ── Atomic single-use consumption of the server-stored nonce ───────
        // The token is only a bearer of the raw nonce; the authority is the
        // hash persisted on the User at initiate time. This conditional
        // findOneAndUpdate matches the stored hash AND a non-expired window,
        // and clears it in the SAME operation — so exactly one of any number
        // of concurrent confirmations can win. A replayed, altered, expired,
        // or already-consumed token matches nothing and is rejected here,
        // before any irreversible work begins.
        await connectDB();
        const nonceHash = crypto.createHash("sha256").update(decoded.nonce).digest("hex");
        const claimed = await User.findOneAndUpdate(
            {
                _id: session.userId,
                "accountDeletion.nonceHash": nonceHash,
                "accountDeletion.nonceExpiresAt": { $gt: new Date() },
            },
            { $set: { "accountDeletion.nonceHash": null, "accountDeletion.nonceExpiresAt": null } }
        )
            .select("_id")
            .lean();

        if (!claimed) {
            return NextResponse.json(
                { success: false, message: "Your confirmation is no longer valid. Please start again." },
                { status: 401 }
            );
        }

        // RECOVERY NOTE: the nonce is now consumed. If deleteAccount throws
        // below (partial failure), the orchestration is idempotent/resumable
        // (the User doc is deleted LAST as the completion marker), but this
        // token can never be reused — the user must re-authenticate via
        // /initiate to obtain a FRESH nonce, which safely resumes/finishes
        // the deletion. We deliberately do NOT restore the nonce on failure.
        const result = await deleteAccount(session.userId);

        // Always clear the cookie — whether we just deleted the account or it
        // was already gone, the session must not survive.
        const res = NextResponse.json({
            success: true,
            alreadyDeleted: result.alreadyDeleted,
        });
        return clearedCookie(res);
    } catch (err: unknown) {
        const status =
            typeof err === "object" && err !== null && "status" in err
                ? Number((err as { status?: number }).status) || 500
                : 500;
        if (status === 403) {
            return NextResponse.json(
                { success: false, message: "Admin accounts can't be deleted from here." },
                { status: 403 }
            );
        }
        console.error("ACCOUNT_DELETE_CONFIRM_ERROR", err);
        return NextResponse.json(
            { success: false, message: "We couldn't complete the deletion. Please try again." },
            { status: 500 }
        );
    }
}
