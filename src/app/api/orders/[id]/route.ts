export const dynamic = "force-dynamic";

// src/app/api/orders/[id]/route.ts
// PATCH — updates order status (and triggers loyalty when status → "delivered")
// GET   — returns a single order by MongoDB _id

import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB }            from "@/lib/db";
import Order                    from "@/models/Order";
import { handleOrderDelivered } from "@/lib/loyaltyService";

type RouteContext = { params: Promise<{ id: string }> };

const VALID_STATUSES = ["received", "preparing", "out_for_delivery", "delivered"] as const;

// ── PATCH /api/orders/[id] ─────────────────────────────────────────────────
export async function PATCH(req: NextRequest, context: RouteContext) {
    try {
        await connectDB();
        const { id } = await context.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return NextResponse.json(
                { success: false, message: "Invalid order ID" },
                { status: 400 }
            );
        }

        const body = await req.json();
        const { status, whatsappSent } = body;

        if (status && !VALID_STATUSES.includes(status)) {
            return NextResponse.json(
                { success: false, message: `Invalid status "${status}"` },
                { status: 400 }
            );
        }

        // Fetch existing order so we can detect the status transition
        const existingOrder = await Order.findById(id).select("status user").lean();
        if (!existingOrder) {
            return NextResponse.json(
                { success: false, message: "Order not found" },
                { status: 404 }
            );
        }

        const prevStatus = (existingOrder as any).status as string;

        const updatePayload: Record<string, unknown> = {};
        if (status !== undefined)       updatePayload.status       = status;
        if (whatsappSent !== undefined) updatePayload.whatsappSent = whatsappSent;

        const updatedOrder = await Order.findByIdAndUpdate(
            id,
            { $set: updatePayload },
            { new: true, runValidators: true }
        ).lean();

        if (!updatedOrder) {
            return NextResponse.json(
                { success: false, message: "Order not found" },
                { status: 404 }
            );
        }

        // ── Loyalty trigger ────────────────────────────────────────────────
        // Fire only on the exact transition into "delivered" — not on re-saves,
        // and not if the order was already delivered before this PATCH.
        const isTransitionToDelivered =
            status === "delivered" &&
            prevStatus !== "delivered" &&
            !!(existingOrder as any).user;   // guest orders have no user

        if (isTransitionToDelivered) {
            // Intentionally fire-and-forget with error isolation:
            // a loyalty failure must NEVER roll back the status update.
            handleOrderDelivered(id).catch((loyaltyErr) => {
                console.error(
                    `[loyalty] handleOrderDelivered failed for order ${id}:`,
                    loyaltyErr
                );
            });
        }

        return NextResponse.json({ success: true, order: updatedOrder });
    } catch (error) {
        console.error("PATCH_ORDER_ERROR", error);
        return NextResponse.json(
            { success: false, message: "Failed to update order" },
            { status: 500 }
        );
    }
}

// ── GET /api/orders/[id] ───────────────────────────────────────────────────
export async function GET(_req: NextRequest, context: RouteContext) {
    try {
        await connectDB();
        const { id } = await context.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return NextResponse.json(
                { success: false, message: "Invalid order ID" },
                { status: 400 }
            );
        }

        const order = await Order.findById(id).lean();
        if (!order) {
            return NextResponse.json(
                { success: false, message: "Order not found" },
                { status: 404 }
            );
        }

        return NextResponse.json({ success: true, order });
    } catch (error) {
        console.error("GET_ORDER_ERROR", error);
        return NextResponse.json(
            { success: false, message: "Failed to fetch order" },
            { status: 500 }
        );
    }
}