// src/lib/__tests__/integration/myOrderDetail.integration.test.ts
//
// Phase 17.7 — REAL integration test for the actual exported GET handler
// of src/app/api/orders/my/[orderId]/route.ts, against a verified isolated
// local MongoDB. This route is now the PRIMARY full-detail "track my
// order" path (see src/app/api/orders/track/[orderId]/route.ts's header
// comment for the Phase 17.7 redesign that moved full PII exposure here,
// behind authentication + ownership, and out of the public endpoint) —
// yet had no dedicated route-level test before this phase. Closes that gap.
//
// Run: MONGODB_URI="mongodb://127.0.0.1:27017/cafe_app" JWT_SECRET="test-only-secret-not-real" npx tsx --test src/lib/__tests__/integration/myOrderDetail.integration.test.ts

import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import type { NextRequest } from "next/server";
import { verifyIsolatedTestTarget, dropTestDatabase, closeTestConnection } from "./testDb.ts";

import User from "../../../models/User.ts";
import Order from "../../../models/Order.ts";
import { signToken } from "../../auth.ts";
import { GET } from "../../../app/api/orders/my/[orderId]/route.ts";

before(async () => { await verifyIsolatedTestTarget(); });

beforeEach(async () => {
    await User.deleteMany({});
    await Order.deleteMany({});
});

after(async () => {
    await dropTestDatabase();
    await closeTestConnection();
});

function req(token?: string): Request {
    const headers = new Headers();
    if (token) headers.set("cookie", `token=${encodeURIComponent(token)}`);
    return new Request("https://foodknock.test/api/orders/my/x", { headers });
}

async function makeUser(role: "user" | "admin" = "user") {
    return User.create({
        name: "T", email: `t${Date.now()}${Math.random()}@example.test`,
        phone: "9999999999", password: "hashed", role, isActive: true,
    });
}

test("real GET /api/orders/my/[orderId]: unauthenticated request is rejected (401)", async () => {
    const owner = await makeUser();
    const order = await Order.create({
        orderId: `FK-MY-${Date.now()}`, customerName: "Owner", phone: "9999999999", address: "Addr",
        orderType: "delivery", items: [{ name: "Item", quantity: 1, price: 200 }],
        totalAmount: 200, status: "received", paymentMethod: "cod", user: owner._id,
    });
    const res = await GET(req() as unknown as NextRequest, { params: Promise.resolve({ orderId: order.orderId }) });
    assert.equal(res.status, 401);
});

test("real GET /api/orders/my/[orderId]: the real owner gets the full detail, including customerName/address/landmark", async () => {
    const owner = await makeUser();
    const token = signToken({ userId: String(owner._id), email: owner.email, role: "user" });
    const order = await Order.create({
        orderId: `FK-MY-${Date.now()}`, customerName: "Real Owner Name", phone: "9999999999",
        address: "Real Owner Address", landmark: "Near the gate",
        orderType: "delivery", items: [{ name: "Item", quantity: 1, price: 200 }],
        totalAmount: 200, status: "received", paymentMethod: "cod", user: owner._id,
    });

    const res = await GET(req(token) as unknown as NextRequest, { params: Promise.resolve({ orderId: order.orderId }) });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.order.customerName, "Real Owner Name");
    assert.equal(body.order.address, "Real Owner Address");
    assert.equal(body.order.landmark, "Near the gate");
    assert.equal("user" in body.order, false, "the raw user ObjectId must be stripped from the response");
});

test("real GET /api/orders/my/[orderId]: a DIFFERENT customer (not the owner) is rejected with 404, not 403 (never confirms the order exists)", async () => {
    const owner = await makeUser();
    const stranger = await makeUser();
    const strangerToken = signToken({ userId: String(stranger._id), email: stranger.email, role: "user" });
    const order = await Order.create({
        orderId: `FK-MY-${Date.now()}`, customerName: "Owner", phone: "9999999999", address: "Addr",
        orderType: "delivery", items: [{ name: "Item", quantity: 1, price: 200 }],
        totalAmount: 200, status: "received", paymentMethod: "cod", user: owner._id,
    });

    const res = await GET(req(strangerToken) as unknown as NextRequest, { params: Promise.resolve({ orderId: order.orderId }) });
    assert.equal(res.status, 404, "a non-owner must get the same 404 as a genuinely nonexistent order — never a 403 that confirms existence");
});

test("real GET /api/orders/my/[orderId]: an admin can view any customer's order detail", async () => {
    const owner = await makeUser();
    const admin = await makeUser("admin");
    const adminToken = signToken({ userId: String(admin._id), email: admin.email, role: "admin" });
    const order = await Order.create({
        orderId: `FK-MY-${Date.now()}`, customerName: "Owner", phone: "9999999999", address: "Addr",
        orderType: "delivery", items: [{ name: "Item", quantity: 1, price: 200 }],
        totalAmount: 200, status: "received", paymentMethod: "cod", user: owner._id,
    });

    const res = await GET(req(adminToken) as unknown as NextRequest, { params: Promise.resolve({ orderId: order.orderId }) });
    assert.equal(res.status, 200);
});

test("real GET /api/orders/my/[orderId]: a nonexistent orderId returns 404", async () => {
    const owner = await makeUser();
    const token = signToken({ userId: String(owner._id), email: owner.email, role: "user" });
    const res = await GET(req(token) as unknown as NextRequest, { params: Promise.resolve({ orderId: "FK-DOES-NOT-EXIST" }) });
    assert.equal(res.status, 404);
});
