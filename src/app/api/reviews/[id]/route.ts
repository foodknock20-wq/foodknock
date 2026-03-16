export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import Review from "@/models/Review";

type RouteContext = {
  params: Promise<{ id: string }>;
};

// ── PATCH /api/reviews/[id] ───────────────────────────────────────────────
// Supports: { isApproved: boolean }
export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    await connectDB();

    const { id } = await context.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        { success: false, message: "Invalid review ID" },
        { status: 400 }
      );
    }

    const body = await req.json();

    if (typeof body.isApproved !== "boolean") {
      return NextResponse.json(
        { success: false, message: "isApproved must be a boolean" },
        { status: 400 }
      );
    }

    const review = await Review.findByIdAndUpdate(
      id,
      { $set: { isApproved: body.isApproved } },
      { new: true, runValidators: true }
    ).lean();

    if (!review) {
      return NextResponse.json(
        { success: false, message: "Review not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, review });
  } catch (error) {
    console.error("PATCH_REVIEW_ERROR", error);
    return NextResponse.json(
      { success: false, message: "Failed to update review" },
      { status: 500 }
    );
  }
}

// ── DELETE /api/reviews/[id] ──────────────────────────────────────────────
export async function DELETE(_req: NextRequest, context: RouteContext) {
  try {
    await connectDB();

    const { id } = await context.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        { success: false, message: "Invalid review ID" },
        { status: 400 }
      );
    }

    const review = await Review.findByIdAndDelete(id);

    if (!review) {
      return NextResponse.json(
        { success: false, message: "Review not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Review deleted successfully",
    });
  } catch (error) {
    console.error("DELETE_REVIEW_ERROR", error);
    return NextResponse.json(
      { success: false, message: "Failed to delete review" },
      { status: 500 }
    );
  }
}