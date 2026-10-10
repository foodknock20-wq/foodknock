// src/lib/__tests__/integration/auth.integration.test.ts
//
// Phase 17.3 — REAL integration tests for src/lib/apiAuth.ts's
// requireAdmin()/requireUser(), against a verified isolated local
// MongoDB. Uses real signToken()/verifyToken() (src/lib/auth.ts) to
// construct genuine JWTs and real Web API Request objects with a real
// cookie header — not a mocked auth layer. This directly validates the
// Phase 17.2 (F4) fix: a demoted/deactivated admin's still-valid JWT must
// be rejected because requireAdmin() re-checks the LIVE User document,
// not just the token's claims.
//
// JWT_SECRET is set to an arbitrary test-only value below — it is never
// read from .env.local and carries no relationship to any real secret.
//
// Run: MONGODB_URI="mongodb://127.0.0.1:27017/cafe_app" JWT_SECRET="test-only-secret-not-real" npx tsx --test src/lib/__tests__/integration/auth.integration.test.ts

import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { verifyIsolatedTestTarget, dropTestDatabase, closeTestConnection } from "./testDb.ts";

import User from "../../../models/User.ts";
import Order from "../../../models/Order.ts";
import { signToken } from "../../auth.ts";
import { requireAdmin, requireUser } from "../../apiAuth.ts";

before(async () => { await verifyIsolatedTestTarget(); });

beforeEach(async () => {
    await User.deleteMany({});
    await Order.deleteMany({});
});

after(async () => {
    await dropTestDatabase();
    await closeTestConnection();
});

function requestWithToken(token: string): Request {
    return new Request("https://foodknock.test/api/test", {
        headers: { cookie: `token=${encodeURIComponent(token)}` },
    });
}

async function makeUser(role: "user" | "admin", isActive = true) {
    return User.create({
        name: "Test", email: `t${Date.now()}${Math.random()}@example.test`,
        phone: "9999999999", password: "hashed", role, isActive,
    });
}

// ── requireAdmin(): the actual Phase 17.2 (F4) guarantee ────────────────────

test("real requireAdmin(): a genuine active admin is accepted", async () => {
    const admin = await makeUser("admin", true);
    const token = signToken({ userId: String(admin._id), email: admin.email, role: "admin" });

    const result = await requireAdmin(requestWithToken(token));
    assert.ok(result);
    assert.equal(result?.role, "admin");
});

test("real requireAdmin(): a regular user's token is rejected, even with no tampering", async () => {
    const user = await makeUser("user", true);
    const token = signToken({ userId: String(user._id), email: user.email, role: "user" });

    const result = await requireAdmin(requestWithToken(token));
    assert.equal(result, null);
});

test("real requireAdmin(): a DEMOTED admin's still-valid JWT is rejected — THE core F4 guarantee", async () => {
    const admin = await makeUser("admin", true);
    // Token signed while they were still admin — exactly the stale-JWT
    // scenario F4 was about. 7-day expiry means this token is still
    // cryptographically valid.
    const token = signToken({ userId: String(admin._id), email: admin.email, role: "admin" });

    // Admin is demoted in the DB AFTER the token was issued.
    await User.updateOne({ _id: admin._id }, { $set: { role: "user" } });

    const result = await requireAdmin(requestWithToken(token));
    assert.equal(result, null, "requireAdmin() must re-check the LIVE role, not trust the token's role claim");
});

test("real requireAdmin(): a DEACTIVATED admin's still-valid JWT is rejected", async () => {
    const admin = await makeUser("admin", true);
    const token = signToken({ userId: String(admin._id), email: admin.email, role: "admin" });

    await User.updateOne({ _id: admin._id }, { $set: { isActive: false } });

    const result = await requireAdmin(requestWithToken(token));
    assert.equal(result, null, "requireAdmin() must re-check isActive live, not just decode the token");
});

test("real requireAdmin(): a forged role claim in a tampered token is rejected (signature verification works)", async () => {
    const user = await makeUser("user", true);
    const token = signToken({ userId: String(user._id), email: user.email, role: "user" });
    // Tamper with the payload portion of the JWT without re-signing it.
    const parts = token.split(".");
    const forgedPayload = Buffer.from(JSON.stringify({ userId: String(user._id), email: user.email, role: "admin" })).toString("base64url");
    const forgedToken = `${parts[0]}.${forgedPayload}.${parts[2]}`;

    const result = await requireAdmin(requestWithToken(forgedToken));
    assert.equal(result, null, "a token with a tampered payload must fail signature verification");
});

test("real requireAdmin(): no token at all is rejected", async () => {
    const result = await requireAdmin(new Request("https://foodknock.test/api/test"));
    assert.equal(result, null);
});

// ── requireUser(): same live-identity guarantee for ordinary customers ─────

test("real requireUser(): an active user is accepted and returns their real role", async () => {
    const user = await makeUser("user", true);
    const token = signToken({ userId: String(user._id), email: user.email, role: "user" });
    const result = await requireUser(requestWithToken(token));
    assert.ok(result);
    assert.equal(result?.role, "user");
});

test("real requireUser(): a deactivated user's valid token is rejected", async () => {
    const user = await makeUser("user", true);
    const token = signToken({ userId: String(user._id), email: user.email, role: "user" });
    await User.updateOne({ _id: user._id }, { $set: { isActive: false } });

    const result = await requireUser(requestWithToken(token));
    assert.equal(result, null);
});

// ── Order ownership (IDOR check) — the actual data pattern used in the real routes ──

test("real ownership check: Customer A's identity does not match Customer B's order (the exact comparison orders/[id] and loyalty route use)", async () => {
    const customerA = await makeUser("user", true);
    const customerB = await makeUser("user", true);
    const order = await Order.create({
        orderId: "FK-OWNERSHIP-TEST", customerName: "B", phone: "9999999999", address: "Addr",
        orderType: "delivery", items: [{ name: "Item", quantity: 1, price: 500 }],
        totalAmount: 500, status: "received", paymentMethod: "cod", user: customerB._id,
    });

    const tokenA = signToken({ userId: String(customerA._id), email: customerA.email, role: "user" });
    const authA = await requireUser(requestWithToken(tokenA));
    assert.ok(authA);

    // This is the exact real comparison every ownership-gated route in
    // this codebase performs (orders/[id], /api/loyalty, etc.):
    const isOwner = order.user && String(order.user) === authA!.userId;
    assert.equal(isOwner, false, "Customer A must never be recognized as the owner of Customer B's order");

    // And the real owner IS recognized correctly:
    const tokenB = signToken({ userId: String(customerB._id), email: customerB.email, role: "user" });
    const authB = await requireUser(requestWithToken(tokenB));
    const isOwnerB = order.user && String(order.user) === authB!.userId;
    assert.equal(isOwnerB, true);
});
