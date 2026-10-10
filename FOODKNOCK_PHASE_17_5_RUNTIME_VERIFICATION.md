# FoodKnock — Phase 17.5 Runtime Verification + Phase 17.4 Re-Verification

Date: 2026-10-10

## PHASE 17.8 — FINAL POINTER

This document is now historical. The authoritative, final Phase 17 status
is `FOODKNOCK_PHASE_17_FINAL_STATUS.md` (§B section) and the final release
decision is in `FOODKNOCK_PHASE_17_6_RELEASE_GATE.md` (§Phase 17.8
section). This report's own content below (including the Phase 17.7
addendum immediately after this note) is preserved for historical
continuity but should not be read as the current state on its own.

## PHASE 17.7 ADDENDUM

This report's §4 ("Explicitly NOT route-level tested this phase") named
`attemptRecovery()`'s Razorpay-re-verification success path as untested.
That gap is now closed: `paymentRecoverySuccess.integration.test.ts` (5
tests) exercises it via Node's built-in module-mocking API to intercept
the `razorpay` package boundary — never a real provider call. Doing so
**found and fixed a critical, previously-invisible defect**: the success
path was structurally unreachable (see `FOODKNOCK_PHASE_17_FINAL_STATUS.md`'s
§A3 for full detail). This report's test counts and "COMPLETE WITH
LIMITATIONS" framing below are superseded by Phase 17.7's results; this
section is the pointer, the Final Status report is the source of truth.

## 1. Final Status

- **Phase 17.4 verification: COMPLETE.** All reported fixes (minimal orders
  projection, duplicate-index removal, the `ordersRoute.integration.test.ts`
  suite) were re-inspected in source and re-executed. No regression found.
- **Phase 17.5: COMPLETE WITH LIMITATIONS.** Five new real route-level
  integration suites were added and pass (reviews/moderation, guest order
  tracking, admin broadcast idempotency, admin loyalty repair, and
  payment-reconciliation admin actions + cron auth), closing the highest-
  priority items from the carried-forward gap list. The limitation: push-
  subscription CRUD routes (`/api/push/subscribe`, `/unsubscribe`) were not
  given dedicated new tests this pass (lower security value — unauthenticated
  by design, no admin/ownership logic to verify), and the `recover` route's
  actual Razorpay-re-verification success path remains untested (would
  require mocking Razorpay at the SDK boundary — a larger task, not
  attempted here). All production-facing operational items (index presence,
  kitchen-coordinate configuration, telemetry) remain **unverified**, not
  verified-good and not verified-missing — no production or staging
  credentials were available in this run.

## 2. Baseline and Scope

- Git baseline at the start of this run: 308 status lines, identical to the
  final state recorded at the end of Phase 17.4 (no drift occurred between
  phases).
- Before any change, the full existing test matrix was re-run as a
  pre-change baseline: 64 pure-logic tests (3 files) + 5 `ordersRoute`
  integration tests + 4 Phase 17.3 integration suites (12+6+9+3) = **99/99
  passing**, confirming no regression had crept in since the last report.
- Scope for this run: Phase 17.4 verification + Phase 17.5 runtime/coverage
  verification only. SEO and Phase 17.6 deployment were explicitly out of
  scope and not touched.

## 3. Phase 17.4 Verification

