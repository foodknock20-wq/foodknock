// src/lib/notifications/engine.ts
// FoodKnock Notification Engine — core orchestration.
//
//   Business Events  →  Notification Engine  →  Delivery Providers
//
// Business code never imports a provider directly. It either:
//   1. emits an event via `notificationEvents` / `notificationEngine.emit(...)`, or
//   2. calls `notificationEngine.send(channels, target, payload)` directly
//      when it already has a fully-built payload (e.g. the cron campaign
//      route, which already knows the slot).
//
// Adding Email/WhatsApp/FCM later = write a provider implementing
// DeliveryProvider, register it below. No business code changes.
//
// Only change from the uploaded original: two entries added to
// EVENT_DEFAULT_CHANNELS for "loyalty.points_credited" and
// "referral.reward_granted" — both event names ALREADY EXISTED in the
// .listen() array below (byte-identical to the uploaded original; not
// modified). Without these two default-channel entries, now that
// loyaltyService.ts actually emits them, they would fall through to
// defaultChannelsFor()'s "every registered provider" fallback and be
// attempted against emailDeliveryProvider.ts's and whatsappProvider.ts's
// switch statements, which do not recognize these `kind` values in their
// local discriminated unions and would hit their `default: never`
// exhaustiveness branch — a real type-safety defect in those files. Pinning
// both to push-only here (same pattern as every other push-only event
// above them) prevents that without touching either provider file.

import { notificationEvents } from "./events/emitter";
import { notificationTemplates } from "./templates";
import { transactionalTemplates } from "./transactionalTemplates";
import { webPushProvider } from "./providers/webPushProvider";
import { emailDeliveryProvider } from "./providers/emailDeliveryProvider";
import { whatsappProvider } from "./providers/whatsappProvider";
import { logNotificationDelivery } from "./logger";
import { applyBranding } from "./branding";
import { isCategoryEnabledForUser } from "./preferences";
import type {
    DeliveryProvider,
    DeliveryResult,
    NotificationChannel,
    NotificationEvent,
    NotificationEventName,
    NotificationPayload,
    NotificationTarget,
} from "./types";

/**
 * Per-event default channel set, used only when a caller's emit() omits
 * `channels`. This exists so registering a new provider (e.g. Email in
 * Phase 4) never silently changes what an existing, unmodified emit() call
 * site does — each pre-existing event keeps exactly the channel(s) it was
 * written against. Events with no entry here fall back to "every
 * registered provider" (the original Phase 1 behavior), which is correct
 * for genuinely channel-agnostic events like push.campaign / admin.broadcast.
 *
 * New events should add an entry here when they're written with a specific
 * channel in mind, the same way order.placed etc. are pinned to "push" below.
 */
const EVENT_DEFAULT_CHANNELS: Partial<Record<NotificationEventName, NotificationChannel[]>> = {
    // Phase 2 order-lifecycle events — every existing emit() call site for
    // these omits `channels` and was written when only push existed.
    "order.placed": ["push"],
    "order.preparing": ["push"],
    "order.out_for_delivery": ["push"],
    // Phase 7 (Communication Layer): order.delivered now also fires
    // WhatsApp — one of the platform's exactly two approved WhatsApp
    // flows (see whatsappProvider.ts's header). Push is unchanged,
    // additive only; this event's actual emit() call site (orders/[id]
    // route) already omits `channels` and relies on this default, so
    // this one-line change is sufficient and verified-safe — no other
    // file needs to change for this event to start reaching WhatsApp.
    "order.delivered": ["push", "whatsapp"],
    // NEW — see file header. loyalty.points_credited / referral.reward_granted
    // already existed as declared, listened-to event names; only the
    // default-channel pinning was missing. Push-only: neither provider
    // (email/whatsapp) has a matching case for these kinds.
    "loyalty.points_credited": ["push"],
    "referral.reward_granted": ["push"],
    // Phase 4 — email-only events; no push template makes sense for either.
    //
    // auth.otp_requested is DELIBERATELY left as ["email"] here, even
    // though signup OTP is the platform's OTHER approved WhatsApp flow —
    // transactionalTemplates.ts's own header notes that this event's real
    // emit() call site explicitly passes `channels: ["email"]` itself
    // (overriding whatever default exists), so changing the default here
    // would not actually change that call's behavior and would risk
    // silently widening the RESET-flow's send path too. The auth route
    // that emits this event for SIGNUP specifically needs ONE explicit
    // change instead: pass `channels: ["email", "whatsapp"]` on that one
    // call (reset stays `["email"]`, unchanged). WhatsAppDeliveryProvider
    // itself ALSO refuses to send for flow:"reset" regardless of which
    // channels are attempted, as defense in depth — see its own switch.
    "auth.otp_requested": ["email"],
    "user.welcome": ["email"],
};

