"use client";

export const dynamic = "force-dynamic";

// src/app/(main)/checkout/page.tsx
// FoodKnock — Razorpay online-only checkout.
// No COD. No self-pickup. Delivery only.
//
// First-order free delivery:
//   • Fetched from /api/delivery/eligibility on mount (read-only, no mutation)
//   • Displayed in the UI before payment (DeliveryBar, order summary, banner)
//   • The actual ₹0 fee is confirmed by create-order which echoes
//     isFirstDeliveryFreeApplied — we use that value for the Razorpay amount
//     so there is no client-side price manipulation.

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter }    from "next/navigation";
import { toast }        from "react-hot-toast";
import Navbar           from "@/components/shared/Navbar";
import Footer           from "@/components/shared/Footer";
import { useCartStore } from "@/store/cartStore";
import Link             from "next/link";
import {
    ShoppingBag, MapPin, Phone, User, MessageSquare,
    ArrowRight, Loader2, ShieldCheck, Clock, Tag,
    CheckCircle2, ChevronRight, Flame, Star, Plus,
    Sparkles, Gift, ChevronDown, ChevronUp, Info,
    Lock, Smartphone, BadgeCheck, Zap, AlertTriangle,
} from "lucide-react";
import {
    MIN_ORDER_AMOUNT, FREE_DELIVERY_AT, PLATFORM_FEE,
    FLAT_DELIVERY_FEE, calculateDeliveryFee, amountToFreeDelivery,
} from "@/lib/delivery";

// ── Razorpay global ──────────────────────────────────────────────────────────
declare global {
    interface Window {
        Razorpay: new (opts: Record<string, unknown>) => {
            open: () => void;
            on:   (event: string, cb: (r: unknown) => void) => void;
        };
    }
}

// ─── Types ───────────────────────────────────────────────────────────────────
type FormState = {
    customerName: string;
    phone:        string;
    address:      string;
    landmark:     string;
    note:         string;
};

type LoyaltyInfo = {
    balance:          number;
    pointValueInr:    number;
    minRedeem:        number;
    maxRedemptionPct: number;
};

// ─── Upsell items ────────────────────────────────────────────────────────────
const UPSELL_ITEMS = [
    { _id: "u1", name: "Cheese Fries", price: 60, category: "fries",  image: "https://images.unsplash.com/photo-1576107232684-1279f04dbf46?w=300&q=80&auto=format&fit=crop", stock: 10 },
    { _id: "u2", name: "Cold Coffee",  price: 70, category: "coffee", image: "https://images.unsplash.com/photo-1461023058943-07fcbe16d735?w=300&q=80&auto=format&fit=crop", stock: 10 },
    { _id: "u3", name: "Garlic Bread", price: 50, category: "snacks", image: "https://images.unsplash.com/photo-1619535860434-cf9b902a0b5e?w=300&q=80&auto=format&fit=crop", stock: 10 },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────
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

function loadRazorpay(): Promise<boolean> {
    return new Promise((resolve) => {
        if (typeof window !== "undefined" && window.Razorpay) { resolve(true); return; }
        const s = document.createElement("script");
        s.src = "https://checkout.razorpay.com/v1/checkout.js";
        s.onload  = () => resolve(true);
        s.onerror = () => resolve(false);
        document.body.appendChild(s);
    });
}

function clientMaxRedeemable(total: number, balance: number, pct: number, val: number): number {
    return Math.min(balance, Math.floor((total * pct) / val));
}

// ─── UI atoms ────────────────────────────────────────────────────────────────
function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
    return (
        <div className={`overflow-hidden rounded-3xl border border-stone-100 bg-white shadow-sm ${className}`}>
            {children}
        </div>
    );
}

function CardHead({ icon, title, sub }: { icon: string; title: string; sub?: string }) {
    return (
        <div className="border-b border-stone-100 bg-gradient-to-r from-orange-50/70 to-red-50/40 px-5 py-4">
            <div className="flex items-center gap-3">
                <span className="text-xl leading-none">{icon}</span>
                <div>
                    <p className="text-[13px] font-black tracking-tight text-stone-900">{title}</p>
                    {sub && <p className="text-[11px] text-stone-500">{sub}</p>}
                </div>
            </div>
        </div>
    );
}

function FKInput({ value, onChange, placeholder, type = "text", autoComplete, required, icon, disabled }: {
    value: string; onChange: (v: string) => void; placeholder: string;
    type?: string; autoComplete?: string; required?: boolean; icon?: React.ReactNode; disabled?: boolean;
}) {
    return (
        <div className="relative flex items-center">
            {icon && <span className="pointer-events-none absolute left-3.5 text-stone-400">{icon}</span>}
            <input
                type={type} value={value} onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder} autoComplete={autoComplete} required={required}
                disabled={disabled}
                className={`w-full rounded-2xl border border-stone-200 bg-stone-50/60 py-3.5 text-sm font-medium text-stone-800 placeholder:text-stone-400 transition-all focus:border-orange-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-100 hover:border-stone-300 disabled:cursor-not-allowed disabled:opacity-60 ${icon ? "pl-10 pr-4" : "px-4"}`}
            />
        </div>
    );
}

