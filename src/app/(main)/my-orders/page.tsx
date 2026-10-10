"use client";
export const dynamic = "force-dynamic";

// src/app/(main)/my-orders/page.tsx
// Premium authenticated "My Orders" — FoodKnock
//
// FoodKnock Phase 5 — Orders 2.0. Token restyle + two real-data fixes
// found during the audit (both disclosed, both additive):
//   1. The "Rewards Earned" stat used to be a CLIENT-SIDE GUESS
//      (`Math.floor(sum(totalAmount)/10)` over every order in this list,
//      including cancelled ones and orders below the ₹189 points
//      threshold) labeled as if it were the customer's real loyalty
//      balance. It never matched the actual balance (redemptions,
//      referral bonuses, and the MIN_ORDER_FOR_POINTS exclusion all make
//      the two numbers diverge in production). Replaced with the real,
//      authoritative balance from GET /api/loyalty — the same endpoint
//      Checkout/the Loyalty page already use — fetched once alongside
//      the order list.
//   2. "Active" order counting/filtering previously only excluded
//      `delivered`, which meant a `cancelled` order was miscounted as
//      "active" (and could appear under the Active filter). Fixed to
//      exclude both terminal statuses — no new status model, just using
//      the existing one correctly.
// New, additive: an ActiveOrderSpotlight surfaces the single most recent
// non-terminal order prominently, when one exists — pure presentation
// over already-fetched data (src/components/orders/ActiveOrderSpotlight.tsx).

import { useState, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
    Package, ArrowRight, Clock, ChefHat, Truck, PartyPopper,
    Store, ChevronRight, Calendar,
    ReceiptText, UtensilsCrossed, Search, X, ChevronLeft,
    Sparkles, TrendingUp, XCircle,
} from "lucide-react";
import Footer from "@/components/shared/Footer";
import ActiveOrderSpotlight from "@/components/orders/ActiveOrderSpotlight";
import ReorderButton from "@/components/orders/ReorderButton";
import RecommendationRail from "@/components/products/RecommendationRail";
import { useFeaturedPicks } from "@/hooks/useFeaturedPicks";

const ORDERS_PER_PAGE = 6;
const NON_TERMINAL_STATUSES = ["received", "preparing", "out_for_delivery"];

type OrderItem = { name: string; quantity: number; price: number; image?: string; productId?: string | null };
type Order = {
    _id: string; orderId: string; customerName: string; phone: string;
    address: string; landmark?: string; orderType: "delivery" | "pickup";
    items: OrderItem[]; totalAmount: number; status: string;
    note?: string; createdAt: string;
};
type FilterTab = "all" | "active" | "delivered" | "received" | "preparing" | "out_for_delivery";

const STATUS_CONFIG: Record<string, {
    label: string; icon: React.ElementType;
    bg: string; text: string; border: string; dot: string;
    headerBg: string; headerBorder: string;
}> = {
    received: {
        label: "Order Received", icon: Clock,
        bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200", dot: "bg-blue-500",
        headerBg: "bg-blue-50", headerBorder: "border-b border-blue-100",
    },
    preparing: {
        label: "Preparing", icon: ChefHat,
        bg: "bg-fk-gold-soft", text: "text-amber-700", border: "border-amber-200", dot: "bg-amber-500",
        headerBg: "bg-fk-gold-soft", headerBorder: "border-b border-amber-100",
    },
    out_for_delivery: {
        label: "Out for Delivery", icon: Truck,
        bg: "bg-fk-surface-selected", text: "text-[var(--fk-accent)]", border: "border-fk-border", dot: "bg-[var(--fk-accent)]",
        headerBg: "bg-fk-surface-selected", headerBorder: "border-b border-fk-border",
    },
    delivered: {
        label: "Delivered", icon: PartyPopper,
        bg: "bg-fk-success/10", text: "text-fk-success", border: "border-fk-success/25", dot: "bg-fk-success",
        headerBg: "bg-fk-success/10", headerBorder: "border-b border-fk-success/15",
    },
    cancelled: {
        label: "Cancelled", icon: XCircle,
        bg: "bg-fk-danger/10", text: "text-fk-danger", border: "border-fk-danger/25", dot: "bg-fk-danger",
        headerBg: "bg-fk-danger/10", headerBorder: "border-b border-fk-danger/15",
    },
};

const fmtDate = (s: string) => new Date(s).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
const fmtTime = (s: string) => new Date(s).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
const fmtRs = (n: number) => "₹" + n.toLocaleString("en-IN");

function StatusBadge({ status }: { status: string }) {
    const c = STATUS_CONFIG[status] ?? { label: status, icon: Package, bg: "bg-fk-surface-interactive", text: "text-fk-text-secondary", border: "border-fk-border", dot: "bg-fk-text-tertiary" };
    const Icon = c.icon;
    return (
        <span className={`inline-flex items-center gap-1.5 rounded-fk-pill border px-2.5 py-1 text-[11px] font-bold ${c.bg} ${c.text} ${c.border}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${c.dot} ${status === "out_for_delivery" || status === "preparing" ? "animate-pulse motion-reduce:animate-none" : ""}`} />
            <Icon size={11} strokeWidth={2.5} />
            {c.label}
        </span>
    );
}

