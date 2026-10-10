// src/lib/__tests__/integration/trackOrder.integration.test.ts
//
// Phase 17.5 — REAL integration test for the actual exported GET handler
// of src/app/api/orders/track/[orderId]/route.ts, against a verified
// isolated local MongoDB. Closes the Phase 17.3/17.4 coverage gap for
// guest order tracking + phone masking (Phase 17.2 F11).
//
// Phase 17.7 — updated. This endpoint no longer returns customerName/
// address/landmark at all (see that route's header comment for the full
// redesign: guest checkout no longer exists, so every legitimate "track my
// order" need is served by the ownership-checked /api/orders/my/[orderId]
// route instead). The tests below now VERIFY that fix rather than merely
// documenting the risk it replaces.
//
// Run: MONGODB_URI="mongodb://127.0.0.1:27017/cafe_app" npx tsx --test src/lib/__tests__/integration/trackOrder.integration.test.ts

import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import type { NextRequest } from "next/server";
import { verifyIsolatedTestTarget, dropTestDatabase, closeTestConnection } from "./testDb.ts";

import Order from "../../../models/Order.ts";
import RateLimitHit from "../../../models/RateLimitHit.ts";
import { GET } from "../../../app/api/orders/track/[orderId]/route.ts";

before(async () => { await verifyIsolatedTestTarget(); });

beforeEach(async () => {
    await Order.deleteMany({});
    await RateLimitHit.deleteMany({});
});

after(async () => {
    await dropTestDatabase();
    await closeTestConnection();
});

function req(ip: string): Request {
    return new Request("https://foodknock.test/api/orders/track/x", {
        headers: { "x-forwarded-for": ip },
    });
}

async function makeOrder(overrides: Partial<Record<string, unknown>> = {}) {
    return Order.create({
        orderId: `FK-TRACK-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        customerName: "Alice Guest", phone: "9876543210", address: "42 Real Street, Danta", landmark: "Near park",
        orderType: "delivery", items: [{ name: "Burger", quantity: 1, price: 200 }],
        totalAmount: 200, status: "received", paymentMethod: "cod",
        ...overrides,
    });
}

test("real GET /track/[orderId]: a valid orderId returns the order with the phone MASKED to its last 4 digits", async () => {
    const order = await makeOrder();
    const res = await GET(req("10.0.0.1") as unknown as NextRequest, { params: Promise.resolve({ orderId: order.orderId }) });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.order.phone, "••••••3210", "phone must be masked to last 4 digits (Phase 17.2 F11)");
    assert.notEqual(body.order.phone, "9876543210");
});

test("real GET /track/[orderId]: a nonexistent orderId returns 404, never leaks whether a DIFFERENT ID pattern exists", async () => {
    const res = await GET(req("10.0.0.2") as unknown as NextRequest, { params: Promise.resolve({ orderId: "FK-DOES-NOT-EXIST" }) });
    assert.equal(res.status, 404);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.equal(body.order, undefined);
});

test("real GET /track/[orderId]: missing/empty orderId is rejected with 400, not a lookup", async () => {
    const res = await GET(req("10.0.0.3") as unknown as NextRequest, { params: Promise.resolve({ orderId: "" }) });
    assert.equal(res.status, 400);
});

test("real GET /track/[orderId]: the 21st lookup from the same IP within the window is rate-limited (brute-force mitigation)", async () => {
    const order = await makeOrder();
    for (let i = 0; i < 20; i++) {
        const res = await GET(req("10.0.0.4") as unknown as NextRequest, { params: Promise.resolve({ orderId: order.orderId }) });
        assert.equal(res.status, 200, `lookup #${i + 1} should still be within the 20/10min limit`);
    }
    const res21 = await GET(req("10.0.0.4") as unknown as NextRequest, { params: Promise.resolve({ orderId: order.orderId }) });
    assert.equal(res21.status, 429, "the 21st lookup within the 10-minute window from the same IP must be rate-limited");
});

test("real GET /track/[orderId]: rate limiting is scoped per-IP, not global — a different IP is unaffected", async () => {
    const order = await makeOrder();
    for (let i = 0; i < 20; i++) {
        await GET(req("10.0.0.5") as unknown as NextRequest, { params: Promise.resolve({ orderId: order.orderId }) });
    }
    const otherIp = await GET(req("10.0.0.6") as unknown as NextRequest, { params: Promise.resolve({ orderId: order.orderId }) });
    assert.equal(otherIp.status, 200, "a different IP must not be blocked by another IP's exhausted rate limit");
});

// ── Phase 17.7 fix verification: name/address/landmark are GONE ──────────
test("real GET /track/[orderId]: a known/guessed valid orderId NEVER discloses customerName, address, or landmark", async () => {
    const order = await makeOrder({ customerName: "Real Customer Name", address: "Real Full Address, House 7", landmark: "Behind the mosque" });
    const res = await GET(req("10.0.0.7") as unknown as NextRequest, { params: Promise.resolve({ orderId: order.orderId }) });
    const body = await res.json();
    assert.equal("customerName" in body.order, false, "customerName must never be present in the public tracking response");
    assert.equal("address" in body.order, false, "address must never be present in the public tracking response");
    assert.equal("landmark" in body.order, false, "landmark must never be present in the public tracking response");
});

test("real GET /track/[orderId]: still returns everything a genuine status check needs — items, total, status, type, timestamps", async () => {
    const order = await makeOrder();
    const res = await GET(req("10.0.0.8") as unknown as NextRequest, { params: Promise.resolve({ orderId: order.orderId }) });
    const body = await res.json();
    assert.equal(body.order.orderId, order.orderId);
    assert.equal(body.order.status, "received");
    assert.equal(body.order.orderType, "delivery");
    assert.equal(body.order.totalAmount, 200);
    assert.deepEqual(body.order.items.map((i: { name: string }) => i.name), ["Burger"]);
    assert.ok(body.order.createdAt);
});
