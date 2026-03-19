export const dynamic = "force-dynamic";

// src/app/api/review-reward/status/route.ts
//
// GET /api/review-reward/status
//
// Returns the authenticated user's current submission status.
// Used by the review-reward page to show submission state on load.

import { NextResponse } from "next/server";
import { connectDB }    from "@/lib/db";
import { verifyToken }  from "@/lib/auth";
import ReviewReward     from "@/models/ReviewReward";

export async function GET(req: Request) {
    try {
        await connectDB();

        const cookieHeader = req.headers.get("cookie") ?? "";
        const tokenMatch   = cookieHeader.match(/(?:^|;\s*)token=([^;]+)/);
        const token        = tokenMatch ? decodeURIComponent(tokenMatch[1]) : null;

        if (!token) {
            return NextResponse.json({ success: true, submission: null });
        }

        let userId: string;
        try {
            const decoded = verifyToken(token) as { userId?: string };
            if (!decoded?.userId) throw new Error();
            userId = decoded.userId;
        } catch {
            return NextResponse.json({ success: true, submission: null });
        }

        const submission = await ReviewReward.findOne({ user: userId })
            .select("status rewardItem rewardUsed instagramLink createdAt")
            .lean<{
                status: string;
                rewardItem: string;
                rewardUsed: boolean;
                instagramLink: string;
                createdAt: Date;
            }>();

        if (!submission) {
            return NextResponse.json({ success: true, submission: null });
        }

        return NextResponse.json({
            success: true,
            submission: {
                status:        submission.status,
                rewardItem:    submission.rewardItem,
                rewardUsed:    submission.rewardUsed,
                instagramLink: submission.instagramLink,
                submittedAt:   submission.createdAt,
            },
        });
    } catch (error) {
        console.error("REVIEW_REWARD_STATUS_ERROR", error);
        return NextResponse.json({ success: true, submission: null });
    }
}