function SkeletonCard() {
    return (
        <div className="flex flex-col overflow-hidden rounded-fk-lg border border-fk-border bg-fk-surface-elevated shadow-sm animate-pulse motion-reduce:animate-none">
            <div className="h-12 bg-fk-surface-interactive" />
            <div className="flex flex-col gap-3 p-5">
                <div className="flex gap-2">
                    <div className="h-3.5 w-28 rounded-fk-pill bg-fk-surface-interactive" />
                    <div className="h-3.5 w-14 rounded-fk-pill bg-fk-surface-interactive" />
                </div>
                <div className="h-4 w-full rounded-fk-pill bg-fk-surface-interactive" />
                <div className="h-4 w-3/4 rounded-fk-pill bg-fk-surface-interactive" />
                <div className="mt-2 flex items-center justify-between border-t border-fk-border pt-3">
                    <div className="h-5 w-16 rounded-fk-pill bg-fk-surface-interactive" />
                    <div className="h-8 w-28 rounded-fk-pill bg-fk-surface-selected" />
                </div>
            </div>
        </div>
    );
}

function OrderCard({ order, index }: { order: Order; index: number }) {
    const itemCount = order.items.reduce((s, i) => s + i.quantity, 0);
    const previewItems = order.items.slice(0, 2);
    const remaining = order.items.length - 2;
    const cfg = STATUS_CONFIG[order.status];
    const isDelivered = order.status === "delivered";

    // Orders 2.0 — delivered cards get a compact action row (View Order +
    // Reorder) BELOW the main clickable area, not nested inside it (a
    // <button> inside an <a> is invalid HTML and breaks click targeting).
    // Non-delivered orders keep the original single full-card link exactly
    // as before — no restructuring needed where there's nothing to reorder.
    const cardBody = (
        <>
            <div className={`flex items-center justify-between px-5 py-3 ${cfg?.headerBg ?? "bg-fk-surface-interactive"} ${cfg?.headerBorder ?? "border-b border-fk-border"}`}>
                <StatusBadge status={order.status} />
                <span className="font-mono text-[10px] tracking-wider text-fk-text-tertiary">
                    #{order.orderId.slice(-10)}
                </span>
            </div>

            <div className="flex flex-1 flex-col p-5">
                <div className="mb-3.5 flex flex-wrap items-center gap-2">
                    <span className="flex items-center gap-1.5 text-[11px] text-fk-text-tertiary">
                        <Calendar size={10} strokeWidth={2.5} />
                        {fmtDate(order.createdAt)} · {fmtTime(order.createdAt)}
                    </span>
                    <span className={`flex items-center gap-1 rounded-fk-pill border px-2 py-0.5 text-[10px] font-bold ${order.orderType === "delivery"
                        ? "border-fk-border bg-fk-gold-soft text-amber-700"
                        : "border-fk-border bg-fk-surface-interactive text-fk-text-secondary"
                        }`}>
                        {order.orderType === "delivery"
                            ? <><Truck size={8} strokeWidth={2.5} /> Delivery</>
                            : <><Store size={8} strokeWidth={2.5} /> Pickup</>}
                    </span>
                </div>

                <div className="mb-4 space-y-2">
                    {previewItems.map((item, i) => (
                        <div key={i} className="flex items-center gap-2.5">
                            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-fk-sm bg-fk-gold-soft text-[11px] font-black text-amber-700">
                                {item.quantity}
                            </div>
                            <span className="flex-1 truncate text-[13px] font-medium text-fk-text">{item.name}</span>
                            <span className="shrink-0 text-[11px] font-semibold text-fk-text-secondary">
                                {fmtRs(item.price * item.quantity)}
                            </span>
                        </div>
                    ))}
                    {remaining > 0 && (
                        <p className="pl-8 text-[11px] text-fk-text-tertiary">+{remaining} more item{remaining > 1 ? "s" : ""}</p>
                    )}
                </div>

                <div className="mt-auto flex items-center justify-between border-t border-fk-border pt-3.5">
                    <div>
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-fk-text-tertiary">
                            {itemCount} item{itemCount !== 1 ? "s" : ""}
                        </p>
                        <p className="text-[17px] font-black leading-tight text-[var(--fk-accent)]">
                            {fmtRs(order.totalAmount)}
                        </p>
                    </div>
                    {!isDelivered && (
                        <div className="flex items-center gap-1.5 rounded-fk-pill bg-gradient-to-r from-[var(--fk-accent)] to-[var(--fk-gold)] px-4 py-2.5 text-[11px] font-black text-white shadow-fk-sm transition-all duration-200 group-hover:brightness-110">
                            View Details
                            <ChevronRight size={12} strokeWidth={3} className="transition-transform duration-200 group-hover:translate-x-0.5" />
                        </div>
                    )}
                </div>
            </div>
        </>
    );

    if (!isDelivered) {
        return (
            <Link
                href={`/my-orders/${order.orderId}`}
                className="group flex flex-col overflow-hidden rounded-fk-lg border border-fk-border bg-fk-surface-elevated shadow-sm transition-all duration-300 hover:border-[var(--fk-accent)]/30 hover:shadow-fk-lg hover:-translate-y-1"
                style={{ animationDelay: `${index * 60}ms` }}
            >
                {cardBody}
            </Link>
        );
    }

    return (
        <div
            className="group flex flex-col overflow-hidden rounded-fk-lg border border-fk-border bg-fk-surface-elevated shadow-sm transition-all duration-300 hover:border-[var(--fk-accent)]/30 hover:shadow-fk-lg"
            style={{ animationDelay: `${index * 60}ms` }}
        >
            <Link href={`/my-orders/${order.orderId}`} className="flex flex-1 flex-col">
                {cardBody}
            </Link>
            <div className="flex items-center justify-between gap-2 border-t border-fk-border bg-fk-surface-selected px-5 py-3">
                <Link
                    href={`/my-orders/${order.orderId}`}
                    className="flex items-center gap-1 text-[12px] font-black text-fk-text-secondary transition-colors hover:text-fk-text"
                >
                    View Order <ChevronRight size={12} strokeWidth={3} />
                </Link>
                <ReorderButton
                    items={order.items.map((i) => ({ productId: i.productId ?? null, name: i.name, quantity: i.quantity, price: i.price }))}
                    status={order.status}
                />
            </div>
        </div>
    );
}

