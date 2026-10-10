// src/lib/notifications/preferences.ts
//
// FoodKnock Notification Engine — Notification Preferences (SERVER ONLY).
//
// This module touches the database (connectDB, the User model) and must
// NEVER be imported by a "use client" component — doing so pulls mongoose
// and its Node-only dependencies (net, tls, child_process, fs/promises)
// into the client bundle, which Next.js's client bundler cannot resolve.
// Client code that needs the plain types/constants
// (NotificationPreferenceKey, NotificationPreferences,
// NOTIFICATION_PREFERENCE_DEFAULTS, NOTIFICATION_PREFERENCE_LABELS) must
// import them from preferenceConstants.ts instead — see that file's header.
//
// One toggle per content category, stored on the User document (see the
// notificationPreferences subdocument in src/models/User.ts), everything
// ON by default. This module is the single place that:
//   1. reads/writes those toggles (used by the settings API route), and
//   2. maps a NotificationPayload's `category` to the toggle that gates
//      it, and answers "is this category currently allowed for this user"
//      (used by engine.ts's send() — see the preference gate there).
//
// "Preferences should already integrate with the Notification Engine" —
// this is that integration: the engine calls isCategoryEnabledForUser()
// before attempting delivery, for every channel, whenever a notification
// targets a specific user. No template, provider, or route needs its own
// preference-checking logic; this is the one place it lives.

import { connectDB } from "@/lib/db";
import User from "@/models/User";
import type { NotificationCategory } from "./types";
import {
    NOTIFICATION_PREFERENCE_DEFAULTS,
    type NotificationPreferenceKey,
    type NotificationPreferences,
} from "./preferenceConstants";

// Re-exported so any EXISTING server-side import site (e.g. the
// preferences API route) that imports these from this module keeps
// working unmodified — backward compatible by construction. Only client
// components are required to switch to importing these directly from
// preferenceConstants.ts (enforced by NotificationSettings.tsx doing so).
export {
    NOTIFICATION_PREFERENCE_DEFAULTS,
    NOTIFICATION_PREFERENCE_LABELS,
} from "./preferenceConstants";
export type { NotificationPreferenceKey, NotificationPreferences } from "./preferenceConstants";

/**
 * Maps a payload's `category` to the preference key that gates it.
 * Categories with no entry here (currently only "general") are never
 * gated — they represent content with no corresponding user-facing
 * toggle, such as the default category applied when a template doesn't
 * set one at all.
 */
const CATEGORY_TO_PREFERENCE: Partial<Record<NotificationCategory, NotificationPreferenceKey>> = {
    order_update: "orderUpdates",
    offer: "offers",
    reward: "rewards",
    lunch_deal: "lunchDeals",
    evening_deal: "eveningDeals",
    festival: "festivalOffers",
    flash_sale: "flashSales",
    price_drop: "priceDrops",
    system: "systemUpdates",
};

type UserPreferencesDoc = { notificationPreferences?: Partial<NotificationPreferences> } | null;

/**
 * Reads a user's preferences, merged with defaults. A user with no
 * `notificationPreferences` subdocument at all (signed up before this
 * feature existed) gets every default — "everything ON" — with zero
 * migration required.
 */
export async function getNotificationPreferences(userId: string): Promise<NotificationPreferences> {
    await connectDB();
    const user = (await User.findById(userId)
        .select("notificationPreferences")
        .lean()) as UserPreferencesDoc;

    return { ...NOTIFICATION_PREFERENCE_DEFAULTS, ...(user?.notificationPreferences ?? {}) };
}

/**
 * Updates one or more preference keys for a user. Only known boolean keys
 * are written — anything else in `updates` is silently ignored rather
 * than rejected, since this is called directly from a parsed request body.
 */
export async function setNotificationPreferences(
    userId: string,
    updates: Partial<Record<string, unknown>>
): Promise<NotificationPreferences> {
    await connectDB();

    const setOps: Record<string, boolean> = {};
    for (const key of Object.keys(NOTIFICATION_PREFERENCE_DEFAULTS) as NotificationPreferenceKey[]) {
        const value = updates[key];
        if (typeof value === "boolean") {
            setOps[`notificationPreferences.${key}`] = value;
        }
    }

    if (Object.keys(setOps).length > 0) {
        await User.findByIdAndUpdate(userId, { $set: setOps });
    }

    return getNotificationPreferences(userId);
}

/**
 * Whether `category` is currently allowed for `userId`. Used by the
 * engine's preference gate (engine.ts) before every user-targeted send.
 */
export async function isCategoryEnabledForUser(
    userId: string,
    category: NotificationCategory | undefined
): Promise<boolean> {
    const prefKey = category ? CATEGORY_TO_PREFERENCE[category] : undefined;
    if (!prefKey) return true;

    const prefs = await getNotificationPreferences(userId);
    return prefs[prefKey];
}

/**
 * PHASE 6 — bulk variant of isCategoryEnabledForUser(), for broadcast
 * filtering (see webPushProvider.ts's filterBroadcastByPreference()).
 *
 * Problem this solves: a broadcast to N subscribers with linked users
 * previously called isCategoryEnabledForUser() — one User.findById() each
 * — once PER subscriber via Promise.all, so a 2,000-subscriber campaign
 * fired up to 2,000 individual DB round trips concurrently. This resolves
 * every userId's preference in exactly ONE query instead.
 *
 * Returns a Map so the caller can do an O(1) lookup per subscription
 * without re-querying. A userId missing from the map (deleted user, bad
 * reference) is treated as "not enabled" by the caller via `=== true`
 * checks — same as the single-user function returning false for a user
 * that doesn't exist.
 */
export async function isCategoryEnabledForUsers(
    userIds: string[],
    category: NotificationCategory | undefined
): Promise<Map<string, boolean>> {
    const result = new Map<string, boolean>();
    const uniqueIds = [...new Set(userIds)];
    if (uniqueIds.length === 0) return result;

    const prefKey = category ? CATEGORY_TO_PREFERENCE[category] : undefined;
    if (!prefKey) {
        for (const id of uniqueIds) result.set(id, true);
        return result;
    }

    await connectDB();
    const users = await User.find({ _id: { $in: uniqueIds } })
        .select("notificationPreferences")
        .lean<Array<{ _id: { toString(): string }; notificationPreferences?: Partial<NotificationPreferences> }>>();

    for (const u of users) {
        const prefs = { ...NOTIFICATION_PREFERENCE_DEFAULTS, ...(u.notificationPreferences ?? {}) };
        result.set(u._id.toString(), prefs[prefKey]);
    }

    return result;
}