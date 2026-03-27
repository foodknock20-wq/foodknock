export const dynamic = "force-dynamic";

// src/app/api/review-reward/approved/route.ts
//
// GET /api/review-reward/approved
//
// Returns all approved (and not-used) ReviewReward submissions
// so the review-reward page can display a social proof wall.
// User names are partially redacted for privacy (e.g. "Rahul S.")

import { NextResponse } from "next/server";
import { connectDB }    from "@/lib/db";
import ReviewReward     from "@/models/ReviewReward";
import User             from "@/models/User";

function redactName(name: string): string {
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0];
    return `${parts[0]} ${parts[parts.length - 1][0]}.`;
}

export async function GET() {
    try {
        await connectDB();

        const approved = await ReviewReward.find({ status: "approved" })
            .sort({ updatedAt: -1 })
            .limit(20)
            .populate({ path: "user", select: "name", model: User })
            .lean<Array<{
                _id:           unknown;
                instagramLink: string;
                rewardItem:    string;
                updatedAt:     Date;
                user:          { name?: string } | null;
            }>>();

        const reviews = approved.map((r) => ({
            id:            String(r._id),
            instagramLink: r.instagramLink,
            rewardItem:    r.rewardItem,
            approvedAt:    r.updatedAt,
            userName:      r.user?.name ? redactName(r.user.name) : "FoodKnock Fan",
        }));

        return NextResponse.json({ success: true, reviews });
    } catch (error) {
        console.error("REVIEW_REWARD_APPROVED_ERROR", error);
        return NextResponse.json({ success: true, reviews: [] });
    }
}