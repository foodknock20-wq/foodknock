// src/lib/createOrderCore.ts
//
// ── SINGLE SOURCE OF TRUTH FOR ORDER CREATION ────────────────────────────────
//
// Used by:
//   • /api/payment/verify    (Razorpay online payment)
//   • /api/orders/cod        (Cash on Delivery)
//
// Handles:
//   1. Duplicate-payment guard  (razorpayPaymentId uniqueness, COD omits field)
//   2. Stock validation + decrement
//   3. Review Reward check
//   4. First-free-delivery check + consume
//   5. Loyalty point redemption (server-validated, ObjectId-safe)
//   6. Order document creation
//   7. Telegram admin notification
//   8. Order confirmation email (customer, when an email is available)
//   9. Admin new-order alert email
//  10. Order-placed transactional push notification (logged-in users only)
//
// FIX: razorpayPaymentId / razorpayOrderId are NEVER written as null.
//      For COD orders these fields are completely omitted from orderData so
//      MongoDB's sparse-unique index on razorpayPaymentId never sees a null
//      and E11000 duplicate-key errors cannot occur.
//
// PERF PASS (Orders/Loyalty audit):
//   1. Loyalty-balance lookup and customer-email lookup — previously TWO
//      separate `User.findById()` calls later in this function — are now
//      ONE combined lookup (`linkedUserSnapshot`), fetched once and reused
//      by both the redemption-cap check and the confirmation/admin-alert
//      emails. Same fields, same values, same error handling.
//      Expected Mongo: -1 query per order placed by a logged-in user.
//      Expected CPU/Duration: one fewer awaited round trip on the hot
//      checkout path (every COD + every Razorpay order).
//   2. [SUPERSEDED by Phase 5 — see the stock-decrement block itself] Stock
//      validation+decrement used to be a separate read-then-write pair
//      (Product.find, then product.save()) — fast, but not race-safe across
//      concurrent requests. Phase 5 replaced it with one atomic
//      findOneAndUpdate per item (check-and-decrement in a single DB
//      operation) plus a compensating rollback if any item in the same
//      order loses that race. No Mongo transactions are used here (Atlas
//      free-tier restriction, see loyaltyService.ts) — the atomic
//      conditional update + rollback is the serverless-safe equivalent.

import mongoose from "mongoose";
import crypto   from "crypto";

import { connectDB }             from "@/lib/db";
import Order                     from "@/models/Order";
import Product                   from "@/models/Product";
import User                      from "@/models/User";
import ReviewReward               from "@/models/ReviewReward";
import { generateOrderId }       from "@/lib/utils";
import { PLATFORM_FEE } from "@/lib/delivery";
import { consumeFirstFreeDelivery } from "@/lib/firstFreeDelivery";
import { calculateDeliveryPricing } from "@/lib/serviceability";
import { buildGoogleMapsNavigationUrl, escapeUrlForHtmlAttr } from "@/lib/googleMapsLink";
import { formatDistance } from "@/lib/formatDistance";
import {
    validateCoupon,
    reserveCouponUsage,
    releaseCouponUsage,
    linkCouponRedemptionToOrder,
} from "@/lib/coupons";
import { getBestAutomaticOffer, reserveOfferUsage, releaseOfferUsage } from "@/lib/offers";
import { selectBestPromotion } from "@/lib/promotions";
import {
    redeemPoints,
    LOYALTY_CONFIG,
    pointsToRupees,
} from "@/lib/loyaltyService";
import { sendOrderConfirmationEmail, sendAdminOrderAlertEmail } from "@/lib/mailer";
import { notificationEngine } from "@/lib/notifications";

import { COD_MAX_ORDER_AMOUNT } from "@/lib/constants";

const REVIEW_REWARD_MIN_SUBTOTAL = 150;

