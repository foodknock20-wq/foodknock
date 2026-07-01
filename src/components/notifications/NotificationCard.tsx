"use client";

// src/components/notifications/NotificationCard.tsx
//
// One row in the Notification Inbox. Visually distinguishes read/unread
// via a left accent bar + warm background tint (the one deliberate
// "signature" touch for this screen — FoodKnock's own warm-orange identity
// rather than a generic blue unread dot) and resolves an icon + color per
// event type so the list is scannable at a glance, the way Swiggy/Zomato's
// order-update feeds are.
//
// `imageUrl` is rendered when present via the existing cdnImage() helper —
// every current NotificationLog row has imageUrl === "" (Rich Notifications
// is a separate, later feature), so this path is inert today and becomes
// live automatically the moment that feature starts populating it. No
// changes to this file will be needed when that happens.
//
// NEW: an individual delete affordance. A small icon-button in the same
// footer row as CTA buttons (not a swipe gesture, which would require new
// touch-gesture plumbing this component doesn't have). `onDelete` is
// optional so this component still renders correctly anywhere it might be
// reused without a delete handler wired up.

import { motion } from "framer-motion";
import { Bell, ShoppingBag, ChefHat, Bike, CheckCircle2, Sparkles, Flame, Trash2 } from "lucide-react";
import { cdnImage } from "@/lib/cdnImage";
import { CATEGORY_DISPLAY, PRIORITY_DISPLAY } from "@/lib/notifications/categoryDisplay";
import type { InboxNotificationItem } from "@/lib/notifications/inboxQuery";
import type { InboxGroupLabel } from "./groupNotifications";

type IconConfig = {
    icon: React.ElementType;
    chipBg: string;
    iconFg: string;
};

const EVENT_ICON_CONFIG: Record<string, IconConfig> = {
    "order.placed": { icon: ShoppingBag, chipBg: "bg-orange-500/10", iconFg: "text-orange-500" },
    "order.preparing": { icon: ChefHat, chipBg: "bg-sky-500/10", iconFg: "text-sky-500" },
    "order.out_for_delivery": { icon: Bike, chipBg: "bg-violet-500/10", iconFg: "text-violet-500" },
    "order.delivered": { icon: CheckCircle2, chipBg: "bg-emerald-500/10", iconFg: "text-emerald-500" },
    "user.welcome": { icon: Sparkles, chipBg: "bg-amber-500/10", iconFg: "text-amber-500" },
};

const DEFAULT_ICON_CONFIG: IconConfig = {
    icon: Bell,
    chipBg: "bg-stone-400/10",
    iconFg: "text-stone-500",
};

function formatItemTime(iso: string, group: InboxGroupLabel): string {
    const date = new Date(iso);
    if (group === "Today" || group === "Yesterday") {
        return date.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true });
    }
    return date.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

type Props = {
    item: InboxNotificationItem;
    group: InboxGroupLabel;
    onClick: () => void;
    /** Called when a specific CTA button is tapped, with that button's own URL — independent of the card's main onClick/url, since e.g. order.delivered has two buttons pointing at two different places. */
    onCtaClick: (url: string) => void;
    /** NEW: called when the delete button is tapped, with this item's id. Optional so other consumers of this component don't break if they don't wire it. */
    onDelete?: (id: string) => void;
};