// ─── "All, zero orders ever" hero — order-journey/receipt motif, deliberately
// distinct from Cart's shopping-bag badge (different icon set, different
// layout shape, different copy) so the two empty states don't read as the
// same component with swapped text. Illustrative only — explicitly never
// implies an order already exists/is being prepared/is on the way (it's a
// static, non-interactive diagram of what WILL happen after the first order).
function FirstOrderHero() {
    // Mobile-responsiveness fix: labels shortened to one short word each
    // (was "Order placed"/"Prepared fresh"/"On its way"/"Delivered" —
    // "Prepared fresh" alone is wider than the ~56–60px a 4-column strip
    // actually has to work with below ~380px viewport width). A flex child
    // with text content and no `min-width:0` refuses to shrink below that
    // text's own content width (the actual root cause, not just a font-size
    // issue) — `min-w-0` on each step below is what actually fixes the
    // overflow; shorter labels just make the result look intentional
    // rather than merely "not broken."
    const steps = [
        { icon: ReceiptText, label: "Placed" },
        { icon: ChefHat, label: "Cooking" },
        { icon: Truck, label: "On the way" },
        { icon: PartyPopper, label: "Delivered" },
    ];
    return (
        <div className="mx-auto flex w-full max-w-xs flex-col items-center">
            <div className="relative flex h-24 w-24 items-center justify-center rounded-fk-lg border border-fk-border bg-gradient-to-br from-fk-gold-soft to-fk-surface-elevated shadow-fk-md sm:h-28 sm:w-28">
                <ReceiptText size={40} className="text-[var(--fk-accent)]" strokeWidth={1.5} />
            </div>
            {/* Illustrative-only journey strip — a static diagram, not a live
                tracker. Dotted connector + four fixed steps, same visual
                language the real order-detail timeline uses elsewhere in
                this app, but unmistakably inert here (no active/highlighted
                step, no animation, no dates).

                `min-w-0` on each step is the actual fix: without it, a flex
                child containing text defaults to `min-width: auto` (its
                content's own width), so four steps with real text labels
                would force this row — and therefore its parent hero card —
                wider than the viewport on narrow phones, instead of
                shrinking to fit. `min-w-0` lets each step shrink below its
                label's natural width and wrap/truncate instead. */}
            <div className="mt-5 flex w-full items-start justify-between gap-1">
                {steps.map(({ icon: Icon, label }, i) => (
                    <div key={label} className="flex min-w-0 flex-1 flex-col items-center gap-1.5 text-center">
                        <div className="flex w-full items-center">
                            {i > 0 && <span className="h-px min-w-[6px] flex-1 border-t border-dashed border-fk-border" aria-hidden="true" />}
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-fk-border bg-fk-surface-elevated">
                                <Icon size={13} className="text-fk-text-tertiary" strokeWidth={2} />
                            </div>
                            {i < steps.length - 1 && <span className="h-px min-w-[6px] flex-1 border-t border-dashed border-fk-border" aria-hidden="true" />}
                        </div>
                        <p className="w-full truncate text-[9.5px] font-bold leading-tight text-fk-text-tertiary">{label}</p>
                    </div>
                ))}
            </div>
        </div>
    );
}

