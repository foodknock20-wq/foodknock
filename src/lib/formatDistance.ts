// src/lib/formatDistance.ts
//
// Phase 10 — THE one place customer-facing distance text is produced.
// Internal distanceKm values (serviceability.ts, Order snapshot, Telegram/
// email payloads) stay precise floats — this only controls what text a
// human sees. A 20m delivery must read "20 m away", never "0.02 km away".

/** distanceKm -> "20 m" | "850 m" | "1.2 km" | "15.3 km". Never mutates the input value. */
export function formatDistance(distanceKm: number): string {
    const meters = distanceKm * 1000;
    if (meters < 1000) {
        return `${Math.round(meters)} m`;
    }
    return `${distanceKm.toFixed(distanceKm < 10 ? 2 : 1)} km`;
}
