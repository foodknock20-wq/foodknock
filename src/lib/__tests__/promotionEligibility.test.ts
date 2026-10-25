// src/lib/__tests__/promotionEligibility.test.ts
//
// Pure, DB-free regression tests for the identifier-hashing used by the
// recreation-proof first-order promotion ledger (see
// src/lib/promotionEligibility.ts). These assert the cryptographic
// properties the exploit-prevention relies on, without touching MongoDB.
//
//   npx tsx --test src/lib/__tests__/promotionEligibility.test.ts

// A secret must exist before the module under test is imported (it reads
// PROMO_ELIGIBILITY_SECRET || JWT_SECRET at call time). We import the
// db-free hash module directly so these pure tests never pull in @/lib/db.
process.env.PROMO_ELIGIBILITY_SECRET = "test-promo-secret-value";

import { test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { hashIdentifier } from "../promotionEligibilityHash.ts";

test("hashIdentifier: deterministic for the same email", () => {
    const a = hashIdentifier("Person@Example.com");
    const b = hashIdentifier("person@example.com");
    assert.equal(a, b, "same normalized email must map to the same hash");
});

test("hashIdentifier: normalizes case and surrounding whitespace", () => {
    assert.equal(hashIdentifier("  USER@FoodKnock.com  "), hashIdentifier("user@foodknock.com"));
});

test("hashIdentifier: different emails produce different hashes", () => {
    assert.notEqual(hashIdentifier("a@foodknock.com"), hashIdentifier("b@foodknock.com"));
});

test("hashIdentifier: returns null for empty / non-email input (never hash nothing)", () => {
    assert.equal(hashIdentifier(""), null);
    assert.equal(hashIdentifier(null), null);
    assert.equal(hashIdentifier(undefined), null);
    assert.equal(hashIdentifier("not-an-email"), null);
});

test("hashIdentifier: is a keyed HMAC-SHA256 of the normalized email (not a bare hash)", () => {
    const expected = crypto
        .createHmac("sha256", "test-promo-secret-value")
        .update("user@foodknock.com")
        .digest("hex");
    assert.equal(hashIdentifier("User@FoodKnock.com"), expected);
    // A plain unsalted sha256 of the email must NOT match — proves it's keyed.
    const bareSha = crypto.createHash("sha256").update("user@foodknock.com").digest("hex");
    assert.notEqual(hashIdentifier("user@foodknock.com"), bareSha);
});

test("hashIdentifier: output is a 64-char hex string", () => {
    assert.match(hashIdentifier("x@y.com") as string, /^[0-9a-f]{64}$/);
});
