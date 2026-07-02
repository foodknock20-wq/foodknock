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
};

const TRACK_ACTIONS: NotificationAction[] = [
    { action: "track", title: "Track Order" },
];

function buildOrderPlacedPayload(event: NotificationEvent<OrderEventData>): NotificationPayload {
    const { orderId } = event.data;
    return {
        title: "🎉 Order Confirmed!",
        body: "Your order has been placed successfully. We'll start preparing it shortly.",
        url: `/my-orders/${orderId}`,
        category: "order_update",
        priority: "normal",
        actions: [
            { action: "track", title: "Track Order" },
            { action: "dismiss", title: "Later" },
        ],
        ctaButtons: [{ id: "track", label: "Track Order", url: `/my-orders/${orderId}` }],
        data: { orderId, kind: "order.placed" },
    };
}

function buildOrderPreparingPayload(event: NotificationEvent<OrderEventData>): NotificationPayload {
    const { orderId } = event.data;
    return {
        title: "👨‍🍳 Your food is being prepared",
        body: "Our chefs have started preparing your delicious order.",
        url: `/track-order/${orderId}`,
        category: "order_update",
        priority: "normal",
        actions: TRACK_ACTIONS,
        ctaButtons: [{ id: "track", label: "Track Order", url: `/track-order/${orderId}` }],
        data: { orderId, kind: "order.preparing" },
    };
}

function buildOrderOutForDeliveryPayload(event: NotificationEvent<OrderEventData>): NotificationPayload {
    const { orderId } = event.data;
    return {
        title: "🛵 Out for Delivery",
        body: "Your rider is on the way. Get ready!",
        url: `/track-order/${orderId}`,
        category: "order_update",
        priority: "high",
        actions: [
            { action: "track", title: "Track Live" },
        ],
        ctaButtons: [{ id: "track", label: "Track Order", url: `/track-order/${orderId}` }],
        data: { orderId, kind: "order.out_for_delivery" },
    };
}

function buildOrderDeliveredPayload(event: NotificationEvent<OrderEventData>): NotificationPayload {
    const { orderId, customerName } = event.data;
    return {
        title: "✅ Delivered!",
        body: "Enjoy your meal. Thank you for choosing FoodKnock.",
        url: `/`,
        category: "order_update",
        priority: "high",
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
    "auth.otp_requested": buildOtpRequestedPayload,
    "user.welcome": buildWelcomePayload,
    "loyalty.points_credited": buildLoyaltyPointsCreditedPayload,
    "referral.reward_granted": buildReferralRewardGrantedPayload,
};