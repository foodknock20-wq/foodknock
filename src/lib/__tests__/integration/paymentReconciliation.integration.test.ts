// src/lib/__tests__/integration/paymentReconciliation.integration.test.ts
//
// Phase 17.3 — REAL integration tests for src/lib/paymentReconciliation.ts's
// core atomic-claim primitives, against a verified isolated local MongoDB.
// Deliberately does NOT call findCapturedPaymentOnRazorpay/
// scanForOrphanedPayments/createOrderFromPendingPayment's full
// createOrderCore path — those require either a live Razorpay call (never
// made here) or a fuller Product/stock fixture graph than this phase's
// scope needs; claimPendingPayment/releaseClaim/waitForCompletion are the
// actual duplicate-prevention primitives and are exercised for real.
//
// Run: MONGODB_URI="mongodb://127.0.0.1:27017/cafe_app" npx tsx --test src/lib/__tests__/integration/paymentReconciliation.integration.test.ts

import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { verifyIsolatedTestTarget, dropTestDatabase, closeTestConnection } from "./testDb.ts";

import PendingPayment from "../../../models/PendingPayment.ts";
import Order from "../../../models/Order.ts";
import { claimPendingPayment, releaseClaim, waitForCompletion } from "../../paymentReconciliation.ts";

before(async () => { await verifyIsolatedTestTarget(); });

beforeEach(async () => {
    await PendingPayment.deleteMany({});
    await Order.deleteMany({});
});

after(async () => {
    await dropTestDatabase();
    await closeTestConnection();
});

async function makePending(razorpayOrderId: string) {
    return PendingPayment.create({
        razorpayOrderId,
        status: "created",
        expectedAmount: 500,
        payload: {
            customerName: "Test", phone: "9999999999", address: "Test address", orderType: "delivery",
            items: [{ _id: "p1", name: "Item", price: 500, quantity: 1 }],
            linkedUserId: null, validatedRedeemPoints: 0,
        },
    });
}

// ── 1. Real claimPendingPayment(): the actual atomic-claim primitive ───────

test("real claimPendingPayment(): a single claim attempt succeeds and sets status to processing", async () => {
    await makePending("order_A");
    const claimed = await claimPendingPayment("order_A", "pay_A");
    assert.ok(claimed);
    assert.equal(claimed?.status, "processing");
    assert.equal(claimed?.razorpayPaymentId, "pay_A");

    const fresh = await PendingPayment.findOne({ razorpayOrderId: "order_A" }).lean();
    assert.equal(fresh?.status, "processing");
});

test("real claimPendingPayment(): two concurrent claims for the SAME payment — exactly one wins (the real webhook-vs-verify race)", async () => {
    await makePending("order_B");

    const [c1, c2] = await Promise.all([
        claimPendingPayment("order_B", "pay_B"),
        claimPendingPayment("order_B", "pay_B"),
    ]);

    const winners = [c1, c2].filter((c) => c !== null);
    assert.equal(winners.length, 1, "exactly one of the two concurrent claim attempts must win — this IS the duplicate-order-creation prevention mechanism");

    const fresh = await PendingPayment.findOne({ razorpayOrderId: "order_B" }).lean();
    assert.equal(fresh?.status, "processing");
    assert.equal(fresh?.razorpayPaymentId, "pay_B");
});

test("real claimPendingPayment(): cannot claim an already-completed payment (prevents re-processing after success)", async () => {
    const pending = await makePending("order_C");
    await PendingPayment.updateOne({ _id: pending._id }, { $set: { status: "completed", orderId: "FK-TEST" } });

    const claimed = await claimPendingPayment("order_C", "pay_C");
    assert.equal(claimed, null, "a completed payment must never be re-claimable");
});

// ── 2. Real releaseClaim(): safe rollback after a failed order-creation attempt ──

test("real releaseClaim(): resets a processing claim back to failed, clearing the payment id for a future retry", async () => {
    await makePending("order_D");
    await claimPendingPayment("order_D", "pay_D");

    await releaseClaim("order_D", "stock unavailable");

    const fresh = await PendingPayment.findOne({ razorpayOrderId: "order_D" }).lean();
    assert.equal(fresh?.status, "failed");
    assert.equal(fresh?.razorpayPaymentId, undefined, "razorpayPaymentId must be unset so a future claim attempt can succeed");
    assert.equal(fresh?.failureReason, "stock unavailable");

    // Prove the retry path actually works: a fresh claim attempt now succeeds.
    const retryClaim = await claimPendingPayment("order_D", "pay_D_retry");
    assert.ok(retryClaim, "after release, the payment must be claimable again");
});

// ── 3. Real waitForCompletion(): the polling path used when a claim is lost ─

test("real waitForCompletion(): detects completion that happens shortly after polling starts", async () => {
    const pending = await makePending("order_E");
    const order = await Order.create({
        orderId: "FK-WAITTEST", customerName: "Test", phone: "9999999999", address: "Addr",
        orderType: "delivery", items: [{ name: "Item", quantity: 1, price: 500 }],
        totalAmount: 500, status: "received", paymentMethod: "razorpay", razorpayPaymentId: "pay_E",
    });

    // Simulate the OTHER (winning) caller completing the order shortly after
    // this caller starts polling.
    setTimeout(() => {
        PendingPayment.updateOne({ _id: pending._id }, { $set: { status: "completed", orderId: order.orderId } }).catch(() => {});
    }, 300);

    const result = await waitForCompletion("order_E", 10, 150);
    assert.ok(result, "waitForCompletion must detect the completion that happened mid-poll");
    assert.equal(result?.orderId, "FK-WAITTEST");
});

test("real waitForCompletion(): returns null if nothing completes within the polling window (never fabricates success)", async () => {
    await makePending("order_F"); // stays "created" forever — nothing completes it
    const result = await waitForCompletion("order_F", 3, 50);
    assert.equal(result, null);
});
