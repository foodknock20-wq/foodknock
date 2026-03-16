export const dynamic = "force-dynamic";

// src/app/api/admin/review-rewards/route.ts
//
// GET /api/admin/review-rewards
//
// Returns all ReviewReward submissions for the admin panel.
// Admin-only: verified via JWT + role check.

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

export async function GET(req: Request) {
    await connectDB();

    const adminId = await requireAdmin(req);
    if (!adminId) {
        return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
    }

    try {
        const submissions = await ReviewReward.find()
            .sort({ createdAt: -1 })
            .populate({ path: "user", select: "name email phone", model: User })
            .lean<Array<{
                _id:           unknown;
                user:          { _id: unknown; name?: string; email?: string; phone?: string } | null;
                instagramLink: string;
                status:        string;
                rewardItem:    string;
                rewardUsed:    boolean;
                adminNote:     string;
                createdAt:     Date;
                updatedAt:     Date;
            }>>();

        const data = submissions.map((s) => ({
            _id:           String(s._id),
            user: {
                id:    s.user ? String(s.user._id) : "",
                name:  s.user?.name  ?? "Unknown",
                email: s.user?.email ?? "",
                phone: s.user?.phone ?? "",
            },
            instagramLink: s.instagramLink,
            status:        s.status,
            rewardItem:    s.rewardItem,
            rewardUsed:    s.rewardUsed,
            adminNote:     s.adminNote ?? "",
            createdAt:     s.createdAt,
            updatedAt:     s.updatedAt,
        }));

        return NextResponse.json({ success: true, submissions: data });
    } catch (error) {
        console.error("ADMIN_REVIEW_REWARDS_GET_ERROR", error);
        return NextResponse.json(
            { success: false, message: "Failed to fetch submissions" },
            { status: 500 }
        );
    }
}