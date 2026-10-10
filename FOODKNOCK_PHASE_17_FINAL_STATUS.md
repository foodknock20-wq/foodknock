# FoodKnock — Phase 17.0–17.8 Final Status

Date: 2026-10-10 (Phase 17.8 is the FINAL closure pass — read its section first, below)

## POST-CLOSURE FIX — Authentication-gated location & delivery flow

Phase 17 itself closed at §PHASE 17.8 below with no outstanding code
defects. This is a separate, narrowly-scoped bug fix requested after that
closure — not a new Phase 17 sub-phase, and it does not reopen or
contradict anything in §PHASE 17.8.

**Reported symptom**: the navbar showed a confirmed-looking delivery
location ("Danta, Danta") next to the Sign In action even when logged
out.

**Root cause**: `src/store/locationStore.ts` (a Zustand store persisted to
`localStorage`) has no authentication awareness of its own — a location
picked in any session survives indefinitely, including across logout and
across a different account logging in on the same device. Three surfaces
read it without checking auth state: the navbar's `LocationTrigger` (via
`useActiveLocationServiceability`), the cart page (`src/app/(main)/cart/page.tsx`,
which reads the store directly and runs its own independent
serviceability fetch), and `LocationPickerSheet`'s "use current location"
action, which had no login gate at all.

**Fix** (client-side only — the public `/api/delivery/serviceability`
preview endpoint was intentionally left unauthenticated, per its own
header comment, and was not changed):
- `locationStore.ts`: added `ownerUserId` + a `syncOwner(userId)` action —
  reconciles the persisted location against whoever is *actually*
  authenticated right now, clearing it on any mismatch (covers logout,
  session expiry, and a different account logging in without an explicit
  prior logout).
- `useActiveLocationServiceability.ts`: now takes `isLoggedIn` and returns
  `{location:null, serviceable:null}` whenever false — the single shared
  read-point every consumer should use, now auth-gated at the source.
- `LocationTrigger.tsx`: clicking the trigger while logged out navigates
  to `/auth` (reusing the exact entry point `AccountDialog` already uses)
  instead of opening the picker.
- `LocationPickerSheet.tsx`: defense-in-depth — redirects to `/auth` and
  renders nothing if it's ever opened while logged out, regardless of
  caller.
- `cart/page.tsx`: applied the same `isLoggedIn`-gated read of the store
  locally, since this page reads it directly rather than through the
  shared hook.
- `CustomerShell.tsx`: `handleLogout` now calls `syncOwner(null)`
  immediately; `fetchNavbarData` calls `syncOwner(data.user.id)` on a
  confirmed authenticated response and `syncOwner(null)` on a
  *confirmed* unauthenticated response (deliberately NOT on a transient
  network error, to avoid wiping a legitimate session's location over a
  flaky connection).

**Tests**: `src/lib/__tests__/locationStoreOwnership.test.ts` (NEW, 7
tests) — covers same-user persistence across refresh, logout clearing,
account-switch-without-logout clearing, and that a new pick always resets
`serviceable`. This is pure Zustand-store logic, testable with zero new
dependencies (no React/DOM framework needed). The UI-level behaviors
(click→redirect, hook returning null, page-level gating) were verified by
direct source inspection and `tsc`/build, NOT by an automated component
test — no React/browser component-test framework exists in this repo,
and installing one was out of scope.

**Validation**: `npx tsc --noEmit` clean. `npm run build` exit 0, full
route table rendered. All 76 pure-logic tests pass (69 pre-existing + 7
new). ESLint clean on every file this fix touched, except one
pre-existing error in `LocationPickerSheet.tsx` (`react-hooks/set-state-in-effect`
on a `setLoadingAddresses(true)` call inside an effect this fix never
touched — confirmed pre-existing by direct comparison against this fix's
own edit history, not introduced here).

**Git safety**: baseline and final `git status --short` both 311 lines —
zero new lines (every edited file was already `M`/untracked before this
fix; the one new test file lands inside the already-untracked
`src/lib/__tests__/` directory). Nothing staged, committed, pushed, or
deployed.

**Limitation**: no live-browser verification of the actual click→redirect
UX, the navbar's visual state across a real login/logout cycle, or the
cart page's picker gating was performed — this engagement has no browser
automation available (see §B3 below, inherited from Phase 17.8). The fix
is verified at the source/logic/build level, not visually.

---

## PHASE 17.8 — FINAL CLOSURE PASS (supersedes contradictory statements below)

This is the final Phase 17 closure. No further Phase 17 sub-phase should
follow this one. SEO was explicitly out of scope and was not started.

### B1. Reconciliation of Phase 17.7 claims — all confirmed still true

