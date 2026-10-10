export const dynamic = "force-dynamic";

// src/app/admin/orders/[id]/page.tsx
//
// Phase 14 — admin order detail + timeline. Did not exist before this
// phase (the admin Orders page was cards-only, no drill-in view). Server
// component: one query, no client-side fetch waterfall. Quick actions
// (advance / cancel) are delegated to OrderDetailActions.tsx, a small
// client component that calls the exact same routes OrderTable.tsx's
// cards already use.

import { notFound } from "next/navigation";
import Link from "next/link";
import mongoose from "mongoose";
import {
    ArrowLeft, Phone, MapPin, Store, FileText, Calendar,
    Clock, ChefHat, Truck, CheckCircle2, XCircle, CreditCard, Wallet,
    Navigation, Tag, Gift, Sparkles,
} from "lucide-react";
import { connectDB } from "@/lib/db";
import Order from "@/models/Order";
import { STATUS_CONFIG, OrderStatusBadge } from "@/components/admin/orders/OrderStatusBadge";
import OrderDetailActions from "@/components/admin/orders/OrderDetailActions";
import { buildGoogleMapsNavigationUrl } from "@/lib/googleMapsLink";
import { formatDistance } from "@/lib/formatDistance";

type RouteContext = { params: Promise<{ id: string }> };

type OrderItemDoc = { name: string; quantity: number; price: number; image?: string };
type OrderDetailDoc = {
    _id: unknown;
    orderId: string;
    customerName: string;
    phone: string;
    address: string;
    landmark?: string;
    orderType: "delivery" | "pickup";
    items: OrderItemDoc[];
    totalAmount: number;
    status: string;
    note?: string;
    createdAt: Date;
    paymentMethod: string;
    razorpayPaymentId?: string;
    deliveryFee: number;
    platformFee: number;
    distanceKm: number | null;
    deliveryLatitude: number | null;
    deliveryLongitude: number | null;
    deliveryInstructions?: string;
    redeemedPoints: number;
    redeemedAmount: number;
    coupon?: { code?: string | null; discountAmount?: number } | null;
    offer?: { name?: string | null; discountAmount?: number } | null;
    cancellation?: {
        reason?: string | null;
        note?: string | null;
        cancelledAt?: Date | null;
        cancelledBy?: { type?: string | null } | null;
        refundStatus?: "not_applicable" | "pending_manual" | "completed";
    } | null;
    statusHistory?: Array<{
        status: string;
        changedAt: Date;
        changedBy?: { type?: string | null; userId?: unknown };
        reason?: string | null;
    }>;
    archivedAt?: Date | null;
};

const TIMELINE_ICONS: Record<string, React.ElementType> = {
    received: Clock,
    preparing: ChefHat,
    out_for_delivery: Truck,
    delivered: CheckCircle2,
    cancelled: XCircle,
};

function fmtDateTime(d: Date | string): string {
    return new Date(d).toLocaleString("en-IN", {
        day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
    });
}

function fmtRs(n: number): string {
    return `₹${(n ?? 0).toLocaleString("en-IN")}`;
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div className="overflow-hidden rounded-2xl border border-white/[0.06] bg-[#0f0f16]">
            <div className="border-b border-white/[0.06] bg-white/[0.02] px-4 py-3">
                <h2 className="text-[10px] font-black uppercase tracking-[0.18em] text-stone-500">{title}</h2>
            </div>
            <div className="p-4">{children}</div>
        </div>
    );
}

