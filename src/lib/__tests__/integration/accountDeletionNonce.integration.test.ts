// src/lib/__tests__/integration/accountDeletionNonce.integration.test.ts
//
// REAL integration tests for the single-use, server-stored deletion nonce.
// They drive the ACTUAL route handlers (initiate/confirm POST) with real
// Request objects against the verified-isolated local MongoDB (testDb.ts),
// so session binding, atomic nonce consumption and the failure/replay paths
// are exercised exactly as in production.
//
// Run (all three secrets must be set at the SHELL level — auth.ts captures
// JWT_SECRET at import time, so an in-file assignment is too late):
//
//   $env:JWT_SECRET="test-jwt-secret"
//   $env:ACCOUNT_DELETION_SECRET="test-del-secret"
//   $env:PROMO_ELIGIBILITY_SECRET="test-promo-secret"
//   $env:MONGODB_URI="mongodb://127.0.0.1:27017/cafe_app"
//   npx tsx --test src/lib/__tests__/integration/accountDeletionNonce.integration.test.ts

import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { verifyIsolatedTestTarget, dropTestDatabase, closeTestConnection } from "./testDb.ts";

import User from "../../../models/User.ts";
import Order from "../../../models/Order.ts";
import PromotionEligibility from "../../../models/PromotionEligibility.ts";
import RateLimitHit from "../../../models/RateLimitHit.ts";
import { hashPassword, signToken, signDeletionToken } from "../../auth.ts";
import { POST as initiatePOST } from "../../../app/api/account/delete/initiate/route.ts";
import { POST as confirmPOST } from "../../../app/api/account/delete/confirm/route.ts";

const PASSWORD = "Correct-Horse-9";

function sessionCookie(userId: string, email: string, role = "user"): string {
    return signToken({ userId, email, role });
}

function makeReq(url: string, token: string, body: unknown): Request {
    return new Request(`http://localhost${url}`, {
        method: "POST",
        headers: { cookie: `token=${token}`, "content-type": "application/json" },
        body: JSON.stringify(body),
    });
}

async function makeUser(overrides: Record<string, unknown> = {}) {
    const password = await hashPassword(PASSWORD);
    return User.create({
        name: "Nonce Person",
        email: "nonce@foodknock.com",
        phone: "9990002222",
        password,
        firstDeliveryFreeUsed: false,
        deliveredOrderCount: 0,
        ...overrides,
    });
}

/** Run /initiate and return { status, deletionToken }. */
async function initiate(sessionToken: string, password = PASSWORD) {
    const res = await initiatePOST(makeReq("/api/account/delete/initiate", sessionToken, { password }));
    const json = (await res.json()) as { deletionToken?: string };
    return { status: res.status, deletionToken: json.deletionToken };
}

async function confirm(sessionToken: string, deletionToken: string) {
    const res = await confirmPOST(
        makeReq("/api/account/delete/confirm", sessionToken, { deletionToken, acknowledge: true })
    );
    return { status: res.status };
}

before(async () => {
    await verifyIsolatedTestTarget();
});

beforeEach(async () => {
    await User.deleteMany({});
    await Order.deleteMany({});
    await PromotionEligibility.deleteMany({});
    await RateLimitHit.deleteMany({});
});

after(async () => {
    await dropTestDatabase();
    await closeTestConnection();
});

test("happy path: initiate stores a nonce HASH (never raw), confirm consumes it and deletes", async () => {
    const user = await makeUser();
    const sess = sessionCookie(String(user._id), user.email);

    const { status: iStatus, deletionToken } = await initiate(sess);
    assert.equal(iStatus, 200);
    assert.ok(deletionToken);

    // Stored value is a hash, and the raw nonce from the token is NOT stored.
    const withNonce = await User.findById(user._id).lean<{ accountDeletion?: { nonceHash?: string } }>();
    const storedHash = withNonce?.accountDeletion?.nonceHash;
    assert.match(storedHash as string, /^[0-9a-f]{64}$/);

    const { status: cStatus } = await confirm(sess, deletionToken!);
    assert.equal(cStatus, 200);
    assert.equal(await User.findById(user._id).lean(), null, "user must be deleted");
});

test("replay: a consumed token fails on the second confirm (no second deletion)", async () => {
    const user = await makeUser();
    const sess = sessionCookie(String(user._id), user.email);
    const { deletionToken } = await initiate(sess);

    const first = await confirm(sess, deletionToken!);
    assert.equal(first.status, 200);

    const replay = await confirm(sess, deletionToken!);
    assert.equal(replay.status, 401, "replayed token must be rejected");
});

