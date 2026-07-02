"use client";

// src/components/notifications/NotificationInbox.tsx
//
// UI/UX REDESIGN — premium hero + stats, redesigned segmented filter
// chips, redesigned search, redesigned card list (see NotificationCard.tsx),
// skeleton loading (see NotificationSkeleton.tsx), premium empty state
// (see EmptyInboxState.tsx). Every piece of BUSINESS LOGIC below is
// UNCHANGED from the working version: infinite scroll, pagination cursor,
// mark-read/mark-all-read, delete/clear-all (with the existing ConfirmModal,
// no browser confirm()), undo-delete toast, client-side search/filter over
// the already-loaded `items` array. No new API calls, no new endpoints, no
// schema/engine changes.

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
    Bell, CheckCheck, Trash2, Search, X, Undo2,
    PackageCheck, Gift, Tag, Settings2, Inbox as InboxIcon,
} from "lucide-react";
import NotificationCard from "./NotificationCard";
import NotificationSkeleton from "./NotificationSkeleton";
import EmptyInboxState from "./EmptyInboxState";
import ConfirmModal from "./ConfirmModal";
import { groupNotifications } from "./groupNotifications";
import type { InboxNotificationItem } from "@/lib/notifications/inboxQuery";

export const NOTIFICATIONS_CHANGED_EVENT = "fk:notifications-changed";

function notifyNotificationsChanged() {
    if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent(NOTIFICATIONS_CHANGED_EVENT));
    }
}

// ── Filter chips — reuses the EXISTING `category` field only. ─────────────
type FilterKey = "all" | "orders" | "rewards" | "offers" | "system" | "general";

const FILTER_META: Record<FilterKey, { label: string; icon: React.ElementType }> = {
    all: { label: "All", icon: InboxIcon },
    orders: { label: "Orders", icon: PackageCheck },
    rewards: { label: "Rewards", icon: Gift },
    offers: { label: "Offers", icon: Tag },
    system: { label: "System", icon: Settings2 },
    general: { label: "General", icon: Bell },
};

const FILTER_ORDER: FilterKey[] = ["all", "orders", "rewards", "offers", "system", "general"];

function bucketForCategory(category: string): FilterKey {
    switch (category) {
        case "order_update":
            return "orders";
        case "reward":
            return "rewards";
        case "offer":
        case "lunch_deal":
        case "evening_deal":
        case "festival":
        case "flash_sale":
        case "price_drop":
            return "offers";
        case "system":
            return "system";
        default:
            return "general";
    }
}

