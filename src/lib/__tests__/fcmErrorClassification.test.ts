// src/lib/__tests__/fcmErrorClassification.test.ts
//
// VERCEL HOBBY SUSTAINABILITY AUDIT — covers isFcmAuthError(), the new
// classifier that lets src/lib/notifications/providers/webPushProvider.ts
// tell a systemic Firebase credential/permission rejection apart from a
// single dead token (isFcmTokenDead(), unchanged, not re-tested here).
// Getting this classification wrong in either direction is a real
// regression: misclassifying a dead token as an auth error would stop
// deactivating genuinely-expired subscriptions; misclassifying an auth
// error as a per-token failure would reintroduce the exact repeated-
// guaranteed-failure compute waste this fix exists to remove.
//
//   node --experimental-strip-types --test src/lib/__tests__/fcmErrorClassification.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";
import { isFcmAuthError, isFcmTokenDead } from "../firebase/admin.ts";

test("isFcmAuthError: recognizes known messaging/* credential-rejection codes", () => {
    assert.equal(isFcmAuthError("messaging/authentication-error", undefined), true);
    assert.equal(isFcmAuthError("messaging/invalid-credential", undefined), true);
    assert.equal(isFcmAuthError("messaging/third-party-auth-error", undefined), true);
});

test("isFcmAuthError: recognizes a bare PERMISSION_DENIED code or message (the exact phrase observed in production logs)", () => {
    assert.equal(isFcmAuthError("PERMISSION_DENIED", undefined), true);
    assert.equal(isFcmAuthError(undefined, "7 PERMISSION_DENIED: The caller does not have permission"), true);
    assert.equal(isFcmAuthError("messaging/unknown-error", "permission denied for this project"), true);
});

test("isFcmAuthError: does NOT misclassify a dead-token code as an auth error", () => {
    assert.equal(isFcmAuthError("messaging/registration-token-not-registered", undefined), false);
    assert.equal(isFcmAuthError("messaging/invalid-registration-token", undefined), false);
    assert.equal(isFcmAuthError("messaging/invalid-argument", undefined), false);
});

test("isFcmAuthError: does NOT misclassify an ordinary/unrelated error", () => {
    assert.equal(isFcmAuthError("messaging/internal-error", "temporary server error"), false);
    assert.equal(isFcmAuthError(undefined, undefined), false);
    assert.equal(isFcmAuthError("messaging/server-unavailable", "service unavailable"), false);
});

test("isFcmTokenDead: unchanged — still recognizes exactly its original three dead-token codes, none of which isFcmAuthError also claims", () => {
    for (const code of [
        "messaging/registration-token-not-registered",
        "messaging/invalid-registration-token",
        "messaging/invalid-argument",
    ]) {
        assert.equal(isFcmTokenDead(code), true);
        assert.equal(isFcmAuthError(code, undefined), false);
    }
});