// Phase 10B: this message is sent with parse_mode:"HTML" — Telegram's HTML
// subset requires &, <, > to be escaped in ANY interpolated text (not just
// the mapsUrl href fixed above). A customer-typed address/note/landmark
// containing a bare "&" or "<" would corrupt the whole message the same
// way the Maps link did. Applied to every dynamic text field below.
function escapeTelegramHtml(text: string): string {
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// ── Telegram ──────────────────────────────────────────────────────────────────
async function notifyAdminTelegram(params: {
    orderId:                    string;
    customerName:               string;
    phone:                      string;
    address:                    string;
    landmark:                   string;
    note:                       string;
    items:                      Array<{ name: string; quantity: number; price: number }>;
    totalAmount:                number;
    orderType:                  string;
    paymentMethod:              string;
    isFirstDeliveryFreeApplied: boolean;
    reviewRewardApplied:        boolean;
    loyaltyPointsRedeemed:      number;
    loyaltyAmountSaved:         number;
    deliveryFee:                number;
    distanceKm:                 number | null;
    mapsUrl:                    string | null;
    deliveryInstructions:       string;
    couponCode:                 string | null;
    couponDiscountAmount:       number;
}) {
    try {
        const botToken = process.env.TELEGRAM_BOT_TOKEN;
        const chatId   = process.env.TELEGRAM_CHAT_ID;
        if (!botToken || !chatId) { console.warn("Telegram env vars missing"); return; }

        const itemLines = params.items
            .map((i) => `• ${escapeTelegramHtml(i.name)} ×${i.quantity} — ₹${i.price * i.quantity}`)
            .join("\n");

        const loyaltyLine = params.loyaltyPointsRedeemed > 0
            ? `\n✨ <b>Loyalty: ${params.loyaltyPointsRedeemed} pts redeemed (−₹${params.loyaltyAmountSaved} discount)</b>`
            : "";

        const paymentEmoji = params.paymentMethod === "cod" ? "💵" : "💳";

        // Phase 10: distance/fee/navigation — omitted gracefully when
        // coordinates aren't available (pickup orders, or a customer
        // location with no coordinates yet). Never dumps raw lat/lng.
        const deliveryLine = params.orderType === "pickup"
            ? ""
            : `\n🛵 <b>Delivery:</b> ${params.deliveryFee > 0 ? `₹${params.deliveryFee}` : "FREE"}${params.distanceKm !== null ? ` (${formatDistance(params.distanceKm)})` : ""}`;
        // BUG FIX (Phase 10B): Telegram's parse_mode:"HTML" requires `&`
        // inside attribute values to be escaped as `&amp;`. The raw
        // mapsUrl contains unescaped `&` in its query string
        // (?api=1&destination=...&travelmode=...) — without this escape,
        // Telegram's HTML parser truncates the href at the first bare `&`,
        // which is the actual cause of the "/maps/dir was not found on
        // this server. 404" symptom (the browser opened a cut-off/
        // relative-looking URL, not a real Google Maps link).
        const navLine = params.mapsUrl
            ? `\n📍 <b>Navigate to customer:</b> <a href="${escapeUrlForHtmlAttr(params.mapsUrl)}">Google Maps</a>`
            : "";

        const instructionsLine = params.deliveryInstructions
            ? `\n📋 <b>Delivery Instructions:</b> ${escapeTelegramHtml(params.deliveryInstructions)}`
            : "";

        const couponLine = params.couponCode
            ? `\n🎟️ <b>Coupon:</b> ${escapeTelegramHtml(params.couponCode)} (−₹${params.couponDiscountAmount})`
            : "";

        const text = `
🔥 <b>New Order — FoodKnock</b>

🧾 <b>Order ID:</b> <code>${params.orderId}</code>
👤 <b>Customer:</b> ${escapeTelegramHtml(params.customerName)}
📞 <b>Phone:</b> ${escapeTelegramHtml(params.phone)}
🛵 <b>Type:</b> ${params.orderType}
${paymentEmoji} <b>Payment:</b> ${params.paymentMethod.toUpperCase()}
📍 <b>Address:</b> ${escapeTelegramHtml(params.address || "-")}
🏷️ <b>Landmark:</b> ${escapeTelegramHtml(params.landmark || "-")}
📝 <b>Note:</b> ${escapeTelegramHtml(params.note || "-")}${instructionsLine}${deliveryLine}${navLine}
${params.reviewRewardApplied ? "\n🎁 <b>Review Reward Applied!</b>" : ""}${couponLine}${loyaltyLine}

🛒 <b>Items:</b>
${itemLines}

💰 <b>Total charged:</b> ₹${params.totalAmount}
`.trim();

        await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method:  "POST",
            headers: { "Content-Type": "application/json" },
            body:    JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
        });
    } catch (err) {
        console.error("TELEGRAM ERROR", err);
    }
}

// ── Input & Output types ──────────────────────────────────────────────────────

export interface CreateOrderInput {
    paymentMethod:           "razorpay" | "cod";
    customerName:            string;
    phone:                   string;
    address:                 string;
    landmark?:               string;
    note?:                   string;
    // Phase 10B — rider-facing delivery guidance, distinct from `note`.
    deliveryInstructions?:   string;
    orderType:               string;
    items:                   Array<{
        _id:       string;
        name:      string;
        price:     number;
        quantity:  number;
        image?:    string;
    }>;
    linkedUserId:            string | null;
    // Phase 10 — customer's delivery coordinates, informational from the
    // caller's point of view only: calculateDeliveryPricing() below is what
    // actually decides serviceability/fee server-side, never the client.
    latitude?:               number | null;
    longitude?:              number | null;
    // Razorpay-specific — intentionally optional (never default to null)
    razorpayOrderId?:        string;
    razorpayPaymentId?:      string;
    razorpaySignature?:      string;
    // Loyalty — server-validated point count (0 when not used)
    validatedRedeemPoints?:  number;
    // Phase 11 — coupon. EXACTLY ONE of these is ever provided per request:
    //   couponCode     — COD / legacy-verify-fallback. createOrderCore runs
    //                    validateCoupon() itself against ITS OWN
    //                    authoritative subtotal (never trusts an upstream
    //                    discount figure).
    //   couponSnapshot — Razorpay reconciled path. The discount amount was
    //                    already locked in at /api/payment/create-order
    //                    time (same "snapshot" trust model as item prices
    //                    — see src/lib/pricing.ts) and is NOT recomputed
    //                    here. The usage-limit RESERVATION below is still
    //                    always performed fresh, regardless of which mode.
    couponCode?:             string | null;
    couponSnapshot?: {
        couponId:       string;
        code:           string;
        discountType:   "FIXED" | "PERCENTAGE" | "FREE_DELIVERY";
        discountValue:  number;
        discountAmount: number;
    } | null;
    // Phase 12 — automatic offer, Razorpay-reconciled path only. Trusted
    // as-is (same snapshot model as couponSnapshot above). COD/legacy never
    // provide this — createOrderCore derives it itself via
    // getBestAutomaticOffer() when no coupon is present (see below).
    offerSnapshot?: {
        offerId:        string;
        campaignId:     string | null;
        name:           string;
        discountType:   "FIXED" | "PERCENTAGE" | "FREE_DELIVERY";
        discountValue:  number;
        discountAmount: number;
        freeDelivery:   boolean;
    } | null;
}

