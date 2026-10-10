// src/lib/__tests__/orderIdEntropy.test.ts
//
// Phase 17.6 — guest-tracking privacy follow-up. Pure, zero-dependency
// regression tests for generateOrderId()'s strengthened suffix (see
// src/lib/utils.ts and src/app/api/orders/track/[orderId]/route.ts's
// header comment for the full rationale). Deterministic assertions only
// — no wall-clock timing fragility.
//
//   node --experimental-strip-types --test src/lib/__tests__/orderIdEntropy.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";
import { generateOrderId } from "../utils.ts";

test("generateOrderId: matches the ORD-{timestamp}-{8-char base36} shape", () => {
    const id = generateOrderId();
    assert.match(id, /^ORD-\d+-[0-9A-Z]{8}$/);
});

test("generateOrderId: the suffix is always exactly 8 characters (never shorter due to a short Math.random() string)", () => {
    for (let i = 0; i < 500; i++) {
        const id = generateOrderId();
        const suffix = id.split("-")[2];
        assert.equal(suffix.length, 8, `suffix "${suffix}" from id "${id}" must be exactly 8 characters`);
    }
});

test("generateOrderId: 2,000 generated IDs are all unique (collision-resistant in practice)", () => {
    const ids = new Set<string>();
    for (let i = 0; i < 2000; i++) ids.add(generateOrderId());
    assert.equal(ids.size, 2000, "no collisions expected across 2,000 generations");
});

test("generateOrderId: the new suffix space (36^8) is a strict, massive increase over the old 4-digit suffix (9,000 possibilities)", () => {
    const oldSpace = 9000;
    const newSpace = 36 ** 8;
    assert.ok(newSpace / oldSpace > 1_000_000, "the new suffix space must be at least a million times larger than the old one");
});

test("generateOrderId: uses globalThis.crypto.getRandomValues(), not Math.random() (Phase 17.7 — cryptographically secure RNG)", () => {
    let calls = 0;
    const originalGetRandomValues = globalThis.crypto.getRandomValues.bind(globalThis.crypto);
    globalThis.crypto.getRandomValues = (<T extends ArrayBufferView | null>(arr: T): T => {
        calls++;
        return originalGetRandomValues(arr);
    }) as Crypto["getRandomValues"];
    try {
        generateOrderId();
    } finally {
        globalThis.crypto.getRandomValues = originalGetRandomValues;
    }
    assert.equal(calls, 1, "generateOrderId() must obtain its randomness from globalThis.crypto.getRandomValues(), not Math.random()");
});
