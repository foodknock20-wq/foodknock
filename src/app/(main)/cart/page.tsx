"use client";

export const dynamic = "force-dynamic";

// src/app/(main)/cart/page.tsx
//
// FoodKnock Phase 4 — Cart 2.0. Token/primitive restyle only; every
// cartStore action, validation hook, serviceability fetch, and the
// "proceed to checkout" gate (belowMin || blockedCount>0 || unserviceable
// → block, else auth-check → navigate) are byte-for-byte identical to
// before.
//
// Two additive, display-only changes per the approved Phase 4 plan:
//   1. A real "Delivering to" card — `useLocationStore`'s already-read
//      `location.label` was fetched on this page but never shown. It now
//      renders here with a "Change" link that opens the page's own
//      pre-existing `locationSheetOpen` state / `LocationPickerSheet` —
//      no new fetch, no new sheet, just displaying data this page already
//      had.
//   2. The two parallel free-delivery signals the Phase 4 audit flagged
//      (OrderProgressBar's flat `FREE_DELIVERY_AT` guess vs. the
//      location-aware `/api/delivery/serviceability` response) are
//      consolidated: once a location is selected and serviceable, the
//      real server numbers (`freeDelivery`/`remainingForFreeDelivery` —
//      both already present in that endpoint's response, just not
//      previously threaded through) win; the flat threshold bar is now
//      only shown before a location is chosen. Same two real data
//      sources as before, no new computation — a display-precedence
//      choice.
// Also drops one fabricated data point found during restyle: the trust
// strip's static "4.9★ Rated" badge had no real rating backing it
// (unlike Product Detail's truthful rating, which only ever renders when
// `product.rating` is a real number) — removed, consistent with the
// "no fake data" rule already applied everywhere else this project.

import { useState, useEffect, useRef } from "react";
import Footer from "@/components/shared/Footer";
import { useCartStore } from "@/store/cartStore";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
    Minus, Plus, Trash2, ShoppingBag, ArrowRight, Tag,
    MessageCircle, ChevronRight, ShieldCheck, Flame,
    Zap, Package, AlertCircle, Gift, Ban, TrendingUp, TrendingDown,
    MapPin,
} from "lucide-react";
import {
    MIN_ORDER_AMOUNT,
    FREE_DELIVERY_AT,
    FLAT_DELIVERY_FEE,
    PLATFORM_FEE,
} from "@/lib/delivery";
import { useCartValidation, type CartValidationItem } from "@/hooks/useCartValidation";
import { useLocationStore } from "@/store/locationStore";
import { useAuthStore } from "@/store/authStore";
import LocationPickerSheet from "@/components/shared/LocationPickerSheet";
import RecommendationRail from "@/components/products/RecommendationRail";
import { useCartRecommendations } from "@/hooks/useCartRecommendations";
import { useFeaturedPicks } from "@/hooks/useFeaturedPicks";
import { cdnImage } from "@/lib/cdnImage";

// Phase 10B: cart must display the SAME server-authoritative delivery
// calculation checkout uses — never its own copy of the pricing formula.
// Widened (Phase 4) to also capture `remainingForFreeDelivery` /
// `freeDeliveryReason`, which /api/delivery/serviceability already
// returns — this was already-fetched, real data that just wasn't typed
// through before.
type ServiceabilityPreview = {
    serviceable: boolean;
    distanceKm: number | null;
    deliveryFee: number;
    freeDelivery: boolean;
    freeDeliveryReason?: string | null;
    remainingForFreeDelivery?: number | null;
    reason: string | null;
};

type CartItem = {
    _id: string;
    name: string;
    price: number;
    image: string;
    quantity: number;
    stock: number;
    category: string;
};

// ─── Empty state ──────────────────────────────────────────────────────────
const CRAVING_CHIPS = [
    { emoji: "🍔", label: "Burgers" },
    { emoji: "🍕", label: "Pizza" },
    { emoji: "🥤", label: "Shakes" },
    { emoji: "☕", label: "Coffee" },
    { emoji: "🍦", label: "Ice Cream" },
    { emoji: "🥟", label: "Momos" },
];

// ─── Hero icon composition — CSS/lucide only, no new image asset ─────────
// A layered badge cluster instead of one centered icon: the shopping bag
// sits on a warm gradient disc, with three small food-emoji chips
// orbiting it at fixed offsets. Entirely CSS positioning — no SVG import,
// no illustration dependency, respects reduced-motion (nothing here
// animates on its own; the only motion is the existing hover/active-state
// transitions already used everywhere else on this page).
function CartHeroBadge() {
    return (
        <div className="relative mx-auto flex h-36 w-36 shrink-0 items-center justify-center sm:h-40 sm:w-40">
            <div className="absolute inset-0 rounded-full bg-gradient-to-br from-[var(--fk-accent)]/15 via-fk-gold-soft to-transparent" />
            <div className="absolute inset-3 rounded-full border border-fk-border bg-fk-surface-elevated shadow-fk-md" />
            <div className="relative flex h-16 w-16 items-center justify-center rounded-fk-lg bg-gradient-to-br from-[var(--fk-accent)] to-[var(--fk-gold)] shadow-fk-md sm:h-[72px] sm:w-[72px]">
                <ShoppingBag size={30} className="text-white" strokeWidth={1.75} />
            </div>
            {[
                { emoji: "🍔", pos: "-top-1 -left-2", delay: "" },
                { emoji: "🍕", pos: "-right-3 top-3", delay: "" },
                { emoji: "🥤", pos: "-bottom-1 left-1", delay: "" },
            ].map(({ emoji, pos }) => (
                <span
                    key={emoji}
                    className={`absolute ${pos} flex h-9 w-9 items-center justify-center rounded-full border border-fk-border bg-fk-surface-elevated text-base shadow-fk-sm`}
                >
                    {emoji}
                </span>
            ))}
        </div>
    );
}

