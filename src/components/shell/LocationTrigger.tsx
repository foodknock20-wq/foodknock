"use client";

// src/components/shell/LocationTrigger.tsx
//
// FoodKnock UI 2.0 — Phase 1: dark-themed replacement for the presentational
// half of src/components/shared/LocationSelector.tsx (that component's
// default export is retired — see Phase 1 final report — its
// useActiveLocationServiceability hook moved to
// src/hooks/useActiveLocationServiceability.ts and is reused here
// unchanged). Opens the restyled LocationPickerSheet. No serviceability/
// distance logic lives here — purely presentation + the shared hook.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MapPin, ChevronDown, ChevronRight, Truck } from "lucide-react";
import { useActiveLocationServiceability } from "@/hooks/useActiveLocationServiceability";
import LocationPickerSheet from "@/components/shared/LocationPickerSheet";
import { cn, formatCurrency } from "@/lib/utils";
import { FREE_DELIVERY_AT } from "@/lib/delivery";
import { getPreferredAuthMode } from "@/lib/authDeviceMemory";

export default function LocationTrigger({
    isLoggedIn,
    variant = "chip",
}: {
    isLoggedIn: boolean;
    variant?: "chip" | "bar";
}) {
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const { location, serviceable } = useActiveLocationServiceability(isLoggedIn);

    // Auth-gated location flow: a logged-out tap must go to the existing
    // sign-in flow, never open the picker (which would otherwise let a
    // guest fire a geolocation/serviceability request before authenticating
    // — see this app's intended flow: sign in → select/confirm location →
    // serviceability). Reuses the exact entry point AccountDialog already
    // uses for "Sign in to FoodKnock", so there's one sign-in destination,
    // not two.
    function handleTrigger() {
        if (!isLoggedIn) {
            router.push(`/auth?mode=${getPreferredAuthMode()}`);
            return;
        }
        setOpen(true);
    }

    const label = !location
        ? "Select delivery location"
        : serviceable === false
            ? "Outside delivery area"
            : location.label;

    const isWarning = !!location && serviceable === false;

    if (variant === "bar") {
        // Luxury Navigation 2.0 — Location Row 60/40 redesign. The row used
        // to be a single full-width button (icon + "Delivering to" / address
        // + trailing chevron) that spent its entire width on the address,
        // leaving the rest of the row empty. Now it's two zones sharing one
        // row: the left ~60% keeps the exact same location trigger (same
        // button, same onClick, same label/serviceability logic, same
        // picker sheet — nothing about location behavior changed), and the
        // right ~40% is a compact, non-interactive status module showing
        // the one real, truthful piece of delivery info this app has
        // statically available: the free-delivery threshold already used by
        // FreeDeliveryStrip/cart/checkout (src/lib/delivery.ts
        // FREE_DELIVERY_AT) — not a fabricated ETA (no delivery-minutes
        // field exists anywhere in the data model) and not a duplicate of
        // the shop open/closed banner (already shown elsewhere on Home).
        // Flexible fr-based sizing (not literal 60%/40%) so long addresses
        // truncate safely on the left without ever pushing the right module
        // off-screen or wrapping awkwardly at 360px.
        return (
            <>
                <div
                    className={cn(
                        "flex w-full items-stretch border-t px-4 py-2.5 transition-colors",
                        isWarning ? "border-fk-danger/30 bg-fk-danger/10" : "border-fk-border bg-fk-surface/60"
                    )}
                >
                    <button
                        onClick={handleTrigger}
                        className="flex min-w-0 flex-[1.5] items-center gap-2 text-left active:opacity-70"
                    >
                        <MapPin size={15} className={cn("shrink-0", isWarning ? "text-fk-danger" : "text-[var(--fk-accent)]")} />
                        <div className="min-w-0 flex-1">
                            <p className={cn("truncate text-[13px] font-bold leading-tight", isWarning ? "text-fk-danger" : "text-fk-text")}>
                                {!location ? "Set delivery location" : "Delivering to"}
                            </p>
                            {location && (
                                <p className={cn("truncate text-[11px] leading-tight", isWarning ? "text-fk-danger/80" : "text-fk-text-secondary")}>
                                    {label}
                                </p>
                            )}
                        </div>
                        <ChevronRight size={13} className="shrink-0 text-fk-text-tertiary" />
                    </button>

                    {/* Subtle vertical divider — low-contrast, ~28px, centered */}
                    <div className="mx-3 my-auto h-7 w-px shrink-0 bg-fk-border" aria-hidden="true" />

                    {/* Right status module — integrated, not a card: no
                        background, no border, no shadow of its own. */}
                    <div className="flex min-w-[112px] flex-1 shrink-0 items-center justify-center gap-1.5 text-center">
                        <Truck size={16} className="shrink-0 text-[var(--fk-gold)]" />
                        <div className="min-w-0 leading-tight">
                            <p className="truncate text-[11.5px] font-black tracking-tight text-fk-text">Free delivery</p>
                            <p className="truncate text-[10px] text-fk-text-tertiary">on {formatCurrency(FREE_DELIVERY_AT)}+</p>
                        </div>
                    </div>
                </div>
                <LocationPickerSheet open={open} onClose={() => setOpen(false)} isLoggedIn={isLoggedIn} />
            </>
        );
    }

    return (
        <>
            <button
                onClick={handleTrigger}
                className={cn(
                    "flex items-center gap-1.5 rounded-fk-md border px-3 py-2 text-[13px] font-semibold transition-all",
                    isWarning
                        ? "border-fk-danger/40 bg-fk-danger/10 text-fk-danger"
                        : "border-fk-border bg-fk-surface-elevated text-fk-text-secondary hover:text-fk-text"
                )}
            >
                <MapPin size={14} className={isWarning ? "text-fk-danger" : "text-[var(--fk-accent)]"} />
                <span className="max-w-[140px] truncate">{label}</span>
                <ChevronDown size={12} />
            </button>
            <LocationPickerSheet open={open} onClose={() => setOpen(false)} isLoggedIn={isLoggedIn} />
        </>
    );
}
