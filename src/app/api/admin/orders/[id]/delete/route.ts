export const dynamic = "force-dynamic";

// src/app/api/admin/orders/[id]/delete/route.ts
//
// POST — admin-only, high-risk. Requires the admin to type the order's
// exact human-readable orderId as explicit confirmation (never a bare
// "click delete"). Delegates the actual decision — hard delete vs. safe
// archive — entirely to deleteOrAchiveOrder() (src/lib/orderDeletion.ts),
// which re-verifies every precondition itself. This route never decides
// safety; it only authenticates, validates the confirmation text, and
// reports whatever the authority actually did.

import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import Order from "@/models/Order";
import { requireAdmin } from "@/lib/apiAuth";
import { deleteOrAchiveOrder } from "@/lib/orderDeletion";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, context: RouteContext) {
    try {
        const admin = await requireAdmin(req);
        if (!admin) {
            return NextResponse.json({ success: false, message: "Admin access required" }, { status: 403 });
        }

        await connectDB();
        const { id } = await context.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return NextResponse.json({ success: false, message: "Invalid order ID" }, { status: 400 });
        }

        const body = await req.json().catch(() => ({}));
        const confirm = typeof body?.confirm === "string" ? body.confirm.trim() : "";

        const order = await Order.findById(id).select("orderId").lean<{ orderId: string } | null>();
        if (!order) {
            return NextResponse.json({ success: false, message: "Order not found" }, { status: 404 });
        }

        if (confirm !== order.orderId) {
            return NextResponse.json(
                { success: false, message: "Confirmation text does not match this order's ID." },
                { status: 400 }
            );
        }

        const outcome = await deleteOrAchiveOrder(id);
        return NextResponse.json({ success: true, ...outcome });
    } catch (error) {
        console.error("ADMIN_ORDER_DELETE_ERROR", error);
        const err = error as { message?: string; status?: number };
        return NextResponse.json(
            { success: false, message: err?.message || "Failed to delete order" },
            { status: err?.status || 500 }
        );
    }
}
