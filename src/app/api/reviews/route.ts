export const dynamic = "force-dynamic";

// src/app/api/reviews/route.ts
// GET  — returns all approved reviews (public)
// POST — submit a new review (open, no auth required in API since auth is checked client-side)

import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import Review from "@/models/Review";

// ── GET ───────────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
    try {
        await connectDB();

        const { searchParams } = new URL(req.url);
        const status = searchParams.get("status");
        const search = searchParams.get("search")?.trim();

        const query: Record<string, any> = {};
        if (status === "approved") query.isApproved = true;
        if (status === "pending")  query.isApproved = false;
        if (search) {
            query.$or = [
                { userName: { $regex: search, $options: "i" } },
                { comment:  { $regex: search, $options: "i" } },
            ];
        }

        const reviews = await Review.find(query)
            .sort({ createdAt: -1 })
            .lean();

        return NextResponse.json({ success: true, reviews });
    } catch (error) {
        console.error("GET_REVIEWS_ERROR", error);
        return NextResponse.json({ success: false, message: "Failed to fetch reviews" }, { status: 500 });
    }
}

// ── POST ──────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
    try {
        await connectDB();

        const { userName, rating, comment } = await req.json();

        if (!userName?.trim()) {
            return NextResponse.json({ success: false, message: "Name is required" }, { status: 400 });
        }
        if (!rating || typeof rating !== "number" || rating < 1 || rating > 5) {
            return NextResponse.json({ success: false, message: "Rating must be 1–5" }, { status: 400 });
        }
        if (!comment?.trim() || comment.trim().length < 10) {
            return NextResponse.json(
                { success: false, message: "Review must be at least 10 characters" },
                { status: 400 }
            );
        }

        const review = await Review.create({
            userName: userName.trim(),
            rating,
            comment:  comment.trim(),
            // isApproved defaults to true per your schema
        });

        return NextResponse.json(
            { success: true, message: "Review submitted!", review },
            { status: 201 }
        );
    } catch (error) {
        console.error("POST_REVIEW_ERROR", error);
        return NextResponse.json({ success: false, message: "Failed to submit review" }, { status: 500 });
    }
}