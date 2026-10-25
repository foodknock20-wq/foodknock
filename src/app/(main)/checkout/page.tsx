"use client";

export const dynamic = "force-dynamic";

// src/app/(main)/checkout/page.tsx
//
// ── CHANGES FROM PREVIOUS VERSION ────────────────────────────────────────────
//
// 1. Added <OrderProcessingOverlay> (full-screen blocking loader).
// 2. Added useOrderProcessing hook:
//      • startProcessing()   — called when user clicks Place/Pay
//      • stopProcessing()    — called on error (allows retry)
//      • finishProcessing()  — called on success: clears cart → redirects
// 3. Cart is NO LONGER cleared eagerly; it clears only inside finishProcessing.
// 4. Back-button is blocked while the overlay is visible (handled by the hook).
// 5. router.push() for success redirect moved inside finishProcessing.
// 6. All other UI, backend calls, and business logic are UNCHANGED.
//
// FoodKnock Phase 4 — Checkout 2.0. Token/primitive restyle ONLY (light
// `--fk-*` palette, no dark theme). Every fetch call, request payload,
// handler function body, and the validate()/handleSubmit()/handleCOD()/
// handleRazorpay() flow are byte-for-byte unchanged from before — this
// pass only touches className strings (hardcoded stone/orange/red/amber
// hex+Tailwind colors → `--fk-*` tokens) plus two narrow, disclosed fixes:
//
//   1. `clientMaxRedeemable()` (this file's own local reimplementation of
//      the max-redeemable-points formula) is replaced with the real
//      `maxRedeemablePoints()` already exported by `src/lib/delivery.ts`.
//      Confirmed safe: both formulas are identical
//      (`Math.min(balance, Math.floor(total*pct/val))`) and the pct/val
//      constants are the same static values on both sides (0.20 / 0.5 —
//      `src/lib/loyaltyService.ts`'s `LOYALTY_CONFIG`, which `/api/loyalty`
//      echoes back, is not independently configurable). The rupee-value
//      conversion (`pts * pointValueInr`) is NOT touched — this file's
//      `.toFixed(0)` (whole-rupee display) differs from `delivery.ts`'s
//      `pointsToRupees()` (`.toFixed(2)`), and changing that would be a
//      real (if tiny) rounding/financial behavior change, not just a
//      duplicate-removal — out of scope for a presentation-only pass.
//   2. Removed one fabricated data point found during restyle: the
//      desktop sidebar's static "A/R/M" avatar row + 5-star rating +
//      "900+ happy orders delivered" had no real data backing it
//      (hardcoded initials, hardcoded count) — dropped, consistent with
//      the "no fake data" rule already applied to Product Detail and Cart
//      this same phase.
//
// No change to: PendingPayment, payment verification, webhook
// reconciliation, atomic payment claim, order creation core, coupon/
// loyalty/serviceability validation, Razorpay integration, or any
// business-logic import list.

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter }    from "next/navigation";
import { toast }        from "react-hot-toast";
import Footer           from "@/components/shared/Footer";
import { useCartStore, type CartItem } from "@/store/cartStore";
import Link             from "next/link";
import {
    ShoppingBag, MapPin, Phone, User, MessageSquare,
    ArrowRight, Loader2, ShieldCheck, Clock, Tag,
    CheckCircle2, ChevronRight, Flame,
    Sparkles, Gift, ChevronDown, ChevronUp, Info,
    Lock, Smartphone, AlertTriangle,
    Banknote, CreditCard, Wifi,
} from "lucide-react";
import {
    MIN_ORDER_AMOUNT, FREE_DELIVERY_AT, PLATFORM_FEE,
    FLAT_DELIVERY_FEE, calculateDeliveryFee, amountToFreeDelivery,
    maxRedeemablePoints,
} from "@/lib/delivery";
import { COD_MAX_ORDER_AMOUNT } from "@/lib/constants";

// ── NEW IMPORTS ───────────────────────────────────────────────────────────────
import OrderProcessingOverlay from "@/components/checkout/OrderProcessingOverlay";
import SavedAddressPicker, { composeAddress } from "@/components/checkout/SavedAddressPicker";
import { useLocationStore } from "@/store/locationStore";
import { useOrderProcessing } from "@/hooks/useOrderProcessing";
import { useCartValidation } from "@/hooks/useCartValidation";
import { formatDistance } from "@/lib/formatDistance";
import MapPinPicker from "@/components/shared/MapPinPicker";
import CouponBox, { type AppliedCoupon } from "@/components/checkout/CouponBox";
import DonationCard from "@/components/checkout/DonationCard";
import RecommendationRail from "@/components/products/RecommendationRail";
import { useCartRecommendations } from "@/hooks/useCartRecommendations";
import { validateIndianMobile, normalizeIndianMobile } from "@/lib/validation/phone";
import { cdnImage } from "@/lib/cdnImage";

declare global {
    interface Window {
        Razorpay: new (opts: Record<string, unknown>) => {
            open: () => void;
            on:   (event: string, cb: (r: unknown) => void) => void;
        };
    }
}

type PaymentMethod = "razorpay" | "cod";

type FormState = {
    customerName: string;
    phone:        string;
    address:      string;
    landmark:     string;
    note:         string;
    // Phase 10B — rider-facing guidance ("call on arrival, gate no.,
    // floor..."), distinct from the kitchen-facing `note` above. Prefilled
    // from a selected saved address's own deliveryInstructions, editable.
    deliveryInstructions: string;
};

type LoyaltyInfo = {
    balance:          number;
    pointValueInr:    number;
    minRedeem:        number;
    maxRedemptionPct: number;
};

function tryPrefill(): Partial<FormState> {
    try {
        const u = JSON.parse(localStorage.getItem("cafeapp_user") ?? "{}");
        return {
            customerName: u.name || u.customerName || "",
            phone:        u.phone || "",
            address:      typeof u.address === "string" ? u.address : u.address?.line1 || "",
            landmark:     u.landmark || u.address?.landmark || "",
        };
    } catch { return {}; }
}

// Checkout-only name rule — the shared validateFullName() (src/lib/
// validation/name.ts) enforces a 7-character minimum for NEW signups and
// voluntary profile edits; that's a deliberately stricter identity-
// verification bar for account creation. Checkout just needs a real
// delivery-contact name, so this page accepts real short names (e.g.
// "Amit", "Zoya") starting at 4 characters. Scoped to this page only —
// signup/profile validation (src/lib/validation/name.ts) is untouched.
const CHECKOUT_NAME_MIN_LENGTH = 4;
function validateCheckoutName(raw: string): { ok: true } | { ok: false; message: string } {
    const value = raw.trim().replace(/\s+/g, " ");
    if (!value) return { ok: false, message: "Please enter your full name." };
    if (value.length < CHECKOUT_NAME_MIN_LENGTH) {
        return { ok: false, message: `Name must be at least ${CHECKOUT_NAME_MIN_LENGTH} characters.` };
    }
    if (!/\p{L}/u.test(value)) return { ok: false, message: "Please enter a valid name." };
    return { ok: true };
}

function loadRazorpay(): Promise<boolean> {
    return new Promise((resolve) => {
        if (typeof window !== "undefined" && window.Razorpay) { resolve(true); return; }
        const s = document.createElement("script");
        s.src     = "https://checkout.razorpay.com/v1/checkout.js";
        s.onload  = () => resolve(true);
        s.onerror = () => resolve(false);
        document.body.appendChild(s);
    });
}

// ── UI atoms ──────────────────────────────────────────────────────────────────
function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
    return (
        <div className={`overflow-hidden rounded-fk-lg border border-fk-border bg-fk-surface-elevated shadow-sm ${className}`}>
            {children}
        </div>
    );
}

function CardHead({ icon, title, sub }: { icon: string; title: string; sub?: string }) {
    return (
        <div className="border-b border-fk-border bg-fk-surface-selected px-4 py-3">
            <div className="flex items-center gap-2.5">
                <span className="text-lg leading-none">{icon}</span>
                <div>
                    <p className="text-[13px] font-black tracking-tight text-fk-text">{title}</p>
                    {sub && <p className="text-[11px] text-fk-text-secondary">{sub}</p>}
                </div>
            </div>
        </div>
    );
}

function FKInput({ value, onChange, placeholder, type = "text", autoComplete, required, icon, disabled, error }: {
    value: string; onChange: (v: string) => void; placeholder: string;
    type?: string; autoComplete?: string; required?: boolean; icon?: React.ReactNode; disabled?: boolean; error?: string;
}) {
    return (
        <div className="relative flex items-center">
            {icon && <span className="pointer-events-none absolute left-3.5 text-fk-text-tertiary">{icon}</span>}
            <input
                type={type} value={value} onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder} autoComplete={autoComplete} required={required}
                disabled={disabled}
                aria-invalid={!!error}
                className={`w-full rounded-fk-md border bg-fk-surface-interactive py-3.5 text-sm font-medium text-fk-text placeholder:text-fk-text-tertiary transition-all focus:bg-fk-surface-elevated focus:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:opacity-60 ${icon ? "pl-10 pr-4" : "px-4"} ${
                    error
                        ? "border-fk-danger focus:border-fk-danger focus:ring-fk-danger/15"
                        : "border-fk-border hover:border-fk-border focus:border-[var(--fk-accent)] focus:ring-[var(--fk-accent)]/15"
                }`}
            />
        </div>
    );
}

function FKTextarea({ value, onChange, placeholder, rows = 3, icon, disabled, error }: {
    value: string; onChange: (v: string) => void; placeholder: string; rows?: number; icon?: React.ReactNode; disabled?: boolean; error?: string;
}) {
    return (
        <div className="relative">
            {icon && <span className="pointer-events-none absolute left-3.5 top-3.5 text-fk-text-tertiary">{icon}</span>}
            <textarea
                value={value} onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder} rows={rows} disabled={disabled}
                aria-invalid={!!error}
                className={`w-full resize-none rounded-fk-md border bg-fk-surface-interactive py-3.5 text-sm font-medium text-fk-text placeholder:text-fk-text-tertiary transition-all focus:bg-fk-surface-elevated focus:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:opacity-60 ${icon ? "pl-10 pr-4" : "px-4"} ${
                    error
                        ? "border-fk-danger focus:border-fk-danger focus:ring-fk-danger/15"
                        : "border-fk-border hover:border-fk-border focus:border-[var(--fk-accent)] focus:ring-[var(--fk-accent)]/15"
                }`}
            />
        </div>
    );
}

