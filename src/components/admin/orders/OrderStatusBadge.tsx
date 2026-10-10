// src/components/admin/orders/OrderStatusBadge.tsx
// Shared order status config + badge component — FoodKnock

import { Clock, ChefHat, Truck, CheckCircle2, XCircle } from "lucide-react";

export type OrderStatus =
    | "received"
    | "preparing"
    | "out_for_delivery"
    | "delivered"
    | "cancelled";

export const STATUS_CONFIG: Record<
    OrderStatus,
    { label: string; classes: string; icon: React.ReactNode }
> = {
    received: {
        label:   "Received",
        classes: "border-amber-500/25 bg-amber-500/10 text-amber-400",
        icon:    <Clock size={11} />,
    },
    preparing: {
        label:   "Preparing",
        classes: "border-sky-500/25 bg-sky-500/10 text-sky-400",
        icon:    <ChefHat size={11} />,
    },
    out_for_delivery: {
        label:   "Out for Delivery",
        classes: "border-orange-500/25 bg-orange-500/10 text-orange-400",
        icon:    <Truck size={11} />,
    },
    delivered: {
        label:   "Delivered",
        classes: "border-emerald-500/25 bg-emerald-500/10 text-emerald-400",
        icon:    <CheckCircle2 size={11} />,
    },
    cancelled: {
        label:   "Cancelled",
        classes: "border-rose-500/25 bg-rose-500/10 text-rose-400",
        icon:    <XCircle size={11} />,
    },
};

export const ALL_STATUSES = Object.keys(STATUS_CONFIG) as OrderStatus[];

// Forward lifecycle only — drives nextStatus()'s "advance" button. Does NOT
// include "cancelled" (a terminal state reachable from any of these, not a
// step in the forward sequence) — see FILTER_STATUSES below for the list
// used by UI status filters, which DOES include it.
export const STATUS_FLOW: OrderStatus[] = [
    "received",
    "preparing",
    "out_for_delivery",
    "delivered",
];

// Phase 14 — used by admin quick-filter tabs so "Cancelled" is selectable
// alongside the forward-flow statuses, without affecting nextStatus()'s
// advance-button logic above.
export const FILTER_STATUSES: OrderStatus[] = [...STATUS_FLOW, "cancelled"];

export function nextStatus(current: string): OrderStatus | null {
    const idx = STATUS_FLOW.indexOf(current as OrderStatus);
    return idx >= 0 && idx < STATUS_FLOW.length - 1 ? STATUS_FLOW[idx + 1] : null;
}

export function isCancellable(current: string): boolean {
    return current === "received" || current === "preparing" || current === "out_for_delivery";
}

export function OrderStatusBadge({ status }: { status: string }) {
    const cfg = STATUS_CONFIG[status as OrderStatus] ?? {
        label:   status,
        classes: "border-stone-700/50 bg-white/[0.03] text-stone-500",
        icon:    null,
    };
    return (
        <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider ${cfg.classes}`}
        >
            {cfg.icon}
            {cfg.label}
        </span>
    );
}