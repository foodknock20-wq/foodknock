// src/store/authStore.ts
//
// Tiny, in-memory (no persistence) session-state flag. NOT a security
// boundary — the real guest-checkout gate is server-side (requireUser()
// in /api/orders/cod, /api/payment/create-order, /api/payment/verify).
// This exists purely so client components that render before any page's
// own data fetch (e.g. ProductCard's "Add to cart" button) can avoid an
// extra network round trip: Navbar already calls GET /api/navbar on every
// page mount, so it sets this store once that resolves, and anything else
// that wants a cheap "are they logged in" hint reads it instead of firing
// its own fetch.
//
// `isLoggedIn: null` means "not resolved yet" (Navbar's fetch hasn't
// completed) — callers should treat null the same as true (optimistic),
// since the only consequence of being wrong is a guest briefly adding an
// item to a cart they can never check out with.

import { create } from "zustand";

type AuthStore = {
  isLoggedIn: boolean | null;
  setIsLoggedIn: (value: boolean) => void;
  // FoodKnock UI 2.0 — Phase 2: the loyalty balance CustomerShell already
  // fetches (via GET /api/navbar) for the header, now shared globally so
  // Home's LoyaltyPromoStrip can read the real balance without a second
  // network call. null = not yet resolved / guest.
  loyaltyBalance: number | null;
  setLoyaltyBalance: (value: number | null) => void;
};

export const useAuthStore = create<AuthStore>((set) => ({
  isLoggedIn: null,
  setIsLoggedIn: (value) => set({ isLoggedIn: value }),
  loyaltyBalance: null,
  setLoyaltyBalance: (value) => set({ loyaltyBalance: value }),
}));