function OrdersEmptyState({ filter, onClear }: { filter: FilterTab; onClear: () => void }) {
    const { products: featured, loading: featuredLoading } = useFeaturedPicks();

    const MAP: Record<Exclude<FilterTab, "all">, { emoji: string; title: string; sub: string }> = {
        active: { emoji: "⏳", title: "No active orders", sub: "All quiet for now. Fancy something fresh from the kitchen?" },
        delivered: { emoji: "✅", title: "No delivered orders yet", sub: "Completed orders land here once delivered." },
        received: { emoji: "📬", title: "No orders received", sub: "Orders confirmed by the kitchen appear here." },
        preparing: { emoji: "👨‍🍳", title: "Nothing being prepared", sub: "Orders being cooked will show up here in real-time." },
        out_for_delivery: { emoji: "🛵", title: "Nothing out for delivery", sub: "Orders on their way to you will appear here." },
    };

    // The genuine "never ordered" state — a full, composed discovery
    // experience, distinct from the filtered-to-zero states below.
    if (filter === "all") {
        return (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.1fr_1fr] lg:items-start lg:gap-8">
                {/* px-4 (not px-6) at the base breakpoint — same reasoning
                    as the Cart empty-state's matching hero card: the
                    page's own container padding plus a 24px/side card
                    padding left too little room for FirstOrderHero's
                    4-column journey strip on the smallest phones. */}
                <div className="flex flex-col items-center rounded-fk-lg border border-fk-border bg-fk-surface-elevated px-4 py-8 text-center shadow-sm sm:px-6 sm:py-10">
                    <FirstOrderHero />
                    <h2 className="mt-6 text-2xl font-black leading-tight text-fk-text sm:text-[26px]">
                        Your first delicious<br className="sm:hidden" /> order starts here.
                    </h2>
                    <p className="mt-2 max-w-sm text-[13.5px] leading-relaxed text-fk-text-secondary">
                        Once you place an order, you&apos;ll be able to track it live, reorder your favourites, and see your complete history right here.
                    </p>
                    <Link
                        href="/menu"
                        className="group mt-6 inline-flex w-full items-center justify-center gap-2 rounded-fk-pill bg-gradient-to-r from-[var(--fk-accent)] to-[var(--fk-gold)] px-8 py-3.5 text-sm font-black text-white shadow-fk-md transition-all hover:brightness-110 active:scale-95 sm:w-auto"
                    >
                        <UtensilsCrossed size={15} strokeWidth={2.5} /> Order Now
                        <ArrowRight size={15} className="transition-transform group-hover:translate-x-1" />
                    </Link>
                </div>

                <div className="flex flex-col gap-4">
                    <div className="rounded-fk-lg border border-fk-border bg-fk-surface-elevated p-4 shadow-sm">
                        <p className="text-[13px] font-black tracking-tight text-fk-text">What should you order first?</p>
                        <p className="mt-0.5 text-[11.5px] text-fk-text-tertiary">Popular picks from the FoodKnock menu</p>
                    </div>
                    {(featuredLoading || featured.length > 0) && (
                        <RecommendationRail title="Featured on FoodKnock" products={featured} loading={featuredLoading} />
                    )}
                    <Link
                        href="/menu"
                        className="flex items-center justify-between gap-3 rounded-fk-lg border border-fk-border bg-fk-surface-elevated px-4 py-3.5 text-left shadow-sm transition-all hover:border-[var(--fk-accent)]/40"
                    >
                        {/* min-w-0 is required here: this div is a flex
                            child containing text, so without it the row
                            refuses to shrink below the text's own width on
                            narrow screens, pushing the chevron off the
                            edge instead of truncating gracefully. */}
                        <div className="min-w-0">
                            <p className="truncate text-[13px] font-bold text-fk-text">Browse the full menu</p>
                            <p className="truncate text-[11px] text-fk-text-tertiary">Burgers, pizza, momos, shakes &amp; more</p>
                        </div>
                        <ChevronRight size={16} className="shrink-0 text-[var(--fk-accent)]" />
                    </Link>
                </div>
            </div>
        );
    }

    // Filtered-tab-to-zero states (e.g. "Active" with none in flight) —
    // intentionally lighter-weight than the "all" case above: the customer
    // already has order history, just not in this particular filter, so a
    // compact, functional empty state is the correct amount of ceremony
    // here, not a second full discovery landing.
    const { emoji, title, sub } = MAP[filter];
    return (
        <div className="flex flex-col items-center rounded-fk-lg border border-fk-border bg-fk-surface-elevated px-8 py-20 text-center shadow-sm">
            <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-fk-lg bg-fk-gold-soft text-4xl shadow-inner">{emoji}</div>
            <h3 className="font-display text-xl font-black text-fk-text">{title}</h3>
            <p className="mt-2 max-w-xs text-sm leading-relaxed text-fk-text-secondary">{sub}</p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
                <button
                    onClick={onClear}
                    className="flex items-center gap-2 rounded-fk-pill border border-fk-border bg-fk-surface-elevated px-5 py-2.5 text-sm font-bold text-fk-text-secondary shadow-sm transition-all hover:bg-fk-surface-interactive"
                >
                    <X size={13} /> Show All Orders
                </button>
                <Link
                    href="/menu"
                    className="flex items-center gap-2 rounded-fk-pill bg-gradient-to-r from-[var(--fk-accent)] to-[var(--fk-gold)] px-5 py-2.5 text-sm font-black text-white shadow-fk-md transition-all hover:brightness-110 active:scale-95"
                >
                    <UtensilsCrossed size={13} strokeWidth={2.5} /> Browse Menu
                </Link>
            </div>
        </div>
    );
}

