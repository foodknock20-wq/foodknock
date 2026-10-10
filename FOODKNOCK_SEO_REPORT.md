# FoodKnock — SEO & Digital Discoverability Implementation Report

Date: 2026-10-10 (Phase 3 is the final completion pass — read it first)

## PHASE 3 — FINAL SEO COMPLETION

### A. What Was Already Correct and Preserved

Every Phase 1 and Phase 2 claim was re-verified against current source before any new change — all confirmed intact: homepage `<h1>`, `Organization`/`WebSite`/`Product`/`BreadcrumbList`/`FAQPage` JSON-LD, the sitemap additions (`/founders`, `/faq`, `/review-rewards`), the `/checkout` and `/account` noindex directives, and the FAQ page's delivery-area answer. Nothing from either prior phase was reverted, weakened, or redone from scratch.

### B. Changes Implemented This Phase

| File | Change | Reason |
|---|---|---|
| `src/app/(main)/terms/page.tsx` | "Payments, Charges & Refunds" section rewritten: now states FoodKnock accepts **both** Cash on Delivery and online payments (was "online payments only"), and adds a COD-specific refund clause ("no refund applicable — no payment was collected in advance"). The online-payment refund-timeline sentence (5–7 business days) was left **unchanged** — this codebase has no automated Razorpay refund integration (`orderCancellation.ts`'s own comment: "Does NOT call any Razorpay refund API — none exists"), so that specific commitment describes a manual/operational process this task cannot verify true or false from code, and was not guessed at in either direction. | `checkout/page.tsx`'s own `PaymentMethod` type (`"razorpay" \| "cod"`) and a real, selectable COD toggle in the live UI directly contradicted the old claim. |
| `src/app/(main)/terms/page.tsx` | Hero chips updated: "Online payments only" → "COD & online payments"; "30–45 min delivery" → "Distance-based delivery fee"; "Support via email" → "WhatsApp & email support". | No fixed delivery-time guarantee exists anywhere in `DeliverySettings.ts`/`serviceability.ts` (only distance-based fee slabs do); `/contact`'s real `CHANNELS` array lists WhatsApp first, badged "Fastest." |
| `src/app/(main)/terms/page.tsx` | "Communication" section's claim "We do not use WhatsApp or phone calls as primary customer service channels" removed and replaced with an accurate statement, cross-linking to the real Contact page. | **A second, independently-discovered contradiction** — the Contact page's own `CHANNELS` array lists WhatsApp first (badged "Fastest," described as "The fastest way to reach us") and phone second (badged "Direct") — both unambiguously primary, real channels, not a fallback as the old Terms text claimed. |
| `src/app/sitemap.ts` | Removed the `/track-order` entry. | **A real, previously-undetected sitemap/robots inconsistency**, caught by writing this phase's new invariant tests: `src/app/(main)/track-order/layout.tsx` sets `robots:{index:false,follow:false}` (cascading to `/track-order/[orderId]` too) — yet `/track-order` was still listed in the sitemap as an indexable URL, directly contradicting its own noindex directive. Exactly the same class of bug `/cart` was already fixed for (Phase 17.2, F18) — this one had simply never been caught until now. |
| `src/lib/__tests__/structuredDataInvariants.test.ts` (new) | 13 file-content regression tests (same pattern as the pre-existing `securityLogic.test.ts`): no fabricated geo/hours/ratings/awards ever reappear in `layout.tsx`'s JSON-LD; `Organization`'s founder names match `foundersData.ts` exactly; product-page JSON-LD derives from real fields only; the sitemap lists the right pages and never a noindexed one; checkout/account declare noindex; the Terms page never claims "online payments only" or a fixed delivery-time window. | Directly fulfills this phase's explicit instruction to "add automated tests for important schema invariants" — and these tests are what caught the `/track-order` and WhatsApp-communication bugs above, not a separate manual audit pass. |

No other file was changed. No product/category page needed further changes — Phase 1's `Product`/`BreadcrumbList` JSON-LD and existing `generateMetadata()` were re-verified sufficient.

### C. Technical SEO Checklist

| Item | Status | Evidence |
|---|---|---|
| Canonical URLs consistent (`https://www.foodknock.com`) | **PASS** | Every page's `alternates.canonical` and `sitemap.ts`'s `BASE_URL` match; re-verified unchanged. |
| Title/description/robots/OG/Twitter/`metadataBase` | **PASS** | `src/app/layout.tsx` unchanged from Phase 1, re-verified correct. |
| HTML `lang` attribute | **PASS** | `<html lang="en">` in `layout.tsx`, unchanged. |
| Sitemap accuracy (no noindexed route listed) | **PASS (fixed this phase)** | `/track-order` removed; now covered by an automated regression test. |
| Robots.txt | **PASS** | `src/app/robots.ts` unchanged — disallows `/admin/`, `/api/`, `/order-success/`; no accidental blanket block. |
| Redirects / trailing-slash / `www` consistency | **PARTIAL — BLOCKED (not a code issue)** | No `redirects()` or `trailingSlash` override exists in `next.config.ts` (Next.js defaults apply, which is consistent and fine). Whether `foodknock.com` (no `www`) redirects to the canonical `www.foodknock.com` is a **Vercel domain-level setting**, not something configurable in this repository's code — this task has no Vercel dashboard access to verify it. Flagged as an owner check in §F/§G, not claimed as done. |
| Product/category page metadata, canonical, structured data | **PASS** | Re-verified from Phase 1, unchanged. |
| Private/transactional route noindex (`cart`, `checkout`, `account`, `my-orders`, `track-order`, `order-success`, `admin`, `api`) | **PASS** | All seven confirmed noindexed or disallowed; `/track-order`'s sitemap listing (the one inconsistency) fixed this phase. |
| No broken internal links / orphan pages | **PASS (spot-checked)** | Footer links to `/privacy`, `/terms`, `/founders`, `/faq` all resolve to real, existing routes; `/faq` cross-links to `/contact`. Not exhaustively crawled (no crawler tool available) — see §I. |
| Image alt text | **PASS (unchanged from Phase 1)** | Product JSON-LD and OG tags use real `product.image`/`alt`; not re-audited pixel-by-pixel this phase — no new image-handling code was touched. |
| Mobile rendering / Core Web Vitals | **NOT MEASURED** | No real production traffic or Lighthouse/CrUX data available to this task — not claimed. |

### D. Product/Category SEO and Structured-Data Findings

No new findings — Phase 1's implementation (per-product `Product`/`BreadcrumbList` JSON-LD, conditional `aggregateRating`, real `availability` derived from `isAvailable`/`stock`) was re-verified against current source and is unchanged. This phase added **automated regression coverage** for those exact invariants (§B), closing the gap between "implemented once" and "guaranteed not to silently regress."

### E. Content Pages Created or Improved

No new content pages were created this phase (Phase 1 already added `/faq`; Phase 2 refined its delivery-area answer). This phase's content work was **policy-accuracy correction**, not new pages — see §B for the exact Terms page changes. The content roadmap from Phase 2 (§E of that section) remains a roadmap, not implemented — still correctly scoped as separate future work, per this phase's own instruction not to mass-produce content.

### F. Search Console Findings

- **What was verified**: `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` is present in the local `.env.local` (checked for presence only — the value was never read, printed, or logged). This is consistent with the owner having set up Search Console verification previously, matching this task's instruction to treat the property as already-existing, not to be recreated.
- **Whether the same value is set in the actual Vercel production environment**: **unverified** — this task has no Vercel dashboard/environment-variables access.
- **Whether sitemap resubmission is necessary**: Based on the evidence available (canonical URLs unchanged, sitemap structurally the same shape, three new legitimate pages added across Phase 1/this phase, one incorrect entry removed this phase), **a fresh crawl of the existing sitemap URL is reasonable but not urgent** — Google Search Console automatically re-fetches a previously-submitted sitemap periodically without requiring manual resubmission for routine additions/removals. Manual resubmission (via the existing Search Console property → Sitemaps → re-enter the same `https://www.foodknock.com/sitemap.xml` URL) can speed up discovery of the three newly-added pages (`/founders`, `/faq`, `/review-rewards`) but is not described here as *required* — that would overstate what's actually necessary.
- **What still requires owner access**: logging into the existing Search Console property to (a) confirm the sitemap shows 0 errors post-deployment, (b) spot-check that `/faq`, `/founders`, `/review-rewards` get crawled/indexed within a reasonable window, (c) confirm the `www` vs non-`www` domain redirect is configured correctly at the Vercel/DNS level (not visible from this repository).

### G. Exact Remaining Owner Actions

**Required for website SEO (no kitchen-location dependency):**
1. Confirm `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` is also set in Vercel's production environment variables (this task confirmed local presence only).
2. Confirm the `www.foodknock.com` ↔ `foodknock.com` redirect is configured at the Vercel domain level.
3. Re-check the existing Search Console property's Sitemaps report after this deployment ships, and optionally re-submit the same sitemap URL to accelerate discovery of `/faq`, `/founders`, `/review-rewards`.
4. Decide whether the online-payment refund-timeline commitment ("5–7 business days," left unchanged this phase — see §B) is actually an accurate, honored operational promise, since no automated code enforces it.

**Required only after the real kitchen location is configured** (explicitly deferred by the owner, per this task's §9 — not attempted):
1. Enter real kitchen `latitude`/`longitude` in `/admin/delivery`.
2. Confirm the actual current `maxRadiusKm` admin setting (this task only confirmed the schema *default* of 15, matching the business's stated figure — not necessarily the live, currently-configured value).
3. Once coordinates and radius are confirmed, re-add `geo`/`openingHoursSpecification` to `src/app/layout.tsx`'s JSON-LD (the exact fields and removal rationale are documented in that file's own code comment) — only if real operating hours are also confirmed at that time.
4. Set up or correct the Google Business Profile (name, category, address/service-area, hours, phone, photos) — explicitly deferred, not started, per this task's instructions.
5. Revisit the Phase 2 geographic-candidate table (`FOODKNOCK_SEO_REPORT.md`, Phase 2 §B) once real coordinates allow actual distance verification — only then would any dedicated nearby-area page have a factual basis.

**Optional future improvements:**
1. Write the content-roadmap articles from Phase 2 §E (one at a time, with real input, not mass-produced).
2. Consider a custom `not-found.tsx` (Next.js's default 404 already returns a correct HTTP 404 status — this is a UX/branding nicety, not a correctness issue).
3. Periodically re-run `structuredDataInvariants.test.ts` after any future content/schema change — it's now part of the regular test suite.

### H. Test Results

```
Pure-logic tests (node --experimental-strip-types --test):
  89/89 passing (was 76 before this phase; +13 new structured-data/
  policy-consistency regression tests)

Integration tests (npx tsx --test, one process per file, 14 suites):
  108/108 passing — re-run in full this phase, zero regression from the
  Terms-page/sitemap/test changes (none of which touch server-side/API
  code)

npx tsc --noEmit        → clean
npx eslint <every file this phase changed>  → 0 problems, exit 0
npm run build (next build --webpack) → exit 0, full route table confirmed,
  /track-order's removal from the sitemap does not affect its own page
  route (still builds and serves normally — only the sitemap LISTING was
  removed, not the page)
```

Browser verification was not performed — unchanged limitation from Phase 1/2, no browser automation tooling exists in this repository.

### I. What Was NOT Performed

- No live Google Search Console check (no account access) — only local `.env.local` presence was checked.
- No live Google Rich Results Test or Schema.org validator run against a deployed URL (none exists for this task to query).
- No Google Business Profile creation, edit, or verification — explicitly deferred by the owner, correctly not attempted.
- No kitchen-coordinate or operating-hours configuration — explicitly deferred, correctly not attempted (no values invented).
- No new content pages — the roadmap remains a roadmap, not a deliverable this phase.
- No deployment, commit, push, or merge — all changes remain in the working tree only, per this task's explicit authorization boundary.
- No exhaustive internal-link crawl — only the specific links this phase's changes touch were spot-checked; no link-checker tool was run against the full site.
- No Core Web Vitals or real-traffic performance measurement — no data source available.

### J. Final Status

- **WEBSITE SEO IMPLEMENTATION: PARTIAL** — every safely-implementable, evidence-backed code change identified across three phases is complete (structured data, metadata, sitemap accuracy, indexing boundaries, policy-text accuracy, and now automated regression coverage for all of it). What remains incomplete is explicitly owner-gated (kitchen location, Google Business Profile, live Search Console checks) or intentionally deferred (new content articles) — not abandoned or overlooked.
- **SEARCH CONSOLE LIVE VERIFICATION: NOT AVAILABLE** — only local environment-variable presence was checked; no live property data was inspected.
- **LOCATION-DEPENDENT SEO: DEFERRED BY OWNER** — kitchen coordinates, real operating hours, and Google Business Profile setup are explicitly out of scope for this phase per the task's own instruction, and nothing was guessed in their place.
- **PRODUCTION DEPLOYMENT: NOT PERFORMED** — all changes exist only in the local working tree; git status confirmed unchanged in line count (315 → 315) before and after this phase, nothing staged, committed, pushed, or deployed.

---

## PHASE 2 — LOCAL DOMINATION + NATIONAL DISCOVERABILITY

### Final Status (Phase 2)

**Partially complete; owner action required.** Phase 1's claims were
re-verified against current source and all held up (nothing had
regressed). This phase's main findings: the business's own stated
"~15 km" delivery radius is **not a guess — it is the real, literal
default value** in `src/models/DeliverySettings.ts`
(`serviceability.maxRadiusKm: {default: 15}`), confirming the task's
verified business context against actual code. However, the *kitchen's*
coordinates remain unconfigured (`latitude`/`longitude` default `null`,
re-confirmed unchanged from Phase 1), which means no distance from the
kitchen to any named nearby village can be computed from this codebase —
geographic research below is sourced externally (web search), not from
the app, and is explicitly unverified for actual FoodKnock serviceability.
No new location landing pages were created, consistent with the explicit
instruction not to guess delivery areas.

### A. Current-State Audit (Phase 2)

Re-verified every Phase 1 claim against current source — all confirmed still accurate, nothing regressed:
- Homepage `<h1>` present (`src/app/(main)/page.tsx`).
- `Organization`/`WebSite` JSON-LD present in `src/app/layout.tsx`; fabricated `geo`/`openingHoursSpecification` remain removed.
- `Product`/`BreadcrumbList` JSON-LD present on `src/app/(main)/menu/[slug]/page.tsx`.
- `/faq` page and `FAQPage` JSON-LD present.
- `sitemap.ts` still lists `/founders`, `/faq`, `/review-rewards`.
- `/review-rewards` layout/metadata present.
- `/checkout` and `/account` noindex directives present.

New findings this phase:
- `src/models/DeliverySettings.ts`: `serviceability.maxRadiusKm` defaults to **15** — this is the literal number the task's business context stated, confirmed as a real, already-coded value, not invented for this report. **This is the schema DEFAULT, not a confirmed live-production value** — whether an admin has since changed it via `/admin/delivery` is unverified without a production DB read.
- `kitchen.latitude`/`kitchen.longitude` remain `null` by design (unchanged from Phase 1's finding, re-confirmed). Distance-based fee slabs exist (`distanceRules`, 0–3/3–5/5–8/8–12/12–15 km bands with increasing fees) and are real, admin-editable, already-live business logic — not touched by this task.
- `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` is present in the local `.env.local` (checked for presence only, value never read or printed) — meaning Search Console verification was likely set up by someone, at least locally. Whether this same value is set in the actual deployed Vercel environment is unverified — this task has no Vercel dashboard access.
- The Terms page's "Online payments only" / "30–45 min delivery" chips (flagged in Phase 1) are **still present, unchanged**, re-confirmed via direct grep. Not modified this phase either — see §I.

### B. Local Delivery-Area Map

**Geographic research method**: a single web search was run (`"Danta Sikar Rajasthan nearby villages towns within 15 km"`) since this environment has no access to the application's own geocoding/distance logic for real coordinates (none are configured) and no Google Maps/Places API access. Results came from Wikipedia and a village-directory aggregator (villageinfo.in) — genuine, real-world place names, but **not independently distance-verified against FoodKnock's actual kitchen location**, because that location's coordinates are not configured in this codebase.

| Candidate area | Relationship to Danta | Evidence / source | Confirmed by business? | Dedicated page justified? | Owner verification required |
|---|---|---|---|---|---|
| Danta Ramgarh (tehsil) | Danta is itself a village within this tehsil — this is almost certainly why the real business address contains "Ramgarh" (Ramgarh Bas Stand Circle), resolving Phase 1's open question about that name | Wikipedia: "Danta Ramgarh" | Implicitly yes — it's the same administrative area as the kitchen's own real address | No — same area as the homepage already targets, a separate page would be redundant | None — already consistent with existing verified address |
| Shyampura | Listed as a nearby village of Danta | Village-directory aggregation of Wikipedia/census data | No | No | Confirm actual distance from the real kitchen coordinate (once configured) and real serviceability |
| Pachar | Listed as a nearby village of Danta | Same source | No | No | Same as above |
| Kushalpura | Listed as a nearby village of Danta | Same source | No | No | Same as above |
| Hanuman Nagar | Listed as a nearby village of Danta | Same source | No | No | Same as above |
| Shyam Nagar | Listed as a nearby village of Danta | Same source | No | No | Same as above |
| Ramgarh Bay | Listed as a nearby village of Danta | Same source | No | No | Same as above |
| Sevli | Listed as a nearby village of Danta | Same source | No | No | Same as above |
| Guwariya | Listed as a nearby village of Danta | Same source | No | No | Same as above |
| Paniharwas | Listed as a nearby village of Danta | Same source | No | No | Same as above |
| Ramnagar | Listed as a nearby village of Danta | Same source | No | No | Same as above |
| Dantla, Rajasthan | A **distinct, separate place** from Danta (has its own Wikipedia page) — explicitly NOT the same location; flagged here only to prevent future confusion between "Danta" and "Dantla" | Wikipedia | No — and should not be conflated with Danta | No | Confirm this is not accidentally referenced anywhere as if it were Danta (checked: it is not, in this codebase) |
| "Kishangarh Renwal" (~15km, per the search summary) | Low confidence — this name is widely associated with a different, more distant tehsil in Rajasthan; the search result's "~15km" claim was not corroborated by a second source | Single aggregated search result, not cross-checked | No | No | Do not treat as confirmed without independent geographic verification — flagged as low-confidence, not used anywhere in this implementation |

**No locality from this table was added to any page, sitemap entry, metadata, or structured data.** This is a research table for the business owner's use, not a set of claims this implementation made. Per the task's own instruction, a dedicated location page requires the area to be genuinely serviceable (confirmed by the business) — none of the above meet that bar from this task's available evidence.

**What was implemented instead** (the one safe, code-consistent change): the FAQ page's "Where does FoodKnock deliver?" answer (`src/app/(main)/faq/page.tsx`) was updated to mention that delivery fees scale with distance from the kitchen and that availability depends on real serviceability — using the real, already-live `distanceRules` concept, without stating a specific "15 km" number (since that figure is a schema default, not a confirmed current production value) and without naming any unconfirmed village.

### C. Keyword-to-Page Map (Phase 2 additions)

| Query theme | Page | Status |
|---|---|---|
| "FoodKnock delivery radius", "how far does FoodKnock deliver" | `/faq` | Updated this phase — answers honestly without a specific unverified number. |
| Named nearby villages (Shyampura, Pachar, etc.) | *(none — no page created)* | Explicitly not targeted this phase; see §B and §I. |
| "Danta Ramgarh food delivery" | `/` and `/menu` (existing) | Already covered — "Danta Ramgarh" is the same administrative area as the existing address, not a separate target. |
| Everything from Phase 1's keyword map | Unchanged | Re-verified still accurate (§A). |

### D. Implementation Log (Phase 2)

| File | Change | Why |
|---|---|---|
| `src/app/(main)/faq/page.tsx` | Updated the "Where does FoodKnock deliver?" answer to mention distance-based fees and real serviceability checking | Reflects the real `distanceRules` business logic honestly, without naming unverified villages or a possibly-stale radius number. |

No other code file was changed this phase — every other Phase 1 claim was re-verified, not re-implemented, per the instruction not to blindly redo Phase 1.

### E. Content Roadmap (prioritized, not yet written)

| Proposed article | Search intent | Audience | URL | Unique info it should provide | Facts needing owner verification |
|---|---|---|---|---|---|
| "Ordering Vegetarian Food Online in Danta: A Practical Guide" | Informational, local | Danta/Sikar residents new to ordering online | `/guides/ordering-vegetarian-food-danta` (or similar) | How FoodKnock's ordering flow actually works end to end (location → menu → cart → checkout → tracking), written from the real app flow | None required beyond what's already verified — can be written entirely from existing, confirmed app behavior |
| "FoodKnock's Menu Categories, Explained" | Informational + navigational | Prospective customers browsing | `/guides/menu-categories` | A real walkthrough of the actual current category list (pulled from the live catalog at write time) | Should be regenerated/reviewed whenever categories materially change — not a one-time static page |
| "How FoodKnock's Delivery & Serviceability Check Works" | Informational, trust-building | Customers unsure if they're covered | `/guides/delivery-and-serviceability` | Honest explanation of the location-confirm → serviceability-check flow, distance-based fee concept, and that coverage is checked per-address, not by locality name | Real kitchen coordinates / confirmed radius, if the business wants to state a specific number publicly |
| "FoodKnock's Story: A Vegetarian Cloud Kitchen in Danta" | Brand/national | People researching the brand | Could extend `/founders` rather than a new URL | Already substantially covered by the existing founders page content — a genuinely new article would need NEW verified facts (milestones, timeline) the owner would need to supply | Any specific dates, milestones, or growth facts not already in `founderData.ts` |

**None of these were written this phase.** Per the task's own instruction ("implement a small number of genuinely useful pieces rather than mass-producing"), and given this phase's actual time was spent on verification + the one real content fix (§D), drafting a full article is correctly scoped as its own follow-up task with the owner's input on tone/length/publishing cadence, not rushed here.

### F. External-Action Checklist (Phase 2 additions — see Phase 1's §E for the original list, still outstanding)

1. **Confirm the actual current `maxRadiusKm` value in production** (admin can check `/admin/delivery` directly) — this report found the schema *default* (15 km, matching the task's stated business context) but cannot confirm whether that default has since been overridden in the live database.
2. **Confirm `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` is also set in the Vercel production environment**, not only in local `.env.local` — this task could only check local presence.
3. **Geographic research table (§B)** — have someone with real local knowledge (or a Google Maps/Places lookup once kitchen coordinates are configured) confirm or reject each candidate village before any of them are used anywhere on the site.
4. **Terms page wording** (carried over from Phase 1, still unresolved) — "Online payments only" appears inconsistent with COD being a real, extensively-used payment method elsewhere in the app; "30–45 min delivery" is a specific time guarantee with no supporting configuration found anywhere in this codebase. This task did not change this legal-copy text — see §I.
5. Everything listed in Phase 1's §E (Google Business Profile, Search Console submission, real photographs, external listing consistency) remains outstanding — not re-litigated here.

### G. Validation Results (Phase 2)

```
npx tsc --noEmit                 → clean
npx eslint src/app/(main)/faq/page.tsx → 0 problems, exit 0
npm run build (next build --webpack) → exit 0, full route table confirmed
node --experimental-strip-types --test <all 5 pure-logic files> → 76/76 pass
```
Integration suites were not re-run this phase — no server-side/API code was touched (the only change was a client-rendered FAQ answer string). Browser verification was not performed — no browser automation tooling exists in this repository (unchanged from Phase 1).

### H. Measurement Plan

No analytics/Search Console access exists for this task, so no baseline numbers are reported — stating any would be invented. Once Search Console access is confirmed (§F item 2), track at minimum: impressions/clicks for "Danta" + "Sikar" + "vegetarian food" query clusters, `/faq` and `/founders` page impressions (newly sitemapped this engagement), and whether any of the §B candidate villages appear as real user search queries in Search Console's own data — that would be the actual, evidence-based signal for whether a future dedicated page for one of them is justified, rather than guessing from this task's external web search alone.

### I. Remaining Risks (Phase 2)

- The §B geographic candidate list came from a single external web search, not a authoritative government/postal source or the application's own (currently unconfigured) geocoding — treat every entry as a lead to verify, not a fact.
- The real production `maxRadiusKm` value is unconfirmed (§A/§F item 1).
- The Terms page inconsistency (§A, carried from Phase 1) remains unresolved — this task deliberately did not silently rewrite legal/policy text, per its own instruction, and no owner approval was obtained in this pass to change it.
- No new content from §E was published — it's a roadmap, not a completed deliverable.

### J. Final Status (Phase 2, one-line)

**Partially complete; owner action required.** Phase 1's work was fully re-verified intact. This phase's one code change (the FAQ delivery-radius answer) is complete and locally verified. The local geographic research is informational/owner-facing only — correctly not acted upon further without business confirmation, per the task's own explicit caution against guessing delivery areas.

---

## PHASE 1 REPORT (below, unchanged except for this pointer)

## Final Status

**Implemented, locally verified, not yet externally measured.** FoodKnock's
existing SEO foundation was already substantially more mature than a
typical audit assumes — a real, non-trivial Metadata API setup, a working
sitemap/robots implementation, per-product dynamic metadata, and a genuine
founders page with real content already existed before this task. This
pass closed the real gaps found (missing structured data, a missing H1, a
factually-unsupported JSON-LD claim, missing sitemap entries, missing
indexing-boundary directives on two transactional routes, no FAQ page) and
corrected one issue that was a correctness problem, not just an SEO one
(fabricated geo-coordinates in structured data). No ranking, indexing, or
Google Business Profile claim is made — none of that is verifiable without
external account access, which this task did not have.

---

## A. Audit Results

### Route inventory (public-facing routes under `src/app/(main)`)

| Route | Classification | Notes |
|---|---|---|
| `/` | Public, indexable | Had no `<h1>` at all — fixed (§B). |
| `/menu` | Public, indexable | Already has metadata, canonical, query-param filtering correctly consolidated to one canonical URL. |
| `/menu/[slug]` | Public, indexable | Already has `generateMetadata()` (title/OG/Twitter/canonical). Had **no structured data** — fixed (§B). |
| `/founders` | Public, indexable | Already has real metadata and real content (`src/lib/foundersData.ts`). Was **missing from the sitemap** and had no Person/structured data — partially fixed (§B). |
| `/contact` | Public, indexable | Already has metadata + OG. No changes needed. |
| `/reviews` | Public, indexable | Already in sitemap. Not touched. |
| `/review-rewards` | Public, indexable | Client component with **no metadata at all** (inherited generic defaults) and **missing from the sitemap** — fixed (§B). |
| `/loyalty` | Public, indexable (has own layout/metadata) | Not touched — out of scope, no issue found. |
| `/privacy`, `/terms` | Public, indexable | Already correct. Not touched. |
| `/track-order`, `/track-order/[orderId]` | Public but intentionally non-indexable | Already `robots: {index:false}` (Phase 17 work). Correct, unchanged. |
| `/auth` | Public, indexable (listed in sitemap) | Pre-existing decision, not evaluated for correctness in this pass — login/signup pages are debatable sitemap inclusions but not a new issue introduced here. |
| `/cart` | Public but intentionally non-indexable | Already `robots: {index:false}` (Phase 17.2, F18). Correct, unchanged. |
| `/checkout` | Transactional/personalized | **Had no `layout.tsx` and no robots directive at all** — fixed (§B). Auth gate is client-side only, so the initial HTML was not auth-walled. |
| `/account/*` | Authentication-protected | Hard server-side redirect already in place (crawler never sees content) — but **no explicit noindex** existed — added as defense-in-depth (§B). |
| `/my-orders`, `/my-orders/[orderId]` | Authentication-protected, personalized | Already `robots: {index:false}` + server-side ownership check (confirmed in a prior Phase 17 pass). Correct, unchanged. |
| `/order-success` | Transactional | Already disallowed in `robots.ts`. Unchanged. |
| `/admin/*` | Administrative | Already disallowed in `robots.ts`, already has its own auth layer (confirmed in prior Phase 17 work). Unchanged. |
| `/api/*` | Internal | Already disallowed in `robots.ts`. Unchanged. |

### Existing SEO infrastructure found (not reimplemented, verified working)

- `src/app/layout.tsx`: real Metadata API usage — title template, canonical, Open Graph, Twitter card, robots directives, Google verification token placeholder, PWA manifest linkage. This is genuinely solid, pre-existing work.
- `src/app/sitemap.ts` / `src/app/robots.ts`: both use Next.js's native `MetadataRoute` API correctly (not static files) — sitemap dynamically includes available products, robots references the sitemap and disallows `/admin/`, `/api/`, `/order-success/`.
- `src/app/(main)/menu/[slug]/page.tsx`: already had `generateMetadata()` with per-product title/description/OG/Twitter/canonical, and an existing, documented performance optimization (`cache()`-wrapped product fetch, merged upsell/related query) — not touched, outside this task's scope.
- `src/app/founders/layout.tsx` + `src/lib/foundersData.ts`: a genuine, substantive founders/brand-authority page already existed, with real names (Manish Kumar, Gaurav Kumawat), real bios, real social links — not fabricated by this task, and not altered by it.
- `src/lib/founderSchema.ts`: an existing Person/Organization-adjacent schema helper file already existed for the founders page (not modified this pass — reviewed, found consistent with the facts used elsewhere).
- Security headers (`vercel.json`) contain no crawler-blocking directives; `src/middleware.ts` contains no user-agent-based blocking. Confirmed Googlebot and other declared user agents (including OAI-SearchBot, which matches the wildcard `*` rule) are not blocked.

### Issues found, with severity and evidence

| # | Issue | Severity | Evidence |
|---|---|---|---|
| 1 | Homepage had no `<h1>` anywhere | High | Direct inspection of `src/app/(main)/page.tsx` and `HeroCarousel.tsx` — the hero's own heading is (correctly) an `<h2>`, and nothing else on the page used `<h1>`. |
| 2 | Root layout JSON-LD claimed specific geo-coordinates (`27.5, 75.4`) and a fixed daily operating-hours schedule with no verified source | **Correctness issue, not just SEO** | `src/models/DeliverySettings.ts`'s own documented state: kitchen `latitude`/`longitude` default to `null` and were confirmed unconfigured in production by a prior Phase 17.2 audit. No model in this codebase stores a fixed daily hours schedule — `Shop.ts`'s open/closed state is a manual toggle, not a schedule. The coordinates' suspiciously round values (`27.5`, `75.4`) are inconsistent with real GPS precision. |
| 3 | Product detail pages had metadata but zero structured data (`Product`, `BreadcrumbList`) | Medium | Direct inspection — no `application/ld+json` anywhere in `menu/[slug]/page.tsx`. |
| 4 | `/founders` and `/review-rewards` existed, were publicly reachable and linked from the footer, but were absent from `sitemap.ts` | Medium | Direct comparison of `sitemap.ts`'s `STATIC_ROUTES` against the actual route tree. |
| 5 | `/review-rewards` had no page-specific metadata at all (client component, no layout wrapper) | Low–Medium | Direct inspection — `"use client"` page, no `layout.tsx` present. |
| 6 | `/checkout` had no `layout.tsx` and therefore no `robots` directive, unlike `/cart`'s already-correct noindex | Medium | Direct file-tree comparison; checkout's auth gate is a client-side `useEffect` redirect, so initial SSR output is not auth-walled the way `/account` is. |
| 7 | `/account/*` had no explicit `robots` directive (though already hard-gated server-side) | Low (defense-in-depth only — no actual leak) | `account/layout.tsx`'s own existing server-side redirect logic, confirmed to run before any child content renders. |
| 8 | No FAQ page existed | Low–Medium (opportunity, not a defect) | Repository-wide search for `faq` found nothing under `src/app`. |
| 9 | No `Organization`/`WebSite` JSON-LD existed anywhere | Low–Medium | Only one JSON-LD block existed in the entire codebase (`layout.tsx`'s `FoodEstablishment`). |
| 10 | Terms page's hero chip text ("Online payments only", "30–45 min delivery") appears inconsistent with actual app behavior (COD is a real, extensively-used payment method; no delivery-time guarantee exists anywhere else in the app) | **Observed, not fixed** — out of this task's scope (legal-copy content, not a technical SEO fix) | `src/app/(main)/terms/page.tsx` vs. `COD_MAX_ORDER_AMOUNT`, `/api/orders/cod`, and every other reference to COD as a live payment method throughout the codebase. Flagged for owner review in §E/§F, not changed here — editing legal-document wording is a business decision, not an SEO implementation task. |

No soft-404s, no redirect chains, no accidental `noindex` on an intended-public page, and no duplicate-URL/query-parameter canonicalization problems were found — `/menu`'s canonical already correctly consolidates all `?category=`/`?search=` variants to the base URL.

---

## B. Implementation Results

| File | Change | Why |
|---|---|---|
| `src/app/(main)/page.tsx` | Added a visually-hidden (`sr-only`) `<h1>` with real business facts (vegetarian, Danta/Sikar/Rajasthan, online delivery) | Closes issue #1. Visually hidden rather than a visible duplicate heading, since the hero/search area already covers this content visually. |
| `src/app/layout.tsx` | Removed `geo` and `openingHoursSpecification` from the existing `FoodEstablishment` JSON-LD (kept name/address/description/cuisine/price range/payment methods — all independently corroborated elsewhere, e.g. the Terms page's legal address). Added new `Organization` and `WebSite` JSON-LD blocks using only real, already-public facts (same email/founders/social links used elsewhere). | Closes issues #2 and #9. The address itself was **not** removed — it is independently corroborated as the real legal business address in `terms/page.tsx`, not invented. |
| `src/app/(main)/menu/[slug]/page.tsx` | Added `Product` and `BreadcrumbList` JSON-LD, built strictly from the already-fetched `product` record. `aggregateRating` is included only when a real rating AND a real review count both exist; omitted otherwise. | Closes issue #3. No fabricated ratings, stock, or offers. |
| `src/app/sitemap.ts` | Added `/founders`, `/faq`, `/review-rewards` | Closes issue #4 (partially — `/faq` is new, see below). |
| `src/app/(main)/review-rewards/layout.tsx` (new) | Added real, accurate metadata (title/description/canonical) for this already-public page | Closes issue #5. |
| `src/app/(main)/checkout/layout.tsx` (new) | Added `robots: {index:false, follow:false}`, matching `/cart`'s existing pattern | Closes issue #6. |
| `src/app/(main)/account/layout.tsx` | Added `robots: {index:false, follow:false}` as defense-in-depth | Closes issue #7 (already safe; this is belt-and-suspenders, consistent with the sibling routes). |
| `src/app/(main)/faq/page.tsx` (new) | New FAQ page: 11 real questions answered strictly from actual, current app behavior (payment methods confirmed from code — COD + Razorpay; order tracking confirmed from the real `/my-orders` and public tracking routes; loyalty confirmed from the real loyalty feature; vegetarian-only and Danta/Sikar confirmed from the task's own verified business context). Includes `FAQPage` JSON-LD. | Closes issue #8. |
| `src/components/shared/Footer.tsx` | Added a `/faq` link next to the existing `/founders` link in the bottom bar | Makes the new page crawlable via an internal link, not just the sitemap. |

### Metadata and canonical strategy

Unchanged from the existing, already-correct convention: every public page sets its own `title`/`description`/`alternates.canonical` against the hardcoded production origin (`https://www.foodknock.com`), matching `sitemap.ts`'s `BASE_URL` and every other page's existing pattern. No new convention was introduced.

### Sitemap and robots behavior

`robots.ts` and the overall robots strategy were reviewed and left unchanged — already correctly permissive for all declared user agents (including AI crawlers matching the wildcard rule) while disallowing `/admin/`, `/api/`, `/order-success/`. `sitemap.ts` now lists 15 static routes (was 12) plus all available products, still generated dynamically via the existing `MetadataRoute.Sitemap` API — no new dependency, no static-file duplication of logic.

### Structured data implemented

- `FoodEstablishment` (existing, corrected — fabricated geo/hours removed)
- `Organization` (new)
- `WebSite` (new)
- `Product` (new, per product page)
- `BreadcrumbList` (new, per product page)
- `FAQPage` (new, on the new `/faq` page)

Not implemented: `Article` (no genuine long-form editorial content exists yet to mark up honestly — see §F), `Person` schema beyond what `founderSchema.ts` already provides (reviewed, left as-is — already consistent with the verified founder facts).

### Public vs. private indexing decisions

No decision in this pass weakened any existing privacy/auth boundary. Every `noindex` addition was additive (checkout, account) or already correctly in place (cart, my-orders, track-order, admin, api). No private customer, order, or account data is exposed by any change in this pass — the new JSON-LD blocks (`Product`, `Organization`, `WebSite`, `FAQPage`) contain only already-public catalog/brand facts, never customer or order data.

### Local and founder content changes

No changes were made to `src/lib/foundersData.ts` or the `/founders` page's content — it already contained real, substantive, business-approved content before this task, and inventing or editing founder biography text was explicitly out of scope. The only founders-related change was adding the route to the sitemap and reusing the two confirmed founder names in the new `Organization` JSON-LD.

---

## C. Keyword and Page Mapping

| Target keyword / intent group | Most relevant page | Status |
|---|---|---|
| "FoodKnock", "FoodKnock Danta" (brand) | `/` (homepage) | Covered — homepage title/description/new H1 all state the brand + Danta. |
| "online food delivery Danta", "food delivery Danta Rajasthan" | `/` and `/menu` | Covered — both already reference Danta/Sikar/Rajasthan in metadata; homepage H1 now explicit. |
| "vegetarian food near me", "veg food delivery Danta" | `/` and `/menu` | Covered — "vegetarian" is now explicit in the homepage H1; menu page description already references the full catalog. |
| "FoodKnock menu", specific categories (pizza/burger/snacks, etc.) | `/menu` and `/menu/[slug]` (per product) | Already covered by existing dynamic metadata; now also carries real `Product` structured data per item. |
| "FoodKnock delivery availability", "is FoodKnock serviceable at my address" | `/faq` (new) | New — directly answered without inventing coverage claims; defers to the real in-app serviceability check. |
| "FoodKnock payment options", "does FoodKnock accept cash on delivery" | `/faq` (new) | New — answered from actual code-confirmed payment methods (COD + Razorpay). |
| "FoodKnock order tracking", "track FoodKnock order" | `/faq` (new) + existing `/track-order`, `/my-orders` | FAQ links the concept; the actual functional pages are unchanged. |
| "FoodKnock founders", "who owns FoodKnock", "Manish Kumar Gaurav Kumawat" | `/founders` | Already covered by pre-existing content; now discoverable via sitemap. |
| "FoodKnock customer support", "contact FoodKnock" | `/contact` + `/faq` | Already covered; FAQ cross-links to it. |
| "FoodKnock review reward", "free item for Instagram review" | `/review-rewards` | Now has real per-page metadata and a sitemap entry; content itself was already live. |

No location pages for Ramgarh, other towns, or other cities were created, per the explicit business restriction — Danta remains the sole local-intent target, consistent with the one real, already-used business address.

---

## D. Validation Evidence

```
npx tsc --noEmit                         → clean (one stale .next/dev/types
                                            cache error observed mid-session
                                            before a fresh build regenerated
                                            it — not a real code error;
                                            resolved by the build below)

npx eslint <every file this task changed/added> → 0 problems in every file
                                            this task touched. (src/app/(main)/page.tsx
                                            has 11 pre-existing `any`-type
                                            errors far from this task's
                                            one-line <h1> insertion, confirmed
                                            via `git diff` to be unrelated
                                            pre-existing code — not
                                            introduced or touched here.)

npm run build (next build --webpack)     → exit 0, three separate full runs
                                            during this task, all clean.
                                            Route table confirms /faq,
                                            /checkout, /founders, and
                                            /review-rewards all compiled.

Pure-logic tests (node --experimental-strip-types --test):
  76/76 passing (unchanged from before this task — this task added no new
  automated tests, since all changes are metadata/structured-data/content,
  not testable business logic)

Integration tests (npx tsx --test, one process per file):
  108/108 passing across all 14 existing suites — re-run in full to confirm
  zero regression from this task's layout/metadata/sitemap changes.
```

### Sitemap/robots checks

- `src/app/sitemap.ts` reviewed line-by-line after edits: 15 static entries (was 12) + dynamic product routes, no duplicate URLs, no entry for any noindexed route (`/cart`, `/checkout`, `/account`, `/my-orders`, `/track-order` remain correctly absent).
- `src/app/robots.ts` reviewed, unchanged: `disallow: ["/admin/", "/api/", "/order-success/"]`, sitemap/host both reference the production domain correctly.

### Metadata checks

Verified by direct source reading (not a live HTTP fetch, since no deployed instance exists for this task to query) that `generateMetadata()`/`export const metadata` on every changed page returns real, non-generic, non-duplicated values — confirmed for `/`, `/faq`, `/checkout`, `/account`, `/review-rewards`, `/menu/[slug]`.

### Structured-data validation

JSON-LD syntax was validated by construction (every block is a plain JS object passed through `JSON.stringify()` inside a React Server Component — a syntax error would fail the build, which it did not) and by manual schema-shape review against schema.org's documented `Product`, `Organization`, `WebSite`, `BreadcrumbList`, and `FAQPage` types. **No live Google Rich Results Test or Schema.org validator run was performed** — no deployed URL exists for this task to submit; this is a documented limitation, not a claimed pass.

### Private-data leak check

Read every new/changed JSON-LD block line-by-line: zero customer PII, zero order data, zero payment data in any of them — only catalog (`Product`), brand (`Organization`/`WebSite`), and FAQ content.

### Auth/indexing boundary check

Re-confirmed (same method as the Phase 17 location-auth-flow task) that `/account`'s server-side redirect and `/checkout`'s client-side redirect both still function as before — this task added `robots` metadata only, touching zero authentication/authorization code.

### Location/serviceability regression check

No file touched in this task overlaps with the location-authentication fix from the preceding task (`locationStore.ts`, `useActiveLocationServiceability.ts`, `LocationTrigger.tsx`, `LocationPickerSheet.tsx`, `CustomerShell.tsx`, `cart/page.tsx`) — confirmed by `git diff` file list. The 76/76 pure-logic tests include that fix's own `locationStoreOwnership.test.ts` suite, re-run clean after this task's changes.

### Browser verification status

**Not performed.** No browser automation framework exists in this repository (confirmed in a prior Phase 17 pass) and none was installed for this task, per its own instruction to avoid unnecessary dependencies. Visual rendering of the new H1, FAQ page, and structured-data output was not checked in an actual browser — only via source inspection and a successful production build.

---

## E. External Tasks (Require Owner Access)

1. **Google Search Console** — verify property ownership (the existing `verification.google` metadata field reads from `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION`, presence not confirmed in this pass — see §F), submit `https://www.foodknock.com/sitemap.xml`, and request indexing for `/faq` and the newly-sitemapped `/founders`/`/review-rewards`.
2. **Google Business Profile** — this task had no account access. Owner checklist:
   - Confirm the business name is exactly "FoodKnock" (no keyword stuffing).
   - Confirm primary category is an accurate food-delivery/restaurant category (not "grocery" or "marketplace" — per the stated business restriction).
   - Confirm the listed address matches the one real address used throughout this codebase (`Ramgarh Bas Stand Circle, Danta, Sikar, Rajasthan, 332403`).
   - Confirm real business hours (this task deliberately removed an unverified hours claim from the site's structured data — the Profile should reflect real hours, and once confirmed, they can be re-added to `layout.tsx`'s JSON-LD).
   - Confirm real GPS coordinates for the kitchen (also removed from structured data for the same reason — see §F for the exact re-add instructions).
   - Upload real photos, confirm phone number (`+91 87648 21399`, already used site-wide) and website link.
   - Check for duplicate/conflicting profiles.
3. **Real business photographs** — the founders page and homepage would benefit from genuine photos if not already present; this task did not add, remove, or alter any image asset.
4. **External listing corrections** (Justdial, Zomato/Swiggy if applicable, local directories) — ensure name/address/phone consistency with the one verified address used throughout this codebase.
5. **Analytics/Search Console baseline** — `@vercel/analytics` is already integrated (confirmed in `layout.tsx`); no Search Console integration evidence was found in the repository. Once verified (item 1), establish a baseline for organic clicks/impressions/queries — this task cannot invent that baseline.
6. **Confirm the kitchen's real GPS coordinates and real operating hours**, then re-add `geo`/`openingHoursSpecification` to `src/app/layout.tsx`'s `jsonLd` object (the exact fields were documented in a code comment at the removal site for easy restoration).
7. **Review the Terms page's "Online payments only" / "30–45 min delivery" copy** against actual current policy (COD exists as a real payment method elsewhere in the app; no delivery-time guarantee exists anywhere else) — this is a content/legal decision, not something this SEO task altered.

---

## F. Outstanding Limitations

**Completed and locally verified:**
- Homepage `<h1>` added.
- Fabricated geo-coordinates/hours removed from structured data.
- `Organization`, `WebSite`, `Product`, `BreadcrumbList`, `FAQPage` JSON-LD added.
- Sitemap gaps closed (`/founders`, `/faq`, `/review-rewards`).
- `/review-rewards` given real per-page metadata.
- `/checkout` and `/account` given explicit noindex directives.
- New `/faq` page with 11 real, policy-consistent answers.
- Full test/build/lint validation, zero regressions.

**Implemented but not externally verified:**
- Structured data is schema-shape-correct by manual review and valid JSON by construction, but was never run through Google's live Rich Results Test (no deployed URL available to this task).
- New metadata (`/faq`, `/review-rewards`, `/checkout`, `/account`) was verified by source inspection, not by fetching a live rendered page.

**Pending owner action:**
- Everything in §E.
- Re-adding real geo-coordinates/hours once confirmed.
- Reviewing the Terms page's payment/delivery-time copy.

**Not feasible with current access:**
- Any Search Console, Google Business Profile, or analytics baseline — no account access exists for this task.
- Live browser/visual verification — no browser automation tooling exists in this repository.
- Core Web Vitals measurement — no real production traffic data is available to this task; none was invented.

**Longer-term SEO work** (not started, consistent with "no AI-generated content farms" / "no doorway pages" instructions):
- Genuine original editorial content (e.g., "a practical guide to ordering vegetarian food online in Danta") — the task explicitly asked for a plan here, not a rushed first draft; writing a single genuinely useful guide well is better scheduled as its own focused piece of work with real local knowledge behind it, rather than produced quickly inside this already-large implementation pass.
- `llms.txt` or similar — explicitly not created, per the task's own instruction against fabricating unsupported AI-discovery files.
- Off-page/reputation work (reviews, backlinks, directory consistency) — requires ongoing owner/business action, not a one-time code change; the checklist is in §E/§12 of the original task, not duplicated here.

---

## G. Final Honest Assessment

FoodKnock's technical SEO foundation was already better than a typical small local business site before this task began — a real Metadata API implementation, a working dynamic sitemap, per-product metadata, and substantive founders content all pre-existed. This pass closed the specific, verifiable gaps found (missing H1, missing structured data, two missing noindex directives, missing sitemap entries, a genuinely useful new FAQ page) and fixed one real correctness problem (fabricated geo-coordinates contradicting the app's own documented "no kitchen coordinates configured" state).

No ranking position, index-coverage percentage, or Google Business Profile status is claimed — none of that is observable without the external account access this task did not have. What can be stated with evidence: the codebase is more technically complete, more accurately represented to search engines, and has no newly-introduced regression, confirmed by 184 passing automated tests (76 pure-logic + 108 integration) and three clean production builds.
