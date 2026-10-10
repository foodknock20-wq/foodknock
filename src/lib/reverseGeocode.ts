// src/lib/reverseGeocode.ts
//
// Phase 10B — free, server-side reverse geocoding for ADDRESS-TEXT
// ASSISTANCE ONLY. Coordinates remain the sole authority for serviceability
// everywhere else in the codebase (src/lib/serviceability.ts) — this module
// never feeds back into that calculation. Its only job is: given a lat/lng,
// suggest human-readable locality/city/state/pincode so the customer isn't
// forced to type everything by hand. Every field is best-effort; a field
// OpenStreetMap doesn't return is left empty, never invented.
//
// Provider: OpenStreetMap Nominatim's public reverse endpoint — free, no
// API key, but has a strict usage policy (nominatim.org/release-docs/latest/api/Usage-policy/):
// max ~1 req/sec, a descriptive User-Agent is required, and results should
// be cached rather than re-fetched for the same location. This module
// enforces all three: a real User-Agent, an in-process cache keyed to
// ~11m precision (4 decimal places) so nearby repeat lookups (e.g. the
// same customer re-opening the picker) don't re-hit the API, and a short
// request timeout so a slow/unavailable provider can never hang a request.

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/reverse";
const TIMEOUT_MS = 5000;
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes — coordinates don't move
const CACHE_MAX_ENTRIES = 500; // bounded — never grows unboundedly

export type ReverseGeocodeResult = {
    locality: string;
    city: string;
    state: string;
    pincode: string;
    road: string;
    displayLabel: string; // short "City, State"-style label for UI chips
};

const EMPTY_RESULT: ReverseGeocodeResult = {
    locality: "", city: "", state: "", pincode: "", road: "", displayLabel: "",
};

type CacheEntry = { value: ReverseGeocodeResult; expiresAt: number };
const cache = new Map<string, CacheEntry>();

function cacheKey(lat: number, lng: number): string {
    // ~11m buckets — enough to dedupe repeat lookups from the same spot
    // without collapsing genuinely different addresses together.
    return `${lat.toFixed(4)},${lng.toFixed(4)}`;
}

function pruneCache() {
    if (cache.size <= CACHE_MAX_ENTRIES) return;
    const oldestKey = cache.keys().next().value;
    if (oldestKey) cache.delete(oldestKey);
}

/**
 * Best-effort reverse geocode. NEVER throws — on any failure (timeout,
 * network error, malformed response, rate limit), returns the empty
 * result so callers can fall back to manual entry without the UX breaking.
 */
export async function reverseGeocode(lat: number, lng: number): Promise<ReverseGeocodeResult> {
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
        return EMPTY_RESULT;
    }

    const key = cacheKey(lat, lng);
    const cached = cache.get(key);
    if (cached && Date.now() < cached.expiresAt) return cached.value;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
        const url = `${NOMINATIM_URL}?format=jsonv2&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`;
        const res = await fetch(url, {
            signal: controller.signal,
            headers: {
                // Required by Nominatim's usage policy — identifies the
                // application, not an end user.
                "User-Agent": "FoodKnock/1.0 (delivery-address-assist; contact: foodknock20@gmail.com)",
                "Accept-Language": "en",
            },
        });

        if (!res.ok) return EMPTY_RESULT;
        const data = await res.json();
        const addr = data?.address ?? {};

        const result: ReverseGeocodeResult = {
            locality: addr.suburb || addr.village || addr.neighbourhood || addr.hamlet || "",
            city: addr.city || addr.town || addr.county || "",
            state: addr.state || "",
            pincode: addr.postcode || "",
            road: addr.road || "",
            displayLabel: [addr.suburb || addr.village || addr.city || addr.town, addr.state]
                .filter(Boolean)
                .join(", "),
        };

        cache.set(key, { value: result, expiresAt: Date.now() + CACHE_TTL_MS });
        pruneCache();
        return result;
    } catch {
        return EMPTY_RESULT;
    } finally {
        clearTimeout(timer);
    }
}
