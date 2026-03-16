"use client";

export const dynamic = "force-dynamic";

// src/app/(main)/cart/page.tsx

import { useState, useEffect, useRef } from "react";
import Navbar from "@/components/shared/Navbar";
import Footer from "@/components/shared/Footer";
import { useCartStore } from "@/store/cartStore";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
    Minus, Plus, Trash2, ShoppingBag, ArrowRight, Tag,
    MessageCircle, ChevronRight, ShieldCheck, Flame,
    Zap, Star, Package, AlertCircle, Gift,
} from "lucide-react";
import {
    MIN_ORDER_AMOUNT,
    FREE_DELIVERY_AT,
    FLAT_DELIVERY_FEE,
    PLATFORM_FEE,
    calculateDeliveryFee,
    calculateGrandTotal,
} from "@/lib/delivery";

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

function EmptyCart() {
    return (
        <div className="flex flex-col items-center rounded-3xl border border-amber-100 bg-white px-6 py-16 text-center shadow-sm md:py-24">
            <div className="relative mb-6 flex h-24 w-24 items-center justify-center rounded-3xl bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 shadow-inner">
                <ShoppingBag size={40} className="text-amber-400" strokeWidth={1.5} />
                <span className="absolute -right-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-orange-500 to-amber-400 text-xs text-white shadow-md">
                    0
                </span>
            </div>
            <h2 className="text-2xl font-black text-stone-900">Your cart is empty</h2>
            <p className="mt-2 max-w-xs text-sm leading-relaxed text-stone-500">
                Looks like you haven't added anything yet. Something delicious is waiting for you!
            </p>
            <div className="mt-7 flex flex-wrap justify-center gap-2">
                {CRAVING_CHIPS.map(({ emoji, label }) => (
                    <Link
                        key={label}
                        href="/menu"
                        className="flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3.5 py-1.5 text-xs font-bold text-stone-700 transition-all hover:border-orange-300 hover:bg-orange-50 hover:text-orange-600"
                    >
                        <span>{emoji}</span>{label}
                    </Link>
                ))}
            </div>
            <Link
                href="/menu"
                className="group mt-8 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-orange-500 to-amber-500 px-8 py-3.5 text-sm font-black text-white shadow-lg shadow-orange-200 transition-all hover:brightness-110 hover:shadow-orange-300 active:scale-95"
            >
                Explore Menu
                <ArrowRight size={15} className="transition-transform group-hover:translate-x-1" />
            </Link>
            <div className="mt-8 flex flex-wrap justify-center gap-4">
                {[
                    { icon: Flame,       text: "Fresh Daily"     },
                    { icon: Zap,         text: "Fast Delivery"   },
                    { icon: ShieldCheck, text: "Secure Checkout" },
                ].map(({ icon: Icon, text }) => (
                    <div key={text} className="flex items-center gap-1.5 text-[11px] font-bold text-stone-400">
                        <Icon size={12} className="text-amber-500" strokeWidth={2.5} />
                        {text}
                    </div>
                ))}
            </div>
        </div>
    );
}

