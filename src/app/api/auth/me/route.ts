
// src/app/api/auth/me/route.ts
// Returns current authenticated user.
// Now includes isActive check — blocked users get 403 + cookie cleared.

import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import User from "@/models/User";
import { verifyToken } from "@/lib/auth";
import { requireUser } from "@/lib/apiAuth";
import { isRateLimited } from "@/lib/rateLimit";
import { validateFullName } from "@/lib/validation/name";

export async function GET(req: Request) {
    try {
        // ── Parse token from cookie header ───────────────────────────────
        const cookieHeader = req.headers.get("cookie") ?? "";
        const tokenMatch = cookieHeader.match(/(?:^|;\s*)token=([^;]+)/);
        const token = tokenMatch ? decodeURIComponent(tokenMatch[1]) : null;

        if (!token) {
            return NextResponse.json(
                { success: false, message: "Not authenticated" },
                { status: 401 }
            );
        }

        // ── Verify JWT ────────────────────────────────────────────────────
        let decoded: { userId: string } & Record<string, unknown>;
        try {
            decoded = verifyToken(token) as typeof decoded;
        } catch {
            return NextResponse.json(
                { success: false, message: "Invalid or expired token" },
                { status: 401 }
            );
        }

        if (!decoded?.userId) {
            return NextResponse.json(
                { success: false, message: "Invalid token payload" },
                { status: 401 }
            );
        }

        // ── Fetch user from DB ────────────────────────────────────────────
        await connectDB();

        const user = await User.findById(decoded.userId).select(
            "_id name email role phone address isActive"
        );

        if (!user) {
            return NextResponse.json(
                { success: false, message: "User not found" },
                { status: 404 }
            );
        }

        // ── Block check — clear cookie so session is cleaned up ───────────
        if (user.isActive === false) {
            const res = NextResponse.json(
                { success: false, message: "Your account has been suspended. Please contact support." },
                { status: 403 }
            );
            // Clear the token cookie so the blocked user is immediately logged out
            res.cookies.set("token", "", {
                httpOnly: true,
                secure: process.env.NODE_ENV === "production",
                sameSite: "lax",
                path: "/",
                expires: new Date(0),
            });
            return res;
        }

        // ── Return safe user object ───────────────────────────────────────
        return NextResponse.json({
            success: true,
            user: {
                id:       user._id.toString(),
                name:     user.name,
                email:    user.email,
                role:     user.role ?? "user",
                phone:    user.phone ?? "",
                address:  user.address ?? "",
                isActive: user.isActive ?? true,
            },
        });
    } catch (error) {
        console.error("AUTH_ME_ERROR", error);
        return NextResponse.json(
            { success: false, message: "Something went wrong" },
            { status: 500 }
        );
    }
}

// ── PATCH: edit own profile (Phase 9 — Account 2.0) ─────────────────────
// Deliberately name/dob ONLY. Email and phone are read-only this phase —
// changing either would need a re-verification step (OTP) that doesn't
// exist yet for post-signup changes; see the Phase 9 plan. role/isActive/
// password/every other field is never accepted here, by construction —
// this allowlist is the only thing read off the request body.
export async function PATCH(req: Request) {
    try {
        const auth = await requireUser(req);
        if (!auth) {
            return NextResponse.json(
                { success: false, message: "Not authenticated" },
                { status: 401 }
            );
        }

        if (await isRateLimited(`profile-update:${auth.userId}`, 20, 60 * 60 * 1000)) {
            return NextResponse.json(
                { success: false, message: "Too many requests. Try again later." },
                { status: 429 }
            );
        }

        const body = await req.json().catch(() => ({} as Record<string, unknown>));
        const update: Record<string, unknown> = {};

        if (typeof body.name === "string") {
            const name = body.name.trim();
            if (!name) {
                return NextResponse.json(
                    { success: false, message: "Name cannot be empty" },
                    { status: 400 }
                );
            }

            // Customer Identity Validation Repair — this server-side check
            // is authoritative, so it must independently confirm whether
            // the name is actually CHANGING before applying the new,
            // stricter rule. An existing customer with a legacy short name
            // (e.g. "Amit") resubmitting it unchanged (alongside an
            // unrelated DOB edit, say) must never be blocked — only a
            // genuinely new/edited name is held to validateFullName().
            await connectDB();
            const currentUser = await User.findById(auth.userId).select("name").lean<{ name?: string } | null>();
            const nameChanged = name !== (currentUser?.name ?? "");
            if (nameChanged) {
                const nameResult = validateFullName(name);
                if (!nameResult.ok) {
                    return NextResponse.json(
                        { success: false, message: nameResult.message },
                        { status: 400 }
                    );
                }
                update.name = nameResult.value.slice(0, 80);
            } else {
                update.name = name.slice(0, 80);
            }
        }

        if (body.dob !== undefined) {
            if (body.dob === null || body.dob === "") {
                update.dob = null;
            } else {
                const dob = new Date(body.dob as string);
                if (Number.isNaN(dob.getTime()) || dob.getTime() > Date.now()) {
                    return NextResponse.json(
                        { success: false, message: "Invalid date of birth" },
                        { status: 400 }
                    );
                }
                update.dob = dob;
            }
        }

        if (Object.keys(update).length === 0) {
            return NextResponse.json(
                { success: false, message: "No valid fields provided to update" },
                { status: 400 }
            );
        }

        await connectDB();
        const user = await User.findByIdAndUpdate(auth.userId, { $set: update }, { new: true, runValidators: true })
            .select("_id name email role phone address isActive dob")
            .lean<{
                _id: unknown;
                name: string;
                email: string;
                role?: string;
                phone?: string;
                address?: unknown;
                isActive?: boolean;
                dob?: Date;
            } | null>();

        if (!user) {
            return NextResponse.json({ success: false, message: "User not found" }, { status: 404 });
        }

        return NextResponse.json({
            success: true,
            user: {
                id: String(user._id),
                name: user.name,
                email: user.email,
                role: user.role ?? "user",
                phone: user.phone ?? "",
                address: user.address ?? "",
                isActive: user.isActive ?? true,
                dob: user.dob ?? null,
            },
        });
    } catch (error) {
        console.error("PATCH_AUTH_ME_ERROR", error);
        return NextResponse.json(
            { success: false, message: "Failed to update profile" },
            { status: 500 }
        );
    }
}