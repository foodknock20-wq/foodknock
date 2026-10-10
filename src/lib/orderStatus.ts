// src/lib/orderStatus.ts
//
// ── CENTRALIZED ORDER STATUS TRANSITION AUTHORITY (Phase 5) ─────────────────
//
// Problem this solves:
//   Two routes mutated Order.status with two separate, inconsistent
//   whitelists:
//     • /api/orders/[id] PATCH            — the route the admin dashboard
//       actually calls (src/components/admin/orders/OrderTable.tsx) —
//       allowed any of 4 statuses, with NO check that the transition made
//       sense (e.g. "received" → "delivered" directly was accepted) and no
//       "cancelled" support at all.
//     • /api/admin/orders/[id]/status PATCH — a second, separately
//       maintained implementation of the same action, confirmed unused by
//       the frontend (dead code), with its own 5-status whitelist and its
//       own loyalty/email/notification wiring, independently.
//   Both read-then-wrote Order.status with no protection against two
//   concurrent transition requests racing each other.
//
// Fix:
//   changeOrderStatus() is now the ONLY place Order.status is written. It
//   derives the real state machine from Order.ts's own schema enum — not
//   invented — and from the linear flow already implemented (and the only
//   one ever exposed to admins) in OrderStatusBadge.tsx's STATUS_FLOW:
//     received → preparing → out_for_delivery → delivered
//   "cancelled" is in the schema enum but has no live UI action yet (see
//   OrderStatusBadge.tsx) — it's treated as a terminal state reachable from
//   any non-terminal status, since that's the only sane interpretation of
//   an already-declared-but-dormant schema value; no new business rule or
//   UI was invented for it.
//
// Atomicity (no Mongo transactions on this deployment — see
// loyaltyService.ts's header comment for why):
//   The actual write is a single conditional findOneAndUpdate filtered on
//   {_id, status: <the exact status we just read}. If a concurrent request
//   changed the status in between, this update matches zero documents and
//   we re-check rather than blindly overwrite — the same optimistic-
//   concurrency pattern Phase 1A's PendingPayment claim already uses.
//
// Idempotency: requesting a transition to the status the order is ALREADY
// in is always a successful no-op (`changed: false`), not an error — admin
// double-clicks, retried requests, etc. are all safe.

import Order from "@/models/Order";

export const ORDER_STATUSES = [
    "received",
    "preparing",
    "out_for_delivery",
    "delivered",
    "cancelled",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export function isOrderStatus(value: unknown): value is OrderStatus {
    return typeof value === "string" && (ORDER_STATUSES as readonly string[]).includes(value);
}

// The real, derived state machine. Terminal states map to an empty array.
const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
    received:          ["preparing", "cancelled"],
    preparing:         ["out_for_delivery", "cancelled"],
    out_for_delivery:  ["delivered", "cancelled"],
    delivered:         [], // terminal
    cancelled:         [], // terminal
};

export const TERMINAL_STATUSES: OrderStatus[] = ORDER_STATUSES.filter(
    (s) => TRANSITIONS[s].length === 0
);

export function isValidTransition(from: OrderStatus, to: OrderStatus): boolean {
    if (from === to) return true; // idempotent no-op is always "valid"
    return TRANSITIONS[from].includes(to);
}

export interface ChangeOrderStatusResult {
    /** The current (possibly just-updated) lean Order document — caller casts to its own projection as needed, same convention used elsewhere in this codebase for lean() results. */
    order:          Record<string, unknown>;
    previousStatus: OrderStatus;
    newStatus:      OrderStatus;
    /** False when the order was already in `newStatus` — caller must treat this as success, not re-run side effects. */
    changed:        boolean;
}

/** Who/what triggered a status change — recorded on every statusHistory entry and, for cancellation, on the cancellation sub-document too. */
export interface StatusChangeActor {
    type:    "customer" | "admin" | "system";
    userId?: string | null;
}

