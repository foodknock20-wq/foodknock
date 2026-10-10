// src/lib/__tests__/integration/pushCampaignCron.integration.test.ts
//
// Phase 17.7 — REAL integration test for the actual exported POST handler
// of src/app/api/push/send-campaign/route.ts. Covers the CRON_SECRET
// authorization gate deterministically.
//
// SCOPE NOTE (documented, not hidden): this route also gates on the
// current real IST wall-clock hour (getISTHour() calls `new Date()`
// directly, with no injectable clock) before it reaches the duplicate-
// campaign-guard logic. Deterministically testing the "outside allowed
// hours" branch and the duplicate-guard branch together would require
// either faking the system clock (risking exactly the kind of fragile,
// time-dependent test the task explicitly warned against) or refactoring
// the route to accept an injectable clock purely for testability (which
// the task also discourages absent a real need). This suite therefore
// covers only the deterministic, clock-independent behavior — the
// authorization gate — and documents the clock-dependent gap honestly
// rather than writing a flaky or falsely-reassuring test for it.
//
// Run: MONGODB_URI="mongodb://127.0.0.1:27017/cafe_app" CRON_SECRET="test-only-cron-secret" npx tsx --test src/lib/__tests__/integration/pushCampaignCron.integration.test.ts

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { verifyIsolatedTestTarget, dropTestDatabase, closeTestConnection } from "./testDb.ts";

import { POST } from "../../../app/api/push/send-campaign/route.ts";

before(async () => { await verifyIsolatedTestTarget(); });

after(async () => {
    await dropTestDatabase();
    await closeTestConnection();
});

// This handler reads `req.nextUrl.searchParams` — a NextRequest-only
// property (same gotcha as loyaltyInconsistencies.integration.test.ts hit
// first). A plain Request cast via `as unknown as NextRequest` would leave
// `.nextUrl` undefined and crash inside the route's try/catch, silently
// turning into a 500 that a loose status-code assertion could mistake for
// a pass — a real NextRequest instance is required.
function req(authHeader?: string): NextRequest {
    const headers = new Headers();
    if (authHeader !== undefined) headers.set("authorization", authHeader);
    return new NextRequest("https://foodknock.test/api/push/send-campaign?slot=morning", { method: "POST", headers });
}

test("real POST /api/push/send-campaign: a missing Authorization header is rejected (401)", async () => {
    const res = await POST(req());
    assert.equal(res.status, 401);
});

test("real POST /api/push/send-campaign: a wrong bearer token is rejected (401)", async () => {
    const res = await POST(req("Bearer totally-wrong-secret"));
    assert.equal(res.status, 401);
});

test("real POST /api/push/send-campaign: the correct CRON_SECRET is accepted and the route runs past the auth gate without crashing (either an hour-gate message or a real campaign summary)", async () => {
    const secret = process.env.CRON_SECRET;
    assert.ok(secret, "this test requires CRON_SECRET to be set in the test environment");
    const res = await POST(req(`Bearer ${secret}`));
    // Must be neither 401 (auth rejected) nor 500 (crashed) — a 500 here
    // would mean the route itself threw, which is exactly the bug class
    // this assertion exists to catch (see this file's req() comment).
    assert.notEqual(res.status, 401);
    assert.notEqual(res.status, 500);
    const body = await res.json();
    assert.ok("success" in body);
});
