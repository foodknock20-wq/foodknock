// src/lib/__tests__/integration/reviews.integration.test.ts
//
// Phase 17.5 — REAL integration tests for the actual exported route
// handlers in src/app/api/reviews/route.ts (GET/POST) and
// src/app/api/reviews/[id]/route.ts (PATCH/DELETE), against a verified
// isolated local MongoDB. Closes the Phase 17.3/17.4 coverage gap for
// review submission/moderation. Invokes the real handlers — never a
// reimplementation of their logic.
//
// Run: MONGODB_URI="mongodb://127.0.0.1:27017/cafe_app" JWT_SECRET="test-only-secret-not-real" npx tsx --test src/lib/__tests__/integration/reviews.integration.test.ts

import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import type { NextRequest } from "next/server";
import { verifyIsolatedTestTarget, dropTestDatabase, closeTestConnection } from "./testDb.ts";

import User from "../../../models/User.ts";
import Review from "../../../models/Review.ts";
import RateLimitHit from "../../../models/RateLimitHit.ts";
import { signToken } from "../../auth.ts";
import { GET, POST } from "../../../app/api/reviews/route.ts";
import { PATCH, DELETE } from "../../../app/api/reviews/[id]/route.ts";

before(async () => { await verifyIsolatedTestTarget(); });

beforeEach(async () => {
    await User.deleteMany({});
    await Review.deleteMany({});
    await RateLimitHit.deleteMany({});
});

after(async () => {
    await dropTestDatabase();
    await closeTestConnection();
});

function req(url: string, init: RequestInit = {}, token?: string): Request {
    const headers = new Headers(init.headers);
    if (token) headers.set("cookie", `token=${encodeURIComponent(token)}`);
    headers.set("x-forwarded-for", "10.0.0.1");
    return new Request(url, { ...init, headers });
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

// ── POST /api/reviews — login-only submission, published instantly ────────

async function userToken(name = "U") {
    const user = await User.create({
        name, email: `u${Date.now()}${Math.random()}@example.test`,
        phone: "9999999999", password: "hashed", role: "user", isActive: true,
    });
    return signToken({ userId: String(user._id), email: user.email, role: "user" });
}

test("real POST /api/reviews: a logged-out visitor cannot submit (401), and nothing is persisted", async () => {
    const res = await POST(req("https://foodknock.test/api/reviews", {
        method: "POST",
        body: JSON.stringify({ userName: "Alice", rating: 5, comment: "Great food, fast delivery!" }),
    }) as unknown as NextRequest);
    assert.equal(res.status, 401, "an unauthenticated submission must be rejected");
    assert.equal(await Review.countDocuments({}), 0, "no review may be created by a logged-out caller");
});

test("real POST /api/reviews: a logged-in user's valid submission is created and immediately visible", async () => {
    const token = await userToken("Alice");
    const res = await POST(req("https://foodknock.test/api/reviews", {
        method: "POST",
        body: JSON.stringify({ rating: 5, comment: "Great food, fast delivery!" }),
    }, token) as unknown as NextRequest);
    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.review.isApproved, true, "a valid review must be visible immediately — no approval gate");
    assert.equal(body.review.userName, "Alice", "the author name must come from the account");

    // ...and it shows up on the public list right away.
    const listRes = await GET(req("https://foodknock.test/api/reviews") as unknown as NextRequest);
    const listBody = await listRes.json();
    assert.equal(listBody.reviews.length, 1);
    assert.equal(listBody.reviews[0].userName, "Alice");
});

test("real POST /api/reviews: client-supplied userName and isApproved are ignored (server owns identity + visibility)", async () => {
    const token = await userToken("Alice");
    const res = await POST(req("https://foodknock.test/api/reviews", {
        method: "POST",
        body: JSON.stringify({ userName: "Mallory", rating: 5, comment: "Trying to impersonate + self-hide.", isApproved: false }),
    }, token) as unknown as NextRequest);
    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(body.review.userName, "Alice", "a submitter must not be able to set the author name via the body");
    assert.equal(body.review.isApproved, true, "a submitter must not be able to set visibility via the body");
});

test("real POST /api/reviews: missing/invalid fields are rejected with 400", async () => {
    const token = await userToken();
    const badRating = await POST(req("https://foodknock.test/api/reviews", {
        method: "POST", body: JSON.stringify({ rating: 9, comment: "Great food, fast delivery!" }),
    }, token) as unknown as NextRequest);
    assert.equal(badRating.status, 400);

    const shortComment = await POST(req("https://foodknock.test/api/reviews", {
        method: "POST", body: JSON.stringify({ rating: 5, comment: "short" }),
    }, token) as unknown as NextRequest);
    assert.equal(shortComment.status, 400);
});

test("real POST /api/reviews: an 11th submission from the same IP within the window is rate-limited", async () => {
    const token = await userToken();
    for (let i = 0; i < 10; i++) {
        const res = await POST(req("https://foodknock.test/api/reviews", {
            method: "POST", body: JSON.stringify({ rating: 5, comment: "Great food, fast delivery!" }),
        }, token) as unknown as NextRequest);
        assert.equal(res.status, 201);
    }
    const eleventh = await POST(req("https://foodknock.test/api/reviews", {
        method: "POST", body: JSON.stringify({ rating: 5, comment: "Great food, fast delivery!" }),
    }, token) as unknown as NextRequest);
    assert.equal(eleventh.status, 429, "the 11th submission from the same IP within the hour must be rate-limited");
});

