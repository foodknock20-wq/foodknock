// src/lib/__tests__/integration/orderCancellation.integration.test.ts
//
// Phase 17.3 — REAL integration tests for src/lib/orderCancellation.ts's
// cancelOrder() against a verified isolated local MongoDB. Exercises the
// real stock-restoration and loyalty-reversal compensating actions, and
// their idempotency guards, with real Order/User/LoyaltyLedger documents.
//
// Run: MONGODB_URI="mongodb://127.0.0.1:27017/cafe_app" npx tsx --test src/lib/__tests__/integration/orderCancellation.integration.test.ts

import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { verifyIsolatedTestTarget, dropTestDatabase, closeTestConnection } from "./testDb.ts";

import User from "../../../models/User.ts";
import Order from "../../../models/Order.ts";
import Product from "../../../models/Product.ts";
import LoyaltyLedger from "../../../models/LoyaltyLedger.ts";
import { cancelOrder } from "../../orderCancellation.ts";
import { awardPoints, redeemPoints } from "../../loyaltyService.ts";

before(async () => { await verifyIsolatedTestTarget(); });

beforeEach(async () => {
    await User.deleteMany({});
    await Order.deleteMany({});
    await Product.deleteMany({});
    await LoyaltyLedger.deleteMany({});
});

after(async () => {
    await dropTestDatabase();
    await closeTestConnection();
});

test("real cancelOrder(): restores stock and reverses redeemed loyalty points exactly once", async () => {
    const product = await Product.create({ name: "Burger", slug: `burger-${Date.now()}`, price: 200, stock: 5, isAvailable: true, image: "x.jpg", category: "food", description: "d" });
    const user = await User.create({ name: "T", email: `t${Date.now()}@example.test`, phone: "9999999999", password: "x", role: "user", isActive: true, loyaltyPoints: 0 });
    await awardPoints({ userId: String(user._id), points: 100, type: "admin_credit" });

    const order = await Order.create({
        orderId: `FK-CANCEL-${Date.now()}`, customerName: "T", phone: "9999999999", address: "Addr",
        orderType: "delivery", items: [{ productId: product._id, name: "Burger", quantity: 2, price: 200 }],
        totalAmount: 400 - 25, redeemedPoints: 50, redeemedAmount: 25, status: "received",
        paymentMethod: "cod", user: user._id,
    });
    await redeemPoints({ userId: String(user._id), points: 50, orderMongoId: String(order._id) });
    await Product.updateOne({ _id: product._id }, { $inc: { stock: -2 } }); // simulate the real checkout-time decrement

    const result = await cancelOrder({ orderId: String(order._id), actor: { type: "customer" }, reason: "changed_mind" });
    assert.equal(result.alreadyCancelled, false);

    const freshProduct = await Product.findById(product._id).lean();
    assert.equal(freshProduct?.stock, 5, "stock must be fully restored");

    const freshUser = await User.findById(user._id).lean();
    assert.equal(freshUser?.loyaltyPoints, 100, "redeemed points must be fully reversed (50 credited back - originally had 50 after redemption)");

    const reversalEntries = await LoyaltyLedger.find({ order: order._id, type: "redemption_reversal" }).lean();
    assert.equal(reversalEntries.length, 1);
});

test("real cancelOrder(): calling it twice (duplicate cancellation) never double-restores stock or double-reverses points", async () => {
    const product = await Product.create({ name: "Pizza", slug: `pizza-${Date.now()}`, price: 300, stock: 3, isAvailable: true, image: "x.jpg", category: "food", description: "d" });
    const user = await User.create({ name: "T2", email: `t2${Date.now()}@example.test`, phone: "9999999999", password: "x", role: "user", isActive: true, loyaltyPoints: 0 });
    await awardPoints({ userId: String(user._id), points: 80, type: "admin_credit" });

    const order = await Order.create({
        orderId: `FK-CANCEL2-${Date.now()}`, customerName: "T2", phone: "9999999999", address: "Addr",
        orderType: "delivery", items: [{ productId: product._id, name: "Pizza", quantity: 1, price: 300 }],
        totalAmount: 270, redeemedPoints: 60, redeemedAmount: 30, status: "received",
        paymentMethod: "cod", user: user._id,
    });
    await redeemPoints({ userId: String(user._id), points: 60, orderMongoId: String(order._id) });
    await Product.updateOne({ _id: product._id }, { $inc: { stock: -1 } });

    await cancelOrder({ orderId: String(order._id), actor: { type: "customer" }, reason: "changed_mind" });
    const second = await cancelOrder({ orderId: String(order._id), actor: { type: "customer" }, reason: "changed_mind" });
    assert.equal(second.alreadyCancelled, true, "second call must be recognized as idempotent, not re-run side effects");

    const freshProduct = await Product.findById(product._id).lean();
    assert.equal(freshProduct?.stock, 3, "stock must be restored exactly once, not twice");

    const freshUser = await User.findById(user._id).lean();
    assert.equal(freshUser?.loyaltyPoints, 80, "points must be reversed exactly once, not twice");

    const reversalEntries = await LoyaltyLedger.find({ order: order._id, type: "redemption_reversal" }).lean();
    assert.equal(reversalEntries.length, 1, "exactly one reversal ledger entry, never two");
});

test("real cancelOrder(): concurrent duplicate cancellation calls never double-reverse (DB-enforced, not just app-level)", async () => {
    const user = await User.create({ name: "T3", email: `t3${Date.now()}@example.test`, phone: "9999999999", password: "x", role: "user", isActive: true, loyaltyPoints: 0 });
    await awardPoints({ userId: String(user._id), points: 90, type: "admin_credit" });

    const order = await Order.create({
        orderId: `FK-CANCEL3-${Date.now()}`, customerName: "T3", phone: "9999999999", address: "Addr",
        orderType: "pickup", items: [{ name: "Item", quantity: 1, price: 200 }],
        totalAmount: 170, redeemedPoints: 60, redeemedAmount: 30, status: "received",
        paymentMethod: "cod", user: user._id,
    });
    await redeemPoints({ userId: String(user._id), points: 60, orderMongoId: String(order._id) });

    await Promise.allSettled([
        cancelOrder({ orderId: String(order._id), actor: { type: "customer" }, reason: "changed_mind" }),
        cancelOrder({ orderId: String(order._id), actor: { type: "customer" }, reason: "changed_mind" }),
    ]);

    const freshUser = await User.findById(user._id).lean();
    assert.equal(freshUser?.loyaltyPoints, 90, "concurrent cancellation attempts must never double-reverse points");
    const reversalEntries = await LoyaltyLedger.find({ order: order._id, type: "redemption_reversal" }).lean();
    assert.equal(reversalEntries.length, 1);
});