// ─── Min order + free delivery progress ──────────────────────────────────
function OrderProgressBar({
    total,
    isFirstDeliveryFree,
}: {
    total: number;
    isFirstDeliveryFree: boolean;
}) {
    if (total === 0) return null;

    // First-order free delivery takes priority over the standard progress bar
    if (isFirstDeliveryFree) {
        return (
            <div className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-100">
                    <Gift size={15} className="text-emerald-600" strokeWidth={2.5} />
                </div>
                <div>
                    <p className="text-[12px] font-black text-emerald-800">
                        🎁 First order free delivery applied!
                    </p>
                    <p className="text-[11px] text-emerald-600">
                        Delivery is on us for your very first order.
                    </p>
                </div>
            </div>
        );
    }

    if (total < MIN_ORDER_AMOUNT) {
        const pct = Math.min((total / MIN_ORDER_AMOUNT) * 100, 100);
        return (
            <div className="rounded-2xl border border-orange-200 bg-orange-50 p-4">
                <div className="mb-2 flex items-center gap-2">
                    <AlertCircle size={13} className="shrink-0 text-orange-500" strokeWidth={2.5} />
                    <p className="text-[12px] font-black text-orange-700">
                        Add <span className="text-orange-600">₹{MIN_ORDER_AMOUNT - total}</span> more to reach the minimum order of ₹{MIN_ORDER_AMOUNT}
                    </p>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-orange-200">
                    <div
                        className="h-full rounded-full bg-gradient-to-r from-orange-500 to-amber-400 transition-all duration-500"
                        style={{ width: `${pct}%` }}
                    />
                </div>
            </div>
        );
    }

    if (total >= FREE_DELIVERY_AT) {
        return (
            <div className="flex items-center gap-2 rounded-2xl border border-green-200 bg-green-50 px-4 py-3">
                <span className="text-lg">🎉</span>
                <p className="text-[12px] font-black text-green-700">
                    You've unlocked <span className="text-green-600">FREE delivery!</span>
                </p>
            </div>
        );
    }

    const remaining = FREE_DELIVERY_AT - total;
    const pct = Math.min((total / FREE_DELIVERY_AT) * 100, 100);
    return (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                    <Tag size={12} className="text-amber-600" strokeWidth={2.5} />
                    <p className="text-[11px] font-black text-stone-700">
                        Add <span className="text-orange-600">₹{remaining}</span> more for free delivery!
                    </p>
                </div>
                <p className="text-[10px] font-bold text-stone-400">₹{total} / ₹{FREE_DELIVERY_AT}</p>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-amber-200">
                <div
                    className="h-full rounded-full bg-gradient-to-r from-orange-500 to-amber-400 transition-all duration-500"
                    style={{ width: `${pct}%` }}
                />
            </div>
        </div>
    );
}

