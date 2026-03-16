export const dynamic = "force-dynamic";

// src/app/api/admin/review-rewards/delete/route.ts
//
// DELETE /api/admin/review-rewards/delete
//
// Permanently removes a ReviewReward document from MongoDB.
// Admin-only.
//
// Body: { id: string }

import { NextResponse } from "next/server";
import { connectDB }    from "@/lib/db";
import { verifyToken }  from "@/lib/auth";
import User             from "@/models/User";
import ReviewReward     from "@/models/ReviewReward";

async function requireAdmin(req: Request): Promise<boolean> {
    const cookieHeader = req.headers.get("cookie") ?? "";
    const tokenMatch   = cookieHeader.match(/(?:^|;\s*)token=([^;]+)/);
    const token        = tokenMatch ? decodeURIComponent(tokenMatch[1]) : null;
    if (!token) return false;

    try {
        const decoded = verifyToken(token) as { userId?: string };
        if (!decoded?.userId) return false;
        await connectDB();
        const user = await User.findById(decoded.userId)
            .select("role isActive")
            .lean<{ role: string; isActive: boolean }>();
        return !!(user && user.isActive !== false && user.role === "admin");
    } catch {
        return false;
    }
}

export async function DELETE(req: Request) {
    const isAdmin = await requireAdmin(req);
    if (!isAdmin) {
        return NextResponse.json(
            { success: false, message: "Forbidden" },
            { status: 403 }
        );
    }

    try {
        const body = await req.json();
        const { id } = body;

        if (!id) {
            return NextResponse.json(
                { success: false, message: "id is required" },
                { status: 400 }
            );
        }

        const deleted = await ReviewReward.findByIdAndDelete(id);

        if (!deleted) {
            return NextResponse.json(
                { success: false, message: "Submission not found" },
                { status: 404 }
            );
        }

        return NextResponse.json({
            success: true,
            message: "Submission deleted successfully",
        });
    } catch (error) {
        console.error("REVIEW_REWARD_DELETE_ERROR", error);
        return NextResponse.json(
            { success: false, message: "Failed to delete submission" },
            { status: 500 }
        );
    }
}