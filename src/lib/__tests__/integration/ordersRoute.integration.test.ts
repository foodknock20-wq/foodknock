// src/lib/__tests__/integration/ordersRoute.integration.test.ts
//
// Phase 17.4 — REAL integration test for the actual exported GET handler
// of src/app/api/orders/route.ts, against a verified isolated local
// MongoDB. Invokes the real route function (not a reimplementation),
// using real signToken()/requireAdmin() auth exactly like
// auth.integration.test.ts. Covers both the pre-existing admin-only
// authorization gate AND this phase's new `fields=minimal` projection
// (added to shrink OrderTable.tsx's 5-second admin polling payload).
//
// Run: MONGODB_URI="mongodb://127.0.0.1:27017/cafe_app" JWT_SECRET="test-only-secret-not-real" npx tsx --test src/lib/__tests__/integration/ordersRoute.integration.test.ts

import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import type { NextRequest } from "next/server";
import { verifyIsolatedTestTarget, dropTestDatabase, closeTestConnection } from "./testDb.ts";

import User from "../../../models/User.ts";
import Order from "../../../models/Order.ts";
import { signToken } from "../../auth.ts";
import { GET } from "../../../app/api/orders/route.ts";

before(async () => { await verifyIsolatedTestTarget(); });

beforeEach(async () => {
    await User.deleteMany({});
    await Order.deleteMany({});
});

after(async () => {
    await dropTestDatabase();
    await closeTestConnection();
});

function requestTo(url: string, token?: string): Request {
    return new Request(url, {
        headers: token ? { cookie: `token=${encodeURIComponent(token)}` } : {},
    });
}

async function makeAdmin() {
    return User.create({
        name: "Admin", email: `admin${Date.now()}${Math.random()}@example.test`,
        phone: "9999999999", password: "hashed", role: "admin", isActive: true,
    });
}

async function makeOrder(overrides: Partial<Record<string, unknown>> = {}) {
    return Order.create({
        orderId: `FK-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        customerName: "Alice", phone: "9999999999", address: "123 Street", landmark: "Near park",
        orderType: "delivery", items: [{ name: "Burger", quantity: 1, price: 200 }],
        totalAmount: 200, status: "received", paymentMethod: "cod",
        note: "extra spicy",
        ...overrides,
    });
}

test("real GET /api/orders: unauthenticated request is rejected", async () => {
    const res = await GET(requestTo("https://foodknock.test/api/orders") as unknown as NextRequest);
    assert.equal(res.status, 401);
});

test("real GET /api/orders: a non-admin user's token is rejected", async () => {
    const user = await User.create({
        name: "U", email: `u${Date.now()}@example.test`, phone: "9999999999",
        password: "x", role: "user", isActive: true,
    });
    const token = signToken({ userId: String(user._id), email: user.email, role: "user" });
    const res = await GET(requestTo("https://foodknock.test/api/orders", token) as unknown as NextRequest);
    assert.equal(res.status, 401);
});

test("real GET /api/orders: default projection returns the full admin field set", async () => {
    const admin = await makeAdmin();
    await makeOrder();
    const token = signToken({ userId: String(admin._id), email: admin.email, role: "admin" });

    const res = await GET(requestTo("https://foodknock.test/api/orders?limit=10", token) as unknown as NextRequest);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.orders.length, 1);
    const row = body.orders[0];
    // Full projection must still include fields the minimal mode omits.
    assert.ok("address" in row, "default projection must include address");
    assert.ok("items" in row, "default projection must include items");
    assert.ok("phone" in row, "default projection must include phone");
    assert.ok("customerName" in row);
    assert.ok("totalAmount" in row);
});

test("real GET /api/orders: fields=minimal returns only the fields OrderTable.tsx's poll() actually reads, never the full row", async () => {
    const admin = await makeAdmin();
    await makeOrder();
    const token = signToken({ userId: String(admin._id), email: admin.email, role: "admin" });

    const res = await GET(requestTo("https://foodknock.test/api/orders?limit=10&fields=minimal", token) as unknown as NextRequest);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.orders.length, 1);
    const row = body.orders[0];

    assert.ok("_id" in row, "minimal projection must still include _id (poll() keys on it)");
    assert.ok("customerName" in row);
    assert.ok("totalAmount" in row);
    assert.ok("createdAt" in row);

    assert.equal("address" in row, false, "minimal projection must NOT carry address");
    assert.equal("items" in row, false, "minimal projection must NOT carry items");
    assert.equal("phone" in row, false, "minimal projection must NOT carry phone");
    assert.equal("note" in row, false, "minimal projection must NOT carry note");
});

test("real GET /api/orders: fields=minimal and default modes return the same orders, same order, same count", async () => {
    const admin = await makeAdmin();
    await makeOrder({ customerName: "Bob", totalAmount: 500 });
    await makeOrder({ customerName: "Carol", totalAmount: 300 });
    const token = signToken({ userId: String(admin._id), email: admin.email, role: "admin" });

    const [fullRes, minimalRes] = await Promise.all([
        GET(requestTo("https://foodknock.test/api/orders?limit=10", token) as unknown as NextRequest),
        GET(requestTo("https://foodknock.test/api/orders?limit=10&fields=minimal", token) as unknown as NextRequest),
    ]);
    const full = await fullRes.json();
    const minimal = await minimalRes.json();

    assert.equal(full.orders.length, 2);
    assert.equal(minimal.orders.length, 2);
    assert.deepEqual(
        full.orders.map((o: { _id: string }) => o._id),
        minimal.orders.map((o: { _id: string }) => o._id),
        "both projections must return identical orders in identical (createdAt desc) order"
    );
});
