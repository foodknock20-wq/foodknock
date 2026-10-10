// src/models/Shop.ts
//
// Single-document singleton that tracks whether the shop is open or closed.
//
// There will only ever be ONE document in this collection.
// Use the exported helpers rather than querying the model directly.
//
// Performance notes
// ─────────────────
// Shop status is read on every menu page render and every payment API call.
// To avoid a DB round-trip on each request we keep an in-process cache with a
// short TTL (30 s).  Cache is invalidated immediately on every write so the
// admin toggle is always reflected within one cache cycle at most.
//
// The cache lives in module scope — it survives across requests in the same
// Node.js worker process (Next.js long-running server) but resets on cold
// starts / deploys, which is fine.

import { Schema, model, models } from "mongoose";
import { connectDB } from "@/lib/db";

// ── Mongoose model ────────────────────────────────────────────────────────────

const ShopSchema = new Schema(
    {
        isOpen: {
            type:    Boolean,
            default: true,
        },
        // Phase 15E.8 — additive. WHY the shop is closed, not a second
        // open/closed authority: isOpen above remains the single source of
        // truth for "can customers order right now". These are null
        // whenever isOpen is true (cleared on reopen) and set only
        // alongside a close.
        closedReasonCode: {
            type:    String,
            default: null,
        },
        closedReasonText: {
            type:    String,
            default: null,
            trim:    true,
        },
        closedAt: {
            type:    Date,
            default: null,
        },
    },
    { timestamps: true }
);

const Shop = models.Shop || model("Shop", ShopSchema);

export default Shop;

// ── In-process cache ──────────────────────────────────────────────────────────

export type ShopStatusResult = {
    isOpen: boolean;
    closedReasonCode: string | null;
    closedReasonText: string | null;
    closedAt: string | null;
};

const CACHE_TTL_MS = 30_000; // 30 seconds

let cachedStatus: ShopStatusResult | null = null;
let cacheExpiresAt                        = 0;

function isCacheValid(): boolean {
    return cachedStatus !== null && Date.now() < cacheExpiresAt;
}

function setCache(status: ShopStatusResult): void {
    cachedStatus   = status;
    cacheExpiresAt = Date.now() + CACHE_TTL_MS;
}

function invalidateCache(): void {
    cachedStatus   = null;
    cacheExpiresAt = 0;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Returns the current shop status, including the close reason (if closed).
 * Served from the in-process cache within the TTL window — same one query
 * as before Phase 15E.8, just carrying two extra (already-fetched) string
 * fields; no additional DB round trip for any existing `{ isOpen }`-only
 * caller.
 * Creates the singleton document (isOpen: true) on the very first call ever.
 */
export async function getShopStatus(): Promise<ShopStatusResult> {
    // Fast path — serve from cache
    if (isCacheValid()) {
        return cachedStatus as ShopStatusResult;
    }

    await connectDB();

    // Find the singleton; create it if it doesn't exist yet.
    // Using findOne + save instead of findOneAndUpdate avoids the deprecated
    // `new` option and is simpler to reason about for a singleton.
    let doc = await Shop.findOne({}).lean<{
        isOpen: boolean; closedReasonCode?: string | null; closedReasonText?: string | null; closedAt?: Date | null;
    }>();

    if (!doc) {
        // First-ever call — seed the singleton
        const created = await Shop.create({ isOpen: true });
        doc = { isOpen: created.isOpen as boolean, closedReasonCode: null, closedReasonText: null, closedAt: null };
    }

    const result: ShopStatusResult = {
        isOpen: doc.isOpen ?? true,
        closedReasonCode: doc.closedReasonCode ?? null,
        closedReasonText: doc.closedReasonText ?? null,
        closedAt: doc.closedAt ? new Date(doc.closedAt).toISOString() : null,
    };
    setCache(result);
    return result;
}

/**
 * Sets the shop open/closed state. When closing, an optional reason may be
 * recorded (code from the SHOP_CLOSE_REASONS allowlist + optional free text
 * for "custom"). Reopening always clears any stored reason — a reason only
 * ever describes the CURRENT closure, never a stale/historical one.
 * Invalidates the in-process cache immediately so the next read reflects
 * the change within one request.
 */
export async function setShopStatus(
    isOpen: boolean,
    reason?: { code: string | null; text: string | null }
): Promise<ShopStatusResult> {
    await connectDB();

    // findOneAndUpdate replacement: find then save (avoids deprecated `new` option)
    let doc = await Shop.findOne({});

    const closedReasonCode = isOpen ? null : (reason?.code ?? null);
    const closedReasonText = isOpen ? null : (reason?.text ?? null);
    const closedAt = isOpen ? null : new Date();

    if (doc) {
        doc.isOpen = isOpen;
        doc.closedReasonCode = closedReasonCode;
        doc.closedReasonText = closedReasonText;
        doc.closedAt = closedAt;
        await doc.save();
    } else {
        doc = await Shop.create({ isOpen, closedReasonCode, closedReasonText, closedAt });
    }

    // Invalidate cache so the next read reflects the new state immediately
    invalidateCache();

    return {
        isOpen: doc.isOpen as boolean,
        closedReasonCode: (doc.closedReasonCode as string | null) ?? null,
        closedReasonText: (doc.closedReasonText as string | null) ?? null,
        closedAt: doc.closedAt ? new Date(doc.closedAt as Date).toISOString() : null,
    };
}