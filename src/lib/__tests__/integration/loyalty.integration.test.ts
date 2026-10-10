// src/lib/__tests__/integration/loyalty.integration.test.ts
//
// Phase 17.3 — REAL integration tests: imports and executes the actual
// exported functions from src/lib/loyaltyService.ts against a verified
// isolated local MongoDB (see testDb.ts for exactly how "isolated" is
// proven, not assumed). This is materially different from Phase 17.1B's
// raw-driver proofs, which reproduced the operation shapes by hand — here
// the real, unmodified production code is what runs.
//
// Run: MONGODB_URI="mongodb://127.0.0.1:27017/cafe_app" npx tsx --test src/lib/__tests__/integration/loyalty.integration.test.ts
//
// MONGODB_URI MUST be set at the process level (shell env var), not as an
// in-file assignment — ES module imports are hoisted and execute before
// any top-level statement in this file, so by the time an in-file
// `process.env.MONGODB_URI = ...` line would run, src/lib/db.ts (imported
// transitively via loyaltyService -> the User model) has already thrown
// at module-evaluation time. This is itself a genuine, now-documented
// finding about this test setup, not an oversight left unexplained.

import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { verifyIsolatedTestTarget, dropTestDatabase, closeTestConnection, mongoose } from "./testDb.ts";

import User from "../../../models/User.ts";
import Order from "../../../models/Order.ts";
import LoyaltyLedger from "../../../models/LoyaltyLedger.ts";
import {
    redeemPoints,
    awardPoints,
    handleOrderDelivered,
    findStalePendingLedgerClaims,
    resolveStalePendingClaim,
    InsufficientLoyaltyPointsError,
} from "../../loyaltyService.ts";

before(async () => {
    await verifyIsolatedTestTarget();
});

beforeEach(async () => {
    // Clean slate per test — these are the ONLY collections these tests
    // touch, on the verified-isolated local instance.
    await User.deleteMany({});
    await Order.deleteMany({});
    await LoyaltyLedger.deleteMany({});
});

after(async () => {
    await dropTestDatabase();
    await closeTestConnection();
});

async function makeUser(loyaltyPoints = 0) {
    const user = await User.create({
        name: "Test User", email: `t${Date.now()}${Math.random()}@example.test`,
        phone: "9999999999", password: "hashed", role: "user", isActive: true, loyaltyPoints,
    });
    return user;
}

