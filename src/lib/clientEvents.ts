// src/lib/clientEvents.ts
//
// Phase 12 finalization — tiny cross-component refresh signals, reusing
// the exact window-CustomEvent pattern NotificationInbox.tsx already
// established for NOTIFICATIONS_CHANGED_EVENT (not a new mechanism).
//
// LOYALTY_CHANGED_EVENT: dispatched after a successful Spin so the Navbar
// chip and the /loyalty page's own hero balance refresh immediately
// instead of showing a stale number until a full reload. The Spin widget
// itself already shows the correct new balance (it's returned directly in
// the POST /api/spin response) — this event is purely for the OTHER
// balance displays elsewhere on the page/site that have their own
// independent fetch.

export const LOYALTY_CHANGED_EVENT = "fk:loyalty-changed";