// ── GET /api/reviews — public, visible-only (hidden reviews never leak) ────

test("real GET /api/reviews: the public endpoint never returns a hidden review", async () => {
    await Review.create({ userName: "Hidden", rating: 4, comment: "Admin-hidden review, long enough.", isApproved: false });
    await Review.create({ userName: "Live", rating: 5, comment: "Visible review, long enough.", isApproved: true });

    const res = await GET(req("https://foodknock.test/api/reviews") as unknown as NextRequest);
    const body = await res.json();
    assert.equal(body.reviews.length, 1);
    assert.equal(body.reviews[0].userName, "Live");
});

// ── PATCH /api/reviews/[id] — admin-only hide/unhide ───────────────────────

test("real PATCH /api/reviews/[id]: unauthenticated moderation attempt is rejected", async () => {
    const review = await Review.create({ userName: "X", rating: 3, comment: "Needs moderation, long enough text.", isApproved: false });
    const res = await PATCH(
        req(`https://foodknock.test/api/reviews/${review._id}`, { method: "PATCH", body: JSON.stringify({ isApproved: true }) }) as unknown as NextRequest,
        { params: Promise.resolve({ id: String(review._id) }) }
    );
    assert.equal(res.status, 403);
    const fresh = await Review.findById(review._id).lean();
    assert.equal(fresh?.isApproved, false, "an unauthorized PATCH must never actually change isApproved");
});

test("real PATCH /api/reviews/[id]: a non-admin user's moderation attempt is rejected", async () => {
    const user = await makeUser();
    const token = signToken({ userId: String(user._id), email: user.email, role: "user" });
    const review = await Review.create({ userName: "X", rating: 3, comment: "Needs moderation, long enough text.", isApproved: false });

    const res = await PATCH(
        req(`https://foodknock.test/api/reviews/${review._id}`, { method: "PATCH", body: JSON.stringify({ isApproved: true }) }, token) as unknown as NextRequest,
        { params: Promise.resolve({ id: String(review._id) }) }
    );
    assert.equal(res.status, 403);
});

test("real PATCH /api/reviews/[id]: an admin can hide a visible review, then unhide it", async () => {
    const admin = await makeAdmin();
    const token = signToken({ userId: String(admin._id), email: admin.email, role: "admin" });
    const review = await Review.create({ userName: "X", rating: 3, comment: "Visible, long enough text.", isApproved: true });

    // Hide it — it should drop off the public list.
    const hideRes = await PATCH(
        req(`https://foodknock.test/api/reviews/${review._id}`, { method: "PATCH", body: JSON.stringify({ isApproved: false }) }, token) as unknown as NextRequest,
        { params: Promise.resolve({ id: String(review._id) }) }
    );
    assert.equal(hideRes.status, 200);
    let listBody = await (await GET(req("https://foodknock.test/api/reviews") as unknown as NextRequest)).json();
    assert.equal(listBody.reviews.length, 0, "a hidden review must not appear on the public list");

    // Unhide it — it should come back.
    const unhideRes = await PATCH(
        req(`https://foodknock.test/api/reviews/${review._id}`, { method: "PATCH", body: JSON.stringify({ isApproved: true }) }, token) as unknown as NextRequest,
        { params: Promise.resolve({ id: String(review._id) }) }
    );
    assert.equal(unhideRes.status, 200);
    listBody = await (await GET(req("https://foodknock.test/api/reviews") as unknown as NextRequest)).json();
    assert.equal(listBody.reviews.length, 1);
    assert.equal(listBody.reviews[0]._id, String(review._id));
});

test("real PATCH /api/reviews/[id]: an invalid review id is rejected with 400, not a 500/crash", async () => {
    const admin = await makeAdmin();
    const token = signToken({ userId: String(admin._id), email: admin.email, role: "admin" });
    const res = await PATCH(
        req("https://foodknock.test/api/reviews/not-a-valid-id", { method: "PATCH", body: JSON.stringify({ isApproved: true }) }, token) as unknown as NextRequest,
        { params: Promise.resolve({ id: "not-a-valid-id" }) }
    );
    assert.equal(res.status, 400);
});

// ── DELETE /api/reviews/[id] — admin-only ──────────────────────────────────

test("real DELETE /api/reviews/[id]: a non-admin cannot delete a review", async () => {
    const user = await makeUser();
    const token = signToken({ userId: String(user._id), email: user.email, role: "user" });
    const review = await Review.create({ userName: "X", rating: 3, comment: "Needs moderation, long enough text.", isApproved: true });

    const res = await DELETE(
        req(`https://foodknock.test/api/reviews/${review._id}`, { method: "DELETE" }, token) as unknown as NextRequest,
        { params: Promise.resolve({ id: String(review._id) }) }
    );
    assert.equal(res.status, 403);
    assert.ok(await Review.findById(review._id), "the review must still exist after a rejected delete attempt");
});

test("real DELETE /api/reviews/[id]: an admin can delete a review", async () => {
    const admin = await makeAdmin();
    const token = signToken({ userId: String(admin._id), email: admin.email, role: "admin" });
    const review = await Review.create({ userName: "X", rating: 3, comment: "Needs moderation, long enough text.", isApproved: true });

    const res = await DELETE(
        req(`https://foodknock.test/api/reviews/${review._id}`, { method: "DELETE" }, token) as unknown as NextRequest,
        { params: Promise.resolve({ id: String(review._id) }) }
    );
    assert.equal(res.status, 200);
    assert.equal(await Review.findById(review._id), null);
});
