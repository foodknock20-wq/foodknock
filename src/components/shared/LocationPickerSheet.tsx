"use client";

// src/components/shared/LocationPickerSheet.tsx
//
// FoodKnock UI 2.0 — Phase 1: restyled onto the new src/components/ui/BottomSheet.tsx
// primitive (dark tokens) as part of the global shell rebuild. All business
// logic is unchanged from the pre-Phase-1 version: geolocation capture,
// reverse-geocode-for-label-only (coordinates stay authoritative regardless
// of geocode success), saved-address fetch/pick, and setLocation/toast
// side effects. Opens INSTANTLY (pure client state) — saved addresses load
// progressively after open, never blocking the open animation. GPS only
// ever fires on explicit tap, never on mount.

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "react-hot-toast";
import { Navigation, MapPin, Plus, Loader2, AlertTriangle, RotateCw } from "lucide-react";
import { useLocationStore } from "@/store/locationStore";
import BottomSheet from "@/components/ui/BottomSheet";
import { Skeleton } from "@/components/ui/Skeleton";
import { getPreferredAuthMode } from "@/lib/authDeviceMemory";

// Location UX + Geolocation Performance Repair — distinct, honest error
// states instead of collapsing every failure into "permission denied".
// `insecure` and `unsupported` are detected BEFORE ever calling
// getCurrentPosition() — the browser can only show its native permission
// prompt on a secure context (HTTPS, or localhost/127.0.0.1); on a plain
// HTTP LAN origin (a common mobile dev-testing setup — http://192.168.x.x:3000)
// `navigator.geolocation` itself is unavailable or silently errors as
// PERMISSION_DENIED despite the user never having been asked anything.
// Reporting that distinction honestly here beats a misleading "you denied
// permission" message for what is actually a dev-environment limitation.
type LocationErrorKind = "insecure" | "unsupported" | "permission" | "unavailable" | "timeout";

const LOCATION_ERROR_COPY: Record<LocationErrorKind, { title: string; message: string }> = {
    insecure: {
        title: "Secure connection required",
        message: "Location access needs HTTPS (or localhost). This page is loaded over a plain, non-secure connection — choose a saved address instead, or open the site over HTTPS.",
    },
    unsupported: {
        title: "Location not supported",
        message: "Your browser doesn't support location detection. Please choose a saved address instead.",
    },
    permission: {
        title: "Location access is off",
        message: "Turn on location permission for this site in your browser/device settings, or choose a saved address instead.",
    },
    unavailable: {
        title: "Couldn't get your location",
        message: "We couldn't determine your location right now. Please try again or choose a saved address.",
    },
    timeout: {
        title: "Location is taking too long",
        message: "That took longer than expected. Please try again or choose a saved address.",
    },
};

type SavedAddress = {
    _id: string;
    label: string;
    flatNo: string;
    addressLine: string;
    locality: string;
    city: string;
    state: string;
    lat: number | null;
    lng: number | null;
    isDefault: boolean;
};

function shortLabel(a: SavedAddress): string {
    return [a.locality, a.city].filter(Boolean).join(", ") || a.addressLine || a.label || "Address";
}

