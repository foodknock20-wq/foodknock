// src/app/api/orders/route.ts
//
// PHASE 5: POST used to be a fully separate, duplicate order-creation
// engine — its own bulk product fetch, its own stock check-then-save loop
// (the exact same cross-request oversell race fixed in createOrderCore.ts —
// see that file's Phase 5 comment), its own pricing/order-building logic.
// Confirmed dead (no current frontend code calls POST /api/orders — the
// live COD flow is /api/orders/cod), but still a reachable endpoint, so it
// now converges onto the same canonical path everything else uses:
// calculateAuthoritativePricing() (Phase 2A) for pricing, createOrderCore()
// (the single order-creation authority) for stock/order/side-effects.
// Response shape (`order`, `isFirstDeliveryFreeApplied`) is preserved for
// any undiscovered caller; `orderId` is added as a convenience top-level
// field, not a breaking change.
//
// GET (admin order list) is unchanged.

import { NextRequest, NextResponse } from "next/server";
import { connectDB }     from "@/lib/db";
import Order             from "@/models/Order";
import User              from "@/models/User";
import { verifyToken }                        from "@/lib/auth";
import { requireAdmin }                       from "@/lib/apiAuth";
import { calculateAuthoritativePricing }      from "@/lib/pricing";
import { createOrderCore }                    from "@/lib/createOrderCore";

// Phase 17.2: previously a hand-rolled, JWT-claim-only isAdmin() check —
// never re-verified role/isActive against the live User document, meaning
// a demoted/deactivated admin's still-valid session kept access to this
// PII-bearing order list for up to 7 days. Now uses the project's
// centralized, DB-verified requireAdmin() (src/lib/apiAuth.ts).

// ─── GET /api/orders (admin only) ─────────────────────────────────────────
export async function GET(req: NextRequest) {
    const admin = await requireAdmin(req);
    if (!admin) {
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
        // Phase 17.4: OrderTable.tsx's 5-second "new order?" poll only ever
        // reads _id/customerName/totalAmount off the result (see that
        // file's poll() — toast/sound detection only, never renders the
        // full row). It was still requesting the full admin projection
        // (items, address, landmark, note, etc.) every 5 seconds for every
        // open admin tab. `fields=minimal` is opt-in and additive — every
        // existing caller that omits it gets byte-for-byte the same
        // response as before.
        const minimal = searchParams.get("fields") === "minimal";

        const query: Record<string, unknown> = {};
        if (status && status !== "all") query.status = status;
        if (search) {
            query.$or = [
                { customerName: { $regex: search, $options: "i" } },
                { phone:        { $regex: search, $options: "i" } },
                { orderId:      { $regex: search, $options: "i" } },
            ];
        }

        const orders = await Order.find(query)
            .sort({ createdAt: -1 })
            .limit(limit)
            .select(minimal
                ? "customerName totalAmount createdAt"
                : "orderId customerName phone address landmark orderType items totalAmount deliveryFee platformFee status paymentMethod razorpayOrderId razorpayPaymentId createdAt isFirstDeliveryFreeApplied note")
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

// ─── POST /api/orders (legacy — converges onto the canonical order core) ──
export async function POST(req: Request) {
    try {
        await connectDB();

        // Phase 9: guest checkout is no longer allowed anywhere, including
        // this documented-dead-but-still-reachable legacy path — mirrors
        // the same hard gate now enforced in /api/orders/cod and
        // /api/payment/create-order|verify. Previously an invalid/missing
        // token silently fell through to linkedUserId = null ("guest").
        const cookieHeader = req.headers.get("cookie") ?? "";
        const tokenMatch   = cookieHeader.match(/(?:^|;\s*)token=([^;]+)/);
        const token        = tokenMatch ? decodeURIComponent(tokenMatch[1]) : null;

        if (!token) {
            return NextResponse.json(
                { success: false, message: "Please log in to place an order" },
                { status: 401 }
            );
        }

        let linkedUserId: string;
        try {
            const decoded = verifyToken(token) as { userId?: string };
            if (!decoded?.userId) {
                return NextResponse.json(
                    { success: false, message: "Please log in to place an order" },
                    { status: 401 }
                );
            }
            const user = await User.findById(decoded.userId)
                .select("_id isActive")
                .lean() as { _id: unknown; isActive?: boolean } | null;
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
            linkedUserId = String(user._id);
        } catch {
            return NextResponse.json(
                { success: false, message: "Please log in to place an order" },
                { status: 401 }
            );
        }

        const body = await req.json();
        const orderType: string = body.orderType ?? "delivery";

        // PHASE 2A/5: client sends { _id, quantity } — price is never
        // trusted. calculateAuthoritativePricing also now rejects
        // insufficient stock up front (Phase 4/5), same as every other
        // order-creation entry point.
        const { items } = await calculateAuthoritativePricing(body.items ?? []);

        const result = await createOrderCore({
            paymentMethod: body.paymentMethod === "razorpay" ? "razorpay" : "cod",
            customerName:  String(body.customerName ?? "").trim(),
            phone:         String(body.phone ?? "").trim(),
            address:       String(body.address ?? "").trim(),
            landmark:      String(body.landmark ?? "").trim(),
            note:          String(body.note ?? "").trim(),
            orderType,
            items,
            linkedUserId,
            latitude:  typeof body.latitude  === "number" ? body.latitude  : null,
            longitude: typeof body.longitude === "number" ? body.longitude : null,
        });

        return NextResponse.json(
            {
                success:                    true,
                message:                    "Order created successfully",
                orderId:                    result.orderId,
                order:                      result.order,
                isFirstDeliveryFreeApplied: result.isFirstDeliveryFreeApplied,
            },
            { status: 201 }
        );
    } catch (error: any) {
        console.error("CREATE_ORDER_ERROR", error);
        return NextResponse.json(
            { success: false, message: error?.message || "Failed to place order" },
            { status: error?.status || 500 }
        );
    }
}