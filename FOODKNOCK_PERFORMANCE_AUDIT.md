# FoodKnock — Phase 17.4 Performance & Reliability Audit

Date: 2026-10-10
Scope: Admin analytics/growth aggregations, API payload/pagination bounds, push
fan-out concurrency, DB connection reuse, client polling/session-fetch
behavior, and the previously-flagged historical risk list. Methodology:
direct code reading of real call paths (not grep-count heuristics), execution
of real integration tests against a verified-isolated local MongoDB, and
`.select()`/index inspection against actual model definitions. No production
traffic, metrics, or data were accessed.

## Executive Summary

Most of the historically-flagged risk categories (unbounded admin
exports/reads, N+1 preference lookups in push fan-out, unbounded broadcast
concurrency, repeated per-request DB connections, scattered navbar/session
fetches) were **already remediated in Phases 15D, 16, and 17.2** and were
re-verified, not re-fixed, in this pass — see "Already-remediated risks"
below for the evidence. Two new, real issues were found and fixed:

1. **Confirmed & fixed** — `OrderTable.tsx`'s 5-second admin "new order"
   poll was requesting the full admin order projection (items array,
   address, landmark, note, payment IDs — 12+ fields) every 5 seconds for
   every open admin browser tab, when the client code only ever reads
   `_id`/`customerName`/`totalAmount` off the response. Fixed via an
   additive, opt-in `fields=minimal` projection mode on `GET /api/orders`.
2. **Confirmed & fixed** — `PushSubscription.isActive` declared the exact
   same `{isActive:1}` index twice: once via the field's `index: true` and
   again via the explicit `schema.index({isActive:1})` added in Phase 17.2
   (F8). Mongoose logged a "Duplicate schema index" warning on every model
   load; this is now a single index declaration.

One further finding (admin order search using unanchored `$regex` across
three fields) is documented as a hypothesis requiring production-scale data
to confirm — see Top Bottlenecks §4.

## Methodology

- Read the actual aggregation/query code in `src/lib/adminAnalytics.ts`,
  `src/lib/adminGrowth.ts`, `src/lib/notifications/providers/webPushProvider.ts`,
  `src/lib/db.ts`, every `GET`/`POST` handler under `src/app/api/**`, and the
  client components with `setInterval`/polling.
- Cross-checked model index declarations (`src/models/*.ts`) against the
  actual `$match`/`$sort`/filter shapes used against them.
- Ran the full real-integration-test suite established in Phase 17.3
  (`tsx --test`, isolated per file, against a host-verified local MongoDB)
  before and after each change, plus a new suite added this phase for
  `GET /api/orders`.
- Did **not** run `.explain("executionStats")` against a representative
  dataset — the local test database used for isolation verification holds
  only disposable, test-generated documents (a handful per test, created
  and torn down per suite), which would make any timing/plan numbers
  meaningless. Flagging this honestly rather than fabricating numbers.

## Already-remediated risks (re-verified, not re-fixed this phase)

| Historical risk | Where it was fixed | Evidence re-verified this phase |
|---|---|---|
| Unbounded admin user export | Phase 15A, `src/app/api/admin/users/export/route.ts` | `MAX_EXPORT = 10_000`, `.limit()`, `truncated` flag present |
| N+1 preference lookups in broadcast push | Phase 6, `webPushProvider.ts` | `isCategoryEnabledForUsers()` bulk query, not per-subscription |
| Unbounded broadcast subscriber fetch | Phase 17.2 (F8) | `BROADCAST_MAX_SUBSCRIBERS = 20_000` cap + warn log present |
| Unbounded push-send concurrency | Phase 6 | `PUSH_SEND_BATCH_SIZE = 25`, batched `Promise.all` loop, not one giant `Promise.all` |
| Repeated serverless DB connections | `src/lib/db.ts` | Global cache + `readyState` check; standard Mongoose serverless pattern, `maxPoolSize: 10` |
| Scattered navbar/session fetches (3 calls → 1) | UI 2.0 Phase 1, `src/app/api/navbar/route.ts` | Single combined route; `CustomerShell.tsx` calls it once, gated by `fetchInFlight` ref against overlap |
| Stale-privilege admin auth window | Phase 17.2 (F4) | `requireAdmin()`/`requireUser()` re-check live DB role/isActive; independently re-confirmed with real JWTs in Phase 17.3 and again in this phase's new `ordersRoute.integration.test.ts` |
| Admin analytics aggregation design (date-bounded, archived-excluded, bounded lookups) | Phase 15D | `src/lib/adminAnalytics.ts` — every one of the 12 aggregation functions already date-bounds via `$match`, uses existing indexes (`{createdAt:-1}`, `{status:1,createdAt:-1}`, `{user:1,createdAt:-1}`), and bounds all secondary lookups (`Product.find({_id:{$in:...}})` on a small distinct set, never the full collection) |
| Growth/RFM/cohort analytics performance | Phase 16 | Single bounded `Order.aggregate()` collapses the whole collection to one row per customer; every downstream metric (cohorts, RFM, revenue concentration) is then plain in-memory JS over that already-small array — not N additional queries |

