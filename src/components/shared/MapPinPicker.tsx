"use client";

// src/components/shared/MapPinPicker.tsx
//
// Phase 10 — free map-pin location picker (Leaflet + OpenStreetMap tiles,
// no API key, no paid service). This is the fallback for customers who:
//   - deny browser GPS permission, AND
//   - have no saved address with coordinates
// A manually typed address alone cannot give us lat/lng — this is the one
// reliable, user-controlled way to get it without forcing GPS.
//
// Leaflet is imported dynamically inside useEffect only (never at module
// scope) because it touches `window`/`document` and cannot run during SSR.
// The default marker icon is a hand-drawn SVG divIcon, not Leaflet's
// bundled PNG marker images — those resolve to node_modules file paths
// that need extra webpack asset config; an inline SVG sidesteps that
// entirely and keeps the brand color consistent with the rest of the app.

import { useEffect, useRef, useState } from "react";
import { X, Check, Loader2, Navigation } from "lucide-react";
import "leaflet/dist/leaflet.css";

type LeafletMap = import("leaflet").Map;
type LeafletMarker = import("leaflet").Marker;

const PIN_SVG = `
<svg width="36" height="48" viewBox="0 0 36 48" xmlns="http://www.w3.org/2000/svg">
  <path d="M18 0C8.06 0 0 8.06 0 18c0 13.5 18 30 18 30s18-16.5 18-30C36 8.06 27.94 0 18 0z" fill="#FF5C1A"/>
  <circle cx="18" cy="18" r="7" fill="#fff"/>
</svg>`;

/** Default map center before any location is known — just a reasonable
 *  initial viewport, NEVER written as the selected delivery coordinate. */
const DEFAULT_CENTER: [number, number] = [20.5937, 78.9629]; // India, geographic center

export default function MapPinPicker({
    open,
    onClose,
    onConfirm,
    initialLat,
    initialLng,
}: {
    open: boolean;
    onClose: () => void;
    onConfirm: (lat: number, lng: number) => void;
    initialLat?: number | null;
    initialLng?: number | null;
}) {
    const containerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<LeafletMap | null>(null);
    const markerRef = useRef<LeafletMarker | null>(null);
    const [ready, setReady] = useState(false);
    const [locating, setLocating] = useState(false);
    const [picked, setPicked] = useState<{ lat: number; lng: number } | null>(
        initialLat != null && initialLng != null ? { lat: initialLat, lng: initialLng } : null
    );

    useEffect(() => {
        if (!open || !containerRef.current || mapRef.current) return;

        let cancelled = false;

        import("leaflet").then((L) => {
            if (cancelled || !containerRef.current) return;

            const startCenter: [number, number] =
                initialLat != null && initialLng != null ? [initialLat, initialLng] : DEFAULT_CENTER;
            const startZoom = initialLat != null && initialLng != null ? 17 : 5;

            const map = L.map(containerRef.current, {
                center: startCenter,
                zoom: startZoom,
                attributionControl: true,
            });

            L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
                maxZoom: 19,
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            }).addTo(map);

            const icon = L.divIcon({
                html: PIN_SVG,
                className: "fk-map-pin",
                iconSize: [36, 48],
                iconAnchor: [18, 48],
            });

            const marker = L.marker(startCenter, { icon, draggable: true }).addTo(map);
            marker.on("dragend", () => {
                const pos = marker.getLatLng();
                setPicked({ lat: pos.lat, lng: pos.lng });
            });

            map.on("click", (e: { latlng: { lat: number; lng: number } }) => {
                marker.setLatLng(e.latlng);
                setPicked({ lat: e.latlng.lat, lng: e.latlng.lng });
            });

            mapRef.current = map;
            markerRef.current = marker;

            if (initialLat != null && initialLng != null) {
                setPicked({ lat: initialLat, lng: initialLng });
            }

            setReady(true);
            // Leaflet needs an explicit size recalculation once its
            // container is actually visible (sheet open animation).
            setTimeout(() => map.invalidateSize(), 50);
        });

        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    // Tear down the map instance when the sheet fully closes so re-opening
    // doesn't attach a second map to the same (recreated) DOM node.
    useEffect(() => {
        if (open) return;
        if (mapRef.current) {
            mapRef.current.remove();
            mapRef.current = null;
            markerRef.current = null;
            setReady(false);
        }
    }, [open]);

    function handleUseMyLocation() {
        if (!navigator.geolocation) return;
        setLocating(true);
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                const { latitude: lat, longitude: lng } = pos.coords;
                setLocating(false);
                setPicked({ lat, lng });
                if (mapRef.current && markerRef.current) {
                    mapRef.current.setView([lat, lng], 17);
                    markerRef.current.setLatLng([lat, lng]);
                }
            },
            () => setLocating(false),
            { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 }
        );
    }

    return (
        <div
            className={`fixed inset-0 z-[80] flex items-end justify-center sm:items-center ${open ? "" : "pointer-events-none"}`}
        >
            <div
                className={`fixed inset-0 transition-opacity duration-300 ${open ? "bg-black/50" : "pointer-events-none bg-transparent opacity-0"}`}
                onClick={onClose}
                aria-hidden="true"
            />
            <div
                className={`relative w-full max-w-lg rounded-t-fk-lg bg-fk-surface-elevated transition-transform duration-300 sm:rounded-fk-lg ${
                    open ? "translate-y-0" : "translate-y-full sm:translate-y-4 sm:opacity-0"
                }`}
                style={{ maxHeight: "85vh" }}
                role="dialog"
                aria-modal="true"
                aria-label="Pin your delivery location"
            >
                <div className="flex items-center justify-between px-5 py-3.5">
                    <div>
                        <h2 className="text-[15px] font-black text-fk-text">Pin your exact location</h2>
                        <p className="text-[11px] text-fk-text-secondary">Tap or drag the pin to your delivery spot</p>
                    </div>
                    <button
                        onClick={onClose}
                        aria-label="Close"
                        className="flex h-8 w-8 items-center justify-center rounded-fk-md bg-fk-surface-interactive text-fk-text-tertiary hover:bg-fk-surface-selected"
                    >
                        <X size={15} />
                    </button>
                </div>

                <div className="relative h-[360px] w-full bg-fk-surface-interactive">
                    {open && (
                        <div ref={containerRef} className="absolute inset-0" />
                    )}
                    {!ready && open && (
                        <div className="absolute inset-0 flex items-center justify-center">
                            <Loader2 size={24} className="animate-spin text-[var(--fk-accent)]" />
                        </div>
                    )}
                </div>

                <div className="flex items-center justify-between gap-3 px-5 py-4">
                    <button
                        type="button"
                        onClick={handleUseMyLocation}
                        disabled={locating}
                        className="flex items-center gap-1.5 rounded-fk-md border border-fk-border px-3 py-2.5 text-[12px] font-bold text-fk-text-secondary transition-colors hover:bg-fk-surface-interactive disabled:opacity-60"
                    >
                        {locating ? <Loader2 size={13} className="animate-spin" /> : <Navigation size={13} />}
                        Use my location
                    </button>
                    <button
                        type="button"
                        disabled={!picked}
                        onClick={() => {
                            if (!picked) return;
                            onConfirm(picked.lat, picked.lng);
                        }}
                        className="flex flex-1 items-center justify-center gap-1.5 rounded-fk-md bg-[var(--fk-accent)] px-4 py-2.5 text-[13px] font-bold text-white transition-colors hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        <Check size={14} /> Confirm this location
                    </button>
                </div>
            </div>
        </div>
    );
}