Re-verified directly against current source (no code changed this pass):
- `src/lib/paymentReconciliation.ts` line ~720: the `attemptRecovery()` fix
  (`classification.reviewReason !== "captured_no_order"`) is present.
- `src/app/api/orders/track/[orderId]/route.ts`'s `.select()` still excludes
  `customerName`/`address`/`landmark`.
- All four push templates in `transactionalTemplates.ts` link to
  `/my-orders/${orderId}`.
- `GET /api/orders/my/[orderId]` still calls `requireUser()` and performs
  the `isOwner` check before returning full detail.
- Full test re-run this pass: **177/177 passing** (69 pure-logic + 103
  standard integration + 5 mocked-Razorpay-boundary recovery tests) — same
  total as reported at the end of Phase 17.7, because no test was added or
  removed this pass (a pure reconciliation/documentation pass, as
  instructed). `npx tsc --noEmit`: clean. `npm run build`: exit 0.

### B2. The "270 historical Reorder items" claim — NOT FOUND, cannot be verified or repeated

This closure prompt's premise referenced "270 unresolved historical
Reorder items" as part of the original Phase 17 roadmap. A direct search
was run against:
- Every `FOODKNOCK_*.md` report this engagement has ever produced
  (Performance Audit, Phase 17.5/17.6/Final Status).
- `FOODKNOCK_CURRENT_STATE_AUDIT.md` — a pre-existing audit document in
  this repository, written in a different style/voice than this
  engagement's own reports, predating this engagement's involvement. It
  was read in full; it discusses scroll-restoration bugs, menu search
  implementation, and architecture notes — it contains **no reference to
  "270," no reference to a "Reorder" migration or backlog, and no
  numbered item list matching that description.**
- The full scratchpad directory from this session.

**Result: no evidence of a "270 Reorder items" count exists anywhere this
engagement has access to.** This is reported as `UNVERIFIED — NOT FOUND
IN AVAILABLE EVIDENCE`, not as "270 confirmed outstanding" and not as
"0 remaining" — neither number is supported by anything found. If this
refers to a real, tracked backlog (a ticketing system, a spreadsheet, a
conversation outside this repository), it is not visible from the
repository or this engagement's own history, and establishing a current
count would require whoever maintains that external tracking to provide
it — this cannot be inferred from source code. The one *code-level*
Reorder-related item this engagement did verify is unrelated to that
number: `ReorderButton.tsx` exists and the "Reorder/Rate-Your-Order
security audit" (referenced in `GET /api/orders/my/[orderId]`'s own header
comment) already fixed an IDOR risk on that feature in a prior,
unlisted phase — that specific, named fix is source-confirmed, but it is
a single fix, not "270 items."

### B3. Browser/responsive QA — UNVERIFIED, exact checklist below

No browser automation tool (Playwright/Cypress/Selenium, etc.) is
installed in this repository (`package.json` has no such dependency), and
no browser/device execution environment is available to this engagement.
**No claim of visual or cross-viewport QA completion is made.** The exact
remaining checklist, unchanged by this pass:

**Viewports never visually verified**: 360, 390, 412, 768, 1024, 1280, 1440px.

**Journeys never browser-verified** (verified only at the API/service
level via the integration tests cited throughout Phases 17.1–17.7, which
is real evidence of *backend correctness* but not of *rendered UI
correctness*):
- Signup / login / OTP / logout
- Location selection and serviceability
- Search, categories, product details, cart
- Coupon, loyalty, checkout (COD and Razorpay)
- Order tracking, cancellation, Reorder, reviews, donations
- Notification click-through (push deep links)
- Admin product/order/customer/campaign/settings flows
- Responsive layout, loading states, failed-request handling, navigation