No regression was found in any of the above during this phase's test runs.

## Top Bottlenecks (ranked)

### 1. [FIXED] Admin order-list 5-second poll fetched the full order projection
- **File**: `src/components/admin/orders/OrderTable.tsx` (poll, was line ~274) + `src/app/api/orders/route.ts` (`GET`)
- **Evidence**: `poll()` runs every 5000ms for as long as any admin has `/admin/orders` open, and only reads `latest[0]._id`, `o.customerName`, `o.totalAmount`, `o._id` off the response (used for toast content and the `knownIdsRef`/`lastSeenIdRef` diff) — never renders the fetched rows. The route's `.select()` was unconditionally returning `orderId customerName phone address landmark orderType items totalAmount deliveryFee platformFee status paymentMethod razorpayOrderId razorpayPaymentId createdAt isFirstDeliveryFreeApplied note`, including a full `items` array and several PII fields (phone, address, landmark), for up to 200 rows, 12 times a minute, per open tab.
- **Confidence**: High (direct code read of both sides of the call; not a hypothesis).
- **Impact**: Reduced per-tick response field count from 15 fields (incl. a nested array) down to 4 scalar fields for the poll path; no change to payload size/shape for any other caller of the route (default behavior is byte-for-byte unchanged).
- **Risk of fix**: Low — purely additive, opt-in query parameter; old behavior is the default.
- **Fix**: `fields=minimal` query param added to `GET /api/orders`; `OrderTable.tsx`'s poll now passes it.
- **Test**: `src/lib/__tests__/integration/ordersRoute.integration.test.ts` — 5 new tests, see Regression Tests section.

### 2. [FIXED] Duplicate `{isActive:1}` index declaration on `PushSubscription`
- **File**: `src/models/PushSubscription.ts`
- **Evidence**: Field-level `isActive: { ..., index: true }` and the explicit `PushSubscriptionSchema.index({isActive:1})` (added in Phase 17.2 for F8) declare the identical index. Directly observed as a `(node:...) [MONGOOSE] Warning: ... Duplicate schema index on {"isActive":1} for model "PushSubscription"` on every test run in this phase (and, by the same mechanism, on every real server/serverless cold start).
- **Confidence**: High — directly observed warning, directly read schema.
- **Impact**: Removes one redundant index definition. Each duplicate costs write overhead and storage at index-sync time; whether MongoDB had actually built two underlying indexes in the real deployment depends on how indexes were last synced there (see Database/Index Status) — but the source-level duplication itself is confirmed and now removed regardless.
- **Risk of fix**: Low — net effect is one fewer (duplicate) index declaration; the compound `{user:1,isActive:1}` index and the standalone `{isActive:1}` index (now declared once) are both still present.
- **Fix**: Removed the field-level `index: true`; kept the explicit, commented declaration.
- **Test**: Re-ran the full test suite after the fix; the Mongoose warning no longer appears in output.

### 3. [Hypothesis — not implemented] Admin order search uses unanchored regex across 3 fields
- **File**: `src/app/api/orders/route.ts` GET handler, `search` param
- **Evidence**: `$or: [{customerName:{$regex:search,$options:"i"}}, {phone:{$regex:...}}, {orderId:{$regex:...}}]`. An unanchored, case-insensitive regex cannot use a B-tree index for any of these fields (no prefix anchor), so a non-empty `search` forces a full collection scan across all three fields, bounded only by `maxTimeMS(8000)` and the eventual `.limit(limit)` applied to the *sorted* result — the scan itself is not bounded by the limit.
- **Confidence**: Medium — this is a well-known MongoDB performance characteristic, not something refuted by current evidence, but FoodKnock's current order volume (~800 orders per the Phase 16 comments) is almost certainly too small for this to matter in practice today. No production query timing is available to confirm actual impact.
- **Why not fixed this phase**: A real fix (text index, or restructuring search to anchor on a prefix) changes query semantics and needs validation against real search usage patterns and a production-scale (or at least representative) dataset — exactly the kind of "needs production metrics/traffic evidence" item the brief asks to document rather than guess at. The existing `maxTimeMS(8000)` cap already prevents a runaway query from hanging a serverless invocation indefinitely.
- **Recommendation for Phase 17.5 or later**: If/when order volume grows into the tens of thousands, consider either (a) a MongoDB text index with `$text` search (different relevance/matching semantics — needs product sign-off) or (b) requiring a minimum search prefix length and anchoring the regex (`^prefix`) when the UI allows it.

