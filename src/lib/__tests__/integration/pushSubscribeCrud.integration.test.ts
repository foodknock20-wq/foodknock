// src/lib/__tests__/integration/pushSubscribeCrud.integration.test.ts
//
// Phase 17.7 — REAL integration tests for the actual exported POST
// handlers of src/app/api/push/subscribe/route.ts and
// src/app/api/push/unsubscribe/route.ts. Both routes are intentionally
// unauthenticated by design (a push subscription can be created before a
// visitor ever logs in — see subscribe/route.ts's own comment: "Links to
// the logged-in user if authenticated; otherwise stores anonymously").
// There is no ownership model to test here (anyone who holds a specific
// browser's own endpoint/keys can (un)subscribe that exact endpoint —
// that's the Web Push API's own security model, not something this route
// adds or weakens). What IS tested: input validation, upsert idempotency,
// optional user-linking, and that unsubscribe only ever flips isActive,
// never deletes data needed for audit/analytics.
//
// Run: MONGODB_URI="mongodb://127.0.0.1:27017/cafe_app" JWT_SECRET="test-only-secret-not-real" npx tsx --test src/lib/__tests__/integration/pushSubscribeCrud.integration.test.ts

import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import type { NextRequest } from "next/server";
import { verifyIsolatedTestTarget, dropTestDatabase, closeTestConnection } from "./testDb.ts";

import User from "../../../models/User.ts";
import PushSubscription from "../../../models/PushSubscription.ts";
import { signToken } from "../../auth.ts";
import { POST as subscribePOST } from "../../../app/api/push/subscribe/route.ts";
import { POST as unsubscribePOST } from "../../../app/api/push/unsubscribe/route.ts";

before(async () => { await verifyIsolatedTestTarget(); });

beforeEach(async () => {
    await User.deleteMany({});
    await PushSubscription.deleteMany({});
});

after(async () => {
    await dropTestDatabase();
    await closeTestConnection();
});

function req(body: unknown, token?: string): Request {
    const headers = new Headers({ "content-type": "application/json" });
    if (token) headers.set("cookie", `token=${encodeURIComponent(token)}`);
    return new Request("https://foodknock.test/api/push/x", { method: "POST", headers, body: JSON.stringify(body) });
}

test("real POST /api/push/subscribe: missing endpoint/keys is rejected with 400, never creates a row", async () => {
    const res = await subscribePOST(req({}) as unknown as NextRequest);
    assert.equal(res.status, 400);
    assert.equal(await PushSubscription.countDocuments({}), 0);
});

test("real POST /api/push/subscribe: a new, valid anonymous subscription is created with isActive true and no user link", async () => {
    const res = await subscribePOST(req({
        endpoint: "https://fcm.example.test/abc", keys: { p256dh: "p1", auth: "a1" },
    }) as unknown as NextRequest);
    assert.equal(res.status, 201);
    const sub = await PushSubscription.findOne({ endpoint: "https://fcm.example.test/abc" }).lean();
    assert.equal(sub?.isActive, true);
    assert.equal(sub?.user, null);
});

test("real POST /api/push/subscribe: a logged-in caller's subscription is linked to their real userId", async () => {
    const user = await User.create({
        name: "T", email: `t${Date.now()}@example.test`, phone: "9999999999",
        password: "x", role: "user", isActive: true,
    });
    const token = signToken({ userId: String(user._id), email: user.email, role: "user" });

    const res = await subscribePOST(req({
        endpoint: "https://fcm.example.test/linked", keys: { p256dh: "p2", auth: "a2" },
    }, token) as unknown as NextRequest);
    assert.equal(res.status, 201);
    const sub = await PushSubscription.findOne({ endpoint: "https://fcm.example.test/linked" }).lean();
    assert.equal(String(sub?.user), String(user._id));
});

test("real POST /api/push/subscribe: re-subscribing the SAME endpoint upserts (updates) instead of creating a duplicate row", async () => {
    const endpoint = "https://fcm.example.test/dup";
    await subscribePOST(req({ endpoint, keys: { p256dh: "old", auth: "old" } }) as unknown as NextRequest);
    const res2 = await subscribePOST(req({ endpoint, keys: { p256dh: "new", auth: "new" } }) as unknown as NextRequest);
    assert.equal(res2.status, 200, "an update to an existing endpoint returns 200, not 201");

    const count = await PushSubscription.countDocuments({ endpoint });
    assert.equal(count, 1, "re-subscribing the same endpoint must never create a second row");
    const sub = await PushSubscription.findOne({ endpoint }).lean();
    assert.equal(sub?.p256dh, "new");
});

test("real POST /api/push/subscribe: re-subscribing a previously-deactivated endpoint reactivates it (isActive true again)", async () => {
    const endpoint = "https://fcm.example.test/reactivate";
    await subscribePOST(req({ endpoint, keys: { p256dh: "p", auth: "a" } }) as unknown as NextRequest);
    await unsubscribePOST(req({ endpoint }) as unknown as NextRequest);
    const afterUnsub = await PushSubscription.findOne({ endpoint }).lean();
    assert.equal(afterUnsub?.isActive, false);

    await subscribePOST(req({ endpoint, keys: { p256dh: "p", auth: "a" } }) as unknown as NextRequest);
    const afterResub = await PushSubscription.findOne({ endpoint }).lean();
    assert.equal(afterResub?.isActive, true);
});

// ── unsubscribe ─────────────────────────────────────────────────────────────

test("real POST /api/push/unsubscribe: missing endpoint is rejected with 400", async () => {
    const res = await unsubscribePOST(req({}) as unknown as NextRequest);
    assert.equal(res.status, 400);
});

test("real POST /api/push/unsubscribe: marks the matching subscription isActive:false, never deletes the row", async () => {
    const endpoint = "https://fcm.example.test/tounsub";
    await subscribePOST(req({ endpoint, keys: { p256dh: "p", auth: "a" } }) as unknown as NextRequest);

    const res = await unsubscribePOST(req({ endpoint }) as unknown as NextRequest);
    assert.equal(res.status, 200);

    const sub = await PushSubscription.findOne({ endpoint }).lean();
    assert.ok(sub, "the row must still exist (soft-deactivation, not deletion — needed for audit/failCount history)");
    assert.equal(sub?.isActive, false);
});

test("real POST /api/push/unsubscribe: unsubscribing a nonexistent endpoint is a safe no-op, never errors or creates a row", async () => {
    const res = await unsubscribePOST(req({ endpoint: "https://fcm.example.test/never-existed" }) as unknown as NextRequest);
    assert.equal(res.status, 200);
    assert.equal(await PushSubscription.countDocuments({}), 0);
});
