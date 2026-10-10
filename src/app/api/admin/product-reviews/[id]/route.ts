export const dynamic = "force-dynamic";

// src/app/api/admin/product-reviews/[id]/route.ts
//
// Pre-Phase 17 — Phase 1: Reviews 2.0 admin moderation actions.
// PATCH — soft-hide/unhide a review (keeps the document, excludes it from
//         the public product page and from the rating aggregate).
// DELETE — hard delete. Only ever touches the ProductReview document itself
//         — never the referenced Product/User/Order.

import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import ProductReview from "@/models/ProductReview";
import { requireAdmin } from "@/lib/apiAuth";
import { recalculateProductRating } from "@/lib/productReviews";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, context: RouteContext) {
    try {
        const admin = await requireAdmin(req);
        if (!admin) {
            return NextResponse.json({ success: false, message: "Admin access required" }, { status: 403 });
        }

        await connectDB();

        const { id } = await context.params;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return NextResponse.json({ success: false, message: "Invalid review ID" }, { status: 400 });
        }

        const body = await req.json().catch(() => ({} as Record<string, unknown>));
        if (typeof body.isHidden !== "boolean") {
            return NextResponse.json({ success: false, message: "isHidden must be a boolean" }, { status: 400 });
        }

        const review = await ProductReview.findByIdAndUpdate(
            id,
            { $set: { isHidden: body.isHidden } },
            { new: true, runValidators: true }
        ).lean<{ productId: mongoose.Types.ObjectId } | null>();

        if (!review) {
            return NextResponse.json({ success: false, message: "Review not found" }, { status: 404 });
        }

        await recalculateProductRating(review.productId);

        return NextResponse.json({ success: true, review });
    } catch (error) {
        console.error("PATCH_ADMIN_PRODUCT_REVIEW_ERROR", error);
        return NextResponse.json({ success: false, message: "Failed to update review" }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest, context: RouteContext) {
    try {
        const admin = await requireAdmin(req);
        if (!admin) {
            return NextResponse.json({ success: false, message: "Admin access required" }, { status: 403 });
        }

        await connectDB();

        const { id } = await context.params;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return NextResponse.json({ success: false, message: "Invalid review ID" }, { status: 400 });
        }

        const review = await ProductReview.findByIdAndDelete(id).lean<{ productId: mongoose.Types.ObjectId } | null>();

        if (!review) {
            return NextResponse.json({ success: false, message: "Review not found" }, { status: 404 });
        }

        await recalculateProductRating(review.productId);

        return NextResponse.json({ success: true, message: "Review deleted successfully" });
    } catch (error) {
        console.error("DELETE_ADMIN_PRODUCT_REVIEW_ERROR", error);
        return NextResponse.json({ success: false, message: "Failed to delete review" }, { status: 500 });
    }
}