## Changes Implemented

| File | Function/Route | Change |
|---|---|---|
| `src/app/api/orders/route.ts` | `GET` | Added opt-in `fields=minimal` query param → slim `.select("customerName totalAmount createdAt")` projection (plus implicit `_id`). Default behavior unchanged. |
| `src/components/admin/orders/OrderTable.tsx` | 5s poll effect | Poll now requests `/api/orders?limit=200&fields=minimal` instead of the full projection. |
| `src/models/PushSubscription.ts` | schema definition | Removed redundant `index: true` on `isActive` (duplicate of the existing explicit `schema.index({isActive:1})`). |
| `src/lib/__tests__/integration/ordersRoute.integration.test.ts` (new) | — | 5 real integration tests against the actual `GET` handler: unauthenticated rejection, non-admin rejection, default-projection field shape, minimal-projection field shape, and same-ordering/same-count equivalence between the two modes. |

No business logic, authorization, pricing, stock, loyalty, or payment-integrity code was touched.

## Before/After

- **Admin poll payload shape** (measured from the new integration test's actual JSON response, against local test fixtures — not production traffic):
  - Before: each polled row included `orderId, customerName, phone, address, landmark, orderType, items, totalAmount, deliveryFee, platformFee, status, paymentMethod, razorpayOrderId, razorpayPaymentId, createdAt, isFirstDeliveryFreeApplied, note` (16 top-level keys, `items` itself an array of sub-objects).
  - After (minimal mode): `_id, customerName, totalAmount, createdAt` (4 keys, no arrays).
  - This is a structural/shape measurement, not a production latency or Vercel-CPU number — no such number is claimed.
- **Duplicate index warning**: present before the fix (observed directly in test output across all 5 integration suites run before the fix), absent after (re-ran the full matrix after the fix — confirmed gone).

## Route Coverage

**Actually executed via the real exported handler** (this phase, plus everything carried over from Phase 17.3):
- `GET /api/orders` (admin-only; new this phase) — unauthenticated, non-admin, default-projection, minimal-projection, and cross-mode-equivalence cases.
- `requireAdmin`/`requireUser` (Phase 17.3, re-verified unaffected this phase).
- `redeemPoints`/`awardPoints`/`handleOrderDelivered`/stale-claim resolution (Phase 17.3, re-verified unaffected).
- `claimPendingPayment`/`releaseClaim`/`waitForCompletion` (Phase 17.3, re-verified unaffected).
- `cancelOrder` (Phase 17.3, re-verified unaffected).

**Still code-review-only, not executed as real route handlers** (unchanged gap from Phase 17.3, not closed this phase): review submission/moderation routes, guest order tracking, admin broadcast idempotency, push-subscription bounds/authorization routes, admin loyalty inconsistency/repair routes, payment-reconciliation admin recover/dismiss routes, the cron authorization route. None of these were modified this phase, so none carry new unverified risk from this work — but their coverage gap is unchanged and still a legitimate target for a future pass.

## Regression Tests

```
MONGODB_URI="mongodb://127.0.0.1:27017/cafe_app" JWT_SECRET="test-only-secret-not-real" \
  npx tsx --test src/lib/__tests__/integration/ordersRoute.integration.test.ts
→ 5 tests, 5 pass, exit 0   (NEW this phase)

MONGODB_URI="mongodb://127.0.0.1:27017/cafe_app" \
  npx tsx --test src/lib/__tests__/integration/loyalty.integration.test.ts
→ 12 tests, 12 pass, exit 0

MONGODB_URI="mongodb://127.0.0.1:27017/cafe_app" \
  npx tsx --test src/lib/__tests__/integration/paymentReconciliation.integration.test.ts
→ 6 tests, 6 pass, exit 0

MONGODB_URI="mongodb://127.0.0.1:27017/cafe_app" JWT_SECRET="test-only-secret-not-real" \
  npx tsx --test src/lib/__tests__/integration/auth.integration.test.ts
→ 9 tests, 9 pass, exit 0

MONGODB_URI="mongodb://127.0.0.1:27017/cafe_app" JWT_SECRET="test-only-secret-not-real" \
  npx tsx --test src/lib/__tests__/integration/orderCancellation.integration.test.ts
→ 3 tests, 3 pass, exit 0

node --experimental-strip-types --test src/lib/__tests__/loyaltyLogic.test.ts \
  src/lib/__tests__/paymentReconciliationLogic.test.ts src/lib/__tests__/securityLogic.test.ts
→ 64 tests, 64 pass, exit 0
```

Total: 99/99 passing across all suites, each run in its own process per the
Phase 17.3-established isolation requirement (shared-process Mongoose state
across files causes cross-file interference, as documented previously).

## TypeScript, Lint, Build

- `npx tsc --noEmit` → clean, no errors, full project.
- `npx eslint` on all files changed this phase (`src/app/api/orders/route.ts`,
  `src/components/admin/orders/OrderTable.tsx`, `src/models/PushSubscription.ts`,
  the new test file) → see exact result captured in this phase's run (reported
  in the final delivery message with the live command output).