test("nonce mismatch: a token with a nonce that was never stored is rejected", async () => {
    const user = await makeUser();
    const sess = sessionCookie(String(user._id), user.email);
    await initiate(sess); // stores a DIFFERENT nonce

    const sid = crypto.createHash("sha256").update(sess).digest("hex");
    const forged = signDeletionToken({ userId: String(user._id), sid, nonce: "deadbeef-not-stored" });

    const { status } = await confirm(sess, forged);
    assert.equal(status, 401);
    assert.ok(await User.findById(user._id).lean(), "user must NOT be deleted");
});

test("expired nonce: confirm fails once the stored expiry is in the past", async () => {
    const user = await makeUser();
    const sess = sessionCookie(String(user._id), user.email);
    const { deletionToken } = await initiate(sess);

    // Force the stored nonce to have already expired (token JWT exp is 10m,
    // so the SERVER-side expiry is the gate being tested here).
    await User.updateOne(
        { _id: user._id },
        { $set: { "accountDeletion.nonceExpiresAt": new Date(Date.now() - 1000) } }
    );

    const { status } = await confirm(sess, deletionToken!);
    assert.equal(status, 401);
    assert.ok(await User.findById(user._id).lean(), "expired intent must not delete");
});

test("invalid session binding: token from a different session is rejected", async () => {
    const user = await makeUser();
    const sessA = sessionCookie(String(user._id), user.email);
    const { deletionToken } = await initiate(sessA);

    // A different, valid session for the SAME user (different JWT iat → the
    // sid hash differs). The token is bound to sessA, so confirming under a
    // fresh session must fail the sid check.
    await new Promise((r) => setTimeout(r, 1100)); // ensure a distinct iat
    const sessB = sessionCookie(String(user._id), user.email);
    assert.notEqual(sessA, sessB);

    const { status } = await confirm(sessB, deletionToken!);
    assert.equal(status, 401);
    assert.ok(await User.findById(user._id).lean(), "user must NOT be deleted");
});

test("two concurrent confirmations: exactly one succeeds, exactly one deletion", async () => {
    const user = await makeUser();
    const sess = sessionCookie(String(user._id), user.email);
    const { deletionToken } = await initiate(sess);

    const [a, b] = await Promise.all([confirm(sess, deletionToken!), confirm(sess, deletionToken!)]);
    const statuses = [a.status, b.status].sort();
    assert.deepEqual(statuses, [200, 401], "exactly one confirm may consume the nonce");
    assert.equal(await User.findById(user._id).lean(), null);
});

test("two concurrent initiations: at most one issued token remains usable", async () => {
    const user = await makeUser();
    const sess = sessionCookie(String(user._id), user.email);

    const [r1, r2] = await Promise.all([initiate(sess), initiate(sess)]);
    assert.equal(r1.status, 200);
    assert.equal(r2.status, 200);
    assert.notEqual(r1.deletionToken, r2.deletionToken);

    // Whichever nonce was stored last is the only valid one — trying both
    // tokens must yield exactly one success total.
    const c1 = await confirm(sess, r1.deletionToken!);
    const stillThere = await User.findById(user._id).lean();
    const c2 = stillThere ? await confirm(sess, r2.deletionToken!) : { status: 401 as number };

    const successes = [c1.status, c2.status].filter((s) => s === 200).length;
    assert.equal(successes, 1, "only one of the concurrently-issued intents may succeed");
    assert.equal(await User.findById(user._id).lean(), null);
});

test("failure AFTER consumption does not restore reusability (admin orchestration throws post-consume)", async () => {
    // Craft a valid, session-bound token + stored nonce for an ADMIN user.
    // /confirm consumes the nonce, then deleteAccount() throws 403 for admins
    // — proving the nonce is consumed BEFORE irreversible work and is not
    // restored on failure. (The normal /initiate path refuses admins; here we
    // set the nonce directly to isolate the post-consumption failure path.)
    const admin = await makeUser({ role: "admin", email: "admin@foodknock.com" });
    const sess = sessionCookie(String(admin._id), admin.email, "admin");
    const sid = crypto.createHash("sha256").update(sess).digest("hex");
    const nonce = crypto.randomBytes(16).toString("hex");
    const nonceHash = crypto.createHash("sha256").update(nonce).digest("hex");
    await User.updateOne(
        { _id: admin._id },
        { $set: { "accountDeletion.nonceHash": nonceHash, "accountDeletion.nonceExpiresAt": new Date(Date.now() + 60000) } }
    );
    const token = signDeletionToken({ userId: String(admin._id), sid, nonce });

    const first = await confirm(sess, token);
    assert.equal(first.status, 403, "admin orchestration must refuse");

    // Nonce consumed (cleared) despite the failure — not restored.
    const after = await User.findById(admin._id).lean<{ accountDeletion?: { nonceHash?: string | null } }>();
    assert.equal(after?.accountDeletion?.nonceHash ?? null, null, "nonce must stay consumed after failure");

    // The same token cannot be reused to retry.
    const replay = await confirm(sess, token);
    assert.equal(replay.status, 401, "consumed token must not be reusable after a failed attempt");
});
