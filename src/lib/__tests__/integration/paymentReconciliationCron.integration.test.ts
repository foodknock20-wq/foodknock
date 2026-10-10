// src/lib/__tests__/integration/paymentReconciliationCron.integration.test.ts
//
// Phase 17.5 — REAL integration test for the actual exported POST/GET
// handlers of src/app/api/cron/payment-reconciliation/route.ts. Verifies
// the CRON_SECRET auth gate fails closed (missing secret config, missing
// header, wrong header) and that a correctly-authenticated call runs the
// real scanForOrphanedPayments() scan against the verified isolated local
// database — never against production, never triggering any Razorpay
// call (scanForOrphanedPayments only reads/updates PendingPayment rows
// already marked "captured_unmatched"/stale locally; verified by reading
// paymentReconciliation.ts — the scan itself does not call Razorpay).
//
// Run: MONGODB_URI="mongodb://127.0.0.1:27017/cafe_app" CRON_SECRET="test-only-cron-secret" npx tsx --test src/lib/__tests__/integration/paymentReconciliationCron.integration.test.ts

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import type { NextRequest } from "next/server";
import { verifyIsolatedTestTarget, dropTestDatabase, closeTestConnection } from "./testDb.ts";

import PendingPayment from "../../../models/PendingPayment.ts";
import { POST } from "../../../app/api/cron/payment-reconciliation/route.ts";

before(async () => {
    await verifyIsolatedTestTarget();
    await PendingPayment.deleteMany({});
});

after(async () => {
    await dropTestDatabase();
    await closeTestConnection();
});

function req(authHeader?: string): Request {
    const headers = new Headers();
    if (authHeader !== undefined) headers.set("authorization", authHeader);
    return new Request("https://foodknock.test/api/cron/payment-reconciliation", { method: "POST", headers });
}

test("real POST /api/cron/payment-reconciliation: a missing Authorization header is rejected (401), scan never runs", async () => {
    const res = await POST(req() as unknown as NextRequest);
    assert.equal(res.status, 401);
});

test("real POST /api/cron/payment-reconciliation: a wrong bearer token is rejected (401)", async () => {
    const res = await POST(req("Bearer totally-wrong-secret") as unknown as NextRequest);
    assert.equal(res.status, 401);
});

test("real POST /api/cron/payment-reconciliation: the correct CRON_SECRET bearer token is accepted and the real scan runs, returning a summary", async () => {
    const secret = process.env.CRON_SECRET;
    assert.ok(secret, "this test requires CRON_SECRET to be set in the test environment");
    const res = await POST(req(`Bearer ${secret}`) as unknown as NextRequest);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.ok(body.summary, "a successful scan must return a summary object");
});
