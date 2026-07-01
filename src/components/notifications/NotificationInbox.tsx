"use client";

// src/components/notifications/NotificationInbox.tsx
//
// The interactive half of the Notification Inbox feature (see
// src/app/notifications/page.tsx for the server-rendered first-paint half).
// Owns all client state: the growing list of loaded items, infinite-scroll
// pagination, optimistic read/unread transitions, and click-to-navigate.
//
// Architecture note: this component talks ONLY to /api/notifications/* —
// it has no knowledge of the Notification Engine, providers, or
// NotificationLog directly. That boundary already exists by construction
// (this is a client component; the model is server-only), which keeps the
// dependency direction correct: UI → API → engine/model, never the reverse.
//
// NEW additions:
//   - handleDeleteOne(): individual delete, calls the new
//     DELETE /api/notifications/[id] route.
//   - handleClearAll(): unchanged call signature (still DELETE
//     /api/notifications) — the fix was entirely server-side (adding the
//     missing DELETE handler); this function's own logic was already
//     correct, it was just talking to a 405.
//   - notifyNotificationsChanged(): dispatches a same-tab CustomEvent after
//     any mutation (delete/clear-all/mark-read/mark-all-read) so
//     Navbar.tsx's independent unread-count fetch can refresh immediately.

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, CheckCheck, Trash2 } from "lucide-react";
import NotificationCard from "./NotificationCard";
import EmptyInboxState from "./EmptyInboxState";
import { groupNotifications } from "./groupNotifications";
import type { InboxNotificationItem } from "@/lib/notifications/inboxQuery";

export const NOTIFICATIONS_CHANGED_EVENT = "fk:notifications-changed";

function notifyNotificationsChanged() {
    if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent(NOTIFICATIONS_CHANGED_EVENT));
    }
}

type Props = {
    initialItems: InboxNotificationItem[];
    initialNextCursor: string | null;
    initialHasMore: boolean;
    initialUnreadCount: number;
};

