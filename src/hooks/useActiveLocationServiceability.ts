"use client";

// src/hooks/useActiveLocationServiceability.ts
//
// Moved out of src/components/shared/LocationSelector.tsx (FoodKnock UI 2.0
// Phase 1 — that component's presentation is being retired in favor of
// src/components/shell/LocationTrigger.tsx) so the business logic lives on
// its own, independent of any particular presentational component. Reads
// from the shared locationStore (no new fetch to render a trigger — instant,
// cheap) and re-checks serviceability only when the selected coordinate
// actually changes (mount or a new pick), abort-guarded so a fast second
// location pick can't have a stale first response overwrite it. Every
// surface that needs "is the currently selected location serviceable"
// should use this one hook so there's one fetch per coordinate change, no
// matter how many components care about the answer.
//
// Auth-gated location flow fix: `locationStore` persists to localStorage
// (see that file) so a previously-selected location survives a page
// refresh — but with no authentication awareness of its own, it also
// survived LOGOUT, meaning a logged-out visitor (or a different account on
// the same device) would see the previous session's location rendered as
// though it were a confirmed delivery address, and this hook would fire a
// real serviceability request for it before anyone had signed in. The
// actual leak is fixed at the source in the logout handler (CustomerShell's
// handleLogout now calls clearLocation()) — this hook adds a second,
// defense-in-depth gate: every consumer of "the active location" goes
// through here, so requiring `isLoggedIn` here means NO caller can ever
// observe or trigger a serviceability check against a persisted location
// while logged out, even if some future code path forgot to clear the
// store on logout.

import { useEffect, useRef } from "react";
import { useLocationStore } from "@/store/locationStore";

export function useActiveLocationServiceability(isLoggedIn: boolean) {
    const location = useLocationStore((s) => s.location);
    const serviceable = useLocationStore((s) => s.serviceable);
    const setServiceable = useLocationStore((s) => s.setServiceable);
    const lastChecked = useRef<string | null>(null);

    useEffect(() => {
        if (!isLoggedIn || !location) return;
        const key = `${location.lat},${location.lng}`;
        if (lastChecked.current === key) return; // location unchanged — don't recheck
        lastChecked.current = key;

        const controller = new AbortController();
        fetch("/api/delivery/serviceability", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ latitude: location.lat, longitude: location.lng }),
            signal: controller.signal,
        })
            .then((r) => (r.ok ? r.json() : null))
            .then((data) => {
                if (data?.success) setServiceable(data.serviceable);
            })
            .catch(() => {});

        return () => controller.abort();
    }, [isLoggedIn, location, setServiceable]);

    if (!isLoggedIn) {
        // Never surface a persisted location (or the serviceability result
        // it earlier produced) to a logged-out caller — this is what stops
        // the navbar from rendering a stale "Danta, Danta" as though it
        // were the current, confirmed session's delivery address.
        return { location: null, serviceable: null };
    }

    return { location, serviceable };
}
