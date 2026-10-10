// src/app/api/admin/products/bulk-status/route.ts
//
// Phase 15E — bulk activate/deactivate for the admin Products list.
// Deliberately the ONLY bulk operation implemented (no bulk price/stock
// changes — rule §34). Admin-only, explicit allowlisted body shape, bounded
// id array (<=100 — matches the list page's hard pagination max so a batch
// can never exceed a page's worth of intent), every id validated before the
// single bounded updateMany write.

import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import Product from "@/models/Product";
import { requireAdmin } from "@/lib/apiAuth";

export const dynamic = "force-dynamic";

const MAX_IDS = 100;

export async function POST(req: NextRequest) {
    try {
        const admin = await requireAdmin(req);
        if (!admin) {
            return NextResponse.json({ success: false, message: "Admin access required" }, { status: 403 });
        }

        const body = await req.json();
        const ids = Array.isArray(body?.ids) ? body.ids : [];
        const isAvailable = body?.isAvailable;

        if (typeof isAvailable !== "boolean") {
            return NextResponse.json({ success: false, message: "isAvailable must be true or false" }, { status: 400 });
        }
        if (ids.length === 0) {
            return NextResponse.json({ success: false, message: "No products selected" }, { status: 400 });
        }
        if (ids.length > MAX_IDS) {
            return NextResponse.json({ success: false, message: `Cannot update more than ${MAX_IDS} products at once` }, { status: 400 });
        }
        if (!ids.every((id: unknown) => typeof id === "string" && mongoose.Types.ObjectId.isValid(id))) {
            return NextResponse.json({ success: false, message: "One or more product IDs are invalid" }, { status: 400 });
        }

        await connectDB();

        const result = await Product.updateMany(
            { _id: { $in: ids.map((id: string) => new mongoose.Types.ObjectId(id)) } },
            { $set: { isAvailable } }
        );

        return NextResponse.json({ success: true, updatedCount: result.modifiedCount ?? 0 });
    } catch (error) {
        console.error("BULK_PRODUCT_STATUS_ERROR", error);
        return NextResponse.json({ success: false, message: "Failed to update products" }, { status: 500 });
    }
}
