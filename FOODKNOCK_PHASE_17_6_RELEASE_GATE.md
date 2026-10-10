# FoodKnock — Phase 17.6 Final Release Gate

Date: 2026-10-10 (Phase 17.8 is the FINAL release-gate decision — read it first)

## PHASE 17.8 — FINAL RELEASE-GATE DECISION (this is the authoritative call)

## FINAL DECISION: **CONDITIONAL GO**

This is the final Phase 17 closure pass. No further Phase 17 sub-phase is
planned or should follow. This decision supersedes the Phase 17.7
addendum and the original Phase 17.6 text below, both kept underneath for
the historical record only.

### Why CONDITIONAL GO, stated plainly

**Code readiness: strong, evidence-backed, nothing hidden.**
- 177/177 tests pass across 18 files (69 pure-logic + 108 integration,
  including 5 that exercise a mocked-but-realistic Razorpay boundary —
  never a live call).
- `tsc` clean, lint clean on every changed file, `npm run build` exits 0.
- A critical, previously-invisible payment-recovery defect was found and
  fixed this engagement (`attemptRecovery()`'s success path was
  unreachable — see Final Status §A3/historical record). This was a real
  release blocker; it no longer is one.
- The one explicitly-tracked privacy item (guest-tracking PII exposure)
  was resolved via an actual architectural fix, not a mitigation — the
  public tracking endpoint no longer returns customer name/address/
  landmark at all, and no legitimate functionality was broken in the
  process (confirmed by both source inspection and tests).

**Why not a plain GO.** Thirteen items remain genuinely unverified — see
`FOODKNOCK_PHASE_17_FINAL_STATUS.md`'s §B5 table for the full list with
owners/reasons. In summary: four production index checks, kitchen-
coordinate/delivery configuration, deployed-build confirmation, cron
activation confirmation, production telemetry, production env-var
presence, backup/restore readiness, rollback-procedure readiness,
browser/responsive QA across the required viewport matrix, and the status
of a "270 historical Reorder items" reference that **could not be found
anywhere in this repository or this engagement's own history** (reported
as unverified/not-found, not as a confirmed 270, and not as zero).

None of these thirteen are code defects. All of them require either
production/Vercel/Atlas read access or a human browser-testing pass that
this engagement does not have the tools or credentials to perform. This
is a textbook CONDITIONAL GO: the code is ready, the operational
verification around it is not yet evidenced.

### Conditions, owners, and required actions (supersedes all earlier lists in this document)

| # | Condition | Owner | Required action |
|---|---|---|---|
| 1 | Production indexes (`Review`, `PushSubscription`, `LoyaltyLedger`, `PendingPayment`) | DB/infra owner with Atlas access | Read-only `getIndexes()` check against the real production collections; create any genuinely missing index via a separate, explicitly-authorized migration — never inferred or executed here |
| 2 | Kitchen coordinates / DeliverySettings | Operations/admin owner | Log into `/admin/delivery` in the live production app and confirm real coordinates are set |
| 3 | Deployed build matches repository | Release owner with Vercel access | Compare the Vercel dashboard's current production deployment's commit hash against this repository's current state |
| 4 | Cron jobs (hourly reconciliation, AM/PM push campaigns) actually active | Release owner with Vercel access | Check Vercel's Cron Jobs panel and recent execution logs |
| 5 | Production telemetry sanity check | On-call/SRE owner | Review Vercel Observability/Logs for error rate, latency, CPU duration on payment/loyalty/order/tracking routes, both before and shortly after this release |
| 6 | Production environment variables present | Release owner with Vercel access | Confirm presence (not value) of `MONGODB_URI`, `JWT_SECRET`, `CRON_SECRET`, Razorpay keys, VAPID/Firebase keys, SMTP config, etc. in the Vercel project settings |
| 7 | Backup/retention + tested restore | DB/infra owner with Atlas access | Confirm Atlas backup policy and retention window; perform at least one test restore into a non-production cluster |
| 8 | Rollback procedure known | Release owner | Confirm who has Vercel "promote previous deployment" authority and that they know the exact steps |
| 9 | Browser/responsive QA (360/390/412/768/1024/1280/1440px, full journey checklist) | QA owner | Execute the checklist in Final Status §B3, manually or via a separately-scoped browser-automation project |
| 10 | "270 historical Reorder items" | Whoever originally tracked this backlog (outside this repository) | Locate the original tracking source and provide a current count; this cannot be reconstructed from source code alone |

### What this decision does NOT authorize

