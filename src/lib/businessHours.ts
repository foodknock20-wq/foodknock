// src/lib/businessHours.ts
//
// FINAL UI/UX MASTER PROMPT — Phase 3 (Delivery & Hours Consistency).
//
// Before this file existed, "what time is FoodKnock open" was answered
// with THREE different numbers scattered across the app:
//   - src/app/(main)/contact/page.tsx    → WhatsApp 9:00 AM–9:00 PM every day,
//                                           Phone/Call 10:00 AM–8:00 PM every day
//                                           ("During kitchen hours" — i.e. this
//                                           IS the real kitchen/ordering window).
//   - src/components/home/OfferBanner.tsx → claimed "Open 9 AM – 9 PM, Every Day"
//                                           for the KITCHEN — actually restating
//                                           the WhatsApp *support* line above,
//                                           not the real kitchen hours.
//   - src/components/shared/Footer.tsx    → a third, different split
//                                           ("Mon–Sat 10 AM–8 PM" / "Sunday
//                                           10 AM–7 PM") that matches neither
//                                           of the above and has no source
//                                           anywhere else in the system.
//
// No Hours model exists in the DB (src/models/Shop.ts only stores a manual
// isOpen boolean — no scheduled hours of any kind). Contact's own per-channel
// breakdown is the most detailed, deliberate statement of these numbers in
// the codebase, so it is treated as authoritative here rather than inventing
// a fourth number: kitchen/ordering hours = Phone/Call's "10:00 AM–8:00 PM,
// every day" row (explicitly noted as "During kitchen hours"); WhatsApp
// support hours = the separate 9:00 AM–9:00 PM row. These are two genuinely
// different things and must never be displayed interchangeably again.
//
// Every other file that needs to STATE these hours to a user must import
// from here, not restate its own copy — that's what caused the drift above.
// Timezone: Asia/Kolkata (the business's only timezone; not multi-region).

export const KITCHEN_HOURS = {
    label: "10:00 AM – 8:00 PM",
    days: "Every day",
    full: "10:00 AM – 8:00 PM, every day",
    timezone: "Asia/Kolkata",
} as const;

export const SUPPORT_HOURS = {
    whatsapp: { label: "9:00 AM – 9:00 PM", days: "Every day" },
    phone: { label: "10:00 AM – 8:00 PM", days: "Every day" },
    timezone: "Asia/Kolkata",
} as const;

// Guideline, not a guarantee — depends on distance slab (see
// src/models/DeliverySettings.ts) and kitchen load. Never present this as an
// exact promise; always pair with "estimate"/"usually"/"typically" wording.
export const DELIVERY_TIME_ESTIMATE = {
    label: "30–45 min",
    full: "typically 30–45 minutes",
} as const;
