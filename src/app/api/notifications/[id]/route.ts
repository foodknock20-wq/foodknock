export const dynamic = "force-dynamic";

// src/app/api/notifications/[id]/route.ts
//
// DELETE — permanently removes ONE notification belonging to the
// authenticated user. This route did not exist before — there was no
// individual-delete capability anywhere in the module. Follows the EXACT
// same auth/scoping pattern already established by
// [id]/read/route.ts (PATCH): the `{_id: id, user: userId}` filter IS the
// authorization boundary — a request for someone else's notification id
// simply matches zero documents, deleting nothing.
//
// A genuine deleteOne — not a soft-delete — so a refresh can never
// resurrect it.

import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import NotificationLog from "@/models/NotificationLog";
import { verifyToken } from "@/lib/auth";

type RouteContext = { params: Promise<{ id: string }> };

function getUserId(req: NextRequest): string | null {
    const cookieHeader = req.headers.get("cookie") ?? "";
    const tokenMatch = cookieHeader.match(/(?:^|;\s*)token=([^;]+)/);
    const token = tokenMatch ? decodeURIComponent(tokenMatch[1]) : null;
    if (!token) return null;
    try {
        const decoded = verifyToken(token) as { userId?: string };
        return decoded?.userId ?? null;
    } catch {
        return null;
    }
}

export async function DELETE(req: NextRequest, context: RouteContext) {
    const userId = getUserId(req);
    if (!userId) {
        return NextResponse.json(
            { success: false, message: "Unauthorised" },
            { status: 401 }
        );
    }

    try {
        const { id } = await context.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return NextResponse.json(
                { success: false, message: "Invalid notification ID" },
                { status: 400 }
            );
        }

        await connectDB();

        const result = await NotificationLog.deleteOne({ _id: id, user: userId });

        // Always success — whether this id belonged to the user and was
        // deleted, or it never existed/belonged to someone else (0 rows
        // matched), the client's desired end state (this id is gone from
        // THEIR view) is achieved either way, same "idempotent success"
        // pattern the existing mark-read route already follows.
        return NextResponse.json({
            success: true,
            deleted: result.deletedCount ?? 0,
        });
    } catch (error) {
        console.error("NOTIFICATION_DELETE_ERROR", error);
        return NextResponse.json(
            { success: false, message: "Failed to delete notification" },
            { status: 500 }
        );
    }
}