No deployment, production write, index mutation, live payment/notification
call, secret rotation, or production cron trigger is authorized by this
report. This report is a readiness assessment, not an execution of any of
the above.

---

## Historical: Phase 17.7 addendum (superseded by the Phase 17.8 decision above, kept for the record)

## Updated Decision: **CONDITIONAL GO** (unchanged status, materially stronger evidence)

Two things changed since the 17.6 decision below:

1. **Guest tracking privacy — now a closed item, not an open one.** The
   17.6 decision below treated this as "acceptable to ship, pending
   explicit sign-off on an accepted residual risk." That is no longer the
   right framing: the actual redesign (repointing the two remaining push
   links to the already-ownership-checked `/my-orders/{orderId}`, and
   removing `customerName`/`address`/`landmark` from the public tracking
   endpoint entirely) has been implemented and tested. There is no longer
   a customer-privacy exposure to accept — it was fixed. See
   `FOODKNOCK_PHASE_17_FINAL_STATUS.md`'s §A1 for the full before/after.
2. **A critical payment-integrity defect was found and fixed**:
   `attemptRecovery()`'s success path was unreachable — every legitimate
   admin-triggered payment recovery would have failed with a mislabeled
   "currency mismatch" error, forever. This is now fixed and
   regression-tested (5 new tests, mocked-Razorpay-boundary, never a real
   provider call). See §A3 in the Final Status report for full detail.
   **This was a real release blocker that the 17.6 decision below did not
   know about** — it would not have been caught by any test suite that
   existed before this phase, because it required executing the actual
   classification branch, not a simulation of it.

### Why the decision is still CONDITIONAL GO, not GO

The remaining gate conditions are unchanged and are **all operational**,
not code: production index verification, kitchen-coordinate/delivery
configuration, Vercel cron activation confirmation, telemetry review, and
confirming the deployed build matches this repository. None of these can
be resolved without production/Vercel read access this engagement does
not have. Code readiness is now stronger than it was at the 17.6 decision
— a real, previously-invisible payment-recovery defect is fixed, and the
one named privacy item is closed rather than merely accepted — but the
operational blockers are identical in kind and count.

### Updated Pre-Deployment Actions (replaces the 17.6 list's item 6)

Items 1–5 from the original list below are unchanged. **Item 6 is now
DONE, not pending**: ~~"Get explicit sign-off on the guest-tracking
name/address exposure decision"~~ — superseded; there is no longer an
exposure to sign off on. No new action replaces it.

### One new item for the owner's attention (not a blocker, informational)

The admin Payment Reconciliation dashboard's "Recover" button has likely
never worked correctly in production (see §A3 in the Final Status
report) — if any payment was ever reported as "recovery failed —
currency mismatch" in production history, that message was almost
certainly wrong, and that payment may still be sitting in `pending_review`
needing a fresh look now that the underlying bug is fixed. This is
historical-data cleanup, not a pre-deployment blocker — flagging it so
the team knows to re-check any previously "failed" recovery attempts
rather than assuming they were genuine mismatches.

---

## Historical record below: Phase 17.6 decision text (unchanged, see addendum above for what has since changed)

## Decision: **CONDITIONAL GO**

Code readiness is strong and evidence-backed. Release is gated on a short,
specific list of **operational verifications** (not code work) that this
engagement could not perform without production/Vercel read access. None
of the open items are code defects; all are "someone with production
access needs to check/confirm X."

---

## Evidence for the Decision

### Code readiness: strong
- 149/149 tests pass (68 pure-logic + 81 real route/service integration),
  spanning payment reconciliation, loyalty integrity, order cancellation,
  admin authorization, review moderation, guest-tracking privacy, and
  broadcast idempotency — the full set of financial/security-critical
  flows identified across Phases 17.0–17.6.
- `npx tsc --noEmit`: clean.
- `npm run build`: exit 0, complete route table.
- Zero regressions found across three separate full-matrix re-runs in this
  engagement (Phase 17.4 end, Phase 17.5 end, this run).
- One additional security hardening (order-ID entropy) completed and
  tested this run, with no API contract change.

### Operational readiness: unverified, not unhealthy
No evidence of a problem exists — but no evidence of correctness in
production exists either, because this engagement never had production or
Vercel dashboard access. "Unverified" is reported honestly rather than
inferred as either good or bad.

---

## Code-Readiness Checklist

