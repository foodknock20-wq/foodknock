// src/lib/__tests__/integration/accountDeletionEligibility.integration.test.ts
//
// REAL integration tests for the two tightly-coupled features added in this
// change, run against the verified-isolated local MongoDB (see testDb.ts):
//
//   1. The recreation-proof first-order free-delivery ledger
//      (src/lib/promotionEligibility.ts + firstFreeDelivery.ts).
//   2. The account-deletion orchestration (src/lib/accountDeletion.ts):
//      anonymizes orders in place, records eligibility when the benefit was
//      already spent, and removes the user document.
//
// Run:
//   MONGODB_URI="mongodb://127.0.0.1:27017/cafe_app" npx tsx --test \
//     src/lib/__tests__/integration/accountDeletionEligibility.integration.test.ts
//
// PROMO_ELIGIBILITY_SECRET is read at call time (inside getSecret), so an
// in-file assignment is safe here (unlike MONGODB_URI, which db.ts reads at
// import time and must therefore come from the shell — see loyalty test).

process.env.PROMO_ELIGIBILITY_SECRET = process.env.PROMO_ELIGIBILITY_SECRET || "integration-promo-secret";

import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { verifyIsolatedTestTarget, dropTestDatabase, closeTestConnection } from "./testDb.ts";

import User from "../../../models/User.ts";
import Order from "../../../models/Order.ts";
import PromotionEligibility from "../../../models/PromotionEligibility.ts";
import { checkFirstFreeDelivery, consumeFirstFreeDelivery } from "../../firstFreeDelivery.ts";
import { hasConsumedFirstDelivery } from "../../promotionEligibility.ts";
import { deleteAccount } from "../../accountDeletion.ts";

const EMAIL = "recreate@foodknock.com";

async function makeUser(overrides: Record<string, unknown> = {}) {
    return User.create({
        name: "Test Person",
        email: EMAIL,
        phone: "9990001111",
        password: "hashed-placeholder",
        firstDeliveryFreeUsed: false,
        deliveredOrderCount: 0,
        ...overrides,
    });
}

before(async () => {
    await verifyIsolatedTestTarget();
});

beforeEach(async () => {
    await User.deleteMany({});
    await Order.deleteMany({});
    await PromotionEligibility.deleteMany({});
});

after(async () => {
    await dropTestDatabase();
    await closeTestConnection();
});

test("first order: a fresh user with no ledger entry is eligible", async () => {
    const user = await makeUser();
    const { eligible } = await checkFirstFreeDelivery(String(user._id), "delivery");
    assert.equal(eligible, true);
});

test("consume records BOTH the user flag and the cross-identity ledger", async () => {
    const user = await makeUser();
    await consumeFirstFreeDelivery(String(user._id));

    const reloaded = await User.findById(user._id).lean<{ firstDeliveryFreeUsed?: boolean }>();
    assert.equal(reloaded?.firstDeliveryFreeUsed, true, "user flag must be set");
    assert.equal(await hasConsumedFirstDelivery(EMAIL), true, "ledger must record the email");
});

test("RECREATION EXPLOIT IS CLOSED: a brand-new user with the same email is NOT eligible", async () => {
    // First account consumes the benefit, then is deleted.
    const first = await makeUser();
    await consumeFirstFreeDelivery(String(first._id));
    await User.deleteMany({});

    // Recreate: a genuinely new user doc — fresh flags, zero delivered orders.
    const recreated = await makeUser();
    assert.equal(recreated.firstDeliveryFreeUsed, false);
    assert.equal(recreated.deliveredOrderCount, 0);

    const { eligible } = await checkFirstFreeDelivery(String(recreated._id), "delivery");
    assert.equal(eligible, false, "same verified email must not reclaim the consumed benefit");
});

test("pickup orders and anonymous callers are never eligible", async () => {
    const user = await makeUser();
    assert.equal((await checkFirstFreeDelivery(String(user._id), "pickup")).eligible, false);
    assert.equal((await checkFirstFreeDelivery(null, "delivery")).eligible, false);
});

test("deleteAccount: anonymizes orders in place but preserves financial totals", async () => {
    const user = await makeUser({ deliveredOrderCount: 1, firstDeliveryFreeUsed: true });
    const order = await Order.create({
        orderId: "ORD-TEST-1",
        user: user._id,
        customerName: "Real Name",
        phone: "9990001111",
        address: "123 Real Street",
        landmark: "Near park",
        note: "ring the bell",
        orderType: "delivery",
        items: [{ name: "Burger", quantity: 1, price: 199, productId: null }],
        deliveryFee: 0,
        platformFee: 5,
        totalAmount: 204,
        status: "delivered",
        paymentMethod: "cod",
    });

    await deleteAccount(String(user._id));

    const anon = await Order.findById(order._id).lean<{
        customerName?: string;
        phone?: string;
        address?: string;
        totalAmount?: number;
        status?: string;
    }>();
    assert.ok(anon, "order must still exist (financial record preserved)");
    assert.equal(anon!.customerName, "Deleted customer");
    assert.equal(anon!.phone, "[deleted]");
    assert.equal(anon!.address, "[deleted]");
    // Money + status untouched.
    assert.equal(anon!.totalAmount, 204);
    assert.equal(anon!.status, "delivered");

    // User document removed.
    assert.equal(await User.findById(user._id).lean(), null);
    // Benefit was spent → ledger keeps it consumed so recreation can't reclaim.
    assert.equal(await hasConsumedFirstDelivery(EMAIL), true);
});

test("deleteAccount: deleting BEFORE a qualifying order does NOT burn the benefit", async () => {
    const user = await makeUser({ deliveredOrderCount: 0, firstDeliveryFreeUsed: false });
    await deleteAccount(String(user._id));
    assert.equal(
        await hasConsumedFirstDelivery(EMAIL),
        false,
        "an unused benefit must remain available to a future account"
    );
});

test("deleteAccount: is idempotent (second call on an already-deleted user succeeds)", async () => {
    const user = await makeUser();
    const first = await deleteAccount(String(user._id));
    assert.equal(first.deleted, true);
    const second = await deleteAccount(String(user._id));
    assert.equal(second.alreadyDeleted, true);
});

test("deleteAccount: refuses admin accounts", async () => {
    const admin = await makeUser({ role: "admin" });
    await assert.rejects(() => deleteAccount(String(admin._id)), /Admin accounts/);
    assert.ok(await User.findById(admin._id).lean(), "admin user must NOT be deleted");
});