// ─── Empty cart — a curated discovery landing, not a dead end ────────────
// Two-column composition at lg+ (hero left, real-data discovery right);
// stacks cleanly on mobile with the hero first, discovery immediately
// below — no forced fixed height, no huge unused vertical gaps, every
// section earns its place. The discovery rail reuses the EXISTING
// RecommendationRail component (already used elsewhere on this same page
// for cart-aware recommendations) fed with real featured-product data via
// useFeaturedPicks — never fabricated items, prices, or badges.
function EmptyCart() {
    const { products: featured, loading: featuredLoading } = useFeaturedPicks();

    return (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.1fr_1fr] lg:items-start lg:gap-8">
            {/* ── Left: hero ── */}
            {/* px-4 (not px-6) at the base breakpoint — at 320px viewport
                width, the page's own px-4 (16px) container padding already
                consumes 32px; a 24px-per-side card padding on top of that
                left only ~240px for the hero's own content (badge, headline,
                chips). 16px/side gives this content noticeably more real
                room on the smallest phones without visibly changing the
                design from sm: upward, where the extra space was never
                actually needed. */}
            <div className="flex flex-col items-center rounded-fk-lg border border-fk-border bg-fk-surface-elevated px-4 py-8 text-center shadow-sm sm:px-6 sm:py-10">
                <CartHeroBadge />
                <h2 className="mt-5 text-2xl font-black leading-tight text-fk-text sm:text-[26px]">
                    Something delicious<br className="sm:hidden" /> belongs here.
                </h2>
                <p className="mt-2 max-w-sm text-[13.5px] leading-relaxed text-fk-text-secondary">
                    Your cart is ready and waiting. Browse the menu and add your first item — it only takes a tap.
                </p>

                <Link
                    href="/menu"
                    className="group mt-6 inline-flex w-full items-center justify-center gap-2 rounded-fk-pill bg-gradient-to-r from-[var(--fk-accent)] to-[var(--fk-gold)] px-8 py-3.5 text-sm font-black text-white shadow-fk-md transition-all hover:brightness-110 active:scale-95 sm:w-auto"
                >
                    Explore Menu
                    <ArrowRight size={15} className="transition-transform group-hover:translate-x-1" />
                </Link>

                <div className="mt-5 flex flex-wrap justify-center gap-2">
                    {CRAVING_CHIPS.map(({ emoji, label }) => (
                        <Link
                            key={label}
                            href={`/menu?category=${encodeURIComponent(label)}`}
                            className="flex items-center gap-1.5 rounded-fk-pill border border-fk-border bg-fk-surface-selected px-3.5 py-1.5 text-xs font-bold text-fk-text-secondary transition-all hover:border-[var(--fk-accent)]/40 hover:text-[var(--fk-accent)]"
                        >
                            <span>{emoji}</span>{label}
                        </Link>
                    ))}
                </div>

                <div className="mt-6 flex flex-wrap justify-center gap-4 border-t border-fk-border pt-5">
                    {[
                        { icon: Flame, text: "Fresh Daily" },
                        { icon: Zap, text: "Fast Delivery" },
                        { icon: ShieldCheck, text: "Secure Checkout" },
                    ].map(({ icon: Icon, text }) => (
                        <div key={text} className="flex items-center gap-1.5 text-[11px] font-bold text-fk-text-tertiary">
                            <Icon size={12} className="text-fk-gold" strokeWidth={2.5} />
                            {text}
                        </div>
                    ))}
                </div>
            </div>

            {/* ── Right: real-data discovery ── */}
            <div className="flex flex-col gap-4">
                <div className="rounded-fk-lg border border-fk-border bg-fk-surface-elevated p-4 shadow-sm">
                    <p className="text-[13px] font-black tracking-tight text-fk-text">Find your next favourite</p>
                    <p className="mt-0.5 text-[11.5px] text-fk-text-tertiary">Popular picks from the FoodKnock menu</p>
                </div>
                {(featuredLoading || featured.length > 0) && (
                    <RecommendationRail title="Featured on FoodKnock" products={featured} loading={featuredLoading} />
                )}
                <Link
                    href="/menu"
                    className="flex items-center justify-between gap-3 rounded-fk-lg border border-fk-border bg-fk-surface-elevated px-4 py-3.5 text-left shadow-sm transition-all hover:border-[var(--fk-accent)]/40"
                >
                    {/* min-w-0 is required here: this div is a flex child
                        containing text, so without it the row refuses to
                        shrink below the text's own width on narrow screens,
                        pushing the chevron off the edge instead of
                        truncating gracefully. */}
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

// ─── Delivering-to card ───────────────────────────────────────────────────
// Pure display of `useLocationStore`'s already-fetched `location.label` +
// the page's already-existing location-sheet trigger. No new state, no
// new fetch.
function DeliveringToCard({
    label,
    onChooseLocation,
}: {
    label: string | null;
    onChooseLocation: () => void;
}) {
    return (
        <button
            onClick={onChooseLocation}
            className="flex w-full items-center gap-2.5 rounded-fk-md border border-fk-border bg-fk-surface-elevated px-3.5 py-2.5 text-left shadow-sm transition-all hover:border-[var(--fk-accent)]/30"
        >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-fk-sm bg-fk-gold-soft">
                <MapPin size={16} className="text-[var(--fk-accent)]" strokeWidth={2.5} />
            </div>
            <div className="min-w-0 flex-1">
                <p className="text-[10px] font-black uppercase tracking-wider text-fk-text-tertiary">Delivering to</p>
                <p className="truncate text-[13px] font-bold text-fk-text">
                    {label ?? "Choose your delivery location"}
                </p>
            </div>
            <span className="shrink-0 text-[11px] font-black text-[var(--fk-accent)]">
                {label ? "Change" : "Select"}
            </span>
        </button>
    );
}

// ─── Min order + free delivery progress ──────────────────────────────────
function OrderProgressBar({
    total,
    isFirstDeliveryFree,
    serviceability,
}: {
    total: number;
    isFirstDeliveryFree: boolean;
    serviceability: ServiceabilityPreview | null;
}) {
    if (total === 0) return null;

    // First-order free delivery takes priority over every other signal
    if (isFirstDeliveryFree) {
        return (
            <div className="flex items-center gap-3 rounded-fk-lg border border-fk-success/30 bg-fk-success/10 px-4 py-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-fk-md bg-fk-success/15">
                    <Gift size={15} className="text-fk-success" strokeWidth={2.5} />
                </div>
                <div>
                    <p className="text-[12px] font-black text-fk-success">
                        🎁 First order free delivery applied!
                    </p>
                    <p className="text-[11px] text-fk-success/80">
                        Delivery is on us for your very first order.
                    </p>
                </div>
            </div>
        );
    }

    if (total < MIN_ORDER_AMOUNT) {
        const pct = Math.min((total / MIN_ORDER_AMOUNT) * 100, 100);
        return (
            <div className="rounded-fk-lg border border-fk-border bg-fk-surface-selected p-4">
                <div className="mb-2 flex items-center gap-2">
                    <AlertCircle size={13} className="shrink-0 text-[var(--fk-accent)]" strokeWidth={2.5} />
                    <p className="text-[12px] font-black text-fk-text">
                        Add <span className="text-[var(--fk-accent)]">₹{MIN_ORDER_AMOUNT - total}</span> more to reach the minimum order of ₹{MIN_ORDER_AMOUNT}
                    </p>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-fk-surface-interactive">
                    <div
                        className="h-full rounded-full bg-gradient-to-r from-[var(--fk-accent)] to-[var(--fk-gold)] transition-all duration-500"
                        style={{ width: `${pct}%` }}
                    />
                </div>
            </div>
        );
    }

    // ── Free-delivery messaging: prefer real, location-aware server data
    // once a location has been selected and confirmed serviceable; only
    // fall back to the flat FREE_DELIVERY_AT guess before that.
    if (serviceability?.serviceable) {
        if (serviceability.freeDelivery) {
            return (
                <div className="flex items-center gap-2 rounded-fk-lg border border-fk-success/30 bg-fk-success/10 px-4 py-3">
                    <span className="text-lg">🎉</span>
                    <p className="text-[12px] font-black text-fk-success">
                        You&apos;ve unlocked <span>FREE delivery!</span>
                    </p>
                </div>
            );
        }

        if (typeof serviceability.remainingForFreeDelivery === "number" && serviceability.remainingForFreeDelivery > 0) {
            const threshold = total + serviceability.remainingForFreeDelivery;
            const pct = Math.min((total / threshold) * 100, 100);
            return (
                <div className="rounded-fk-lg border border-fk-border bg-fk-gold-soft p-4">
                    <div className="mb-2 flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                            <Tag size={12} className="text-fk-gold" strokeWidth={2.5} />
                            <p className="text-[11px] font-black text-fk-text">
                                Add <span className="text-[var(--fk-accent)]">₹{serviceability.remainingForFreeDelivery}</span> more for free delivery!
                            </p>
                        </div>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-fk-surface-interactive">
                        <div
                            className="h-full rounded-full bg-gradient-to-r from-[var(--fk-accent)] to-[var(--fk-gold)] transition-all duration-500"
                            style={{ width: `${pct}%` }}
                        />
                    </div>
                </div>
            );
        }

        return null;
    }

    if (total >= FREE_DELIVERY_AT) {
        return (
            <div className="flex items-center gap-2 rounded-fk-lg border border-fk-success/30 bg-fk-success/10 px-4 py-3">
                <span className="text-lg">🎉</span>
                <p className="text-[12px] font-black text-fk-success">
                    You&apos;ve unlocked <span>FREE delivery!</span>
                </p>
            </div>
        );
    }

    const remaining = FREE_DELIVERY_AT - total;
    const pct = Math.min((total / FREE_DELIVERY_AT) * 100, 100);
    return (
        <div className="rounded-fk-lg border border-fk-border bg-fk-gold-soft p-4">
            <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                    <Tag size={12} className="text-fk-gold" strokeWidth={2.5} />
                    <p className="text-[11px] font-black text-fk-text">
                        Add <span className="text-[var(--fk-accent)]">₹{remaining}</span> more for free delivery!
                    </p>
                </div>
                <p className="text-[10px] font-bold text-fk-text-tertiary">₹{total} / ₹{FREE_DELIVERY_AT}</p>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-fk-surface-interactive">
                <div
                    className="h-full rounded-full bg-gradient-to-r from-[var(--fk-accent)] to-[var(--fk-gold)] transition-all duration-500"
                    style={{ width: `${pct}%` }}
                />
            </div>
        </div>
    );
}

// ─── Cart item row ────────────────────────────────────────────────────────
// Cart 2.0 — compact, information-dense row (Blinkit/Swiggy-style cart
// density, not a product-detail card). Image now goes through the same
// cdnImage CDN pipeline every other product surface uses (FloatingCart,
// RecommendationRail, Menu) — this row was the one place still requesting
// the full-resolution original.
function CartItemRow({
    item, validation, onIncrease, onDecrease, onSetQuantity, onRemove,
}: {
    item: CartItem;
    validation?: CartValidationItem;
    onIncrease: () => void;
    onDecrease: () => void;
    onSetQuantity: (qty: number) => void;
    onRemove: () => void;
}) {
    const atMax = item.quantity >= item.stock;
    const status = validation?.status;

    const isUnavailable =
        status === "PRODUCT_UNAVAILABLE" || status === "OUT_OF_STOCK" || status === "INVALID_ITEM";
    const isInsufficientStock = status === "INSUFFICIENT_STOCK";
    const isPriceChanged = status === "PRICE_CHANGED" && typeof validation?.previousPrice === "number";

    return (
        <article
            className={`flex min-w-0 gap-3 rounded-fk-md border p-2.5 transition-colors duration-150 sm:gap-3.5 sm:p-3 ${isUnavailable || isInsufficientStock
                ? "border-fk-danger/30 bg-fk-danger/5"
                : "border-fk-border bg-fk-surface-elevated"
                }`}
        >
            <div className={`relative h-[72px] w-[72px] shrink-0 overflow-hidden rounded-fk-md border border-fk-border bg-fk-surface-interactive sm:h-20 sm:w-20 ${isUnavailable ? "grayscale" : ""}`}>
                <img
                    src={cdnImage(item.image, 160)}
                    alt={item.name}
                    width={160}
                    height={160}
                    className="h-full w-full object-cover"
                    loading="lazy"
                    decoding="async"
                    onError={(e) => { (e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=200&q=75&auto=format&fit=crop"; }}
                />
            </div>

            <div className="flex min-w-0 flex-1 flex-col justify-center gap-1">
                <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                        <h3 className="line-clamp-2 text-[13px] font-black leading-snug text-fk-text sm:text-[14px]">{item.name}</h3>
                        <p className="mt-0.5 truncate text-[10.5px] font-semibold text-fk-text-tertiary">{item.category}</p>
                    </div>
                    {!isUnavailable && (
                        <p className="shrink-0 text-[14px] font-black text-[var(--fk-accent)] sm:text-[15px]">₹{item.price * item.quantity}</p>
                    )}
                </div>

                {isUnavailable ? (
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="flex items-center gap-1 text-[11px] font-bold text-fk-danger">
                            <Ban size={12} strokeWidth={2.5} />
                            {status === "OUT_OF_STOCK" ? "Out of stock" : "No longer available"}
                        </p>
                        <button onClick={onRemove} aria-label={`Remove ${item.name}`} className="flex h-7 min-w-7 items-center justify-center rounded-fk-sm text-fk-danger transition-colors hover:bg-fk-danger/10 active:scale-90">
                            <Trash2 size={14} strokeWidth={2.5} />
                        </button>
                    </div>
                ) : (
                    <>
                        <p className="text-[10.5px] font-semibold text-fk-text-tertiary">₹{item.price} × {item.quantity}</p>

                        <div className="mt-0.5 flex items-center justify-between gap-2">
                            <div className="flex items-center overflow-hidden rounded-fk-pill border border-fk-border bg-fk-surface-selected">
                                <button onClick={onDecrease} aria-label="Decrease quantity" className="flex h-7 w-7 items-center justify-center text-fk-text-secondary transition-colors hover:bg-fk-surface-interactive hover:text-[var(--fk-accent)] active:scale-90">
                                    <Minus size={12} strokeWidth={2.5} />
                                </button>
                                <span className="min-w-6 border-x border-fk-border px-1.5 text-center text-[12px] font-black text-fk-text">
                                    {item.quantity}
                                </span>
                                <button onClick={onIncrease} aria-label="Increase quantity" disabled={atMax} className="flex h-7 w-7 items-center justify-center text-fk-text-secondary transition-colors hover:bg-fk-surface-interactive hover:text-[var(--fk-accent)] active:scale-90 disabled:cursor-not-allowed disabled:opacity-40">
                                    <Plus size={12} strokeWidth={2.5} />
                                </button>
                            </div>

                            <button onClick={onRemove} aria-label={`Remove ${item.name}`} className="flex h-7 min-w-7 items-center justify-center rounded-fk-sm text-fk-text-tertiary transition-colors hover:bg-fk-danger/10 hover:text-fk-danger active:scale-90">
                                <Trash2 size={14} strokeWidth={2.25} />
                            </button>
                        </div>

                        {isInsufficientStock && (
                            <div className="mt-1 flex flex-wrap items-center justify-between gap-2 rounded-fk-sm border border-fk-danger/30 bg-fk-danger/10 px-2 py-1.5">
                                <p className="flex items-center gap-1 text-[10px] font-bold text-fk-danger">
                                    <AlertCircle size={11} strokeWidth={2.5} />
                                    Only {validation?.availableStock} left
                                </p>
                                <button
                                    onClick={() => onSetQuantity(validation?.availableStock ?? 0)}
                                    className="rounded-fk-pill bg-fk-danger px-2.5 py-1 text-[9.5px] font-black text-white transition-all hover:brightness-110 active:scale-95"
                                >
                                    Reduce
                                </button>
                            </div>
                        )}

                        {!isInsufficientStock && atMax && (
                            <p className="mt-0.5 text-[9.5px] font-bold text-fk-gold">⚠️ Max {item.stock} in stock</p>
                        )}

                        {isPriceChanged && (
                            <p className="mt-0.5 flex items-center gap-1 text-[10px] font-bold text-fk-gold">
                                {validation!.previousPrice! < item.price
                                    ? <TrendingUp size={11} strokeWidth={2.5} />
                                    : <TrendingDown size={11} strokeWidth={2.5} />}
                                Price updated to ₹{item.price}
                            </p>
                        )}
                    </>
                )}
            </div>
        </article>
    );
}

// ─── Order summary sidebar ────────────────────────────────────────────────
function OrderSummary({
    items,
    subtotal,
    onCheckout,
    loading,
    belowMin,
    blockedCount,
    isFirstDeliveryFree,
    serviceability,
    checkingServiceability,
    onChooseLocation,
}: {
    items: CartItem[];
    subtotal: number;
    onCheckout: () => void;
    loading: boolean;
    belowMin: boolean;
    blockedCount: number;
    isFirstDeliveryFree: boolean;
    serviceability: ServiceabilityPreview | null;
    checkingServiceability: boolean;
    onChooseLocation: () => void;
}) {
    const checkoutBlocked = belowMin || blockedCount > 0 || (serviceability !== null && !serviceability.serviceable);
    const totalQty = items.reduce((s, i) => s + i.quantity, 0);

    // Phase 10B: server-authoritative — never recomputed from the flat
    // client-side formula. Falls back to the legacy flat estimate ONLY
    // while no location has been chosen yet / serviceability hasn't
    // resolved, matching the "no location selected" state (spec §17), not
    // a guessed final charge.
    const deliveryFee = serviceability?.serviceable
        ? (serviceability.freeDelivery ? 0 : serviceability.deliveryFee)
        : isFirstDeliveryFree ? 0 : null;
    const grandTotal = deliveryFee !== null ? subtotal + deliveryFee + PLATFORM_FEE : null;

    return (
        <div className="h-fit w-full min-w-0 overflow-hidden rounded-fk-lg border border-fk-border bg-fk-surface-elevated shadow-fk-md lg:sticky lg:top-24">
            <div className="border-b border-fk-border bg-fk-surface-selected px-4 py-3">
                <h2 className="text-[15px] font-black text-fk-text">Bill Details</h2>
                <p className="text-[11px] font-semibold text-fk-text-secondary">{totalQty} {totalQty === 1 ? "item" : "items"}</p>
            </div>

            <div className="p-4">
                <div className="space-y-2.5">
                    {items.map((item) => (
                        <div key={item._id} className="flex items-start justify-between gap-3">
                            <span className="flex-1 text-xs leading-snug text-fk-text-secondary">
                                <span className="font-bold text-fk-text">{item.name}</span>
                                <span className="ml-1.5 text-fk-text-tertiary">×{item.quantity}</span>
                            </span>
                            <span className="shrink-0 text-xs font-black text-fk-text">₹{item.price * item.quantity}</span>
                        </div>
                    ))}
                </div>

                <div className="my-4 h-px bg-fk-border" />

                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <span className="text-sm text-fk-text-secondary">Subtotal ({totalQty} items)</span>
                        <span className="text-sm font-bold text-fk-text">₹{subtotal}</span>
                    </div>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                            <span className="text-sm text-fk-text-secondary">Delivery</span>
                            {deliveryFee === 0 && (
                                <span className="flex items-center gap-1 rounded-fk-pill border border-fk-success/30 bg-fk-success/10 px-2 py-0.5 text-[9px] font-black text-fk-success">
                                    <Gift size={8} strokeWidth={3} /> FREE
                                </span>
                            )}
                        </div>
                        {checkingServiceability ? (
                            <span className="text-[12px] font-semibold text-fk-text-tertiary">Checking…</span>
                        ) : serviceability !== null && !serviceability.serviceable ? (
                            <span className="text-[12px] font-bold text-fk-danger">Unavailable</span>
                        ) : deliveryFee === null ? (
                            <button onClick={onChooseLocation} className="text-[12px] font-bold text-[var(--fk-accent)] underline">
                                Set location
                            </button>
                        ) : (
                            <span className={`text-sm font-bold ${deliveryFee === 0 ? "text-fk-success" : "text-fk-text"}`}>
                                {deliveryFee === 0 ? "₹0" : `₹${deliveryFee}`}
                            </span>
                        )}
                    </div>
                    <div className="flex items-center justify-between">
                        <span className="text-sm text-fk-text-secondary">Platform Fee</span>
                        <span className="text-sm font-bold text-fk-text">₹{PLATFORM_FEE}</span>
                    </div>
                </div>

                <div className="my-4 h-px bg-fk-border" />

                <div className="flex items-center justify-between">
                    <span className="text-base font-black text-fk-text">Total</span>
                    <span className="text-2xl font-black text-[var(--fk-accent)]">{grandTotal !== null ? `₹${grandTotal}` : "—"}</span>
                </div>

                {serviceability !== null && !serviceability.serviceable && (
                    <div className="mt-3 flex items-start gap-2 rounded-fk-md border border-fk-danger/30 bg-fk-danger/10 px-3 py-2.5">
                        <AlertCircle size={13} className="mt-0.5 shrink-0 text-fk-danger" strokeWidth={2.5} />
                        <div className="flex-1">
                            <p className="text-[11px] font-bold text-fk-danger">
                                {serviceability.reason === "coordinates_required"
                                    ? "Choose your delivery location to continue."
                                    : "FoodKnock doesn't deliver to this location yet."}
                            </p>
                            <button onClick={onChooseLocation} className="mt-1 text-[11px] font-bold text-fk-danger underline">
                                Change location
                            </button>
                        </div>
                    </div>
                )}

                {/* First-order free delivery saving callout */}
                {isFirstDeliveryFree && (
                    <div className="mt-2 flex items-center gap-1.5 rounded-fk-md border border-fk-success/30 bg-fk-success/10 px-3 py-2">
                        <Gift size={12} className="shrink-0 text-fk-success" strokeWidth={2.5} />
                        <p className="text-[11px] font-bold text-fk-success">
                            You&apos;re saving ₹{FLAT_DELIVERY_FEE} — first order perk! 🎉
                        </p>
                    </div>
                )}

                {/* Standard free-delivery-at callout (only if first-order perk not active) */}
                {!isFirstDeliveryFree && deliveryFee === 0 && subtotal >= FREE_DELIVERY_AT && (
                    <div className="mt-2 flex items-center gap-1.5 rounded-fk-md bg-fk-success/10 px-3 py-2">
                        <span className="text-sm">🎉</span>
                        <p className="text-[11px] font-bold text-fk-success">You&apos;re saving ₹{FLAT_DELIVERY_FEE} on delivery!</p>
                    </div>
                )}

                {belowMin && (
                    <div className="mt-3 flex items-start gap-2 rounded-fk-md border border-fk-border bg-fk-surface-selected px-3 py-2.5">
                        <AlertCircle size={13} className="mt-0.5 shrink-0 text-[var(--fk-accent)]" strokeWidth={2.5} />
                        <p className="text-[11px] font-bold text-fk-text">
                            Minimum order is ₹{MIN_ORDER_AMOUNT} to place delivery. Add ₹{MIN_ORDER_AMOUNT - subtotal} more.
                        </p>
                    </div>
                )}

                {!belowMin && blockedCount > 0 && (
                    <div className="mt-3 flex items-start gap-2 rounded-fk-md border border-fk-danger/30 bg-fk-danger/10 px-3 py-2.5">
                        <AlertCircle size={13} className="mt-0.5 shrink-0 text-fk-danger" strokeWidth={2.5} />
                        <p className="text-[11px] font-bold text-fk-danger">
                            Remove unavailable items to continue.
                        </p>
                    </div>
                )}

                <button
                    onClick={onCheckout}
                    disabled={loading || checkoutBlocked}
                    className={`group mt-5 flex w-full items-center justify-center gap-2 rounded-fk-md py-4 text-[15px] font-black text-white shadow-fk-md transition-all duration-300 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 ${checkoutBlocked
                        ? "bg-fk-text-tertiary"
                        : "bg-gradient-to-r from-[var(--fk-accent)] to-[var(--fk-gold)] hover:brightness-110"
                        }`}
                >
                    {loading ? (
                        <span className="flex items-center gap-2">
                            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                            Checking...
                        </span>
                    ) : belowMin ? (
                        <>
                            <AlertCircle size={16} strokeWidth={2.5} />
                            Min. Order ₹{MIN_ORDER_AMOUNT}
                        </>
                    ) : blockedCount > 0 ? (
                        <>
                            <AlertCircle size={16} strokeWidth={2.5} />
                            Fix Cart to Continue
                        </>
                    ) : (
                        <>
                            Proceed to Checkout
                            <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
                        </>
                    )}
                </button>

                <div className="mt-3.5 flex items-center justify-center gap-2">
                    <MessageCircle size={13} className="text-[#25D366]" strokeWidth={2} />
                    <p className="text-[11px] font-bold text-fk-text-secondary">Place Your Order Securely <span className="text-[#25D366]"> Via Razorpay </span></p>
                </div>

                <div className="mt-3 flex items-center justify-center gap-1.5">
                    <ShieldCheck size={11} className="text-fk-gold" strokeWidth={2.5} />
                    <p className="text-[10px] font-semibold text-fk-text-tertiary">Secure · Fresh · Install Web-App</p>
                </div>

                <div className="mt-4 h-px bg-fk-border" />

                <Link
                    href="/menu"
                    className="group mt-4 flex w-full items-center justify-center gap-1.5 rounded-fk-md border border-fk-border bg-fk-surface-selected py-2.5 text-xs font-bold text-[var(--fk-accent)] transition-all hover:brightness-105"
                >
                    + Add More Items
                    <ChevronRight size={12} className="transition-transform group-hover:translate-x-0.5" />
                </Link>
            </div>
        </div>
    );
}

// ─── Mobile sticky checkout bar ───────────────────────────────────────────
// Cart 2.0 — the ONLY actually-fixed checkout CTA on this page (the prior
// "Mobile sticky CTA" block was a plain in-flow card, not position:sticky/
// fixed — it scrolled away with the rest of the page like everything
// else). Positioned with the exact same `calc(var(--fk-bottom-nav-clearance)
// + var(--fk-safe-bottom))` offset FloatingCart already uses to sit flush
// above BottomNavigation (globals.css's --fk-bottom-nav-clearance — derived
// from BottomNavigation's own real 10px-inset + 66px-height footprint) —
// never overlapping it. FloatingCart itself is already hidden on
// /cart (src/components/shell/CustomerShell.tsx's hideFloatingCart), so
// this is the single floating/fixed control on this page, not a second one.
// belowMin/blockedCount/first-delivery-free detail banners are intentionally
// NOT duplicated here — OrderProgressBar (rendered above, in-flow, on both
// mobile and desktop) already surfaces all of that; this bar only needs
// the number and the action.
function MobileCheckoutBar({
    grandTotal,
    totalQty,
    checkoutLoading,
    belowMin,
    blockedCount,
    serviceability,
    checkingServiceability,
    deliveryFee,
    onCheckout,
}: {
    grandTotal: number | null;
    totalQty: number;
    checkoutLoading: boolean;
    belowMin: boolean;
    blockedCount: number;
    serviceability: ServiceabilityPreview | null;
    checkingServiceability: boolean;
    deliveryFee: number | null;
    onCheckout: () => void;
}) {
    const checkoutBlocked = belowMin || blockedCount > 0 || (serviceability !== null && !serviceability.serviceable);

    const statusText = checkingServiceability
        ? "Checking delivery…"
        : serviceability !== null && !serviceability.serviceable
            ? "Delivery unavailable"
            : deliveryFee === null
                ? `${totalQty} ${totalQty === 1 ? "item" : "items"}`
                : deliveryFee === 0
                    ? "Free delivery 🎉"
                    : `+₹${deliveryFee} delivery`;

    return (
        <div
            className="fixed left-0 right-0 z-40 px-3 lg:hidden"
            style={{ bottom: "calc(var(--fk-bottom-nav-clearance) + var(--fk-safe-bottom) + 8px)" }}
        >
            <div className="flex items-center justify-between gap-3 rounded-fk-lg border border-fk-border bg-fk-surface-elevated px-4 py-3 shadow-fk-lg">
                <div className="min-w-0">
                    <p className="truncate text-[10.5px] font-bold text-fk-text-secondary">{statusText}</p>
                    <p className="text-xl font-black leading-tight text-[var(--fk-accent)]">
                        {grandTotal !== null ? `₹${grandTotal}` : "—"}
                    </p>
                </div>
                <button
                    onClick={onCheckout}
                    disabled={checkoutLoading || checkoutBlocked}
                    aria-label="Proceed to checkout"
                    className={`flex shrink-0 items-center gap-1.5 rounded-fk-pill px-5 py-3.5 text-[13px] font-black text-white shadow-fk-md transition-all active:scale-95 disabled:cursor-not-allowed disabled:opacity-60 ${checkoutBlocked
                        ? "bg-fk-text-tertiary"
                        : "bg-gradient-to-r from-[var(--fk-accent)] to-[var(--fk-gold)] hover:brightness-110"
                        }`}
                >
                    {checkoutLoading ? (
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    ) : belowMin ? (
                        "Min. Order"
                    ) : blockedCount > 0 ? (
                        "Fix Cart"
                    ) : (
                        <>Checkout <ArrowRight size={14} /></>
                    )}
                </button>
            </div>
        </div>
    );
}

// ─── Page ─────────────────────────────────────────────────────────────────
export default function CartPage() {
    const router = useRouter();
    const items = useCartStore((s) => s.items);
    const removeItem = useCartStore((s) => s.removeItem);
    const increaseQty = useCartStore((s) => s.increaseQty);
    const decreaseQty = useCartStore((s) => s.decreaseQty);
    const setQuantity = useCartStore((s) => s.setQuantity);
    const subtotal = useCartStore((s) => s.getTotalPrice());

    // PHASE 4: server-authoritative availability/price check — see
    // src/hooks/useCartValidation.ts. Also keeps item.price/item.stock in
    // the persisted store synced to current DB truth as a side effect.
    const { statusById, checkFailed } = useCartValidation(items);
    const unavailableCount = items.filter((i) => {
        const s = statusById[i._id]?.status;
        return s === "PRODUCT_UNAVAILABLE" || s === "OUT_OF_STOCK" || s === "INVALID_ITEM";
    }).length;
    const insufficientCount = items.filter((i) => statusById[i._id]?.status === "INSUFFICIENT_STOCK").length;
    const blockedCount = unavailableCount + insufficientCount;

    const totalQty = items.reduce((s, i) => s + i.quantity, 0);
    const belowMin = items.length > 0 && subtotal < MIN_ORDER_AMOUNT;

    // Pre-Phase 17 Phase 3 — real, cart-aware recommendations (co-purchase
    // first, category fallback otherwise). See src/lib/recommendations.ts.
    const cartIds = items.map((i) => i._id);
    const { title: recoTitle, products: recoProducts, loading: recoLoading } = useCartRecommendations(cartIds);

    // ── First-order free delivery ─────────────────────────────────────────
    // Fetched once on mount. Defaults to false so the normal fee shows
    // instantly and is replaced with FREE if the user qualifies.
    const [isFirstDeliveryFree, setIsFirstDeliveryFree] = useState(false);
    const eligibilityFetched = useRef(false);

    useEffect(() => {
        if (eligibilityFetched.current) return;
        eligibilityFetched.current = true;
        fetch("/api/delivery/eligibility", { credentials: "include" })
            .then((r) => r.ok ? r.json() : { eligible: false })
            .then((d) => { if (d.eligible) setIsFirstDeliveryFree(true); })
            .catch(() => { }); // fail silently — show normal fee
    }, []);

    // ── Phase 10B: location-aware, server-authoritative delivery pricing ──
    // Cart never recomputes the pricing formula itself — it only displays
    // whatever /api/delivery/serviceability (the same engine checkout and
    // order creation use) returns for the customer's currently selected
    // location (src/store/locationStore.ts — shared across Navbar/
    // checkout/cart, one active location, not three competing states).
    const storedLocation = useLocationStore((s) => s.location);
    const isLoggedIn = useAuthStore((s) => s.isLoggedIn) === true;
    // Auth-gated location flow fix: locationStore has no auth awareness of
    // its own (it just persists to localStorage — see that file's header
    // comment), so a location picked in a previous session could otherwise
    // still be read here and silently feed a real serviceability request
    // before this page's own session had authenticated — the same class of
    // bug fixed at the shared-hook level in
    // useActiveLocationServiceability.ts. This page reads the store
    // directly instead of through that hook (pre-existing Phase 10B
    // design), so the same gate is applied locally: never treat a
    // persisted location as the active one while logged out.
    const selectedLocation = isLoggedIn ? storedLocation : null;
    const [serviceability, setServiceability] = useState<ServiceabilityPreview | null>(null);
    const [checkingServiceability, setCheckingServiceability] = useState(false);
    const [locationSheetOpen, setLocationSheetOpen] = useState(false);

    useEffect(() => {
        if (!selectedLocation) { setServiceability(null); return; }

        setCheckingServiceability(true);
        const controller = new AbortController();
        fetch("/api/delivery/serviceability", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                latitude: selectedLocation.lat,
                longitude: selectedLocation.lng,
                cartSubtotal: subtotal,
            }),
            signal: controller.signal,
        })
            .then((r) => (r.ok ? r.json() : null))
            .then((data) => { if (data?.success) setServiceability(data); })
            .catch((err) => { if (err?.name !== "AbortError") setServiceability(null); })
            .finally(() => setCheckingServiceability(false));

        // Stale-response protection: if the location or subtotal changes
        // again before this resolves, abort it — the latest selection
        // always wins, never an out-of-date response overwriting it.
        return () => controller.abort();
        // Intentionally keyed on lat/lng values, not the selectedLocation
        // object reference — avoids re-firing when an unrelated store
        // update produces a new object with the same coordinates.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedLocation?.lat, selectedLocation?.lng, subtotal]);

    // Same derivation OrderSummary uses — kept in one place conceptually
    // (the formula itself lives server-side; this is just the shared
    // display derivation from whatever the server already returned).
    const deliveryFee = serviceability?.serviceable
        ? (serviceability.freeDelivery ? 0 : serviceability.deliveryFee)
        : isFirstDeliveryFree ? 0 : null;
    const grandTotal = deliveryFee !== null ? subtotal + deliveryFee + PLATFORM_FEE : null;

    const [checkoutLoading, setCheckoutLoading] = useState(false);

    async function handleCheckout() {
        if (belowMin || blockedCount > 0) return;
        if (serviceability !== null && !serviceability.serviceable) return;
        setCheckoutLoading(true);
        try {
            const res = await fetch("/api/auth/me");
            if (!res.ok) { router.push("/auth?mode=login&redirect=/checkout"); return; }
            router.push("/checkout");
        } catch {
            router.push("/auth?mode=login&redirect=/checkout");
        } finally {
            setCheckoutLoading(false);
        }
    }

    return (
        <>
            <main className="min-h-screen bg-fk-bg">
                {/* Compact page header — identity + count, no decorative height */}
                <div className="border-b border-fk-border bg-fk-surface-elevated">
                    <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 md:px-8">
                        <div>
                            <h1 className="text-xl font-black text-fk-text md:text-2xl">Your Cart</h1>
                            {items.length > 0 ? (
                                <p className="mt-0.5 text-[12px] font-semibold text-fk-text-secondary">
                                    {totalQty} {totalQty === 1 ? "item" : "items"} · ₹{subtotal}
                                </p>
                            ) : (
                                <p className="mt-0.5 text-[12px] text-fk-text-tertiary">Add something delicious to get started</p>
                            )}
                        </div>
                        {items.length > 0 && (
                            <span className="shrink-0 rounded-fk-pill border border-fk-border bg-fk-surface-selected px-3 py-1.5 text-[12px] font-black text-[var(--fk-accent)]">
                                🛒 {totalQty}
                            </span>
                        )}
                    </div>
                </div>

                {/* CART + CHECKOUT PREMIUM LAYOUT FIX — this used to be a
                    hardcoded `pb-[152px]`: no --fk-safe-bottom term at all,
                    so a device with a real bottom safe-area inset got the
                    same 152px regardless, even though MobileCheckoutBar
                    (below) shifts its own position up by that same inset —
                    a real, if small, under-reservation on exactly those
                    devices. Now derived from the same shared clearance
                    chain MobileCheckoutBar's own `bottom` offset uses, so
                    this can never silently re-diverge from it again. */}
                <div className={`mx-auto max-w-7xl px-4 py-5 md:px-8 md:py-8 ${items.length > 0 ? "pb-[calc(var(--fk-bottom-nav-clearance)+var(--fk-safe-bottom)+var(--fk-sticky-actionbar-extra-clearance))] lg:pb-8" : ""}`}>
                    {items.length === 0 ? (
                        <EmptyCart />
                    ) : (
                        /* Cart Responsive Repair — ROOT CAUSE of the desktop
                           Order Summary clipping + horizontal page overflow:
                           `1fr` (and mobile's implicit single auto column)
                           resolve to "at least the content's min-content
                           width" by default — a grid track's automatic
                           minimum size is content-based unless the item
                           itself sets overflow other than visible. Any one
                           child that refuses to shrink below its min-content
                           (long unbroken text, a fixed-width element without
                           min-w-0, etc.) therefore forces the WHOLE shared
                           track wider than the viewport — on desktop that
                           pushes the fixed 380/420px summary column past the
                           right edge; on mobile (no lg:grid-cols-*, so every
                           item shares ONE implicit auto column) it widens
                           the entire page. minmax(0, 1fr) floors the track's
                           minimum at 0, letting it shrink to the space
                           actually available and forcing children to
                           wrap/truncate/scroll internally instead. */
                        <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_380px] xl:grid-cols-[minmax(0,1fr)_420px]">
                            {/* Left: items */}
                            <div className="flex min-w-0 flex-col gap-3">
                                <DeliveringToCard
                                    label={selectedLocation?.label ?? null}
                                    onChooseLocation={() => setLocationSheetOpen(true)}
                                />

                                <div className="flex items-center justify-between">
                                    <p className="text-[11px] font-black uppercase tracking-[0.2em] text-fk-text-tertiary">Items ({items.length})</p>
                                    <Link href="/menu" className="text-[12px] font-bold text-[var(--fk-accent)] hover:brightness-110">+ Add more</Link>
                                </div>

                                <OrderProgressBar total={subtotal} isFirstDeliveryFree={isFirstDeliveryFree} serviceability={serviceability} />

                                {blockedCount > 0 && (
                                    <div className="flex items-start gap-2.5 rounded-fk-lg border border-fk-danger/30 bg-fk-danger/10 px-4 py-3">
                                        <AlertCircle size={14} className="mt-0.5 shrink-0 text-fk-danger" strokeWidth={2.5} />
                                        <p className="text-[12px] font-bold text-fk-danger">
                                            {blockedCount === 1 ? "1 item needs your attention" : `${blockedCount} items need your attention`} — remove or adjust them to continue.
                                        </p>
                                    </div>
                                )}
                                {checkFailed && (
                                    <div className="flex items-start gap-2.5 rounded-fk-lg border border-fk-border bg-fk-surface-selected px-4 py-3">
                                        <AlertCircle size={14} className="mt-0.5 shrink-0 text-fk-gold" strokeWidth={2.5} />
                                        <p className="text-[12px] font-bold text-fk-text">
                                            Couldn&apos;t confirm live prices right now — totals shown may be out of date.
                                        </p>
                                    </div>
                                )}

                                {items.map((item) => (
                                    <CartItemRow
                                        key={item._id} item={item}
                                        validation={statusById[item._id]}
                                        onIncrease={() => increaseQty(item._id)}
                                        onDecrease={() => decreaseQty(item._id)}
                                        onSetQuantity={(qty) => setQuantity(item._id, qty)}
                                        onRemove={() => removeItem(item._id)}
                                    />
                                ))}

                                <RecommendationRail title={recoTitle} products={recoProducts} loading={recoLoading} />

                                {/* Trust strip */}
                                <div className="flex flex-wrap items-center justify-center gap-5 rounded-fk-lg border border-fk-border bg-fk-surface-elevated px-4 py-3">
                                    {[
                                        { icon: Flame, label: "Made Fresh" },
                                        { icon: Zap, label: "Fast Delivery" },
                                        { icon: Package, label: "Hot Guaranteed" },
                                    ].map(({ icon: Icon, label }) => (
                                        <div key={label} className="flex items-center gap-1.5 text-[11px] font-bold text-fk-text-tertiary">
                                            <Icon size={12} className="text-fk-gold" strokeWidth={2.5} />
                                            {label}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Right: summary (desktop) */}
                            <div className="hidden lg:block">
                                <OrderSummary
                                    items={items}
                                    subtotal={subtotal}
                                    onCheckout={handleCheckout}
                                    loading={checkoutLoading}
                                    belowMin={belowMin}
                                    blockedCount={blockedCount}
                                    isFirstDeliveryFree={isFirstDeliveryFree}
                                    serviceability={serviceability}
                                    checkingServiceability={checkingServiceability}
                                    onChooseLocation={() => setLocationSheetOpen(true)}
                                />
                            </div>
                        </div>
                    )}
                </div>
            </main>
            {items.length > 0 && (
                <MobileCheckoutBar
                    grandTotal={grandTotal}
                    totalQty={totalQty}
                    checkoutLoading={checkoutLoading}
                    belowMin={belowMin}
                    blockedCount={blockedCount}
                    serviceability={serviceability}
                    checkingServiceability={checkingServiceability}
                    deliveryFee={deliveryFee}
                    onCheckout={handleCheckout}
                />
            )}
            <Footer />
            <LocationPickerSheet
                open={locationSheetOpen}
                onClose={() => setLocationSheetOpen(false)}
                isLoggedIn={isLoggedIn}
            />
        </>
    );
}
