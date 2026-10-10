export const dynamic = "force-dynamic";

// src/app/api/orders/track/[orderId]/route.ts
//
// PHASE 3: intentionally public, unauthenticated "guest order tracking"
// endpoint, protected by a per-IP rate limit (src/lib/rateLimit.ts) against
// brute-forcing/guessing an orderId.
//
// PHASE 17.2 (F11): phone number masked to its last 4 digits here.
//
// PHASE 17.6: generateOrderId() (src/lib/utils.ts) suffix strengthened
// from 4 digits (9,000 possibilities) to 8 base36 characters (~2.8
// trillion), raising the cost of guessing a valid orderId in the first
// place.
//
// PHASE 17.7 — the actual fix for F11's residual risk (name/address
// exposure), not just a mitigation of it:
//
//   Re-investigating the full flow revealed that guest checkout was
//   already removed platform-wide (Phase 9 — see /api/orders/route.ts's
//   own comment: "guest checkout is no longer allowed anywhere"), so
//   EVERY order now has a real linked User. That means every legitimate
//   "track my order" need is already served by the ownership-checked,
//   authenticated GET /api/orders/my/[orderId] route (added for the
//   Reorder/Rate-Your-Order security audit — see that file's header).
//   The only two push-notification templates that still deep-linked to
//   THIS public route (order.preparing, order.out_for_delivery) have been
//   repointed to /my-orders/{orderId} in transactionalTemplates.ts,
//   matching what order.placed/order.delivered already did — every
//   transactional push already requires target.userId (enforced in
//   engine.ts), so the recipient is always the order's own authenticated
//   owner regardless of which URL is used.
//
//   With that, this endpoint no longer has any legitimate internal caller
//   that needs full PII — it now only serves someone manually typing an
//   orderId into the public /track-order search form without logging in.
//   Its response is therefore minimized to exactly what a status check
//   needs: order identity, items, total, type, timestamps, status/
//   cancellation info, and the already-masked phone. customerName,
//   address, and landmark are NO LONGER returned here. Both /track-order
//   pages (search form and deep-link variant) were updated to render a
//   generic "Order" heading and omit the address card instead of showing
//   blank fields — this is a planned, intentional response-shape change,
//   not a bug: any already-shared/bookmarked /track-order link still
//   resolves to a working status page, just without the PII that used to
//   be shown there. Anyone who wants full address/name detail on their
//   own order already gets it by logging in, at /my-orders/{orderId}.

import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import Order from "@/models/Order";
import mongoose from "mongoose";
import { isRateLimited, getClientIp } from "@/lib/rateLimit";
import { maskPhoneLast4 } from "@/lib/securityLogic";

type RouteContext = {
  params: Promise<{ orderId: string }>;
};

const TRACK_LIMIT = 20;        // lookups
const TRACK_WINDOW_MS = 10 * 60 * 1000; // per 10 minutes, per IP

export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const ip = getClientIp(req);
    const limited = await isRateLimited(`track-order:${ip}`, TRACK_LIMIT, TRACK_WINDOW_MS);
    if (limited) {
      return NextResponse.json(
        { success: false, message: "Too many lookups. Please try again in a few minutes." },
        { status: 429 }
      );
    }

    await connectDB();

    const { orderId: rawOrderId } = await context.params;
    const orderId = decodeURIComponent(rawOrderId).replace(/^#/, "").trim();

    if (!orderId) {
      return NextResponse.json(
        { success: false, message: "Order ID is required" },
        { status: 400 }
      );
    }

    const isObjectId = mongoose.Types.ObjectId.isValid(orderId);

    const order = await Order.findOne(
      isObjectId ? { $or: [{ orderId }, { _id: orderId }] } : { orderId }
    )
      // PHASE 17.7: customerName/address/landmark deliberately excluded —
      // see this file's header comment. Only what a status check needs.
      .select(
        "_id orderId phone orderType items totalAmount status note createdAt paymentMethod cancellation"
      )
      .lean();

    if (!order) {
      return NextResponse.json(
        {
          success: false,
          message: "No order found with that ID. Please check and try again.",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      order: { ...order, phone: maskPhoneLast4((order as { phone?: string }).phone) },
    });
  } catch (error) {
    console.error("TRACK_ORDER_ERROR", error);
    return NextResponse.json(
      { success: false, message: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}