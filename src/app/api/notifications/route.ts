export const dynamic = "force-dynamic";

// src/app/api/notifications/route.ts
//
// GET    — paginated inbox list for the CURRENT authenticated user only.
// DELETE — NEW. This handler did NOT exist before. The client
//          (NotificationInbox.tsx's handleClearAll) has always called
//          `fetch("/api/notifications", { method: "DELETE" })` — with no
//          matching handler here, that request 405'd, was silently
//          swallowed by the client's empty catch{}, and a refresh restored
//          every "cleared" notification. This adds the missing handler.
//          Scoped by `user: userId` — same authorization pattern every
//          other route in this file already uses; a user can only ever
//          delete their OWN rows, by construction of the query.

import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import NotificationLog from "@/models/NotificationLog";
import { verifyToken } from "@/lib/auth";
import { fetchInboxPage, fetchUnreadCount, INBOX_EXCLUDED_EVENTS } from "@/lib/notifications/inboxQuery";

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

export async function GET(req: NextRequest) {
    const userId = getUserId(req);
    if (!userId) {
        return NextResponse.json(
            { success: false, message: "Unauthorised" },
            { status: 401 }
        );
    }

    try {
        const cursor = req.nextUrl.searchParams.get("cursor");
        const [page, unreadCount] = await Promise.all([
            fetchInboxPage(userId, cursor),
            fetchUnreadCount(userId),
        ]);

        return NextResponse.json({
            success: true,
            items: page.items,
            nextCursor: page.nextCursor,
            hasMore: page.hasMore,
            unreadCount,
        });
    } catch (error) {
        console.error("NOTIFICATIONS_INBOX_ERROR", error);
        return NextResponse.json(
            { success: false, message: "Failed to load notifications" },
            { status: 500 }
        );
    }
}

/**
 * DELETE — permanently removes every inbox-eligible notification belonging
 * to the authenticated user. "Inbox-eligible" mirrors the exact same
 * INBOX_EXCLUDED_EVENTS filter GET already applies (via inboxQuery.ts) —
 * deliberately NOT a blanket `{user: userId}` delete, so a "clear all"
 * click can never remove OTP/security rows that were never shown in the
 * inbox in the first place.
 *
 * A genuine MongoDB delete (`deleteMany`) — not a soft-delete/status flag
 * — so a page refresh can never resurrect a "cleared" notification.
 */
export async function DELETE(req: NextRequest) {
    const userId = getUserId(req);
    if (!userId) {
        return NextResponse.json(
            { success: false, message: "Unauthorised" },
            { status: 401 }
        );
    }

    try {
        await connectDB();

        const result = await NotificationLog.deleteMany({
            user: userId,
            event: { $nin: INBOX_EXCLUDED_EVENTS },
        });

        return NextResponse.json({
            success: true,
            deleted: result.deletedCount ?? 0,
        });
    } catch (error) {
        console.error("NOTIFICATIONS_CLEAR_ALL_ERROR", error);
        return NextResponse.json(
            { success: false, message: "Failed to clear notifications" },
            { status: 500 }
        );
    }
}