export default function NotificationCard({ item, group, onClick, onCtaClick, onDelete }: Props) {
    const config = EVENT_ICON_CONFIG[item.event] ?? DEFAULT_ICON_CONFIG;
    const Icon = config.icon;
    const unread = !item.isRead;
    const categoryDisplay = CATEGORY_DISPLAY[item.category as keyof typeof CATEGORY_DISPLAY];
    const priorityDisplay = PRIORITY_DISPLAY[item.priority];

    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className={[
                "group relative overflow-hidden rounded-2xl border transition-all",
                unread
                    ? "border-orange-200 bg-gradient-to-r from-orange-50/80 to-white shadow-[0_2px_14px_rgba(251,146,60,0.12)]"
                    : "border-stone-100 bg-white hover:border-stone-200",
            ].join(" ")}
        >
            {/* Unread signature: warm accent bar on the leading edge */}
            {unread && (
                <span
                    className="absolute inset-y-0 left-0 w-[3px] rounded-r-full"
                    style={{ background: "linear-gradient(180deg, #FF5C1A, #FFB347)" }}
                    aria-hidden="true"
                />
            )}

            <button
                onClick={onClick}
                aria-label={`${item.title}. ${unread ? "Unread" : "Read"}.`}
                className={[
                    "flex w-full items-start gap-3 px-3.5 py-3.5 text-left",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#FFFBF5]",
                ].join(" ")}
            >
                {/* Icon chip */}
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${config.chipBg}`}>
                    <Icon size={18} className={config.iconFg} strokeWidth={2} />
                </div>

                {/* Content */}
                <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                        <p className={`text-[13.5px] leading-snug ${unread ? "font-bold text-stone-900" : "font-semibold text-stone-700"}`}>
                            {item.title}
                        </p>
                        <span className="shrink-0 whitespace-nowrap pt-0.5 text-[11px] text-stone-400">
                            {formatItemTime(item.createdAt, group)}
                        </span>
                    </div>
                    <p className="mt-0.5 line-clamp-2 text-[12.5px] leading-snug text-stone-500">
                        {item.body}
                    </p>

                    {/* Category chip + priority indicator */}
                    {(categoryDisplay || priorityDisplay.show) && (
                        <div className="mt-1.5 flex items-center gap-1.5">
                            {categoryDisplay && (
                                <span className={`rounded-full px-2 py-0.5 text-[9.5px] font-bold ${categoryDisplay.bg} ${categoryDisplay.fg}`}>
                                    {categoryDisplay.label}
                                </span>
                            )}
                            {priorityDisplay.show && (
                                <span className={`flex items-center gap-0.5 text-[9.5px] font-bold ${priorityDisplay.fg}`}>
                                    <Flame size={10} className="fill-current" />
                                    {priorityDisplay.label}
                                </span>
                            )}
                        </div>
                    )}

                    {/* Hero image with optional offer-badge ribbon */}
                    {item.imageUrl && (
                        <div className="relative mt-2 overflow-hidden rounded-lg border border-stone-100">
                            {item.badgeText && (
                                <span
                                    className="absolute left-2 top-2 z-10 rounded-md px-2 py-0.5 text-[10px] font-black text-white shadow-sm"
                                    style={{ background: item.accentColor || "#FF5C1A" }}
                                >
                                    {item.badgeText}
                                </span>
                            )}
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                                src={cdnImage(item.imageUrl, 480)}
                                alt=""
                                className="h-28 w-full object-cover"
                                loading="lazy"
                            />
                        </div>
                    )}
                </div>

                {/* Unread dot (secondary indicator, alongside the accent bar) */}
                {unread && (
                    <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-orange-500" aria-hidden="true" />
                )}
            </button>

            {/* Footer row: CTA buttons (left) + delete button (right) — only
                rendered as a footer bar when there's something to put in it */}
            {(item.ctaButtons.length > 0 || onDelete) && (
                <div className="flex items-center justify-between gap-2 border-t border-stone-100 px-3.5 py-2.5">
                    <div className="flex flex-wrap gap-2">
                        {item.ctaButtons.map((cta) => (
                            <button
                                key={cta.id}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onCtaClick(cta.url || item.url);
                                }}
                                className="rounded-full border border-orange-200 bg-orange-50 px-3 py-1.5 text-[11px] font-bold text-orange-600 transition-colors hover:bg-orange-100"
                            >
                                {cta.label}
                            </button>
                        ))}
                    </div>

                    {onDelete && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onDelete(item.id);
                            }}
                            aria-label="Delete notification"
                            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-stone-300 transition-colors hover:bg-red-50 hover:text-red-500"
                        >
                            <Trash2 size={13} />
                        </button>
                    )}
                </div>
            )}
        </motion.div>
    );
}