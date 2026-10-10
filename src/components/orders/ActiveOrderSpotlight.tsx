// src/components/orders/ActiveOrderSpotlight.tsx
//
// FoodKnock Phase 5 — Orders 2.0. Prominent "order on the way" callout for
// My Orders, shown only when a real non-terminal order exists (never
// fabricated/empty). Pure presentation over data the page already fetched
// from /api/orders/my — no new fetch, no new status model (reuses the
// same `received|preparing|out_for_delivery` set the rest of the app
// already uses).

import Link from "next/link";
import { ArrowRight, ChefHat, Clock, Truck } from "lucide-react";

type SpotlightOrder = {
    orderId: string;
    status: string;
    createdAt: string;
    totalAmount: number;
};

const SPOTLIGHT_META: Record<string, { label: string; sub: string; icon: React.ElementType }> = {
    received: { label: "Order received", sub: "The kitchen has your order", icon: Clock },
    preparing: { label: "Preparing your order", sub: "Fresh off the kitchen, soon", icon: ChefHat },
    out_for_delivery: { label: "Order on the way", sub: "Your rider is heading over", icon: Truck },
};

export default function ActiveOrderSpotlight({ order }: { order: SpotlightOrder }) {
    const meta = SPOTLIGHT_META[order.status];
    if (!meta) return null;
    const Icon = meta.icon;

    return (
        <Link
            href={`/my-orders/${order.orderId}`}
            className="group relative flex items-center gap-4 overflow-hidden rounded-fk-lg bg-gradient-to-r from-[var(--fk-accent)] to-[var(--fk-gold)] p-5 shadow-fk-md transition-all hover:shadow-fk-lg"
        >
            <div className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full bg-white/10" />
            <span className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-fk-md bg-white/20">
                <Icon size={22} className="text-white" strokeWidth={2} />
            </span>
            <div className="relative min-w-0 flex-1">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/70">Active Order</p>
                <p className="truncate text-base font-black text-white">{meta.label}</p>
                <p className="text-[12px] text-white/80">
                    #{order.orderId.slice(-10)} · {meta.sub}
                </p>
            </div>
            <span className="relative flex shrink-0 items-center gap-1.5 rounded-fk-pill bg-white px-4 py-2 text-[12.5px] font-black text-[var(--fk-accent)] shadow-sm transition-transform group-hover:translate-x-0.5">
                View order
                <ArrowRight size={13} />
            </span>
        </Link>
    );
}
