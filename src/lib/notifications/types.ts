// src/lib/notifications/types.ts
// FoodKnock Notification Engine — core contracts.
//
// These types are the permanent boundary between:
//   Business Events  →  Notification Engine  →  Delivery Providers
//
// Business code and route handlers should only ever import from this file
// and from `engine.ts` / `events/emitter.ts`. They must never import a
// concrete provider (e.g. web-push) directly.

/**
 * Every channel a notification can eventually be delivered through.
 * Adding a new channel later means adding a value here and a matching
 * provider — no other contract changes.
 */
export type NotificationChannel =
    | "push"
    | "email"
    | "whatsapp"
    | "sms";

/**
 * Channel-agnostic notification content. Providers translate this into
 * whatever shape their transport needs (Web Push JSON payload, email
 * HTML, WhatsApp template params, etc).
 */
export type NotificationAction = {
    /** Matches the `action` field read in the notificationclick handler (public/sw.js) */
    action: string;
    title: string;
};

/**
 * How urgent/important a notification is. Currently informational metadata
 * (rendered as a visual indicator in the Inbox and Admin Preview) — no
 * provider changes behavior based on it today, but it's a stable contract
 * future providers (e.g. WhatsApp's message priority, FCM's priority header)
 * can read without any payload shape change.
 */
export type NotificationPriority = "low" | "normal" | "high" | "urgent";

/**
 * Content category — drives the category chip in the Inbox/Admin Preview
 * AND gates delivery against the user's Notification Preferences (see
 * src/lib/notifications/preferences.ts). Adding a new category means
 * adding a value here and a matching preference toggle + label — the same
 * "extend the union, extend one config map" pattern as NotificationChannel.
 */
export type NotificationCategory =
    | "order_update"
    | "offer"
    | "reward"
    | "lunch_deal"
    | "evening_deal"
    | "festival"
    | "flash_sale"
    | "price_drop"
    | "system"
    | "general";

/**
 * A UI-level call-to-action button for rich surfaces (Inbox cards, Admin
 * Preview, future Email/WhatsApp templates). Deliberately separate from
 * `NotificationAction` above: `actions` are OS-level Web Push action
 * buttons (max ~2, read by sw.js's notificationclick handler via a fixed
 * `action` string). `ctaButtons` are richer UI buttons with their own
 * labels and optional per-button deep links, rendered by React components
 * — they have no OS push equivalent and are never forwarded to sw.js.
 */
export type NotificationCtaButton = {
    /** Stable identifier, e.g. "track", "reorder", "claim" — for analytics, not display */
    id: string;
    label: string;
    /** Falls back to the payload's own `url` when omitted */
    url?: string;
};

export type NotificationPayload = {
    title: string;
    body: string;
    /** Relative deep-link, e.g. "/menu", "/my-orders/abc123" */
    url?: string;
    icon?: string;
    badge?: string;
    /**
     * Per-channel action buttons. Currently only consumed by the Web Push
     * provider (forwarded into the service worker's showNotification call).
     * Other channels ignore this field until they have their own concept
     * of actions (e.g. WhatsApp interactive buttons).
     */
    actions?: NotificationAction[];
    /** Free-form, provider-specific extras (e.g. WhatsApp template vars) */
    data?: Record<string, unknown>;

    // ── Rich payload (Feature 3) ─────────────────────────────────────────
    // All optional and additive. A payload built by any Phase 1-4 template
    // that sets none of these is still a fully valid NotificationPayload —
    // providers and consumers that don't know about a given field simply
    // never see it set, exactly like `data` and `actions` already work.
    // Branding defaults (icon/badge/accentColor/priority/category) are
    // applied centrally by applyBranding() in branding.ts — callers and
    // templates should generally leave those unset unless intentionally
    // overriding the brand default for a specific notification.
    /** Hero/banner image — Cloudinary URL, rendered via the existing cdnImage() helper wherever it's displayed. */
    imageUrl?: string;
    priority?: NotificationPriority;
    category?: NotificationCategory;
    /** Hex color, e.g. "#FF5C1A" — drives card gradients/accents. Defaults to the brand color via applyBranding(). */
    accentColor?: string;
    /** Rich UI call-to-action buttons (Inbox/Admin Preview) — see NotificationCtaButton. */
    ctaButtons?: NotificationCtaButton[];
    /** A short marketing label like "50% OFF" or "LIMITED TIME" — distinct from `badge` (the OS push icon URL). */
    badgeText?: string;
    /** Web Push grouping/dedup tag — forwarded to the wire payload by WebPushProvider; read by sw.js. */
    tag?: string;
    /** Ties multiple sends back to one marketing campaign for future rollup analytics. */
    campaignId?: string;
    /** ISO date string — when this notification is no longer relevant/actionable. Informational only today. */
    expiresAt?: string;
};

/**
 * The target of a notification. `userId` is used for per-user channels
 * (email, WhatsApp, per-user push lookups). `subscriptionIds` lets callers
 * target specific push subscriptions directly (e.g. broadcast jobs that
 * already loaded subscriptions from the DB).
 */
export type NotificationTarget = {
    userId?: string;
    subscriptionIds?: string[];
    /** If true and no specific target is given, deliver to all active subscribers (broadcast). */
    broadcast?: boolean;
};

export type DeliveryResult = {
    channel: NotificationChannel;
    sent: number;
    failed: number;
    deactivated: number;
};

/**
 * Contract every delivery channel must implement. Business logic and the
 * engine only ever talk to this interface — never to a concrete SDK.
 */
export interface DeliveryProvider {
    readonly channel: NotificationChannel;
    send(target: NotificationTarget, payload: NotificationPayload): Promise<DeliveryResult>;
}

/**
 * Canonical list of business events the platform can emit. This is the
 * single source of truth for event names — add new events here as new
 * business flows come online (later phases), so emitters and listeners
 * stay in sync at compile time.
 */
export type NotificationEventName =
    | "push.campaign" // generic scheduled/manual push broadcast (current morning/evening jobs)
    | "admin.broadcast" // ad-hoc admin-authored broadcast (Admin Notification Center)
    | "order.placed"
    | "order.preparing"
    | "order.out_for_delivery"
    | "order.delivered"
    | "order.cancelled"
    | "auth.otp_requested"
    | "auth.password_reset"
    | "user.welcome"
    | "loyalty.points_credited"
    | "referral.reward_granted";

export type NotificationEvent<TData = Record<string, unknown>> = {
    name: NotificationEventName;
    /** Arbitrary event-specific data a template builder uses to render the payload */
    data: TData;
    target?: NotificationTarget;
    /** Which channels this event should attempt; defaults to all channels with a registered template */
    channels?: NotificationChannel[];
};
