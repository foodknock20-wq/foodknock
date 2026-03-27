export const dynamic = "force-dynamic";

// src/app/api/auth/register/route.ts
// Updated: generates unique referralCode + records referredBy on signup.
// Self-referral guard: rejects any attempt to use one's own referral code.
//
// NOTE: firstDeliveryFreeUsed is intentionally NOT set here.
// The User model defaults it to false, which is correct for new users.
// Eligibility is gated by deliveredOrderCount === 0 in the helper, so
// new users automatically qualify without any extra field on registration.

import { NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import User from "@/models/User";
import { hashPassword, signToken } from "@/lib/auth";

// ── Referral code generator ────────────────────────────────────────────────
function generateReferralCode(name: string): string {
    const prefix = name.trim().toUpperCase().replace(/[^A-Z]/g, "").slice(0, 3) || "USR";
    const suffix = Math.random().toString(36).toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 5);
    return `${prefix}${suffix}`.slice(0, 8).padEnd(8, "X");
}

async function uniqueReferralCode(name: string): Promise<string> {
    let code     = generateReferralCode(name);
    let attempts = 0;
    while (await User.exists({ referralCode: code })) {
        code = generateReferralCode(name + attempts++);
    }
    return code;
}

// ── Validation ─────────────────────────────────────────────────────────────
const registerSchema = z.object({
    name:         z.string().trim().min(2, "Name must be at least 2 characters"),
    dob:          z.string().trim().optional(),
    email:        z.string().trim().toLowerCase().email("Valid email is required"),
    phone:        z.string().trim().min(10, "Phone number must be at least 10 digits"),
    password:     z.string().min(6, "Password must be at least 6 characters"),
    referralCode: z.string().trim().toUpperCase().optional(),
    address: z.object({
        line1:    z.string().trim().optional().default(""),
        line2:    z.string().trim().optional().default(""),
        city:     z.string().trim().optional().default(""),
        state:    z.string().trim().optional().default(""),
        pincode:  z.string().trim().optional().default(""),
        landmark: z.string().trim().optional().default(""),
    }),
});

export async function POST(req: Request) {
    try {
        const body = await req.json();

        const normalizedBody = {
            name:         body?.name         ?? body?.fullName    ?? "",
            dob:          body?.dob          ?? body?.dateOfBirth ?? "",
            email:        body?.email        ?? "",
            phone:        String(body?.phone ?? body?.mobile      ?? "").trim(),
            password:     body?.password     ?? "",
            referralCode: body?.referralCode ?? body?.inviteCode  ?? "",
            address: {
                line1:    body?.address?.line1    ?? body?.line1    ?? "",
                line2:    body?.address?.line2    ?? body?.line2    ?? "",
                city:     body?.address?.city     ?? body?.city     ?? "",
                state:    body?.address?.state    ?? body?.state    ?? "",
                pincode:  body?.address?.pincode  ?? body?.pincode  ?? "",
                landmark: body?.address?.landmark ?? body?.landmark ?? "",
            },
        };

        const parsed = registerSchema.safeParse(normalizedBody);
        if (!parsed.success) {
            return NextResponse.json(
                { success: false, message: "Invalid input", errors: parsed.error.flatten() },
                { status: 400 }
            );
        }

        await connectDB();

        // ── Duplicate email check ─────────────────────────────────────────
        const existingUser = await User.findOne({ email: parsed.data.email.toLowerCase() });
        if (existingUser) {
            return NextResponse.json(
                { success: false, message: "Email already exists" },
                { status: 409 }
            );
        }

        // ── Resolve referrer + self-referral guard ────────────────────────
        let referrerId: string | null = null;

        if (parsed.data.referralCode) {
            const referrer = await User.findOne({
                referralCode: parsed.data.referralCode.toUpperCase(),
            }).select("_id email");

            if (referrer) {
                if (referrer.email.toLowerCase() === parsed.data.email.toLowerCase()) {
                    return NextResponse.json(
                        { success: false, message: "You cannot use your own referral code." },
                        { status: 400 }
                    );
                }
                referrerId = referrer._id.toString();
            }
            // Unknown / mistyped codes are silently ignored —
            // we don't block registration over a bad referral code.
        }

        // ── Create user ───────────────────────────────────────────────────
        const hashedPassword = await hashPassword(parsed.data.password);
        const myReferralCode = await uniqueReferralCode(parsed.data.name);

        const user = await User.create({
            name:                  parsed.data.name,
            ...(parsed.data.dob ? { dob: parsed.data.dob } : {}),
            email:                 parsed.data.email.toLowerCase(),
            phone:                 parsed.data.phone,
            password:              hashedPassword,
            address:               parsed.data.address,
            referralCode:          myReferralCode,
            referredBy:            referrerId,
            loyaltyPoints:         0,
            referralRewardGranted: false,
            deliveredOrderCount:   0,
            // firstDeliveryFreeUsed is NOT explicitly set here — the schema
            // default of `false` is correct.  Eligibility is determined at
            // order time by the two-condition check in firstFreeDelivery.ts.
        });

        // ── Sign JWT ──────────────────────────────────────────────────────
        const token = signToken({
            userId: user._id.toString(),
            email:  user.email,
            role:   user.role,
        });

        const response = NextResponse.json(
            {
                success: true,
                message: "User registered successfully",
                user: {
                    id:           user._id,
                    name:         user.name,
                    email:        user.email,
                    role:         user.role,
                    referralCode: user.referralCode,
                },
            },
            { status: 201 }
        );

        response.cookies.set("token", token, {
            httpOnly: true,
            secure:   process.env.NODE_ENV === "production",
            sameSite: "lax",
            path:     "/",
            maxAge:   60 * 60 * 24 * 7,
        });

        return response;
    } catch (error: unknown) {
        console.error("REGISTER_ERROR", error);
        const msg = error instanceof Error ? error.message : "Something went wrong";
        return NextResponse.json(
            { success: false, message: msg },
            { status: 500 }
        );
    }
}