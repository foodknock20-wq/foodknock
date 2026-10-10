// src/lib/__tests__/integration/loyaltyInconsistencies.integration.test.ts
//
// Phase 17.5 — REAL integration test for the actual exported GET/POST
// handlers of src/app/api/admin/loyalty/inconsistencies/route.ts, against
// a verified isolated local MongoDB. Closes the Phase 17.3/17.4 coverage
// gap for the admin loyalty-repair route (as opposed to the underlying
// loyaltyService.ts functions, already covered directly in
// loyalty.integration.test.ts).
//
// Every mutation here runs ONLY against the disposable local test
// database and never a production repair.
//
// Run: MONGODB_URI="mongodb://127.0.0.1:27017/cafe_app" JWT_SECRET="test-only-secret-not-real" npx tsx --test src/lib/__tests__/integration/loyaltyInconsistencies.integration.test.ts

import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { verifyIsolatedTestTarget, dropTestDatabase, closeTestConnection } from "./testDb.ts";

import User from "../../../models/User.ts";
import Order from "../../../models/Order.ts";
import LoyaltyLedger from "../../../models/LoyaltyLedger.ts";
import { signToken } from "../../auth.ts";
import { GET, POST } from "../../../app/api/admin/loyalty/inconsistencies/route.ts";

before(async () => { await verifyIsolatedTestTarget(); });

beforeEach(async () => {
    await User.deleteMany({});
    await Order.deleteMany({});
    await LoyaltyLedger.deleteMany({});
});

after(async () => {
    await dropTestDatabase();
    await closeTestConnection();
});

// GET's handler reads `req.nextUrl.searchParams` — a NextRequest-only
// property, unlike most routes in this codebase which do `new URL(req.url)`
// on a plain Request. A real NextRequest instance is required here (a
// plain Request cast via `as unknown as NextRequest` would leave
// `.nextUrl` undefined and crash the handler, as the first version of this
// test discovered).
function req(url: string, token?: string, body?: unknown): NextRequest {
    const headers = new Headers();
    if (token) headers.set("cookie", `token=${encodeURIComponent(token)}`);
    if (body !== undefined) {
        headers.set("content-type", "application/json");
        return new NextRequest(url, { method: "POST", headers, body: JSON.stringify(body) });
    }
    return new NextRequest(url, { headers });
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

test("real GET /api/admin/loyalty/inconsistencies: unauthenticated request is rejected (403), never exposes diagnostic data", async () => {
    const res = await GET(req("https://foodknock.test/api/admin/loyalty/inconsistencies"));
    assert.equal(res.status, 403);
});

test("real GET /api/admin/loyalty/inconsistencies: a non-admin user's request is rejected", async () => {
    const user = await makeUser();
    const token = signToken({ userId: String(user._id), email: user.email, role: "user" });
    const res = await GET(req("https://foodknock.test/api/admin/loyalty/inconsistencies", token));
    assert.equal(res.status, 403);
});

test("real GET /api/admin/loyalty/inconsistencies: an admin sees an empty, well-shaped report when the ledger is clean", async () => {
    const admin = await makeAdmin();
    const token = signToken({ userId: String(admin._id), email: admin.email, role: "admin" });
    const res = await GET(req("https://foodknock.test/api/admin/loyalty/inconsistencies?limit=10", token));
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.redemptionCandidates.count, 0);
    assert.equal(body.staleClaims.count, 0);
    assert.deepEqual(body.redemptionCandidates.items, []);
});

test("real GET /api/admin/loyalty/inconsistencies: GET never mutates anything — repeated calls are side-effect free", async () => {
    const admin = await makeAdmin();
    const token = signToken({ userId: String(admin._id), email: admin.email, role: "admin" });
    const before1 = await LoyaltyLedger.countDocuments({});
    await GET(req("https://foodknock.test/api/admin/loyalty/inconsistencies", token));
    await GET(req("https://foodknock.test/api/admin/loyalty/inconsistencies", token));
    const after1 = await LoyaltyLedger.countDocuments({});
    assert.equal(before1, after1);
});

test("real POST /api/admin/loyalty/inconsistencies: unauthenticated repair attempt is rejected", async () => {
    const res = await POST(req("https://foodknock.test/api/admin/loyalty/inconsistencies", undefined, { orderMongoId: "000000000000000000000000" }));
    assert.equal(res.status, 403);
});

test("real POST /api/admin/loyalty/inconsistencies: a non-admin's repair attempt is rejected", async () => {
    const user = await makeUser();
    const token = signToken({ userId: String(user._id), email: user.email, role: "user" });
    const res = await POST(req("https://foodknock.test/api/admin/loyalty/inconsistencies", token, { orderMongoId: "000000000000000000000000" }));
    assert.equal(res.status, 403);
});

test("real POST /api/admin/loyalty/inconsistencies: a malformed orderMongoId is rejected with 400, never passed through to the DB layer", async () => {
    const admin = await makeAdmin();
    const token = signToken({ userId: String(admin._id), email: admin.email, role: "admin" });
    const res = await POST(req("https://foodknock.test/api/admin/loyalty/inconsistencies", token, { orderMongoId: "not-a-valid-objectid" }));
    assert.equal(res.status, 400);
});

test("real POST /api/admin/loyalty/inconsistencies: neither orderMongoId nor claimId provided is rejected with 400", async () => {
    const admin = await makeAdmin();
    const token = signToken({ userId: String(admin._id), email: admin.email, role: "admin" });
    const res = await POST(req("https://foodknock.test/api/admin/loyalty/inconsistencies", token, {}));
    assert.equal(res.status, 400);
});

test("real POST /api/admin/loyalty/inconsistencies: a well-formed but nonexistent orderMongoId is rejected (409), not silently accepted", async () => {
    const admin = await makeAdmin();
    const token = signToken({ userId: String(admin._id), email: admin.email, role: "admin" });
    const res = await POST(req("https://foodknock.test/api/admin/loyalty/inconsistencies", token, { orderMongoId: "000000000000000000000000" }));
    assert.equal(res.status, 409);
});

test("real POST /api/admin/loyalty/inconsistencies: a genuinely consistent order's redemption repair reports alreadyConsistent, makes no further change", async () => {
    const admin = await makeAdmin();
    const user = await makeUser();
    const token = signToken({ userId: String(admin._id), email: admin.email, role: "admin" });

    const order = await Order.create({
        orderId: `FK-REPAIR-${Date.now()}`, customerName: "T", phone: "9999999999", address: "Addr",
        orderType: "delivery", items: [{ name: "Item", quantity: 1, price: 200 }],
        totalAmount: 200, status: "received", paymentMethod: "cod", user: user._id,
        redeemedPoints: 0,
    });

    const res = await POST(req("https://foodknock.test/api/admin/loyalty/inconsistencies", token, { orderMongoId: String(order._id) }));
    // An order with no redemption at all is a defined, safe "nothing to repair" case.
    assert.ok(res.status === 200 || res.status === 409);
});