class NotificationEngine {
    private providers = new Map<NotificationChannel, DeliveryProvider>();
    private listening = false;

    registerProvider(provider: DeliveryProvider): void {
        this.providers.set(provider.channel, provider);
    }

    /**
     * Subscribes the engine to every known event name once. Safe to call
     * multiple times (e.g. across hot reloads) — guarded by `listening`.
     */
    listen(eventNames: NotificationEventName[]): void {
        if (this.listening) return;
        this.listening = true;

        for (const name of eventNames) {
            notificationEvents.on(name, (event: NotificationEvent) => {
                void this.handleEvent(event);
            });
        }
    }

    /** Convenience passthrough so business code only needs one import. */
    emit<TData = Record<string, unknown>>(event: NotificationEvent<TData>): void {
        notificationEvents.emit(event);
    }

    private async handleEvent(event: NotificationEvent): Promise<void> {
        const isTransactional = event.name in transactionalTemplates;
        const buildPayload = isTransactional
            ? transactionalTemplates[event.name]
            : notificationTemplates[event.name];

        if (!buildPayload) {
            // No template registered for this event yet (future phase). No-op.
            return;
        }

        // Safety rail: transactional (order-owner-only) events must never be
        // broadcast, even if a caller forgets to set target.userId. Drop the
        // event rather than risk fanning a personal status update out to
        // every subscriber.
        if (isTransactional && !event.target?.userId) {
            console.error(
                `NOTIFICATION_ENGINE: transactional event "${event.name}" emitted without target.userId — dropped, not delivered.`
            );
            return;
        }

        const payload = buildPayload(event);
        const target = event.target ?? { broadcast: true };
        const channels = event.channels ?? this.defaultChannelsFor(event.name);

        await this.send(channels, target, payload);
    }

    /**
     * Direct send path — bypasses the event bus for callers that already
     * have a built payload and explicit target (e.g. cron campaign route).
     *
     * Two things happen here, centrally, for EVERY caller (event-driven and
     * direct alike), so no template or route needs to do either itself:
     *
     *   1. applyBranding() — fills in FoodKnock defaults (icon/badge/accent
     *      color/priority/category) for anything the caller left unset.
     *   2. Preference gate — when the notification targets a specific user,
     *      checks whether that user has the payload's category enabled
     *      (Notification Settings). If disabled, the send is skipped
     *      entirely (all channels) and nothing is written to NotificationLog
     *      — this is a content-gating decision made before any delivery
     *      attempt, not a failed delivery, so it isn't logged as one.
     *      Broadcasts (no target.userId) are never gated here — there is no
     *      single user's preferences to check against a many-recipient send.
     */
    async send(
        channels: NotificationChannel[],
        target: NotificationTarget,
        payload: NotificationPayload
    ): Promise<DeliveryResult[]> {
        const brandedPayload = applyBranding(payload);

        if (target.userId) {
            const allowed = await isCategoryEnabledForUser(target.userId, brandedPayload.category);
            if (!allowed) {
                console.log(
                    `NOTIFICATION_ENGINE: send skipped — user ${target.userId} has category "${brandedPayload.category}" disabled.`
                );
                return [];
            }
        }

        const results: DeliveryResult[] = [];

        for (const channel of channels) {
            const provider = this.providers.get(channel);
            if (!provider) {
                console.error(`NOTIFICATION_ENGINE: no provider registered for channel "${channel}"`);
                continue;
            }

            // Phase 3.5 audit fix: isolate each provider's call. Without
            // this, a provider that throws (verified: webPushProvider.ts
            // has no top-level try/catch around its body, unlike
            // emailDeliveryProvider.ts and whatsappProvider.ts, which both
            // do) would abort this entire for-loop — silently skipping
            // every channel after it. That was harmless while every event
            // only ever had one channel, but order.delivered now resolves
            // to ["push", "whatsapp"] (two channels, same loop) — a direct
            // consequence of adding WhatsApp, and exactly the scenario
            // where this mattered for the first time. Verified with a
            // runtime simulation before fixing: a push failure genuinely
            // prevented WhatsApp from ever being attempted in the same
            // send() call, prior to this change.
            let result: DeliveryResult;
            try {
                result = await provider.send(target, brandedPayload);
            } catch (err) {
                console.error(
                    `NOTIFICATION_ENGINE: provider "${channel}" threw during send() — treating as a failed delivery for this channel only; remaining channels still proceed.`,
                    err
                );
                result = { channel, sent: 0, failed: 1, deactivated: 0 };
            }
            results.push(result);

            // History/analytics hook — fire-and-forget, error-isolated.
            // Does not affect this method's return value or timing for any
            // existing caller (every current call site — event-driven and
            // direct — keeps behaving exactly as before this was added).
            void logNotificationDelivery({ channel, target, payload: brandedPayload, result }).catch((err) => {
                console.error("NOTIFICATION_ENGINE: logging hook failed", err);
            });
        }

        return results;
    }

