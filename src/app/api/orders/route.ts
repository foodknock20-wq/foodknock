// src/app/api/orders/route.ts
// FIXED:
//   1. Added admin-only auth guard on GET — previously had ZERO authentication
//      (anyone could dump all orders including customer names, addresses, phones)
//   2. Added force-dynamic
//   3. Lean + field projection on GET response

import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB }     from "@/lib/db";
import Order             from "@/models/Order";
import Product           from "@/models/Product";
import User              from "@/models/User";
import { generateOrderId }                    from "@/lib/utils";
import { verifyToken }                        from "@/lib/auth";
import { calculateDeliveryFee, PLATFORM_FEE } from "@/lib/delivery";
import {
    checkFirstFreeDelivery,
    consumeFirstFreeDelivery,
} from "@/lib/firstFreeDelivery";

export const dynamic = "force-dynamic";

// ─── Admin auth helper ────────────────────────────────────────────────────
function isAdmin(req: NextRequest): boolean {
    const cookieHeader = req.headers.get("cookie") ?? "";
    const match        = cookieHeader.match(/(?:^|;\s*)token=([^;]+)/);
    const token        = match ? decodeURIComponent(match[1]) : null;
    if (!token) return false;
    try {
        const decoded = verifyToken(token) as { role?: string };
        return decoded?.role === "admin";
    } catch {
        return false;
    }
}

// ─── GET /api/orders (admin only) ─────────────────────────────────────────
export async function GET(req: NextRequest) {
    // ✅ Auth guard — this returns ALL orders with PII
    if (!isAdmin(req)) {
        return NextResponse.json(
            { success: false, message: "Unauthorised" },
            { status: 401 }
        );
    }

    try {
        await connectDB();

        const { searchParams } = new URL(req.url);
        const status = searchParams.get("status");
        const search = searchParams.get("search");
        const limit  = Math.min(parseInt(searchParams.get("limit") ?? "200"), 500);

        const query: Record<string, unknown> = {};
        if (status && status !== "all") query.status = status;
        if (search) {
            query.$or = [
                { customerName: { $regex: search, $options: "i" } },
                { phone:        { $regex: search, $options: "i" } },
                { orderId:      { $regex: search, $options: "i" } },
            ];
        }

        // ✅ lean() for plain JS objects; select only what admin table needs
        const orders = await Order.find(query)
            .sort({ createdAt: -1 })
            .limit(limit)
            .select("orderId customerName phone address landmark orderType items totalAmount deliveryFee platformFee status paymentMethod razorpayOrderId razorpayPaymentId createdAt isFirstDeliveryFreeApplied note")
            .maxTimeMS(8000)
            .lean();

        return NextResponse.json({ success: true, orders });
    } catch (error) {
        console.error("GET_ORDERS_ERROR", error);
        return NextResponse.json(
            { success: false, message: "Failed to fetch orders" },
            { status: 500 }
        );
    }
}

// ─── POST /api/orders (legacy COD flow) ────────────────────────────────────
export async function POST(req: Request) {
    try {
        await connectDB();

        const cookieHeader = req.headers.get("cookie") ?? "";
        const tokenMatch   = cookieHeader.match(/(?:^|;\s*)token=([^;]+)/);
        const token        = tokenMatch ? decodeURIComponent(tokenMatch[1]) : null;
        let linkedUserId: string | null = null;

        if (token) {
            try {
                const decoded = verifyToken(token) as { userId?: string };
                if (decoded?.userId) {
                    const user = await User.findById(decoded.userId).select("_id isActive").lean() as any;
                    if (!user) {
                        return NextResponse.json(
                            { success: false, message: "User not found" },
                            { status: 404 }
                        );
                    }
                    if (user.isActive === false) {
                        return NextResponse.json(
                            { success: false, message: "Your account has been blocked. You cannot place orders." },
                            { status: 403 }
                        );
                    }
                    linkedUserId = user._id.toString();
                }
            } catch {
                // invalid token — treat as guest
            }
        }

        const body = await req.json();

        const items: Array<{
            _id:      string;
            name:     string;
            price:    number;
            quantity: number;
            image?:   string;
        }> = body.items ?? [];

        if (!items.length) {
            return NextResponse.json(
                { success: false, message: "Cart is empty" },
                { status: 400 }
            );
        }

        const orderType: string = body.orderType ?? "delivery";

        // ── Stock validation ──────────────────────────────────────────────
        const productDocs: Array<{ doc: InstanceType<typeof Product>; qty: number }> = [];

        for (const item of items) {
            if (!mongoose.Types.ObjectId.isValid(item._id)) {
                console.warn("Skipping non-DB product:", item.name);
                continue;
            }
            const product = await Product.findById(item._id);
            if (!product) {
                return NextResponse.json(
                    { success: false, message: `Product "${item.name}" not found` },
                    { status: 404 }
                );
            }
            if (product.isAvailable === false) {
                return NextResponse.json(
                    { success: false, message: `"${product.name}" is currently unavailable` },
                    { status: 400 }
                );
            }
            if (product.stock < item.quantity) {
                return NextResponse.json(
                    {
                        success: false,
                        message: `"${product.name}" only has ${product.stock} item${product.stock !== 1 ? "s" : ""} left`,
                    },
                    { status: 400 }
                );
            }
            productDocs.push({ doc: product, qty: item.quantity });
        }

        for (const { doc, qty } of productDocs) {
            doc.stock -= qty;
            if (doc.stock <= 0) { doc.stock = 0; doc.isAvailable = false; }
            await doc.save();
        }

        const subtotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0);

        const { eligible: firstDeliveryFree } = await checkFirstFreeDelivery(linkedUserId, orderType);

        const deliveryFee = orderType === "pickup"
            ? 0
            : firstDeliveryFree ? 0 : calculateDeliveryFee(subtotal);

        const platformFee = PLATFORM_FEE;
        const totalAmount = subtotal + deliveryFee + platformFee;

        const orderItems = items.map((item) => ({
            productId: mongoose.Types.ObjectId.isValid(item._id)
                ? new mongoose.Types.ObjectId(item._id)
                : null,
            name:     item.name,
            quantity: item.quantity,
            price:    item.price,
            image:    item.image ?? "",
        }));

        const order = await Order.create({
            ...body,
            items:        orderItems,
            orderId:      generateOrderId(),
            deliveryFee,
            platformFee,
            totalAmount,
            paymentMethod:              body.paymentMethod ?? "cod",
            isFirstDeliveryFreeApplied: firstDeliveryFree,
            ...(linkedUserId ? { user: linkedUserId } : {}),
        });

        if (firstDeliveryFree) {
            consumeFirstFreeDelivery(linkedUserId).catch((err) =>
                console.error("[firstFreeDelivery] consumeFirstFreeDelivery failed (non-fatal):", err)
            );
        }

        return NextResponse.json(
            {
                success:                    true,
                message:                    "Order created successfully",
                order,
                isFirstDeliveryFreeApplied: firstDeliveryFree,
            },
            { status: 201 }
        );
    } catch (error) {
        console.error("CREATE_ORDER_ERROR", error);
        return NextResponse.json(
            { success: false, message: "Failed to place order" },
            { status: 500 }
        );
    }
}