| Item | Status | Evidence |
|---|---|---|
| Payment reconciliation claim/retry logic | ✅ Verified | `paymentReconciliation.integration.test.ts` 6/6, `paymentReconciliationAdmin.integration.test.ts` 10/10, `paymentReconciliationCron.integration.test.ts` 3/3 |
| Loyalty atomicity, order-linked claims, repair routes | ✅ Verified | `loyalty.integration.test.ts` 12/12, `loyaltyInconsistencies.integration.test.ts` 10/10 |
| Order cancellation (stock + loyalty reversal, incl. concurrent duplicate) | ✅ Verified | `orderCancellation.integration.test.ts` 3/3 |
| Admin authorization (live DB re-check) | ✅ Verified | Exercised independently in 6 different route suites, zero exceptions |
| Order ownership (IDOR) | ✅ Verified | `auth.integration.test.ts` |
| Review moderation (never auto-published) | ✅ Verified | `reviews.integration.test.ts` 10/10 |
| Guest tracking: phone masking + rate limit | ✅ Verified | `trackOrder.integration.test.ts` 6/6 |
| Guest tracking: order-ID brute-force resistance | ✅ Hardened this run | `orderIdEntropy.test.ts` 4/4 |
| Admin broadcast idempotency (actual guarantee, not assumed) | ✅ Verified | `broadcastIdempotency.integration.test.ts` 7/7 |
| Minimal orders projection (Phase 17.4) backward compatibility | ✅ Verified | `ordersRoute.integration.test.ts` 5/5 |
| Duplicate PushSubscription index removed | ✅ Verified | Zero Mongoose duplicate-index warnings across 81 integration tests |
| TypeScript | ✅ Clean | `tsc --noEmit` |
| Lint (changed files) | ✅ Clean | 0 problems |
| Production build | ✅ Passes | exit 0 |

## Production-Readiness Checklist

| Item | Status | What's needed |
|---|---|---|
| Deployed production version known/verified | ❌ Unverified | Check Vercel deployment dashboard for the currently-live commit/build |
| `Review` index present in production | ❌ Unverified | Read-only `getIndexes()` against production `Review` collection |
| `PushSubscription` index present (single, non-duplicated) | ❌ Unverified | Same — also worth confirming no stale duplicate physical index survives from before the Phase 17.4 source fix |
| `LoyaltyLedger` partial unique index present with correct spec | ❌ Unverified | Same — verify `partialFilterExpression` matches exactly |
| `PendingPayment.expiresAt` TTL index present and active | ❌ Unverified | Same |
| Vercel cron jobs active and matching schedule | ⚠️ Partially evidenced | `vercel.json` in the repo declares the correct schedules (hourly reconciliation, two daily campaign slots) — this is the deployment config file, stronger than nothing, but a Vercel dashboard check is still needed to confirm the *live* project is actually running this file's config |
| Kitchen coordinates / delivery settings configured | ❌ Unverified | An admin must check `/admin/delivery` in the live production app |
| Production telemetry (error rate, latency, CPU, timeouts) | ❌ Unverified | Vercel Observability / Logs review |
| Required secrets present in production (`MONGODB_URI`, `JWT_SECRET`, `CRON_SECRET`, Razorpay keys, VAPID/Firebase keys, etc.) | ❌ Unverified (presence-check logic in code confirmed fail-closed; actual production values never inspected, never printed) | Confirm each is set in the Vercel project's environment variables |

## Index / Configuration / Cron Verification Matrix

| Index/Config | Source declared | Local test DB | Staging | Production (authorized read-only) | Status |
|---|---|---|---|---|---|
| `Review {isApproved:1,createdAt:-1}` | Yes | Yes (auto-built by Mongoose on connect) | N/A — none exists | Not checked | **Unknown** |
| `PushSubscription {isActive:1}` | Yes (single declaration) | Yes | N/A | Not checked | **Unknown** |
| `PushSubscription {user:1,isActive:1}` (compound, pre-existing) | Yes | Yes | N/A | Not checked | **Unknown** |
| `LoyaltyLedger user_order_type_unique` | Yes, exact spec confirmed | Yes | N/A | Not checked | **Unknown** |
| `PendingPayment {expiresAt:1}` TTL | Yes | Yes | N/A | Not checked | **Unknown** |
| Hourly reconciliation cron | Yes (`vercel.json`) | N/A (tested as a handler, not as a scheduled trigger) | N/A | Not checked | **Declared in repo config; live activation unknown** |
| Push-campaign cron (AM/PM) | Yes (`vercel.json`) | N/A | N/A | Not checked | **Declared in repo config; live activation unknown** |