export default function NotificationInbox({
    initialItems,
    initialNextCursor,
    initialHasMore,
    initialUnreadCount,
}: Props) {
    const router = useRouter();

    const [items, setItems] = useState<InboxNotificationItem[]>(initialItems);
    const [cursor, setCursor] = useState<string | null>(initialNextCursor);
    const [hasMore, setHasMore] = useState(initialHasMore);
    const [unreadCount, setUnreadCount] = useState(initialUnreadCount);
    const [loadingMore, setLoadingMore] = useState(false);
    const [markingAll, setMarkingAll] = useState(false);
    const [clearing, setClearing] = useState(false);
    const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());

    const sentinelRef = useRef<HTMLDivElement | null>(null);

    // ── Infinite scroll ───────────────────────────────────────────────────
    const loadMore = useCallback(async () => {
        if (loadingMore || !hasMore || !cursor) return;
        setLoadingMore(true);
        try {
            const res = await fetch(`/api/notifications?cursor=${encodeURIComponent(cursor)}`);
            const data = await res.json();
            if (data.success) {
                setItems((prev) => [...prev, ...data.items]);
                setCursor(data.nextCursor);
                setHasMore(data.hasMore);
            }
        } catch {
            // Non-critical: the sentinel stays visible and re-triggers the
            // observer on the next scroll, so a transient network failure
            // here just means "try again shortly" rather than a hard error.
        } finally {
            setLoadingMore(false);
        }
    }, [cursor, hasMore, loadingMore]);

    useEffect(() => {
        const el = sentinelRef.current;
        if (!el || !hasMore) return;

        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0]?.isIntersecting) loadMore();
            },
            { rootMargin: "240px" }
        );
        observer.observe(el);
        return () => observer.disconnect();
    }, [loadMore, hasMore]);

    // ── Mark-as-read, then navigate to a given deep link. Shared by the
    // card's main tap (uses item.url) and individual CTA buttons (use
    // their own url, e.g. order.delivered's "Rate" vs "Order Again"). ──────
    const handleNavigate = useCallback(
        (item: InboxNotificationItem, url: string) => {
            if (!item.isRead) {
                setItems((prev) =>
                    prev.map((i) => (i.id === item.id ? { ...i, isRead: true } : i))
                );
                setUnreadCount((c) => Math.max(0, c - 1));
                // Fire-and-forget — navigation should never wait on this.
                fetch(`/api/notifications/${item.id}/read`, { method: "PATCH" })
                    .then(() => notifyNotificationsChanged())
                    .catch(() => {});
            }
            router.push(url);
        },
        [router]
    );

    // ── Mark all as read ────────────────────────────────────────────────────
    const handleMarkAllRead = useCallback(async () => {
        if (markingAll || unreadCount === 0) return;
        setMarkingAll(true);
        setItems((prev) => prev.map((i) => ({ ...i, isRead: true })));
        setUnreadCount(0);
        try {
            await fetch("/api/notifications/read-all", { method: "PATCH" });
            notifyNotificationsChanged();
        } catch {
            // Non-critical: optimistic state already reflects "all read";
            // a failed server write just means the next full reload would
            // show true state again, an acceptable rare degradation.
        } finally {
            setMarkingAll(false);
        }
    }, [markingAll, unreadCount]);

    // ── Clear all notifications ─────────────────────────────────────────────
    const handleClearAll = useCallback(async () => {
        if (clearing || items.length === 0) return;
        if (!window.confirm("Clear all notifications? This cannot be undone.")) return;

        setClearing(true);
        // Optimistic: empty the list immediately, including pagination state
        // (hasMore/cursor) — after a full clear there is genuinely nothing
        // left to load more of, so the infinite-scroll sentinel must not
        // remain active and try to fetch a now-nonexistent next page.
        setItems([]);
        setUnreadCount(0);
        setHasMore(false);
        setCursor(null);
        try {
            const res = await fetch("/api/notifications", { method: "DELETE" });
            if (!res.ok) throw new Error("Clear all failed");
            notifyNotificationsChanged();
        } catch {
            // A failed clear now genuinely means the rows still exist server
            // side — re-fetch the first page so the UI reflects reality
            // rather than silently lying about an empty inbox.
            try {
                const res = await fetch("/api/notifications");
                const data = await res.json();
                if (data.success) {
                    setItems(data.items);
                    setCursor(data.nextCursor);
                    setHasMore(data.hasMore);
                    setUnreadCount(data.unreadCount);
                }
            } catch {
                // Best-effort recovery only — nothing further to do here.
            }
        } finally {
            setClearing(false);
        }
    }, [clearing, items.length]);

    // ── Delete one notification (NEW) ───────────────────────────────────────
    const handleDeleteOne = useCallback(
        async (id: string) => {
            if (deletingIds.has(id)) return;

            const target = items.find((i) => i.id === id);
            const wasUnread = target ? !target.isRead : false;

            setDeletingIds((prev) => new Set(prev).add(id));
            // Optimistic removal
            setItems((prev) => prev.filter((i) => i.id !== id));
            if (wasUnread) setUnreadCount((c) => Math.max(0, c - 1));

            try {
                const res = await fetch(`/api/notifications/${id}`, { method: "DELETE" });
                if (!res.ok) throw new Error("Delete failed");
                notifyNotificationsChanged();
            } catch {
                // Restore on failure — put the item back where optimistic
                // removal took it from, rather than leaving the UI silently
                // wrong about what's actually still in the database.
                if (target) {
                    setItems((prev) => {
                        const next = [...prev, target];
                        return next.sort(
                            (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
                        );
                    });
                    if (wasUnread) setUnreadCount((c) => c + 1);
                }
            } finally {
                setDeletingIds((prev) => {
                    const next = new Set(prev);
                    next.delete(id);
                    return next;
                });
            }
        },
        [deletingIds, items]
    );

    const groups = groupNotifications(items);

    return (
        <div className="min-h-screen bg-[#FFFBF5]">
            {/* ── Header ─────────────────────────────────────────────────── */}
            <div className="sticky top-0 z-10 border-b border-orange-100/80 bg-[#FFFBF5]/90 px-4 pb-3 pt-5 backdrop-blur-sm">
                <div className="mx-auto flex max-w-2xl items-center justify-between">
                    <div className="flex items-center gap-2.5">
                        <h1
                            className="text-[22px] font-black text-stone-900"
                            style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
                        >
                            Notifications
                        </h1>
                        {unreadCount > 0 && (
                            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-orange-500 px-1.5 text-[10px] font-black text-white">
                                {unreadCount > 99 ? "99+" : unreadCount}
                            </span>
                        )}
                    </div>

                    <div className="flex items-center gap-1">
                        {unreadCount > 0 && (
                            <button
                                onClick={handleMarkAllRead}
                                disabled={markingAll}
                                className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-bold text-orange-600 transition-colors hover:bg-orange-50 disabled:opacity-50"
                            >
                                <CheckCheck size={14} />
                                Mark all read
                            </button>
                        )}
                        {items.length > 0 && (
                            <button
                                onClick={handleClearAll}
                                disabled={clearing}
                                aria-label="Clear all notifications"
                                className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-bold text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-600 disabled:opacity-50"
                            >
                                <Trash2 size={13} />
                                <span className="hidden sm:inline">Clear all</span>
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* ── Body ───────────────────────────────────────────────────── */}
            {items.length === 0 ? (
                <EmptyInboxState />
            ) : (
                <div className="mx-auto max-w-2xl space-y-6 px-4 pt-4">
                    <AnimatePresence initial={false}>
                        {groups.map((group) => (
                            <motion.section key={group.label} layout>
                                <h2 className="mb-2 px-0.5 text-[11px] font-black uppercase tracking-[0.16em] text-stone-400">
                                    {group.label}
                                </h2>
                                <div className="space-y-2">
                                    {group.items.map((item) => (
                                        <NotificationCard
                                            key={item.id}
                                            item={item}
                                            group={group.label}
                                            onClick={() => handleNavigate(item, item.url)}
                                            onCtaClick={(url) => handleNavigate(item, url)}
                                            onDelete={handleDeleteOne}
                                        />
                                    ))}
                                </div>
                            </motion.section>
                        ))}
                    </AnimatePresence>

                    {/* Infinite-scroll sentinel */}
                    {hasMore && (
                        <div ref={sentinelRef} className="flex justify-center py-6">
                            {loadingMore && (
                                <span className="h-5 w-5 animate-spin rounded-full border-2 border-orange-300 border-t-orange-500" />
                            )}
                        </div>
                    )}

                    {!hasMore && items.length > 0 && (
                        <p className="flex items-center justify-center gap-1.5 py-6 text-[11px] text-stone-400">
                            <Bell size={11} />
                            You&apos;re all caught up
                        </p>
                    )}
                </div>
            )}
        </div>
    );
}