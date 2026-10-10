// src/lib/notifications/transactionalTemplates.ts
// FoodKnock Notification Engine — transactional template registry.
//
// Deliberately separate from templates.ts (marketing/campaign templates).
// Transactional templates are user-specific order-lifecycle notifications
// and must never be broadcast — every event here requires `target.userId`
// to be set by the caller (enforced in engine.ts's handleEvent, not here).
//
// Two builders added below: loyalty.points_credited and
// referral.reward_granted. Both event names ALREADY EXISTED in
// types.ts's NotificationEventName union and were ALREADY in engine.ts's
// .listen() array before this change — neither file's event-name set was
// touched to support them. The business logic that should trigger them
// (loyaltyService.ts's handleOrderDelivered) already exists in the
// uploaded codebase; it simply never called notificationEngine.emit().
// This is that missing wiring, not a new event flow. No other event is
// introduced — no uploaded route emits or would emit one, so none is
// added here.

import type { NotificationAction, NotificationEvent, NotificationPayload } from "./types";

export type OrderEventData = {
    orderId: string;
    /**
     * Optional — only required by channels that need it (currently email's
     * order.delivered template, via sendOrderDeliveredEmail). Push templates
     * ignore it entirely; adding it here is additive and changes nothing
     * about push payload shape or behavior.
     */
    customerName?: string;
    /** Phase 14 — cancellation reason, order.cancelled only. */
    reason?: string;
};

const TRACK_ACTIONS: NotificationAction[] = [
    { action: "track", title: "Track Order" },
];

// PHASE 8B — deterministic per-event display tag.
//
// BUG: the production "Order Delivered arrives twice" report traced back
// to this: none of the order-lifecycle templates set `tag`, so
// webPushProvider.ts's toWebPushPayload() never forwarded one, and
// public/sw.js's push handler fell back to a RANDOM per-push-event tag
// (`"foodknock-" + Date.now() + ...`). Every emit()/send() path was
// already verified correct — changeOrderStatus() (Phase 5) guarantees
// order.delivered is EMITTED at most once per genuine transition, and
// webPushProvider.send() calls provider.send() exactly once per
// (channel, subscription) pair, no double-transport. The remaining,
// well-documented residual risk is TRANSPORT-level redelivery: Web
// Push/FCM can occasionally redeliver the same message more than once
// (rare, non-deterministic, outside this app's control) — and with a
// RANDOM tag, a redelivered copy of the identical event showed up as a
// SECOND, separate tray notification instead of collapsing into the
// first.
//
// FIX: each order-lifecycle event now carries a stable tag derived from
// its own identity — `order-{orderId}-{status}`. public/sw.js already
// prefers `data.tag` over its random fallback (unchanged code, see its
// push handler) and passes `renotify: true`, so if the exact same event
// is ever redelivered, the second showNotification() call REPLACES the
// existing tray entry (same orderId + same status = same tag) instead of
// stacking a duplicate. Different statuses for the same order still get
// different tags (order-X-preparing vs order-X-delivered), so the
// legitimate "preparing → out for delivery → delivered" sequence is
// completely unaffected — each still gets its own tray entry, exactly as
// before.
function orderStatusTag(orderId: string, status: string): string {
    return `order-${orderId}-${status}`;
}

function buildOrderPlacedPayload(event: NotificationEvent<OrderEventData>): NotificationPayload {
    const { orderId } = event.data;
    return {
        title: "Your FoodKnock order is confirmed 🎉",
        body: "We've got it — fresh food is about to be prepared for you.",
        url: `/my-orders/${orderId}`,
        category: "order_update",
        priority: "normal",
        tag: orderStatusTag(orderId, "placed"),
        actions: [
            { action: "track", title: "Track Order" },
            { action: "dismiss", title: "Later" },
        ],
        ctaButtons: [{ id: "track", label: "Track Order", url: `/my-orders/${orderId}` }],
        data: { orderId, kind: "order.placed" },
    };
}

