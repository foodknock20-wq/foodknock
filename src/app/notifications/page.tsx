export const dynamic = "force-dynamic";

// src/app/notifications/page.tsx
//
// Server component — mirrors the existing admin/orders/page.tsx pattern:
// fetch the first page of data directly in the server component (fast
// first paint, no client-side waterfall), then hand off to a client
// component for everything interactive (infinite scroll, read-state,
// click-to-navigate).
//
// Auth is checked here rather than in middleware.ts: this route wasn't
// previously protected, and adding it to middleware's matcher would touch
// a working, unrelated file for a need this page can fully satisfy itself.
//
// UI REDESIGN: now wraps NotificationInbox with the SAME Navbar/Footer
// pattern src/app/(main)/my-orders/page.tsx already uses — this is what
// lets the page "fit naturally between both navbars" per the design brief.
// No data-fetching logic changed at all.

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifyToken } from "@/lib/auth";
import { fetchInboxPage, fetchUnreadCount } from "@/lib/notifications/inboxQuery";
import NotificationInbox from "@/components/notifications/NotificationInbox";
import Navbar from "@/components/shared/Navbar";
import Footer from "@/components/shared/Footer";

async function getAuthedUserId(): Promise<string | null> {
    const cookieStore = await cookies();
    const token = cookieStore.get("token")?.value;
    if (!token) return null;
    try {
        const decoded = verifyToken(token) as { userId?: string };
        return decoded?.userId ?? null;
    } catch {
        return null;
    }
}

export default async function NotificationsPage() {
    const userId = await getAuthedUserId();

    if (!userId) {
        redirect("/auth?redirect=/notifications");
    }

    const [firstPage, unreadCount] = await Promise.all([
        fetchInboxPage(userId),
        fetchUnreadCount(userId),
    ]);

    return (
        <>
            <Navbar />
            <NotificationInbox
                initialItems={firstPage.items}
                initialNextCursor={firstPage.nextCursor}
                initialHasMore={firstPage.hasMore}
                initialUnreadCount={unreadCount}
            />
            <Footer />
        </>
    );
}