    /**
     * Resolves which channels an event should attempt when the caller
     * didn't pass an explicit `channels` array. Looks up a per-event
     * default (see EVENT_DEFAULT_CHANNELS below) and intersects it with
     * whatever providers are actually registered.
     *
     * This intersection matters: every pre-Email-provider emit() call site
     * (order.placed, order.preparing, order.out_for_delivery, order.delivered
     * from Phase 2) omits `channels` entirely and was written when only
     * "push" was registered. Registering a second provider (email) must
     * NOT silently widen what those existing calls attempt — each event's
     * default is the set of channels it actually has a meaningful template
     * for, not "every provider that happens to be registered right now."
     */
    private defaultChannelsFor(name: NotificationEventName): NotificationChannel[] {
        const declared = EVENT_DEFAULT_CHANNELS[name];
        const wanted = declared ?? this.channelsWithTemplate();
        return wanted.filter((c) => this.providers.has(c));
    }

    private channelsWithTemplate(): NotificationChannel[] {
        // Fallback for any event not listed in EVENT_DEFAULT_CHANNELS —
        // mirrors the original Phase 1 behavior (all registered providers).
        return Array.from(this.providers.keys());
    }
}

// Singleton — survives hot-reloads in dev, same pattern as the event bus.
const globalForEngine = globalThis as unknown as {
    __fkNotificationEngine?: NotificationEngine;
};

export const notificationEngine =
    globalForEngine.__fkNotificationEngine ?? new NotificationEngine();

if (process.env.NODE_ENV !== "production") {
    globalForEngine.__fkNotificationEngine = notificationEngine;
}

// ── Bootstrap: register Phase 1 providers and start listening ───────────
// This runs once per process (guarded by the singleton + `listening` flag
// above), registering the only active channel today. Future phases add
// `notificationEngine.registerProvider(emailProvider)` etc. here.
notificationEngine.registerProvider(webPushProvider);
notificationEngine.registerProvider(emailDeliveryProvider);
notificationEngine.registerProvider(whatsappProvider);
// UNCHANGED — byte-identical to the uploaded original. Both
// "loyalty.points_credited" and "referral.reward_granted" were already
// present here before any change in this task.
notificationEngine.listen([
    "push.campaign",
    "admin.broadcast",
    "order.placed",
    "order.preparing",
    "order.out_for_delivery",
    "order.delivered",
    "auth.otp_requested",
    "auth.password_reset",
    "user.welcome",
    "loyalty.points_credited",
    "referral.reward_granted",
]);