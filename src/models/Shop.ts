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
    },
    { timestamps: true }
);

const Shop = models.Shop || model("Shop", ShopSchema);

export default Shop;

// ── In-process cache ──────────────────────────────────────────────────────────

const CACHE_TTL_MS = 30_000; // 30 seconds

let cachedIsOpen: boolean | null = null;
let cacheExpiresAt               = 0;

function isCacheValid(): boolean {
    return cachedIsOpen !== null && Date.now() < cacheExpiresAt;
}

function setCache(isOpen: boolean): void {
    cachedIsOpen   = isOpen;
    cacheExpiresAt = Date.now() + CACHE_TTL_MS;
}

function invalidateCache(): void {
    cachedIsOpen   = null;
    cacheExpiresAt = 0;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Returns the current shop status.
 * Served from the in-process cache within the TTL window.
 * Creates the singleton document (isOpen: true) on the very first call ever.
 */
export async function getShopStatus(): Promise<{ isOpen: boolean }> {
    // Fast path — serve from cache
    if (isCacheValid()) {
        return { isOpen: cachedIsOpen as boolean };
    }

    await connectDB();

    // Find the singleton; create it if it doesn't exist yet.
    // Using findOne + save instead of findOneAndUpdate avoids the deprecated
    // `new` option and is simpler to reason about for a singleton.
    let doc = await Shop.findOne({}).lean<{ isOpen: boolean }>();

    if (!doc) {
        // First-ever call — seed the singleton
        const created = await Shop.create({ isOpen: true });
        doc = { isOpen: created.isOpen as boolean };
    }

    const isOpen = doc.isOpen ?? true;
    setCache(isOpen);
    return { isOpen };
}

/**
 * Sets the shop open/closed state.
 * Invalidates the in-process cache immediately so the next read hits the DB.
 * Returns the updated status.
 */
export async function setShopStatus(isOpen: boolean): Promise<{ isOpen: boolean }> {
    await connectDB();

    // findOneAndUpdate replacement: find then save (avoids deprecated `new` option)
    let doc = await Shop.findOne({});

    if (doc) {
        doc.isOpen = isOpen;
        await doc.save();
    } else {
        doc = await Shop.create({ isOpen });
    }

    // Invalidate cache so the next read reflects the new state immediately
    invalidateCache();

    return { isOpen: doc.isOpen as boolean };
}