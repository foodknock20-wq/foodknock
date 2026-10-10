// src/lib/webpush.ts
// FoodKnock — backward-compatible shim.
//
// The real implementation now lives in src/lib/notifications/* behind the
// DeliveryProvider/engine architecture. This file is kept so any existing
// caller importing `broadcastCampaign`, `pickMessage`, `NOTIFICATION_POOL`,
// or `NotificationSlot` from "@/lib/webpush" keeps working unchanged.
//
// New code should import from "@/lib/notifications" instead.

import { notificationEngine } from "@/lib/notifications/engine";
import {
    PUSH_CAMPAIGN_POOL as NOTIFICATION_POOL,
    pickCampaignMessage as pickMessage,
    type NotificationSlot,
} from "@/lib/notifications/templates";

export type { NotificationSlot };
export { NOTIFICATION_POOL, pickMessage };

/**
 * PHASE 8: deterministic campaignId for one slot on one calendar day
 * (IST), e.g. "push-campaign-morning-2026-10-02". Used by
 * /api/push/send-campaign to detect and skip a duplicate run of the SAME
 * slot on the SAME day (cron misfire/retry, manual replay with the cron
 * secret, overlapping invocation) — see that route for the actual guard.
 * Exported so the route can check NotificationLog for this exact id
 * BEFORE calling broadcastCampaign(), avoiding a real (if rare) risk of
 * blasting every subscriber twice.
 */
export function campaignIdFor(slot: NotificationSlot, now: Date = new Date()): string {
    const istOffsetMs = 5.5 * 60 * 60 * 1000;
    const ist = new Date(now.getTime() + istOffsetMs);
    const day = ist.toISOString().slice(0, 10); // YYYY-MM-DD in IST
    return `push-campaign-${slot}-${day}`;
}

export async function broadcastCampaign(slot: NotificationSlot): Promise<{
    sent: number;
    failed: number;
    deactivated: number;
}> {
    const msg = pickMessage(slot);

    const [result] = await notificationEngine.send(
        ["push"],
        { broadcast: true },
        {
            title: msg.title,
            body: msg.body,
            url: msg.url,
            icon: "/icon-192.png",
            badge: "/icon-192.png",
            // PHASE 8: tags this send so NotificationLog records it under a
            // deterministic id (see campaignIdFor above) — campaignId was
            // already a supported NotificationPayload/NotificationLog field
            // (used by the admin rich-notification flow) but this call site
            // never populated it, so campaign sends were previously
            // unidentifiable for duplicate-run detection.
            campaignId: campaignIdFor(slot),
            data: { kind: `push.campaign.${slot}` },
        }
    );

    return {
        sent: result?.sent ?? 0,
        failed: result?.failed ?? 0,
        deactivated: result?.deactivated ?? 0,
    };
}