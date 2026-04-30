export const dynamic = "force-dynamic";

// src/app/admin/orders/page.tsx
//
// Server component — fetches ALL orders at render time and passes them
// as initial data to OrderTable, which handles analytics + live-polling.

import { connectDB } from "@/lib/db";
import Order from "@/models/Order";
import OrderTable, { type OrderRow } from "@/components/admin/orders/OrderTable";
import { ShoppingBag } from "lucide-react";

async function getOrders(): Promise<OrderRow[]> {
    await connectDB();
    // Fetch all orders (no limit) so client-side date filtering works correctly
    const orders = await Order.find().sort({ createdAt: -1 }).lean();

    return (orders as any[]).map((o) => ({
        _id: o._id.toString(),
        orderId: o.orderId ?? o._id.toString(),
        customerName: o.customerName ?? "Unknown",
        phone: o.phone ?? "—",
        address: o.address ?? "",
        landmark: o.landmark ?? "",
        orderType: o.orderType ?? "delivery",
        paymentMethod: o.paymentMethod ?? "cod",
        items: Array.isArray(o.items)
            ? o.items.map((i: any) => ({
                productId: i.productId?.toString() ?? "",
                name: i.name ?? "Item",
                quantity: i.quantity ?? 1,
                price: i.price ?? 0,
                image: i.image ?? "",
            }))
            : [],
        totalAmount: o.totalAmount ?? 0,
        status: o.status ?? "received",
        note: o.note ?? "",
        whatsappSent: o.whatsappSent ?? false,
        createdAt: o.createdAt
            ? new Date(o.createdAt).toISOString()
            : new Date().toISOString(),
    }));
}

export default async function AdminOrdersPage() {
    const orders = await getOrders();

    return (
        <div className="space-y-6">
            {/* ── Page header ── */}
            <div>
                <div className="mb-1 inline-flex items-center gap-2 rounded-full border border-amber-500/20 bg-amber-500/8 px-3 py-1">
                    <ShoppingBag size={11} className="text-amber-400" />
                    <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-400">
                        Orders
                    </span>
                </div>
                <h1 className="font-serif text-2xl font-bold text-white md:text-3xl">
                    Order Intelligence
                </h1>
                <p className="mt-1 text-sm text-stone-600">
                    {orders.length} total order{orders.length !== 1 ? "s" : ""} — live updates every 5 seconds
                </p>
            </div>

            {/* ── Full dashboard (analytics + order management) ── */}
            <OrderTable orders={orders} />
        </div>
    );
}