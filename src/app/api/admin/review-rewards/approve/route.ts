export const dynamic = "force-dynamic";

// src/app/api/admin/review-rewards/approve/route.ts
//
// POST /api/admin/review-rewards/approve
//
// Admin approves or rejects a ReviewReward submission.
//
// Body: { id: string; action: "approve" | "reject"; adminNote?: string; rewardItem?: "burger" | "pizza" }

import { NextResponse } from "next/server";
import { connectDB }    from "@/lib/db";
import { verifyToken }  from "@/lib/auth";
import User             from "@/models/User";
import ReviewReward     from "@/models/ReviewReward";

async function requireAdmin(req: Request): Promise<string | null> {
    const cookieHeader = req.headers.get("cookie") ?? "";
    const tokenMatch   = cookieHeader.match(/(?:^|;\s*)token=([^;]+)/);
    const token        = tokenMatch ? decodeURIComponent(tokenMatch[1]) : null;
    if (!token) return null;

    try {
        const decoded = verifyToken(token) as { userId?: string };
        if (!decoded?.userId) return null;
        const user = await User.findById(decoded.userId)
            .select("role isActive")
            .lean<{ role: string; isActive: boolean }>();
        if (!user || user.isActive === false || user.role !== "admin") return null;
        return decoded.userId;
    } catch {
        return null;
    }
}

export async function POST(req: Request) {
    await connectDB();

    const adminId = await requireAdmin(req);
    if (!adminId) {
        return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
    }

    try {
        const body = await req.json();
        const { id, action, adminNote = "", rewardItem } = body;

        if (!id || !["approve", "reject"].includes(action)) {
            return NextResponse.json(
                { success: false, message: "id and action (approve|reject) are required" },
                { status: 400 }
            );
        }

        const submission = await ReviewReward.findById(id);
        if (!submission) {
            return NextResponse.json(
                { success: false, message: "Submission not found" },
                { status: 404 }
            );
        }

        // Already processed — idempotency
        if (submission.status !== "pending") {
            return NextResponse.json({
                success: true,
                message: `Already ${submission.status}`,
                submission: { id, status: submission.status },
            });
        }

        submission.status    = action === "approve" ? "approved" : "rejected";
        submission.adminNote = adminNote;
        if (action === "approve" && rewardItem) {
            submission.rewardItem = rewardItem;
        }
        await submission.save();

        return NextResponse.json({
            success: true,
            message:
                action === "approve"
                    ? "Submission approved. User will receive a free item on next order."
                    : "Submission rejected.",
            submission: {
                id,
                status:     submission.status,
                rewardItem: submission.rewardItem,
            },
        });
    } catch (error) {
        console.error("ADMIN_REVIEW_REWARD_APPROVE_ERROR", error);
        return NextResponse.json(
            { success: false, message: "Failed to update submission" },
            { status: 500 }
        );
    }
}