function FKTextarea({ value, onChange, placeholder, rows = 3, icon, disabled }: {
    value: string; onChange: (v: string) => void; placeholder: string; rows?: number; icon?: React.ReactNode; disabled?: boolean;
}) {
    return (
        <div className="relative">
            {icon && <span className="pointer-events-none absolute left-3.5 top-3.5 text-stone-400">{icon}</span>}
            <textarea
                value={value} onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder} rows={rows}
                disabled={disabled}
                className={`w-full resize-none rounded-2xl border border-stone-200 bg-stone-50/60 py-3.5 text-sm font-medium text-stone-800 placeholder:text-stone-400 transition-all focus:border-orange-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-100 hover:border-stone-300 disabled:cursor-not-allowed disabled:opacity-60 ${icon ? "pl-10 pr-4" : "px-4"}`}
            />
        </div>
    );
}

// ─── First-order free delivery banner ─────────────────────────────────────────
function FirstDeliveryFreeBanner() {
    return (
        <div className="flex items-center gap-4 rounded-3xl border border-emerald-200 bg-gradient-to-r from-emerald-50 to-green-50 px-5 py-4 shadow-sm">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-emerald-200 bg-white shadow-sm">
                <Gift size={20} className="text-emerald-600" strokeWidth={2} />
            </div>
            <div>
                <p className="text-[13px] font-black text-emerald-800">
                    🎁 Your first order includes FREE delivery!
                </p>
                <p className="mt-0.5 text-[11.5px] text-emerald-600">
                    Delivery fee waived — a welcome gift from FoodKnock.
                </p>
            </div>
        </div>
    );
}

// ─── Shop closed banner ───────────────────────────────────────────────────────
function ShopClosedBanner() {
    return (
        <div className="flex items-start gap-4 rounded-3xl border border-red-200 bg-gradient-to-r from-red-50 to-rose-50 px-5 py-5 shadow-sm">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-red-100">
                <AlertTriangle size={20} className="text-red-600" strokeWidth={2} />
            </div>
            <div>
                <p className="text-[14px] font-black text-red-800">Shop is currently closed</p>
                <p className="mt-1 text-[12px] leading-relaxed text-red-600">
                    We're not accepting orders right now. Please check back soon — we'll be open again shortly!
                </p>
            </div>
        </div>
    );
}