| Item | Verified how | Result |
|---|---|---|
| `fields=minimal` on `GET /api/orders` | Read `src/app/api/orders/route.ts` source; re-ran `ordersRoute.integration.test.ts` | Present, correct, default behavior unchanged — 5/5 tests pass |
| `OrderTable.tsx` poll uses minimal projection | Grepped the fetch call | `fetch("/api/orders?limit=200&fields=minimal", ...)` confirmed present |
| Duplicate `PushSubscription.isActive` index | Read `src/models/PushSubscription.ts`; ran a test suite that loads the model | Field-level `index:true` confirmed absent; the single explicit `schema.index({isActive:1})` remains. **No Mongoose "Duplicate schema index" warning appeared in any test run this phase** (it appeared in every run before the Phase 17.4 fix, per that phase's report) |
| `FOODKNOCK_PERFORMANCE_AUDIT.md` exists | Read the file | Present, contents match the reported findings; left intact, not rewritten |
| Phase 17.3 fixes (`claimPendingPayment` status filter, `creditPointsAtomic` orderMongoId) | Grepped source | Both confirmed present and unchanged |

No Phase 17.4 finding needed reopening — the only *new* observation this
phase (not a reopened Phase 17.4 item) is a pre-existing Mongoose deprecation
warning, see §7.

## 4. Route Integration Coverage

All suites below invoke the actual exported handler functions from their
route files — never a reimplementation. Every suite runs in its own process
against the host-verified, disposable local MongoDB (`testDb.ts`'s
`verifyIsolatedTestTarget()`).

| Route / Method | Handler executed | Scenarios | Pass/Fail | External boundary |
|---|---|---|---|---|
| `GET /api/orders` | `GET` (route.ts) | unauth, non-admin, default projection, minimal projection, cross-mode equivalence | 5/5 | none |
| `GET/POST /api/reviews` | `GET`, `POST` (route.ts) | valid submission never auto-published, missing/invalid fields, 11th submission rate-limited, status=approved filter | 4/4 of these shown; full file below | none |
| `PATCH/DELETE /api/reviews/[id]` | `PATCH`, `DELETE` ([id]/route.ts) | unauth, non-admin, admin approve (verified visible in list after), invalid id, non-admin/admin delete | 6/6 of these shown | none |
| **reviews.integration.test.ts total** | | | **10/10** | none |
| `GET /api/orders/track/[orderId]` | `GET` (track/[orderId]/route.ts) | valid lookup + phone masking, nonexistent id (404), missing id (400), 21st lookup rate-limited, per-IP scoping, **documented residual PII risk** (name/address still exposed) | **6/6** | none |
| `POST /api/admin/notifications/broadcast` | `POST` (broadcast/route.ts) | unauth, invalid mode, zero-subscriber broadcast (sent=0), exact-duplicate blocked (409) vs. different-content allowed, cross-admin key scoping documented, user-mode zero-match, test-mode 404 | **7/7** | push provider (never reached — zero matching subscriptions in every case, confirmed by code read of `resolveTargetSubscriptions`) |
| `GET/POST /api/admin/loyalty/inconsistencies` | `GET`, `POST` (inconsistencies/route.ts) | unauth, non-admin, clean-ledger empty report, GET side-effect-free, malformed id, missing params, nonexistent order (409), already-consistent order | **10/10** | none (real `loyaltyService.ts` functions, same ones already unit-covered in Phase 17.3) |
| `POST /api/admin/payment-reconciliation/[id]/recover` | `POST` (recover/route.ts) | unauth, non-admin, invalid id, not_found, already-dismissed (already_terminal) | **5/5 of 10** | Razorpay **not reached** in any tested branch (verified by source read — all tested branches return before the Razorpay call) |
| `POST /api/admin/payment-reconciliation/[id]/dismiss` | `POST` (dismiss/route.ts) | unauth, non-admin, too-short note, valid dismissal persists state, rejecting dismissal of a completed payment | **5/5 of 10** | none (dismiss never calls Razorpay) |
| **paymentReconciliationAdmin.integration.test.ts total** | | | **10/10** | Razorpay never contacted |
| `POST /api/cron/payment-reconciliation` | `POST` (cron/.../route.ts) | missing auth header (401), wrong bearer token (401), correct `CRON_SECRET` runs the real scan and returns a summary | **3/3** | Razorpay not reached (the scan itself only reads/updates local `PendingPayment` rows) |

**Totals this phase**: 6 new/updated integration test files, **41 new
tests**, all passing.

**Explicitly NOT route-level tested this phase** (documented gap, not
hidden):
- `POST /api/push/subscribe`, `POST /api/push/unsubscribe` — unauthenticated-
  by-design CRUD with no admin/ownership logic; lower security value than
  the items prioritized above. Code-review-only.
- `attemptRecovery()`'s actual Razorpay-re-verification success/failure
  paths — would require mocking the Razorpay SDK at its boundary, a
  separate, larger task.
- `POST /api/push/send-campaign` (the twice-daily campaign cron) — not
  inspected or tested this phase; carried forward as open.

## 5. Critical Business Invariants

| Invariant | Evidence |
|---|---|
| Payment reconciliation claim/retry | `paymentReconciliation.integration.test.ts` (6/6, Phase 17.3, re-run clean this phase) + new cron-auth test (3/3) |
| Loyalty debit/award/reversal/repair | `loyalty.integration.test.ts` (12/12) + new `loyaltyInconsistencies.integration.test.ts` (10/10) |
| Order cancellation / stock restoration / loyalty reversal | `orderCancellation.integration.test.ts` (3/3, including the concurrent-duplicate-cancellation DB-enforced case) |
| Admin authorization (live DB re-check, not JWT claim) | `auth.integration.test.ts` (9/9) + re-exercised in every new admin-route suite this phase (reviews, broadcast, loyalty-repair, reconciliation-admin) — consistently 403 for non-admin/unauthenticated in every case |
| Order ownership (IDOR) | `auth.integration.test.ts`'s ownership-comparison test (Phase 17.3) |
| Review moderation (never auto-published) | NEW — `reviews.integration.test.ts` confirms `isApproved` defaults false on submission and only an admin PATCH changes it |
| Guest tracking privacy (phone masking + rate limit) | NEW — `trackOrder.integration.test.ts` confirms masking and brute-force rate-limiting; also confirms and documents the accepted residual name/address exposure |
| Broadcast idempotency | NEW — `broadcastIdempotency.integration.test.ts` confirms the actual guarantee (same-admin exact-content dedupe) and its actual limitation (not a cross-admin lock) |

No business rule, pricing, stock, loyalty formula, or delivery-fee logic was
changed this phase.

## 6. Operational Verification Matrix

| Item | Checked | Environment | Evidence | Status | Follow-up required |
|---|---|---|---|---|---|
| `Review: {isApproved:1,createdAt:-1}` index | Model source | Local test DB only | Declared in `Review.ts`; local disposable DB will build it automatically on first connect, but that is not evidence of production state | **Unverified in production** | Read-only `getIndexes()` against production, or confirm via deploy logs |
| `PushSubscription: {isActive:1}` index | Model source | Local test DB only | Now declared exactly once (Phase 17.4 fix); same caveat as above | **Unverified in production** | Same as above — also confirm whether a stale duplicate physical index already exists there from before the source fix |
| `LoyaltyLedger: user_order_type_unique` partial unique index | Model source | Local test DB only | Declared with correct partial-filter expression in source | **Unverified in production** | Same as above |
| `PendingPayment.expiresAt` TTL index | Model source | Local test DB only | Declared in `PendingPayment.ts`, consistent with Phase 17.1A's reported migration | **Unverified in production** | Same as above |
| `MONGODB_URI` | Code path | N/A | `db.ts` throws loudly at import time if unset — fail-closed, not a silent fallback | **Verified by design** (fails safe) | None |
| `JWT_SECRET` | Code path | N/A | `auth.ts` requires it; no evidence of a weak default (not printed, not inspected) | **Presence-only checked, not production-verified** | Confirm production secret is set and rotated per policy — out of scope here |
| `CRON_SECRET` | Code path + new test | Local | Cron route fails closed (500) if unset, 401 if wrong — directly exercised by `paymentReconciliationCron.integration.test.ts` | **Verified (fail-closed logic), production value itself unverified** | Confirm Vercel's env var is actually set in production |
| Razorpay keys | Code path | N/A | `paymentReconciliation.ts` reads `RAZORPAY_KEY_ID`/`SECRET`; never printed, never exercised | **Presence not checked this phase** | Out of scope — no credentials available |
| Cloudinary / Firebase / WhatsApp / SMTP config | Code path | N/A | Each module reads its own env vars with a guarded fallback/error log (e.g. `webPushProvider.ts`'s `WEBPUSH_INIT_ERROR` when VAPID keys are missing — this literally printed during every test run in this phase, confirming the guard works) | **Presence-check logic verified locally; production values unverified** | Confirm all are set in the real Vercel project |
| Kitchen coordinates / serviceability fallback | Source read (`serviceability.ts`) | N/A | Fallback behavior (flat-rate, `kitchen_not_configured`, now logged per Phase 17.2) confirmed unchanged in source | **Unverified whether production has real coordinates configured** | An admin must check/set `/admin/delivery` in production; cannot be inferred from source |
| Vercel cron schedule actually firing | Not checked | N/A | A passing local test of the handler is NOT evidence a Vercel cron trigger is configured/active | **Unverified** | Check Vercel project's Cron Jobs dashboard |
| Production telemetry (error rate, latency, CPU, timeouts) | Not available | N/A | No credentials/access provided this run | **Unverified — not claimed healthy** | Check Vercel Observability / Logs for the relevant routes before Phase 17.6 |

No item above is reported as "complete" unless it was actually confirmed — several that *could* look done from source are explicitly marked unverified-in-production.

## 7. Performance and Reliability

No new performance work was attempted this phase per the master prompt's
instruction not to restart a broad audit without evidence of a regression —
none was found. One new, minor, non-blocking source-level observation
surfaced incidentally while running the new tests:

- **Mongoose deprecation warning** (not a bug, not fixed this phase):
  `src/app/api/reviews/[id]/route.ts`'s `Review.findByIdAndUpdate(id, ..., { new: true, ... })` triggers `the 'new' option for findOneAndUpdate() is deprecated. Use 'returnDocument': 'after' instead.` on every call, observed repeatedly during `reviews.integration.test.ts`. This is pre-existing code, not touched by Phases 17.2–17.5, and purely cosmetic (the option still works correctly — confirmed by the test's own assertions on the returned document). Left unfixed per the "don't touch unrelated pre-existing work" instruction; flagged here as a safe, low-priority cleanup candidate for whoever next touches that file.

No production CPU/latency numbers are available or claimed. The Phase 17.4
audit's local-fixture-based measurements stand unchanged.

## 8. Changes Made

**New files (this phase only):**
- `src/lib/__tests__/integration/reviews.integration.test.ts`
- `src/lib/__tests__/integration/trackOrder.integration.test.ts`
- `src/lib/__tests__/integration/broadcastIdempotency.integration.test.ts`
- `src/lib/__tests__/integration/loyaltyInconsistencies.integration.test.ts`
- `src/lib/__tests__/integration/paymentReconciliationAdmin.integration.test.ts`
- `src/lib/__tests__/integration/paymentReconciliationCron.integration.test.ts`
- `FOODKNOCK_PHASE_17_5_RUNTIME_VERIFICATION.md` (this file)

**No production/application code was changed this phase** — Phase 17.4's
code changes (`src/app/api/orders/route.ts`, `src/components/admin/orders/OrderTable.tsx`,
`src/models/PushSubscription.ts`) were only re-verified, not modified again.
These three files were already `M` (modified) in the git baseline recorded
at the *start* of Phase 17.4, i.e. before this engagement's involvement —
they remain exactly as Phase 17.4 left them.

## 9. Test, TypeScript, Lint and Build Results

```
node --experimental-strip-types --test loyaltyLogic.test.ts paymentReconciliationLogic.test.ts securityLogic.test.ts
→ 64 tests, 64 pass, exit 0

npx tsx --test loyalty.integration.test.ts                       → 12/12 pass, exit 0
npx tsx --test paymentReconciliation.integration.test.ts         →  6/6 pass, exit 0
npx tsx --test auth.integration.test.ts                          →  9/9 pass, exit 0
npx tsx --test orderCancellation.integration.test.ts             →  3/3 pass, exit 0
npx tsx --test ordersRoute.integration.test.ts                   →  5/5 pass, exit 0
npx tsx --test reviews.integration.test.ts                       → 10/10 pass, exit 0   (NEW)
npx tsx --test trackOrder.integration.test.ts                    →  6/6 pass, exit 0    (NEW)
npx tsx --test broadcastIdempotency.integration.test.ts          →  7/7 pass, exit 0    (NEW)
npx tsx --test loyaltyInconsistencies.integration.test.ts        → 10/10 pass, exit 0   (NEW)
npx tsx --test paymentReconciliationAdmin.integration.test.ts    → 10/10 pass, exit 0   (NEW)
npx tsx --test paymentReconciliationCron.integration.test.ts     →  3/3 pass, exit 0    (NEW)

TOTAL: 145/145 passing (64 pure-logic + 81 integration), each Mongoose-backed
suite run in its own process.

npx tsc --noEmit        → clean, exit 0
npx eslint <6 new files> → 0 problems, exit 0
npm run build            → exit 0, full route table rendered
```

Two of the fixture bugs I introduced while writing these tests this phase
(a wrong field name in a `PendingPayment` fixture, and a plain `Request`
where the loyalty-inconsistencies route actually needs a real `NextRequest`
for `req.nextUrl`) were caught and fixed during this same run — both were
test-file-only mistakes, never a production code change, and are not
"regressions" in the application.

## 10. Security and Privacy

- **Guest tracking PII**: confirmed and now test-locked — phone is masked
  to last 4 digits; rate-limited at 20/10min per IP. The residual risk
  (name + full address are still returned to anyone who knows/guesses a
  valid orderId) is unchanged from Phase 17.2's documented decision and is
  now captured by an explicit, labeled test (`DOCUMENTS residual risk: ...`)
  so it cannot silently regress further without the test's intent being
  visible. **This remains a product decision requiring explicit sign-off**,
  not a code defect — fixing it (e.g. requiring last-4-of-phone as a second
  factor) would be a user-facing contract change affecting the existing
  push-notification deep-link flow (see that route's own header comment)
  and is out of scope to decide unilaterally here.
- **Route authorization**: every new admin-route test confirms
  `requireAdmin()`'s live-DB re-check rejects both unauthenticated and
  authenticated-but-non-admin callers, with zero exceptions found across
  5 new route files covering 6 distinct admin actions.
- **Cron secret handling**: confirmed fail-closed on missing config (500,
  logged) and wrong token (401) — never silently permissive.
- **Unresolved decision carried forward**: guest-tracking second factor
  (above) remains the only open security-relevant product decision.

## 11. Production Mutations and Deployment

**Confirmed: none.** No production database write, index creation/deletion,
Razorpay call, live notification send, deployment, git commit, or git push
occurred during this phase. Every test ran against the same host-verified
(`127.0.0.1`), disposable local MongoDB instance used throughout this
engagement, independently re-verified at the start of every suite via
`verifyIsolatedTestTarget()`.

## 12. Remaining Blockers (prioritized)

1. **Production index verification** (read-only access required) — confirm
   `Review`, `PushSubscription`, `LoyaltyLedger`, `PendingPayment` indexes
   actually exist as declared, and whether a stale duplicate `isActive`
   index predates the Phase 17.4 source fix.
2. **Kitchen-coordinate / delivery-settings configuration** (configuration
   owner required) — confirm `/admin/delivery` has been set with real
   coordinates in production; cannot be inferred from source.
3. **Production telemetry review** (operational access required) — error
   rates, latency, CPU duration, timeout frequency for the routes touched
   across Phases 17.2–17.5, before Phase 17.6.
4. **Vercel cron activation check** (operational access required) — confirm
   the payment-reconciliation cron (and the push-campaign cron) are actually
   scheduled and firing in production; a passing local handler test is not
   evidence of this.
5. **Guest-tracking second-factor decision** (business/security decision
   required) — whether to accept the documented name/address exposure
   indefinitely or require a second factor, with the known push-notification
   deep-link compatibility constraint factored in.
6. **Razorpay-boundary mocking for `attemptRecovery()`'s success path**
   (separate engineering task) — the real-order-creation/claim path through
   live Razorpay re-verification remains code-review-only.
7. **`/api/push/subscribe`, `/unsubscribe`, `/api/push/send-campaign`
   route-level tests** — lower priority, not attempted this phase.

## 13. Git Safety

- Baseline at the start of this phase: 308 `git status --short` lines.
- Final: 309 lines — the only new line is `?? FOODKNOCK_PHASE_17_5_RUNTIME_VERIFICATION.md`
  (this report itself). The six new test files live inside the
  already-untracked `src/lib/__tests__/` directory (already one `??` line
  regardless of files added inside it), and this phase made no changes to
  any already-`M` file.
- `git diff --cached --stat`: empty — nothing was ever staged.
- No commit, push, merge, or deploy was performed.
- All pre-existing modified/untracked work (confirmed identical to the
  Phase 17.4 baseline) is preserved untouched.

## 14. Phase 17.6 Readiness Recommendation

**CONDITIONAL GO.**

The application-code and test evidence gathered across Phases 17.1–17.5 is
strong: real integration tests exercise the actual service and route code
for every critical financial/security path identified so far (payment
reconciliation, loyalty integrity, order cancellation, admin authorization,
review moderation, guest-tracking privacy, broadcast idempotency), all
145 tests pass, and `tsc`/lint/build are clean.

The condition: **Phase 17.6 (release gate) should not proceed until items
1–4 in §12 are resolved by someone with production read access** —
specifically, confirming the three pending indexes exist (or creating them
under a separate, explicitly-authorized migration), confirming kitchen
coordinates are configured, and a basic telemetry sanity check. None of
these require code changes; they require operational verification this
engagement could not perform without credentials. Item 5 (guest-tracking
second factor) is a product decision that does not block a release gate by
itself, given it is a pre-existing, already-documented, unchanged risk —
but it should be explicitly acknowledged/accepted by a decision-maker
before Phase 17.6, not left implicit.

No deployment was performed as part of this task.
