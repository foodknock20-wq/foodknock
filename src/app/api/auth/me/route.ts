
// src/app/api/auth/me/route.ts
// Returns current authenticated user.
// Now includes isActive check — blocked users get 403 + cookie cleared.

import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import User from "@/models/User";
import { verifyToken } from "@/lib/auth";

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