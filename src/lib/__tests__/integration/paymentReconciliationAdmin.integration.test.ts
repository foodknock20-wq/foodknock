// src/lib/__tests__/integration/paymentReconciliationAdmin.integration.test.ts
//
// Phase 17.5 — REAL integration test for the actual exported POST
// handlers of src/app/api/admin/payment-reconciliation/[id]/recover/route.ts
// and .../[id]/dismiss/route.ts, against a verified isolated local
// MongoDB. Closes PART of the Phase 17.3/17.4 coverage gap for the
// payment-reconciliation admin actions.
//
// SCOPE NOTE (documented, not a gap hidden from the report): attemptRecovery()
// re-verifies a captured payment against the LIVE Razorpay API before
// creating an order — see paymentReconciliation.ts. This suite only
// exercises the authorization gate and the "not_found"/"invalid id"
// branches, which all return BEFORE any Razorpay call is reached (verified
// by reading attemptRecovery()'s source: the first statement is
// `PendingPayment.findById()`, and `not_found` returns immediately when
// that's null). The success/already-captured/claim paths that actually
// reach Razorpay are NOT exercised here — doing so safely would require
// mocking Razorpay's SDK at the boundary, which is a larger, separate task
// not attempted in this pass. dismissReconciliation() never calls
// Razorpay at all, so its success path IS exercised below.
//
// Run: MONGODB_URI="mongodb://127.0.0.1:27017/cafe_app" JWT_SECRET="test-only-secret-not-real" npx tsx --test src/lib/__tests__/integration/paymentReconciliationAdmin.integration.test.ts

import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { verifyIsolatedTestTarget, dropTestDatabase, closeTestConnection } from "./testDb.ts";

import User from "../../../models/User.ts";
import PendingPayment from "../../../models/PendingPayment.ts";
import { signToken } from "../../auth.ts";
import { POST as recoverPOST } from "../../../app/api/admin/payment-reconciliation/[id]/recover/route.ts";
import { POST as dismissPOST } from "../../../app/api/admin/payment-reconciliation/[id]/dismiss/route.ts";

before(async () => { await verifyIsolatedTestTarget(); });

beforeEach(async () => {
    await User.deleteMany({});
    await PendingPayment.deleteMany({});
});

after(async () => {
    await dropTestDatabase();
    await closeTestConnection();
});

function req(token?: string, body?: unknown): Request {
    const headers = new Headers();
    if (token) headers.set("cookie", `token=${encodeURIComponent(token)}`);
    if (body !== undefined) {
        headers.set("content-type", "application/json");
        return new Request("https://foodknock.test/api/test", { method: "POST", headers, body: JSON.stringify(body) });
    }
    return new Request("https://foodknock.test/api/test", { method: "POST", headers });
}

async function makeAdmin() {
    return User.create({
        name: "Admin", email: `admin${Date.now()}${Math.random()}@example.test`,
        phone: "9999999999", password: "hashed", role: "admin", isActive: true,
    });
}
async function makeUser() {
    return User.create({
        name: "U", email: `u${Date.now()}${Math.random()}@example.test`,
        phone: "9999999999", password: "hashed", role: "user", isActive: true,
    });
}

async function makePendingPayment(overrides: Partial<Record<string, unknown>> = {}) {
    return PendingPayment.create({
        razorpayOrderId: `order_${Date.now()}${Math.random().toString(36).slice(2)}`,
        status: "failed",
        expectedAmount: 500,
        payload: {
            customerName: "T", phone: "9999999999", address: "Addr", orderType: "delivery",
            items: [{ _id: "1", name: "Item", price: 500, quantity: 1 }],
        },
        ...overrides,
    });
}

// ── recover — authorization + not_found/invalid-id only (no Razorpay call) ─

test("real POST .../recover: unauthenticated request is rejected", async () => {
    const res = await recoverPOST(req(), { params: Promise.resolve({ id: "000000000000000000000000" }) });
    assert.equal(res.status, 403);
});

test("real POST .../recover: a non-admin's request is rejected", async () => {
    const user = await makeUser();
    const token = signToken({ userId: String(user._id), email: user.email, role: "user" });
    const res = await recoverPOST(req(token), { params: Promise.resolve({ id: "000000000000000000000000" }) });
    assert.equal(res.status, 403);
});

