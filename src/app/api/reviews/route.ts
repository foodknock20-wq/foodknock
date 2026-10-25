export const dynamic = "force-dynamic";

// src/app/api/reviews/route.ts
// GET  — returns only publicly-visible reviews (this is an unauthenticated
//        public endpoint, so it MUST never return hidden reviews, whatever
//        query params are supplied).
// POST — submit a new review. Requires a logged-in FoodKnock user
//        (server-verified); the author name is taken from the trusted
//        session, never the request body. Successfully submitted reviews
//        are visible immediately — there is no admin approval gate.

import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import Review from "@/models/Review";
import User from "@/models/User";
import { requireUser } from "@/lib/apiAuth";
import { isRateLimited, getClientIp } from "@/lib/rateLimit";

// ── GET ───────────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
    try {
        await connectDB();

        const { searchParams } = new URL(req.url);
        const search = searchParams.get("search")?.trim();

        // Public endpoint: ALWAYS restrict to visible reviews. Hidden
        // reviews (isApproved:false) must never leak through any public
        // surface, regardless of request params.
        const query: Record<string, unknown> = { isApproved: true };
        if (search) {
            query.$or = [
                { userName: { $regex: search, $options: "i" } },
                { comment:  { $regex: search, $options: "i" } },
            ];
        }

        // PHASE 6: bounded — this is read by both the public reviews page
        // and the admin moderation list; neither needs an unbounded fetch.
        const reviews = await Review.find(query)
            .sort({ createdAt: -1 })
            .limit(200)
            .lean();

        return NextResponse.json({ success: true, reviews });
    } catch (error) {
        console.error("GET_REVIEWS_ERROR", error);
        return NextResponse.json({ success: false, message: "Failed to fetch reviews" }, { status: 500 });
    }
}

// ── POST ──────────────────────────────────────────────────────────────────
// Login-only submission: a review may only be created by an authenticated,
// server-verified FoodKnock user. The author name comes from that user's
// account (NOT the request body), so a client cannot impersonate anyone.
// A light per-IP rate limit (10/hour) still guards against abuse. Only
// rating/comment are read from the body; any client-supplied userName or
// moderation field (isApproved, isHidden, verified, etc.) is ignored —
// identity and visibility are owned entirely by the server.
export async function POST(req: NextRequest) {
    try {
        const ip = getClientIp(req);
        const limited = await isRateLimited(`review-submit:${ip}`, 10, 60 * 60 * 1000);
        if (limited) {
            return NextResponse.json(
                { success: false, message: "Too many submissions. Please try again later." },
                { status: 429 }
            );
        }

        // Require a logged-in, active, server-verified user. A logged-out
        // visitor can read reviews but can never submit one, even by calling
        // this endpoint directly.
        const auth = await requireUser(req);
        if (!auth) {
            return NextResponse.json(
                { success: false, message: "Please sign in to write a review." },
                { status: 401 }
            );
        }

        await connectDB();

        const account = await User.findById(auth.userId).select("name").lean<{ name?: string } | null>();
        const userName = account?.name?.trim();
        if (!userName) {
            // Authenticated but no usable account name — treat as a server-side
            // data issue, never fall back to a client-supplied name.
            return NextResponse.json(
                { success: false, message: "Your account is missing a display name." },
                { status: 400 }
            );
        }

        const { rating, comment } = await req.json();

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
            userName,                 // from the trusted session, not the body
            rating,
            comment:  comment.trim(),
            // isApproved is intentionally NOT set here — the schema default
            // (true => visible immediately) applies. Never accept a
            // visibility value from the request body.
        });

        return NextResponse.json(
            { success: true, message: "Thanks for your review! It's now visible on FoodKnock.", review },
            { status: 201 }
        );
    } catch (error) {
        console.error("POST_REVIEW_ERROR", error);
        return NextResponse.json({ success: false, message: "Failed to submit review" }, { status: 500 });
    }
}