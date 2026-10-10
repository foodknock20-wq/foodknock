// src/lib/shopCloseReasons.ts
//
// Phase 15E.8 — single source of truth for shop-close reason codes, shared
// by the admin close-shop modal and any customer-facing "shop closed"
// messaging. Additive to the existing Shop singleton (src/models/Shop.ts)
// — does not replace isOpen as the authoritative open/closed flag, only
// records WHY the existing authority is false.

export type ShopCloseReasonCode =
    | "outside_hours"
    | "kitchen_closed"
    | "bad_weather"
    | "maintenance"
    | "high_volume"
    | "staff_unavailable"
    | "equipment_issue"
    | "stock_issue"
    | "holiday"
    | "emergency"
    | "custom";

export const SHOP_CLOSE_REASONS: { code: ShopCloseReasonCode; label: string }[] = [
    { code: "outside_hours", label: "Outside Operating Hours" },
    { code: "kitchen_closed", label: "Kitchen Closed" },
    { code: "bad_weather", label: "Heavy Rain / Bad Weather" },
    { code: "maintenance", label: "Temporary Maintenance" },
    { code: "high_volume", label: "High Order Volume" },
    { code: "staff_unavailable", label: "Staff Unavailable" },
    { code: "equipment_issue", label: "Equipment Issue" },
    { code: "stock_issue", label: "Ingredient / Stock Issue" },
    { code: "holiday", label: "Holiday / Special Closure" },
    { code: "emergency", label: "Emergency Closure" },
    { code: "custom", label: "Custom Reason" },
];

const REASON_LABEL_MAP: Record<ShopCloseReasonCode, string> = Object.fromEntries(
    SHOP_CLOSE_REASONS.map((r) => [r.code, r.label])
) as Record<ShopCloseReasonCode, string>;

export function isValidCloseReasonCode(v: unknown): v is ShopCloseReasonCode {
    return typeof v === "string" && v in REASON_LABEL_MAP;
}

/** Human label for display — for "custom", prefers the admin's own text if provided. */
export function describeCloseReason(code: string | null | undefined, customText: string | null | undefined): string | null {
    if (!code) return null;
    if (code === "custom") return customText?.trim() || "Custom Reason";
    return REASON_LABEL_MAP[code as ShopCloseReasonCode] ?? null;
}