export default async function AdminOrderDetailPage({ params }: RouteContext) {
    const { id } = await params;
    if (!mongoose.Types.ObjectId.isValid(id)) notFound();

    await connectDB();
    const order = await Order.findById(id).lean<OrderDetailDoc | null>();
    if (!order) notFound();

    const subtotal = (order.items ?? []).reduce((s: number, i: OrderItemDoc) => s + i.price * i.quantity, 0);
    const mapsUrl = order.orderType === "delivery"
        ? buildGoogleMapsNavigationUrl(order.deliveryLatitude, order.deliveryLongitude)
        : null;

    const history = order.statusHistory ?? [];

    const cancellation = order.cancellation ?? null;

    return (
        <div className="space-y-5">
            {order.archivedAt && (
                <div className="rounded-xl border border-stone-500/25 bg-stone-500/10 px-4 py-2.5 text-[12px] font-bold text-stone-400">
                    📦 This order is archived — hidden from the operational list, kept intact for audit/financial integrity.
                </div>
            )}
            {/* Header */}
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <Link
                        href="/admin/orders"
                        className="mb-2 inline-flex items-center gap-1.5 text-[12px] font-bold text-stone-500 transition-colors hover:text-orange-400"
                    >
                        <ArrowLeft size={13} /> Back to Orders
                    </Link>
                    <div className="flex flex-wrap items-center gap-3">
                        <h1 className="font-mono text-xl font-black text-white">{order.orderId}</h1>
                        <OrderStatusBadge status={order.status} />
                    </div>
                    <p className="mt-1 flex items-center gap-1.5 text-[12px] text-stone-500">
                        <Calendar size={11} />
                        {fmtDateTime(order.createdAt)}
                    </p>
                </div>
                <OrderDetailActions orderId={order.orderId} orderMongoId={id} status={order.status} />
            </div>

            <div className="grid gap-5 lg:grid-cols-5">
                {/* Left column */}
                <div className="space-y-5 lg:col-span-3">
                    <SectionCard title="Customer">
                        <div className="space-y-3">
                            <div className="flex items-center gap-3">
                                <Phone size={14} className="text-stone-500" />
                                <div>
                                    <p className="text-sm font-bold text-white">{order.customerName}</p>
                                    <p className="text-[12px] text-stone-500">{order.phone}</p>
                                </div>
                            </div>
                        </div>
                    </SectionCard>

                    <SectionCard title="Delivery">
                        <div className="space-y-2.5 text-[13px] text-stone-300">
                            <div className="flex items-start gap-2.5">
                                {order.orderType === "delivery" ? <MapPin size={14} className="mt-0.5 text-stone-500" /> : <Store size={14} className="mt-0.5 text-stone-500" />}
                                <p>
                                    {order.orderType === "delivery"
                                        ? `${order.address}${order.landmark ? ` · Near ${order.landmark}` : ""}`
                                        : "Pickup from kitchen"}
                                </p>
                            </div>
                            {order.deliveryInstructions && (
                                <div className="flex items-start gap-2.5">
                                    <FileText size={14} className="mt-0.5 text-stone-500" />
                                    <p className="text-stone-400">{order.deliveryInstructions}</p>
                                </div>
                            )}
                            {order.orderType === "delivery" && (
                                <div className="flex items-center justify-between rounded-xl border border-white/[0.05] bg-white/[0.02] px-3 py-2">
                                    <span className="text-stone-500">
                                        Distance{order.distanceKm != null ? `: ${formatDistance(order.distanceKm)}` : ""} · Fee: {order.deliveryFee > 0 ? fmtRs(order.deliveryFee) : "FREE"}
                                    </span>
                                    {mapsUrl && (
                                        <a
                                            href={mapsUrl}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="flex items-center gap-1 rounded-lg border border-sky-500/25 bg-sky-500/10 px-2.5 py-1.5 text-[11px] font-bold text-sky-400 hover:bg-sky-500/20"
                                        >
                                            <Navigation size={11} /> Open in Maps
                                        </a>
                                    )}
                                </div>
                            )}
                        </div>
                    </SectionCard>

                    <SectionCard title={`Items · ${(order.items ?? []).reduce((s: number, i: OrderItemDoc) => s + i.quantity, 0)}`}>
                        <div className="divide-y divide-white/[0.04]">
                            {(order.items ?? []).map((item: OrderItemDoc, i: number) => (
                                <div key={i} className="flex items-center justify-between py-2.5 text-[13px]">
                                    <span className="text-stone-400">
                                        <span className="mr-2 font-black text-stone-200">{item.quantity}×</span>
                                        {item.name}
                                    </span>
                                    <span className="font-bold text-stone-300">{fmtRs(item.price * item.quantity)}</span>
                                </div>
                            ))}
                        </div>
                    </SectionCard>

                    <SectionCard title="Billing">
                        <div className="space-y-1.5 text-[13px]">
                            <div className="flex justify-between text-stone-400"><span>Subtotal</span><span>{fmtRs(subtotal)}</span></div>
                            {(order.offer?.discountAmount ?? 0) > 0 && (
                                <div className="flex justify-between text-emerald-400">
                                    <span className="flex items-center gap-1"><Sparkles size={11} /> {order.offer?.name}</span>
                                    <span>-{fmtRs(order.offer?.discountAmount ?? 0)}</span>
                                </div>
                            )}
                            {(order.coupon?.discountAmount ?? 0) > 0 && (
                                <div className="flex justify-between text-emerald-400">
                                    <span className="flex items-center gap-1"><Tag size={11} /> {order.coupon?.code}</span>
                                    <span>-{fmtRs(order.coupon?.discountAmount ?? 0)}</span>
                                </div>
                            )}
                            {order.redeemedAmount > 0 && (
                                <div className="flex justify-between text-emerald-400">
                                    <span className="flex items-center gap-1"><Gift size={11} /> Loyalty ({order.redeemedPoints} pts)</span>
                                    <span>-{fmtRs(order.redeemedAmount)}</span>
                                </div>
                            )}
                            <div className="flex justify-between text-stone-400"><span>Delivery Fee</span><span>{order.deliveryFee > 0 ? fmtRs(order.deliveryFee) : "FREE"}</span></div>
                            <div className="flex justify-between text-stone-400"><span>Platform Fee</span><span>{fmtRs(order.platformFee ?? 0)}</span></div>
                            <div className="mt-2 flex justify-between border-t border-white/[0.06] pt-2 text-base font-black text-white">
                                <span>Total</span><span>{fmtRs(order.totalAmount)}</span>
                            </div>
                        </div>
                    </SectionCard>

                    <SectionCard title="Payment">
                        <div className="flex items-center justify-between text-[13px]">
                            <span className="flex items-center gap-2 text-stone-300">
                                {order.paymentMethod === "cod" ? <Wallet size={14} className="text-stone-500" /> : <CreditCard size={14} className="text-stone-500" />}
                                {order.paymentMethod === "cod" ? "Cash on Delivery" : "Razorpay (Online)"}
                            </span>
                            {order.razorpayPaymentId && (
                                <span className="font-mono text-[11px] text-stone-500">{order.razorpayPaymentId}</span>
                            )}
                        </div>
                        {cancellation?.refundStatus === "pending_manual" && (
                            <div className="mt-3 rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-[12px] font-bold text-amber-400">
                                ⚠ Refund pending — process manually via the Razorpay dashboard.
                            </div>
                        )}
                        {cancellation?.refundStatus === "completed" && (
                            <div className="mt-3 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-[12px] font-bold text-emerald-400">
                                ✓ Refund processed.
                            </div>
                        )}
                    </SectionCard>

                    {order.note && (
                        <SectionCard title="Customer Note">
                            <p className="text-[13px] text-stone-400">{order.note}</p>
                        </SectionCard>
                    )}
                </div>

                {/* Right column — timeline */}
                <div className="space-y-5 lg:col-span-2">
                    <SectionCard title="Order Timeline">
                        {history.length === 0 ? (
                            <p className="text-[12px] text-stone-600">No history recorded for this order (placed before Phase 14).</p>
                        ) : (
                            <div className="space-y-4">
                                {history.map((h, i) => {
                                    const Icon = TIMELINE_ICONS[h.status] ?? Clock;
                                    const cfg = STATUS_CONFIG[h.status as keyof typeof STATUS_CONFIG];
                                    return (
                                        <div key={i} className="flex gap-3">
                                            <div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border ${cfg?.classes ?? "border-stone-700/50 bg-white/[0.03] text-stone-500"}`}>
                                                <Icon size={12} />
                                            </div>
                                            <div>
                                                <p className="text-[12px] font-bold text-stone-200">{cfg?.label ?? h.status}</p>
                                                <p className="text-[11px] text-stone-600">{fmtDateTime(h.changedAt)} · {h.changedBy?.type ?? "system"}</p>
                                                {h.reason && (
                                                    <p className="mt-0.5 text-[11px] text-rose-400">Reason: {h.reason}</p>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </SectionCard>

                    {cancellation?.cancelledAt && (
                        <SectionCard title="Cancellation Details">
                            <div className="space-y-1.5 text-[12px] text-stone-400">
                                <p><span className="text-stone-600">Reason:</span> {cancellation.reason}</p>
                                {cancellation.note && <p><span className="text-stone-600">Note:</span> {cancellation.note}</p>}
                                <p><span className="text-stone-600">Cancelled by:</span> {cancellation.cancelledBy?.type ?? "—"}</p>
                                <p><span className="text-stone-600">At:</span> {fmtDateTime(cancellation.cancelledAt)}</p>
                            </div>
                        </SectionCard>
                    )}
                </div>
            </div>
        </div>
    );
}
