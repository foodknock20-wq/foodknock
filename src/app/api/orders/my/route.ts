export const dynamic = "force-dynamic";

// src/app/api/orders/my/route.ts
// GET /api/orders/my — returns only the currently logged-in user's orders.
// Secured: requires valid JWT token cookie.

import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import Order from "@/models/Order";
import { verifyToken } from "@/lib/auth";

export async function GET(req: NextRequest) {
    try {
        // ── Parse token ────────────────────────────────────────────────────
        const cookieHeader = req.headers.get("cookie") ?? "";
        const tokenMatch = cookieHeader.match(/(?:^|;\s*)token=([^;]+)/);
        const token = tokenMatch ? decodeURIComponent(tokenMatch[1]) : null;

        if (!token) {
            return NextResponse.json(
                { success: false, message: "Not authenticated" },
                { status: 401 }
            );
        }

        let decoded: { userId: string } & Record<string, unknown>;
        try {
            decoded = verifyToken(token) as typeof decoded;
        } catch {
            return NextResponse.json(
                { success: false, message: "Invalid or expired session" },
                { status: 401 }
            );
        }

        if (!decoded?.userId) {
            return NextResponse.json(
                { success: false, message: "Invalid token" },
                { status: 401 }
            );
        }

        // ── Fetch this user's orders only ──────────────────────────────────
        await connectDB();

        const orders = await Order.find({ user: decoded.userId })
            .sort({ createdAt: -1 })
            .select(
                "_id orderId customerName phone address landmark orderType items totalAmount status note createdAt"
            )
            .lean();

        return NextResponse.json({ success: true, orders });
    } catch (error) {
        console.error("MY_ORDERS_ERROR", error);
        return NextResponse.json(
            { success: false, message: "Failed to fetch your orders" },
            { status: 500 }
        );
    }
}