function Pagination({ current, total, onChange }: { current: number; total: number; onChange: (p: number) => void }) {
    if (total <= 1) return null;
    const getVisible = (): (number | "…")[] => {
        if (total <= 5) return Array.from({ length: total }, (_, i) => i + 1);
        if (current <= 3) return [1, 2, 3, 4, 5, "…", total];
        if (current >= total - 2) return [1, "…", total - 4, total - 3, total - 2, total - 1, total];
        return [1, "…", current - 1, current, current + 1, "…", total];
    };
    return (
        <div className="mt-10 flex flex-wrap items-center justify-center gap-1.5">
            <button
                onClick={() => onChange(current - 1)}
                disabled={current === 1}
                className="flex h-10 w-10 items-center justify-center rounded-fk-md border border-fk-border bg-fk-surface-elevated text-fk-text-secondary shadow-sm transition-all hover:border-[var(--fk-accent)]/30 hover:bg-fk-surface-selected disabled:cursor-not-allowed disabled:opacity-30"
            >
                <ChevronLeft size={16} strokeWidth={2.5} />
            </button>
            {getVisible().map((p, i) =>
                p === "…" ? (
                    <span key={`e${i}`} className="flex h-10 w-10 items-center justify-center text-sm text-fk-text-tertiary">···</span>
                ) : (
                    <button
                        key={p}
                        onClick={() => onChange(p as number)}
                        className={`flex h-10 w-10 items-center justify-center rounded-fk-md text-sm font-bold transition-all ${current === p
                            ? "scale-105 bg-gradient-to-br from-[var(--fk-accent)] to-[var(--fk-gold)] text-white shadow-fk-md"
                            : "border border-fk-border bg-fk-surface-elevated text-fk-text-secondary shadow-sm hover:border-[var(--fk-accent)]/30 hover:bg-fk-surface-selected"
                            }`}
                    >
                        {p}
                    </button>
                )
            )}
            <button
                onClick={() => onChange(current + 1)}
                disabled={current === total}
                className="flex h-10 w-10 items-center justify-center rounded-fk-md border border-fk-border bg-fk-surface-elevated text-fk-text-secondary shadow-sm transition-all hover:border-[var(--fk-accent)]/30 hover:bg-fk-surface-selected disabled:cursor-not-allowed disabled:opacity-30"
            >
                <ChevronRight size={16} strokeWidth={2.5} />
            </button>
            <span className="ml-1.5 text-xs text-fk-text-tertiary">Page {current} of {total}</span>
        </div>
    );
}

type TabDef = { key: FilterTab; label: string; icon: React.ElementType };
const TABS: TabDef[] = [
    { key: "all", label: "All", icon: Package },
    { key: "active", label: "Active", icon: Sparkles },
    { key: "received", label: "Received", icon: Clock },
    { key: "preparing", label: "Preparing", icon: ChefHat },
    { key: "out_for_delivery", label: "On the Way", icon: Truck },
    { key: "delivered", label: "Delivered", icon: PartyPopper },
];

