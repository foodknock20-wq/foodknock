export const dynamic = "force-dynamic";

// src/app/api/auth/login/route.ts
// Updated: blocks inactive users before issuing token, returns role in response.

import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import User from "@/models/User";
import bcrypt from "bcryptjs";
import { signToken } from "@/lib/auth";

export async function POST(req: Request) {
    try {
        const { email, password } = await req.json();

        // ── Basic validation ──────────────────────────────────────────────
        if (!email?.trim() || !password) {
            return NextResponse.json(
                { success: false, message: "Email and password are required" },
                { status: 400 }
            );
        }

        await connectDB();

        // ── Find user ─────────────────────────────────────────────────────
        const user = await User.findOne({ email: email.toLowerCase().trim() })
            .select("_id name email password role isActive");

        if (!user) {
            return NextResponse.json(
                { success: false, message: "Invalid email or password" },
                { status: 401 }
            );
        }

        // ── Password check ────────────────────────────────────────────────
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return NextResponse.json(
                { success: false, message: "Invalid email or password" },
                { status: 401 }
            );
        }

        // ── Block check ───────────────────────────────────────────────────
        if (user.isActive === false) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Your account has been suspended. Please contact support.",
                },
                { status: 403 }
            );
        }

        // ── Sign JWT ──────────────────────────────────────────────────────
        const token = signToken({
            userId: user._id.toString(),
            email: user.email,
            role: user.role ?? "user",
        });

        // ── Response ──────────────────────────────────────────────────────
        const res = NextResponse.json({
            success: true,
            message: "Login successful",
            user: {
                id: user._id.toString(),
                name: user.name,
                email: user.email,
                role: user.role ?? "user",
            },
        });

        // ── Set Cookie ────────────────────────────────────────────────────
        res.cookies.set("token", token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            path: "/",
            maxAge: 60 * 60 * 24 * 7,
        });

        return res;

    } catch (error) {
        console.error("LOGIN_ERROR", error);
        return NextResponse.json(
            { success: false, message: "Something went wrong. Please try again." },
            { status: 500 }
        );
    }
}