function FirstDeliveryFreeBanner() {
    return (
        <div className="flex items-center gap-4 rounded-fk-lg border border-fk-success/30 bg-fk-success/10 px-5 py-4 shadow-sm">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-fk-md border border-fk-success/30 bg-fk-surface-elevated shadow-sm">
                <Gift size={20} className="text-fk-success" strokeWidth={2} />
            </div>
            <div>
                <p className="text-[13px] font-black text-fk-success">🎁 Your first order includes FREE delivery!</p>
                <p className="mt-0.5 text-[11.5px] text-fk-success/80">Delivery fee waived — a welcome gift from FoodKnock.</p>
            </div>
        </div>
    );
}

function ShopClosedBanner({ reason }: { reason?: string | null }) {
    return (
        <div className="flex items-start gap-4 rounded-fk-lg border border-fk-danger/30 bg-fk-danger/10 px-5 py-5 shadow-sm">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-fk-md bg-fk-danger/15">
                <AlertTriangle size={20} className="text-fk-danger" strokeWidth={2} />
            </div>
            <div>
                  <p className="text-[14px] font-black text-fk-danger">
                    Kitchen is Currently Closed
                  </p>
                  <p className="mt-1 text-[12px] leading-relaxed text-fk-danger/80">
                    {reason ? `${reason}. ` : ""}We&apos;re not accepting orders at the moment. Please visit us again during our operating hours.
                </p>
            </div>
        </div>
    );
}

function DeliveryBar({ subtotal, isFirstDeliveryFree }: { subtotal: number; isFirstDeliveryFree: boolean }) {
    if (isFirstDeliveryFree) {
        return (
            <div className="flex items-center gap-3 rounded-fk-lg border border-fk-success/30 bg-fk-success/10 px-4 py-3">
                <Gift size={17} className="shrink-0 text-fk-success" strokeWidth={2.5} />
                <div>
                    <p className="text-[12px] font-black text-fk-success">🎁 First order — delivery is FREE!</p>
                    <p className="text-[11px] text-fk-success/80">Welcome to FoodKnock 🎉</p>
                </div>
            </div>
        );
    }
    if (subtotal >= FREE_DELIVERY_AT) {
        return (
            <div className="flex items-center gap-3 rounded-fk-lg border border-fk-success/30 bg-fk-success/10 px-4 py-3">
                <span className="text-xl">🎉</span>
                <div>
                    <p className="text-[12px] font-black text-fk-success">Free delivery unlocked!</p>
                    <p className="text-[11px] text-fk-success/80">Enjoy complimentary delivery on this order</p>
                </div>
            </div>
        );
    }
    const pct  = Math.min((subtotal / FREE_DELIVERY_AT) * 100, 100);
    const need = amountToFreeDelivery(subtotal);
    return (
        <div className="rounded-fk-lg border border-fk-border bg-fk-gold-soft px-4 py-3">
            <div className="mb-2 flex items-center justify-between">
                <p className="text-[12px] font-black text-fk-text">
                    Add <span className="text-[var(--fk-accent)]">₹{need}</span> for{" "}
                    <span className="text-fk-success">free delivery</span>
                </p>
                <p className="text-[10px] font-bold text-fk-text-tertiary">₹{subtotal} / ₹{FREE_DELIVERY_AT}</p>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-fk-surface-interactive">
                <div className="h-full rounded-full bg-gradient-to-r from-[var(--fk-accent)] to-[var(--fk-gold)] transition-all duration-700" style={{ width: `${pct}%` }} />
            </div>
        </div>
    );
}

// Pre-Phase 17 Phase 3 — BUG FIX: this previously rendered 3 hardcoded
// fake products (fake Unsplash images, fake prices, ids "u1"/"u2"/"u3"
// that don't exist in the real catalog — tapping "Add" would silently put
// an unorderable phantom item in the cart). Replaced with the real,
// cart-aware recommendation engine (src/lib/recommendations.ts) via the
// same RecommendationRail used on the Cart page — one real implementation,
// not a second fake one.
function UpsellStrip({ cartIds }: { cartIds: string[] }) {
    const { title, products, loading } = useCartRecommendations(cartIds);
    return <RecommendationRail title={title} products={products} loading={loading} />;
}

function EmptyCart() {
    return (
        <div className="flex flex-col items-center rounded-fk-lg border border-fk-border bg-fk-surface-elevated px-6 py-24 text-center shadow-sm">
            <div className="relative mb-6 flex h-20 w-20 items-center justify-center rounded-fk-lg border border-fk-border bg-fk-gold-soft">
                <ShoppingBag size={36} className="text-fk-gold" strokeWidth={1.5} />
                <span className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-[var(--fk-accent)] to-[var(--fk-gold)] text-[10px] font-black text-white shadow-md">0</span>
            </div>
            <h2 className="text-2xl font-black text-fk-text">Your cart is empty</h2>
            <p className="mt-2 max-w-xs text-sm leading-relaxed text-fk-text-secondary">Hunger hasn&apos;t knocked yet? Explore our menu and fill up your cart!</p>
            <Link href="/menu" className="group mt-7 inline-flex items-center gap-2 rounded-fk-pill bg-gradient-to-r from-[var(--fk-accent)] to-[var(--fk-gold)] px-8 py-3.5 text-sm font-black text-white shadow-fk-md transition-all hover:brightness-110 active:scale-95">
                Browse Menu <ArrowRight size={15} className="transition-transform group-hover:translate-x-1" />
            </Link>
        </div>
    );
}

function PaymentMethodSelector({
    selected, onChange, codAvailable, grandTotal, disabled, codMax,
}: {
    selected: PaymentMethod; onChange: (m: PaymentMethod) => void;
    codAvailable: boolean; grandTotal: number; disabled: boolean; codMax: number;
}) {
    return (
        <Card>
            <CardHead icon="💳" title="Payment Method" sub="How would you like to pay?" />
            <div className="space-y-2.5 p-4">
                <button
                    type="button" disabled={disabled} onClick={() => onChange("razorpay")}
                    className={`w-full rounded-fk-lg border-2 p-3.5 text-left transition-all ${
                        selected === "razorpay"
                            ? "border-[var(--fk-accent)] bg-fk-surface-selected shadow-sm"
                            : "border-fk-border bg-fk-surface-interactive hover:border-[var(--fk-accent)]/40"
                    } disabled:cursor-not-allowed disabled:opacity-60`}
                >
                    <div className="flex items-center gap-3">
                        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-fk-md transition-colors ${selected === "razorpay" ? "bg-[var(--fk-accent)]" : "bg-fk-surface-interactive"}`}>
                            <Wifi size={16} className={selected === "razorpay" ? "text-white" : "text-fk-text-secondary"} strokeWidth={2.5} />
                        </div>
                        <div className="flex-1">
                            <div className="flex items-center gap-2">
                                <p className="text-[13px] font-black text-fk-text">Online Payment</p>
                                <span className="rounded-fk-pill bg-fk-surface-selected px-2 py-0.5 text-[9px] font-black text-[var(--fk-accent)]">RECOMMENDED</span>
                            </div>
                            <p className="text-[11px] text-fk-text-secondary">UPI · Cards · Net Banking · Wallets via Razorpay</p>
                        </div>
                        <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${selected === "razorpay" ? "border-[var(--fk-accent)] bg-[var(--fk-accent)]" : "border-fk-border bg-fk-surface-elevated"}`}>
                            {selected === "razorpay" && <div className="h-2 w-2 rounded-full bg-white" />}
                        </div>
                    </div>
                </button>

                <button
                    type="button" disabled={disabled || !codAvailable} onClick={() => codAvailable && onChange("cod")}
                    className={`w-full rounded-fk-lg border-2 p-3.5 text-left transition-all ${
                        !codAvailable
                            ? "cursor-not-allowed border-fk-border bg-fk-surface-interactive opacity-60"
                            : selected === "cod"
                                ? "border-fk-success bg-fk-success/10 shadow-sm"
                                : "border-fk-border bg-fk-surface-interactive hover:border-fk-success/40"
                    } disabled:cursor-not-allowed`}
                >
                    <div className="flex items-center gap-3">
                        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-fk-md transition-colors ${selected === "cod" && codAvailable ? "bg-fk-success" : "bg-fk-surface-interactive"}`}>
                            <Banknote size={16} className={selected === "cod" && codAvailable ? "text-white" : "text-fk-text-secondary"} strokeWidth={2.5} />
                        </div>
                        <div className="flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                                <p className="text-[13px] font-black text-fk-text">Cash on Delivery</p>
                                {codAvailable ? (
                                    <span className="rounded-fk-pill bg-fk-success/15 px-2 py-0.5 text-[9px] font-black text-fk-success">⚡ Available</span>
                                ) : (
                                    <span className="rounded-fk-pill bg-fk-surface-interactive px-2 py-0.5 text-[9px] font-black text-fk-text-tertiary">Not available</span>
                                )}
                            </div>
                            {codAvailable ? (
                                <p className="text-[11px] text-fk-text-secondary">Pay cash when your order arrives</p>
                            ) : (
                                <p className="text-[11px] text-fk-gold font-semibold">COD available only for orders below ₹{codMax}</p>
                            )}
                        </div>
                        <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${selected === "cod" && codAvailable ? "border-fk-success bg-fk-success" : "border-fk-border bg-fk-surface-elevated"}`}>
                            {selected === "cod" && codAvailable && <div className="h-2 w-2 rounded-full bg-white" />}
                        </div>
                    </div>
                </button>

                {codAvailable && (
                    <div className="flex items-center gap-2 rounded-fk-md border border-fk-success/20 bg-fk-success/10 px-3 py-2">
                        <Banknote size={12} className="shrink-0 text-fk-success" />
                        <p className="text-[11px] text-fk-success">
                            ⚡ COD available for orders below <strong>₹{codMax}</strong> — pay cash at your door
                        </p>
                    </div>
                )}
            </div>
        </Card>
    );
}