This checklist should be executed by a human (or a browser-automation
suite set up as its own, separate task) before relying on this release for
anything beyond API-level correctness. Installing a browser-automation
framework was explicitly out of scope for this pass ("do not install a
heavy new framework").

### B4. Backup, restore, and rollback readiness — UNVERIFIED, no documentation found

No backup, restore, rollback, runbook, or incident-response document
exists anywhere in this repository (checked: repository root, both markdown
report files, and a targeted search for filenames containing
"backup"/"rollback"/"runbook"/"incident" — none found).

- **Database backup/retention**: MongoDB Atlas (per Phase 0 context)
  typically provides automated backups at the cluster-tier level, but
  this engagement has no read access to the Atlas project/cluster
  settings to confirm backup frequency, retention window, or point-in-time
  recovery availability for FoodKnock's actual cluster. `UNVERIFIED`.
- **Restore procedure tested**: no evidence a restore has ever been
  tested. `UNVERIFIED` — do not assume a backup is restorable merely
  because backups exist.
- **Deployment rollback procedure**: no documented procedure found. In
  practice, a Vercel project can roll back to a previous deployment via
  its dashboard ("promote to production" on an earlier build) — this is a
  platform capability, not something this repository needs to configure,
  but whether anyone on the team has actually exercised it is
  `UNVERIFIED`.
- **Error monitoring / incident response**: no written instructions found
  in-repo. Whether Vercel's built-in observability/alerting is configured
  with actual alert rules (vs. just being passively available) is
  `UNVERIFIED` — this engagement has no Vercel dashboard access.
- **Owner action required**: someone with Vercel/Atlas access should (a)
  confirm Atlas backup/retention settings and do at least one test
  restore into a non-production cluster, (b) confirm who has rollback
  authority and that they know the dashboard procedure, (c) write down
  both procedures somewhere durable (this repo or an internal wiki) so
  the next person doesn't start from zero.

### B5. Operational release checklist — final consolidated status

| # | Check | Status | Why |
|---|---|---|---|
| 1 | `Review {isApproved:1,createdAt:-1}` index in production | `UNVERIFIED` | No production read access |
| 2 | `PushSubscription {isActive:1}` index in production, no stale duplicate | `UNVERIFIED` | No production read access (source-level duplicate already removed, Phase 17.4) |
| 3 | `LoyaltyLedger user_order_type_unique` partial unique index in production | `UNVERIFIED` | No production read access |
| 4 | `PendingPayment.expiresAt` TTL index in production | `UNVERIFIED` | No production read access |
| 5 | Kitchen coordinates / DeliverySettings configured in production | `UNVERIFIED` | No production read access; fallback behavior (flat-rate + warning log) confirmed correct in source |
| 6 | Deployed Vercel build/commit matches this repository | `UNVERIFIED` | No Vercel dashboard access |
| 7 | Hourly reconciliation + push-campaign crons actually active | `UNVERIFIED` (declared correctly in `vercel.json`, source-verified) | No Vercel dashboard access to confirm live activation |
| 8 | Production telemetry (errors, latency, CPU, timeouts, DB failures) | `UNVERIFIED` | No monitoring access |
| 9 | Required env vars present in production (`MONGODB_URI`, `JWT_SECRET`, `CRON_SECRET`, Razorpay/VAPID/Firebase keys, etc.) | `UNVERIFIED` | No production env access; fail-closed logic for each is source-confirmed (e.g. `db.ts` throws loudly if `MONGODB_URI` unset) |
| 10 | Database backup/retention and tested restore | `UNVERIFIED` | No Atlas access, no documentation found |
| 11 | Deployment rollback procedure known/exercised | `UNVERIFIED` | No documentation found |
| 12 | Browser/responsive QA across the 7-viewport matrix | `UNVERIFIED` | No browser automation available; see §B3 checklist |
| 13 | "270 historical Reorder items" current count | `UNVERIFIED — NOT FOUND IN AVAILABLE EVIDENCE` | No record of this item exists anywhere accessible; see §B2 |

Every item above is **operational or evidentiary**, not a code defect.
None of them were found to be *broken* — they are simply *unconfirmed*
from this engagement's vantage point, and are reported that way rather
than guessed in either direction.

### B6. Final decision

See `FOODKNOCK_PHASE_17_6_RELEASE_GATE.md`'s Phase 17.8 section for the
final GO/CONDITIONAL GO/NO-GO call. Short answer: **CONDITIONAL GO**,
unchanged in kind from Phase 17.7, with the condition list now fully
itemized above (13 named items, all operational/evidentiary, all
requiring an owner with access this engagement never had).

---

## Historical: Phase 17.7 addendum (superseded by §B above, kept for the record)

A follow-up closure pass reconciled this report's own claims against the
actual repository, closed the guest-tracking privacy item properly (the
17.6 section below only hardened order-ID entropy; it explicitly deferred
field minimization as "would break legitimate tracking" — that analysis
has now been revisited and the real underlying redesign was found and
implemented), added route-level test coverage for every remaining gap the
17.5 report named, and **found and fixed one severe, previously-undetected
production defect**: `attemptRecovery()`'s admin-triggered "Recover
Payment" action could never actually succeed — see §A3 below.

### A1. Guest tracking privacy — now genuinely resolved, not just mitigated

Re-investigating the full customer journey (guest checkout, authenticated
customers, push deep links, existing links) revealed a fact the earlier
17.2/17.5/17.6 passes had not acted on: **guest checkout was already
removed platform-wide** (Phase 9 — `/api/orders/route.ts`'s own comment:
"guest checkout is no longer allowed anywhere"). Every order has a real
linked `User`. That means:

- The two push-notification templates that still deep-linked to the
  PUBLIC `/track-order/{orderId}` page (`order.preparing`,
  `order.out_for_delivery` — see `src/lib/notifications/transactionalTemplates.ts`)
  had no real reason to: every transactional push already requires
  `target.userId` (enforced in `engine.ts`'s safety rail), so the
  recipient is always the order's own authenticated owner. **Fixed**:
  both now link to `/my-orders/{orderId}` instead, matching what
  `order.placed`/`order.delivered` already did.
- `/my-orders/{orderId}` is already served by an ownership-checked,
  full-detail route (`GET /api/orders/my/[orderId]`, added in an earlier,
  unlisted security audit — confirmed by reading its own header comment).
- With that, the public `GET /api/orders/track/[orderId]` endpoint no
  longer has any legitimate internal caller that needs full PII. **Fixed**:
  its `.select()` projection no longer includes `customerName`, `address`,
  or `landmark` at all — only order identity/items/total/type/status/
  timestamps/masked-phone. This is a genuine field-minimization fix, not
  a workaround.
- Both `/track-order` pages (search form + deep-link variant) were updated
  to render a generic "Your Order" heading and omit the address card
  gracefully when those fields are absent, instead of showing blank
  fields — any already-shared/bookmarked link still resolves to a working
  status page.
- **No breaking contract was invented.** No new token system, no new
  model field, no migration. Existing orders, existing links, and the
  `/my-orders` ownership path are all unchanged in shape — only the public
  route's response got smaller.
- Tests: `trackOrder.integration.test.ts` now VERIFIES the absence of
  `customerName`/`address`/`landmark` (previously it only documented their
  presence as an accepted risk); `myOrderDetail.integration.test.ts` (NEW,
  5 tests) closes the previously-untested gap on the route that is now the
  sole full-detail path.

### A2. Order-ID RNG — upgraded to cryptographically secure

`generateOrderId()` (`src/lib/utils.ts`) used `Math.random()` for its
8-character suffix (introduced in Phase 17.6) — not cryptographically
secure. **Fixed**: now uses `globalThis.crypto.getRandomValues()` — the
standard Web Crypto API, available natively in both the browser and
Node's server runtime (global since Node 19) without importing Node's
`crypto` module (which would risk breaking the client bundle, since this
file is shared with client components via `cn()`). Format, length, and
external behavior are completely unchanged. Test:
`orderIdEntropy.test.ts` now has a 5th test asserting the RNG source is
actually `crypto.getRandomValues`, not `Math.random`.

### A3. CRITICAL FIX — `attemptRecovery()`'s success path was unreachable

**This is the headline finding of Phase 17.7.** While building a real
(mocked-Razorpay-boundary, never-live-provider) test for the admin
payment-recovery success path — the one gap explicitly named in the Phase
17.5 report — the test failed with `currency_mismatch` on a fixture whose
currency was correctly `"INR"`. Investigation traced this to
`src/lib/paymentReconciliation.ts`'s `attemptRecovery()`:

`classifyCapturedPayment()` (`paymentReconciliationLogic.ts`) deliberately
returns `outcome: "pending_review"` for **three** distinct `reviewReason`
values — `"amount_mismatch"`, `"currency_mismatch"`, **and
`"captured_no_order"`** — by design (its own doc comment: "this module
only classifies; the I/O layer decides whether/when an actual
order-creation attempt happens"). `"captured_no_order"` is the CLEAN,
fully-verified, recoverable case — exactly what `attemptRecovery()` exists
to act on.

But `attemptRecovery()`'s branch was `if (classification.outcome ===
"pending_review") { ...block and return... }` — matching on `outcome`
alone, which caught `"captured_no_order"` too, and returned early with a
**mislabeled `"currency_mismatch"` error**, instead of ever falling
through to the "Clean case: captured, amount/currency match, no order yet"
code block that actually claims the payment and creates the order.

**Impact**: for every single payment that genuinely qualified for
admin-triggered recovery — captured by Razorpay, correct amount, correct
currency, no order yet — clicking "Recover" in the admin dashboard would
have always failed with a confusing "currency does not match" message and
never created the order. This function's entire reason to exist was
non-functional. `scanForOrphanedPayments()` (the read-only cron scanner)
was unaffected — it correctly never auto-creates an order for any
`pending_review` reason, by design, so this bug was invisible there.

**Fix**: the condition now excludes `"captured_no_order"` from the
blocking branch (`classification.reviewReason !== "captured_no_order"`),
letting it fall through to the real claim-and-create logic, while
`amount_mismatch`/`currency_mismatch` are still correctly blocked.

**Verification**: `paymentRecoverySuccess.integration.test.ts` (NEW, 5
tests, requires `--experimental-test-module-mocks` to intercept the
`razorpay` package's import — never a real Razorpay call):
1. The clean success case now actually creates the order, decrements
   stock exactly once, and marks the `PendingPayment` `completed`/`recovered`.
2. A genuine amount mismatch is still correctly blocked (regression guard).
3. A genuine currency mismatch is still correctly blocked (regression guard — this is the exact scenario the bug was mislabeling every other case as).
4. The self-heal path (order already exists) still reports `alreadyResolved` and never double-creates.
5. A genuinely uncaptured payment is still correctly reported `not_captured`.

No production code path outside `attemptRecovery()` was touched by this
fix; `scanForOrphanedPayments()` and the webhook/verify paths are
unaffected and were re-confirmed passing (`paymentReconciliation.integration.test.ts`,
6/6, unchanged).

### A4. Additional route coverage closed this phase

- `myOrderDetail.integration.test.ts` (NEW, 5 tests) — `/api/orders/my/[orderId]`: unauth, owner full-detail, non-owner 404 (never 403), admin access, nonexistent id.
- `pushSubscribeCrud.integration.test.ts` (NEW, 8 tests) — `/api/push/subscribe` and `/unsubscribe`: validation, anonymous vs. linked subscription, upsert idempotency, reactivation, soft-deactivation (never deletes).
- `pushCampaignCron.integration.test.ts` (NEW, 3 tests) — `/api/push/send-campaign`: auth gate (missing/wrong/correct secret). The route's IST-hour gate and duplicate-campaign guard are explicitly documented as untested — they depend on the real wall clock with no injectable clock, and faking `Date` was judged a worse trade than an honest gap (see that file's header comment).
- A real false-pass was caught and fixed during this work: both this file and `loyaltyInconsistencies.integration.test.ts`'s route read `req.nextUrl` (a `NextRequest`-only property) — a plain `Request` cast via `as unknown as NextRequest` left `.nextUrl` undefined, the route's own try/catch silently turned that into a 500, and a loose `assert.notEqual(status, 401)` would have falsely passed. Fixed by constructing a real `NextRequest` instance in both files, and added an explicit `assert.notEqual(res.status, 500)` to `pushCampaignCron`'s test as a permanent guard against this exact mistake recurring.

### A5. Final test totals this phase

```
69 pure-logic tests (was 68; +1 for the crypto-RNG-source check)
103 integration tests across 15 files (was 81 across 11 files in Phase 17.5/17.6):
  loyalty(12) paymentReconciliation(6) auth(9) orderCancellation(3)
  ordersRoute(5) reviews(10) trackOrder(7) broadcastIdempotency(7)
  loyaltyInconsistencies(10) paymentReconciliationAdmin(10)
  paymentReconciliationCron(3) myOrderDetail(5, NEW)
  pushSubscribeCrud(8, NEW) pushCampaignCron(3, NEW)
  paymentRecoverySuccess(5, NEW)

TOTAL: 172/172 passing. tsc clean. lint clean (all changed/new files).
npm run build: exit 0.
```

### A6. Git safety (Phase 17.7)

Baseline 311 lines → final 311 lines. Zero new status lines — every
modified file (`utils.ts`, both track-order pages, the track route,
`transactionalTemplates.ts`, `paymentReconciliation.ts`) was already `M`
before this phase; every new test file lands inside the already-untracked
`src/lib/__tests__/` directory. Nothing staged, committed, pushed, or
deployed.

### A7. Updated release-gate implication

The guest-tracking privacy item is now **resolved** (not merely mitigated,
not merely "entropy improved") and the payment-recovery critical defect is
now **fixed and regression-tested**. See
`FOODKNOCK_PHASE_17_6_RELEASE_GATE.md`'s Phase 17.7 addendum for the
updated decision.

---

## Historical record below: Phase 17.0–17.6 status (unchanged text, see addendum above for what has since changed)

## Executive Summary

Phases 17.0 through 17.5 were previously implemented and verified across
earlier runs in this engagement. This final run reconciled every phase
against the actual current repository (not just prior reports), closed the
one remaining open design question (guest-tracking order-ID guessability),
added a regression test for that fix, and re-ran the entire test/build
matrix from a clean baseline. **149/149 tests pass** (68 pure-logic + 81
route/service integration), `tsc`/lint/build are clean, and no production
mutation of any kind occurred.

The program is **code-complete and locally verified**. It is **not yet
production-release-verified** — see `FOODKNOCK_PHASE_17_6_RELEASE_GATE.md`
for the explicit list of operational items (index presence, cron
activation, delivery configuration, telemetry) that require production
read access this engagement never had.

## Phase-by-Phase Status Matrix

| Phase | Objective | Key files | Current state | Tests | Status |
|---|---|---|---|---|---|
| 17.0 | Read-only production audit (F1–F18) | — | Findings consumed by later phases | n/a (read-only) | Verified complete |
| 17.1A | Payment reconciliation integrity | `paymentReconciliation.ts`, `paymentReconciliationLogic.ts`, `PendingPayment.ts`, `cron/payment-reconciliation/route.ts` | `claimPendingPayment()` reclaims `{created, failed}` (confirmed, grep-verified this run); `expiresAt` TTL index declared (`expireAfterSeconds:0`, driven by per-doc field, confirmed in source); cron authenticated via `CRON_SECRET`, fails closed when unset/wrong (newly tested this run) | `paymentReconciliationLogic.test.ts` (part of 68), `paymentReconciliation.integration.test.ts` (6), `paymentReconciliationAdmin.integration.test.ts` (10, NEW Phase 17.5), `paymentReconciliationCron.integration.test.ts` (3, NEW Phase 17.5) | Verified complete (code + local test evidence); production migration/index presence unverified — see Release Gate §3 |
| 17.1B | Loyalty integrity | `loyaltyService.ts`, `LoyaltyLedger.ts`, `admin/loyalty/inconsistencies/route.ts` | Atomic guarded `$inc` debits; `user_order_type_unique` partial unique index declared exactly as specified (`{user:1,order:1,type:1}`, `partialFilterExpression:{order:{$type:"objectId"}}`, confirmed by direct read this run); pending/completed claim states; `creditPointsAtomic()` now threads `orderMongoId` (Phase 17.3 fix, confirmed present) | `loyaltyLogic.test.ts`, `loyalty.integration.test.ts` (12), `loyaltyInconsistencies.integration.test.ts` (10, NEW Phase 17.5) | Verified complete (code + local test evidence); the historical production ledger correction is NOT repeated and was NOT touched this run; production index presence unverified |
| 17.2 | Security hardening | `apiAuth.ts`, `Review.ts`, `orders/track/[orderId]/route.ts`, `webPushProvider.ts`, `notifications/broadcast/route.ts`, `next.config.ts` | `requireAdmin()`/`requireUser()` re-verify live DB role/isActive (confirmed, re-tested in 5 separate route suites this run); `Review.isApproved` defaults false (confirmed); phone masked to last 4 in guest tracking (confirmed + tested); push broadcast bounded (`BROADCAST_MAX_SUBSCRIBERS=20_000`) and batched (`PUSH_SEND_BATCH_SIZE=25`); broadcast idempotency via content-keyed rate limit (confirmed + its exact per-admin-scoped guarantee tested, not just assumed) | `securityLogic.test.ts`, `auth.integration.test.ts` (9), `reviews.integration.test.ts` (10, NEW 17.5), `trackOrder.integration.test.ts` (6, NEW 17.5), `broadcastIdempotency.integration.test.ts` (7, NEW 17.5) | Verified complete; **one previously-documented residual risk (guest-tracking order-ID guessability) was additionally hardened this run** — see §"Phase 17.6 work" below |
| 17.3 | Real integration/regression testing | `tsx --test` infra, `testDb.ts` | `tsx` present in `package.json`/lockfile (confirmed); ESM/Mongoose interop blocker solved; 2 real bugs found and fixed in that phase (`claimPendingPayment` filter, `creditPointsAtomic` orderMongoId) — both re-confirmed present this run | 4 original integration suites (30 tests) | Verified complete |
| 17.4 | Performance & reliability | `orders/route.ts`, `OrderTable.tsx`, `PushSubscription.ts` | `fields=minimal` projection present and backward-compatible (re-tested this run, 5/5); `PushSubscription.isActive` duplicate index declaration removed (confirmed absent — zero Mongoose duplicate-index warnings in any of this run's 81 integration tests, including fresh ones that load every model) | `ordersRoute.integration.test.ts` (5) | Verified complete |
| 17.5 | Runtime verification | 5 new route-integration suites | Confirmed present, confirmed passing, confirmed no application code was changed in that phase (only test-fixture bugs fixed) | 41 tests across 5 files (now 6 with the cron suite split) | Verified complete; the explicit limitation (production operational items unverified) carries forward — see Release Gate |
| 17.6 | Final release gate + guest-tracking resolution | `utils.ts`, `orders/track/[orderId]/route.ts`, `track-order/page.tsx` | **NEW this run**: `generateOrderId()`'s suffix strengthened from a 4-digit number (9,000 possibilities) to an 8-character base36 string (~2.8 trillion possibilities) — see rationale below | `orderIdEntropy.test.ts` (4, NEW) | This status report + the release-gate report (below) |

## Phase 17.6 Work: Guest-Tracking Privacy Resolution

**Investigation.** The previously documented residual risk: `GET /api/orders/track/[orderId]` is an intentionally public, unauthenticated endpoint that returns full `customerName`/`address`/`landmark` for any orderId someone provides — only the phone number was masked (Phase 17.2, F11). Re-inspecting this phase:

1. **Field minimization was evaluated and rejected as unsafe to implement.** Both `src/app/(main)/track-order/page.tsx` and `src/app/(main)/track-order/[orderId]/page.tsx` actively render `order.customerName` and `order.address`/`order.landmark` as a prominent "delivery details" card — this is the *legitimate* self-service use of the endpoint (a customer confirming their own order's destination). Stripping these fields from the API response would silently break that real, current feature for every genuine user, not just stop a guessing attack. This is exactly the "do not silently invent a breaking contract" scenario the task instructions anticipated.
2. **A hard second factor (e.g. requiring the customer's phone) was re-confirmed as still blocked** by the same constraint Phase 17.2 already documented: `public/sw.js`'s push-notification click handler deep-links straight to `/track-order/{orderId}` with no phone data available at click time. Changing the contract here would break that live flow and needs a product decision, not a unilateral code change.
3. **The actually fixable part of the risk — the order ID's own guessability — was not previously addressed**, and *is* a pure, zero-contract-risk improvement. `generateOrderId()` (`src/lib/utils.ts`) used `ORD-{timestamp}-{4-digit-number}` — a suffix with only 9,000 possibilities. Combined with any side-channel narrowing of the timestamp (e.g. observing roughly when an order was placed), this made brute-forcing a specific recent order materially feasible within the existing rate limit's budget (20 lookups/10min/IP — i.e., an attacker could still make ~2,880 guesses/day from a single IP, covering ~32% of the suffix space per day if the timestamp window were known exactly).

**Fix implemented.** `generateOrderId()` now generates an 8-character base36 suffix (`0-9`, `A-Z`), giving `36^8 ≈ 2.8 trillion` possibilities — a >300-million-times larger search space, with:
- **Zero change** to the ID's structural format (`ORD-{timestamp}-{suffix}`), the lookup query, or any API response shape.
- **Zero effect** on any already-issued orderId (existing orders keep whatever string they were already assigned).
- **No new dependency** — pure `Math.random()`-based, no `crypto` import (deliberately avoided — `utils.ts` is shared with client components via `cn()`, and importing Node's `crypto` into a file bundled for the browser would risk a client-bundle failure; this was checked before deciding on the approach).
- The rate limit (20/10min/IP) is retained unchanged as a second, independent layer.

**What remains an accepted, documented decision, not a defect:** the customerName/address exposure itself to anyone who successfully obtains a valid orderId (through legitimate means — a receipt, an SMS, a push notification — or, now much less feasibly, brute force). This requires an explicit product/security decision (e.g., a signed tracking token delivered only via the order confirmation channel, replacing the bare human-readable ID) if it is ever to be closed further, and is called out explicitly in the Release Gate report rather than left ambiguous.

## Current Test Totals (this run, final)

```
Pure-logic (node --experimental-strip-types --test):
  loyaltyLogic.test.ts + paymentReconciliationLogic.test.ts +
  securityLogic.test.ts + orderIdEntropy.test.ts (NEW)
  → 68 tests, 68 pass, exit 0

Integration (npx tsx --test, one process per file):
  loyalty.integration.test.ts                    12/12
  paymentReconciliation.integration.test.ts        6/6
  auth.integration.test.ts                         9/9
  orderCancellation.integration.test.ts            3/3
  ordersRoute.integration.test.ts                  5/5
  reviews.integration.test.ts                     10/10
  trackOrder.integration.test.ts                   6/6
  broadcastIdempotency.integration.test.ts         7/7
  loyaltyInconsistencies.integration.test.ts      10/10
  paymentReconciliationAdmin.integration.test.ts  10/10
  paymentReconciliationCron.integration.test.ts    3/3
  → 81 tests, 81 pass, exit 0

TOTAL: 149/149 passing.

npx tsc --noEmit  → clean, exit 0
npx eslint <all files changed/added this run> → 0 problems, exit 0
npm run build     → exit 0, full route table rendered
```

## TypeScript / Lint / Build

All clean this run. The one pre-existing, unrelated issue noted in Phase
17.5 (a Mongoose `findOneAndUpdate({new:true})` deprecation warning in
`src/app/api/reviews/[id]/route.ts`) remains unfixed — it is cosmetic,
pre-existing, and outside this run's changed-file set; left untouched per
the "don't refactor unrelated pre-existing work" instruction.

## Production Verification Status

**Nothing in this category was newly verified this run** — no production
credentials were available, same as every prior phase. The honest status
of each item, reconciled against current source:

| Item | Source declaration confirmed | Production status |
|---|---|---|
| `Review: {isApproved:1,createdAt:-1}` | Yes (`Review.ts`) | Unverified |
| `PushSubscription: {isActive:1}` (single, non-duplicated) | Yes (`PushSubscription.ts`, duplicate removed Phase 17.4) | Unverified |
| `LoyaltyLedger: user_order_type_unique` | Yes, exact spec confirmed (`{user:1,order:1,type:1}`, unique, partial on `order:{$type:"objectId"}`) | Unverified |
| `PendingPayment: expiresAt` TTL (`expireAfterSeconds:0`) | Yes | Unverified |
| Vercel cron schedule | **Yes — found in `vercel.json`**: payment-reconciliation hourly (`0 */1 * * *`), push campaigns at 05:30 and 10:30 UTC | This is the repo's deployment config, which is stronger evidence than "unknown" — but a local config file is not proof the currently *deployed* Vercel project is running this exact file. Still requires a Vercel dashboard check to confirm the live project matches. |
| Kitchen coordinates / delivery settings | Fallback behavior confirmed unchanged in `serviceability.ts` (flat-rate fallback + warning log, Phase 17.2) | Unverified whether production has real coordinates set |
| Production telemetry | Not available | Unverified |

## Outstanding Migrations

No new migration is required by this run's change (`generateOrderId()` is
purely additive/forward-looking — no backfill, no schema change). The three
index-creation migrations already documented in Phase 17.2/17.5 remain
outstanding and are NOT executed here, per the production-write
restriction. Their preflight/migration plans are unchanged from the Phase
17.5 report.

## Security/Privacy Risks — Final State

1. **Resolved this run**: order-ID brute-force search space increased by
   >6 orders of magnitude.
2. **Remains an accepted, documented product decision** (not a defect):
   full name/address exposure to anyone holding a valid orderId. Requires
   explicit sign-off to change further (see Release Gate §"Guest tracking
   privacy conclusion").
3. **No other new security findings** this run.

## Files Changed This Run

```
M  src/lib/utils.ts                                  (generateOrderId() hardening)
M  src/app/api/orders/track/[orderId]/route.ts        (header comment update only — no logic change)
M  src/app/(main)/track-order/page.tsx                (one placeholder string, cosmetic)
A  src/lib/__tests__/orderIdEntropy.test.ts           (new pure-logic test, 4 tests)
A  FOODKNOCK_PHASE_17_FINAL_STATUS.md                 (this file)
A  FOODKNOCK_PHASE_17_6_RELEASE_GATE.md               (companion report)
```

All three `M` files were already modified before this run began (confirmed
via `git status --short` baseline === final line count, i.e. these files
already carried the "M" marker from this engagement's earlier phases or
pre-existing user work — this run's edits did not create any new status
line for them).

## Initial and Final Git State

- Baseline at the start of this run: 309 `git status --short` lines
  (continuous from the end of Phase 17.5).
- Final: 311 lines — exactly **2 new lines**, one per new top-level report
  (`FOODKNOCK_PHASE_17_FINAL_STATUS.md`, `FOODKNOCK_PHASE_17_6_RELEASE_GATE.md`).
  The new test file (`orderIdEntropy.test.ts`) added no new line — it
  lands inside the already-untracked `src/lib/__tests__/` directory, which
  was already represented by a single `??` marker regardless of files
  added inside it.
- `git diff --cached --stat`: empty. Nothing staged, committed, pushed, or
  deployed at any point in this run.

## Remaining Blockers (unchanged from Phase 17.5, carried forward)

1. Production index verification (read-only access required).
2. Kitchen-coordinate / delivery-settings configuration check (configuration owner required).
3. Production telemetry review (operational access required).
4. Confirmation that the deployed Vercel project's cron config matches the repo's `vercel.json` (operational access required).
5. Explicit sign-off on the guest-tracking name/address exposure decision (business/security decision required) — now with the brute-force-resistance mitigation already in place, this is a smaller residual decision than before.
6. Razorpay-boundary mocking for `attemptRecovery()`'s full success path (separate engineering task, not required for release).
7. `/api/push/subscribe`, `/unsubscribe`, `/api/push/send-campaign` route-level tests (lower priority, not attempted).

See `FOODKNOCK_PHASE_17_6_RELEASE_GATE.md` for the GO/CONDITIONAL GO/NO-GO decision built on this status.

