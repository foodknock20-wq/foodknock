"use client";

export const dynamic = "force-dynamic";

// src/app/(main)/my-orders/[orderId]/page.tsx
// Premium order detail view — FoodKnock
//
// FoodKnock Phase 5 — Order Detail 2.0. Token restyle + two additive,
// real-data-only features found missing during the audit:
//   1. Payment info — `order.paymentMethod` was already fetched by
//      /api/orders/track/[orderId] but never displayed anywhere on this
//      page. Now shown (COD / Online Payment), alongside the existing
//      real cancellation/refund-status copy for cancelled orders.
//   2. Real reorder — the previous "Order Again" button was just a link
//      to /menu, not an actual reorder. Replaced with
//      src/components/orders/ReorderButton.tsx, which re-checks each
//      item's CURRENT availability via the existing public
//      GET /api/products/[id] (using `items[].productId`, which Order.ts
//      already stores and this route's `.select()` already returns — no
//      backend change) before adding anything to the cart. Unavailable
//      items are skipped and disclosed, never silently added.
// OrderTimeline and CustomerCancelControl are reused exactly as before —
// no change to their logic, only their own token restyle (separate files).

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
    Package, ArrowLeft, MapPin, Store, Phone, Clock,
    ChefHat, Truck, PartyPopper, FileText, ArrowRight,
    Loader2, UtensilsCrossed, Calendar, Hash, XCircle,
    Banknote, CreditCard, ShieldCheck,
} from "lucide-react";
import Footer from "@/components/shared/Footer";
import OrderTimeline from "@/components/orders/OrderTimeline";
import CustomerCancelControl, { type CancellationState } from "@/components/orders/CustomerCancelControl";
import ReorderButton from "@/components/orders/ReorderButton";
import RateOrderSection from "@/components/orders/RateOrderSection";

type OrderItem = { productId: string | null; name: string; quantity: number; price: number; image?: string };
type Cancellation = {
    reason?: string | null;
    note?: string | null;
    cancelledAt?: string | null;
    cancelledBy?: { type?: string | null } | null;
    refundStatus?: "not_applicable" | "pending_manual" | "completed";
};
type Order = {
    _id: string; orderId: string; customerName: string; phone: string;
    address: string; landmark?: string; orderType: "delivery" | "pickup";
    items: OrderItem[]; totalAmount: number; status: string;
    note?: string; createdAt: string; paymentMethod?: string;
    cancellation?: Cancellation;
    // Orders 2.0 — real snapshot fields for the price breakdown. All
    // optional/additive on the schema; older orders simply lack them.
    deliveryFee?: number;
    platformFee?: number;
    redeemedPoints?: number;
    redeemedAmount?: number;
    coupon?: { code?: string | null; discountAmount?: number } | null;
    offer?: { name?: string | null; discountAmount?: number } | null;
    isFirstDeliveryFreeApplied?: boolean;
};

const STATUS_CONFIG: Record<string, {
    label: string; icon: React.ElementType;
    bg: string; text: string; border: string; dot: string;
}> = {
    received:         { label: "Order Received",   icon: Clock,        bg: "bg-blue-50",          text: "text-blue-700",          border: "border-blue-200",       dot: "bg-blue-500"    },
    preparing:        { label: "Preparing",         icon: ChefHat,      bg: "bg-fk-gold-soft",     text: "text-amber-700",         border: "border-amber-200",      dot: "bg-amber-500"   },
    out_for_delivery: { label: "Out for Delivery",  icon: Truck,        bg: "bg-fk-surface-selected", text: "text-[var(--fk-accent)]", border: "border-fk-border",  dot: "bg-[var(--fk-accent)]" },
    delivered:        { label: "Delivered 🎉",      icon: PartyPopper,  bg: "bg-fk-success/10",    text: "text-fk-success",        border: "border-fk-success/25",  dot: "bg-fk-success"  },
    cancelled:        { label: "Cancelled",         icon: XCircle,      bg: "bg-fk-danger/10",     text: "text-fk-danger",         border: "border-fk-danger/25",   dot: "bg-fk-danger"   },
};