// PHASE 17.7: both of these used to deep-link to the PUBLIC
// /track-order/{orderId} page. That was never actually necessary —
// guest checkout was already removed platform-wide (Phase 9), every
// order has a real linked User, and every transactional push already
// requires target.userId (engine.ts's safety rail), so the recipient here
// is always the order's own authenticated owner. Repointed to
// /my-orders/{orderId} — the already-ownership-checked, full-detail page
// (GET /api/orders/my/[orderId]) — matching what buildOrderPlacedPayload/
// buildOrderDeliveredPayload below already did. This is what let the
// public /track-order route's response be minimized to non-PII fields
// (see src/app/api/orders/track/[orderId]/route.ts's header comment)
// without losing any actual customer-facing functionality.
function buildOrderPreparingPayload(event: NotificationEvent<OrderEventData>): NotificationPayload {
    const { orderId } = event.data;
    return {
        title: "Your order is being prepared 👨‍🍳",
        body: "Fresh and hot — our kitchen is on it.",
        url: `/my-orders/${orderId}`,
        category: "order_update",
        priority: "normal",
        tag: orderStatusTag(orderId, "preparing"),
        actions: TRACK_ACTIONS,
        ctaButtons: [{ id: "track", label: "Track Order", url: `/my-orders/${orderId}` }],
        data: { orderId, kind: "order.preparing" },
    };
}

function buildOrderOutForDeliveryPayload(event: NotificationEvent<OrderEventData>): NotificationPayload {
    const { orderId } = event.data;
    return {
        title: "Your order is on the way 🛵",
        body: "Your rider has picked it up — get ready!",
        url: `/my-orders/${orderId}`,
        category: "order_update",
        priority: "high",
        tag: orderStatusTag(orderId, "out_for_delivery"),
        actions: [
            { action: "track", title: "Track Live" },
        ],
        ctaButtons: [{ id: "track", label: "Track Order", url: `/my-orders/${orderId}` }],
        data: { orderId, kind: "order.out_for_delivery" },
    };
}

function buildOrderDeliveredPayload(event: NotificationEvent<OrderEventData>): NotificationPayload {
    const { orderId, customerName } = event.data;
    return {
        title: "Order delivered — enjoy your meal 🍽️",
        body: "Your FoodKnock order has arrived. Thanks for ordering with us!",
        url: `/`,
        category: "order_update",
        priority: "high",
        tag: orderStatusTag(orderId, "delivered"),
        actions: [
            { action: "rate", title: "Rate Order" },
            { action: "reorder", title: "Order Again" },
        ],
        ctaButtons: [
            { id: "rate", label: "Review Now", url: `/reviews` },
            { id: "reorder", label: "Order Again", url: "/menu" },
        ],
        // customerName is push-irrelevant — included only so the Email
        // Delivery Provider can call the existing sendOrderDeliveredEmail()
        // without the engine or push provider needing to know it exists.
        data: { orderId, customerName, kind: "order.delivered" },
    };
}

// Phase 14 — cancellation. Mirrors the other order-lifecycle builders above
// exactly: same orderStatusTag() scheme (so a redelivered push collapses
// into the existing tray entry instead of stacking a duplicate — see that
// function's header comment), same TRACK_ACTIONS-less shape since there's
// nothing left to track.
function buildOrderCancelledPayload(event: NotificationEvent<OrderEventData>): NotificationPayload {
    const { orderId } = event.data;
    return {
        title: "Order cancelled",
        body: "Your FoodKnock order has been cancelled. If you paid online, any refund will be processed separately.",
        url: `/my-orders/${orderId}`,
        category: "order_update",
        priority: "high",
        tag: orderStatusTag(orderId, "cancelled"),
        ctaButtons: [{ id: "view", label: "View Order", url: `/my-orders/${orderId}` }],
        data: { orderId, kind: "order.cancelled" },
    };
}

export type OtpRequestedEventData = {
    otp: string;
    /** Which existing OTP email to send — sendOtpEmail (reset) vs sendSignupOtpEmail (signup). */
    flow: "reset" | "signup";
    /**
     * Phase 2 (Communication Layer): only ever set by the signup flow
     * (register/route.ts), and only because no User document exists yet
     * at that point (the account is created later, in verify-signup-otp
     * — see PendingSignup's own design). WhatsAppDeliveryProvider reads
     * these directly for the signup case instead of resolving via
     * target.userId, since there is genuinely no User to resolve yet.
     * Always absent for flow:"reset", where a real User (and userId)
     * already exists and the normal resolution path applies unchanged.
     */
    phone?: string;
    name?: string;
};

export type WelcomeEventData = Record<string, never>;

