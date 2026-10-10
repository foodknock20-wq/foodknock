// src/lib/__tests__/securityLogic.test.ts
//
// Phase 17.2 — zero-dependency unit tests for the pure security helpers,
// plus two direct, file-content regression checks (F14 header consistency,
// F18 sitemap/noindex consistency) that don't require any mocking.
//
//   node --experimental-strip-types --test src/lib/__tests__/securityLogic.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { maskPhoneLast4, broadcastIdempotencyKey } from "../securityLogic.ts";

const REPO_ROOT = path.resolve(import.meta.dirname, "../../..");

// ── maskPhoneLast4 (F11) ─────────────────────────────────────────────────────

test("maskPhoneLast4: reveals only the last 4 digits", () => {
    assert.equal(maskPhoneLast4("9876543210"), "••••••3210");
});

test("maskPhoneLast4: never throws on malformed input, returns empty string", () => {
    assert.equal(maskPhoneLast4(undefined), "");
    assert.equal(maskPhoneLast4(null), "");
    assert.equal(maskPhoneLast4(12345 as unknown), "");
    assert.equal(maskPhoneLast4(""), "");
});

test("maskPhoneLast4: short strings still mask, never reveal more than exists", () => {
    assert.equal(maskPhoneLast4("12"), "••••••12");
});

// ── broadcastIdempotencyKey (F15) ───────────────────────────────────────────

const BASE_PARAMS = { adminId: "admin1", mode: "broadcast", title: "Flash Sale", body: "50% off today", url: "/menu" };

test("broadcastIdempotencyKey: identical content from the same admin produces an identical key", () => {
    const k1 = broadcastIdempotencyKey(BASE_PARAMS);
    const k2 = broadcastIdempotencyKey({ ...BASE_PARAMS });
    assert.equal(k1, k2);
});

test("broadcastIdempotencyKey: any differing field produces a different key (never falsely deduped)", () => {
    const base = broadcastIdempotencyKey(BASE_PARAMS);
    assert.notEqual(broadcastIdempotencyKey({ ...BASE_PARAMS, title: "Different Title" }), base);
    assert.notEqual(broadcastIdempotencyKey({ ...BASE_PARAMS, body: "different body" }), base);
    assert.notEqual(broadcastIdempotencyKey({ ...BASE_PARAMS, url: "/offers" }), base);
    assert.notEqual(broadcastIdempotencyKey({ ...BASE_PARAMS, adminId: "admin2" }), base);
    assert.notEqual(broadcastIdempotencyKey({ ...BASE_PARAMS, mode: "user", targetUserId: "u1" }), base);
});

test("broadcastIdempotencyKey: different targetUserId (same everything else) produces a different key", () => {
    const a = broadcastIdempotencyKey({ ...BASE_PARAMS, mode: "user", targetUserId: "userA" });
    const b = broadcastIdempotencyKey({ ...BASE_PARAMS, mode: "user", targetUserId: "userB" });
    assert.notEqual(a, b);
});

test("broadcastIdempotencyKey: is namespaced and stable-shaped (sha256 hex)", () => {
    const key = broadcastIdempotencyKey(BASE_PARAMS);
    assert.match(key, /^broadcast-idem:[0-9a-f]{64}$/);
});

// ── F14: X-Frame-Options must not disagree between next.config.ts and vercel.json ──

test("security headers: next.config.ts and vercel.json declare the SAME X-Frame-Options value", () => {
    const nextConfigSrc = fs.readFileSync(path.join(REPO_ROOT, "next.config.ts"), "utf8");
    const vercelJson = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, "vercel.json"), "utf8"));

    const nextMatch = nextConfigSrc.match(/X-Frame-Options[\s\S]{0,40}?value:\s*"([^"]+)"/);
    assert.ok(nextMatch, "next.config.ts should declare X-Frame-Options");
    const nextValue = nextMatch[1];

    const vercelHeaderBlock = vercelJson.headers.find((h: { source: string }) => h.source === "/(.*)");
    const vercelHeader = vercelHeaderBlock.headers.find((h: { key: string }) => h.key === "X-Frame-Options");
    assert.ok(vercelHeader, "vercel.json should declare X-Frame-Options");

    assert.equal(nextValue, vercelHeader.value, "X-Frame-Options must agree between next.config.ts and vercel.json — a mismatch is undefined behavior across browsers");
});

// ── F18: sitemap must not list a URL whose own route marks itself noindex ──

test("SEO: sitemap.ts does not list /cart (which is noindex via cart/layout.tsx)", () => {
    const sitemapSrc = fs.readFileSync(path.join(REPO_ROOT, "src/app/sitemap.ts"), "utf8");
    const cartLayoutSrc = fs.readFileSync(path.join(REPO_ROOT, "src/app/(main)/cart/layout.tsx"), "utf8");

    assert.match(cartLayoutSrc, /index:\s*false/, "cart/layout.tsx should still be noindex (sanity check this test is checking the right thing)");
    assert.doesNotMatch(sitemapSrc, /\$\{BASE_URL\}\/cart[`'"]/, "sitemap.ts should not list /cart as an indexable URL while its own layout marks it noindex");
});