function StatusBadge({ status }: { status: string }) {
    const cfg  = STATUS_CONFIG[status] ?? { label: status, icon: Package, bg: "bg-fk-surface-interactive", text: "text-fk-text-secondary", border: "border-fk-border", dot: "bg-fk-text-tertiary" };
    const Icon = cfg.icon;
    return (
        <span className={`inline-flex items-center gap-2 rounded-fk-pill border px-3 py-1.5 text-sm font-bold ${cfg.bg} ${cfg.text} ${cfg.border}`}>
            <span className={`h-2 w-2 rounded-full ${cfg.dot} ${status === "out_for_delivery" ? "animate-pulse motion-reduce:animate-none" : ""}`} />
            <Icon size={13} strokeWidth={2.5} />
            {cfg.label}
        </span>
    );
}

const PAYMENT_META: Record<string, { label: string; icon: React.ElementType }> = {
    cod:      { label: "Cash on Delivery", icon: Banknote },
    razorpay: { label: "Online Payment",   icon: CreditCard },
};

export default function OrderDetailPage({ params }: { params: Promise<{ orderId: string }> }) {
    const { orderId } = use(params);
    const router = useRouter();
    const [order, setOrder]   = useState<Order | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError]   = useState("");

    useEffect(() => {
        async function load() {
            const meRes = await fetch("/api/auth/me", { credentials: "include" });
            if (!meRes.ok) { router.replace(`/auth?mode=login&redirect=/my-orders/${orderId}`); return; }
            try {
                // Customer Identity/Order security audit — this must be the
                // AUTHENTICATED, ownership-checked endpoint, not the public
                // guest-tracking route. See src/app/api/orders/my/[orderId]/
                // route.ts for why: the public route never confirmed this
                // order actually belongs to the logged-in customer.
                const res  = await fetch(`/api/orders/my/${encodeURIComponent(orderId)}`, { credentials: "include" });
                const data = await res.json();
                if (!res.ok || !data.success) { setError("Order not found. Please check the order ID."); return; }
                setOrder(data.order);
            } catch {
                setError("Failed to load order details.");
            } finally {
                setLoading(false);
            }
        }
        load();
    }, [orderId, router]);

    if (loading) {
        return (
            <>
                <main className="flex min-h-screen items-center justify-center bg-fk-bg">
                    <div className="flex flex-col items-center gap-3">
                        <Loader2 size={36} className="animate-spin text-fk-gold" strokeWidth={1.5} />
                        <p className="text-sm text-fk-text-tertiary">Loading order details…</p>
                    </div>
                </main>
                <Footer />
            </>
        );
    }

    if (error || !order) {
        return (
            <>
                <main className="flex min-h-screen items-center justify-center bg-fk-bg px-4">
                    <div className="flex w-full max-w-sm flex-col items-center rounded-fk-lg border border-fk-danger/25 bg-fk-surface-elevated px-8 py-16 text-center shadow-sm">
                        <Package size={40} className="mb-4 text-fk-text-tertiary" strokeWidth={1.5} />
                        <h2 className="text-lg font-black text-fk-text">Order Not Found</h2>
                        <p className="mt-2 text-sm text-fk-text-secondary">{error || "This order doesn't exist or may have been removed."}</p>
                        <Link
                            href="/my-orders"
                            className="mt-6 flex items-center gap-2 rounded-fk-pill bg-gradient-to-r from-[var(--fk-accent)] to-[var(--fk-gold)] px-6 py-2.5 text-sm font-black text-white shadow-fk-md"
                        >
                            <ArrowLeft size={14} /> Back to My Orders
                        </Link>
                    </div>
                </main>
                <Footer />
            </>
        );
    }

    const subtotal = order.items.reduce((s, i) => s + i.price * i.quantity, 0);
    const paymentMeta = order.paymentMethod ? PAYMENT_META[order.paymentMethod] : null;

    // Orders 2.0 price breakdown — coupon and offer are mutually exclusive
    // per the Order schema (one discount source per order), so at most one
    // of these is ever real/nonzero at a time.
    const couponDiscount = order.coupon?.discountAmount ?? 0;
    const offerDiscount = order.offer?.discountAmount ?? 0;
    const discountAmount = couponDiscount > 0 ? couponDiscount : offerDiscount;
    const discountLabel =
        couponDiscount > 0
            ? `Coupon${order.coupon?.code ? ` (${order.coupon.code})` : ""}`
            : offerDiscount > 0
                ? order.offer?.name || "Offer"
                : null;

    return (
        <>
            <main className="min-h-screen bg-fk-bg">

                {/* ── Header ── */}
                <section className="relative overflow-hidden border-b border-fk-border">
                    <div className="absolute inset-0 bg-gradient-to-br from-fk-gold-soft/80 via-fk-bg to-fk-surface-selected/60" />
                    <div
                        className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full opacity-20 blur-3xl"
                        style={{ background: "radial-gradient(ellipse, var(--fk-accent), transparent 70%)" }}
                    />
                    <div
                        className="pointer-events-none absolute inset-0 opacity-[0.022]"
                        style={{ backgroundImage: "radial-gradient(circle, #92400e 1px, transparent 1px)", backgroundSize: "28px 28px" }}
                    />
                    <div className="relative mx-auto max-w-4xl px-4 pb-8 pt-8 md:px-8">
                        <Link
                            href="/my-orders"
                            className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-fk-text-secondary transition-colors hover:text-[var(--fk-accent)]"
                        >
                            <ArrowLeft size={15} /> Back to My Orders
                        </Link>

                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                                <p className="mb-1 text-[11px] font-black uppercase tracking-[0.22em] text-[var(--fk-accent)]">Order Details</p>
                                <div className="flex flex-wrap items-center gap-2">
                                    <h1 className="font-display text-xl font-black text-fk-text md:text-2xl">{order.customerName}</h1>
                                    <StatusBadge status={order.status} />
                                </div>
                                <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-fk-text-tertiary">
                                    <span className="flex items-center gap-1">
                                        <Hash size={11} />
                                        <span className="font-mono">{order.orderId}</span>
                                    </span>
                                    <span className="flex items-center gap-1">
                                        <Calendar size={11} />
                                        {new Date(order.createdAt).toLocaleString("en-IN", {
                                            day: "2-digit", month: "short", year: "numeric",
                                            hour: "2-digit", minute: "2-digit",
                                        })}
                                    </span>
                                </div>
                            </div>

                            <Link
                                href={`/track-order/${encodeURIComponent(order.orderId)}`}
                                className="group flex shrink-0 items-center gap-2 self-start rounded-fk-lg bg-gradient-to-r from-[var(--fk-accent)] to-[var(--fk-gold)] px-5 py-3 text-sm font-black text-white shadow-fk-md transition-all hover:brightness-110 active:scale-95"
                            >
                                <Truck size={15} strokeWidth={2.5} />
                                Track Order
                                <ArrowRight size={13} className="transition-transform group-hover:translate-x-0.5" />
                            </Link>
                        </div>
                    </div>
                </section>

                {/* ── Content ── */}
                <div className="mx-auto max-w-4xl px-4 py-8 md:px-8">
                    <div className="grid gap-5 lg:grid-cols-5">

                        {/* Left col */}
                        <div className="space-y-5 lg:col-span-3">

                            {/* Customer info */}
                            <div className="overflow-hidden rounded-fk-lg border border-fk-border bg-fk-surface-elevated shadow-sm">
                                <div className="border-b border-fk-border bg-fk-surface-selected px-5 py-3.5">
                                    <h2 className="text-xs font-black uppercase tracking-wider text-fk-text-secondary">Customer Info</h2>
                                </div>
                                <div className="space-y-3.5 p-5">
                                    <div className="flex items-center gap-3">
                                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-fk-sm bg-fk-gold-soft">
                                            <Phone size={14} className="text-amber-600" />
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-bold uppercase tracking-wide text-fk-text-tertiary">Phone</p>
                                            <p className="text-sm font-semibold text-fk-text">{order.phone}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-3">
                                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-fk-sm bg-fk-gold-soft">
                                            {order.orderType === "delivery"
                                                ? <MapPin size={14} className="text-amber-600" />
                                                : <Store size={14} className="text-amber-600" />}
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-bold uppercase tracking-wide text-fk-text-tertiary">
                                                {order.orderType === "delivery" ? "Delivery Address" : "Pickup Order"}
                                            </p>
                                            {order.orderType === "delivery" ? (
                                                <p className="text-sm font-semibold text-fk-text">
                                                    {order.address}{order.landmark ? `, ${order.landmark}` : ""}
                                                </p>
                                            ) : (
                                                <p className="text-sm font-semibold text-fk-text">Collect from FoodKnock kitchen</p>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-3">
                                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-fk-sm bg-fk-gold-soft">
                                            <Truck size={14} className="text-amber-600" />
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-bold uppercase tracking-wide text-fk-text-tertiary">Order Type</p>
                                            <p className="text-sm font-semibold capitalize text-fk-text">{order.orderType}</p>
                                        </div>
                                    </div>
                                    {paymentMeta && (
                                        <div className="flex items-start gap-3">
                                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-fk-sm bg-fk-gold-soft">
                                                <paymentMeta.icon size={14} className="text-amber-600" />
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-bold uppercase tracking-wide text-fk-text-tertiary">Payment</p>
                                                <p className="text-sm font-semibold text-fk-text">{paymentMeta.label}</p>
                                            </div>
                                        </div>
                                    )}
                                    {order.note && (
                                        <div className="flex items-start gap-3">
                                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-fk-sm bg-fk-gold-soft">
                                                <FileText size={14} className="text-amber-600" />
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-bold uppercase tracking-wide text-fk-text-tertiary">Note</p>
                                                <p className="text-sm text-fk-text">{order.note}</p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Items ordered */}
                            <div className="overflow-hidden rounded-fk-lg border border-fk-border bg-fk-surface-elevated shadow-sm">
                                <div className="border-b border-fk-border bg-fk-surface-selected px-5 py-3.5">
                                    <h2 className="text-xs font-black uppercase tracking-wider text-fk-text-secondary">
                                        Items Ordered · {order.items.reduce((s, i) => s + i.quantity, 0)} items
                                    </h2>
                                </div>
                                <div className="divide-y divide-fk-border">
                                    {order.items.map((item, i) => (
                                        <div key={i} className="flex items-center gap-4 px-5 py-4">
                                            {item.image ? (
                                                <img
                                                    src={item.image}
                                                    alt={item.name}
                                                    className="h-12 w-12 shrink-0 rounded-fk-md border border-fk-border object-cover"
                                                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                                                />
                                            ) : (
                                                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-fk-md bg-fk-gold-soft">
                                                    <UtensilsCrossed size={18} className="text-amber-500" strokeWidth={1.8} />
                                                </div>
                                            )}
                                            <div className="min-w-0 flex-1">
                                                <p className="line-clamp-1 text-sm font-bold text-fk-text">{item.name}</p>
                                                <p className="text-xs text-fk-text-tertiary">₹{item.price.toLocaleString("en-IN")} × {item.quantity}</p>
                                            </div>
                                            <p className="text-sm font-black text-fk-text">
                                                ₹{(item.price * item.quantity).toLocaleString("en-IN")}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                                <div className="space-y-2 border-t border-fk-border bg-fk-surface-selected px-5 py-4">
                                    <div className="flex items-center justify-between text-sm text-fk-text-secondary">
                                        <span>Subtotal</span>
                                        <span>₹{subtotal.toLocaleString("en-IN")}</span>
                                    </div>
                                    {discountLabel && discountAmount > 0 && (
                                        <div className="flex items-center justify-between text-sm text-fk-success">
                                            <span>{discountLabel}</span>
                                            <span>−₹{discountAmount.toLocaleString("en-IN")}</span>
                                        </div>
                                    )}
                                    {order.orderType === "delivery" && (
                                        <div className="flex items-center justify-between text-sm text-fk-text-secondary">
                                            <span>Delivery Fee</span>
                                            {order.isFirstDeliveryFreeApplied || order.deliveryFee === 0 ? (
                                                <span className="font-bold text-fk-success">FREE</span>
                                            ) : (
                                                <span>₹{(order.deliveryFee ?? 0).toLocaleString("en-IN")}</span>
                                            )}
                                        </div>
                                    )}
                                    {!!order.platformFee && order.platformFee > 0 && (
                                        <div className="flex items-center justify-between text-sm text-fk-text-secondary">
                                            <span>Platform Fee</span>
                                            <span>₹{order.platformFee.toLocaleString("en-IN")}</span>
                                        </div>
                                    )}
                                    {!!order.redeemedAmount && order.redeemedAmount > 0 && (
                                        <div className="flex items-center justify-between text-sm text-fk-success">
                                            <span>Loyalty Redemption ({order.redeemedPoints} pts)</span>
                                            <span>−₹{order.redeemedAmount.toLocaleString("en-IN")}</span>
                                        </div>
                                    )}
                                    <div className="flex items-center justify-between border-t border-fk-border pt-2 font-black text-fk-text">
                                        <span>Total Paid</span>
                                        <span className="text-xl text-[var(--fk-accent)]">₹{order.totalAmount.toLocaleString("en-IN")}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Primary actions — Reorder first (strongest action for a
                                delivered order), Rate Your Order directly below. Both
                                self-gate on status internally; neither renders for a
                                non-delivered order. */}
                            <ReorderButton
                                items={order.items.map((i) => ({ productId: i.productId, name: i.name, quantity: i.quantity, price: i.price }))}
                                status={order.status}
                            />

                            {/* Rate Your Order — reuses the existing ProductReview
                                system via WriteReviewSheet; self-gates on status
                                and on whether there's anything reviewable. */}
                            <RateOrderSection
                                items={order.items.map((i) => ({ productId: i.productId, name: i.name, image: i.image }))}
                                status={order.status}
                            />
                        </div>

                        {/* Right col */}
                        <div className="space-y-5 lg:col-span-2">

                            {/* Cancellation */}
                            <CustomerCancelControl
                                orderMongoId={order._id}
                                createdAt={order.createdAt}
                                status={order.status}
                                onCancelled={(cancellation: CancellationState) =>
                                    setOrder((prev) => prev && { ...prev, status: "cancelled", cancellation })
                                }
                            />

                            {order.status === "cancelled" && order.cancellation?.cancelledAt && (
                                <div className="rounded-fk-lg border border-fk-danger/25 bg-fk-danger/5 p-5 text-sm text-fk-text-secondary">
                                    <p className="font-bold text-fk-text">This order was cancelled.</p>
                                    {order.cancellation.reason && (
                                        <p className="mt-1">Reason: {order.cancellation.reason.replace(/_/g, " ")}</p>
                                    )}
                                    {order.cancellation.refundStatus === "pending_manual" && (
                                        <p className="mt-2 font-semibold text-fk-gold">Refund Pending — our team will process this shortly.</p>
                                    )}
                                    {order.cancellation.refundStatus === "completed" && (
                                        <p className="mt-2 font-semibold text-fk-success">Refund Processed.</p>
                                    )}
                                </div>
                            )}

                            {/* Payment status — real data only, no architecture touched */}
                            {paymentMeta && order.status !== "cancelled" && (
                                <div className="flex items-center gap-3 rounded-fk-lg border border-fk-border bg-fk-surface-elevated p-4 shadow-sm">
                                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-fk-sm bg-fk-success/10">
                                        <ShieldCheck size={16} className="text-fk-success" strokeWidth={2} />
                                    </span>
                                    <div>
                                        <p className="text-sm font-bold text-fk-text">{paymentMeta.label}</p>
                                        <p className="text-xs text-fk-text-tertiary">
                                            {order.paymentMethod === "cod" ? "Pay cash on delivery" : "Paid securely via Razorpay"}
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* Timeline */}
                            <div className="overflow-hidden rounded-fk-lg border border-fk-border bg-fk-surface-elevated shadow-sm">
                                <div className="border-b border-fk-border bg-fk-surface-selected px-5 py-3.5">
                                    <h2 className="text-xs font-black uppercase tracking-wider text-fk-text-secondary">Order Timeline</h2>
                                </div>
                                <div className="p-5">
                                    <OrderTimeline
                                        status={order.status}
                                        orderType={order.orderType}
                                        createdAt={order.createdAt}
                                    />
                                </div>
                            </div>

                            {/* Track CTA card */}
                            <div className="relative overflow-hidden rounded-fk-lg bg-gradient-to-br from-[var(--fk-accent)] to-[var(--fk-gold)] p-6 shadow-fk-lg">
                                <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/10" />
                                <div className="pointer-events-none absolute -bottom-4 -left-4 h-20 w-20 rounded-full bg-white/5" />
                                <Truck size={28} className="mb-3 text-white/80" strokeWidth={1.5} />
                                <h3 className="text-base font-black text-white">Live Order Tracking</h3>
                                <p className="mt-1 text-sm text-white/80">
                                    See real-time delivery updates and live status for this order.
                                </p>
                                <Link
                                    href={`/track-order/${encodeURIComponent(order.orderId)}`}
                                    className="group mt-4 flex items-center justify-between rounded-fk-md bg-white px-5 py-3 text-sm font-black text-[var(--fk-accent)] shadow-sm transition-all hover:bg-fk-gold-soft active:scale-95"
                                >
                                    Track Live Status
                                    <ArrowRight size={14} className="transition-transform group-hover:translate-x-1" />
                                </Link>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
            <Footer />
        </>
    );
}
