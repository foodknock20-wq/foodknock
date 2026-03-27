export const dynamic = "force-dynamic";

// src/app/admin/orders/page.tsx
//
// Server component — fetches orders at render time and passes them
// as initial data to OrderTable, which then live-polls every 5 s.

import { connectDB }                          from "@/lib/db";
import Order                                  from "@/models/Order";
import OrderTable, { type OrderRow }          from "@/components/admin/orders/OrderTable";
import { ShoppingBag }                        from "lucide-react";

async function getOrders(): Promise<OrderRow[]> {
    await connectDB();
    const orders = await Order.find().sort({ createdAt: -1 }).lean();

    return (orders as any[]).map((o) => ({
        _id:          o._id.toString(),
        orderId:      o.orderId      ?? o._id.toString(),
        customerName: o.customerName ?? "Unknown",
        phone:        o.phone        ?? "—",
        address:      o.address      ?? "",
        landmark:     o.landmark     ?? "",
        orderType:    o.orderType    ?? "delivery",
        paymentMethod: o.paymentMethod ?? "cod",
        items: Array.isArray(o.items)
            ? o.items.map((i: any) => ({
                  productId: i.productId?.toString() ?? "",
                  name:      i.name      ?? "Item",
                  quantity:  i.quantity  ?? 1,
                  price:     i.price     ?? 0,
                  image:     i.image     ?? "",
              }))
            : [],
        totalAmount:  o.totalAmount  ?? 0,
        status:       o.status       ?? "received",
        note:         o.note         ?? "",
        whatsappSent: o.whatsappSent ?? false,
        createdAt:    o.createdAt
            ? new Date(o.createdAt).toISOString()
            : new Date().toISOString(),
    }));
}

export default async function AdminOrdersPage() {
    const orders = await getOrders();

    const counts = orders.reduce<Record<string, number>>((acc, o) => {
        acc[o.status] = (acc[o.status] ?? 0) + 1;
        return acc;
    }, {});

    const totalRevenue = orders
        .filter((o) => o.status === "delivered")
        .reduce((sum, o) => sum + o.totalAmount, 0);

    return (
        <div className="space-y-6">

            {/* ── Page header ── */}
            <div>
                <div className="mb-1 inline-flex items-center gap-2 rounded-full border border-amber-500/20 bg-amber-500/8 px-3 py-1">
                    <ShoppingBag size={11} className="text-amber-400" />
                    <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-400">Orders</span>
                </div>
                <h1 className="font-serif text-2xl font-bold text-white md:text-3xl">Order Management</h1>
                <p className="mt-1 text-sm text-stone-600">
                    {orders.length} total order{orders.length !== 1 ? "s" : ""} — live updates every 5 seconds
                </p>
            </div>

            {/* ── Quick stats ── */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                    { label: "Total",     value: orders.length,         color: "text-white"        },
                    { label: "Received",  value: counts.received  ?? 0, color: "text-amber-400"    },
                    { label: "Preparing", value: counts.preparing ?? 0, color: "text-sky-400"      },
                    { label: "Delivered", value: counts.delivered ?? 0, color: "text-emerald-400"  },
                ].map(({ label, value, color }) => (
                    <div key={label} className="rounded-xl border border-white/[0.06] bg-[#111118] px-4 py-3">
                        <p className="text-[11px] font-semibold uppercase tracking-widest text-stone-600">{label}</p>
                        <p className={`mt-1 font-serif text-2xl font-black ${color}`}>{value}</p>
                    </div>
                ))}
            </div>

            {/* ── Revenue strip ── */}
            {totalRevenue > 0 && (
                <div className="rounded-xl border border-emerald-500/15 bg-emerald-500/5 px-5 py-3">
                    <p className="text-xs text-stone-500">
                        Revenue from delivered orders:{" "}
                        <span className="font-serif text-lg font-black text-emerald-400">
                            ₹{totalRevenue.toLocaleString("en-IN")}
                        </span>
                    </p>
                </div>
            )}

            {/* ── Live order table ── */}
            <div className="rounded-2xl border border-white/[0.06] bg-[#111118] p-5">
                {/*
                  OrderTable is a Client Component that:
                  - Renders the initial server-fetched orders immediately
                  - Polls /api/orders every 5 s and shows toast + plays audio on new orders
                  - Provides status advancement buttons
                */}
                <OrderTable orders={orders} />
            </div>
        </div>
    );
}