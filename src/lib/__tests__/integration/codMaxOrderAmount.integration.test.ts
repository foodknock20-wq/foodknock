// src/lib/__tests__/integration/codMaxOrderAmount.integration.test.ts
//
// REAL integration tests for the MongoDB-managed COD maximum-cap, run
// against the verified-isolated local MongoDB (testDb.ts). Covers the
// resolver fallback, admin-write validation, settings preservation, and
// authoritative server-side enforcement through the real createOrderCore().
//
// Run (secrets at SHELL level — auth.ts captures JWT_SECRET at import):
//   $env:JWT_SECRET="test-jwt-secret"
//   $env:PROMO_ELIGIBILITY_SECRET="test-promo-secret"
//   $env:MONGODB_URI="mongodb://127.0.0.1:27017/cafe_app"
//   npx tsx --test src/lib/__tests__/integration/codMaxOrderAmount.integration.test.ts
//
// FLAT_DELIVERY_FEE = 29, PLATFORM_FEE = 14 (src/lib/delivery.ts). With a
// not-configured kitchen (default) and free delivery disabled, the pricing
// engine returns the flat fee, so grossTotal = subtotal + 29 + 14.

process.env.PROMO_ELIGIBILITY_SECRET = process.env.PROMO_ELIGIBILITY_SECRET || "test-promo-secret";

import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { verifyIsolatedTestTarget, dropTestDatabase, closeTestConnection } from "./testDb.ts";

import DeliverySettings from "../../../models/DeliverySettings.ts";
import User from "../../../models/User.ts";
import Order from "../../../models/Order.ts";
import Product from "../../../models/Product.ts";
import { getDeliverySettings, updateDeliverySettings } from "../../deliverySettings.ts";
import { createOrderCore } from "../../createOrderCore.ts";

const DELIVERY_FEE = 29;
const PLATFORM_FEE = 14;
const FEES = DELIVERY_FEE + PLATFORM_FEE; // 43

/** Disable free delivery so the flat fee is deterministic, and set the cap. */
async function configure(codMaxOrderAmount: number) {
    await updateDeliverySettings({
        freeDelivery: { firstOrderFreeEnabled: false, thresholdEnabled: false },
        orderRules: { codMaxOrderAmount },
    });
}

async function makeUser() {
    return User.create({
        name: "COD Tester",
        email: `cod_${Date.now()}_${Math.random().toString(36).slice(2)}@foodknock.com`,
        phone: "9990003333",
        password: "hashed-placeholder",
    });
}

/** Create a product priced so a single-unit order yields the given subtotal. */
async function makeItem(subtotal: number) {
    const p = await Product.create({
        name: "Test Dish",
        slug: `test-dish-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        description: "test",
        price: subtotal,
        category: "test",
        image: "x",
        stock: 1000,
        isAvailable: true,
    });
    return { _id: String(p._id), name: p.name, price: subtotal, quantity: 1, image: "" };
}

async function placeCod(subtotal: number) {
    const user = await makeUser();
    const item = await makeItem(subtotal);
    return createOrderCore({
        paymentMethod: "cod",
        customerName: "COD Tester",
        phone: "9990003333",
        address: "1 Test Rd",
        orderType: "delivery",
        items: [item],
        linkedUserId: String(user._id),
    });
}

before(async () => {
    await verifyIsolatedTestTarget();
});

beforeEach(async () => {
    await DeliverySettings.deleteMany({});
    await User.deleteMany({});
    await Order.deleteMany({});
    await Product.deleteMany({});
});

after(async () => {
    await dropTestDatabase();
    await closeTestConnection();
});

// ── Resolver fallback (MUST be the first settings read — cache-free) ───────
test("resolver: a legacy settings doc missing the field falls back to 549", async () => {
    // Raw insert a settings doc WITHOUT codMaxOrderAmount (simulating a doc
    // written before this field existed). getDeliverySettings reads lean
    // (no Mongoose defaults), so shape()'s verified fallback applies.
    await DeliverySettings.collection.insertOne({
        orderRules: { minimumOrderValue: 189 },
        createdAt: new Date(),
        updatedAt: new Date(),
    });
    const settings = await getDeliverySettings();
    assert.equal(settings.orderRules.codMaxOrderAmount, 549);
});

// ── Admin-write validation ─────────────────────────────────────────────────
test("validation: rejects negative, zero, empty-string, non-finite, non-integer, and absurd values", async () => {
    for (const bad of [-1, 0, "", "abc", NaN, Infinity, 12.5, 2_000_000]) {
        await assert.rejects(
            () => updateDeliverySettings({ orderRules: { codMaxOrderAmount: bad as unknown as number } }),
            `expected ${String(bad)} to be rejected`
        );
    }
});

test("validation: accepts a valid whole-rupee value and the next read reflects it (freshness)", async () => {
    await configure(300);
    const settings = await getDeliverySettings();
    assert.equal(settings.orderRules.codMaxOrderAmount, 300);
});

test("preservation: saving the COD cap does not reset other delivery settings", async () => {
    // Seed a known min order value + threshold, then change ONLY the COD cap.
    await updateDeliverySettings({
        orderRules: { minimumOrderValue: 199 },
        freeDelivery: { thresholdEnabled: true, thresholdAmount: 350, firstOrderFreeEnabled: true },
    });
    await updateDeliverySettings({ orderRules: { codMaxOrderAmount: 400 } });

    const s = await getDeliverySettings();
    assert.equal(s.orderRules.codMaxOrderAmount, 400);
    assert.equal(s.orderRules.minimumOrderValue, 199, "min order must be untouched");
    assert.equal(s.freeDelivery.thresholdAmount, 350, "free-delivery threshold must be untouched");
    assert.equal(s.freeDelivery.firstOrderFreeEnabled, true, "first-order free must be untouched");
});

// ── Authoritative server-side enforcement (createOrderCore) ────────────────
test("COD below the cap is accepted", async () => {
    await configure(300);
    const res = await placeCod(200); // gross 243 < 300
    assert.ok(res.orderId, "order should be created");
    assert.equal(await Order.countDocuments({}), 1);
});

test("COD exactly AT the cap is rejected (inclusive-exclusive: only strictly below)", async () => {
    await configure(300);
    await assert.rejects(() => placeCod(300 - FEES), /COD is only available for orders below ₹300/); // gross == 300
    assert.equal(await Order.countDocuments({}), 0, "no order on rejection");
});

test("COD above the cap is rejected", async () => {
    await configure(300);
    await assert.rejects(() => placeCod(320), /below ₹300/); // gross 363
    assert.equal(await Order.countDocuments({}), 0);
});

test("changing the MongoDB setting changes the NEXT COD decision (no redeploy)", async () => {
    await configure(300);
    const ok = await placeCod(200); // gross 243 < 300 → accepted
    assert.ok(ok.orderId);

    await configure(200); // lower the cap
    await assert.rejects(() => placeCod(200), /below ₹200/); // same order, gross 243 >= 200 → now rejected
});

test("online/Razorpay orders are NEVER blocked by the COD cap", async () => {
    await configure(300);
    const user = await makeUser();
    const item = await makeItem(320); // gross 363, far above the COD cap
    const res = await createOrderCore({
        paymentMethod: "razorpay",
        customerName: "Online Tester",
        phone: "9990004444",
        address: "1 Test Rd",
        orderType: "delivery",
        items: [item],
        linkedUserId: String(user._id),
        razorpayOrderId: "order_test_1",
        razorpayPaymentId: `pay_test_${Date.now()}`,
    });
    assert.ok(res.orderId, "online order above the COD cap must still be created");
});
