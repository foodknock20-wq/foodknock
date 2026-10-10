// src/models/DeliverySettings.ts
//
// Phase 10 — Location & Serviceability 2.0.
//
// Single-document singleton holding every delivery/serviceability business
// rule that was previously hardcoded in src/lib/delivery.ts (MIN_ORDER_AMOUNT,
// FREE_DELIVERY_AT, FLAT_DELIVERY_FEE) plus the new kitchen coordinate and
// distance-pricing rules. One authoritative source — no settings duplicated
// elsewhere. Use the exported helpers in src/lib/deliverySettings.ts rather
// than querying this model directly (same convention as src/models/Shop.ts).
//
// IMPORTANT: kitchen.latitude/longitude default to `null`. No trusted kitchen
// coordinate exists anywhere in the codebase today — inventing one would
// violate the Phase 10 spec's explicit instruction not to guess it. The admin
// must enter the real coordinate via /admin/delivery. Until then, the
// serviceability engine (src/lib/serviceability.ts) falls back to today's
// flat-rate behavior rather than blocking checkout — see that file's header.

import { Schema, model, models } from "mongoose";

const DistanceRuleSchema = new Schema(
    {
        fromKm: { type: Number, required: true, min: 0 },
        toKm:   { type: Number, required: true, min: 0 },
        fee:    { type: Number, required: true, min: 0 },
        active: { type: Boolean, default: true },
    },
    { _id: true }
);

const DeliverySettingsSchema = new Schema(
    {
        kitchen: {
            name:      { type: String, default: "FoodKnock Kitchen", trim: true },
            address:   { type: String, default: "Danta, Sikar, Rajasthan, India", trim: true },
            latitude:  { type: Number, default: null, min: -90, max: 90 },
            longitude: { type: Number, default: null, min: -180, max: 180 },
            active:    { type: Boolean, default: true },
        },

        serviceability: {
            // Current business value — admin-editable, never hardcoded in
            // application logic (see Phase 10 spec §0/§1).
            maxRadiusKm: { type: Number, default: 15, min: 0.1 },
        },

        orderRules: {
            minimumOrderValue: { type: Number, default: 189, min: 0 },
        },

        freeDelivery: {
            firstOrderFreeEnabled: { type: Boolean, default: true },
            thresholdEnabled:      { type: Boolean, default: true },
            thresholdAmount:       { type: Number, default: 339, min: 0 },
        },

        // Deterministic, non-overlapping distance slabs. Validated in
        // src/lib/deliverySettings.ts before every write — never trust a
        // partially-validated array to reach the DB.
        distanceRules: {
            type: [DistanceRuleSchema],
            default: () => ([
                { fromKm: 0,  toKm: 3,  fee: 0,  active: true },
                { fromKm: 3,  toKm: 5,  fee: 20, active: true },
                { fromKm: 5,  toKm: 8,  fee: 30, active: true },
                { fromKm: 8,  toKm: 12, fee: 40, active: true },
                { fromKm: 12, toKm: 15, fee: 50, active: true },
            ]),
        },
    },
    { timestamps: true }
);

const DeliverySettings = models.DeliverySettings || model("DeliverySettings", DeliverySettingsSchema);

export default DeliverySettings;
