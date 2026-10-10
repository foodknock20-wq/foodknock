"use client";

// src/components/checkout/SavedAddressPicker.tsx
//
// Phase 9 — small, additive checkout enhancement: if the logged-in
// customer has saved addresses (Account 2.0), show them as quick-select
// chips that prefill the EXISTING free-text address/landmark fields.
// Deliberately does NOT change the checkout payload/schema — it only
// fills in the same two strings the customer could type by hand. Renders
// nothing if the fetch fails or the customer has no saved addresses, so
// checkout works identically to before for anyone without one.

import { useEffect, useState } from "react";
import { MapPin, Navigation, Loader2 } from "lucide-react";

export type SavedAddress = {
    _id: string;
    label: string;
    flatNo: string;
    addressLine: string;
    locality: string;
    city: string;
    state: string;
    pincode: string;
    landmark: string;
    deliveryInstructions: string;
    isDefault: boolean;
    // Phase 10 — already captured by Phase 9's address model; just wasn't
    // threaded through this component's onSelect until now.
    lat: number | null;
    lng: number | null;
};

export function composeAddress(a: SavedAddress): string {
    return [a.flatNo, a.addressLine, a.locality, a.city, a.state, a.pincode].filter(Boolean).join(", ");
}

export default function SavedAddressPicker({
    onSelect,
    onUseCurrentLocation,
    locatingCurrent,
}: {
    onSelect: (picked: SavedAddress) => void;
    onUseCurrentLocation: () => void;
    locatingCurrent: boolean;
}) {
    const [addresses, setAddresses] = useState<SavedAddress[]>([]);
    const [selectedId, setSelectedId] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        fetch("/api/users/me/addresses", { credentials: "include" })
            .then((res) => (res.ok ? res.json() : null))
            .then((data) => {
                if (!cancelled && data?.success && Array.isArray(data.addresses)) {
                    setAddresses(data.addresses);
                }
            })
            .catch(() => {});
        return () => { cancelled = true; };
    }, []);

    return (
        <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-black uppercase tracking-[0.18em] text-fk-text-secondary">
                Delivery location
            </label>
            <div className="flex flex-wrap gap-2">
                <button
                    type="button"
                    onClick={() => { setSelectedId("__current__"); onUseCurrentLocation(); }}
                    disabled={locatingCurrent}
                    className={[
                        "flex items-center gap-1.5 rounded-fk-pill border px-3 py-1.5 text-[12px] font-bold transition-colors disabled:cursor-not-allowed",
                        selectedId === "__current__"
                            ? "border-[var(--fk-accent)]/40 bg-gradient-to-r from-[var(--fk-accent)] to-[var(--fk-gold)] text-white"
                            : "border-fk-border bg-fk-surface-interactive text-fk-text-secondary hover:border-[var(--fk-accent)]/30",
                    ].join(" ")}
                >
                    {locatingCurrent ? <Loader2 size={12} className="animate-spin" /> : <Navigation size={12} />}
                    {locatingCurrent ? "Detecting…" : "Use current location"}
                </button>
                {addresses.map((a) => (
                    <button
                        key={a._id}
                        type="button"
                        onClick={() => {
                            setSelectedId(a._id);
                            onSelect(a);
                        }}
                        className={[
                            "flex items-center gap-1.5 rounded-fk-pill border px-3 py-1.5 text-[12px] font-bold transition-colors",
                            selectedId === a._id
                                ? "border-[var(--fk-accent)]/40 bg-gradient-to-r from-[var(--fk-accent)] to-[var(--fk-gold)] text-white"
                                : "border-fk-border bg-fk-surface-interactive text-fk-text-secondary hover:border-[var(--fk-accent)]/30",
                        ].join(" ")}
                    >
                        <MapPin size={12} />
                        {a.label || "Address"}
                        {a.isDefault && selectedId !== a._id ? " · Default" : ""}
                    </button>
                ))}
            </div>
        </div>
    );
}
