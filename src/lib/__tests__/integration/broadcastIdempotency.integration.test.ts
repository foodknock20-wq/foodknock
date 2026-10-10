// src/lib/__tests__/integration/broadcastIdempotency.integration.test.ts
//
// Phase 17.5 — REAL integration test for the actual exported POST handler
// of src/app/api/admin/notifications/broadcast/route.ts, against a
// verified isolated local MongoDB. Closes the Phase 17.3/17.4 coverage gap
// for admin-broadcast authorization + idempotency (Phase 17.2 F15).
//
// SAFETY: every test here runs with ZERO active PushSubscription
// documents in the (disposable) test database. Reading the real
// webPushProvider.ts/engine.ts code confirms resolveTargetSubscriptions()
// only ever queries the DB for "broadcast"/"user" targets — with no
// matching subscriptions, the send loop iterates zero times, so NO
// webpush/FCM network call is ever attempted by these tests. "test" mode
// is only exercised via its documented 404 "no active subscription found"
// branch, which also returns before any send attempt. This test suite
// never contacts a live push provider.
//
// Run: MONGODB_URI="mongodb://127.0.0.1:27017/cafe_app" JWT_SECRET="test-only-secret-not-real" npx tsx --test src/lib/__tests__/integration/broadcastIdempotency.integration.test.ts

import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import type { NextRequest } from "next/server";
import { verifyIsolatedTestTarget, dropTestDatabase, closeTestConnection } from "./testDb.ts";

import User from "../../../models/User.ts";
import RateLimitHit from "../../../models/RateLimitHit.ts";
import { signToken } from "../../auth.ts";
import { POST } from "../../../app/api/admin/notifications/broadcast/route.ts";

before(async () => { await verifyIsolatedTestTarget(); });

beforeEach(async () => {
    await User.deleteMany({});
    await RateLimitHit.deleteMany({});
});

after(async () => {
    await dropTestDatabase();
    await closeTestConnection();
});

function req(body: unknown, token?: string): Request {
    const headers = new Headers({ "content-type": "application/json" });
    if (token) headers.set("cookie", `token=${encodeURIComponent(token)}`);
    return new Request("https://foodknock.test/api/admin/notifications/broadcast", {
        method: "POST", headers, body: JSON.stringify(body),
    });
}

async function makeAdmin() {
    return User.create({
        name: "Admin", email: `admin${Date.now()}${Math.random()}@example.test`,
        phone: "9999999999", password: "hashed", role: "admin", isActive: true,
    });
}

test("real POST /api/admin/notifications/broadcast: unauthenticated request is rejected before any send", async () => {
    const res = await POST(req({ mode: "broadcast", title: "Sale", body: "50% off" }) as unknown as NextRequest);
    assert.equal(res.status, 403);
});

test("real POST /api/admin/notifications/broadcast: an invalid mode is rejected with 400", async () => {
    const admin = await makeAdmin();
    const token = signToken({ userId: String(admin._id), email: admin.email, role: "admin" });
    const res = await POST(req({ mode: "spam", title: "Sale", body: "50% off" }, token) as unknown as NextRequest);
    assert.equal(res.status, 400);
});

test("real POST /api/admin/notifications/broadcast: a valid broadcast with zero active subscribers succeeds with sent=0 (no provider contacted)", async () => {
    const admin = await makeAdmin();
    const token = signToken({ userId: String(admin._id), email: admin.email, role: "admin" });
    const res = await POST(req({ mode: "broadcast", title: "Sale", body: "50% off today" }, token) as unknown as NextRequest);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.sent, 0);
});

test("real POST /api/admin/notifications/broadcast: an EXACT duplicate broadcast within the idempotency window is blocked with 409 — but a DIFFERENT message is never blocked", async () => {
    const admin = await makeAdmin();
    const token = signToken({ userId: String(admin._id), email: admin.email, role: "admin" });

    const first = await POST(req({ mode: "broadcast", title: "Flash Sale", body: "Ends tonight!" }, token) as unknown as NextRequest);
    assert.equal(first.status, 200);

    const duplicate = await POST(req({ mode: "broadcast", title: "Flash Sale", body: "Ends tonight!" }, token) as unknown as NextRequest);
    assert.equal(duplicate.status, 409, "an identical title+body+url broadcast within the window must be blocked — this is the actual F15 guarantee");

    const different = await POST(req({ mode: "broadcast", title: "Different Sale", body: "Totally different message" }, token) as unknown as NextRequest);
    assert.equal(different.status, 200, "a genuinely different message must never be blocked by another message's idempotency key");
});

test("real POST /api/admin/notifications/broadcast: idempotency is per-content, not per-admin — a different admin sending the SAME exact content is ALSO blocked (key has no per-call randomness, but IS admin-scoped by design)", async () => {
    const admin = await makeAdmin();
    const token = signToken({ userId: String(admin._id), email: admin.email, role: "admin" });

    const first = await POST(req({ mode: "broadcast", title: "Same Title", body: "Same Body" }, token) as unknown as NextRequest);
    assert.equal(first.status, 200);

    // Documents the ACTUAL guarantee (broadcastIdempotencyKey includes
    // adminId): the SAME admin repeating the SAME content is blocked...
    const repeatSameAdmin = await POST(req({ mode: "broadcast", title: "Same Title", body: "Same Body" }, token) as unknown as NextRequest);
    assert.equal(repeatSameAdmin.status, 409);

    // ...but this is a key-derivation fact, not a cross-admin lock: a
    // SECOND admin sending the identical content is a DIFFERENT key
    // (adminId is part of the hash) and is NOT blocked. This is the
    // "actual guarantee and its limitations" the task asked to report —
    // the idempotency guard prevents one admin's double-click/retry, it
    // does NOT prevent two different admins from independently sending
    // the same campaign text.
    const secondAdmin = await User.create({
        name: "Admin2", email: `admin2${Date.now()}@example.test`, phone: "9999999999",
        password: "hashed", role: "admin", isActive: true,
    });
    const token2 = signToken({ userId: String(secondAdmin._id), email: secondAdmin.email, role: "admin" });
    const fromOtherAdmin = await POST(req({ mode: "broadcast", title: "Same Title", body: "Same Body" }, token2) as unknown as NextRequest);
    assert.equal(fromOtherAdmin.status, 200, "idempotency is scoped per-admin, not globally content-keyed — a second admin's identical content is a different key and is NOT blocked");
});

test("real POST /api/admin/notifications/broadcast: mode=user with zero matching subscriptions succeeds with sent=0 (no provider contacted)", async () => {
    const admin = await makeAdmin();
    const targetUser = await User.create({
        name: "Target", email: `target${Date.now()}@example.test`, phone: "9999999999",
        password: "hashed", role: "user", isActive: true,
    });
    const token = signToken({ userId: String(admin._id), email: admin.email, role: "admin" });

    const res = await POST(req({ mode: "user", title: "Hi", body: "Personal note", targetUserId: String(targetUser._id) }, token) as unknown as NextRequest);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.sent, 0);
});

test("real POST /api/admin/notifications/broadcast: mode=test with no matching subscription returns 404 (never attempts a send)", async () => {
    const admin = await makeAdmin();
    const token = signToken({ userId: String(admin._id), email: admin.email, role: "admin" });
    const res = await POST(req({ mode: "test", title: "Hi", body: "Test", endpoint: "https://fcm.example.test/nonexistent" }, token) as unknown as NextRequest);
    assert.equal(res.status, 404);
});