/**
 * Builds the payload for "auth.otp_requested" — email-only by default
 * (no push equivalent makes sense for an OTP code); the signup flow
 * additionally requests "whatsapp" explicitly (see register/route.ts) —
 * whoever emits/sends this for the reset flow must keep using
 * `channels: ["email"]` so no other provider is invoked for it.
 * Real content lives in `data`, read by EmailDeliveryProvider (which
 * dispatches to sendOtpEmail / sendSignupOtpEmail in mailer.ts) and, for
 * the signup flow only, WhatsAppDeliveryProvider.
 *
 * Exported (Phase 2): register/route.ts reuses this exact builder for
 * its WhatsApp send rather than constructing a second, duplicate payload
 * shape by hand.
 */
export function buildOtpRequestedPayload(event: NotificationEvent<OtpRequestedEventData>): NotificationPayload {
    const { otp, flow, phone, name } = event.data;
    return {
        title: "FoodKnock verification code",
        body: "Your verification code is ready.",
        data: { kind: "auth.otp_requested", otp, flow, phone, name },
    };
}

/**
 * Builds the payload for "user.welcome" — email-only today. Dispatches to
 * the existing sendWelcomeEmail in mailer.ts via EmailDeliveryProvider.
 */
function buildWelcomePayload(_event: NotificationEvent<WelcomeEventData>): NotificationPayload {
    return {
        title: "Welcome to FoodKnock",
        body: "Your account is ready.",
        data: { kind: "user.welcome" },
    };
}

// ── loyalty.points_credited / referral.reward_granted ─────────────────────
// Both event names PRE-EXISTED in types.ts's NotificationEventName union
// and in engine.ts's .listen() array (both files uploaded, unmodified for
// this purpose). Only the builders were missing — before this change,
// engine.ts's handleEvent() would find `buildPayload === undefined` for
// both names and silently no-op every time they fired. loyaltyService.ts's
// handleOrderDelivered() (uploaded, real, existing business logic) is
// where these are now emitted from — see that file.

export type LoyaltyPointsCreditedEventData = {
    points: number;
    balance: number;
    /** Free-form reason, reusing whatever note loyaltyService.ts already generated — no new copy invented here. */
    note?: string;
};

function buildLoyaltyPointsCreditedPayload(event: NotificationEvent<LoyaltyPointsCreditedEventData>): NotificationPayload {
    const { points, balance, note } = event.data;
    return {
        title: "💎 Loyalty points credited!",
        body: note || `You earned ${points} points. New balance: ${balance} points.`,
        url: "/loyalty",
        category: "reward",
        priority: "normal",
        ctaButtons: [{ id: "view", label: "View Points", url: "/loyalty" }],
        data: { points, balance, kind: "loyalty.points_credited" },
    };
}

export type ReferralRewardGrantedEventData = {
    points: number;
    /** "referrer" (you referred someone) vs "referee" (you were referred) — drives copy. */
    role: "referrer" | "referee";
};

function buildReferralRewardGrantedPayload(event: NotificationEvent<ReferralRewardGrantedEventData>): NotificationPayload {
    const { points, role } = event.data;
    const title = role === "referrer" ? "🎉 Referral reward earned!" : "🎁 Welcome bonus credited!";
    const body =
        role === "referrer"
            ? `Your friend's first order was delivered — you earned ${points} points!`
            : `Thanks for joining via referral — ${points} points added to your account.`;

    return {
        title,
        body,
        url: "/loyalty",
        category: "reward",
        priority: "normal",
        ctaButtons: [{ id: "view", label: "View Points", url: "/loyalty" }],
        data: { points, role, kind: "referral.reward_granted" },
    };
}

/**
 * Registry: event name → transactional payload builder. Kept separate from
 * `notificationTemplates` in templates.ts. The engine merges both registries
 * when resolving an event (see engine.ts), so event names must stay unique
 * across the two files — enforced by the shared NotificationEventName union.
 */
export const transactionalTemplates: Partial<
    Record<string, (event: NotificationEvent<any>) => NotificationPayload>
> = {
    "order.placed": buildOrderPlacedPayload,
    "order.preparing": buildOrderPreparingPayload,
    "order.out_for_delivery": buildOrderOutForDeliveryPayload,
    "order.delivered": buildOrderDeliveredPayload,
    "order.cancelled": buildOrderCancelledPayload,
    "auth.otp_requested": buildOtpRequestedPayload,
    "user.welcome": buildWelcomePayload,
    "loyalty.points_credited": buildLoyaltyPointsCreditedPayload,
    "referral.reward_granted": buildReferralRewardGrantedPayload,
};