test("real POST .../recover: an invalid reconciliation id is rejected with 400", async () => {
    const admin = await makeAdmin();
    const token = signToken({ userId: String(admin._id), email: admin.email, role: "admin" });
    const res = await recoverPOST(req(token), { params: Promise.resolve({ id: "not-a-valid-id" }) });
    assert.equal(res.status, 400);
});

test("real POST .../recover: a well-formed but nonexistent id returns not_found (404) — returns before any Razorpay call", async () => {
    const admin = await makeAdmin();
    const token = signToken({ userId: String(admin._id), email: admin.email, role: "admin" });
    const res = await recoverPOST(req(token), { params: Promise.resolve({ id: "000000000000000000000000" }) });
    assert.equal(res.status, 404);
    const body = await res.json();
    assert.equal(body.reason, "not_found");
});

test("real POST .../recover: an already-dismissed case is rejected as already_terminal (409), never re-attempted", async () => {
    const admin = await makeAdmin();
    const token = signToken({ userId: String(admin._id), email: admin.email, role: "admin" });
    const pending = await makePendingPayment({ reconciliationState: "dismissed" });
    const res = await recoverPOST(req(token), { params: Promise.resolve({ id: String(pending._id) }) });
    assert.equal(res.status, 409);
    const body = await res.json();
    assert.equal(body.reason, "already_terminal");
});

// ── dismiss — authorization + validation + real success path (no Razorpay) ─

test("real POST .../dismiss: unauthenticated request is rejected", async () => {
    const res = await dismissPOST(req(undefined, { note: "confirmed refunded manually" }), { params: Promise.resolve({ id: "000000000000000000000000" }) });
    assert.equal(res.status, 403);
});

test("real POST .../dismiss: a non-admin's request is rejected", async () => {
    const user = await makeUser();
    const token = signToken({ userId: String(user._id), email: user.email, role: "user" });
    const res = await dismissPOST(req(token, { note: "confirmed refunded manually" }), { params: Promise.resolve({ id: "000000000000000000000000" }) });
    assert.equal(res.status, 403);
});

test("real POST .../dismiss: a too-short note is rejected (financial audit trail requires a real reason)", async () => {
    const admin = await makeAdmin();
    const token = signToken({ userId: String(admin._id), email: admin.email, role: "admin" });
    const pending = await makePendingPayment({ reconciliationState: "pending_review" });
    const res = await dismissPOST(req(token, { note: "ok" }), { params: Promise.resolve({ id: String(pending._id) }) });
    assert.equal(res.status, 400);
});

test("real POST .../dismiss: a valid admin dismissal with a real note succeeds and persists reconciliationState='dismissed'", async () => {
    const admin = await makeAdmin();
    const token = signToken({ userId: String(admin._id), email: admin.email, role: "admin" });
    const pending = await makePendingPayment({ reconciliationState: "pending_review" });

    const res = await dismissPOST(req(token, { note: "Confirmed manually refunded via Razorpay dashboard" }), { params: Promise.resolve({ id: String(pending._id) }) });
    assert.equal(res.status, 200);

    const fresh = await PendingPayment.findById(pending._id).lean();
    assert.equal(fresh?.reconciliationState, "dismissed");
    assert.equal(fresh?.reviewNote, "Confirmed manually refunded via Razorpay dashboard");
});

test("real POST .../dismiss: dismissing an already-completed payment (one that already has an order) is rejected", async () => {
    const admin = await makeAdmin();
    const token = signToken({ userId: String(admin._id), email: admin.email, role: "admin" });
    const pending = await makePendingPayment({ status: "completed", reconciliationState: "pending_review" });

    const res = await dismissPOST(req(token, { note: "Trying to dismiss a completed payment" }), { params: Promise.resolve({ id: String(pending._id) }) });
    assert.equal(res.status, 400);
    const fresh = await PendingPayment.findById(pending._id).lean();
    assert.equal(fresh?.reconciliationState, "pending_review", "a completed payment's state must not be changed by a rejected dismiss attempt");
});
