// src/lib/__tests__/locationStoreOwnership.test.ts
//
// Authentication-gated location flow fix — pure, zero-dependency unit
// tests for src/store/locationStore.ts's new `syncOwner()` reconciliation
// logic. This is the one part of this fix that's testable without a
// React/DOM component-test framework (none exists in this repo, and
// installing one was out of scope for this task): a Zustand store's
// actions are plain JS functions, callable directly via `.getState()`
// with no rendering involved.
//
// `persist`'s `createJSONStorage(() => localStorage)` needs a
// `localStorage` global, which Node doesn't provide — a minimal in-memory
// polyfill is installed before importing the store (not a mock of
// anything this fix's logic depends on; just satisfies the browser API
// the persistence middleware expects to exist).
//
//   node --experimental-strip-types --test src/lib/__tests__/locationStoreOwnership.test.ts

import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";

class MemoryStorage {
    private store = new Map<string, string>();
    getItem(key: string) { return this.store.has(key) ? this.store.get(key)! : null; }
    setItem(key: string, value: string) { this.store.set(key, value); }
    removeItem(key: string) { this.store.delete(key); }
    clear() { this.store.clear(); }
}
(globalThis as unknown as { localStorage: MemoryStorage }).localStorage = new MemoryStorage();

const { useLocationStore } = await import("../../store/locationStore.ts");

beforeEach(() => {
    useLocationStore.setState({ location: null, serviceable: null, ownerUserId: null });
});

test("syncOwner: a fresh guest session (owner null) with no prior owner does nothing destructive", () => {
    useLocationStore.getState().syncOwner(null);
    assert.equal(useLocationStore.getState().location, null);
    assert.equal(useLocationStore.getState().ownerUserId, null);
});

test("syncOwner: the SAME user re-authenticating (e.g. page refresh) preserves their already-picked location", () => {
    useLocationStore.getState().syncOwner("user-A");
    useLocationStore.getState().setLocation({ label: "Danta, Danta", lat: 1, lng: 2, addressId: null });
    assert.ok(useLocationStore.getState().location);

    // Simulate a page refresh: the navbar re-fetches and confirms the SAME user.
    useLocationStore.getState().syncOwner("user-A");

    assert.deepEqual(useLocationStore.getState().location, { label: "Danta, Danta", lat: 1, lng: 2, addressId: null });
});

test("syncOwner: logging OUT (owner -> null) clears the location, never leaves it visible to a guest", () => {
    useLocationStore.getState().syncOwner("user-A");
    useLocationStore.getState().setLocation({ label: "Danta, Danta", lat: 1, lng: 2, addressId: null });
    useLocationStore.getState().setServiceable(true);

    useLocationStore.getState().syncOwner(null); // explicit logout, or a confirmed-unauthenticated navbar response

    assert.equal(useLocationStore.getState().location, null);
    assert.equal(useLocationStore.getState().serviceable, null);
    assert.equal(useLocationStore.getState().ownerUserId, null);
});

test("syncOwner: a DIFFERENT account logging in on the same device never inherits the previous account's location — even without an explicit logout in between", () => {
    useLocationStore.getState().syncOwner("user-A");
    useLocationStore.getState().setLocation({ label: "User A's Address", lat: 1, lng: 2, addressId: null });

    // No clearLocation()/logout ever ran — simulates a session that simply
    // expired, then a DIFFERENT account logging in on the same device.
    useLocationStore.getState().syncOwner("user-B");

    assert.equal(useLocationStore.getState().location, null, "user B must never see user A's location");
    assert.equal(useLocationStore.getState().ownerUserId, "user-B");
});

test("syncOwner: after a different user logs in (location cleared), THAT user's own subsequent pick is preserved across their own re-auth", () => {
    useLocationStore.getState().syncOwner("user-A");
    useLocationStore.getState().setLocation({ label: "User A's Address", lat: 1, lng: 2, addressId: null });

    useLocationStore.getState().syncOwner("user-B"); // switch — clears A's location
    useLocationStore.getState().setLocation({ label: "User B's Address", lat: 3, lng: 4, addressId: null });

    useLocationStore.getState().syncOwner("user-B"); // user B's own refresh — must NOT clear their own pick

    assert.deepEqual(useLocationStore.getState().location, { label: "User B's Address", lat: 3, lng: 4, addressId: null });
});

test("clearLocation: resets location and serviceable, but is NOT the same as syncOwner (does not touch ownerUserId by itself)", () => {
    useLocationStore.getState().syncOwner("user-A");
    useLocationStore.getState().setLocation({ label: "Addr", lat: 1, lng: 2, addressId: null });
    useLocationStore.getState().setServiceable(false);

    useLocationStore.getState().clearLocation();

    assert.equal(useLocationStore.getState().location, null);
    assert.equal(useLocationStore.getState().serviceable, null);
});

test("setLocation: always resets serviceable to null (unknown) — a new pick is never pre-judged serviceable before the real check runs", () => {
    useLocationStore.getState().syncOwner("user-A");
    useLocationStore.getState().setServiceable(true); // pretend a previous location was confirmed serviceable
    useLocationStore.getState().setLocation({ label: "New Address", lat: 9, lng: 9, addressId: null });

    assert.equal(useLocationStore.getState().serviceable, null, "serviceable must be re-checked for every new location, never carried over from the previous one");
});
