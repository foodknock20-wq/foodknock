"use client";

// src/components/notifications/NotificationCard.tsx
//
// UI REDESIGN — complete visual overhaul, ZERO prop/logic changes:
//   - 24px rounded cards, softer shadows, refined spacing/hierarchy
//   - Elegant per-event icon chips with subtle gradient backgrounds
//   - Beautiful category chip + high-priority flame indicator
//   - Unread: left accent bar + warm tinted background + dot indicator
//   - Read: visibly muted (lower-contrast text, no accent)
//   - Delete: ghost icon button (was already ghost-styled; refined hover)
//   - Perfectly aligned timestamp
// Same onClick/onCtaClick/onDelete contract as before — NotificationInbox
// doesn't need to change how it calls this component at all.

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
    "order.placed": { icon: ShoppingBag, chipBg: "bg-gradient-to-br from-orange-100 to-orange-50", iconFg: "text-orange-500" },
    "order.preparing": { icon: ChefHat, chipBg: "bg-gradient-to-br from-sky-100 to-sky-50", iconFg: "text-sky-500" },
    "order.out_for_delivery": { icon: Bike, chipBg: "bg-gradient-to-br from-violet-100 to-violet-50", iconFg: "text-violet-500" },
    "order.delivered": { icon: CheckCircle2, chipBg: "bg-gradient-to-br from-emerald-100 to-emerald-50", iconFg: "text-emerald-500" },
    "user.welcome": { icon: Sparkles, chipBg: "bg-gradient-to-br from-amber-100 to-amber-50", iconFg: "text-amber-500" },
};

const DEFAULT_ICON_CONFIG: IconConfig = {
    icon: Bell,
    chipBg: "bg-gradient-to-br from-stone-100 to-stone-50",
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
    onCtaClick: (url: string) => void;
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
            initial={{ opacity: 0, y: 10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.18 } }}
            transition={{ duration: 0.28, ease: "easeOut" }}
            className={[
                "group relative overflow-hidden rounded-[24px] border transition-all duration-300",
                unread
                    ? "border-orange-200/80 bg-gradient-to-br from-orange-50/70 via-white to-white shadow-[0_4px_20px_rgba(251,146,60,0.10)]"
                    : "border-stone-100 bg-white opacity-[0.92] shadow-[0_1px_6px_rgba(0,0,0,0.03)] hover:opacity-100",
            ].join(" ")}
        >
            {unread && (
                <span
                    className="absolute inset-y-3 left-0 w-[3px] rounded-r-full"
                    style={{ background: "linear-gradient(180deg, #FF5C1A, #FFB347)" }}
                    aria-hidden="true"
                />
            )}

            <button
                onClick={onClick}
                aria-label={`${item.title}. ${unread ? "Unread" : "Read"}.`}
                className="flex w-full items-start gap-3.5 px-4 py-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#FFFBF5] sm:px-5"
            >
                <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl shadow-sm ${config.chipBg}`}>
                    <Icon size={19} className={config.iconFg} strokeWidth={2} />
                </div>

                <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                        <p className={`text-[14px] leading-snug ${unread ? "font-black text-stone-900" : "font-bold text-stone-600"}`}>
                            {item.title}
                        </p>
                        <span className="shrink-0 whitespace-nowrap pt-0.5 text-[11px] font-medium text-stone-400">
                            {formatItemTime(item.createdAt, group)}
                        </span>
                    </div>
                    <p className={`mt-1 line-clamp-2 text-[13px] leading-relaxed ${unread ? "text-stone-600" : "text-stone-400"}`}>
                        {item.body}
                    </p>

                    {(categoryDisplay || priorityDisplay.show) && (
                        <div className="mt-2.5 flex items-center gap-1.5">
                            {categoryDisplay && (
                                <span className={`rounded-full px-2.5 py-1 text-[10px] font-black tracking-wide ${categoryDisplay.bg} ${categoryDisplay.fg}`}>
                                    {categoryDisplay.label}
                                </span>
                            )}
                            {priorityDisplay.show && (
                                <span className={`flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-1 text-[10px] font-black ${priorityDisplay.fg}`}>
                                    <Flame size={10} className="fill-current" />
                                    {priorityDisplay.label}
                                </span>
                            )}
                        </div>
                    )}

                    {item.imageUrl && (
                        <div className="relative mt-3 overflow-hidden rounded-2xl border border-stone-100">
                            {item.badgeText && (
                                <span
                                    className="absolute left-2.5 top-2.5 z-10 rounded-lg px-2 py-1 text-[10px] font-black text-white shadow-sm"
                                    style={{ background: item.accentColor || "#FF5C1A" }}
                                >
                                    {item.badgeText}
                                </span>
                            )}
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                                src={cdnImage(item.imageUrl, 480)}
                                alt=""
                                className="h-32 w-full object-cover"
                                loading="lazy"
                            />
                        </div>
                    )}
                </div>

                {unread && (
                    <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-orange-500 shadow-[0_0_0_3px_rgba(255,92,26,0.15)]" aria-hidden="true" />
                )}
            </button>

            {(item.ctaButtons.length > 0 || onDelete) && (
                <div className="flex items-center justify-between gap-2 border-t border-stone-100/80 px-4 py-3 sm:px-5">
                    <div className="flex flex-wrap gap-2">
                        {item.ctaButtons.map((cta) => (
                            <button
                                key={cta.id}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onCtaClick(cta.url || item.url);
                                }}
                                className="rounded-full bg-gradient-to-r from-orange-500 to-amber-500 px-3.5 py-1.5 text-[11.5px] font-black text-white shadow-sm shadow-orange-200/70 transition-all hover:brightness-110 active:scale-95"
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
                            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-stone-300 transition-all hover:bg-red-50 hover:text-red-500 active:scale-90"
                        >
                            <Trash2 size={14} />
                        </button>
                    )}
                </div>
            )}
        </motion.div>
    );
}