export default function LocationPickerSheet({
    open,
    onClose,
    isLoggedIn,
}: {
    open: boolean;
    onClose: () => void;
    isLoggedIn: boolean;
}) {
    const router = useRouter();
    const setLocation = useLocationStore((s) => s.setLocation);

    const [addresses, setAddresses] = useState<SavedAddress[]>([]);
    const [loadingAddresses, setLoadingAddresses] = useState(false);
    const [locating, setLocating] = useState(false);
    const [locationError, setLocationError] = useState<LocationErrorKind | null>(null);

    // Auth-gated location flow — defense in depth. Both current callers
    // (LocationTrigger, cart/page.tsx) already check `isLoggedIn` before
    // ever opening this sheet, so this should never actually fire in
    // normal use — but this component's own contract shouldn't rely
    // solely on callers remembering to gate it (see this task's own
    // instruction: "do not rely solely on hiding UI elements"). If a
    // logged-out caller somehow opens this anyway, redirect to sign-in
    // immediately instead of letting a guest trigger geolocation/
    // reverse-geocode/pick a saved address.
    useEffect(() => {
        if (open && !isLoggedIn) {
            onClose();
            router.push(`/auth?mode=${getPreferredAuthMode()}`);
        }
    }, [open, isLoggedIn, onClose, router]);

    // Load saved addresses as soon as the sheet opens — never blocks the
    // open animation itself.
    //
    // Location UX + Geolocation Performance Repair: this previously also
    // required `isLoggedIn` (a prop derived from CustomerHeader's auth
    // state, which itself only resolves after GET /api/navbar completes).
    // If a user opened this sheet before that resolved, `isLoggedIn` was
    // still `false`-for-now, so this effect skipped the fetch entirely —
    // it only ran a beat later once the prop flipped true, meaning the
    // address fetch was serialized BEHIND the navbar auth round-trip
    // instead of running in parallel with it. The session cookie is valid
    // the entire time regardless of whether that client-side flag has
    // caught up yet (src/lib/apiAuth.ts's requireUser() is what actually
    // decides, server-side) — a guest simply gets a 401, already handled
    // gracefully below (`r.ok ? ... : null`). Removing the gate lets the
    // two requests race instead of chaining.
    useEffect(() => {
        if (!open) return;
        setLoadingAddresses(true);
        fetch("/api/users/me/addresses", { credentials: "include" })
            .then((r) => (r.ok ? r.json() : null))
            .then((data) => {
                if (data?.success && Array.isArray(data.addresses)) setAddresses(data.addresses);
            })
            .catch(() => {})
            .finally(() => setLoadingAddresses(false));
    }, [open]);

    function pickLocation(label: string, lat: number, lng: number, addressId: string | null) {
        setLocation({ label, lat, lng, addressId });
        toast.success(`✓ Delivering to ${label}`, { duration: 2000 });
        onClose();
    }

    // Location UX + Geolocation Performance Repair — the call to
    // getCurrentPosition() below happens DIRECTLY inside this click handler
    // (no setState→useEffect indirection, no await before it), preserving
    // the user-gesture requirement the browser's permission prompt depends
    // on. The only things checked before it are synchronous, local facts
    // (secure context, API existence) — never a network request, so they
    // can't delay or break the gesture chain.
    function handleUseCurrentLocation() {
        setLocationError(null);

        // A secure context (HTTPS, or localhost/127.0.0.1) is a hard
        // browser requirement for geolocation — on a plain HTTP LAN origin
        // (e.g. http://192.168.x.x:3000, a common mobile dev-testing setup)
        // the browser will never show the native prompt at all, and
        // getCurrentPosition() typically fails immediately with a
        // PERMISSION_DENIED-shaped error that has nothing to do with the
        // user actually denying anything. Catch that distinctly rather
        // than mislabeling it.
        if (typeof window !== "undefined" && window.isSecureContext === false) {
            setLocationError("insecure");
            return;
        }

        if (!navigator.geolocation) {
            setLocationError("unsupported");
            return;
        }

        setLocating(true);

        navigator.geolocation.getCurrentPosition(
            async (pos) => {
                const { latitude: lat, longitude: lng } = pos.coords;
                // Reverse geocoding is address-text assistance only — the
                // coordinates (already captured above) remain authoritative
                // regardless of whether this lookup succeeds.
                let label = "your location";
                try {
                    const res = await fetch("/api/location/reverse-geocode", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ latitude: lat, longitude: lng }),
                    });
                    const data = await res.json();
                    if (data?.displayLabel) label = data.displayLabel;
                } catch { /* fall back to the generic label below */ }
                setLocating(false);
                pickLocation(label, lat, lng, null);
            },
            (err) => {
                setLocating(false);
                // Distinct mapping per GeolocationPositionError code — never
                // collapsed into one generic "permission denied" message.
                const kind: LocationErrorKind =
                    err.code === err.PERMISSION_DENIED ? "permission"
                        : err.code === err.TIMEOUT ? "timeout"
                            : "unavailable";
                setLocationError(kind);
            },
            // Fast-first, not maximum-accuracy-at-all-costs: a WiFi/cell-
            // tower fix (enableHighAccuracy: false) resolves far faster on
            // mobile than forcing a cold GPS lock, and is comfortably
            // precise enough for the delivery-radius serviceability check
            // this coordinate feeds into. A short-lived cached fix
            // (maximumAge) is accepted so re-opening the sheet moments
            // later doesn't re-trigger a full fresh acquisition.
            { enableHighAccuracy: false, timeout: 8_000, maximumAge: 60_000 }
        );
    }

    // Must come after every hook above (rules-of-hooks) — the redirect
    // itself is already handled by the useEffect near the top of this
    // component; this just stops the sheet's content from ever rendering
    // for a logged-out caller, even for the one frame before that effect
    // runs.
    if (!isLoggedIn) return null;

    return (
        <BottomSheet open={open} onClose={onClose} title="Where should we deliver?" ariaLabel="Choose delivery location">
            <div className="space-y-3">
                <button
                    onClick={handleUseCurrentLocation}
                    disabled={locating}
                    className="flex w-full items-center gap-3 rounded-fk-md border border-fk-border bg-fk-surface-selected px-4 py-3.5 text-left transition-colors hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
                >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-fk-md bg-fk-surface-elevated">
                        {locating ? (
                            <Loader2 size={16} className="animate-spin text-[var(--fk-accent)]" />
                        ) : (
                            <Navigation size={16} className="text-[var(--fk-accent)]" />
                        )}
                    </div>
                    <div>
                        <p className="text-[14px] font-bold text-fk-text">
                            {locating ? "Detecting location…" : "Use current location"}
                        </p>
                        <p className="text-[11px] text-fk-text-tertiary">Uses your device&apos;s location</p>
                    </div>
                </button>

                {/* Persistent, honest, per-error-kind guidance — not just a
                    transient toast — with a clear next action (retry, or
                    pick one of the saved addresses already visible below).
                    Never re-triggers automatically; only another explicit
                    tap calls getCurrentPosition() again. */}
                {locationError && (
                    <div className="flex items-start gap-2.5 rounded-fk-md border border-fk-danger/25 bg-fk-danger/5 px-3.5 py-3">
                        <AlertTriangle size={15} className="mt-0.5 shrink-0 text-fk-danger" strokeWidth={2.25} />
                        <div className="min-w-0 flex-1">
                            <p className="text-[12.5px] font-bold text-fk-text">{LOCATION_ERROR_COPY[locationError].title}</p>
                            <p className="mt-0.5 text-[11.5px] leading-relaxed text-fk-text-secondary">
                                {LOCATION_ERROR_COPY[locationError].message}
                            </p>
                            {locationError !== "insecure" && locationError !== "unsupported" && (
                                <button
                                    onClick={handleUseCurrentLocation}
                                    className="mt-2 flex items-center gap-1.5 text-[12px] font-bold text-[var(--fk-accent)]"
                                >
                                    <RotateCw size={12} /> Try again
                                </button>
                            )}
                        </div>
                    </div>
                )}

                {(isLoggedIn || addresses.length > 0) && (
                    <div>
                        <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-fk-text-tertiary">
                            Saved addresses
                        </p>
                        {loadingAddresses ? (
                            <div className="space-y-2">
                                <Skeleton className="h-14 w-full rounded-fk-md" />
                                <Skeleton className="h-14 w-full rounded-fk-md" />
                            </div>
                        ) : addresses.length === 0 ? (
                            <p className="rounded-fk-md border border-dashed border-fk-border px-4 py-3 text-[12px] text-fk-text-tertiary">
                                No saved addresses yet
                            </p>
                        ) : (
                            <div className="space-y-2">
                                {addresses.map((a) => (
                                    <button
                                        key={a._id}
                                        onClick={() => {
                                            if (a.lat === null || a.lng === null) {
                                                toast.error("This address has no location set — edit it in Account first.");
                                                return;
                                            }
                                            pickLocation(shortLabel(a), a.lat, a.lng, a._id);
                                        }}
                                        className="flex w-full items-center gap-3 rounded-fk-md border border-fk-border bg-fk-surface-elevated px-4 py-3 text-left transition-colors hover:border-[var(--fk-accent)]/40 hover:bg-fk-surface-interactive"
                                    >
                                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-fk-md bg-fk-surface-interactive">
                                            <MapPin size={15} className="text-fk-text-secondary" />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="truncate text-[13px] font-bold text-fk-text">
                                                {a.label || "Address"}{" "}
                                                {a.isDefault && <span className="text-[10px] font-semibold text-fk-success">· Default</span>}
                                            </p>
                                            <p className="truncate text-[11px] text-fk-text-tertiary">{shortLabel(a)}</p>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}
                        <Link
                            href="/account/addresses"
                            onClick={onClose}
                            className="mt-2 flex items-center gap-1.5 rounded-fk-sm px-1 py-2 text-[12px] font-bold text-[var(--fk-accent)] hover:text-[var(--fk-accent-hover)]"
                        >
                            <Plus size={13} /> Add new address
                        </Link>
                    </div>
                )}
            </div>
        </BottomSheet>
    );
}