- `npm run build` (`next build --webpack`) → see exact exit code and route
  table captured in this phase's run (reported in the final delivery message).

## Business Invariants

No business-rule, pricing, stock, loyalty, payment, or authorization code was
changed this phase. The two changes made are:
1. An additive, opt-in response-projection mode on an already admin-gated,
   already-paginated read endpoint — verified by test to return the exact
   same set of orders, in the exact same order, as the existing default mode.
2. A schema-level index-declaration deduplication with no query-shape change
   — the compound `{user:1,isActive:1}` index and the standalone
   `{isActive:1}` index both still exist after the fix, just declared once
   instead of twice.

The admin-authorization gate on `GET /api/orders` (`requireAdmin()` —
re-verifying live DB role/isActive, not just the JWT claim) was independently
re-confirmed by this phase's new integration test, not weakened.

## Database/Index Status

- No production database write, index creation/deletion, or migration
  occurred this phase.
- `PushSubscription.isActive` duplicate index declaration fixed in source
  only. Whether the production MongoDB deployment currently has one or two
  physical indexes on `{isActive:1}` depends on its own index-sync history
  and was not checked (would require a production read against `getIndexes()`
  — out of scope without operational authorization). If a redundant index
  does exist there, this source fix prevents the duplicate from being
  re-declared/re-synced going forward; removing an already-existing
  duplicate physical index in production (if one exists) is a separate,
  explicitly-production-write operation requiring its own authorization,
  not performed here.
- Carried-over pending production prerequisites from Phase 17.2 (still not
  created/verified in production, unchanged by this phase):
  - `Review: {isApproved:1, createdAt:-1}`
  - `PushSubscription: {isActive:1}` (now a single, non-duplicated
    declaration in source as of this phase)
  - `LoyaltyLedger: user_order_type_unique` partial unique index — production
    verification still pending per Phase 17.2's report.

## Remaining Risks / Limitations

- No production traffic, Vercel CPU/latency metrics, or representative-scale
  dataset was available — every measurement in this report is a code-shape
  or local-test-fixture measurement, never a production number.
- The admin order-search regex (§3 above) remains a documented hypothesis,
  not a confirmed production bottleneck.
- Route-handler integration coverage for review moderation, guest tracking,
  broadcast idempotency, push-subscription bounds, loyalty-inconsistency
  repair, and payment-reconciliation admin actions remains code-review-only
  (unchanged gap, not widened).
- No client bundle-size or React-profiler analysis was performed — the
  existing toolchain has no bundle analyzer wired in, and adding one would
  itself be a new dependency, which the brief directs against absent proof
  of necessity. No evidence of a specific component rerender problem was
  found during code review of the high-traffic client components inspected
  (`CustomerShell.tsx`, `OrderTable.tsx`, `HeroCarousel.tsx`) — all observed
  `setInterval`/polling usages were already scoped, cleaned up on unmount,
  and (after this phase's fix) payload-appropriate.

## Next Recommendation

Proceed to **Phase 17.5** only for the specific, now-narrower set of open
items: (a) close the route-handler integration-coverage gap for the
remaining Phase 17.2 security-relevant endpoints listed above, and (b)
if/when real production traffic or order-volume data becomes available,
revisit the admin search regex hypothesis with actual `.explain()` evidence
before deciding whether a text index is warranted. A full performance
re-audit beyond that is not justified by current evidence — this phase's
investigation did not surface a second tier of unaddressed bottlenecks
behind the two fixed here.
