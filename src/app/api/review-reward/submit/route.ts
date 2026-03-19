export const dynamic = "force-dynamic";

// src/app/api/review-reward/submit/route.ts
//
// POST /api/review-reward/submit
//
// Authenticated users submit their Instagram reel link.
// Creates a ReviewReward document with status "pending".
//
// Rules enforced:
//   • Must be authenticated
//   • Must be a valid Instagram reel/post URL
//   • One submission per user (duplicate → 409)

import { NextResponse }   from "next/server";
import { connectDB }      from "@/lib/db";
import { verifyToken }    from "@/lib/auth";
import User               from "@/models/User";
import ReviewReward       from "@/models/ReviewReward";

// Accepts instagram.com/reel/..., instagram.com/p/..., instagram.com/tv/...
const INSTAGRAM_RE =
    /^https?:\/\/(www\.)?instagram\.com\/(reel|p|tv)\/[A-Za-z0-9_-]+\/?(\?.*)?$/i;

export async function POST(req: Request) {
    try {
        await connectDB();

        // ── Auth ──────────────────────────────────────────────────────────────
        const cookieHeader = req.headers.get("cookie") ?? "";
        const tokenMatch   = cookieHeader.match(/(?:^|;\s*)token=([^;]+)/);
        const token        = tokenMatch ? decodeURIComponent(tokenMatch[1]) : null;

        if (!token) {
            return NextResponse.json(
                { success: false, message: "Please sign in to submit a review" },
                { status: 401 }
            );
        }

        let userId: string;
        try {
            const decoded = verifyToken(token) as { userId?: string };
            if (!decoded?.userId) throw new Error();
            userId = decoded.userId;
        } catch {
            return NextResponse.json(
                { success: false, message: "Invalid session. Please sign in again." },
                { status: 401 }
            );
        }

        const user = await User.findById(userId).select("_id isActive name").lean<{ _id: unknown; isActive: boolean; name: string }>();
        if (!user || user.isActive === false) {
            return NextResponse.json(
                { success: false, message: "Account not found or deactivated." },
                { status: 403 }
            );
        }

        // ── Parse body ────────────────────────────────────────────────────────
        const body = await req.json();
        const instagramLink: string = (body.instagramLink ?? "").trim();

        if (!instagramLink) {
            return NextResponse.json(
                { success: false, message: "Instagram link is required." },
                { status: 400 }
            );
        }

        if (!INSTAGRAM_RE.test(instagramLink)) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "Please enter a valid Instagram reel URL (e.g. https://www.instagram.com/reel/ABC123/)",
                },
                { status: 400 }
            );
        }

        // ── Duplicate check ───────────────────────────────────────────────────
        const existing = await ReviewReward.findOne({ user: userId }).lean();
        if (existing) {
            return NextResponse.json(
                {
                    success:  false,
                    message:  "You have already submitted a review. Each account can submit once.",
                    existing: true,
                },
                { status: 409 }
            );
        }

        // ── Create submission ─────────────────────────────────────────────────
        const reward = await ReviewReward.create({
            user:          userId,
            instagramLink,
            status:        "pending",
            rewardItem:    "burger",
            rewardUsed:    false,
        });

        return NextResponse.json({
            success: true,
            message:
                "Your review has been submitted! Our team will verify it shortly. " +
                "Once approved, you'll receive a FREE Burger on your next order 🍔",
            rewardId: String(reward._id),
        });
    } catch (error) {
        console.error("REVIEW_REWARD_SUBMIT_ERROR", error);
        return NextResponse.json(
            { success: false, message: "Something went wrong. Please try again." },
            { status: 500 }
        );
    }
}