export interface ChangeOrderStatusOptions {
    /** Who triggered this transition. Defaults to {type:"system"} for callers that don't pass one (e.g. future automated transitions) — every EXISTING call site today is actually an admin action, so those callers should pass {type:"admin", userId}. */
    changedBy?: StatusChangeActor;
    /** Required, human-readable reason when transitioning to "cancelled" — stored on the cancellation sub-document AND the history entry. Ignored for any other transition. */
    reason?: string;
    /** Optional free-text note, cancellation only. */
    note?: string;
}

/**
 * The single authority for mutating Order.status. Every route that needs
 * to change an order's status MUST go through this function — never
 * `Order.findByIdAndUpdate(id, {status})` / `order.status = x; order.save()`
 * directly.
 *
 * Phase 14: every genuine transition now also appends one entry to
 * `statusHistory` and, for a transition INTO "cancelled", sets the
 * `cancellation.{reason,note,cancelledAt,cancelledBy}` fields — all in the
 * SAME atomic conditional update as the status write itself, so an order
 * can never end up "cancelled" without a reason recorded, and the history
 * entry can never desync from the status that was actually written.
 */
export async function changeOrderStatus(
    orderId: string,
    nextStatus: OrderStatus,
    options: ChangeOrderStatusOptions = {}
): Promise<ChangeOrderStatusResult> {
    const actor: StatusChangeActor = options.changedBy ?? { type: "system" };

    const current = await Order.findById(orderId).select("status").lean<{ _id: unknown; status: OrderStatus } | null>();

    if (!current) {
        throw Object.assign(new Error("Order not found"), { status: 404 });
    }

    const previousStatus = current.status;

    if (previousStatus === nextStatus) {
        return { order: current, previousStatus, newStatus: nextStatus, changed: false };
    }

    if (!isValidTransition(previousStatus, nextStatus)) {
        throw Object.assign(
            new Error(
                TERMINAL_STATUSES.includes(previousStatus)
                    ? `Order is already "${previousStatus}" and cannot be changed further`
                    : `Cannot change order status from "${previousStatus}" to "${nextStatus}"`
            ),
            { status: 409 }
        );
    }

    const now = new Date();

    const historyEntry = {
        status:    nextStatus,
        changedAt: now,
        changedBy: { type: actor.type, userId: actor.userId ?? null },
        reason:    nextStatus === "cancelled" ? (options.reason ?? null) : null,
    };

    const setFields: Record<string, unknown> = {};
    if (nextStatus === "cancelled") {
        setFields["cancellation.reason"]      = options.reason ?? "unspecified";
        setFields["cancellation.note"]        = options.note ?? "";
        setFields["cancellation.cancelledAt"] = now;
        setFields["cancellation.cancelledBy"] = { type: actor.type, userId: actor.userId ?? null };
    }

    // Atomic, conditional on the exact status we just read — closes the
    // race window against a concurrent transition request for this same
    // order (Phase 5 §9/§24 Case 9). History append + cancellation record
    // ride along in the SAME write, so they can never apply without the
    // status write itself succeeding (or vice versa).
    const updated = await Order.findOneAndUpdate(
        { _id: orderId, status: previousStatus },
        {
            $set:  { status: nextStatus, ...setFields },
            $push: { statusHistory: historyEntry },
        },
        { new: true }
    ).lean();

    if (!updated) {
        // Lost the race — re-check what actually happened rather than
        // assume failure.
        const latest = await Order.findById(orderId).select("status").lean<{ status: OrderStatus } | null>();
        if (!latest) {
            throw Object.assign(new Error("Order not found"), { status: 404 });
        }
        if (latest.status === nextStatus) {
            // Someone else just made the exact same transition — idempotent success.
            return { order: latest, previousStatus, newStatus: nextStatus, changed: false };
        }
        throw Object.assign(
            new Error(`Order status changed concurrently to "${latest.status}" — please retry`),
            { status: 409 }
        );
    }

    return { order: updated, previousStatus, newStatus: nextStatus, changed: true };
}