**None of the above is reported as "complete."** A source declaration plus
a local test database building the index automatically is real, useful
evidence that the *intended* specification is correct — it is not evidence
that production's actual index set matches.

## Guest Tracking Privacy Conclusion

- **Order-ID guessability**: resolved this run. Search space increased from
  9,000 to ~2.8 trillion possibilities, with no API or UI contract change.
  This was the one part of the risk fixable without a product decision.
- **Name/address exposure to holders of a valid orderId**: remains an
  **accepted, explicitly documented residual risk**, not a defect. The
  current self-service tracking feature requires showing this information
  to the legitimate customer, and no second-factor design has been
  approved that preserves the existing push-notification deep-link flow.
  **This does not block release** — it is unchanged from the already-
  shipped Phase 17.2 behavior, now with materially reduced brute-force
  exposure. It should be explicitly acknowledged by a product/security
  decision-maker as an accepted risk (or scheduled for a future
  signed-token redesign), not silently carried forward indefinitely without
  anyone having actually decided to accept it.

## Monitoring and Rollback Readiness

- **Rollback**: all changes this run are additive/backward-compatible
  (stronger order-ID entropy, one comment update, one placeholder string).
  There is no schema migration, no index creation, and no API contract
  change in this run's deliverable — a rollback, if ever needed, is a
  standard Vercel deployment rollback with no data-migration reversal
  required.
- **Monitoring**: not established or reviewed by this engagement. Before
  relying on this release, confirm Vercel's error/latency dashboards and
  any existing alerting cover at minimum: payment verification failures,
  reconciliation cron failures, and 5xx rates on the admin and guest-
  tracking endpoints touched across Phases 17.2–17.6.

## Pre-Deployment Actions, In Priority Order

1. Confirm the three pending indexes (`Review`, `PushSubscription`,
   `LoyaltyLedger`) exist in production with the exact declared
   specifications; create any missing ones only via an explicitly
   authorized, reviewed migration (preflight/duplicate-check plans already
   documented in the Phase 17.5 report — not re-executed here).
2. Confirm the `PendingPayment.expiresAt` TTL index exists and is active in
   production.
3. Confirm kitchen coordinates and delivery/serviceability settings are
   correctly configured in the live `/admin/delivery`.
4. Confirm the Vercel project's actual deployed commit/build matches this
   repository's `main`/working state, and that its cron jobs are active and
   match `vercel.json`.
5. Do a basic telemetry sanity check (error rate, latency, CPU duration) on
   the payment, loyalty, order, and guest-tracking endpoints before and
   immediately after deployment.
6. Get explicit sign-off on the guest-tracking name/address exposure
   decision (accept as-is, or schedule a signed-token redesign).

## Actions That Must NOT Be Performed Without Explicit Separate Authorization

- Creating, dropping, or rebuilding any production index.
- Any production data migration or ledger/balance correction.
- Modifying live `DeliverySettings` or kitchen coordinates.
- Rotating or changing any production secret.
- Triggering a manual production cron run.
- Making a real Razorpay transaction/refund or a real customer-facing
  notification send for testing purposes.
- Committing, pushing, merging, or deploying — none of which occurred in
  this engagement, and none of which this report authorizes.

## Final Answer to the Required Questions

- **Is the current codebase locally test-ready?** Yes — 149/149 tests,
  clean `tsc`, clean build.
- **Is the deployed production version known and verified?** No —
  unverified, requires a Vercel dashboard check.
- **Are required production indexes verified?** No — unverified for all
  four (`Review`, `PushSubscription`, `LoyaltyLedger`, `PendingPayment`).
- **Is the deployed cron active?** Partially evidenced (declared correctly
  in `vercel.json`) but not confirmed live.
- **Are delivery/serviceability settings verified?** No — unverified.
- **Is guest tracking privacy acceptable?** Materially improved this run
  (order-ID entropy) and acceptable to ship as-is for the remaining,
  already-documented residual risk, pending explicit sign-off rather than
  silent acceptance.
- **Is production telemetry sufficient?** Unknown — not reviewed, no
  access.
- **What is the rollback/incident response plan?** Standard deployment
  rollback suffices; no migration reversal needed for this run's changes.
  No broader incident-response plan was reviewed or established by this
  engagement.
- **What exact blockers remain?** The six pre-deployment actions listed
  above — all operational/configuration verification, zero code work.
- **What must happen before deployment?** Items 1–4 above, at minimum,
  before a confident GO; item 6 should happen regardless of deployment
  timing so the residual risk is a decided one, not an assumed one.

No deployment was performed as part of this phase.
