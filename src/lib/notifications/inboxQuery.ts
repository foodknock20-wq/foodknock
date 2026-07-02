// src/lib/notifications/inboxQuery.ts
//
// FoodKnock Notification Engine — shared Inbox query logic.
//
// Both the server-rendered first page (src/app/notifications/page.tsx) and
// the paginated API route (src/app/api/notifications/route.ts) need the
// EXACT same filtering, projection, and pagination rules — if those lived
// separately in each file, they'd drift the moment one was edited and not
// the other (e.g. a future excluded-event change applied to only one).
// This module is the one place that logic lives; both callers are thin
// wrappers around it.

import { connectDB } from "@/lib/db";
import NotificationLog from "@/models/NotificationLog";

export const INBOX_PAGE_SIZE = 20;

/**
 * Event names that are real NotificationLog rows but are NOT meaningful
 * "notifications" from the user's point of view — security/transient
 * artifacts, not something anyone wants sitting in an inbox. Extend this
 * list, don't special-case around it elsewhere.
 */
export const INBOX_EXCLUDED_EVENTS = ["auth.otp_requested", "auth.password_reset"];

export type InboxCtaButton = { id: string; label: string; url?: string };

export type InboxNotificationItem = {
    id: string;
    event: string;
    title: string;
    body: string;
    url: string;
    imageUrl: string;
    channel: string;
    isRead: boolean;
    createdAt: string; // ISO — serialized for safe client/server-component transport

    // ── Rich payload (Feature 3) — every field below has a safe fallback ──
    // applied in serialize(), since rows written before Feature 3 existed
    // simply don't have these paths on the stored document at all (schema
    // defaults only apply to new writes, never retroactively).
    priority: "low" | "normal" | "high" | "urgent";
    category: string;
    accentColor: string;
    badgeText: string;
    ctaButtons: InboxCtaButton[];
};

// Raw shape of a ctaButtons array entry as it actually comes back from
// .lean() — Mongoose auto-injects an `_id: ObjectId` into every
// array-of-subdocuments entry unless the subschema sets `{ _id: false }`
// (NotificationLog's ctaButtons subschema does not). That ObjectId (and
// its toJSON/Buffer internals) is exactly what triggered the "Only plain
// objects can be passed to Client Components" error — this type/step is
// the fix, applied at the one shared serialization boundary both the
// server page and the API route already go through.
type RawCtaButton = {
    id?: unknown;
    label?: unknown;
    url?: unknown;
    _id?: unknown;
    [key: string]: unknown;
};

type RawInboxDoc = {
    _id: { toString(): string };
    event: string;
    title: string;
    body: string;
    url?: string;
    imageUrl?: string;
    channel: string;
    readAt: Date | null;
    createdAt: Date;
    priority?: "low" | "normal" | "high" | "urgent";
    category?: string;
    accentColor?: string;
    badgeText?: string;
    ctaButtons?: RawCtaButton[];
};

/**
 * Converts a raw, possibly-Mongoose-tainted ctaButtons array into plain,
 * JSON-safe objects — dropping `_id` (an ObjectId) and any other non-plain
 * fields entirely, keeping only the three fields the client actually needs.
 * This is a targeted fix at the serialization boundary, not a blanket
 * JSON.stringify/parse round-trip of the whole document — every other
 * field on RawInboxDoc is already a plain string/boolean/Date, so only
 * this one nested array needed explicit sanitizing.
 */
function sanitizeCtaButtons(raw: unknown): InboxCtaButton[] {
    if (!Array.isArray(raw)) return [];

    const result: InboxCtaButton[] = [];
    for (const entry of raw) {
        if (!entry || typeof entry !== "object") continue;
        const e = entry as RawCtaButton;
        if (typeof e.id !== "string" || typeof e.label !== "string") continue;

        result.push({
            id: e.id,
            label: e.label,
            ...(typeof e.url === "string" ? { url: e.url } : {}),
        });
    }
    return result;
}

function serialize(doc: RawInboxDoc): InboxNotificationItem {
    return {
        id: doc._id.toString(),
        event: doc.event,
        title: doc.title,
        body: doc.body,
        url: doc.url || "/menu",
        imageUrl: doc.imageUrl || "",
        channel: doc.channel,
        isRead: !!doc.readAt,
        createdAt: doc.createdAt.toISOString(),
        priority: doc.priority ?? "normal",
        category: doc.category ?? "general",
        accentColor: doc.accentColor || "#FF5C1A",
        badgeText: doc.badgeText || "",
        ctaButtons: sanitizeCtaButtons(doc.ctaButtons),
    };
}

export type InboxPage = {
    items: InboxNotificationItem[];
    nextCursor: string | null;
    hasMore: boolean;
};

/**
 * Fetches one page of a user's inbox, newest first. `cursor` (when
 * provided) is the `id` of the last item from the previous page — pagination
 * is by `_id` rather than `createdAt` because MongoDB ObjectIds are already
 * monotonically increasing with insertion order for this write pattern
 * (one process, sequential creates), which makes `_id` a simpler and
 * equally correct cursor than a (createdAt, _id) compound one, with no
 * risk of duplicate/skipped rows from same-timestamp ties.
 */
export async function fetchInboxPage(userId: string, cursor?: string | null): Promise<InboxPage> {
    await connectDB();

    const query: Record<string, unknown> = {
        user: userId,
        event: { $nin: INBOX_EXCLUDED_EVENTS },
    };
    if (cursor) {
        query._id = { $lt: cursor };
    }

    const docs = await NotificationLog.find(query)
        .select("event title body url imageUrl channel readAt createdAt priority category accentColor badgeText ctaButtons")
        .sort({ _id: -1 })
        .limit(INBOX_PAGE_SIZE)
        .lean() as unknown as RawInboxDoc[];

    const items = docs.map(serialize);
    const hasMore = docs.length === INBOX_PAGE_SIZE;

    return {
        items,
        nextCursor: hasMore ? items[items.length - 1].id : null,
        hasMore,
    };
}

/** Count of this user's unread, inbox-eligible notifications. */
export async function fetchUnreadCount(userId: string): Promise<number> {
    await connectDB();
    return NotificationLog.countDocuments({
        user: userId,
        event: { $nin: INBOX_EXCLUDED_EVENTS },
        readAt: null,
    });
}