function LoyaltyCard({
    loyalty, grandTotal, pts, onPts, applied, onApply, onRemove, applying,
}: {
    loyalty: LoyaltyInfo; grandTotal: number; pts: number; onPts: (n: number) => void;
    applied: boolean; onApply: () => void; onRemove: () => void; applying: boolean;
}) {
    const [open, setOpen] = useState(false);
    // Phase 4: max-redeemable-points formula now comes from the real,
    // already-exported src/lib/delivery.ts helper instead of this file's
    // own local reimplementation — see file-header comment for why this
    // is safe (identical formula, identical static constants on both
    // sides).
    const max    = maxRedeemablePoints(grandTotal, loyalty.balance);
    const rupees = Number((pts * loyalty.pointValueInr).toFixed(0));
    const canUse = loyalty.balance >= loyalty.minRedeem && max > 0;

    useEffect(() => { if (canUse && !applied) setOpen(true); }, [canUse]);
    if (!loyalty.balance) return null;

    return (
        <Card>
            <button type="button" onClick={() => setOpen((o) => !o)}
                className="flex w-full items-center justify-between gap-3 border-b border-fk-border bg-gradient-to-r from-violet-50 to-purple-50 px-4 py-3.5 text-left transition-colors hover:brightness-[0.98]">
                <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-fk-md bg-gradient-to-br from-violet-500 to-purple-600 shadow-sm">
                        <Sparkles size={15} className="text-white" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <p className="text-[13px] font-black text-fk-text">FoodKnock Rewards</p>
                            {applied && (
                                <span className="inline-flex items-center gap-1 rounded-fk-pill bg-fk-success/15 px-2 py-0.5 text-[10px] font-black text-fk-success">
                                    <CheckCircle2 size={9} strokeWidth={3} /> Applied
                                </span>
                            )}
                        </div>
                        <p className="text-[11px] text-fk-text-secondary">
                            {applied ? `−₹${rupees} saved on this order` : `${loyalty.balance} pts · worth ₹${(loyalty.balance * loyalty.pointValueInr).toFixed(0)}`}
                        </p>
                    </div>
                </div>
                {open ? <ChevronUp size={16} className="shrink-0 text-fk-text-tertiary" /> : <ChevronDown size={16} className="shrink-0 text-fk-text-tertiary" />}
            </button>
            {open && (
                <div className="space-y-3.5 p-4">
                    {applied ? (
                        <div className="flex items-center justify-between rounded-fk-lg border border-fk-success/30 bg-fk-success/10 px-4 py-3">
                            <div className="flex items-center gap-3">
                                <div className="flex h-9 w-9 items-center justify-center rounded-fk-md bg-fk-success/15">
                                    <Gift size={15} className="text-fk-success" />
                                </div>
                                <div>
                                    <p className="text-sm font-black text-fk-success">{pts} pts redeemed</p>
                                    <p className="text-[11px] text-fk-success/80">You save ₹{rupees} on this order 🎉</p>
                                </div>
                            </div>
                            <button type="button" onClick={onRemove}
                                className="rounded-fk-md border border-fk-danger/30 bg-fk-danger/10 px-3 py-1.5 text-[11px] font-black text-fk-danger transition-colors hover:bg-fk-danger/20">
                                Remove
                            </button>
                        </div>
                    ) : canUse ? (
                        <div className="space-y-4">
                            <div>
                                <div className="mb-2 flex items-center justify-between">
                                    <p className="text-[11px] font-black text-fk-text">Points to use</p>
                                    <div className="flex items-center gap-1">
                                        <span className="font-mono text-lg font-black text-violet-600">{pts}</span>
                                        <span className="text-[10px] text-fk-text-tertiary">pts</span>
                                        <span className="mx-1.5 text-fk-border">·</span>
                                        <span className="text-[12px] font-black text-fk-success">−₹{rupees}</span>
                                    </div>
                                </div>
                                <input type="range" min={loyalty.minRedeem} max={max} step={1} value={pts}
                                    onChange={(e) => onPts(Number(e.target.value))}
                                    className="w-full accent-violet-500" />
                                <div className="mt-1 flex justify-between text-[10px] text-fk-text-tertiary">
                                    <span>Min {loyalty.minRedeem} pts</span>
                                    <span>Max {max} pts (20% of order)</span>
                                </div>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {[25, 50, 75, 100].map((pct) => {
                                    const v = Math.round((max * pct) / 100);
                                    if (v < loyalty.minRedeem) return null;
                                    return (
                                        <button key={pct} type="button" onClick={() => onPts(v)}
                                            className={`rounded-fk-pill border px-3 py-1 text-[11px] font-black transition-all ${pts === v ? "border-violet-400 bg-violet-100 text-violet-700" : "border-fk-border bg-fk-surface-interactive text-fk-text-secondary hover:border-violet-300"}`}>
                                            {pct}%
                                        </button>
                                    );
                                })}
                                <button type="button" onClick={() => onPts(max)}
                                    className={`rounded-fk-pill border px-3 py-1 text-[11px] font-black transition-all ${pts === max ? "border-violet-400 bg-violet-100 text-violet-700" : "border-fk-border bg-fk-surface-interactive text-fk-text-secondary hover:border-violet-300"}`}>
                                    Max
                                </button>
                            </div>
                            <button type="button" onClick={onApply} disabled={applying || pts < loyalty.minRedeem}
                                className="flex w-full items-center justify-center gap-2 rounded-fk-lg bg-gradient-to-r from-violet-500 to-purple-600 py-3 text-[13px] font-black text-white shadow-md transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-60">
                                {applying ? <Loader2 size={15} className="animate-spin" /> : <><Sparkles size={14} /> Use {pts} pts · save ₹{rupees}</>}
                            </button>
                            <p className="text-center text-[10px] text-fk-text-tertiary">1 pt = ₹{loyalty.pointValueInr} · max 20% of order value</p>
                        </div>
                    ) : (
                        <div className="flex items-start gap-3 rounded-fk-lg border border-fk-border bg-fk-gold-soft px-4 py-3">
                            <Info size={14} className="mt-0.5 shrink-0 text-fk-gold" />
                            <p className="text-[12px] text-fk-text-secondary">
                                You need <strong>{loyalty.minRedeem} pts</strong> to redeem. You have <strong>{loyalty.balance} pts</strong> — keep ordering to earn more!
                            </p>
                        </div>
                    )}
                </div>
            )}
        </Card>
    );
}

function PayBtn({
    loading, amount, disabled, isCod, form, compact,
}: {
    loading: boolean; amount: number; disabled?: boolean; isCod?: boolean; form?: string; compact?: boolean;
}) {
    // Mobile CTA micro-polish — ONLY the `compact` (sticky-bar) variant gets
    // the richer treatment below (translucent rim border, layered warm
    // shadow, top sheen highlight, tighter premium copy). The non-compact
    // branch (desktop in-flow button) keeps its exact original classes/
    // copy/shadow — nothing shared leaks between the two, by construction
    // (every new class lives inside the `compact ? ... : ...` ternaries).
    return (
        <button type="submit" form={form} disabled={loading || disabled}
            className={`group relative flex items-center justify-center overflow-hidden text-white transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70 ${
                compact
                    ? "h-12 w-full gap-2 rounded-fk-lg px-3.5 text-[14px] font-bold tracking-[0.01em] whitespace-nowrap border border-white/15 hover:brightness-[1.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2"
                    : "w-full gap-2.5 rounded-fk-lg py-4 text-[15px] font-black shadow-fk-md hover:brightness-105"
            } ${
                isCod
                    ? compact
                        ? "bg-gradient-to-r from-fk-success via-fk-success to-teal-600 shadow-[0_1px_2px_rgba(28,25,23,0.16),0_6px_16px_-4px_rgba(13,120,90,0.5)] hover:shadow-[0_1px_2px_rgba(28,25,23,0.18),0_8px_18px_-4px_rgba(13,120,90,0.6)] focus-visible:ring-offset-fk-success"
                        : "bg-gradient-to-r from-fk-success via-fk-success to-teal-500"
                    : compact
                        ? "bg-gradient-to-r from-[#ff5c1a] via-[#ff7a2e] to-[var(--fk-gold)] shadow-[0_1px_2px_rgba(28,25,23,0.16),0_6px_18px_-4px_rgba(255,92,26,0.5)] hover:shadow-[0_1px_2px_rgba(28,25,23,0.18),0_8px_20px_-4px_rgba(255,92,26,0.6)] focus-visible:ring-offset-[var(--fk-accent)]"
                        : "bg-gradient-to-r from-[var(--fk-accent)] via-[var(--fk-accent)] to-[var(--fk-gold)]"
            }`}>
            {compact && (
                <span className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/20 via-white/0 to-transparent" />
            )}
            <span className="pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
            {loading ? (
                <Loader2 size={compact ? 16 : 18} className="animate-spin" />
            ) : compact ? (
                <>
                    {!isCod && <Lock size={15} strokeWidth={2.25} className="shrink-0 opacity-90" />}
                    <span className="leading-none">{isCod ? "Place Order" : `Pay ₹${amount}`}</span>
                    <ArrowRight size={15} strokeWidth={2.25} className="shrink-0 transition-transform group-hover:translate-x-0.5" />
                </>
            ) : isCod ? (
                <><Banknote size={15} strokeWidth={2.5} /> Place Order · Pay ₹{amount} on Delivery <ArrowRight size={15} className="ml-0.5 transition-transform group-hover:translate-x-0.5" /></>
            ) : (
                <><Lock size={15} strokeWidth={2.5} /> Pay ₹{amount} Securely <ArrowRight size={15} className="ml-0.5 transition-transform group-hover:translate-x-0.5" /></>
            )}
        </button>
    );
}