// ─── Cart item row ────────────────────────────────────────────────────────
function CartItemRow({
    item, onIncrease, onDecrease, onRemove,
}: {
    item: CartItem;
    onIncrease: () => void;
    onDecrease: () => void;
    onRemove: () => void;
}) {
    const atMax = item.quantity >= item.stock;

    return (
        <article className="group relative flex gap-3.5 rounded-2xl border border-amber-100 bg-white p-3.5 shadow-sm transition-all duration-200 hover:border-orange-200 hover:shadow-md hover:shadow-orange-100/50 md:gap-5 md:p-5">
            <div className="relative h-[88px] w-[88px] shrink-0 overflow-hidden rounded-xl border border-amber-100 bg-amber-50 md:h-28 md:w-28 md:rounded-2xl">
                <img
                    src={item.image} alt={item.name}
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    loading="lazy"
                    onError={(e) => { (e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=200&q=75&auto=format&fit=crop"; }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/10 via-transparent to-transparent" />
            </div>

            <div className="flex min-w-0 flex-1 flex-col justify-between gap-2">
                <div>
                    <span className="mb-1.5 inline-block rounded-full border border-orange-200 bg-orange-50 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wide text-orange-600">
                        {item.category}
                    </span>
                    <h3 className="line-clamp-1 text-[15px] font-black text-stone-900 md:text-lg">{item.name}</h3>
                    <p className="mt-0.5 text-[11px] font-semibold text-stone-400">₹{item.price} per item</p>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center overflow-hidden rounded-full border border-amber-200 bg-amber-50 shadow-sm">
                        <button onClick={onDecrease} aria-label="Decrease quantity" className="flex h-8 w-8 items-center justify-center text-stone-500 transition-all hover:bg-orange-100 hover:text-orange-600 active:scale-90 md:h-9 md:w-9">
                            <Minus size={13} strokeWidth={2.5} />
                        </button>
                        <span className="min-w-8 border-x border-amber-200 px-2 text-center text-sm font-black text-stone-900 md:min-w-10">
                            {item.quantity}
                        </span>
                        <button onClick={onIncrease} aria-label="Increase quantity" disabled={atMax} className="flex h-8 w-8 items-center justify-center text-stone-500 transition-all hover:bg-orange-100 hover:text-orange-600 active:scale-90 disabled:cursor-not-allowed disabled:opacity-40 md:h-9 md:w-9">
                            <Plus size={13} strokeWidth={2.5} />
                        </button>
                    </div>

                    <div className="flex items-center gap-3">
                        <p className="text-lg font-black text-orange-600 md:text-xl">₹{item.price * item.quantity}</p>
                        <button onClick={onRemove} aria-label={`Remove ${item.name}`} className="flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-3 py-1.5 text-[11px] font-bold text-red-500 transition-all hover:border-red-300 hover:bg-red-100 active:scale-95">
                            <Trash2 size={11} strokeWidth={2.5} />
                            <span className="hidden sm:inline">Remove</span>
                        </button>
                    </div>
                </div>

                {atMax && (
                    <p className="text-[10px] font-bold text-amber-600">⚠️ Max quantity reached ({item.stock} in stock)</p>
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
    isFirstDeliveryFree,
}: {
    items: CartItem[];
    subtotal: number;
    onCheckout: () => void;
    loading: boolean;
    belowMin: boolean;
    isFirstDeliveryFree: boolean;
}) {
    const totalQty = items.reduce((s, i) => s + i.quantity, 0);

    // If first order free delivery applies, fee = 0; otherwise use standard calc
    const deliveryFee = isFirstDeliveryFree ? 0 : calculateDeliveryFee(subtotal);
    const grandTotal  = subtotal + deliveryFee + PLATFORM_FEE;

    return (
        <div className="h-fit overflow-hidden rounded-3xl border border-amber-200 bg-white shadow-lg shadow-orange-100/40 md:sticky md:top-24">
            <div className="border-b border-amber-100 bg-gradient-to-r from-amber-50 to-orange-50 px-5 py-4">
                <h2 className="text-lg font-black text-stone-900">Order Summary</h2>
                <p className="text-[11px] font-semibold text-stone-500">{totalQty} {totalQty === 1 ? "item" : "items"} · review before checkout</p>
            </div>

            <div className="p-5">
                <div className="space-y-2.5">
                    {items.map((item) => (
                        <div key={item._id} className="flex items-start justify-between gap-3">
                            <span className="flex-1 text-xs leading-snug text-stone-500">
                                <span className="font-bold text-stone-700">{item.name}</span>
                                <span className="ml-1.5 text-stone-400">×{item.quantity}</span>
                            </span>
                            <span className="shrink-0 text-xs font-black text-stone-700">₹{item.price * item.quantity}</span>
                        </div>
                    ))}
                </div>

                <div className="my-4 h-px bg-amber-100" />

                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <span className="text-sm text-stone-500">Subtotal ({totalQty} items)</span>
                        <span className="text-sm font-bold text-stone-700">₹{subtotal}</span>
                    </div>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                            <span className="text-sm text-stone-500">Delivery</span>
                            {isFirstDeliveryFree ? (
                                <span className="flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[9px] font-black text-emerald-700">
                                    <Gift size={8} strokeWidth={3} /> FREE
                                </span>
                            ) : deliveryFee === 0 ? (
                                <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-black text-green-700">FREE</span>
                            ) : null}
                        </div>
                        <span className={`text-sm font-bold ${deliveryFee === 0 ? "text-emerald-600" : "text-stone-700"}`}>
                            {deliveryFee === 0 ? "₹0" : `₹${deliveryFee}`}
                        </span>
                    </div>
                    <div className="flex items-center justify-between">
                        <span className="text-sm text-stone-500">Platform Fee</span>
                        <span className="text-sm font-bold text-stone-700">₹{PLATFORM_FEE}</span>
                    </div>
                </div>

                <div className="my-4 h-px bg-amber-100" />

                <div className="flex items-center justify-between">
                    <span className="text-base font-black text-stone-900">Total</span>
                    <span className="text-2xl font-black text-orange-600">₹{grandTotal}</span>
                </div>

                {/* First-order free delivery saving callout */}
                {isFirstDeliveryFree && (
                    <div className="mt-2 flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2">
                        <Gift size={12} className="shrink-0 text-emerald-600" strokeWidth={2.5} />
                        <p className="text-[11px] font-bold text-emerald-700">
                            You're saving ₹{FLAT_DELIVERY_FEE} — first order perk! 🎉
                        </p>
                    </div>
                )}

                {/* Standard free-delivery-at callout (only if first-order perk not active) */}
                {!isFirstDeliveryFree && deliveryFee === 0 && subtotal >= FREE_DELIVERY_AT && (
                    <div className="mt-2 flex items-center gap-1.5 rounded-xl bg-green-50 px-3 py-2">
                        <span className="text-sm">🎉</span>
                        <p className="text-[11px] font-bold text-green-700">You're saving ₹{FLAT_DELIVERY_FEE} on delivery!</p>
                    </div>
                )}

                {belowMin && (
                    <div className="mt-3 flex items-start gap-2 rounded-xl border border-orange-200 bg-orange-50 px-3 py-2.5">
                        <AlertCircle size={13} className="mt-0.5 shrink-0 text-orange-500" strokeWidth={2.5} />
                        <p className="text-[11px] font-bold text-orange-700">
                            Minimum order is ₹{MIN_ORDER_AMOUNT} to place delivery. Add ₹{MIN_ORDER_AMOUNT - subtotal} more.
                        </p>
                    </div>
                )}

                <button
                    onClick={onCheckout}
                    disabled={loading || belowMin}
                    className={`group mt-5 flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-[15px] font-black text-white shadow-lg transition-all duration-300 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 ${
                        belowMin
                            ? "bg-stone-300 shadow-stone-200"
                            : "bg-gradient-to-r from-orange-500 to-amber-500 shadow-orange-200 hover:brightness-110 hover:shadow-orange-300"
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
                    ) : (
                        <>
                            Proceed to Checkout
                            <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
                        </>
                    )}
                </button>

                <div className="mt-3.5 flex items-center justify-center gap-2">
                    <MessageCircle size={13} className="text-[#25D366]" strokeWidth={2} />
                    <p className="text-[11px] font-bold text-stone-500">Place Your Order Securely <span className="text-[#25D366]"> Via Razorpay </span></p>
                </div>

                <div className="mt-3 flex items-center justify-center gap-1.5">
                    <ShieldCheck size={11} className="text-amber-500" strokeWidth={2.5} />
                    <p className="text-[10px] font-semibold text-stone-400">Secure · Fresh · Install Web-App</p>
                </div>

                <div className="mt-4 h-px bg-amber-100" />

                <Link
                    href="/menu"
                    className="group mt-4 flex w-full items-center justify-center gap-1.5 rounded-2xl border border-amber-200 bg-amber-50 py-2.5 text-xs font-bold text-amber-700 transition-all hover:border-orange-300 hover:bg-orange-50 hover:text-orange-600"
                >
                    + Add More Items
                    <ChevronRight size={12} className="transition-transform group-hover:translate-x-0.5" />
                </Link>
            </div>
        </div>
    );
}

// ─── Page ─────────────────────────────────────────────────────────────────
export default function CartPage() {
    const router      = useRouter();
    const items       = useCartStore((s) => s.items);
    const removeItem  = useCartStore((s) => s.removeItem);
    const increaseQty = useCartStore((s) => s.increaseQty);
    const decreaseQty = useCartStore((s) => s.decreaseQty);
    const subtotal    = useCartStore((s) => s.getTotalPrice());

    const totalQty = items.reduce((s, i) => s + i.quantity, 0);
    const belowMin = items.length > 0 && subtotal < MIN_ORDER_AMOUNT;

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
            .catch(() => {}); // fail silently — show normal fee
    }, []);

    // Effective delivery fee for display (backend will also recalculate independently)
    const deliveryFee = isFirstDeliveryFree ? 0 : calculateDeliveryFee(subtotal);
    const grandTotal  = subtotal + deliveryFee + PLATFORM_FEE;

    const [checkoutLoading, setCheckoutLoading] = useState(false);

    async function handleCheckout() {
        if (belowMin) return;
        setCheckoutLoading(true);
        try {
            const res = await fetch("/api/auth/me");
            if (!res.ok) { router.push("/auth?redirect=/checkout"); return; }
            router.push("/checkout");
        } catch {
            router.push("/auth?redirect=/checkout");
        } finally {
            setCheckoutLoading(false);
        }
    }

    return (
        <>
            <Navbar />
            <main className="min-h-screen bg-[#FFFBF5]">
                {/* Page header */}
                <div className="relative overflow-hidden border-b border-amber-100 bg-white">
                    <div className="pointer-events-none absolute -top-16 left-1/2 h-40 w-2/3 -translate-x-1/2 rounded-full opacity-40 blur-3xl" style={{ background: "radial-gradient(ellipse, #fed7aa, transparent 70%)" }} aria-hidden="true" />
                    <div className="relative mx-auto max-w-7xl px-4 pb-7 pt-12 md:px-8">
                        <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-orange-200 bg-orange-50 px-4 py-1.5">
                            <span className="flex h-2 w-2 rounded-full bg-orange-500 shadow-[0_0_6px_rgba(249,115,22,0.7)]" />
                            <span className="text-[11px] font-black uppercase tracking-[0.22em] text-orange-600">Review Order</span>
                        </div>
                        <h1 className="text-3xl font-black text-stone-900 md:text-4xl">Your Cart 🛒</h1>
                        {items.length > 0 ? (
                            <p className="mt-1.5 text-sm font-semibold text-stone-500">
                                {totalQty} {totalQty === 1 ? "item" : "items"} · almost there — checkout takes 30 seconds
                            </p>
                        ) : (
                            <p className="mt-1.5 text-sm text-stone-400">Add something delicious to get started</p>
                        )}
                    </div>
                </div>

                <div className="mx-auto max-w-7xl px-4 py-8 md:px-8 md:py-10">
                    {items.length === 0 ? (
                        <EmptyCart />
                    ) : (
                        <div className="grid gap-6 lg:grid-cols-[1fr_380px] xl:grid-cols-[1fr_420px]">
                            {/* Left: items */}
                            <div className="flex flex-col gap-4">
                                <div className="flex items-center justify-between">
                                    <p className="text-[11px] font-black uppercase tracking-[0.2em] text-stone-400">Items ({items.length})</p>
                                    <Link href="/menu" className="text-[12px] font-bold text-orange-500 hover:text-orange-600">+ Add more</Link>
                                </div>

                                <OrderProgressBar total={subtotal} isFirstDeliveryFree={isFirstDeliveryFree} />

                                {items.map((item) => (
                                    <CartItemRow
                                        key={item._id} item={item}
                                        onIncrease={() => increaseQty(item._id)}
                                        onDecrease={() => decreaseQty(item._id)}
                                        onRemove={() => removeItem(item._id)}
                                    />
                                ))}

                                {/* Mobile sticky CTA */}
                                <div className="block lg:hidden">
                                    <div className="rounded-3xl border border-amber-200 bg-white p-5 shadow-md shadow-orange-100/50">
                                        {/* First order free delivery banner — mobile */}
                                        {isFirstDeliveryFree && (
                                            <div className="mb-3 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2">
                                                <Gift size={13} className="shrink-0 text-emerald-600" strokeWidth={2.5} />
                                                <p className="text-[11px] font-bold text-emerald-700">
                                                    🎁 First order free delivery applied!
                                                </p>
                                            </div>
                                        )}
                                        {belowMin && (
                                            <div className="mb-3 flex items-center gap-2 rounded-xl border border-orange-200 bg-orange-50 px-3 py-2">
                                                <AlertCircle size={13} className="shrink-0 text-orange-500" strokeWidth={2.5} />
                                                <p className="text-[11px] font-bold text-orange-700">
                                                    Min. order ₹{MIN_ORDER_AMOUNT} · add ₹{MIN_ORDER_AMOUNT - subtotal} more
                                                </p>
                                            </div>
                                        )}
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <p className="text-[11px] font-bold text-stone-500">
                                                    {totalQty} items · {deliveryFee === 0 ? "Free delivery 🎉" : `+₹${deliveryFee} delivery`}
                                                </p>
                                                <p className="text-2xl font-black text-orange-600">₹{grandTotal}</p>
                                            </div>
                                            <button
                                                onClick={handleCheckout}
                                                disabled={checkoutLoading || belowMin}
                                                className="group flex items-center gap-2 rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 px-6 py-3.5 text-sm font-black text-white shadow-lg shadow-orange-200 transition-all hover:brightness-110 active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
                                            >
                                                {checkoutLoading ? (
                                                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                                                ) : (
                                                    <>Checkout <ArrowRight size={14} /></>
                                                )}
                                            </button>
                                        </div>
                                        <div className="mt-3 flex items-center justify-center gap-2">
                                            <MessageCircle size={12} className="text-[#25D366]" />
                                            <p className="text-[11px] font-semibold text-stone-400">Pure, Fresh & hot</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Trust strip */}
                                <div className="flex flex-wrap items-center justify-center gap-5 rounded-2xl border border-amber-100 bg-white px-5 py-4">
                                    {[
                                        { icon: Flame,   label: "Made Fresh"      },
                                        { icon: Zap,     label: "Fast Delivery"   },
                                        { icon: Package, label: "Hot Guaranteed"  },
                                        { icon: Star,    label: "4.9★ Rated"      },
                                    ].map(({ icon: Icon, label }) => (
                                        <div key={label} className="flex items-center gap-1.5 text-[11px] font-bold text-stone-400">
                                            <Icon size={12} className="text-amber-500" strokeWidth={2.5} />
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
                                    isFirstDeliveryFree={isFirstDeliveryFree}
                                />
                            </div>
                        </div>
                    )}
                </div>
            </main>
            <Footer />
        </>
    );
}