// ─── Progress ────────────────────────────────────────────────────────────────
function Steps() {
    return (
        <div className="flex items-center justify-center">
            {[
                { label: "Cart",      done: true,  active: false },
                { label: "Checkout",  done: false, active: true  },
                { label: "Confirmed", done: false, active: false },
            ].map((s, i) => (
                <div key={s.label} className="flex items-center">
                    {i > 0 && <div className={`mx-2 h-px w-8 ${i === 1 ? "bg-gradient-to-r from-emerald-300 to-orange-300" : "bg-stone-200"}`} />}
                    <div className="flex items-center gap-1.5">
                        <div className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-black ${
                            s.done   ? "bg-emerald-500 text-white shadow-sm shadow-emerald-200" :
                            s.active ? "bg-gradient-to-br from-orange-500 to-red-500 text-white shadow-sm shadow-orange-200" :
                                       "border-2 border-stone-200 bg-white text-stone-400"
                        }`}>
                            {s.done ? <CheckCircle2 size={13} strokeWidth={3} /> : i + 1}
                        </div>
                        <span className={`text-[11px] font-black ${s.done ? "text-emerald-600" : s.active ? "text-orange-600" : "text-stone-400"}`}>
                            {s.label}
                        </span>
                    </div>
                </div>
            ))}
        </div>
    );
}

// ─── Delivery progress bar ────────────────────────────────────────────────────
function DeliveryBar({
    subtotal,
    isFirstDeliveryFree,
}: {
    subtotal: number;
    isFirstDeliveryFree: boolean;
}) {
    // First-order perk: always show FREE, no progress bar needed
    if (isFirstDeliveryFree) {
        return (
            <div className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                <Gift size={17} className="shrink-0 text-emerald-600" strokeWidth={2.5} />
                <div>
                    <p className="text-[12px] font-black text-emerald-800">
                        🎁 First order — delivery is FREE!
                    </p>
                    <p className="text-[11px] text-emerald-600">
                        Welcome to FoodKnock 🎉
                    </p>
                </div>
            </div>
        );
    }

    if (subtotal >= FREE_DELIVERY_AT) {
        return (
            <div className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                <span className="text-xl">🎉</span>
                <div>
                    <p className="text-[12px] font-black text-emerald-800">Free delivery unlocked!</p>
                    <p className="text-[11px] text-emerald-600">Enjoy complimentary delivery on this order</p>
                </div>
            </div>
        );
    }

    const pct  = Math.min((subtotal / FREE_DELIVERY_AT) * 100, 100);
    const need = amountToFreeDelivery(subtotal);
    return (
        <div className="rounded-2xl border border-orange-100 bg-orange-50/70 px-4 py-3">
            <div className="mb-2 flex items-center justify-between">
                <p className="text-[12px] font-black text-stone-800">
                    Add <span className="text-orange-600">₹{need}</span> for{" "}
                    <span className="text-emerald-600">free delivery</span>
                </p>
                <p className="text-[10px] font-bold text-stone-400">₹{subtotal} / ₹{FREE_DELIVERY_AT}</p>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-orange-100">
                <div className="h-full rounded-full bg-gradient-to-r from-orange-500 to-red-400 transition-all duration-700" style={{ width: `${pct}%` }} />
            </div>
        </div>
    );
}

// ─── Upsell ───────────────────────────────────────────────────────────────────
function UpsellStrip({ cartIds }: { cartIds: string[] }) {
    const addItem = useCartStore((s) => s.addItem);
    const [added, setAdded] = useState<Record<string, boolean>>({});
    const show = UPSELL_ITEMS.filter((u) => !cartIds.includes(u._id));
    if (!show.length) return null;

    const go = (item: typeof UPSELL_ITEMS[0]) => {
        addItem({ _id: item._id, name: item.name, price: item.price, image: item.image, quantity: 1, stock: item.stock, category: item.category });
        setAdded((p) => ({ ...p, [item._id]: true }));
        toast.success(`${item.name} added!`, { style: { background: "#fff7ed", color: "#9a3412", border: "1px solid #fed7aa", borderRadius: "12px" } });
        setTimeout(() => setAdded((p) => ({ ...p, [item._id]: false })), 1800);
    };
    return (
        <Card>
            <CardHead icon="⚡" title="Add to your order" sub="Frequently ordered together" />
            <div className="p-4">
                <div className="grid grid-cols-3 gap-3">
                    {show.map((item) => (
                        <div key={item._id} className="group flex flex-col overflow-hidden rounded-2xl border border-stone-100 shadow-sm transition-all hover:border-orange-200 hover:shadow-md">
                            <div className="relative h-20 overflow-hidden bg-stone-50">
                                <img src={item.image} alt={item.name} loading="lazy"
                                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                                    onError={(e) => { (e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=200&q=75&auto=format&fit=crop"; }} />
                            </div>
                            <div className="flex flex-1 flex-col p-2.5">
                                <p className="line-clamp-1 text-[11px] font-black text-stone-800">{item.name}</p>
                                <p className="mt-0.5 text-[11px] font-black text-orange-600">₹{item.price}</p>
                                <button type="button" onClick={() => go(item)} disabled={added[item._id]}
                                    className={`mt-2 flex w-full items-center justify-center gap-1 rounded-xl py-1.5 text-[10px] font-black transition-all ${added[item._id] ? "bg-emerald-500 text-white" : "bg-gradient-to-r from-orange-500 to-red-500 text-white hover:brightness-110 active:scale-95"}`}>
                                    {added[item._id] ? "✓ Added" : <><Plus size={9} strokeWidth={3} />Add</>}
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </Card>
    );
}

// ─── Empty cart ───────────────────────────────────────────────────────────────
function EmptyCart() {
    return (
        <div className="flex flex-col items-center rounded-3xl border border-stone-100 bg-white px-6 py-24 text-center shadow-sm">
            <div className="relative mb-6 flex h-20 w-20 items-center justify-center rounded-3xl border border-orange-100 bg-gradient-to-br from-orange-50 to-red-50">
                <ShoppingBag size={36} className="text-orange-400" strokeWidth={1.5} />
                <span className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-orange-500 to-red-500 text-[10px] font-black text-white shadow-md">0</span>
            </div>
            <h2 className="text-2xl font-black text-stone-900">Your cart is empty</h2>
            <p className="mt-2 max-w-xs text-sm leading-relaxed text-stone-500">
                Hunger hasn't knocked yet? Explore our menu and fill up your cart!
            </p>
            <Link href="/menu" className="group mt-7 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-orange-500 to-red-500 px-8 py-3.5 text-sm font-black text-white shadow-lg shadow-orange-200/60 transition-all hover:brightness-110 active:scale-95">
                Browse Menu <ArrowRight size={15} className="transition-transform group-hover:translate-x-1" />
            </Link>
        </div>
    );
}

// ─── Loyalty card ─────────────────────────────────────────────────────────────
function LoyaltyCard({
    loyalty, grandTotal, pts, onPts, applied, onApply, onRemove, applying,
}: {
    loyalty: LoyaltyInfo; grandTotal: number; pts: number; onPts: (n: number) => void;
    applied: boolean; onApply: () => void; onRemove: () => void; applying: boolean;
}) {
    const [open, setOpen] = useState(false);
    const max    = clientMaxRedeemable(grandTotal, loyalty.balance, loyalty.maxRedemptionPct, loyalty.pointValueInr);
    const rupees = Number((pts * loyalty.pointValueInr).toFixed(0));
    const canUse = loyalty.balance >= loyalty.minRedeem && max > 0;

    useEffect(() => { if (canUse && !applied) setOpen(true); }, [canUse]);
    if (!loyalty.balance) return null;

    return (
        <Card>
            <button type="button" onClick={() => setOpen((o) => !o)}
                className="flex w-full items-center justify-between gap-3 border-b border-stone-100 bg-gradient-to-r from-violet-50/80 to-purple-50/50 px-5 py-4 text-left transition-colors hover:from-violet-100/60">
                <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 shadow-sm shadow-violet-200">
                        <Sparkles size={15} className="text-white" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <p className="text-[13px] font-black text-stone-900">FoodKnock Rewards</p>
                            {applied && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-black text-emerald-700">
                                    <CheckCircle2 size={9} strokeWidth={3} /> Applied
                                </span>
                            )}
                        </div>
                        <p className="text-[11px] text-stone-500">
                            {applied
                                ? `−₹${rupees} saved on this order`
                                : `${loyalty.balance} pts · worth ₹${(loyalty.balance * loyalty.pointValueInr).toFixed(0)}`
                            }
                        </p>
                    </div>
                </div>
                {open ? <ChevronUp size={16} className="shrink-0 text-stone-400" /> : <ChevronDown size={16} className="shrink-0 text-stone-400" />}
            </button>

            {open && (
                <div className="space-y-4 p-5">
                    {applied ? (
                        <div className="flex items-center justify-between rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                            <div className="flex items-center gap-3">
                                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100">
                                    <Gift size={15} className="text-emerald-600" />
                                </div>
                                <div>
                                    <p className="text-sm font-black text-emerald-800">{pts} pts redeemed</p>
                                    <p className="text-[11px] text-emerald-600">You save ₹{rupees} on this order 🎉</p>
                                </div>
                            </div>
                            <button type="button" onClick={onRemove}
                                className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-[11px] font-black text-rose-600 transition-colors hover:bg-rose-100">
                                Remove
                            </button>
                        </div>
                    ) : canUse ? (
                        <div className="space-y-4">
                            <div>
                                <div className="mb-2 flex items-center justify-between">
                                    <p className="text-[11px] font-black text-stone-700">Points to use</p>
                                    <div className="flex items-center gap-1">
                                        <span className="font-mono text-lg font-black text-violet-600">{pts}</span>
                                        <span className="text-[10px] text-stone-400">pts</span>
                                        <span className="mx-1.5 text-stone-200">·</span>
                                        <span className="text-[12px] font-black text-emerald-600">−₹{rupees}</span>
                                    </div>
                                </div>
                                <input type="range" min={loyalty.minRedeem} max={max} step={1} value={pts}
                                    onChange={(e) => onPts(Number(e.target.value))}
                                    className="w-full accent-violet-500" />
                                <div className="mt-1 flex justify-between text-[10px] text-stone-400">
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
                                            className={`rounded-full border px-3 py-1 text-[11px] font-black transition-all ${pts === v ? "border-violet-400 bg-violet-100 text-violet-700" : "border-stone-200 bg-stone-50 text-stone-600 hover:border-violet-300"}`}>
                                            {pct}%
                                        </button>
                                    );
                                })}
                                <button type="button" onClick={() => onPts(max)}
                                    className={`rounded-full border px-3 py-1 text-[11px] font-black transition-all ${pts === max ? "border-violet-400 bg-violet-100 text-violet-700" : "border-stone-200 bg-stone-50 text-stone-600 hover:border-violet-300"}`}>
                                    Max
                                </button>
                            </div>
                            <button type="button" onClick={onApply} disabled={applying || pts < loyalty.minRedeem}
                                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-violet-500 to-purple-600 py-3 text-[13px] font-black text-white shadow-md shadow-violet-100 transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-60">
                                {applying ? <Loader2 size={15} className="animate-spin" /> : <><Sparkles size={14} /> Use {pts} pts · save ₹{rupees}</>}
                            </button>
                            <p className="text-center text-[10px] text-stone-400">1 pt = ₹{loyalty.pointValueInr} · max 20% of order value</p>
                        </div>
                    ) : (
                        <div className="flex items-start gap-3 rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3">
                            <Info size={14} className="mt-0.5 shrink-0 text-amber-500" />
                            <p className="text-[12px] text-stone-600">
                                You need <strong>{loyalty.minRedeem} pts</strong> to redeem. You have <strong>{loyalty.balance} pts</strong> — keep ordering to earn more!
                            </p>
                        </div>
                    )}
                </div>
            )}
        </Card>
    );
}

// ─── Pay button + trust note ──────────────────────────────────────────────────
function PayBtn({ loading, amount, disabled }: { loading: boolean; amount: number; disabled?: boolean }) {
    return (
        <button type="submit" disabled={loading || disabled}
            className="group relative flex w-full items-center justify-center gap-2.5 overflow-hidden rounded-2xl bg-gradient-to-r from-orange-500 via-orange-500 to-red-500 py-4 text-[15px] font-black text-white shadow-lg shadow-orange-300/40 transition-all hover:shadow-orange-300/60 hover:brightness-105 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70"
        >
            <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
            {loading
                ? <Loader2 size={18} className="animate-spin" />
                : <><Lock size={15} strokeWidth={2.5} /> Pay ₹{amount} Securely <ArrowRight size={15} className="ml-0.5 transition-transform group-hover:translate-x-0.5" /></>
            }
        </button>
    );
}

function TrustNote() {
    return (
        <div className="mt-3 space-y-1 text-center">
            <p className="text-[11px] text-stone-400">
                🔒 <span className="font-bold text-stone-500">Razorpay</span> secured · UPI · Cards · Net Banking · Wallets
            </p>
            <p className="text-[10px] text-stone-300">No payment details stored on our servers</p>
        </div>
    );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function CheckoutPage() {
    const router = useRouter();

    const items     = useCartStore((s) => s.items);
    const clearCart = useCartStore((s) => s.clearCart);
    const subtotal  = useCartStore((s) => s.getTotalPrice());
    const totalQty  = items.reduce((s, i) => s + i.quantity, 0);
    const cartIds   = items.map((i) => i._id);

    const [form, setForm] = useState<FormState>({ customerName: "", phone: "", address: "", landmark: "", note: "" });
    const [loading, setLoading] = useState(false);

    // ── Shop status ──────────────────────────────────────────────────────────
    const [shopOpen, setShopOpen]   = useState<boolean | null>(null);
    const shopStatusFetched         = useRef(false);

    // ── First-order free delivery ────────────────────────────────────────────
    // Fetched once on mount for UI display.
    // The ACTUAL fee is confirmed by create-order (server-side) — we use
    // isFirstDeliveryFreeApplied from its response for the Razorpay amount.
    const [isFirstDeliveryFree, setIsFirstDeliveryFree] = useState(false);
    const eligibilityFetched = useRef(false);

    // Loyalty state
    const [loyalty,         setLoyalty]         = useState<LoyaltyInfo | null>(null);
    const [redeemPts,       setRedeemPts]       = useState(0);
    const [loyaltyApplied,  setLoyaltyApplied]  = useState(false);
    const [loyaltyDiscount, setLoyaltyDiscount] = useState(0);
    const [applyingLoyalty, setApplyingLoyalty] = useState(false);
    const loyaltyFetched = useRef(false);

    // Display-side fee calculation — uses local eligibility check
    const deliveryFee  = isFirstDeliveryFree ? 0 : calculateDeliveryFee(subtotal);
    const grandTotal   = subtotal + deliveryFee + PLATFORM_FEE;
    const payableTotal = Math.max(0, grandTotal - loyaltyDiscount);

    const set = (k: keyof FormState) => (v: string) => setForm((p) => ({ ...p, [k]: v }));

    useEffect(() => {
        const pf = tryPrefill();
        if (Object.keys(pf).length) setForm((p) => ({ ...p, ...pf }));
    }, []);

    useEffect(() => {
        fetch("/api/auth/me").then((r) => { if (!r.ok) router.push("/auth?redirect=/checkout"); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ── Fetch shop status ────────────────────────────────────────────────────
    useEffect(() => {
        if (shopStatusFetched.current) return;
        shopStatusFetched.current = true;
        fetch("/api/shop/status")
            .then((r) => r.ok ? r.json() : { isOpen: true })
            .then((d) => {
                const open = d?.isOpen ?? true;
                setShopOpen(open);
                if (!open) {
                    toast.error("Shop is currently closed", {
                        duration: 5000,
                        style: { background: "#fef2f2", color: "#991b1b", border: "1px solid #fecaca", borderRadius: "12px" },
                    });
                }
            })
            .catch(() => setShopOpen(true));
    }, []);

    // ── Fetch first-order free delivery eligibility ──────────────────────────
    useEffect(() => {
        if (eligibilityFetched.current) return;
        eligibilityFetched.current = true;
        fetch("/api/delivery/eligibility", { credentials: "include" })
            .then((r) => r.ok ? r.json() : { eligible: false })
            .then((d) => { if (d.eligible) setIsFirstDeliveryFree(true); })
            .catch(() => {});
    }, []);

    // ── Loyalty ──────────────────────────────────────────────────────────────
    useEffect(() => {
        if (loyaltyFetched.current) return;
        loyaltyFetched.current = true;
        fetch("/api/loyalty", { credentials: "include" })
            .then((r) => r.ok ? r.json() : null)
            .then((d) => {
                if (d?.success && d.balance > 0) {
                    const info: LoyaltyInfo = {
                        balance: d.balance, pointValueInr: d.pointValueInr ?? 0.5,
                        minRedeem: d.minRedeem ?? 50, maxRedemptionPct: d.maxRedemptionPct ?? 0.20,
                    };
                    setLoyalty(info);
                    const mx = clientMaxRedeemable(grandTotal, d.balance, info.maxRedemptionPct, info.pointValueInr);
                    if (mx >= info.minRedeem) setRedeemPts(mx);
                }
            })
            .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (!loyalty || loyaltyApplied) return;
        const mx = clientMaxRedeemable(grandTotal, loyalty.balance, loyalty.maxRedemptionPct, loyalty.pointValueInr);
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

    const handleRemoveLoyalty = useCallback(() => { setLoyaltyApplied(false); setLoyaltyDiscount(0); }, []);

    const redeemAfterOrder = async (orderId: string) => {
        if (!loyaltyApplied || redeemPts <= 0 || !loyalty) return;
        try {
            await fetch("/api/loyalty", {
                method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
                body: JSON.stringify({ pointsToRedeem: redeemPts, orderTotal: grandTotal, orderId }),
            });
        } catch { /* non-fatal */ }
    };

    const buildPayload = (extra: Record<string, unknown> = {}) => ({
        paymentMethod: "razorpay",
        customerName:  form.customerName.trim(),
        phone:         form.phone.trim(),
        address:       form.address.trim(),
        landmark:      form.landmark.trim(),
        note:          form.note.trim(),
        orderType:     "delivery",
        items:         items.map((i) => ({ _id: i._id, name: i.name, price: i.price, quantity: i.quantity, image: i.image })),
        ...extra,
    });

    const validate = (): boolean => {
        if (shopOpen === false) { toast.error("Shop is currently closed. Orders are not being accepted."); return false; }
        if (!form.customerName.trim())                            { toast.error("Please enter your name");                          return false; }
        if (!form.phone.trim() || form.phone.trim().length < 10) { toast.error("Enter a valid 10-digit phone number");             return false; }
        if (!form.address.trim())                                 { toast.error("Please enter your delivery address");              return false; }
        if (!items.length)                                        { toast.error("Your cart is empty");                              return false; }
        if (subtotal < MIN_ORDER_AMOUNT)                          { toast.error(`Minimum order amount is ₹${MIN_ORDER_AMOUNT}`);    return false; }
        return true;
    };

    const handlePay = async () => {
        const loaded = await loadRazorpay();
        if (!loaded) { toast.error("Payment gateway unavailable. Please retry."); setLoading(false); return; }

        const cr = await fetch("/api/payment/create-order", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ orderType: "delivery", items: items.map((i) => ({ price: i.price, quantity: i.quantity })) }),
        });
        const cd = await cr.json();
        if (!cr.ok || !cd.success) { toast.error(cd.message || "Could not initialise payment"); setLoading(false); return; }

        // If create-order confirmed first-free-delivery, sync the display
        // (handles edge case where eligibility changed between page load and payment)
        if (cd.isFirstDeliveryFreeApplied && !isFirstDeliveryFree) {
            setIsFirstDeliveryFree(true);
        }

        const rzp = new window.Razorpay({
            key:         cd.keyId,
            // Use the server-confirmed amount — NOT our client-side calculation
            amount:      cd.amount * 100,
            currency:    "INR",
            name:        "FoodKnock",
            description: "Food Delivery",
            image:       "/logo.png",
            order_id:    cd.razorpayOrderId,
            prefill:     { name: form.customerName, contact: form.phone },
            theme:       { color: "#f97316" },
            handler: async (response: unknown) => {
                const rp = response as { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string };
                const vr = await fetch("/api/payment/verify", {
                    method: "POST", headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(buildPayload({
                        razorpayOrderId:   rp.razorpay_order_id,
                        razorpayPaymentId: rp.razorpay_payment_id,
                        razorpaySignature: rp.razorpay_signature,
                    })),
                });
                const vd = await vr.json();
                if (!vr.ok || !vd.success) { toast.error(vd.message || "Payment verification failed"); setLoading(false); return; }
                await redeemAfterOrder(vd.orderId);
                clearCart();
                router.push(`/order-success?orderId=${vd.orderId}`);
            },
            modal: { ondismiss: () => { toast("Payment cancelled", { icon: "ℹ️" }); setLoading(false); } },
        });
        rzp.open();
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!validate()) return;
        setLoading(true);
        try { await handlePay(); } catch { toast.error("Something went wrong. Please retry."); setLoading(false); }
    };

    const isClosed = shopOpen === false;

    return (
        <>
            <Navbar />
            <main className="min-h-screen bg-[#FAFAF9]">

                {/* ── Hero header ── */}
                <div className="relative overflow-hidden border-b border-stone-100 bg-white">
                    <div className="pointer-events-none absolute inset-0"
                        style={{ background: "radial-gradient(ellipse 90% 50% at 50% -10%, #ffedd5 0%, transparent 70%)" }} />
                    <div className="relative mx-auto max-w-6xl px-4 pb-7 pt-10 md:px-8">
                        <div className="mb-5"><Steps /></div>
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <p className="mb-1 text-[11px] font-black uppercase tracking-[0.2em] text-orange-500">FoodKnock</p>
                                <h1 className="text-3xl font-black tracking-tight text-stone-900 md:text-4xl">
                                    Almost there! 🍽️
                                </h1>
                                {items.length > 0 && (
                                    <p className="mt-1.5 text-sm font-medium text-stone-500">
                                        {totalQty} item{totalQty !== 1 ? "s" : ""} · fill in your details and pay
                                    </p>
                                )}
                            </div>
                            <div className="hidden shrink-0 rounded-2xl border border-orange-100 bg-orange-50/60 px-4 py-3 text-right sm:block">
                                <p className="text-[12px] font-bold italic text-stone-600">"When Hunger Knocks,</p>
                                <p className="text-[12px] font-bold italic text-orange-600">FoodKnock Delivers."</p>
                            </div>
                        </div>
                        <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2">
                            {[
                                { icon: Lock,       text: "256-bit SSL encrypted"  },
                                { icon: BadgeCheck, text: "Razorpay verified"       },
                                { icon: Zap,        text: "Pay in under 30 seconds" },
                                { icon: Clock,      text: "Live order tracking"     },
                            ].map(({ icon: Icon, text }) => (
                                <div key={text} className="flex items-center gap-1.5 text-[11px] font-semibold text-stone-400">
                                    <Icon size={11} className="text-orange-400" strokeWidth={2.5} />
                                    {text}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* ── Body ── */}
                <div className="mx-auto max-w-6xl px-4 py-8 md:px-8 md:py-10">
                    {items.length === 0 ? <EmptyCart /> : (
                        <form onSubmit={handleSubmit} noValidate>
                            <div className="grid gap-5 lg:grid-cols-[1fr_380px] xl:grid-cols-[1fr_400px]">

                                {/* ══ LEFT ══ */}
                                <div className="flex flex-col gap-5">

                                    {/* Banners */}
                                    {isClosed && <ShopClosedBanner />}
                                    {!isClosed && isFirstDeliveryFree && <FirstDeliveryFreeBanner />}

                                    {/* 1 · Contact */}
                                    <Card>
                                        <CardHead icon="👤" title="Your Details" sub="We use this to confirm and deliver your order" />
                                        <div className="space-y-4 p-5">
                                            <div className="flex flex-col gap-1.5">
                                                <label className="text-[11px] font-black uppercase tracking-[0.18em] text-stone-500">Full Name <span className="text-orange-500">*</span></label>
                                                <FKInput value={form.customerName} onChange={set("customerName")} placeholder="Your full name" autoComplete="name" required disabled={isClosed} icon={<User size={14} strokeWidth={2} />} />
                                            </div>
                                            <div className="flex flex-col gap-1.5">
                                                <label className="text-[11px] font-black uppercase tracking-[0.18em] text-stone-500">Mobile Number <span className="text-orange-500">*</span></label>
                                                <FKInput value={form.phone} onChange={set("phone")} placeholder="10-digit mobile number" type="tel" autoComplete="tel" required disabled={isClosed} icon={<Phone size={14} strokeWidth={2} />} />
                                                <p className="text-[11px] text-stone-400">📞 Our rider will call on this number when out for delivery.</p>
                                            </div>
                                        </div>
                                    </Card>

                                    {/* 2 · Address */}
                                    <Card>
                                        <CardHead icon="📍" title="Delivery Address" sub="Tell us where to knock" />
                                        <div className="space-y-4 p-5">
                                            <DeliveryBar subtotal={subtotal} isFirstDeliveryFree={isFirstDeliveryFree} />
                                            <div className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-2.5">
                                                <p className="text-[11px] font-medium text-blue-700">
                                                    e.g. House 12, Shanti Nagar, Near Main Gate, Danta, Sikar 332702
                                                </p>
                                            </div>
                                            <div className="flex flex-col gap-1.5">
                                                <label className="text-[11px] font-black uppercase tracking-[0.18em] text-stone-500">Full Address <span className="text-orange-500">*</span></label>
                                                <FKTextarea value={form.address} onChange={set("address")} placeholder="House no., Street, Colony, City..." rows={2} disabled={isClosed} icon={<MapPin size={14} strokeWidth={2} />} />
                                            </div>
                                            <div className="flex flex-col gap-1.5">
                                                <label className="text-[11px] font-black uppercase tracking-[0.18em] text-stone-500">
                                                    Landmark <span className="font-medium normal-case tracking-normal text-stone-300">(optional)</span>
                                                </label>
                                                <FKInput value={form.landmark} onChange={set("landmark")} placeholder="Near school, temple, petrol pump..." disabled={isClosed} icon={<Tag size={14} strokeWidth={2} />} />
                                            </div>
                                        </div>
                                    </Card>

                                    {/* 3 · Loyalty */}
                                    {loyalty && (
                                        <LoyaltyCard
                                            loyalty={loyalty} grandTotal={grandTotal}
                                            pts={redeemPts} onPts={setRedeemPts}
                                            applied={loyaltyApplied} onApply={handleApplyLoyalty}
                                            onRemove={handleRemoveLoyalty} applying={applyingLoyalty}
                                        />
                                    )}

                                    {/* 4 · Special instructions */}
                                    <Card>
                                        <CardHead icon="✏️" title="Special Instructions" sub="Optional — any requests or notes?" />
                                        <div className="p-5">
                                            <FKTextarea value={form.note} onChange={set("note")} placeholder="Spice level, no onions, extra sauce, gate code..." rows={3} disabled={isClosed} icon={<MessageSquare size={14} strokeWidth={2} />} />
                                        </div>
                                    </Card>

                                    {/* 5 · App nudge */}
                                    <div className="flex items-center gap-4 rounded-3xl border border-orange-100 bg-gradient-to-r from-orange-50/80 to-red-50/60 px-5 py-4">
                                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500 to-red-500 shadow-md shadow-orange-200">
                                            <Smartphone size={18} className="text-white" />
                                        </div>
                                        <div>
                                            <p className="text-[13px] font-black text-stone-900">Get the FoodKnock Web-App</p>
                                            <p className="text-[11px] leading-relaxed text-stone-500">
                                                Faster checkout · live tracking · exclusive app deals.{" "}
                                                <span className="font-bold text-orange-600">Coming soon — iOS & Android.</span>
                                            </p>
                                        </div>
                                    </div>

                                    {/* Mobile sticky CTA */}
                                    <div className="block lg:hidden">
                                        <div className="rounded-3xl border border-orange-100 bg-white p-5 shadow-lg shadow-orange-100/40">
                                            <div className="mb-4">
                                                <p className="text-[11px] font-semibold text-stone-500">
                                                    {totalQty} item{totalQty !== 1 ? "s" : ""} ·{" "}
                                                    {deliveryFee === 0 ? "Free delivery 🎉" : `₹${deliveryFee} delivery`}
                                                </p>
                                                {isFirstDeliveryFree && (
                                                    <p className="text-[11px] font-black text-emerald-600">🎁 First order — delivery FREE!</p>
                                                )}
                                                {loyaltyApplied && (
                                                    <p className="text-[11px] font-black text-emerald-600">−₹{loyaltyDiscount} reward applied ✓</p>
                                                )}
                                                <div className="flex items-baseline gap-2">
                                                    {loyaltyApplied && <p className="text-sm font-bold text-stone-400 line-through">₹{grandTotal}</p>}
                                                    <p className="text-2xl font-black text-orange-600">₹{payableTotal}</p>
                                                </div>
                                            </div>
                                            <PayBtn loading={loading} amount={payableTotal} disabled={isClosed} />
                                            {!isClosed && <TrustNote />}
                                        </div>
                                    </div>
                                </div>

                                {/* ══ RIGHT (desktop) ══ */}
                                <div className="hidden lg:block">
                                    <div className="sticky top-24 flex flex-col gap-4">
                                        <div className="overflow-hidden rounded-3xl border border-orange-100 bg-white shadow-xl shadow-orange-100/30">
                                            <div className="border-b border-stone-100 bg-gradient-to-r from-orange-50/70 to-red-50/40 px-5 py-4">
                                                <p className="text-lg font-black text-stone-900">Order Summary</p>
                                                <p className="text-[11px] text-stone-500">{totalQty} item{totalQty !== 1 ? "s" : ""} · delivery only</p>
                                            </div>
                                            <div className="p-5">
                                                {/* Items */}
                                                <div className="space-y-3">
                                                    {items.map((item) => (
                                                        <div key={item._id} className="flex items-center gap-3">
                                                            <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl border border-stone-100 bg-stone-50">
                                                                <img src={item.image} alt={item.name} loading="lazy" className="h-full w-full object-cover"
                                                                    onError={(e) => { (e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=100&q=75&auto=format&fit=crop"; }} />
                                                                <span className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-orange-500 px-1 text-[9px] font-black text-white">{item.quantity}</span>
                                                            </div>
                                                            <div className="flex min-w-0 flex-1 items-center justify-between gap-2">
                                                                <p className="truncate text-[13px] font-bold text-stone-700">{item.name}</p>
                                                                <p className="shrink-0 text-sm font-black text-orange-600">₹{item.price * item.quantity}</p>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>

                                                <div className="my-4 h-px bg-stone-100" />

                                                {/* Pricing */}
                                                <div className="space-y-2.5 text-sm">
                                                    <div className="flex justify-between">
                                                        <span className="text-stone-500">Subtotal ({totalQty} items)</span>
                                                        <span className="font-bold text-stone-700">₹{subtotal}</span>
                                                    </div>
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex items-center gap-1.5">
                                                            <span className="text-stone-500">Delivery</span>
                                                            {deliveryFee === 0 && (
                                                                isFirstDeliveryFree ? (
                                                                    <span className="flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[9px] font-black text-emerald-700">
                                                                        <Gift size={8} strokeWidth={3} /> FREE
                                                                    </span>
                                                                ) : (
                                                                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-black text-emerald-700">FREE</span>
                                                                )
                                                            )}
                                                        </div>
                                                        <span className={`font-bold ${deliveryFee === 0 ? "text-emerald-600" : "text-stone-700"}`}>
                                                            {deliveryFee === 0 ? "₹0" : `₹${deliveryFee}`}
                                                        </span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span className="text-stone-500">Platform Fee</span>
                                                        <span className="font-bold text-stone-700">₹{PLATFORM_FEE}</span>
                                                    </div>
                                                    {/* First-order saving line */}
                                                    {isFirstDeliveryFree && (
                                                        <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2">
                                                            <div className="flex items-center gap-1.5">
                                                                <Gift size={11} className="text-emerald-600" />
                                                                <span className="font-black text-emerald-700">First Order Perk</span>
                                                            </div>
                                                            <span className="font-black text-emerald-700">−₹{FLAT_DELIVERY_FEE}</span>
                                                        </div>
                                                    )}
                                                    {loyaltyApplied && (
                                                        <div className="flex items-center justify-between rounded-xl border border-violet-200 bg-violet-50 px-3 py-2">
                                                            <div className="flex items-center gap-1.5">
                                                                <Sparkles size={11} className="text-violet-600" />
                                                                <span className="font-black text-violet-700">Rewards Discount</span>
                                                                <span className="rounded-full bg-violet-200 px-1.5 py-0.5 text-[9px] font-bold text-violet-700">{redeemPts} pts</span>
                                                            </div>
                                                            <span className="font-black text-violet-700">−₹{loyaltyDiscount}</span>
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="my-4 h-px bg-stone-100" />

                                                <div className="flex items-center justify-between">
                                                    <span className="text-base font-black text-stone-900">Total Payable</span>
                                                    <div className="text-right">
                                                        {loyaltyApplied && <p className="text-xs font-bold text-stone-400 line-through">₹{grandTotal}</p>}
                                                        <span className="text-2xl font-black text-orange-600">₹{payableTotal}</span>
                                                    </div>
                                                </div>

                                                <div className="mt-5">
                                                    <PayBtn loading={loading} amount={payableTotal} disabled={isClosed} />
                                                </div>
                                                {!isClosed && <TrustNote />}

                                                <div className="mt-4 space-y-2 border-t border-stone-100 pt-4">
                                                    {[
                                                        { icon: ShieldCheck, text: "Payment secured by Razorpay" },
                                                        { icon: Lock,        text: "Your data is never sold or shared" },
                                                        { icon: Flame,       text: "Made fresh after you order" },
                                                        { icon: Clock,       text: "Rider calls you when nearby" },
                                                    ].map(({ icon: Icon, text }) => (
                                                        <div key={text} className="flex items-center gap-2 text-[11px] text-stone-400">
                                                            <Icon size={11} className="shrink-0 text-orange-400" strokeWidth={2} />
                                                            {text}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>

                                        <UpsellStrip cartIds={cartIds} />

                                        <Link href="/cart" className="flex items-center justify-center gap-2 rounded-2xl border border-stone-200 bg-white py-3 text-sm font-bold text-stone-600 shadow-sm transition-all hover:border-orange-300 hover:bg-orange-50">
                                            <ChevronRight size={14} className="rotate-180" /> Edit Cart
                                        </Link>

                                        {/* Social proof */}
                                        <div className="flex items-center gap-3 rounded-2xl border border-stone-100 bg-white p-4 shadow-sm">
                                            <div className="flex -space-x-2">
                                                {["from-orange-400 to-red-500", "from-amber-400 to-orange-500", "from-red-400 to-pink-500"].map((g, i) => (
                                                    <div key={i} className={`flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-gradient-to-br ${g} text-[11px] font-black text-white shadow-sm`}>
                                                        {["A", "R", "M"][i]}
                                                    </div>
                                                ))}
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-0.5 mb-0.5">
                                                    {[1,2,3,4,5].map((i) => <Star key={i} size={10} className="fill-amber-400 text-amber-400" />)}
                                                </div>
                                                <p className="text-[10px] font-bold text-stone-500">900+ happy orders delivered</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                            </div>
                        </form>
                    )}
                </div>
            </main>
            <Footer />
        </>
    );
}