export interface CreateOrderResult {
    orderId:                    string;
    order:                      unknown;
    reviewRewardApplied:        boolean;
    loyaltyPointsRedeemed:      number;
    isFirstDeliveryFreeApplied: boolean;
    couponDiscountAmount:       number;
}

// ── Core function ─────────────────────────────────────────────────────────────

export async function createOrderCore(
    input: CreateOrderInput
): Promise<CreateOrderResult> {
    await connectDB();

    const {
        paymentMethod,
        customerName,
        phone,
        address,
        landmark = "",
        note     = "",
        deliveryInstructions = "",
        orderType,
        items: rawItems,
        linkedUserId,
        latitude  = null,
        longitude = null,
        // ⚠️  NO default = null here — keep these as undefined when absent
        //     so they are never written to the DB as null.
        razorpayOrderId,
        razorpayPaymentId,
        validatedRedeemPoints: clientValidatedPoints = 0,
        couponCode     = null,
        couponSnapshot = null,
        offerSnapshot: trustedOfferSnapshot = null,
    } = input;

    // ── Duplicate guard (Razorpay only) ───────────────────────────────────
    // Only run when we actually have a payment ID (never for COD).
    if (paymentMethod === "razorpay" && razorpayPaymentId) {
        const existing = await Order.findOne({ razorpayPaymentId }).lean();
        if (existing) {
            return {
                orderId:                    (existing as any).orderId,
                order:                      existing,
                reviewRewardApplied:        false,
                loyaltyPointsRedeemed:      0,
                isFirstDeliveryFreeApplied: (existing as any).isFirstDeliveryFreeApplied ?? false,
                couponDiscountAmount:       (existing as { coupon?: { discountAmount?: number } }).coupon?.discountAmount ?? 0,
            };
        }
    }

    // ── Stock validation + decrement — ATOMIC per item (Phase 5) ───────────
    //
    // PREVIOUSLY: Product.find() loaded full documents, a plain JS loop
    // checked `product.stock < item.quantity`, then every item's decremented
    // stock was written back via product.save(). That's a classic
    // read-then-write race: two concurrent orders for the same product
    // (stock=1, two customers checking out at once) could both read
    // stock=1, both pass validation, and both save() stock=0 — overselling
    // by one unit, since plain-scalar-field save() carries no optimistic
    // lock in Mongoose by default.
    //
    // FIX: each item's check-and-decrement is now a single atomic
    // conditional update — `findOneAndUpdate({_id, stock:{$gte:qty}}, {$inc})`
    // — so the DB itself, not application code, is what decides whether
    // enough stock existed at the instant of the write. Only one of two
    // concurrent requests can ever win for the last unit; the other
    // legitimately fails with "insufficient stock" instead of overselling.
    //
    // If ANY item in this order loses that race (or the product no longer
    // exists), every item that WAS already decremented in this same
    // attempt is rolled back before throwing — this is what prevents the
    // "stock deducted but order creation failed" partial state (no Mongo
    // multi-document transactions are available on this deployment; see
    // loyaltyService.ts's header comment for why — this compensating-action
    // pattern is the serverless-safe equivalent for a single order's item
    // list).
    const stockResults = await Promise.allSettled(
        rawItems.map(async (item) => {
            if (!mongoose.Types.ObjectId.isValid(item._id)) {
                throw Object.assign(new Error(`${item.name} not found`), { status: 404 });
            }

            const updated = await Product.findOneAndUpdate(
                { _id: item._id, stock: { $gte: item.quantity } },
                { $inc: { stock: -item.quantity } },
                { new: true }
            ).select("_id name stock");

            if (!updated) {
                const current = await Product.findById(item._id).select("name stock").lean<{ name: string; stock: number } | null>();
                if (!current) {
                    throw Object.assign(new Error(`${item.name} not found`), { status: 404 });
                }
                throw Object.assign(
                    new Error(`${current.name} only has ${current.stock} left`),
                    { status: 400 }
                );
            }

            if (updated.stock <= 0) {
                // Separate, best-effort write — not worth failing the whole
                // order over; the next stock read/admin view will still be
                // correct even if this particular flag flip is briefly stale.
                Product.updateOne({ _id: item._id }, { $set: { isAvailable: false, stock: 0 } }).catch(
                    (err) => console.error("STOCK_ZERO_FLAG_ERROR", { productId: item._id, err })
                );
            }

            return { _id: item._id, quantity: item.quantity };
        })
    );

    const stockFailures = stockResults.filter(
        (r): r is PromiseRejectedResult => r.status === "rejected"
    );
    const stockSuccesses = stockResults.filter(
        (r): r is PromiseFulfilledResult<{ _id: string; quantity: number }> => r.status === "fulfilled"
    );

    // Reusable compensating action — called at EVERY throw point between
    // here and Order.create succeeding. Found during Phase 12 financial
    // QA (not a Phase-12-introduced bug — this gap existed for every
    // order-creation failure mode, e.g. a stale minimum-order check,
    // before coupons/offers ever existed; Phase 12's coupon-validation
    // and atomic-reservation throw points are just what surfaced it
    // concretely). Idempotent to call with an empty/already-settled list.
    const decrementedItems = stockSuccesses.map((r) => r.value);
    async function rollbackDecrementedStock(reason: string): Promise<void> {
        if (decrementedItems.length === 0) return;
        await Promise.all(
            decrementedItems.map((item) =>
                Product.updateOne({ _id: item._id }, { $inc: { stock: item.quantity } }).catch((err) =>
                    console.error("STOCK_ROLLBACK_FAILED", { productId: item._id, reason, error: err })
                )
            )
        );
    }

    if (stockFailures.length > 0) {
        await rollbackDecrementedStock("stock_race_partial_failure");
        throw stockFailures[0].reason;
    }

    // ── Subtotal ──────────────────────────────────────────────────────────
    const subtotal: number = rawItems.reduce(
        (sum, i) => sum + i.price * i.quantity,
        0
    );

    // ── Coupon + Offer (Phase 11/12 finalization) ──────────────────────────
    // LOCKED RULE (spec Part W): at most one promotional discount source
    // per order, but when BOTH a valid coupon AND an eligible automatic
    // offer exist, the BEST one (by effective rupee value) wins — not
    // "coupon always wins because it's present". The actual winner is
    // picked below, after calculateDeliveryPricing() gives us the base
    // delivery fee needed to compare a FREE_DELIVERY promotion against a
    // rupee-value one on equal terms (src/lib/promotions.ts).
    //
    // Both candidates are computed unconditionally — an explicitly invalid
    // coupon code still throws immediately (a customer who typed a code
    // deserves to know it didn't work, not have it silently dropped in
    // favor of an automatic offer). Usage-limit RESERVATION for whichever
    // wins happens much later, immediately before Order.create, so nothing
    // is ever consumed by an order that then fails to create.
    let couponCandidate: Parameters<typeof selectBestPromotion>[0]["coupon"] = null;

    if (couponSnapshot) {
        // Razorpay reconciled path — amount was locked in at create-order
        // time, same snapshot-trust model as item prices (src/lib/pricing.ts).
        // NOT recomputed here.
        couponCandidate = {
            source: "coupon",
            id: couponSnapshot.couponId,
            campaignId: null,
            code: couponSnapshot.code,
            name: couponSnapshot.code,
            discountType: couponSnapshot.discountType,
            discountValue: couponSnapshot.discountValue,
            discountAmount: couponSnapshot.discountAmount,
            freeDelivery: couponSnapshot.discountType === "FREE_DELIVERY",
        };
    } else if (couponCode) {
        // COD / legacy-verify-fallback — validated fresh against OUR OWN
        // authoritative subtotal. Never trusts an upstream discount figure.
        const couponResult = await validateCoupon({ code: couponCode, subtotal, userId: linkedUserId });
        if (!couponResult.valid) {
            await rollbackDecrementedStock("invalid_coupon");
            throw Object.assign(new Error(couponResult.message), { status: 400 });
        }
        couponCandidate = {
            source: "coupon",
            id: couponResult.couponId,
            campaignId: null,
            code: couponResult.code,
            name: couponResult.code,
            discountType: couponResult.discountType,
            discountValue: couponResult.discountValue,
            discountAmount: couponResult.discountAmount,
            freeDelivery: couponResult.freeDelivery,
        };
    }

    // Automatic campaign offer — always evaluated (not gated on coupon
    // presence) so selectBestPromotion() below has both candidates to
    // compare. Purely passive: no client input, no error if none eligible.
    const offerLookup = trustedOfferSnapshot ?? (await getBestAutomaticOffer({ subtotal, linkedUserId }));
    const offerCandidate: Parameters<typeof selectBestPromotion>[0]["offer"] = offerLookup
        ? {
              source: "offer",
              id: offerLookup.offerId,
              campaignId: offerLookup.campaignId,
              code: null,
              name: offerLookup.name,
              discountType: offerLookup.discountType,
              discountValue: offerLookup.discountValue,
              discountAmount: offerLookup.discountAmount,
              freeDelivery: offerLookup.freeDelivery,
          }
        : null;

    // ── Review Reward ─────────────────────────────────────────────────────
    let reviewRewardApplied    = false;
    let reviewRewardRewardItem: string | null = null;

    if (linkedUserId && subtotal >= REVIEW_REWARD_MIN_SUBTOTAL) {
        const claimed = await ReviewReward.findOneAndUpdate(
            { user: linkedUserId, status: "approved", rewardUsed: false },
            { $set: { rewardUsed: true } },
            { new: false, returnDocument: "before" }
        ).lean<{ rewardItem: string } | null>();

        if (claimed) {
            reviewRewardApplied    = true;
            reviewRewardRewardItem = claimed.rewardItem ?? "burger";
        }
    }

    // ROOT CAUSE FIX (Orders 2.0 / Reorder reliability audit) — `rawItems`
    // (both from calculateAuthoritativePricing()'s AuthoritativeOrderItem
    // shape and the CreateOrderParams.items type above) carries the
    // product's id under the key `_id`, never `productId`. OrderItemSchema
    // (src/models/Order.ts) has its OWN `productId` field and `_id: false`
    // on the subdocument — so Mongoose silently discarded the unrecognized
    // `_id` key on cast and `productId` fell back to its schema default of
    // `null` for EVERY item of EVERY order ever created through this path.
    // That's why Reorder (which resolves historical items by productId)
    // always showed "these items are currently unavailable" even for
    // perfectly real, in-stock products — the order's own snapshot never
    // actually recorded which product each line item was. The free
    // review-reward item below already correctly set `productId: null`
    // (it isn't a real orderable product) — real items now get the same
    // treatment, just mapped from the id they actually have.
    const itemsWithProductId = rawItems.map((item) => ({ ...item, productId: item._id }));

    const finalItems = reviewRewardApplied
        ? [
              ...itemsWithProductId,
              {
                  name:      reviewRewardRewardItem === "pizza" ? "Free Pizza 🍕" : "Free Burger 🍔",
                  quantity:  1,
                  price:     0,
                  image:     "",
                  productId: null,
              },
          ]
        : itemsWithProductId;

    // ── Serviceability + delivery pricing (Phase 10) ───────────────────────
    // THE authoritative calculation — client-supplied deliveryFee/distance/
    // serviceable (if the caller even forwarded any) are never trusted.
    // Re-validated here regardless of what checkout displayed, exactly like
    // calculateAuthoritativePricing() already does for item prices.
    const pricing = await calculateDeliveryPricing({
        latitude,
        longitude,
        cartSubtotal: subtotal,
        linkedUserId,
        orderType,
    });

    if (orderType === "delivery" && !pricing.serviceable) {
        // Phase 10 — "address text exists" and "valid coordinates exist"
        // are NOT the same thing (a typed address alone can't be used to
        // calculate distance). Distinguish the two so a customer who
        // typed a full address isn't told to "select" something they
        // already entered — they need to PIN it, not re-select it.
        const message = pricing.reason === "coordinates_required"
            ? "Set your delivery location to calculate delivery distance — pin your exact spot on the map."
            : "This delivery location is outside FoodKnock's current delivery area.";
        await rollbackDecrementedStock("not_serviceable");
        throw Object.assign(new Error(message), { status: 400 });
    }

    // Server-authoritative minimum order (Phase 10 — this was previously
    // enforced client-side ONLY in checkout/page.tsx and cart/page.tsx;
    // there was no server-side check here at all).
    if (subtotal < pricing.minimumOrderValue) {
        await rollbackDecrementedStock("below_minimum_order");
        throw Object.assign(
            new Error(`Minimum order amount is ₹${pricing.minimumOrderValue}`),
            { status: 400 }
        );
    }

    const firstDeliveryFree = pricing.freeDeliveryReason === "first_order";

    // ── Winner selection (Phase 12 finalization, Part W) ───────────────────
    // Now that pricing.deliveryFee (the base fee BEFORE any promotion) is
    // known, pick whichever candidate is worth more. A FREE_DELIVERY
    // promotion zeroes deliveryFee directly — it never discounts the
    // subtotal (calculateCouponDiscount() already returns 0 for that type).
    const promotion = selectBestPromotion({
        coupon: couponCandidate,
        offer: offerCandidate,
        baseDeliveryFee: pricing.deliveryFee,
    });

    const resolvedCoupon = promotion.source === "coupon"
        ? {
              couponId:      promotion.couponId as string,
              code:          promotion.code as string,
              discountType:  promotion.discountType as "FIXED" | "PERCENTAGE" | "FREE_DELIVERY",
              discountValue: promotion.discountValue as number,
          }
        : null;

    const resolvedOffer = promotion.source === "offer"
        ? {
              offerId:        promotion.offerId as string,
              campaignId:     promotion.campaignId,
              name:           promotion.name as string,
              discountType:   promotion.discountType as "FIXED" | "PERCENTAGE" | "FREE_DELIVERY",
              discountValue:  promotion.discountValue as number,
              discountAmount: promotion.discountAmount,
              freeDelivery:   promotion.freeDelivery,
          }
        : null;

    const couponDiscountAmount = promotion.discountAmount;
    const deliveryFee = promotion.freeDelivery ? 0 : pricing.deliveryFee;

    // Coupon/offer discounts the product subtotal only — delivery fee/
    // platform fee are computed above from the RAW subtotal and are never
    // themselves discounted except via the FREE_DELIVERY override above.
    const discountedSubtotal = Math.max(0, subtotal - couponDiscountAmount);
    const grossTotal = discountedSubtotal + deliveryFee + PLATFORM_FEE;

    if (paymentMethod === "cod" && grossTotal >= COD_MAX_ORDER_AMOUNT) {
        await rollbackDecrementedStock("cod_cap_exceeded");
        throw Object.assign(
            new Error(`COD not available above ₹${COD_MAX_ORDER_AMOUNT}`),
            { status: 400 }
        );
    }

    // ── PERF: single combined lookup for loyaltyPoints + email ─────────────
    // Replaces what were previously TWO separate User.findById() calls
    // later in this function (one for the loyalty-redemption balance check
    // below, one for the order-confirmation/admin-alert email lookup
    // further down) with ONE query, executed once, whenever a logged-in
    // user is placing the order. Same fields, same values, same error
    // handling as before — only the number of round trips changes.
    const linkedUserSnapshot: { loyaltyPoints?: number; email?: string } | null =
        linkedUserId
            ? await User.findById(linkedUserId)
                  .select("loyaltyPoints email")
                  .lean()
                  .catch((err) => {
                      console.error("LINKED_USER_LOOKUP_ERROR", err);
                      return null;
                  })
            : null;

    // ── Loyalty: security cap ─────────────────────────────────────────────
    let verifiedRedeemPoints = 0;
    let redeemedAmount       = 0;

    const echoedPoints = Math.max(0, Math.floor(Number(clientValidatedPoints ?? 0)));

    if (linkedUserId && echoedPoints >= LOYALTY_CONFIG.MIN_REDEEM_POINTS) {
        const liveBalance = Number(linkedUserSnapshot?.loyaltyPoints ?? 0);

        const capped = Math.min(echoedPoints, liveBalance);
        if (capped >= LOYALTY_CONFIG.MIN_REDEEM_POINTS) {
            verifiedRedeemPoints = capped;
            redeemedAmount       = pointsToRupees(verifiedRedeemPoints);
        }
    }

    // ── Total ─────────────────────────────────────────────────────────────
    const totalAmount = Math.max(1, grossTotal - redeemedAmount);

    // ── Build orderData — razorpay fields added ONLY when present ─────────
    //
    // CRITICAL: razorpayPaymentId has a unique sparse index in MongoDB.
    // A sparse index ignores documents where the field is absent (undefined),
    // but it DOES index null values — so multiple nulls trigger E11000.
    // Solution: never include these keys unless they hold a real string value.
    //
    const newOrderId = generateOrderId();

    const orderData: Record<string, unknown> = {
        orderId:      newOrderId,
        customerName: customerName?.trim(),
        phone:        phone?.trim(),
        address:      orderType === "delivery" ? address?.trim() : "Pickup",
        landmark,
        note,
        orderType,
        items:        finalItems,
        deliveryFee,
        platformFee:  PLATFORM_FEE,
        // Phase 10: delivery location snapshot — never recalculated later.
        deliveryLatitude:   orderType === "delivery" ? latitude  : null,
        deliveryLongitude:  orderType === "delivery" ? longitude : null,
        distanceKm:         orderType === "delivery" ? pricing.distanceKm : null,
        freeDeliveryReason: pricing.freeDeliveryReason,
        deliveryInstructions: orderType === "delivery" ? deliveryInstructions : "",
        totalAmount,
        redeemedPoints: verifiedRedeemPoints,
        redeemedAmount,
        // Phase 11 — coupon snapshot, never recalculated from the current
        // Coupon document later (see Order.ts header comment on this field).
        coupon: resolvedCoupon
            ? {
                  couponId:       resolvedCoupon.couponId,
                  code:           resolvedCoupon.code,
                  discountType:   resolvedCoupon.discountType,
                  discountValue:  resolvedCoupon.discountValue,
                  discountAmount: couponDiscountAmount,
              }
            : { couponId: null, code: null, discountType: null, discountValue: null, discountAmount: 0 },
        offer: resolvedOffer
            ? {
                  offerId:        resolvedOffer.offerId,
                  campaignId:     resolvedOffer.campaignId,
                  name:           resolvedOffer.name,
                  discountType:   resolvedOffer.discountType,
                  discountValue:  resolvedOffer.discountValue,
                  discountAmount: resolvedOffer.discountAmount,
              }
            : { offerId: null, campaignId: null, name: null, discountType: null, discountValue: null, discountAmount: 0 },
        status:       "received",
        paymentMethod,
        isFirstDeliveryFreeApplied: firstDeliveryFree,
        ...(linkedUserId ? { user: linkedUserId } : {}),
    };

    // ✅ Razorpay fields: only written when paymentMethod is razorpay AND the
    //    values are non-empty strings. This guarantees the field is either a
    //    real unique string or completely absent — never null.
    if (paymentMethod === "razorpay" && razorpayPaymentId) {
        orderData.razorpayPaymentId = razorpayPaymentId;
        // razorpayOrderId is useful for support but not indexed; still guard it.
        if (razorpayOrderId) {
            orderData.razorpayOrderId = razorpayOrderId;
        }
    }

    // 🛡️  Belt-and-suspenders safety: if either field somehow crept in as a
    //     falsy value (null / undefined / ""), remove it entirely so MongoDB
    //     never receives it.
    if (!orderData.razorpayPaymentId) delete orderData.razorpayPaymentId;
    if (!orderData.razorpayOrderId)   delete orderData.razorpayOrderId;

    // ── Coupon: atomic usage reservation (Phase 11) ────────────────────────
    // Deliberately the LAST mutation before Order.create — this is the
    // instant a coupon is actually "spent", never earlier (not at
    // /api/coupons/validate, not at Razorpay create-order). If anything
    // below fails, the reservation is released in the catch block so the
    // coupon is never consumed by an order that didn't end up existing.
    let couponRedemptionId: string | null = null;
    if (resolvedCoupon && linkedUserId) {
        try {
            const reservation = await reserveCouponUsage({
                couponId:       resolvedCoupon.couponId,
                userId:         linkedUserId,
                discountAmount: couponDiscountAmount,
            });
            couponRedemptionId = reservation.redemptionId;
        } catch (err) {
            // Lost the reservation race (or coupon became unavailable) —
            // stock was already decremented above and must not be leaked.
            await rollbackDecrementedStock("coupon_reservation_failed");
            throw err;
        }
    }

    // ── Offer: atomic usage reservation (Phase 12) ─────────────────────────
    // Same placement/rollback discipline as the coupon reservation above.
    let offerReserved = false;
    if (resolvedOffer) {
        try {
            await reserveOfferUsage(resolvedOffer.offerId);
            offerReserved = true;
        } catch (err) {
            await rollbackDecrementedStock("offer_reservation_failed");
            throw err;
        }
    }

    // ── Create order — with a DB-level duplicate-key safety net ───────────
    // The PendingPayment atomic claim (see src/lib/paymentReconciliation.ts)
    // is the primary guard against the client-verify and webhook paths both
    // reaching this point for the same payment. This catch is a defense-in-
    // depth backstop (e.g. legacy callers that bypass the claim) relying on
    // the pre-existing unique+sparse index on razorpayPaymentId: if a
    // duplicate slips through, Mongo itself rejects the second insert and
    // we recover the already-created order instead of erroring or
    // double-decrementing stock a second time.
    let order;
    try {
        order = await Order.create(orderData);
    } catch (err: any) {
        // This attempt's own stock decrement (from earlier in this same
        // function call) is now orphaned regardless of which branch below
        // runs — including the duplicate-payment-recovery branch, where a
        // DIFFERENT request already created the real order (and already
        // decremented stock for itself); this attempt's decrement is pure
        // double-counting and must be given back either way.
        await rollbackDecrementedStock("order_create_failed");

        // The coupon reservation above (if any) is now orphaned regardless
        // of which branch below runs — release it before returning/throwing.
        if (couponRedemptionId && resolvedCoupon) {
            await releaseCouponUsage({ couponId: resolvedCoupon.couponId, redemptionId: couponRedemptionId });
        }
        if (offerReserved && resolvedOffer) {
            await releaseOfferUsage(resolvedOffer.offerId);
        }

        const isDuplicatePaymentId =
            err?.code === 11000 &&
            paymentMethod === "razorpay" &&
            razorpayPaymentId &&
            (err?.keyPattern?.razorpayPaymentId || String(err?.message ?? "").includes("razorpayPaymentId"));

        if (isDuplicatePaymentId) {
            const existing = await Order.findOne({ razorpayPaymentId }).lean();
            if (existing) {
                console.warn("DUPLICATE_ORDER_CREATE_RACE_RECOVERED", { razorpayPaymentId });
                return {
                    orderId:                    (existing as any).orderId,
                    order:                      existing,
                    reviewRewardApplied:        false,
                    loyaltyPointsRedeemed:      0,
                    isFirstDeliveryFreeApplied: (existing as any).isFirstDeliveryFreeApplied ?? false,
                    couponDiscountAmount:       (existing as { coupon?: { discountAmount?: number } }).coupon?.discountAmount ?? 0,
                };
            }
        }
        throw err;
    }

    // ── Link the coupon redemption to the now-existing order (Phase 11) ───
    // Best-effort, fire-and-forget — never blocks or fails order creation.
    // The redemption's atomicity guarantee already happened at the reserve
    // step above; this is just bookkeeping for admin/history display.
    if (couponRedemptionId) {
        linkCouponRedemptionToOrder(couponRedemptionId, String((order as any)._id)).catch(console.error);
    }

    // ── Consume first-free-delivery ───────────────────────────────────────
    if (firstDeliveryFree) {
        consumeFirstFreeDelivery(linkedUserId).catch(console.error);
    }

    // ── Deduct loyalty points ─────────────────────────────────────────────
    const pointsToDeduct = Number((order as any).redeemedPoints) || 0;

    if (linkedUserId && pointsToDeduct > 0) {
        try {
            await redeemPoints({
                userId:       linkedUserId,
                points:       pointsToDeduct,
                orderMongoId: String((order as any)._id), // ← _id, NOT orderId string
                note:         `Redeemed ${pointsToDeduct} pts at checkout — ₹${redeemedAmount} discount`,
            });
            console.log(
                `[loyalty] redeemed ${pointsToDeduct} pts for order ${newOrderId} (mongo: ${(order as any)._id})`
            );
        } catch (loyaltyErr) {
            console.error("LOYALTY_DEDUCTION_ERROR", {
                orderId:        newOrderId,
                orderMongoId:   String((order as any)._id),
                userId:         linkedUserId,
                pointsToDeduct,
                error:          loyaltyErr,
            });
            // Phase 17.1B: the order and payment are both already valid —
            // never reversed here. This only records, durably, that the
            // order's redeemedPoints/redeemedAmount snapshot no longer
            // matches what was actually deducted from the user's balance,
            // so it can be found by the read-only diagnostic
            // (findInconsistentLoyaltyRedemptions) and fixed via the one
            // explicit, admin-gated repair action
            // (retryFailedLoyaltyRedemption) — never automatically, never
            // as a side effect of a page load. Best-effort: a failure to
            // even WRITE this flag still leaves the order's own
            // redeemedPoints field as the fallback signal the diagnostic
            // cross-checks against the ledger regardless.
            Order.updateOne(
                { _id: (order as any)._id },
                {
                    $set: {
                        "loyaltyRedemptionFailure.failedAt": new Date(),
                        "loyaltyRedemptionFailure.reason": loyaltyErr instanceof Error ? loyaltyErr.message : "unknown error",
                    },
                }
            ).catch((flagErr) => console.error("LOYALTY_DEDUCTION_FAILURE_FLAG_ERROR", { orderMongoId: String((order as any)._id), flagErr }));
        }
    }

    // ── Telegram ──────────────────────────────────────────────────────────
    // Phase 10B fix: the navigation link's destination is the CUSTOMER —
    // never the kitchen. The kitchen coordinate is only ever used for the
    // distance/fee calculation above (pricing.distanceKm), never for
    // navigation. No origin is specified; whoever opens the link navigates
    // from wherever they currently are.
    const navMapsUrl = orderType === "delivery"
        ? buildGoogleMapsNavigationUrl(latitude, longitude)
        : null;

    notifyAdminTelegram({
        orderId:                    newOrderId,
        customerName,
        phone,
        address,
        landmark,
        note,
        items:                      finalItems,
        totalAmount,
        orderType,
        paymentMethod,
        isFirstDeliveryFreeApplied: firstDeliveryFree,
        reviewRewardApplied,
        loyaltyPointsRedeemed:      pointsToDeduct,
        loyaltyAmountSaved:         redeemedAmount,
        deliveryFee,
        distanceKm:                 pricing.distanceKm,
        mapsUrl:                    navMapsUrl,
        deliveryInstructions:       orderType === "delivery" ? deliveryInstructions : "",
        couponCode:                 resolvedCoupon?.code ?? null,
        couponDiscountAmount,
    }).catch(console.error);

    // ── Order-placed transactional push notification ──────────────────────
    // Only logged-in users have push subscriptions tied to their account
    // (guest checkout has no user to target — never broadcast this event).
    // Fire-and-forget with error isolation, same pattern as Telegram above:
    // a push failure must never affect order creation or the response.
    if (linkedUserId) {
        try {
            notificationEngine.emit({
                name: "order.placed",
                data: { orderId: newOrderId },
                target: { userId: linkedUserId },
            });
        } catch (pushErr) {
            console.error("ORDER_PLACED_PUSH_ERROR", pushErr);
        }
    }

    // ── Customer email (shared by confirmation + admin alert) ─────────────
    // PERF: sourced from linkedUserSnapshot fetched once above — no extra
    // query here. Preserves the exact same Promise<string | undefined>
    // shape the two .then() chains below already expect, so nothing
    // downstream needs to change.
    const customerEmailPromise: Promise<string | undefined> =
        Promise.resolve(linkedUserSnapshot?.email);

    // ── Order confirmation email (customer) ────────────────────────────────
    // Only sent when we actually have an email to send to. Fire-and-forget:
    // a failed/skipped email must never affect the order response.
    customerEmailPromise
        .then((customerEmail) => {
            if (!customerEmail) return;
            return sendOrderConfirmationEmail(customerEmail, {
                customerName,
                orderId:       newOrderId,
                items:         finalItems.map((i) => ({ name: i.name, quantity: i.quantity, price: i.price })),
                totalAmount,
                deliveryFee,
                platformFee:   PLATFORM_FEE,
                address:       orderData.address as string,
                orderType,
                paymentMethod,
                createdAt:     (order as unknown as { createdAt?: Date }).createdAt ?? new Date(),
            });
        })
        .catch((err) => console.error("ORDER_CONFIRMATION_EMAIL_ERROR", err));

    // ── Admin new-order alert email ────────────────────────────────────────
    customerEmailPromise
        .then((customerEmail) =>
            sendAdminOrderAlertEmail({
                orderId:         newOrderId,
                customerName,
                customerEmail,
                phone,
                address:         orderData.address as string,
                landmark,
                note,
                orderType,
                totalAmount,
                deliveryFee,
                platformFee:     PLATFORM_FEE,
                redeemedPoints:  verifiedRedeemPoints,
                redeemedAmount,
                paymentMethod,
                items:           finalItems.map((i) => ({ name: i.name, quantity: i.quantity, price: i.price })),
                createdAt:       (order as unknown as { createdAt?: Date }).createdAt ?? new Date(),
                distanceKm:      orderType === "delivery" ? pricing.distanceKm : null,
                mapsUrl:         navMapsUrl,
                deliveryInstructions: orderType === "delivery" ? deliveryInstructions : "",
                couponCode:      resolvedCoupon?.code ?? null,
                couponDiscountAmount,
            })
        )
        .catch((err) => console.error("ADMIN_ORDER_ALERT_EMAIL_ERROR", err));

    return {
        orderId:                    newOrderId,
        order,
        reviewRewardApplied,
        loyaltyPointsRedeemed:      pointsToDeduct,
        isFirstDeliveryFreeApplied: firstDeliveryFree,
        couponDiscountAmount,
    };
}