export default function MyOrdersPage() {
    const router = useRouter();
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [filter, setFilter] = useState<FilterTab>("all");
    const [search, setSearch] = useState("");
    const [page, setPage] = useState(1);
    const gridRef = useRef<HTMLDivElement>(null);

    // Real loyalty balance — same /api/loyalty source Checkout/the Loyalty
    // page use. Replaces a previous client-side guess derived from this
    // page's own order totals (see file header).
    const [loyaltyBalance, setLoyaltyBalance] = useState<number | null>(null);

    useEffect(() => {
        async function load() {
            try {
                const meRes = await fetch("/api/auth/me", { credentials: "include" });
                if (!meRes.ok) { router.replace("/auth?mode=login&redirect=/my-orders"); return; }
                const meData = await meRes.json();
                if (!meData.success) { router.replace("/auth?mode=login&redirect=/my-orders"); return; }
                const ordRes = await fetch("/api/orders/my", { credentials: "include" });
                const ordData = await ordRes.json();
                if (!ordRes.ok || !ordData.success) { setError("Failed to load your orders. Please try again."); return; }
                setOrders(ordData.orders ?? []);
            } catch {
                setError("Something went wrong. Please refresh the page.");
            } finally {
                setLoading(false);
            }
        }
        load();

        fetch("/api/loyalty", { credentials: "include" })
            .then((r) => (r.ok ? r.json() : null))
            .then((d) => { if (d?.success) setLoyaltyBalance(Math.max(0, Number(d.balance) || 0)); })
            .catch(() => {}); // fine to omit the chip if this fails — orders themselves still load
    }, [router]);

    // Non-terminal = currently in motion. `cancelled` is terminal, same as
    // `delivered` — previously only `delivered` was excluded here, which
    // miscounted/misfiltered cancelled orders as "active" (fixed).
    const activeOrders = useMemo(
        () => orders.filter((o) => NON_TERMINAL_STATUSES.includes(o.status)),
        [orders]
    );

    // Most recent non-terminal order — orders are already sorted
    // newest-first by the API. Null when nothing is currently in motion.
    const spotlightOrder = activeOrders[0] ?? null;

    const mostOrdered = useMemo(() => {
        const freq: Record<string, number> = {};
        orders.forEach((o) => o.items.forEach((i) => { freq[i.name] = (freq[i.name] ?? 0) + i.quantity; }));
        return Object.entries(freq).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
    }, [orders]);

    const tabCounts = useMemo<Record<FilterTab, number>>(() => ({
        all: orders.length,
        active: activeOrders.length,
        received: orders.filter((o) => o.status === "received").length,
        preparing: orders.filter((o) => o.status === "preparing").length,
        out_for_delivery: orders.filter((o) => o.status === "out_for_delivery").length,
        delivered: orders.filter((o) => o.status === "delivered").length,
    }), [orders, activeOrders]);

    const filteredOrders = useMemo(() => {
        let base = orders;
        if (filter === "active") base = base.filter((o) => NON_TERMINAL_STATUSES.includes(o.status));
        else if (filter !== "all") base = base.filter((o) => o.status === filter);
        if (search.trim()) {
            const q = search.trim().toLowerCase().replace(/^#/, "");
            base = base.filter((o) =>
                o.orderId.toLowerCase().includes(q) ||
                o.items.some((i) => i.name.toLowerCase().includes(q)) ||
                o.customerName.toLowerCase().includes(q)
            );
        }
        return base;
    }, [orders, filter, search]);

    const totalPages = Math.ceil(filteredOrders.length / ORDERS_PER_PAGE);
    const pagedOrders = filteredOrders.slice((page - 1) * ORDERS_PER_PAGE, page * ORDERS_PER_PAGE);

    const handleFilter = (f: FilterTab) => { setFilter(f); setSearch(""); setPage(1); };
    const handleSearch = (v: string) => { setSearch(v); setPage(1); };
    const handlePage = (p: number) => {
        setPage(p);
        setTimeout(() => gridRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 60);
    };

    return (
        <>
            <main className="min-h-screen bg-fk-bg">

                {/* ── Hero ── */}
                <section className="relative overflow-hidden border-b border-fk-border">
                    <div className="absolute inset-0 bg-gradient-to-br from-fk-gold-soft/70 via-fk-bg to-fk-surface-selected/60" />
                    <div
                        className="pointer-events-none absolute inset-0 opacity-[0.022]"
                        style={{ backgroundImage: "radial-gradient(circle, #92400e 1px, transparent 1px)", backgroundSize: "28px 28px" }}
                    />
                    <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full opacity-25 blur-3xl" style={{ background: "radial-gradient(ellipse, var(--fk-accent), transparent 70%)" }} />
                    <div className="pointer-events-none absolute -left-16 bottom-0 h-48 w-48 rounded-full opacity-15 blur-3xl" style={{ background: "radial-gradient(ellipse, var(--fk-gold), transparent 70%)" }} />

                    <div className="relative mx-auto max-w-7xl px-4 pb-8 pt-10 md:px-8 md:pb-10 md:pt-14">
                        <div className="mb-4 flex items-center gap-3.5">
                            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-fk-lg bg-gradient-to-br from-[var(--fk-gold)] to-[var(--fk-accent)] shadow-fk-md">
                                <Package size={22} className="text-white" strokeWidth={2} />
                            </div>
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-[0.28em] text-[var(--fk-accent)]">FoodKnock</p>
                                <h1 className="font-display text-2xl font-black leading-tight text-fk-text md:text-3xl">My Orders</h1>
                            </div>
                        </div>
                        <p className="mb-6 max-w-md text-sm leading-relaxed text-fk-text-secondary">
                            Every order in one place — track live status, view full details, and reorder your favourites in seconds.
                        </p>

                        {!loading && orders.length > 0 && (
                            <div className="mb-6 flex flex-wrap gap-2.5">
                                <div className="flex items-center gap-2 rounded-fk-lg border border-fk-border bg-fk-surface-elevated px-4 py-2.5 shadow-sm">
                                    <div className="flex h-7 w-7 items-center justify-center rounded-fk-sm bg-fk-gold-soft">
                                        <ReceiptText size={13} className="text-amber-600" />
                                    </div>
                                    <div>
                                        <p className="text-[9px] font-black uppercase tracking-widest leading-none text-fk-text-tertiary">Total</p>
                                        <p className="text-sm font-black text-fk-text">{orders.length} orders</p>
                                    </div>
                                </div>

                                {activeOrders.length > 0 && (
                                    <div className="flex items-center gap-2 rounded-fk-lg border border-[var(--fk-accent)]/25 bg-fk-surface-selected px-4 py-2.5 shadow-sm">
                                        <div className="flex h-7 w-7 items-center justify-center rounded-fk-sm bg-fk-surface-elevated">
                                            <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-[var(--fk-accent)] motion-reduce:animate-none" />
                                        </div>
                                        <div>
                                            <p className="text-[9px] font-black uppercase tracking-widest leading-none text-[var(--fk-accent)]">Active</p>
                                            <p className="text-sm font-black text-[var(--fk-accent)]">{activeOrders.length} live</p>
                                        </div>
                                    </div>
                                )}

                                {/* Real loyalty balance — only shown once fetched; never a guessed number. */}
                                {loyaltyBalance !== null && (
                                    <Link href="/loyalty" className="flex items-center gap-2 rounded-fk-lg border border-fk-success/25 bg-fk-success/10 px-4 py-2.5 shadow-sm transition-all hover:brightness-105">
                                        <div className="flex h-7 w-7 items-center justify-center rounded-fk-sm bg-fk-surface-elevated">
                                            <Sparkles size={13} className="text-fk-success" />
                                        </div>
                                        <div>
                                            <p className="text-[9px] font-black uppercase tracking-widest leading-none text-fk-success">Rewards Balance</p>
                                            <p className="text-sm font-black text-fk-success">
                                                {loyaltyBalance.toLocaleString("en-IN")} pts
                                            </p>
                                        </div>
                                    </Link>
                                )}

                                {mostOrdered && (
                                    <div className="flex items-center gap-2 rounded-fk-lg border border-violet-200 bg-violet-50 px-4 py-2.5 shadow-sm">
                                        <div className="flex h-7 w-7 items-center justify-center rounded-fk-sm bg-violet-100">
                                            <TrendingUp size={13} className="text-violet-600" />
                                        </div>
                                        <div>
                                            <p className="text-[9px] font-black uppercase tracking-widest leading-none text-violet-400">Favourite</p>
                                            <p className="max-w-[120px] truncate text-sm font-black text-violet-700">{mostOrdered}</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Active order — surfaced prominently, real data only */}
                        {!loading && spotlightOrder && (
                            <ActiveOrderSpotlight order={spotlightOrder} />
                        )}
                    </div>
                </section>

                {/* ── Sticky filter + search ──
                    Phase 10B: Navbar 2.0 added a second mobile-only row
                    (the location bar) below the main header row, so this
                    sticky offset needs extra clearance below the lg
                    breakpoint — unchanged at lg: since that row never
                    renders there. */}
                {!loading && !error && orders.length > 0 && (
                    <div className="sticky top-[124px] z-30 border-b border-fk-border bg-fk-bg/95 shadow-sm backdrop-blur-xl lg:top-[68px]">
                        <div className="mx-auto max-w-7xl px-4 md:px-8">
                            <div className="flex items-center gap-1.5 overflow-x-auto py-3 scrollbar-none">
                                {TABS.map(({ key, label, icon: Icon }) => {
                                    const cnt = tabCounts[key];
                                    const isActive = filter === key;
                                    return (
                                        <button
                                            key={key}
                                            onClick={() => handleFilter(key)}
                                            className={`flex shrink-0 items-center gap-1.5 rounded-fk-md border px-3.5 py-2 text-[12px] font-bold transition-all duration-200 ${isActive
                                                ? "border-[var(--fk-accent)]/40 bg-gradient-to-r from-[var(--fk-accent)] to-[var(--fk-gold)] text-white shadow-fk-md"
                                                : "border-fk-border bg-fk-surface-elevated text-fk-text-secondary hover:border-[var(--fk-accent)]/30 hover:bg-fk-surface-selected"
                                                }`}
                                        >
                                            <Icon size={11} strokeWidth={2.5} />
                                            {label}
                                            {cnt > 0 && (
                                                <span className={`rounded-fk-pill px-1.5 py-px text-[10px] font-black leading-none ${isActive ? "bg-white/25 text-white" : "bg-fk-surface-interactive text-fk-text-secondary"}`}>
                                                    {cnt}
                                                </span>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                            <div className="pb-3">
                                <div className="relative">
                                    <Search size={14} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-fk-text-tertiary" />
                                    <input
                                        type="text"
                                        value={search}
                                        onChange={(e) => handleSearch(e.target.value)}
                                        placeholder="Search by dish name, order ID, or your name…"
                                        className="w-full rounded-fk-lg border border-fk-border bg-fk-surface-elevated py-2.5 pl-10 pr-10 text-sm text-fk-text shadow-sm placeholder:text-fk-text-tertiary transition-all focus:border-[var(--fk-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--fk-accent)]/15"
                                    />
                                    {search && (
                                        <button onClick={() => handleSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-fk-text-tertiary transition-colors hover:text-fk-text">
                                            <X size={13} />
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* ── Content ── */}
                <div ref={gridRef} className="mx-auto max-w-7xl px-4 py-8 md:px-8">
                    {loading && (
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                            {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
                        </div>
                    )}
                    {!loading && error && (
                        <div className="flex flex-col items-center rounded-fk-lg border border-fk-danger/25 bg-fk-surface-elevated px-8 py-16 text-center shadow-sm">
                            <div className="mb-4 text-4xl">⚠️</div>
                            <p className="text-base font-black text-fk-text">Something went wrong</p>
                            <p className="mt-1 text-sm text-fk-text-secondary">{error}</p>
                            <button
                                onClick={() => window.location.reload()}
                                className="mt-5 rounded-fk-pill border border-fk-danger/25 bg-fk-surface-elevated px-6 py-2.5 text-sm font-bold text-fk-danger shadow-sm transition-all hover:bg-fk-danger/5"
                            >
                                Retry
                            </button>
                        </div>
                    )}
                    {!loading && !error && filteredOrders.length === 0 && (
                        <OrdersEmptyState filter={filter} onClear={() => handleFilter("all")} />
                    )}
                    {!loading && !error && filteredOrders.length > 0 && (
                        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                            <p className="text-sm text-fk-text-secondary">
                                Showing{" "}
                                <span className="font-black text-fk-text">
                                    {(page - 1) * ORDERS_PER_PAGE + 1}–{Math.min(page * ORDERS_PER_PAGE, filteredOrders.length)}
                                </span>
                                {" "}of{" "}
                                <span className="font-black text-fk-text">{filteredOrders.length}</span>
                                {" "}order{filteredOrders.length !== 1 ? "s" : ""}
                                {search && <span className="text-[var(--fk-accent)]"> for &quot;{search}&quot;</span>}
                            </p>
                            {search && (
                                <button
                                    onClick={() => handleSearch("")}
                                    className="flex items-center gap-1.5 rounded-fk-pill border border-fk-border bg-fk-surface-elevated px-3 py-1.5 text-[11px] font-bold text-fk-text-secondary shadow-sm transition-all hover:bg-fk-surface-interactive"
                                >
                                    <X size={11} /> Clear search
                                </button>
                            )}
                        </div>
                    )}
                    {!loading && !error && pagedOrders.length > 0 && (
                        <>
                            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                                {pagedOrders.map((order, i) => (
                                    <OrderCard key={order._id} order={order} index={i} />
                                ))}
                            </div>
                            <Pagination current={page} total={totalPages} onChange={handlePage} />
                            {totalPages > 1 && (
                                <p className="mt-3 text-center text-xs text-fk-text-tertiary">
                                    {filteredOrders.length} order{filteredOrders.length !== 1 ? "s" : ""} · {ORDERS_PER_PAGE} per page
                                </p>
                            )}
                        </>
                    )}

                    {!loading && !error && orders.length > 0 && (
                        <div className="relative mt-12 overflow-hidden rounded-fk-lg shadow-fk-lg">
                            <div className="bg-gradient-to-r from-[var(--fk-accent)] via-[var(--fk-gold)] to-amber-300 p-6 md:p-8">
                                <div
                                    className="pointer-events-none absolute inset-0 opacity-[0.10]"
                                    style={{ backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.6) 1px, transparent 1px)", backgroundSize: "20px 20px" }}
                                />
                                <div className="relative flex flex-col items-center gap-4 text-center md:flex-row md:justify-between md:text-left">
                                    <div>
                                        <p className="mb-1 text-[10px] font-black uppercase tracking-[0.22em] text-white/70">🍽️ Always Fresh</p>
                                        <h3 className="text-xl font-black text-white">Craving something new?</h3>
                                        <p className="mt-1 text-sm text-white/80">Our full menu is hot, fresh, and ready for your next order.</p>
                                    </div>
                                    <Link
                                        href="/menu"
                                        className="flex shrink-0 items-center gap-2 rounded-fk-pill bg-white px-7 py-3 text-sm font-black text-[var(--fk-accent)] shadow-fk-lg transition-all hover:bg-fk-gold-soft active:scale-95"
                                    >
                                        <UtensilsCrossed size={15} strokeWidth={2.5} />
                                        Order Again
                                        <ArrowRight size={14} />
                                    </Link>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </main>
            <Footer />

            <style jsx global>{`
                .scrollbar-none { -ms-overflow-style: none; scrollbar-width: none; }
                .scrollbar-none::-webkit-scrollbar { display: none; }
            `}</style>
        </>
    );
}