// ── Shared order-review components ──────────────────────────────────────
// Checkout 2.0 — previously these existed ONLY inside the desktop sidebar
// (`hidden lg:block`), so mobile checkout showed no item preview and no
// itemized bill at all — just a single collapsed total. Extracted so the
// exact same markup/values render once in the left column (both
// breakpoints) and once more, unchanged, inside the sticky desktop
// sidebar — never two different implementations of the same numbers.
function OrderItemsCard({ items }: { items: CartItem[] }) {
    const [expanded, setExpanded] = useState(false);
    const totalQty = items.reduce((s, i) => s + i.quantity, 0);
    const VISIBLE_LIMIT = 3;
    const visibleItems = expanded ? items : items.slice(0, VISIBLE_LIMIT);
    const hiddenCount = items.length - visibleItems.length;

    return (
        <Card>
            <CardHead icon="🧾" title="Your Order" sub={`${totalQty} ${totalQty === 1 ? "item" : "items"}`} />
            <div className="space-y-2 p-4">
                {visibleItems.map((item) => (
                    <div key={item._id} className="flex items-center gap-3">
                        <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-fk-md border border-fk-border bg-fk-surface-interactive sm:h-14 sm:w-14">
                            <img
                                src={cdnImage(item.image, 120)}
                                alt={item.name}
                                width={120}
                                height={120}
                                loading="lazy"
                                decoding="async"
                                className="h-full w-full object-cover"
                                onError={(e) => { (e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=100&q=75&auto=format&fit=crop"; }}
                            />
                            <span className="absolute -right-1 -top-1 flex h-[17px] min-w-[17px] items-center justify-center rounded-full bg-[var(--fk-accent)] px-1 text-[9px] font-black text-white">×{item.quantity}</span>
                        </div>
                        <div className="flex min-w-0 flex-1 items-center justify-between gap-2">
                            <p className="truncate text-[13px] font-bold text-fk-text">{item.name}</p>
                            <p className="shrink-0 text-[13px] font-black text-fk-text">₹{item.price * item.quantity}</p>
                        </div>
                    </div>
                ))}
                {hiddenCount > 0 && (
                    <button
                        type="button"
                        onClick={() => setExpanded(true)}
                        className="w-full rounded-fk-md py-1.5 text-center text-[12px] font-bold text-[var(--fk-accent)] transition-colors hover:brightness-110"
                    >
                        + {hiddenCount} more item{hiddenCount === 1 ? "" : "s"}
                    </button>
                )}
                {expanded && items.length > VISIBLE_LIMIT && (
                    <button
                        type="button"
                        onClick={() => setExpanded(false)}
                        className="w-full rounded-fk-md py-1.5 text-center text-[12px] font-bold text-fk-text-tertiary transition-colors hover:text-fk-text-secondary"
                    >
                        Show less
                    </button>
                )}
            </div>
        </Card>
    );
}

function BillDetailsCard({
    subtotal, totalQty, couponDiscount, appliedCoupon, deliveryFee, isFirstDeliveryFree,
    loyaltyApplied, redeemPts, loyaltyDiscount, isCod, grandTotal, payableTotal,
}: {
    subtotal: number; totalQty: number; couponDiscount: number; appliedCoupon: AppliedCoupon | null;
    deliveryFee: number; isFirstDeliveryFree: boolean; loyaltyApplied: boolean; redeemPts: number;
    loyaltyDiscount: number; isCod: boolean; grandTotal: number; payableTotal: number;
}) {
    return (
        <Card>
            <CardHead icon="🧮" title="Bill Details" />
            <div className="space-y-2.5 p-4 text-sm">
                <div className="flex justify-between">
                    <span className="text-fk-text-secondary">Subtotal ({totalQty} items)</span>
                    <span className="font-bold text-fk-text">₹{subtotal}</span>
                </div>
                {couponDiscount > 0 && (
                    <div className="flex items-center justify-between rounded-fk-md border border-fk-border bg-fk-surface-selected px-3 py-2">
                        <div className="flex items-center gap-1.5">
                            <Tag size={11} className="text-[var(--fk-accent)]" />
                            <span className="font-black text-[var(--fk-accent)]">{appliedCoupon?.code}</span>
                        </div>
                        <span className="font-black text-[var(--fk-accent)]">−₹{couponDiscount}</span>
                    </div>
                )}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                        <span className="text-fk-text-secondary">Delivery</span>
                        {deliveryFee === 0 && (
                            isFirstDeliveryFree
                                ? <span className="flex items-center gap-1 rounded-fk-pill border border-fk-success/30 bg-fk-success/10 px-2 py-0.5 text-[9px] font-black text-fk-success"><Gift size={8} strokeWidth={3} /> FREE</span>
                                : <span className="rounded-fk-pill bg-fk-success/15 px-2 py-0.5 text-[10px] font-black text-fk-success">FREE</span>
                        )}
                    </div>
                    <span className={`font-bold ${deliveryFee === 0 ? "text-fk-success" : "text-fk-text"}`}>
                        {deliveryFee === 0 ? "₹0" : `₹${deliveryFee}`}
                    </span>
                </div>
                <div className="flex justify-between">
                    <span className="text-fk-text-secondary">Platform Fee</span>
                    <span className="font-bold text-fk-text">₹{PLATFORM_FEE}</span>
                </div>
                {isFirstDeliveryFree && (
                    <div className="flex items-center justify-between rounded-fk-md border border-fk-success/30 bg-fk-success/10 px-3 py-2">
                        <div className="flex items-center gap-1.5">
                            <Gift size={11} className="text-fk-success" />
                            <span className="font-black text-fk-success">First Order Perk</span>
                        </div>
                        <span className="font-black text-fk-success">−₹{FLAT_DELIVERY_FEE}</span>
                    </div>
                )}
                {loyaltyApplied && (
                    <div className="flex items-center justify-between rounded-fk-md border border-violet-200 bg-violet-50 px-3 py-2">
                        <div className="flex items-center gap-1.5">
                            <Sparkles size={11} className="text-violet-600" />
                            <span className="font-black text-violet-700">Rewards Discount</span>
                            <span className="rounded-fk-pill bg-violet-200 px-1.5 py-0.5 text-[9px] font-bold text-violet-700">{redeemPts} pts</span>
                        </div>
                        <span className="font-black text-violet-700">−₹{loyaltyDiscount}</span>
                    </div>
                )}
                <div className={`flex items-center justify-between rounded-fk-md border px-3 py-2 ${isCod ? "border-fk-success/30 bg-fk-success/10" : "border-blue-100 bg-blue-50"}`}>
                    <div className="flex items-center gap-1.5">
                        {isCod
                            ? <Banknote size={11} className="text-fk-success" />
                            : <CreditCard size={11} className="text-blue-600" />
                        }
                        <span className={`text-[11px] font-black ${isCod ? "text-fk-success" : "text-blue-700"}`}>
                            {isCod ? "Cash on Delivery" : "Online Payment"}
                        </span>
                    </div>
                    <span className={`text-[10px] font-bold ${isCod ? "text-fk-success" : "text-blue-600"}`}>
                        {isCod ? "Pay at door" : "Pay now"}
                    </span>
                </div>
                <div className="my-1 h-px bg-fk-border" />
                <div className="flex items-center justify-between pt-1">
                    <span className="text-base font-black text-fk-text">To Pay</span>
                    <div className="text-right">
                        {loyaltyApplied && <p className="text-xs font-bold text-fk-text-tertiary line-through">₹{grandTotal}</p>}
                        <span className="text-2xl font-black text-[var(--fk-accent)]">₹{payableTotal}</span>
                    </div>
                </div>
            </div>
        </Card>
    );
}

// ── Mobile sticky Place Order CTA ────────────────────────────────────────
// Checkout 3.0 — the prior version of this bar stacked a label row ABOVE
// a full-width, full-height <PayBtn> (py-4, 56px tall) inside its own
// p-3 container: ~108-116px total, well past premium-app territory. Now
// a single row (grid, total left / action right) with the compact PayBtn
// variant (h-12 = 48px) — total bar height ≈ 68px. Same fixed-position
// formula already shipped on /cart, flush above BottomNavigation's real
// footprint via the shared --fk-bottom-nav-clearance var. Still reuses
// <PayBtn> (same copy/loading/
// disabled logic, same `form` attribute submit wiring) — no second button,
// no duplicated business logic, just its existing `compact` variant.
function CheckoutStickyBar({
    payableTotal, loading, isClosed, cartBlocked, isCod,
}: {
    payableTotal: number; loading: boolean; isClosed: boolean; cartBlocked: boolean; isCod: boolean;
}) {
    return (
        <div
            className="fixed left-0 right-0 z-40 px-3 lg:hidden"
            style={{ bottom: "calc(var(--fk-bottom-nav-clearance) + var(--fk-safe-bottom) + 8px)" }}
        >
            <div className="grid grid-cols-[minmax(84px,0.75fr)_minmax(180px,1.25fr)] items-center gap-2.5 rounded-fk-lg border border-fk-border bg-fk-surface-elevated px-3.5 py-2.5 shadow-fk-lg">
                <div className="min-w-0">
                    <p className="text-[9px] font-black uppercase tracking-wide text-fk-text-tertiary">To Pay</p>
                    <p className="truncate text-lg font-black leading-tight text-[var(--fk-accent)]">₹{payableTotal}</p>
                </div>
                <PayBtn compact loading={loading} amount={payableTotal} disabled={isClosed || cartBlocked} isCod={isCod} form="checkout-form" />
            </div>
        </div>
    );
}

function TrustNote({ isCod }: { isCod?: boolean }) {
    if (isCod) {
        return (
            <div className="mt-3 text-center">
                <p className="text-[11px] text-fk-text-tertiary">💵 Pay cash when your rider arrives · No advance needed</p>
            </div>
        );
    }
    return (
        <div className="mt-3 space-y-1 text-center">
            <p className="text-[11px] text-fk-text-tertiary">🔒 <span className="font-bold text-fk-text-secondary">Razorpay</span> secured · UPI · Cards · Net Banking · Wallets</p>
            <p className="text-[10px] text-fk-text-tertiary">No payment details stored on our servers</p>
        </div>
    );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function CheckoutPage() {
    // router is still used for non-success navigations (auth redirect)
    const router = useRouter();

    const items     = useCartStore((s) => s.items);
    const clearCart = useCartStore((s) => s.clearCart);
    const subtotal  = useCartStore((s) => s.getTotalPrice());
    const totalQty  = items.reduce((s, i) => s + i.quantity, 0);
    const cartIds   = items.map((i) => i._id);

    // PHASE 4: re-run the same server-authoritative availability/price check
    // as the cart page — a customer can land here directly (bookmark/back
    // button) without ever passing through /cart, and the product catalog
    // can change in the gap between the two pages regardless. Blocks
    // payment/order submission below until every item is orderable; the
    // actual financial/availability enforcement still happens server-side
    // in create-order/cod (Phase 2A) — this is the pre-flight UX layer.
    const { isCartValid, loading: cartValidating } = useCartValidation(items);
    const cartBlocked = items.length > 0 && !cartValidating && !isCartValid;

    const [form, setForm] = useState<FormState>({ customerName: "", phone: "", address: "", landmark: "", note: "", deliveryInstructions: "" });

    // ── NEW: Order processing hook ────────────────────────────────────────────
    // "loading" is now derived from processingOrder; we keep no separate useState.
    const {
        processingOrder,
        variant:         processingVariant,
        startProcessing,
        stopProcessing,
        finishProcessing,
    } = useOrderProcessing({ clearCart });

    // Convenience alias — used in JSX where `loading` was previously used
    const loading = processingOrder;

    const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("razorpay");

    const [shopOpen, setShopOpen]                       = useState<boolean | null>(null);
    const [shopClosedReason, setShopClosedReason]        = useState<string | null>(null);
    const shopStatusFetched                             = useRef(false);
    const [isFirstDeliveryFree, setIsFirstDeliveryFree] = useState(false);
    const eligibilityFetched                            = useRef(false);

    const [loyalty,         setLoyalty]         = useState<LoyaltyInfo | null>(null);
    const [redeemPts,       setRedeemPts]       = useState(0);
    const [loyaltyApplied,  setLoyaltyApplied]  = useState(false);
    const [loyaltyDiscount, setLoyaltyDiscount] = useState(0);
    const [applyingLoyalty, setApplyingLoyalty] = useState(false);
    const loyaltyFetched                        = useRef(false);

    // ── Phase 10: delivery location + server-checked serviceability ───────
    // Purely informational/UX — the server (createOrderCore) is what
    // actually decides serviceability/fee at order-creation time regardless
    // of anything computed here. Before a location is chosen, the UI falls
    // back to the pre-Phase-10 flat-rate estimate so checkout isn't blocked
    // or blank while waiting for the customer to pick a location.
    // Phase 10B: one active delivery location shared across Navbar/cart/
    // checkout (src/store/locationStore.ts) — checkout seeds itself from
    // whatever was already selected elsewhere (e.g. the Navbar picker)
    // instead of starting with a disconnected, separate "no location"
    // state, and writes back to the shared store whenever the customer
    // picks a new one here, so the Navbar chip reflects it too.
    const sharedLocation = useLocationStore((s) => s.location);
    const setSharedLocation = useLocationStore((s) => s.setLocation);
    const [deliveryCoords, setDeliveryCoords] = useState<{ lat: number; lng: number } | null>(
        sharedLocation ? { lat: sharedLocation.lat, lng: sharedLocation.lng } : null
    );
    const [locatingCurrent, setLocatingCurrent] = useState(false);
    const [pinPickerOpen, setPinPickerOpen] = useState(false);
    // Checkout 3.0 — once an address has been resolved via an explicit
    // pick/detect action (saved address, GPS, map pin), collapse the form
    // into a compact "Delivering to / Change" summary instead of always
    // showing the full picker+textarea+landmark+instructions stack.
    // Deliberately NOT auto-collapsed while the customer is still typing a
    // manual address — there's no clear "done" signal for free text, so
    // collapsing mid-type would yank the textarea out from under them.
    const [addressCollapsed, setAddressCollapsed] = useState(false);
    const [addressLabel, setAddressLabel] = useState<string | null>(null);
    // Phase 11 — coupon. Server re-validates+reserves this fresh at order
    // creation regardless of what's shown here (see createOrderCore.ts) —
    // this state is UX-only, never trusted financially by itself.
    const [appliedCoupon, setAppliedCoupon] = useState<AppliedCoupon | null>(null);
    // Inline, field-anchored validation errors — shown next to the actual
    // input instead of (as well as) a generic toast, so the customer knows
    // exactly which field to fix without having to guess from a banner.
    const [fieldErrors, setFieldErrors] = useState<{ customerName?: string; phone?: string; address?: string }>({});
    const clearFieldError = (field: keyof typeof fieldErrors) =>
        setFieldErrors((p) => (p[field] ? { ...p, [field]: undefined } : p));
    const appliedCouponSubtotal = useRef<number | null>(null);
    const [serviceability, setServiceability] = useState<{
        serviceable: boolean; distanceKm: number | null; deliveryFee: number;
        freeDelivery: boolean; reason: string | null; codMaxOrderAmount?: number;
    } | null>(null);
    const [checkingServiceability, setCheckingServiceability] = useState(false);

    useEffect(() => {
        if (!deliveryCoords) { setServiceability(null); return; }

        setCheckingServiceability(true);
        const controller = new AbortController();
        const timer = setTimeout(() => {
            fetch("/api/delivery/serviceability", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ latitude: deliveryCoords.lat, longitude: deliveryCoords.lng, cartSubtotal: subtotal, orderType: "delivery" }),
                signal: controller.signal,
            })
                .then((r) => r.ok ? r.json() : null)
                .then((data) => {
                    if (data?.success) setServiceability(data);
                })
                .catch((err) => { if (err?.name !== "AbortError") setServiceability(null); })
                .finally(() => setCheckingServiceability(false));
        }, 350); // debounce — avoid firing on every intermediate render

        return () => { clearTimeout(timer); controller.abort(); };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [deliveryCoords?.lat, deliveryCoords?.lng, subtotal]);

    const handleUseCurrentLocation = useCallback(() => {
        if (!navigator.geolocation) {
            toast.error("Your browser doesn't support location detection. Please enter your address manually.");
            return;
        }
        setLocatingCurrent(true);
        navigator.geolocation.getCurrentPosition(
            async (pos) => {
                const { latitude: lat, longitude: lng } = pos.coords;
                setDeliveryCoords({ lat, lng });

                // Phase 10B: GPS -> reverse geocode -> populate readable
                // address -> serviceability (triggered separately by the
                // deliveryCoords effect). Only fills the address field if
                // the customer hasn't already typed one — never clobbers
                // existing input (spec §6: "do not clear unrelated fields").
                try {
                    const res = await fetch("/api/location/reverse-geocode", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ latitude: lat, longitude: lng }),
                    });
                    const data = await res.json();
                    const composed = [data?.road, data?.locality, data?.city, data?.state, data?.pincode]
                        .filter(Boolean).join(", ");
                    if (composed) {
                        setForm((p) => (p.address.trim() ? p : { ...p, address: composed }));
                    }
                    // Keep the Navbar/cart location chip in sync with
                    // whatever checkout just detected — one shared active
                    // location, not a disconnected copy.
                    setSharedLocation({ label: data?.displayLabel || "Current location", lat, lng, addressId: null });
                    setAddressLabel(data?.displayLabel || "Current location");
                } catch {
                    setSharedLocation({ label: "Current location", lat, lng, addressId: null });
                    setAddressLabel("Current location");
                }

                setAddressCollapsed(true);
                setLocatingCurrent(false);
                toast.success("Location detected");
            },
            (err) => {
                setLocatingCurrent(false);
                const message = err.code === err.PERMISSION_DENIED
                    ? "Location permission was denied. You can enter your address manually."
                    : "We couldn't determine your exact location. Please enter your address manually.";
                toast.error(message);
            },
            { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 }
        );
    }, [setSharedLocation]);

    // Phase 10 — map-pin confirm: the free, GPS-independent way a customer
    // with a manually typed address gets real coordinates. Same reverse-
    // geocode-for-text-assistance pattern as GPS above; coordinates are
    // authoritative regardless of whether the lookup succeeds.
    const handlePinConfirm = useCallback(async (lat: number, lng: number) => {
        setDeliveryCoords({ lat, lng });
        setPinPickerOpen(false);
        try {
            const res = await fetch("/api/location/reverse-geocode", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ latitude: lat, longitude: lng }),
            });
            const data = await res.json();
            setSharedLocation({ label: data?.displayLabel || "Pinned location", lat, lng, addressId: null });
            setAddressLabel(data?.displayLabel || "Pinned location");
        } catch {
            setSharedLocation({ label: "Pinned location", lat, lng, addressId: null });
            setAddressLabel("Pinned location");
        }
        setAddressCollapsed(true);
        toast.success("Location pinned");
    }, [setSharedLocation]);

    const isNonServiceable = serviceability !== null && !serviceability.serviceable;
    const deliveryFee = serviceability?.serviceable
        ? (serviceability.freeDelivery ? 0 : serviceability.deliveryFee)
        : isFirstDeliveryFree ? 0 : calculateDeliveryFee(subtotal);
    // Phase 11 — coupon discounts the product subtotal only; delivery/
    // platform fee are computed from the raw subtotal above, exactly like
    // the server-side calculation in createOrderCore.ts (same documented
    // calculation order — coupon first, then loyalty on the reduced total).
    const couponDiscount = appliedCoupon?.discountAmount ?? 0;
    const discountedSubtotal = Math.max(0, subtotal - couponDiscount);
    const grandTotal   = discountedSubtotal + deliveryFee + PLATFORM_FEE;
    const payableTotal = Math.max(0, grandTotal - loyaltyDiscount);

    // Server-resolved COD cap from the serviceability preview; the imported
    // constant is only a pre-load display fallback (the backend is always the
    // authoritative gate — same pattern as minimumOrderValue above).
    const codMax = serviceability?.codMaxOrderAmount ?? COD_MAX_ORDER_AMOUNT;
    const codAvailable = grandTotal < codMax;

    // Phase 11 — cart changes must revalidate an already-applied coupon
    // (spec §14): if subtotal drops below the coupon's minimum order after
    // it was applied, silently continuing to show the discount would be
    // stale/misleading. The server re-validates authoritatively regardless
    // at order creation, but the UI shouldn't lie in the meantime.
    useEffect(() => {
        if (!appliedCoupon) return;
        if (appliedCouponSubtotal.current === null) {
            appliedCouponSubtotal.current = subtotal;
            return;
        }
        if (appliedCouponSubtotal.current !== subtotal) {
            appliedCouponSubtotal.current = null;
            setAppliedCoupon(null);
            toast.error("Your cart changed — please re-apply your coupon.");
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [subtotal]);

    useEffect(() => {
        if (paymentMethod === "cod" && !codAvailable) {
            setPaymentMethod("razorpay");
            toast("Switched to online payment — order total exceeds COD limit.", {
                icon: "ℹ️",
                style: { background: "var(--fk-gold-soft)", color: "var(--fk-text)", border: "1px solid var(--fk-border)", borderRadius: "12px" },
            });
        }
    }, [codAvailable, paymentMethod]);

    const set = (k: keyof FormState) => (v: string) => setForm((p) => ({ ...p, [k]: v }));

    // Customer Identity Validation Repair — the exact prefilled values from
    // the stored profile at page-load time ("legacy baseline"). As long as
    // the customer submits these UNCHANGED, the new stricter name/phone
    // rules must not block them (see validate() below) — only a genuinely
    // new/edited value is held to the new rules.
    const prefillRef = useRef<{ customerName: string; phone: string }>({ customerName: "", phone: "" });

    useEffect(() => {
        const pf = tryPrefill();
        if (Object.keys(pf).length) {
            prefillRef.current = {
                customerName: pf.customerName ?? "",
                phone:        pf.phone ?? "",
            };
            setForm((p) => ({ ...p, ...pf }));
        }
    }, []);

    useEffect(() => {
        fetch("/api/auth/me").then((r) => { if (!r.ok) router.push("/auth?mode=login&redirect=/checkout"); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (shopStatusFetched.current) return;
        shopStatusFetched.current = true;
        fetch("/api/shop/status")
            .then((r) => r.ok ? r.json() : { isOpen: true })
            .then((d) => {
                const open = d?.isOpen ?? true;
                setShopOpen(open);
                setShopClosedReason(d?.closedReasonLabel ?? null);
                if (!open) toast.error("Kitchen is currently closed", { duration: 5000, style: { background: "var(--fk-danger)", color: "#fff", border: "1px solid var(--fk-danger)", borderRadius: "12px" } });
            })
            .catch(() => setShopOpen(true));
    }, []);

    useEffect(() => {
        if (eligibilityFetched.current) return;
        eligibilityFetched.current = true;
        fetch("/api/delivery/eligibility", { credentials: "include" })
            .then((r) => r.ok ? r.json() : { eligible: false })
            .then((d) => { if (d.eligible) setIsFirstDeliveryFree(true); })
            .catch(() => {});
    }, []);

    useEffect(() => {
        if (loyaltyFetched.current) return;
        loyaltyFetched.current = true;
        fetch("/api/loyalty", { credentials: "include" })
            .then((r) => r.ok ? r.json() : null)
            .then((d) => {
                if (d?.success && d.balance > 0) {
                    const info: LoyaltyInfo = {
                        balance:          d.balance,
                        pointValueInr:    d.pointValueInr    ?? 0.5,
                        minRedeem:        d.minRedeem        ?? 50,
                        maxRedemptionPct: d.maxRedemptionPct ?? 0.20,
                    };
                    setLoyalty(info);
                    const mx = maxRedeemablePoints(grandTotal, d.balance);
                    if (mx >= info.minRedeem) setRedeemPts(mx);
                }
            })
            .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (!loyalty || loyaltyApplied) return;
        const mx = maxRedeemablePoints(grandTotal, loyalty.balance);
        if (redeemPts > mx) setRedeemPts(Math.max(loyalty.minRedeem, mx));
    }, [grandTotal, loyalty, loyaltyApplied]);

    const handleApplyLoyalty = useCallback(() => {
        if (!loyalty || redeemPts < loyalty.minRedeem) return;
        setApplyingLoyalty(true);
        setTimeout(() => {
            const disc = Number((redeemPts * loyalty.pointValueInr).toFixed(0));
            setLoyaltyDiscount(disc);
            setLoyaltyApplied(true);
            setApplyingLoyalty(false);
            toast.success(`₹${disc} reward applied! 🎉`, { style: { background: "#f5f3ff", color: "#4c1d95", border: "1px solid #c4b5fd", borderRadius: "12px" } });
        }, 450);
    }, [loyalty, redeemPts]);

    const handleRemoveLoyalty = useCallback(() => {
        setLoyaltyApplied(false);
        setLoyaltyDiscount(0);
    }, []);

    const buildPayload = (extra: Record<string, unknown> = {}) => ({
        paymentMethod,
        customerName:  form.customerName.trim(),
        phone:         normalizeIndianMobile(form.phone) || form.phone.trim(),
        address:       form.address.trim(),
        landmark:      form.landmark.trim(),
        note:          form.note.trim(),
        deliveryInstructions: form.deliveryInstructions.trim(),
        orderType:     "delivery",
        items:         items.map((i) => ({ _id: i._id, name: i.name, price: i.price, quantity: i.quantity, image: i.image })),
        latitude:      deliveryCoords?.lat ?? null,
        longitude:     deliveryCoords?.lng ?? null,
        couponCode:    appliedCoupon?.code ?? null,
        ...extra,
    });

    const validate = (): boolean => {
        if (shopOpen === false)                                   { toast.error("Shop is currently closed.");                           return false; }

        // Field-anchored validation — collect every invalid/missing
        // required field in one pass (not just the first) so the inline
        // messages next to Name/Phone/Address are all correct the moment
        // "Place Order" is clicked, instead of only revealing the next
        // problem after the previous one is fixed and resubmitted.
        const errors: { customerName?: string; phone?: string; address?: string } = {};

        // Customer Identity Validation Repair — grandfather an UNCHANGED
        // prefilled legacy value (e.g. an existing short name, or a phone
        // already on file) so an existing customer is never blocked just
        // for submitting their own stored profile data unchanged. Any
        // value that differs from what was prefilled is a voluntary edit
        // (or a guest/first-time entry) and must pass checkout's own name
        // rule (4+ characters — see validateCheckoutName above; this is
        // intentionally more lenient than signup's 7-character minimum).
        const nameUnchanged = form.customerName.trim() === prefillRef.current.customerName && !!prefillRef.current.customerName;
        if (!nameUnchanged) {
            const nameResult = validateCheckoutName(form.customerName);
            if (!nameResult.ok) errors.customerName = nameResult.message;
        } else if (!form.customerName.trim()) {
            errors.customerName = "Please enter your full name.";
        }

        const phoneUnchanged = form.phone.trim() === prefillRef.current.phone && !!prefillRef.current.phone;
        if (!phoneUnchanged) {
            const phoneResult = validateIndianMobile(form.phone);
            if (!phoneResult.ok) errors.phone = phoneResult.message;
        } else if (!form.phone.trim()) {
            errors.phone = "Enter a valid 10-digit phone number.";
        }

        if (!form.address.trim()) {
            errors.address = "Please enter your delivery address.";
        }

        if (Object.keys(errors).length > 0) {
            setFieldErrors(errors);
            // Lead with the first specific problem — consistent with every
            // other validation message on this page (one clear toast per
            // submit attempt) while the inline messages cover the rest.
            toast.error(errors.customerName ?? errors.phone ?? errors.address ?? "Please fix the highlighted fields.");
            return false;
        }
        setFieldErrors({});

        if (!items.length)                                        { toast.error("Your cart is empty");                                  return false; }
        if (subtotal < MIN_ORDER_AMOUNT)                          { toast.error(`Minimum order amount is ₹${MIN_ORDER_AMOUNT}`);        return false; }
        if (paymentMethod === "cod" && !codAvailable)             { toast.error(`COD only for orders below ₹${codMax}`);               return false; }
        if (cartBlocked)                                          { toast.error("Please remove unavailable items from your cart");      return false; }
        // Phase 10 — proactive check once a location has actually been
        // chosen and checked (coordinates aren't required to submit at all
        // — a plain typed address still works exactly as before; the
        // server decides at order-creation time whether a location was
        // genuinely required, e.g. once the admin has configured the
        // kitchen coordinate — see createOrderCore.ts).
        if (isNonServiceable)                                     { toast.error("We don't deliver to this location yet");               return false; }
        return true;
    };

    // ── COD flow ──────────────────────────────────────────────────────────────
    // CHANGED: removed clearCart() and router.push() — both live in finishProcessing()
    const handleCOD = async () => {
        const res  = await fetch("/api/orders/cod", {
            method:  "POST",
            headers: { "Content-Type": "application/json" },
            body:    JSON.stringify(buildPayload({ redeemedPoints: loyaltyApplied ? redeemPts : 0 })),
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
            toast.error(data.message || "Failed to place COD order");
            stopProcessing(); // ← show overlay gone, allow retry
            return;
        }
        finishProcessing(data.orderId); // ← clears cart + redirects
    };

    // ── Razorpay flow ─────────────────────────────────────────────────────────
    // CHANGED: removed clearCart() and router.push() — both live in finishProcessing()
    // CHANGED: stopProcessing() replaces setLoading(false) on all error paths
    const handleRazorpay = async () => {
        const loaded = await loadRazorpay();
        if (!loaded) {
            toast.error("Payment gateway unavailable. Please retry.");
            stopProcessing();
            return;
        }

        const cr = await fetch("/api/payment/create-order", {
            method:  "POST",
            headers: { "Content-Type": "application/json" },
            // NOTE: full checkout context (customer/address/full item objects,
            // not just price/quantity) is sent here now, not only at /verify —
            // this is what lets the Razorpay webhook recover the order if the
            // browser never completes the /verify round trip. See
            // src/models/PendingPayment.ts.
            body:    JSON.stringify(buildPayload({
                redeemedPoints: loyaltyApplied ? redeemPts : 0,
            })),
        });
        const cd = await cr.json();
        if (!cr.ok || !cd.success) {
            toast.error(cd.message || "Could not initialise payment");
            stopProcessing();
            return;
        }

        if (cd.isFirstDeliveryFreeApplied && !isFirstDeliveryFree) {
            setIsFirstDeliveryFree(true);
        }

        // Hide our overlay while Razorpay modal is open — Razorpay has its own UI
        // We'll re-show (via startProcessing) in the handler after payment succeeds
        stopProcessing();

        const rzp = new window.Razorpay({
            key:         cd.keyId,
            amount:      cd.amount * 100,
            currency:    "INR",
            name:        "FoodKnock",
            description: "Food Delivery",
            image:       "/logo.png",
            order_id:    cd.razorpayOrderId,
            prefill:     { name: form.customerName, contact: form.phone },
            theme:       { color: "#ff5c1a" },
            handler: async (response: unknown) => {
                // Payment captured — show overlay again while we verify + create order
                startProcessing("razorpay");

                const rp = response as {
                    razorpay_order_id:   string;
                    razorpay_payment_id: string;
                    razorpay_signature:  string;
                };

                const vr = await fetch("/api/payment/verify", {
                    method:  "POST",
                    headers: { "Content-Type": "application/json" },
                    body:    JSON.stringify(buildPayload({
                        razorpayOrderId:       rp.razorpay_order_id,
                        razorpayPaymentId:     rp.razorpay_payment_id,
                        razorpaySignature:     rp.razorpay_signature,
                        validatedRedeemPoints: cd.validatedRedeemPoints ?? 0,
                    })),
                });
                const vd = await vr.json();
                if (!vr.ok || !vd.success) {
                    toast.error(vd.message || "Payment verification failed");
                    stopProcessing();
                    return;
                }

                finishProcessing(vd.orderId); // ← clears cart + redirects
            },
            modal: {
                ondismiss: () => {
                    toast("Payment cancelled", { icon: "ℹ️" });
                    // overlay already hidden (stopProcessing was called before rzp.open())
                },
            },
        });
        rzp.open();
    };

    // ── Submit ────────────────────────────────────────────────────────────────
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!validate()) return;

        startProcessing(paymentMethod === "cod" ? "cod" : "razorpay"); // ← show overlay

        try {
            if (paymentMethod === "cod") {
                await handleCOD();
            } else {
                await handleRazorpay();
            }
        } catch {
            toast.error("Something went wrong. Please retry.");
            stopProcessing(); // ← hide overlay on unexpected throw
        }
    };

    const isClosed = shopOpen === false;
    const isCod    = paymentMethod === "cod";

    return (
        <>

            {/* ── Full-screen processing overlay (NEW) ── */}
            <OrderProcessingOverlay
                visible={processingOrder}
                variant={processingVariant}
            />

            {/* Phase 10 — free map-pin fallback for manual addresses with no coordinates */}
            <MapPinPicker
                open={pinPickerOpen}
                onClose={() => setPinPickerOpen(false)}
                onConfirm={handlePinConfirm}
                initialLat={deliveryCoords?.lat ?? null}
                initialLng={deliveryCoords?.lng ?? null}
            />

            <main className="min-h-screen bg-fk-bg">

                {/* Compact header — identity + a single small trust indicator,
                    no decorative hero height (spec: "do not waste vertical
                    space"). The former 4-icon trust row + quote card were
                    purely decorative; TrustNote (near the Pay button) already
                    carries the one claim that matters at the point of
                    decision. */}
                <div className="border-b border-fk-border bg-fk-surface-elevated">
                    <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 md:px-8">
                        <div>
                            <h1 className="text-xl font-black text-fk-text md:text-2xl">Checkout</h1>
                            {items.length > 0 && (
                                <p className="mt-0.5 text-[12px] font-semibold text-fk-text-secondary">
                                    {totalQty} {totalQty === 1 ? "item" : "items"} · ₹{subtotal}
                                </p>
                            )}
                        </div>
                        <div className="flex shrink-0 items-center gap-1.5 text-[11px] font-bold text-fk-text-tertiary">
                            <Lock size={12} className="text-fk-gold" strokeWidth={2.5} />
                            Secure checkout
                        </div>
                    </div>
                </div>

                {/* Body */}
                {/* CART + CHECKOUT PREMIUM LAYOUT FIX — this used to be a
                    hardcoded `pb-[150px]`: no --fk-safe-bottom term at all,
                    even though CheckoutStickyBar (below) shifts its own
                    position up by that same inset on devices with a real
                    bottom safe-area — a real, if small, under-reservation
                    on exactly those devices. Now derived from the same
                    shared clearance chain CheckoutStickyBar's own `bottom`
                    offset uses, so this can never silently re-diverge from
                    it again. */}
                <div className={`mx-auto max-w-6xl px-4 py-5 md:px-8 md:py-8 ${items.length > 0 ? "pb-[calc(var(--fk-bottom-nav-clearance)+var(--fk-safe-bottom)+var(--fk-sticky-actionbar-extra-clearance))] lg:pb-8" : ""}`}>
                    {items.length === 0 ? <EmptyCart /> : (
                        <form id="checkout-form" onSubmit={handleSubmit} noValidate>
                            {/* Cart Responsive Repair — same root-cause fix as /cart
                                (src/app/(main)/cart/page.tsx): a bare `1fr` track's
                                automatic minimum size defaults to its content's
                                min-content width, so it can force the grid wider
                                than the viewport and push the fixed-width summary
                                column off-screen. minmax(0, 1fr) floors it at 0. */}
                            <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_380px] xl:grid-cols-[minmax(0,1fr)_400px]">

                                {/* LEFT */}
                                <div className="flex min-w-0 flex-col gap-4">
                                    {isClosed && <ShopClosedBanner reason={shopClosedReason} />}
                                    {!isClosed && isFirstDeliveryFree && <FirstDeliveryFreeBanner />}

                                    <Card>
                                        <CardHead icon="👤" title="Your Details" sub="We use this to confirm and deliver your order" />
                                        <div className="space-y-2.5 p-4">
                                            <div className="grid grid-cols-2 gap-3">
                                                <div className="flex flex-col gap-1.5">
                                                    <label className="text-[11px] font-black uppercase tracking-[0.18em] text-fk-text-secondary">Full Name <span className="text-[var(--fk-accent)]">*</span></label>
                                                    <FKInput
                                                        value={form.customerName}
                                                        onChange={(v) => { set("customerName")(v); clearFieldError("customerName"); }}
                                                        placeholder="Your full name" autoComplete="name" required disabled={isClosed || loading}
                                                        icon={<User size={14} strokeWidth={2} />}
                                                        error={fieldErrors.customerName}
                                                    />
                                                    <p className={fieldErrors.customerName ? "text-[11px] font-bold text-fk-danger" : "text-[11px] text-fk-text-tertiary"}>
                                                        {fieldErrors.customerName || "Enter your full name."}
                                                    </p>
                                                </div>
                                                <div className="flex flex-col gap-1.5">
                                                    <label className="text-[11px] font-black uppercase tracking-[0.18em] text-fk-text-secondary">Mobile Number <span className="text-[var(--fk-accent)]">*</span></label>
                                                    <div
                                                        className={`flex items-stretch overflow-hidden rounded-fk-md border bg-fk-surface-interactive transition-all focus-within:ring-2 ${
                                                            fieldErrors.phone
                                                                ? "border-fk-danger focus-within:border-fk-danger focus-within:ring-fk-danger/15"
                                                                : "border-fk-border hover:border-fk-border focus-within:border-[var(--fk-accent)] focus-within:bg-fk-surface-elevated focus-within:ring-[var(--fk-accent)]/15"
                                                        }`}
                                                    >
                                                        <span className="flex shrink-0 items-center gap-1 border-r border-fk-border bg-fk-surface px-2 text-[13px] font-bold text-fk-text-secondary">
                                                            <Phone size={13} strokeWidth={2} />
                                                            +91
                                                        </span>
                                                        <input
                                                            type="tel"
                                                            inputMode="numeric"
                                                            value={form.phone}
                                                            onChange={(e) => { set("phone")(e.target.value.replace(/\D/g, "").slice(0, 10)); clearFieldError("phone"); }}
                                                            onPaste={(e) => {
                                                                e.preventDefault();
                                                                set("phone")(normalizeIndianMobile(e.clipboardData.getData("text")).slice(0, 10));
                                                                clearFieldError("phone");
                                                            }}
                                                            maxLength={10}
                                                            placeholder="9876543210"
                                                            autoComplete="tel-national"
                                                            required
                                                            disabled={isClosed || loading}
                                                            aria-invalid={!!fieldErrors.phone}
                                                            className="w-full min-w-0 bg-transparent py-3.5 pl-2 pr-2 text-sm font-medium text-fk-text placeholder:text-fk-text-tertiary outline-none disabled:cursor-not-allowed disabled:opacity-60"
                                                        />
                                                    </div>
                                                    <p className={fieldErrors.phone ? "text-[11px] font-bold text-fk-danger" : "text-[11px] text-fk-text-tertiary"}>
                                                        {fieldErrors.phone || "📞 Rider calls this number on delivery."}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    </Card>

                                    <Card>
                                        <CardHead icon="📍" title="Delivery Address" sub="Tell us where to knock" />
                                        {addressCollapsed && form.address.trim().length > 0 ? (
                                            <div className="flex items-center gap-3 p-4">
                                                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-fk-md bg-fk-gold-soft">
                                                    <MapPin size={16} className="text-[var(--fk-accent)]" strokeWidth={2.5} />
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <p className="text-[10px] font-black uppercase tracking-wider text-fk-text-tertiary">Delivering to</p>
                                                    {addressLabel && <p className="text-[13px] font-bold text-fk-text">{addressLabel}</p>}
                                                    <p className="truncate text-[12px] font-semibold text-fk-text-secondary">{form.address}</p>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => setAddressCollapsed(false)}
                                                    disabled={isClosed || loading}
                                                    className="shrink-0 text-[11px] font-black text-[var(--fk-accent)] disabled:opacity-50"
                                                >
                                                    Change ›
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="space-y-3 p-4">
                                                <DeliveryBar subtotal={subtotal} isFirstDeliveryFree={isFirstDeliveryFree} />
                                                <SavedAddressPicker
                                                    onSelect={(picked) => {
                                                        const address = composeAddress(picked);
                                                        setForm((p) => ({
                                                            ...p,
                                                            address,
                                                            landmark: picked.landmark || p.landmark,
                                                            deliveryInstructions: picked.deliveryInstructions || p.deliveryInstructions,
                                                        }));
                                                        setDeliveryCoords(picked.lat !== null && picked.lng !== null ? { lat: picked.lat, lng: picked.lng } : null);
                                                        if (picked.lat !== null && picked.lng !== null) {
                                                            // Shared active location — keeps the Navbar/cart chip in sync.
                                                            setSharedLocation({
                                                                label: picked.label || address,
                                                                lat: picked.lat,
                                                                lng: picked.lng,
                                                                addressId: picked._id,
                                                            });
                                                        }
                                                        setAddressLabel(picked.label || null);
                                                        setAddressCollapsed(true);
                                                    }}
                                                    onUseCurrentLocation={handleUseCurrentLocation}
                                                    locatingCurrent={locatingCurrent}
                                                />

                                                {/* Phase 10 — server-checked serviceability feedback */}
                                                {checkingServiceability && (
                                                    <div className="flex items-center gap-2 rounded-fk-lg border border-fk-border bg-fk-surface-interactive px-4 py-2.5 text-[12px] font-medium text-fk-text-secondary">
                                                        <Loader2 size={13} className="animate-spin" /> Checking delivery availability…
                                                    </div>
                                                )}
                                                {!checkingServiceability && serviceability && (
                                                    serviceability.serviceable ? (
                                                        <div className="flex items-center gap-2 rounded-fk-lg border border-fk-success/30 bg-fk-success/10 px-4 py-2.5 text-[12px] font-bold text-fk-success">
                                                            ✓ We deliver here
                                                            {typeof serviceability.distanceKm === "number" && ` · ${formatDistance(serviceability.distanceKm)} away`}
                                                        </div>
                                                    ) : (
                                                        <div className="rounded-fk-lg border border-fk-danger/30 bg-fk-danger/10 px-4 py-3 text-[12px] font-bold text-fk-danger">
                                                            ✕ We don&apos;t deliver here yet
                                                            <p className="mt-0.5 text-[11px] font-medium text-fk-danger/80">
                                                                Try a different location or a saved address closer to FoodKnock.
                                                            </p>
                                                        </div>
                                                    )
                                                )}

                                                {/* Phase 10 — manual address with no coordinates at all: distinct
                                                    from "outside delivery area" above. The server can't calculate
                                                    distance without a pin, so offer the free map picker instead of
                                                    leaving the customer stuck at a generic error on submit. */}
                                                {!checkingServiceability && !serviceability && !deliveryCoords && form.address.trim().length > 0 && (
                                                    <div className="rounded-fk-lg border border-fk-border bg-fk-gold-soft px-4 py-3 text-[12px] font-bold text-fk-text">
                                                        📍 Set your delivery location to calculate delivery distance
                                                        <p className="mt-0.5 text-[11px] font-medium text-fk-text-secondary">
                                                            We can&apos;t calculate distance from typed text alone — pin your exact location on the map, or use a saved address.
                                                        </p>
                                                        <button
                                                            type="button"
                                                            onClick={() => setPinPickerOpen(true)}
                                                            className="mt-2 inline-flex items-center gap-1.5 rounded-fk-md bg-fk-gold px-3 py-1.5 text-[11.5px] font-bold text-white transition-colors hover:brightness-110"
                                                        >
                                                            <MapPin size={12} /> Pin exact location
                                                        </button>
                                                    </div>
                                                )}
                                                <div className="flex flex-col gap-1.5">
                                                    <label className="text-[11px] font-black uppercase tracking-[0.18em] text-fk-text-secondary">Full Address <span className="text-[var(--fk-accent)]">*</span></label>
                                                    <FKTextarea
                                                        value={form.address}
                                                        onChange={(v) => { set("address")(v); clearFieldError("address"); }}
                                                        placeholder={fieldErrors.address ? "Required — e.g. House no., Street, Colony, City..." : "House no., Street, Colony, City..."}
                                                        rows={2} disabled={isClosed || loading} icon={<MapPin size={14} strokeWidth={2} />}
                                                        error={fieldErrors.address}
                                                    />
                                                    {fieldErrors.address && (
                                                        <p className="text-[11px] font-bold text-fk-danger">{fieldErrors.address}</p>
                                                    )}
                                                </div>
                                                <div className="grid grid-cols-2 gap-3">
                                                    <div className="flex flex-col gap-1.5">
                                                        <label className="text-[11px] font-black uppercase tracking-[0.18em] text-fk-text-secondary">
                                                            Landmark <span className="font-medium normal-case tracking-normal text-fk-text-tertiary">(optional)</span>
                                                        </label>
                                                        <FKInput value={form.landmark} onChange={set("landmark")} placeholder="Near school, temple..." disabled={isClosed || loading} icon={<Tag size={14} strokeWidth={2} />} />
                                                    </div>
                                                    <div className="flex flex-col gap-1.5">
                                                        <label className="text-[11px] font-black uppercase tracking-[0.18em] text-fk-text-secondary">
                                                            Instructions <span className="font-medium normal-case tracking-normal text-fk-text-tertiary">(optional)</span>
                                                        </label>
                                                        <FKInput
                                                            value={form.deliveryInstructions} onChange={set("deliveryInstructions")}
                                                            placeholder="Gate no., floor..."
                                                            disabled={isClosed || loading} icon={<MessageSquare size={14} strokeWidth={2} />}
                                                        />
                                                    </div>
                                                </div>
                                                {form.address.trim().length > 0 && deliveryCoords && (
                                                    <button
                                                        type="button"
                                                        onClick={() => setAddressCollapsed(true)}
                                                        className="w-full rounded-fk-md border border-fk-border bg-fk-surface-selected py-2 text-[12px] font-bold text-[var(--fk-accent)] transition-colors hover:brightness-105"
                                                    >
                                                        Done — collapse address
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </Card>

                                    <CouponBox
                                        cartItems={items.map((i) => ({ _id: i._id, quantity: i.quantity }))}
                                        onApplied={setAppliedCoupon}
                                        onRemoved={() => setAppliedCoupon(null)}
                                        disabled={isClosed || loading}
                                    />

                                    <PaymentMethodSelector
                                        selected={paymentMethod} onChange={setPaymentMethod}
                                        codAvailable={codAvailable} grandTotal={grandTotal}
                                        codMax={codMax}
                                        disabled={isClosed || loading}
                                    />

                                    {loyalty && (
                                        <LoyaltyCard
                                            loyalty={loyalty} grandTotal={grandTotal}
                                            pts={redeemPts} onPts={setRedeemPts}
                                            applied={loyaltyApplied} onApply={handleApplyLoyalty}
                                            onRemove={handleRemoveLoyalty} applying={applyingLoyalty}
                                        />
                                    )}

                                    {/* Pre-Phase 17 Phase 2 — fully independent of the food-order
                                        form/payment above: its own state, its own Razorpay order,
                                        its own verification. Placing the food order never depends
                                        on this, and this never alters the food order total. */}
                                    <DonationCard />

                                    <Card>
                                        <CardHead icon="✏️" title="Special Instructions" sub="Optional — any requests or notes?" />
                                        <div className="p-4">
                                            <FKTextarea value={form.note} onChange={set("note")} placeholder="Spice level, no onions, extra sauce, gate code..." rows={3} disabled={isClosed || loading} icon={<MessageSquare size={14} strokeWidth={2} />} />
                                        </div>
                                    </Card>

                                    <div className="flex items-center gap-4 rounded-fk-lg border border-fk-border bg-fk-surface-selected px-5 py-4">
                                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-fk-md bg-gradient-to-br from-[var(--fk-accent)] to-[var(--fk-gold)] shadow-fk-sm">
                                            <Smartphone size={18} className="text-white" />
                                        </div>
                                        <div>
                                            <p className="text-[13px] font-black text-fk-text">Get the FoodKnock Web-App</p>
                                            <p className="text-[11px] leading-relaxed text-fk-text-secondary">
                                                Faster checkout · live tracking · exclusive app deals.{" "}
                                                <span className="font-bold text-[var(--fk-accent)]">Coming soon — iOS & Android.</span>
                                            </p>
                                        </div>
                                    </div>

                                    <OrderItemsCard items={items} />

                                    {/* Bill Details — in-flow on mobile only (desktop sees the
                                        same component inside the sticky right sidebar below, never
                                        both at once on the same viewport). */}
                                    <div className="lg:hidden">
                                        <BillDetailsCard
                                            subtotal={subtotal} totalQty={totalQty}
                                            couponDiscount={couponDiscount} appliedCoupon={appliedCoupon}
                                            deliveryFee={deliveryFee} isFirstDeliveryFree={isFirstDeliveryFree}
                                            loyaltyApplied={loyaltyApplied} redeemPts={redeemPts} loyaltyDiscount={loyaltyDiscount}
                                            isCod={isCod} grandTotal={grandTotal} payableTotal={payableTotal}
                                        />
                                    </div>

                                    {cartBlocked && (
                                        <div className="flex items-start gap-2 rounded-fk-md border border-fk-danger/30 bg-fk-danger/10 px-4 py-3 lg:hidden">
                                            <AlertTriangle size={13} className="mt-0.5 shrink-0 text-fk-danger" strokeWidth={2.5} />
                                            <p className="text-[11px] font-bold text-fk-danger">
                                                1 or more items in your cart are unavailable. <Link href="/cart" className="underline">Go to cart</Link> to fix it.
                                            </p>
                                        </div>
                                    )}
                                    {!isClosed && <div className="lg:hidden"><TrustNote isCod={isCod} /></div>}
                                </div>

                                {/* RIGHT (desktop) */}
                                <div className="hidden min-w-0 lg:block">
                                    <div className="sticky top-24 flex min-w-0 w-full flex-col gap-4">
                                        <BillDetailsCard
                                            subtotal={subtotal} totalQty={totalQty}
                                            couponDiscount={couponDiscount} appliedCoupon={appliedCoupon}
                                            deliveryFee={deliveryFee} isFirstDeliveryFree={isFirstDeliveryFree}
                                            loyaltyApplied={loyaltyApplied} redeemPts={redeemPts} loyaltyDiscount={loyaltyDiscount}
                                            isCod={isCod} grandTotal={grandTotal} payableTotal={payableTotal}
                                        />

                                        <div className="rounded-fk-lg border border-fk-border bg-fk-surface-elevated p-4 shadow-fk-md">
                                            {cartBlocked && (
                                                <div className="mb-3 flex items-start gap-2 rounded-fk-md border border-fk-danger/30 bg-fk-danger/10 px-3 py-2.5">
                                                    <AlertTriangle size={13} className="mt-0.5 shrink-0 text-fk-danger" strokeWidth={2.5} />
                                                    <p className="text-[11px] font-bold text-fk-danger">
                                                        1 or more items in your cart are unavailable. <Link href="/cart" className="underline">Go to cart</Link> to fix it.
                                                    </p>
                                                </div>
                                            )}
                                            <PayBtn loading={loading} amount={payableTotal} disabled={isClosed || cartBlocked} isCod={isCod} />
                                            {!isClosed && <TrustNote isCod={isCod} />}
                                            <div className="mt-4 space-y-2 border-t border-fk-border pt-4">
                                                {[
                                                    { icon: ShieldCheck, text: "Payment secured by Razorpay" },
                                                    { icon: Lock,        text: "Your data is never sold or shared" },
                                                    { icon: Flame,       text: "Made fresh after you order" },
                                                    { icon: Clock,       text: "Rider calls you when nearby" },
                                                ].map(({ icon: Icon, text }) => (
                                                    <div key={text} className="flex items-center gap-2 text-[11px] text-fk-text-tertiary">
                                                        <Icon size={11} className="shrink-0 text-fk-gold" strokeWidth={2} />
                                                        {text}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        <UpsellStrip cartIds={cartIds} />

                                        <Link href="/cart" className="flex items-center justify-center gap-2 rounded-fk-lg border border-fk-border bg-fk-surface-elevated py-3 text-sm font-bold text-fk-text-secondary shadow-sm transition-all hover:border-[var(--fk-accent)]/30 hover:bg-fk-surface-selected">
                                            <ChevronRight size={14} className="rotate-180" /> Edit Cart
                                        </Link>
                                    </div>
                                </div>

                            </div>
                        </form>
                    )}
                </div>
            </main>
            {items.length > 0 && (
                <CheckoutStickyBar
                    payableTotal={payableTotal}
                    loading={loading}
                    isClosed={isClosed}
                    cartBlocked={cartBlocked}
                    isCod={isCod}
                />
            )}
            <Footer />
        </>
    );
}
