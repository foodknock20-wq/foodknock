// src/lib/googleMapsLink.ts
//
// Phase 10B — free Google Maps navigation links, no paid Maps API/key.
//
// CRITICAL SEMANTICS (do not get this backwards — see Phase 10B spec §11/§12/§32):
//   Delivery DISTANCE  = Kitchen -> Customer  (src/lib/serviceability.ts, Haversine)
//   Navigation LINK    = -> Customer ONLY, no origin
// The navigation link never includes the kitchen as an origin. Whoever
// opens the link (admin, staff, a future rider) is expected to navigate
// FROM WHEREVER THEY ARE; Google Maps uses the opener's own current
// device location as the origin automatically when none is specified.
// Hardcoding the kitchen as "origin" was a bug from the original Phase 10
// pass — fixed here, single call site, no duplicate URL construction
// anywhere else in the codebase.

function isFiniteCoord(n: unknown): n is number {
    return typeof n === "number" && Number.isFinite(n);
}

/**
 * THE one Google Maps navigation link builder. Destination is always the
 * CUSTOMER's coordinate — never the kitchen's. Returns null (never a
 * malformed/undefined/NaN URL) if the coordinate isn't valid.
 */
export function buildGoogleMapsNavigationUrl(
    lat: number | null | undefined,
    lng: number | null | undefined
): string | null {
    if (!isFiniteCoord(lat) || !isFiniteCoord(lng)) return null;
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
    return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
}

/**
 * Fallback when coordinates are unavailable but a human-readable address
 * is — opens a Maps search rather than turn-by-turn directions. Still
 * never an origin; still always the customer's destination.
 */
export function buildAddressSearchUrl(address: string | null | undefined): string | null {
    const trimmed = (address ?? "").trim();
    if (!trimmed) return null;
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(trimmed)}`;
}

/** Best-effort: coordinate-based navigation link, falling back to an address search. */
export function buildNavigationLink(params: {
    lat?: number | null;
    lng?: number | null;
    fallbackAddress?: string | null;
}): string | null {
    const direct = buildGoogleMapsNavigationUrl(params.lat, params.lng);
    if (direct) return direct;
    return buildAddressSearchUrl(params.fallbackAddress);
}

/**
 * Escapes a URL for safe embedding inside an HTML attribute (e.g.
 * `<a href="...">`). This is the actual root cause of the Telegram "404 —
 * /maps/dir was not found" bug: Telegram's parse_mode:"HTML" requires `&`
 * inside attribute values to be written as `&amp;`. The URLs this module
 * builds always contain unescaped `&` in their query string
 * (?api=1&destination=...&travelmode=...) — without this, Telegram's HTML
 * parser cuts the href short at the first bare `&`, producing a broken/
 * relative-looking link. Only `&` needs escaping here (the URL otherwise
 * contains only digits, commas, periods, and already-safe ASCII from our
 * own static query keys) — this must NOT percent-encode the URL, which
 * would double-encode it and break it differently.
 */
export function escapeUrlForHtmlAttr(url: string): string {
    return url.replace(/&/g, "&amp;");
}
