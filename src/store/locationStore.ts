// src/store/locationStore.ts
//
// Phase 10 — the ONLY new global state this feature needs: which delivery
// location is currently selected. Not a tracking/history system — just the
// one active choice, persisted to localStorage so it survives a refresh
// (same persistence pattern as src/store/cartStore.ts). Server remains
// authoritative for serviceability/fee regardless of what's cached here.

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export type SelectedLocation = {
    label: string;
    lat: number;
    lng: number;
    addressId: string | null;
};

type LocationStore = {
    location: SelectedLocation | null;
    serviceable: boolean | null; // null = not yet checked
    // Auth-gated location flow fix: which authenticated user (by _id) this
    // persisted location belongs to — null means "no authenticated owner
    // yet" (guest, or logged out). Without this, a location picked by one
    // account would silently survive in localStorage and be inherited by
    // a DIFFERENT account logging in on the same device later, even if
    // the first account was never explicitly logged out (e.g. the session
    // simply expired) — CustomerShell's handleLogout clearing the store on
    // an explicit logout alone does not cover that gap. CustomerShell
    // calls syncOwner() with the real authenticated userId (or null) every
    // time GET /api/navbar resolves, so this is reconciled on every page
    // load/session check, not only on an explicit logout click.
    ownerUserId: string | null;
    setLocation: (location: SelectedLocation) => void;
    setServiceable: (serviceable: boolean | null) => void;
    clearLocation: () => void;
    /** Reconciles the stored location's owner against the currently authenticated user (or null for a guest/logged-out session) — clears the location if they differ. */
    syncOwner: (userId: string | null) => void;
};

export const useLocationStore = create<LocationStore>()(
    persist(
        (set, get) => ({
            location: null,
            serviceable: null,
            ownerUserId: null,
            setLocation: (location) => set({ location, serviceable: null }),
            setServiceable: (serviceable) => set({ serviceable }),
            clearLocation: () => set({ location: null, serviceable: null }),
            syncOwner: (userId) => {
                if (get().ownerUserId === userId) return; // same owner (or still no owner) — nothing to reconcile
                set({ location: null, serviceable: null, ownerUserId: userId });
            },
        }),
        {
            name: "foodknock-location-v1",
            storage: createJSONStorage(() => localStorage),
            partialize: (state) => ({ location: state.location, ownerUserId: state.ownerUserId }),
        }
    )
);
