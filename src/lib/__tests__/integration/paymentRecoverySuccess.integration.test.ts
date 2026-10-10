// src/lib/__tests__/integration/paymentRecoverySuccess.integration.test.ts
//
// Phase 17.7 — closes the one explicitly-named remaining gap from the
// Phase 17.5 report: attemptRecovery()'s actual Razorpay-re-verification
// SUCCESS path (the branch that creates a real order) was never exercised
// because it calls the live Razorpay API — see
// paymentReconciliationAdmin.integration.test.ts's header comment for why
// that suite stopped at the not_found/already_terminal branches only.
//
// This suite uses Node's built-in, experimental module-mocking API
// (node:test's `mock.module`) to intercept the `razorpay` package's
// default export BEFORE src/lib/paymentReconciliation.ts imports it —
// never a production code change, never a real network call to Razorpay.
// Requires Node's --experimental-test-module-mocks flag.
//
// Run: MONGODB_URI="mongodb://127.0.0.1:27017/cafe_app" JWT_SECRET="test-only-secret-not-real" RAZORPAY_KEY_ID="test" RAZORPAY_KEY_SECRET="test" npx tsx --test --experimental-test-module-mocks src/lib/__tests__/integration/paymentRecoverySuccess.integration.test.ts

import { test, mock, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";

// Must be registered BEFORE anything imports "razorpay" (including
// transitively, via paymentReconciliation.ts) — hence every subsequent
// import below is a dynamic `await import()` inside each test/hook, not a
// static top-level import, since static imports are hoisted above any
// runtime statement in the same module.
let capturedPaymentResponse: { items: Array<{ id: string; status: string; amount: string; currency: string }> } = { items: [] };
mock.module("razorpay", {
    defaultExport: class FakeRazorpay {
        orders = {
            fetchPayments: async () => capturedPaymentResponse,
        };
    },
});

before(async () => {
    const { verifyIsolatedTestTarget } = await import("./testDb.ts");
    await verifyIsolatedTestTarget();
});

beforeEach(async () => {
    const User = (await import("../../../models/User.ts")).default;
    const Order = (await import("../../../models/Order.ts")).default;
    const Product = (await import("../../../models/Product.ts")).default;
    const PendingPayment = (await import("../../../models/PendingPayment.ts")).default;
    await User.deleteMany({});
    await Order.deleteMany({});
    await Product.deleteMany({});
    await PendingPayment.deleteMany({});
    capturedPaymentResponse = { items: [] };
});

after(async () => {
    const { dropTestDatabase, closeTestConnection } = await import("./testDb.ts");
    await dropTestDatabase();
    await closeTestConnection();
});

test("real attemptRecovery(): a genuinely captured-but-orphaned payment, re-verified via the (mocked) Razorpay boundary, creates the real order exactly once", async () => {
    const User = (await import("../../../models/User.ts")).default;
    const Product = (await import("../../../models/Product.ts")).default;
    const PendingPayment = (await import("../../../models/PendingPayment.ts")).default;
    const Order = (await import("../../../models/Order.ts")).default;
    const { attemptRecovery } = await import("../../paymentReconciliation.ts");

    const user = await User.create({
        name: "T", email: `t${Date.now()}@example.test`, phone: "9999999999",
        password: "x", role: "user", isActive: true,
    });
    const product = await Product.create({
        name: "Burger", slug: `burger-${Date.now()}`, price: 200, stock: 5,
        isAvailable: true, image: "x.jpg", category: "food", description: "d",
    });
    const admin = await User.create({
        name: "Admin", email: `admin${Date.now()}@example.test`, phone: "9999999999",
        password: "x", role: "admin", isActive: true,
    });

    const razorpayOrderId = `order_${Date.now()}`;
    const pending = await PendingPayment.create({
        razorpayOrderId,
        status: "failed",
        expectedAmount: 200,
        payload: {
            customerName: "T", phone: "9999999999", address: "Addr",
            orderType: "pickup", linkedUserId: String(user._id),
            items: [{ _id: String(product._id), name: "Burger", price: 200, quantity: 1 }],
        },
    });

    // The mocked Razorpay boundary: a real captured payment, matching
    // amount/currency, no existing order yet.
    capturedPaymentResponse = { items: [{ id: `pay_${Date.now()}`, status: "captured", amount: "20000", currency: "INR" }] };

    const outcome = await attemptRecovery(String(pending._id), String(admin._id));

    assert.equal(outcome.ok, true, outcome.ok ? "" : JSON.stringify(outcome));
    if (outcome.ok) {
        assert.ok(outcome.orderId);
        const order = await Order.findOne({ orderId: outcome.orderId }).lean();
        assert.ok(order, "the real order must actually exist in the database, not just be claimed in the response");
        assert.equal(order?.paymentMethod, "razorpay");
    }

    const freshPending = await PendingPayment.findById(pending._id).lean();
    assert.equal(freshPending?.status, "completed");
    assert.equal(freshPending?.reconciliationState, "recovered");

    const freshProduct = await Product.findById(product._id).lean();
    assert.equal(freshProduct?.stock, 4, "stock must be decremented exactly once by the recovered order");
});

test("real attemptRecovery(): an amount mismatch between the mocked Razorpay capture and the expected amount is blocked, never creates an order", async () => {
    const User = (await import("../../../models/User.ts")).default;
    const Product = (await import("../../../models/Product.ts")).default;
    const PendingPayment = (await import("../../../models/PendingPayment.ts")).default;
    const Order = (await import("../../../models/Order.ts")).default;
    const { attemptRecovery } = await import("../../paymentReconciliation.ts");

    const user = await User.create({
        name: "T2", email: `t2${Date.now()}@example.test`, phone: "9999999999",
        password: "x", role: "user", isActive: true,
    });
    const product = await Product.create({
        name: "Pizza", slug: `pizza-${Date.now()}`, price: 300, stock: 5,
        isAvailable: true, image: "x.jpg", category: "food", description: "d",
    });
    const admin = await User.create({
        name: "Admin2", email: `admin2${Date.now()}@example.test`, phone: "9999999999",
        password: "x", role: "admin", isActive: true,
    });

    const razorpayOrderId = `order_${Date.now()}_mismatch`;
    const pending = await PendingPayment.create({
        razorpayOrderId,
        status: "failed",
        expectedAmount: 300,
        payload: {
            customerName: "T2", phone: "9999999999", address: "Addr",
            orderType: "pickup", linkedUserId: String(user._id),
            items: [{ _id: String(product._id), name: "Pizza", price: 300, quantity: 1 }],
        },
    });

    // Razorpay reports a DIFFERENT captured amount than expected — a real
    // discrepancy that must block automatic recovery.
    capturedPaymentResponse = { items: [{ id: `pay_${Date.now()}`, status: "captured", amount: "15000", currency: "INR" }] };

    const outcome = await attemptRecovery(String(pending._id), String(admin._id));
    assert.equal(outcome.ok, false);
    if (!outcome.ok) assert.equal(outcome.reason, "amount_mismatch");

    const order = await Order.findOne({ razorpayOrderId }).lean();
    assert.equal(order, null, "no order must ever be created on an amount mismatch");

    const freshProduct = await Product.findById(product._id).lean();
    assert.equal(freshProduct?.stock, 5, "stock must be completely untouched when recovery is blocked");
});

test("real attemptRecovery(): a currency mismatch (mocked, non-INR) is still blocked after the captured_no_order fix — regression guard", async () => {
    const User = (await import("../../../models/User.ts")).default;
    const PendingPayment = (await import("../../../models/PendingPayment.ts")).default;
    const Order = (await import("../../../models/Order.ts")).default;
    const { attemptRecovery } = await import("../../paymentReconciliation.ts");

    const admin = await User.create({
        name: "Admin4", email: `admin4${Date.now()}@example.test`, phone: "9999999999",
        password: "x", role: "admin", isActive: true,
    });
    const razorpayOrderId = `order_${Date.now()}_curmismatch`;
    const pending = await PendingPayment.create({
        razorpayOrderId, status: "failed", expectedAmount: 200,
        payload: { customerName: "T4", phone: "9999999999", address: "Addr", orderType: "pickup", items: [{ _id: "x", name: "Item", price: 200, quantity: 1 }] },
    });

    capturedPaymentResponse = { items: [{ id: `pay_${Date.now()}`, status: "captured", amount: "20000", currency: "USD" }] };

    const outcome = await attemptRecovery(String(pending._id), String(admin._id));
    assert.equal(outcome.ok, false);
    if (!outcome.ok) assert.equal(outcome.reason, "currency_mismatch");
    const order = await Order.findOne({ razorpayOrderId }).lean();
    assert.equal(order, null, "no order must be created on a genuine currency mismatch");
});

test("real attemptRecovery(): when an order for this payment ALREADY exists (self-heal case), it reports alreadyResolved and never creates a second order", async () => {
    const User = (await import("../../../models/User.ts")).default;
    const PendingPayment = (await import("../../../models/PendingPayment.ts")).default;
    const Order = (await import("../../../models/Order.ts")).default;
    const { attemptRecovery } = await import("../../paymentReconciliation.ts");

    const admin = await User.create({
        name: "Admin5", email: `admin5${Date.now()}@example.test`, phone: "9999999999",
        password: "x", role: "admin", isActive: true,
    });
    const razorpayOrderId = `order_${Date.now()}_selfheal`;
    const razorpayPaymentId = `pay_${Date.now()}_selfheal`;

    const existingOrder = await Order.create({
        orderId: `FK-SELFHEAL-${Date.now()}`, customerName: "T5", phone: "9999999999", address: "Addr",
        orderType: "pickup", items: [{ name: "Item", quantity: 1, price: 200 }],
        totalAmount: 200, status: "received", paymentMethod: "razorpay", razorpayOrderId, razorpayPaymentId,
    });

    const pending = await PendingPayment.create({
        razorpayOrderId, status: "failed", expectedAmount: 200,
        payload: { customerName: "T5", phone: "9999999999", address: "Addr", orderType: "pickup", items: [{ _id: "x", name: "Item", price: 200, quantity: 1 }] },
    });

    capturedPaymentResponse = { items: [{ id: razorpayPaymentId, status: "captured", amount: "20000", currency: "INR" }] };

    const outcome = await attemptRecovery(String(pending._id), String(admin._id));
    assert.equal(outcome.ok, true);
    if (outcome.ok) {
        assert.equal(outcome.alreadyResolved, true);
        assert.equal(outcome.orderId, existingOrder.orderId);
    }
    const orderCount = await Order.countDocuments({ razorpayOrderId });
    assert.equal(orderCount, 1, "self-heal must never create a second order for an order that already exists");
});

test("real attemptRecovery(): Razorpay reporting NO captured payment (mocked) is treated as not_captured, never fabricates success", async () => {
    const PendingPayment = (await import("../../../models/PendingPayment.ts")).default;
    const User = (await import("../../../models/User.ts")).default;
    const { attemptRecovery } = await import("../../paymentReconciliation.ts");

    const admin = await User.create({
        name: "Admin3", email: `admin3${Date.now()}@example.test`, phone: "9999999999",
        password: "x", role: "admin", isActive: true,
    });
    const pending = await PendingPayment.create({
        razorpayOrderId: `order_${Date.now()}_nocap`,
        status: "failed",
        expectedAmount: 100,
        payload: { customerName: "T3", phone: "9999999999", address: "Addr", orderType: "pickup", items: [{ _id: "x", name: "Item", price: 100, quantity: 1 }] },
    });

    capturedPaymentResponse = { items: [] }; // nothing captured

    const outcome = await attemptRecovery(String(pending._id), String(admin._id));
    assert.equal(outcome.ok, false);
    if (!outcome.ok) assert.equal(outcome.reason, "not_captured");
});