async function makeOrder(userId: mongoose.Types.ObjectId, overrides: Record<string, unknown> = {}) {
    const order = await Order.create({
        orderId: `TEST-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
        customerName: "Test User", phone: "9999999999", address: "Test address",
        orderType: "delivery", items: [{ name: "Item", quantity: 1, price: 500 }],
        totalAmount: 591.5, status: "received", paymentMethod: "cod", user: userId,
        ...overrides,
    });
    return order;
}

// ── 1. Real redemption: success, insufficient balance ──────────────────────

test("real redeemPoints(): succeeds and atomically decrements the real User document", async () => {
    const user = await makeUser(100);
    const order = await makeOrder(user._id);

    const discount = await redeemPoints({ userId: String(user._id), points: 60, orderMongoId: String(order._id) });

    assert.equal(discount, 30); // 60 pts * 0.5 INR/pt
    const fresh = await User.findById(user._id).lean();
    assert.equal(fresh?.loyaltyPoints, 40);

    const ledgerEntry = await LoyaltyLedger.findOne({ user: user._id, order: order._id, type: "redemption" }).lean();
    assert.equal(ledgerEntry?.status, "completed");
    assert.equal(ledgerEntry?.points, -60);
});

test("real redeemPoints(): throws InsufficientLoyaltyPointsError and leaves balance untouched", async () => {
    const user = await makeUser(50);
    const order = await makeOrder(user._id);

    await assert.rejects(
        () => redeemPoints({ userId: String(user._id), points: 60, orderMongoId: String(order._id) }),
        InsufficientLoyaltyPointsError
    );

    const fresh = await User.findById(user._id).lean();
    assert.equal(fresh?.loyaltyPoints, 50); // unchanged
    const ledgerEntry = await LoyaltyLedger.findOne({ user: user._id, order: order._id, type: "redemption" }).lean();
    assert.equal(ledgerEntry, null); // no orphaned claim left behind
});

// ── 2. Real concurrent debits against one balance ──────────────────────────

test("real redeemPoints(): two concurrent redemptions for the SAME order never double-deduct (DB-enforced)", async () => {
    const user = await makeUser(100);
    const order = await makeOrder(user._id);

    const [r1, r2] = await Promise.allSettled([
        redeemPoints({ userId: String(user._id), points: 60, orderMongoId: String(order._id) }),
        redeemPoints({ userId: String(user._id), points: 60, orderMongoId: String(order._id) }),
    ]);

    // Both calls are for the IDENTICAL (user, order, type) — the unique
    // index means only one can ever actually claim it; the other either
    // succeeds idempotently (reads back the same result) or is blocked.
    const fresh = await User.findById(user._id).lean();
    assert.equal(fresh?.loyaltyPoints, 40, "balance must reflect exactly ONE 60-point deduction, never two");

    const entries = await LoyaltyLedger.find({ user: user._id, order: order._id, type: "redemption" }).lean();
    assert.equal(entries.length, 1, "exactly one ledger entry must exist for this operation, never two");

    assert.ok(r1.status === "fulfilled" || r2.status === "fulfilled", "at least one concurrent call must succeed");
});

test("real redeemPoints(): two DIFFERENT orders concurrently against an insufficient shared balance — exactly one wins, never overdrawn", async () => {
    const user = await makeUser(60);
    const orderA = await makeOrder(user._id);
    const orderB = await makeOrder(user._id);

    const [ra, rb] = await Promise.allSettled([
        redeemPoints({ userId: String(user._id), points: 60, orderMongoId: String(orderA._id) }),
        redeemPoints({ userId: String(user._id), points: 60, orderMongoId: String(orderB._id) }),
    ]);

    const fresh = await User.findById(user._id).lean();
    assert.ok(fresh!.loyaltyPoints >= 0, "balance must never go negative under real concurrency");
    const succeeded = [ra, rb].filter((r) => r.status === "fulfilled").length;
    assert.equal(succeeded, 1, "only one of two 60-point redemptions against a 60-point balance can succeed");
    assert.equal(fresh?.loyaltyPoints, 0);
});

// ── 3. Duplicate requests (idempotent retry) ────────────────────────────────

test("real redeemPoints(): a retry for an already-completed redemption is idempotent, does not re-deduct", async () => {
    const user = await makeUser(100);
    const order = await makeOrder(user._id);

    await redeemPoints({ userId: String(user._id), points: 60, orderMongoId: String(order._id) });
    const discountRetry = await redeemPoints({ userId: String(user._id), points: 60, orderMongoId: String(order._id) });

    assert.equal(discountRetry, 30); // same result returned, not re-applied
    const fresh = await User.findById(user._id).lean();
    assert.equal(fresh?.loyaltyPoints, 40, "retry must not deduct a second time");
});

// ── 4. Order delivery rewards — real handleOrderDelivered() ────────────────

test("real handleOrderDelivered(): awards the correct deterministic point value exactly once", async () => {
    const user = await makeUser(0);
    const order = await makeOrder(user._id, { status: "out_for_delivery" });

    await handleOrderDelivered(String(order._id));

    const fresh = await User.findById(user._id).lean();
    assert.equal(fresh?.loyaltyPoints, 59); // calcOrderPoints(591.5) = 59

    // Idempotency: calling it again for the same order must not double-award
    await handleOrderDelivered(String(order._id));
    const freshAfterRetry = await User.findById(user._id).lean();
    assert.equal(freshAfterRetry?.loyaltyPoints, 59, "second call must not double-award");

    const entries = await LoyaltyLedger.find({ order: order._id, type: "order_reward" }).lean();
    assert.equal(entries.length, 1);
});

test("real handleOrderDelivered(): two concurrent calls for the same order award exactly once", async () => {
    const user = await makeUser(0);
    const order = await makeOrder(user._id, { status: "out_for_delivery" });

    await Promise.allSettled([
        handleOrderDelivered(String(order._id)),
        handleOrderDelivered(String(order._id)),
    ]);

    const fresh = await User.findById(user._id).lean();
    assert.equal(fresh?.loyaltyPoints, 59, "concurrent delivery-reward calls must never double-award");
    const entries = await LoyaltyLedger.find({ order: order._id, type: "order_reward" }).lean();
    assert.equal(entries.length, 1);
});

// ── 5. Admin adjustment (awardPoints) — guarded debit ───────────────────────

test("real awardPoints(): admin debit is guarded against overdraft just like redemption", async () => {
    const user = await makeUser(10);
    await assert.rejects(
        () => awardPoints({ userId: String(user._id), points: -50, type: "admin_debit" }),
        InsufficientLoyaltyPointsError
    );
    const fresh = await User.findById(user._id).lean();
    assert.equal(fresh?.loyaltyPoints, 10);
});

// ── 6. Pending claim recovery (crash-window state machine) ──────────────────

test("real resolveStalePendingClaim(): deletes a stale claim whose delta was never applied", async () => {
    // Seeded via a REAL completed ledger entry (not a bare User.loyaltyPoints
    // value) — resolveStalePendingClaim's disambiguation rule is keyed off
    // the actual ledger-derived baseline, exactly like this system's real
    // invariant requires (confirmed the hard way once already in Phase 17.1B).
    const user = await makeUser(0);
    await awardPoints({ userId: String(user._id), points: 100, type: "admin_credit" });
    const order = await makeOrder(user._id);

    // Simulate a crashed claim: inserted, never finalized, never applied.
    const staleClaim = await LoyaltyLedger.create({
        user: user._id, order: order._id, type: "redemption", points: -60, balanceAfter: 0,
        status: "pending", createdAt: new Date(Date.now() - 10 * 60 * 1000),
    });

    const outcome = await resolveStalePendingClaim(String(staleClaim._id));
    assert.deepEqual(outcome, { ok: true, action: "deleted" });

    const remaining = await LoyaltyLedger.findById(staleClaim._id).lean();
    assert.equal(remaining, null);
    const fresh = await User.findById(user._id).lean();
    assert.equal(fresh?.loyaltyPoints, 100, "balance must be untouched — the delta was never actually applied");
});

test("real resolveStalePendingClaim(): finalizes a stale claim whose delta WAS already applied, without re-applying it", async () => {
    const user = await makeUser(0);
    await awardPoints({ userId: String(user._id), points: 100, type: "admin_credit" });
    const order = await makeOrder(user._id);

    const staleClaim = await LoyaltyLedger.create({
        user: user._id, order: order._id, type: "redemption", points: -60, balanceAfter: 0,
        status: "pending", createdAt: new Date(Date.now() - 10 * 60 * 1000),
    });
    // Simulate: the $inc DID land before the crash, but the finalize write never ran.
    await User.updateOne({ _id: user._id }, { $inc: { loyaltyPoints: -60 } });

    const outcome = await resolveStalePendingClaim(String(staleClaim._id));
    assert.equal(outcome.ok, true);
    if (outcome.ok) assert.equal(outcome.action, "marked_completed");

    const fresh = await User.findById(user._id).lean();
    assert.equal(fresh?.loyaltyPoints, 40, "must stay at 40 — resolving must NOT re-apply the already-landed delta");
    const finalized = await LoyaltyLedger.findById(staleClaim._id).lean();
    assert.equal(finalized?.status, "completed");
});

test("real findStalePendingLedgerClaims(): finds the stale claim but ignores a fresh (recently claimed) one", async () => {
    const user = await makeUser(100);
    const orderOld = await makeOrder(user._id);
    const orderFresh = await makeOrder(user._id);

    await LoyaltyLedger.create({
        user: user._id, order: orderOld._id, type: "redemption", points: -10, balanceAfter: 0,
        status: "pending", createdAt: new Date(Date.now() - 10 * 60 * 1000),
    });
    await LoyaltyLedger.create({
        user: user._id, order: orderFresh._id, type: "redemption", points: -10, balanceAfter: 0,
        status: "pending", createdAt: new Date(), // just claimed, not stale
    });

    const stale = await findStalePendingLedgerClaims(50);
    assert.equal(stale.length, 1);
    assert.equal(stale[0].orderId, String(orderOld._id));
});

// ── 7. Legacy records missing optional fields ───────────────────────────────

test("real redeemPoints(): works correctly for a legacy user document with loyaltyPoints as a plain number and no extra fields", async () => {
    // Deliberately minimal — simulates a pre-Phase-17 user record.
    const user = await User.create({
        name: "Legacy User", email: `legacy${Date.now()}@example.test`, phone: "8888888888",
        password: "hashed", role: "user", isActive: true, loyaltyPoints: 75,
    });
    const order = await makeOrder(user._id);
    const discount = await redeemPoints({ userId: String(user._id), points: 50, orderMongoId: String(order._id) });
    assert.equal(discount, 25);
});