function isToday(iso: string): boolean {
    const d = new Date(iso);
    const now = new Date();
    return (
        d.getFullYear() === now.getFullYear() &&
        d.getMonth() === now.getMonth() &&
        d.getDate() === now.getDate()
    );
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

    const [clearConfirmOpen, setClearConfirmOpen] = useState(false);
    const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

    const [search, setSearch] = useState("");
    const [activeFilter, setActiveFilter] = useState<FilterKey>("all");

    const [undoState, setUndoState] = useState<{ item: InboxNotificationItem; wasUnread: boolean } | null>(null);
    const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const sentinelRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        return () => {
            if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
        };
    }, []);

    // ── Infinite scroll — UNCHANGED logic ──────────────────────────────────
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
            // Non-critical — sentinel re-triggers on next scroll.
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

    const handleNavigate = useCallback(
        (item: InboxNotificationItem, url: string) => {
            if (!item.isRead) {
                setItems((prev) =>
                    prev.map((i) => (i.id === item.id ? { ...i, isRead: true } : i))
                );
                setUnreadCount((c) => Math.max(0, c - 1));
                fetch(`/api/notifications/${item.id}/read`, { method: "PATCH" })
                    .then(() => notifyNotificationsChanged())
                    .catch(() => {});
            }
            router.push(url);
        },
        [router]
    );

    const handleMarkAllRead = useCallback(async () => {
        if (markingAll || unreadCount === 0) return;
        setMarkingAll(true);
        setItems((prev) => prev.map((i) => ({ ...i, isRead: true })));
        setUnreadCount(0);
        try {
            await fetch("/api/notifications/read-all", { method: "PATCH" });
            notifyNotificationsChanged();
        } catch {
            // Non-critical.
        } finally {
            setMarkingAll(false);
        }
    }, [markingAll, unreadCount]);

    const performClearAll = useCallback(async () => {
        setClearing(true);
        setItems([]);
        setUnreadCount(0);
        setHasMore(false);
        setCursor(null);
        try {
            const res = await fetch("/api/notifications", { method: "DELETE" });
            if (!res.ok) throw new Error("Clear all failed");
            notifyNotificationsChanged();
        } catch {
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
                // Best-effort recovery only.
            }
        } finally {
            setClearing(false);
            setClearConfirmOpen(false);
        }
    }, []);

    const handleClearAllClick = useCallback(() => {
        if (items.length === 0) return;
        setClearConfirmOpen(true);
    }, [items.length]);

    const performDeleteOne = useCallback(
        async (id: string) => {
            if (deletingIds.has(id)) return;

            const target = items.find((i) => i.id === id);
            if (!target) return;
            const wasUnread = !target.isRead;

            if (undoTimerRef.current) clearTimeout(undoTimerRef.current);

            setDeletingIds((prev) => new Set(prev).add(id));
            setItems((prev) => prev.filter((i) => i.id !== id));
            if (wasUnread) setUnreadCount((c) => Math.max(0, c - 1));

            try {
                const res = await fetch(`/api/notifications/${id}`, { method: "DELETE" });
                if (!res.ok) throw new Error("Delete failed");
                notifyNotificationsChanged();

                setUndoState({ item: target, wasUnread });
                undoTimerRef.current = setTimeout(() => setUndoState(null), 5000);
            } catch {
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

    // Premium confirm modal replaces window.confirm() for single delete too.
    const handleDeleteRequest = useCallback((id: string) => {
        setDeleteConfirmId(id);
    }, []);

    const confirmDelete = useCallback(() => {
        if (!deleteConfirmId) return;
        const id = deleteConfirmId;
        setDeleteConfirmId(null);
        performDeleteOne(id);
    }, [deleteConfirmId, performDeleteOne]);

    const handleUndo = useCallback(() => {
        if (!undoState) return;
        if (undoTimerRef.current) clearTimeout(undoTimerRef.current);

        setItems((prev) => {
            const next = [...prev, undoState.item];
            return next.sort(
                (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
            );
        });
        if (undoState.wasUnread) setUnreadCount((c) => c + 1);
        setUndoState(null);
    }, [undoState]);

    // ── Search + filter — pure client-side derivation, no API change ──────
    const visibleItems = useMemo(() => {
        let list = items;

        if (activeFilter !== "all") {
            list = list.filter((i) => bucketForCategory(i.category) === activeFilter);
        }

        const q = search.trim().toLowerCase();
        if (q) {
            list = list.filter((i) => {
                if (i.title.toLowerCase().includes(q)) return true;
                if (i.body.toLowerCase().includes(q)) return true;
                return i.ctaButtons.some((cta) => cta.label.toLowerCase().includes(q));
            });
        }

        return list;
    }, [items, activeFilter, search]);

    const groups = useMemo(() => groupNotifications(visibleItems), [visibleItems]);
    const isFiltering = search.trim().length > 0 || activeFilter !== "all";

    // ── Stats derived purely from already-loaded data — no invented fields ─
    const stats = useMemo(() => {
        const todayCount = items.filter((i) => isToday(i.createdAt)).length;
        const rewardsCount = items.filter((i) => bucketForCategory(i.category) === "rewards").length;
        const ordersCount = items.filter((i) => bucketForCategory(i.category) === "orders").length;
        const readCount = items.length - unreadCount;
        return { todayCount, rewardsCount, ordersCount, readCount };
    }, [items, unreadCount]);

    const deleteTarget = deleteConfirmId ? items.find((i) => i.id === deleteConfirmId) ?? null : null;

    return (
        <main className="min-h-screen bg-[#FFFBF5]">
            {/* ── Hero ─────────────────────────────────────────────────────── */}
            <section className="relative overflow-hidden border-b border-amber-100">
                <div className="absolute inset-0 bg-gradient-to-br from-amber-50/90 via-[#FFFBF5] to-orange-50/70" />
                <div
                    className="pointer-events-none absolute inset-0 opacity-[0.022]"
                    style={{ backgroundImage: "radial-gradient(circle, #92400e 1px, transparent 1px)", backgroundSize: "28px 28px" }}
                />
                <div
                    className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full opacity-25 blur-3xl"
                    style={{ background: "radial-gradient(ellipse, #fb923c, transparent 70%)" }}
                />
                <div
                    className="pointer-events-none absolute -left-16 bottom-0 h-48 w-48 rounded-full opacity-15 blur-3xl"
                    style={{ background: "radial-gradient(ellipse, #fbbf24, transparent 70%)" }}
                />

                <div className="relative mx-auto max-w-4xl px-4 pb-8 pt-10 md:px-8 md:pb-10 md:pt-14">
                    <div className="mb-4 flex items-center gap-3.5">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 shadow-lg shadow-amber-200/70">
                            <Bell size={22} className="text-white" strokeWidth={2} />
                        </div>
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-[0.28em] text-orange-500">FoodKnock</p>
                            <h1 className="text-2xl font-black leading-tight text-stone-900 md:text-3xl">Notifications</h1>
                        </div>
                    </div>
                    <p className="mb-6 max-w-md text-sm leading-relaxed text-stone-500">
                        Stay updated with every order, reward, offer and important activity — all in one place.
                    </p>

                    {items.length > 0 && (
                        <div className="flex flex-wrap gap-2.5">
                            <div className="flex items-center gap-2 rounded-2xl border border-orange-200 bg-orange-50 px-4 py-2.5 shadow-sm">
                                <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-orange-100">
                                    <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-orange-500" />
                                </div>
                                <div>
                                    <p className="text-[9px] font-black uppercase tracking-widest leading-none text-orange-400">Unread</p>
                                    <p className="text-sm font-black text-orange-700">{unreadCount}</p>
                                </div>
                            </div>

                            <div className="flex items-center gap-2 rounded-2xl border border-amber-200 bg-white px-4 py-2.5 shadow-sm">
                                <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-amber-100">
                                    <Bell size={13} className="text-amber-600" />
                                </div>
                                <div>
                                    <p className="text-[9px] font-black uppercase tracking-widest leading-none text-stone-400">Today</p>
                                    <p className="text-sm font-black text-stone-900">{stats.todayCount}</p>
                                </div>
                            </div>

                            {stats.ordersCount > 0 && (
                                <div className="flex items-center gap-2 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-2.5 shadow-sm">
                                    <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-sky-100">
                                        <PackageCheck size={13} className="text-sky-600" />
                                    </div>
                                    <div>
                                        <p className="text-[9px] font-black uppercase tracking-widest leading-none text-sky-400">Orders</p>
                                        <p className="text-sm font-black text-sky-700">{stats.ordersCount}</p>
                                    </div>
                                </div>
                            )}

                            {stats.rewardsCount > 0 && (
                                <div className="flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 shadow-sm">
                                    <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-emerald-100">
                                        <Gift size={13} className="text-emerald-600" />
                                    </div>
                                    <div>
                                        <p className="text-[9px] font-black uppercase tracking-widest leading-none text-emerald-500">Rewards</p>
                                        <p className="text-sm font-black text-emerald-700">{stats.rewardsCount}</p>
                                    </div>
                                </div>
                            )}

                            <div className="flex items-center gap-2 rounded-2xl border border-violet-200 bg-violet-50 px-4 py-2.5 shadow-sm">
                                <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-violet-100">
                                    <CheckCheck size={13} className="text-violet-600" />
                                </div>
                                <div>
                                    <p className="text-[9px] font-black uppercase tracking-widest leading-none text-violet-400">Read</p>
                                    <p className="text-sm font-black text-violet-700">{stats.readCount}</p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </section>

            {/* ── Sticky filter + search ─────────────────────────────────────── */}
            {items.length > 0 && (
                <div className="sticky top-[68px] z-30 border-b border-amber-100 bg-[#FFFBF5]/95 shadow-sm backdrop-blur-xl">
                    <div className="mx-auto max-w-4xl px-4 md:px-8">
                        <div className="flex items-center justify-between gap-2 py-3">
                            <div className="flex flex-1 items-center gap-1.5 overflow-x-auto scrollbar-none" role="tablist" aria-label="Filter notifications by category">
                                {FILTER_ORDER.map((key) => {
                                    const { label, icon: Icon } = FILTER_META[key];
                                    const active = activeFilter === key;
                                    return (
                                        <button
                                            key={key}
                                            role="tab"
                                            aria-selected={active}
                                            onClick={() => setActiveFilter(key)}
                                            className={`flex shrink-0 items-center gap-1.5 rounded-2xl border px-3.5 py-2 text-[12px] font-bold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 ${active
                                                ? "border-orange-400 bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-md shadow-orange-200"
                                                : "border-amber-100 bg-white text-stone-600 hover:border-orange-200 hover:bg-orange-50 hover:text-orange-600"
                                                }`}
                                        >
                                            <Icon size={11} strokeWidth={2.5} />
                                            {label}
                                        </button>
                                    );
                                })}
                            </div>

                            <div className="flex shrink-0 items-center gap-1">
                                {unreadCount > 0 && (
                                    <button
                                        onClick={handleMarkAllRead}
                                        disabled={markingAll}
                                        aria-label="Mark all notifications as read"
                                        className="flex min-h-[36px] items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[11.5px] font-bold text-orange-600 transition-colors hover:bg-orange-50 disabled:opacity-50 sm:px-3"
                                    >
                                        <CheckCheck size={13} />
                                        <span className="hidden sm:inline">Mark all read</span>
                                    </button>
                                )}
                                <button
                                    onClick={handleClearAllClick}
                                    disabled={clearing}
                                    aria-label="Clear all notifications"
                                    className="flex min-h-[36px] items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[11.5px] font-bold text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-600 disabled:opacity-50 sm:px-3"
                                >
                                    <Trash2 size={13} />
                                    <span className="hidden sm:inline">Clear all</span>
                                </button>
                            </div>
                        </div>

                        <div className="pb-3">
                            <div className="relative">
                                <Search size={14} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" />
                                <input
                                    type="text"
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    placeholder="Search notifications…"
                                    aria-label="Search notifications"
                                    className="min-h-[44px] w-full rounded-2xl border border-amber-200 bg-white py-2.5 pl-10 pr-10 text-sm text-stone-700 shadow-sm placeholder:text-stone-400 transition-all focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-100"
                                />
                                {search && (
                                    <button
                                        onClick={() => setSearch("")}
                                        aria-label="Clear search"
                                        className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-700"
                                    >
                                        <X size={13} />
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Body ─────────────────────────────────────────────────────── */}
            {items.length === 0 ? (
                <EmptyInboxState />
            ) : visibleItems.length === 0 ? (
                <div className="flex flex-col items-center px-6 py-20 text-center">
                    <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-50">
                        <Search size={22} className="text-orange-400" />
                    </div>
                    <h2 className="text-[16px] font-black text-stone-800">No matches found</h2>
                    <p className="mt-1.5 max-w-[260px] text-[13px] leading-relaxed text-stone-500">
                        Try a different search term or filter.
                    </p>
                    <button
                        onClick={() => { setSearch(""); setActiveFilter("all"); }}
                        className="mt-4 min-h-[40px] rounded-full border border-orange-200 bg-orange-50 px-4 text-[12.5px] font-bold text-orange-600 hover:bg-orange-100"
                    >
                        Reset filters
                    </button>
                </div>
            ) : (
                <div className="mx-auto max-w-4xl space-y-6 px-4 py-6 pb-24 md:pb-10">
                    <AnimatePresence initial={false}>
                        {groups.map((group) => (
                            <motion.section key={group.label} layout>
                                <h2 className="mb-3 px-0.5 text-[11px] font-black uppercase tracking-[0.16em] text-stone-400">
                                    {group.label}
                                </h2>
                                <div className="space-y-3">
                                    {group.items.map((item) => (
                                        <NotificationCard
                                            key={item.id}
                                            item={item}
                                            group={group.label}
                                            onClick={() => handleNavigate(item, item.url)}
                                            onCtaClick={(url) => handleNavigate(item, url)}
                                            onDelete={handleDeleteRequest}
                                        />
                                    ))}
                                </div>
                            </motion.section>
                        ))}
                    </AnimatePresence>

                    {!isFiltering && hasMore && (
                        <div ref={sentinelRef} className="flex flex-col gap-3 py-2">
                            {loadingMore && (
                                <>
                                    <NotificationSkeleton />
                                    <NotificationSkeleton />
                                </>
                            )}
                        </div>
                    )}

                    {!isFiltering && !hasMore && visibleItems.length > 0 && (
                        <p className="flex items-center justify-center gap-1.5 py-6 text-[11px] font-medium text-stone-400">
                            <Bell size={11} />
                            You&apos;re all caught up
                        </p>
                    )}
                </div>
            )}

            {/* ── Premium confirm modals (replace window.confirm()) ─────────── */}
            <ConfirmModal
                open={clearConfirmOpen}
                title="Clear all notifications?"
                description="This will permanently remove every notification from your inbox. This cannot be undone."
                confirmLabel="Clear all"
                cancelLabel="Cancel"
                loading={clearing}
                destructive
                onConfirm={performClearAll}
                onCancel={() => { if (!clearing) setClearConfirmOpen(false); }}
            />

            <ConfirmModal
                open={!!deleteConfirmId}
                title="Delete notification?"
                description={
                    deleteTarget
                        ? `"${deleteTarget.title}" will be permanently removed. This cannot be undone.`
                        : "This notification will be permanently removed. This cannot be undone."
                }
                confirmLabel="Delete"
                cancelLabel="Cancel"
                loading={deleteConfirmId ? deletingIds.has(deleteConfirmId) : false}
                destructive
                onConfirm={confirmDelete}
                onCancel={() => setDeleteConfirmId(null)}
            />

            {/* ── Undo delete toast ────────────────────────────────────────── */}
            <AnimatePresence>
                {undoState && (
                    <motion.div
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 16 }}
                        transition={{ duration: 0.2 }}
                        role="status"
                        className="fixed inset-x-0 bottom-5 z-[90] mx-auto flex w-[min(92vw,360px)] items-center justify-between gap-3 rounded-2xl border border-stone-200 bg-stone-900 px-4 py-3 text-white shadow-xl"
                        style={{ marginBottom: "env(safe-area-inset-bottom, 0px)" }}
                    >
                        <span className="text-[13px] font-semibold">Notification deleted</span>
                        <button
                            onClick={handleUndo}
                            className="flex min-h-[36px] shrink-0 items-center gap-1 rounded-full bg-white/10 px-3 py-1.5 text-[12.5px] font-black text-orange-300 hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300"
                        >
                            <Undo2 size={13} />
                            Undo
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>

            <style jsx global>{`
                .scrollbar-none { -ms-overflow-style: none; scrollbar-width: none; }
                .scrollbar-none::-webkit-scrollbar { display: none; }
            `}</style>
        </main>
    );
}