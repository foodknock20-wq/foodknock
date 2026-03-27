export const dynamic = "force-dynamic";

// src/app/api/payment/verify/route.ts
//
// Step 2 of the Razorpay flow. Now delegates order creation to createOrderCore.

import { NextResponse } from "next/server";
import crypto           from "crypto";
import { connectDB }    from "@/lib/db";
import User             from "@/models/User";
import { verifyToken }  from "@/lib/auth";
import { getShopStatus } from "@/models/Shop";
import { createOrderCore } from "@/lib/createOrderCore";

export async function POST(req: Request) {
    try {
        await connectDB();

        const { isOpen } = await getShopStatus();
        if (!isOpen) {
            return NextResponse.json(
                { success: false, message: "Shop is currently closed" },
                { status: 400 }
            );
        }

        const body = await req.json();
        const {
            razorpayOrderId,
            razorpayPaymentId,
            razorpaySignature,
            paymentMethod,
            customerName,
            phone,
            address,
            landmark = "",
            note     = "",
            orderType,
            items: rawItems,
            validatedRedeemPoints: clientValidatedPoints,
        } = body;

        const items: any[] = rawItems ?? [];
        if (!items.length) {
            return NextResponse.json(
                { success: false, message: "Cart empty" },
                { status: 400 }
            );
        }

        // ── Verify Razorpay signature ─────────────────────────────────────
        if (paymentMethod === "razorpay") {
            const secret = process.env.RAZORPAY_KEY_SECRET;
            if (!secret) {
                return NextResponse.json(
                    { success: false, message: "Razorpay secret missing" },
                    { status: 500 }
                );
            }
            const expectedSig = crypto
                .createHmac("sha256", secret)
                .update(`${razorpayOrderId}|${razorpayPaymentId}`)
                .digest("hex");
            if (expectedSig !== razorpaySignature) {
                return NextResponse.json(
                    { success: false, message: "Invalid payment signature" },
                    { status: 400 }
                );
            }
        }

        // ── Auth check ────────────────────────────────────────────────────
        const cookieHeader = req.headers.get("cookie") ?? "";
        const tokenMatch   = cookieHeader.match(/(?:^|;\s*)token=([^;]+)/);
        const token        = tokenMatch ? decodeURIComponent(tokenMatch[1]) : null;
        let linkedUserId: string | null = null;

        if (token) {
            try {
                const decoded = verifyToken(token) as { userId?: string };
                if (decoded?.userId) {
                    const user = await User.findById(decoded.userId)
                        .select("_id isActive")
                        .lean() as { _id: unknown; isActive?: boolean } | null;
                    if (user && user.isActive !== false) {
                        linkedUserId = String(user._id);
                    }
                }
            } catch {}
        }

        // ── Delegate to shared core ───────────────────────────────────────
        const result = await createOrderCore({
            paymentMethod:          "razorpay",
            customerName,
            phone,
            address,
            landmark,
            note,
            orderType,
            items,
            linkedUserId,
            razorpayOrderId,
            razorpayPaymentId,
            razorpaySignature,
            validatedRedeemPoints:  clientValidatedPoints ?? 0,
        });

        return NextResponse.json({
            success:               true,
            orderId:               result.orderId,
            order:                 result.order,
            reviewRewardApplied:   result.reviewRewardApplied,
            loyaltyPointsRedeemed: result.loyaltyPointsRedeemed,
        });
    } catch (error: any) {
        console.error("VERIFY PAYMENT ERROR", error);
        return NextResponse.json(
            { success: false, message: error?.message || "Order creation failed" },
            { status: error?.status || 500 }
        );
    }
}