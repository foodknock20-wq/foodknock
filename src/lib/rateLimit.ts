// src/lib/rateLimit.ts
//
// Small, serverless-safe sliding-window rate limiter backed by MongoDB
// (see src/models/RateLimitHit.ts for why — no Redis, no in-memory state).
// Not a general-purpose framework: just enough to put a ceiling on abuse of
// a handful of public, unauthenticated endpoints flagged in the Phase 3
// security review (guest order tracking, public review submission).

import { connectDB } from "@/lib/db";
import RateLimitHit from "@/models/RateLimitHit";

export function getClientIp(req: Request): string {
    const forwarded = req.headers.get("x-forwarded-for");
    if (forwarded) return forwarded.split(",")[0].trim();
    return req.headers.get("x-real-ip") ?? "unknown";
}

/**
 * Returns true if `key` is currently OVER the allowed `limit` within the
 * trailing `windowMs`. Increments the counter as a side effect, so call
 * this once per request, at most once.
 */
export async function isRateLimited(
    key: string,
    limit: number,
    windowMs: number
): Promise<boolean> {
    await connectDB();

    const now = new Date();
    const existing = await RateLimitHit.findOne({ key }).select("count windowStart").lean<{
        count: number;
        windowStart: Date;
    } | null>();

    const windowExpired = !existing || now.getTime() - new Date(existing.windowStart).getTime() > windowMs;

    const updated = await RateLimitHit.findOneAndUpdate(
        { key },
        windowExpired
            ? { $set: { count: 1, windowStart: now } }
            : { $inc: { count: 1 } },
        { upsert: true, new: true, setDefaultsOnInsert: true }
    ).catch(() => null);

    if (!updated) return false; // fail open — never block legitimate traffic on a DB hiccup
    return updated.count > limit;
}
