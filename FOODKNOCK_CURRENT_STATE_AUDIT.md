# FoodKnock — Current State Audit

**Audit date:** 2026-10-02
**Scope:** Read-only inspection of the repository at `D:\fKnock\foodknock` as it exists on branch `main` (HEAD `1633916`). No code was modified to produce this document.
**Method:** Full-text reads of every Mongoose model, every API route (`src/app/api/**/route.ts`), every admin page, every customer-facing page, config files, and `middleware.ts`. Claims are cited with file paths and, where available, line numbers. Anything not directly observed in code is marked **Needs Verification** rather than assumed.

---

## 1. EXECUTIVE SUMMARY

### Architecture at a glance
FoodKnock is a Next.js 16 (App Router, React 19) food-ordering app, backed by MongoDB/Mongoose, deployed on Vercel. It has a working signup/OTP/login/session system, a COD + Razorpay dual payment pipeline, a loyalty/referral points engine, an admin panel, and a notification stack spanning Web Push, WhatsApp, email, and Telegram. There is no automated test suite anywhere in the repository.

### Strongest parts of the codebase
- **Authentication & OTP security** (`src/lib/auth.ts`, `src/lib/otp.ts`, `src/lib/loginSecurity.ts`): layered, DB-backed brute-force protection (IP + email), bcrypt-hashed passwords and OTPs, anti-enumeration responses, single-use reset tokens with a distinct signing secret. This is production-grade work.
- **Loyalty/referral integrity**: redemption amounts are independently re-derived and clamped server-side (`src/lib/createOrderCore.ts`), never trusted from the client, with idempotency guards (`LoyaltyLedger.exists` checks, atomic CAS updates) preventing double-grants.
- **Razorpay signature verification and order-creation idempotency**: proper HMAC-SHA256 verification, and a `Order.findOne({razorpayPaymentId})` dedupe check before writing, backed by a DB-level sparse unique index.
- **Mongo connection caching** (`src/lib/db.ts`): the textbook-correct serverless-reuse pattern, with an extra `readyState` sanity check most implementations skip.
- **Admin-panel analytics rewrites**: several admin list pages show evidence of deliberate perf fixes (users page aggregation replacing in-memory joins, combined `/api/navbar` replacing 3 fetches, combined upsell/related product query).

### Major technical risks
- **Two independent order-creation code paths** (`src/app/api/orders/route.ts` "legacy" vs. `src/lib/createOrderCore.ts`, the documented single source of truth) and **two independent order-status-update routes** (`/api/admin/orders/[id]/status` and `/api/orders/[id]`) with inconsistent status whitelists. Architectural drift risk — a future change applied to one path and not the other will silently diverge.
- **No automated tests** of any kind (`*.test.*`, `*.spec.*`, `__tests__/`, and all known test-runner configs absent).
- **Razorpay webhook is a stub** (`src/app/api/payment/webhook/route.ts`) — it verifies signatures and dedupes but never creates/reconciles an order on `payment.captured`. A payment captured without a completed client round-trip has no server-side recovery path.
- **Dead/unused dependencies** (`next-themes`, `framer-motion` — no import matches found in `src/`) bloating the install and (for framer-motion) likely the client bundle if any transitive re-export pulls it in — **Needs Verification** on actual bundle inclusion.

### Major performance risks
- **Every page-rendering route is `force-dynamic`** with no caching layer — a documented trade-off made to avoid a prior ISR-write cost blowup, but it means every page view is a guaranteed live serverless invocation + Mongo round trip, which is consistent with elevated Vercel Fluid Active CPU usage.
- **Unbounded full-collection reads**: admin orders page fetches *all* orders with no DB-level limit; the admin dashboard's lifetime-revenue aggregate has no `$match` stage; the push-campaign cron fetches *all* active subscriptions and fires unbounded-concurrency crypto-heavy `webpush.sendNotification` calls for every one of them in parallel, twice a day — this is the single most concrete, highest-confidence contributor to CPU spikes identified in this audit.
- **No shared layout for the `(main)/` route group** — every one of 18 pages mounts its own `<Navbar>`, which independently fetches `/api/navbar` (JWT verify + `User.findById` + loyalty aggregate) on every single navigation, stacked on top of each page's own data fetch.
- **Client-fetched pages** (`cart`, `checkout`, `my-orders`, `track-order`, `loyalty`, `review-rewards`) are `"use client"` and fetch via `useEffect` post-mount, producing a loading-skeleton → content swap instead of SSR content — the likely mechanical root of both the "feels slow" complaint and the back-button scroll-restoration complaint.

### Major UX risks
- **Browser Back does not restore scroll position** on skeleton-first client-fetched pages — most likely caused by content height changing after the scroll-restoration point is captured (see §13, §20B). No forced `scrollTo(0,0)` anti-pattern was found in code — this rules out the most common textbook cause, but does not explain away the symptom.
- **UI promises features that don't exist in the backend**: Terms and Contact pages advertise "refund process," cart UI has a coupon/tag icon, and track-order pages say "Live Order Status" / "Live Tracking" — none of refunds, coupons, or live/polling status updates are actually implemented server-side.

### Major security risks
- **CRITICAL: client-trusted order pricing.** All order-creation paths (`/api/orders`, `/api/orders/cod`, `src/lib/createOrderCore.ts`, and the Razorpay amount computation in `/api/payment/create-order`) take each line item's `price` directly from the client request body. Products are fetched from the database only to validate `stock`/`isAvailable`/existence — `product.price` is never read or enforced. A modified client request can place orders (COD or paid) at attacker-chosen prices.
- **Several mutating admin-adjacent API routes have no visible server-side auth check**: `src/app/api/users/[id]/route.ts` (PATCH — can promote any user to admin or toggle `isActive`), `src/app/api/products/route.ts` (POST) and `src/app/api/products/[id]/route.ts` (PATCH/DELETE), `src/app/api/reviews/[id]/route.ts` (PATCH/DELETE), and `src/app/api/orders/[id]/route.ts` (GET exposes customer PII to anyone with an ObjectId; PATCH changes order status with no auth).
- **No session revocation** — JWTs are stateless with a 7-day expiry; "logout" only clears the client cookie.
- **No general-purpose rate limiting** on order/payment creation endpoints — combined with the pricing issue above, this raises the ceiling on how much damage a scripted abuse attempt could do before being noticed.

### Areas that appear production-ready
Authentication/OTP/password-reset flow, Razorpay client-driven payment verification, loyalty/referral ledger logic, Mongo connection handling, SEO metadata/sitemap/robots/structured-data for the main content pages, Cloudinary image pipeline.

### Areas requiring deeper work
Order pricing trust model (critical), the two auth-gap route families above, Razorpay webhook reconciliation, admin-route auth consistency (no shared `requireAdmin()` helper — every route hand-rolls the same check), caching strategy for page routes, push-campaign broadcast concurrency, and a real cancellation/refund implementation to match the UI's existing promises.

---

## 2. PROJECT STRUCTURE

- **Framework**: Next.js `16.1.6`, React `19.2.3` / React DOM `19.2.3`, App Router exclusively (`src/app/`, no `pages/` directory). TypeScript `strict: true`. (`package.json`, `tsconfig.json`)
- Project's internal `package.json` name is still `"cafe"` (v0.1.0); the Mongo database name is hardcoded `"cafe_app"` (`src/lib/db.ts`) — both are legacy artifacts from before the app was branded "FoodKnock."
- Build scripts explicitly force webpack (`next dev --webpack`, `next build --webpack`), opting out of Next 16's default Turbopack path.

### Directory layout (`src/`)
```
src/
├── app/
│   ├── (main)/        — public pages: auth, cart, checkout, contact, loyalty, menu, menu/[slug],
│   │                     my-orders, my-orders/[orderId], privacy, review-rewards, reviews, terms,
│   │                     track-order, track-order/[orderId], and home (page.tsx)
│   ├── admin/          — dashboard, loyalty, notifications, orders, products (+new/+edit/[id]),
│   │                     review-rewards, reviews, users — all gated by admin/layout.tsx
│   ├── api/            — 47 route.ts files across auth/, admin/, orders/, payment/, products/,
│   │                     loyalty/, delivery/, notifications/, push/, review-reward/, reviews/,
│   │                     shop/, upload/, users/, navbar
│   ├── founders/, notifications/, order-success/
│   ├── layout.tsx, robots.ts, sitemap.ts, globals.css, navbar.css
├── components/         — admin/, auth/, checkout/, founders/, home/, notifications/, orders/,
│                          products/, reviews/, shared/
├── hooks/               — useOrderProcessing.ts, usePushNotifications.ts
├── lib/                 — db.ts, auth.ts, otp.ts, loginSecurity.ts, delivery.ts, constants.ts,
│                          createOrderCore.ts, loyaltyService.ts, firstFreeDelivery.ts, mailer.ts,
│                          cloudinary.ts, cdnImage.ts, webpush.ts, automation/, emailTemplates/,
│                          firebase/, notifications/ (events/, marketing/, providers/, whatsapp/)
├── models/              — 16 flat Mongoose model files (no subfolders)
├── store/               — cartStore.ts (single Zustand store)
└── middleware.ts        — admin-route cookie presence guard only
```
No `src/server/`, no `src/services/` — service-style logic lives directly under `src/lib/`.

### Config files
| File | Key contents |
|---|---|
| `next.config.ts` | `reactStrictMode: true`; `images.unoptimized: true` (deliberate — Cloudinary pre-transforms, comment explains this bypasses Vercel's image optimizer to save quota); `images.remotePatterns` allow `res.cloudinary.com`, `images.unsplash.com`; `compress: true`; security `headers()` for all routes (HSTS, `X-Frame-Options: SAMEORIGIN`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`). |
| `vercel.json` | Two crons: `/api/push/send-campaign?slot=morning` (05:30 UTC), `?slot=evening` (10:30 UTC); security headers that **conflict** with next.config.ts (`X-Frame-Options: DENY` here vs. `SAMEORIGIN` there — needs reconciliation); cache headers for `/sw.js` and `/manifest.webmanifest` only. |
| `tsconfig.json` | ES2017 target, `strict: true`, `moduleResolution: "bundler"`, `@/*` → `./src/*`. |
| `eslint.config.mjs` | Flat config, `eslint-config-next/core-web-vitals` + `/typescript`. |
| `postcss.config.mjs` | Tailwind v4 pipeline (`@tailwindcss/postcss`). |

### middleware.ts (full logic)
`src/middleware.ts` — matcher `["/admin","/admin/:path*"]` only. Checks only that a cookie named `token` is **present**; redirects to `/auth?redirect=<path>` if absent. Does **not** verify the JWT or check role/isActive — that's deliberately deferred to `src/app/admin/layout.tsx` (a server component) to avoid a DB call on every request, per inline comment. Any request with any non-empty `token` cookie value passes this layer.

### Dependencies and confirmed usage
| Dependency | Usage |
|---|---|
| `mongoose` | DB layer, 16 models + `src/lib/db.ts` connection cache |
| `bcryptjs` | Password + OTP hashing, `src/lib/auth.ts`, `src/lib/otp.ts` (10 salt rounds) |
| `jsonwebtoken` | Session JWT + password-reset JWT, `src/lib/auth.ts` (two distinct secrets) |
| `razorpay` | `src/app/api/payment/create-order`, `/verify`, `/webhook` |
| `cloudinary` | `src/lib/cloudinary.ts`, `src/app/api/upload/image/route.ts` |
| `nodemailer` | `src/lib/mailer.ts` — welcome/OTP/order-confirmation/admin-alert/delivered emails |
| `web-push` | `src/lib/webpush.ts`, `src/lib/notifications/providers/webPushProvider.ts`, `public/sw.js` |
| `firebase` / `firebase-admin` | `src/lib/firebase/admin.ts` — **Needs Verification** on exact scope of use beyond init (not traced in depth by sub-agents) |
| `zod` | Input validation in most `/api/auth/*` routes |
| `zustand` (+ `persist`) | Single cart store, `src/store/cartStore.ts` |
| `@vercel/analytics` | `src/app/layout.tsx` (`<Analytics/>`) |
| `react-hot-toast` | Toast notifications, root layout |
| `clsx`, `tailwind-merge` | Class-name utilities |
| **`next-themes`** | **No import matches found anywhere in `src/`** — appears unused |
| **`framer-motion`** | **No `from "framer-motion"` import matches found in `src/`** — appears unused (Needs Verification: confirm no re-export/transitive use before removing) |

### Tests / scripts
No `*.test.*`, `*.spec.*`, `__tests__/` directories, or test-runner config (`jest.config.*`, `vitest.config.*`, `playwright.config.*`) anywhere in the repository. No `scripts/` directory at the root.

---

## 3. AUTHENTICATION & USERS

### Signup (two-step, OTP-gated) — Implemented
1. `POST /api/auth/register` (`src/app/api/auth/register/route.ts`): Zod-validated, checks `User` for duplicate email/phone, self-referral guard, hashes password immediately (bcrypt, 10 rounds — plaintext never persisted), upserts a `PendingSignup` document, generates+bcrypt-hashes a 6-digit OTP (10-min expiry), sends via email (nodemailer) and fire-and-forget WhatsApp. Rate-limited: 60s resend cooldown, 5 requests/hour, enforced via atomic `findOneAndUpdate`.
2. `POST /api/auth/verify-signup-otp`: verifies OTP against the hash (bcrypt.compare), 5 wrong attempts → 30-min lock. On success, re-checks uniqueness (race guard), resolves referrer, creates the real `User` from the pre-hashed password, deletes the `PendingSignup`, auto-logs-in (sets `token` cookie), fire-and-forget welcome email.
3. `POST /api/auth/resend-signup-otp`: same rate-limit window against the existing `PendingSignup`.

### Login — Implemented, layered brute-force protection
`POST /api/auth/login` (`src/app/api/auth/login/route.ts`):
- IP-level block (20 fails/hour → 1-hour block via `LoginAttempt` model), checked before user lookup.
- Email-level lock (5 fails → 30-min lock, `User.loginSecurity`) — password is not even compared while locked.
- `bcrypt.compare`; mismatch increments both IP and email counters atomically.
- Anti-enumeration: identical generic "Invalid email or password" for not-found and wrong-password.
- `isActive === false` → 403, not counted as a brute-force signal.
- JWT via `signToken({userId,email,role})`, HS256, `JWT_SECRET`, 7-day expiry. Cookie: httpOnly, `secure` in production only, `sameSite: lax`, 7-day maxAge.

### Logout — Implemented (stateless)
`POST /api/auth/logout` clears the cookie (`expires: new Date(0)`). No server-side token blacklist — a captured token remains valid until its own expiry even after logout. **No session revocation mechanism exists.**

### Sessions / cookies / tokens — Implemented
Single `token` httpOnly cookie carrying a 7-day JWT (`userId, email, role`). No refresh-token rotation. Password-reset uses a **separate** short-lived (10-min) JWT signed with a different secret (`RESET_TOKEN_SECRET`) and carrying an explicit `purpose: "password-reset"` claim, plus a server-side bcrypt hash of that token stored on the user for single-use enforcement.

### Password hashing — Implemented
bcryptjs, 10 salt rounds, used identically for both account passwords and OTPs (`src/lib/auth.ts`).

### Password reset — Fully implemented (4-step)
`forgot-password` → `verify-otp` → `reset-password`, backed by `User.passwordReset` subdocument. Strong anti-enumeration (forgot-password always returns an identical generic response). Reset token is both a verifiable JWT and matched against a stored bcrypt hash (defense in depth); single-use (cleared on redemption).

### Email/phone verification — Partially implemented
Email is verified implicitly via the signup-OTP step (OTP sent to the email address being registered). **No separate phone/SMS OTP channel exists** — phone number is collected but never independently verified. **Needs Verification**: whether WhatsApp OTP delivery (used as a secondary signup-OTP channel) constitutes phone verification in practice; it is not gating account creation on its own.

### Protected routes — Partially implemented (client-side gate)
Pages like `/my-orders` and `/checkout` are `"use client"` and call `fetch("/api/auth/me")` on mount, redirecting via `router.replace` on failure. This is a **client-side-only** gate — no server-side redirect for these specific pages, meaning a brief page shell can render before the redirect fires (no sensitive data is exposed before the `/me` check resolves, per sub-agent review).

### Admin authentication — Implemented, 3 layers, but duplicated per-route
1. `middleware.ts` — cookie presence check only (see §2).
2. `src/app/admin/layout.tsx` — server component, `verifyToken` + DB-backed `User.findById(...).select("role isActive")`; redirects on missing/invalid token, `isActive===false`, or `role !== "admin"`. This is the actual enforcement layer and cannot be bypassed by a direct nested-page request.
3. Individual `/api/admin/**` routes each re-implement their own `isAdmin()`/`getAdminFromCookie()` helper (manual cookie regex parse + `verifyToken` + role check) — consistent in the routes sampled, but **no shared `requireAdmin()` utility exists**, so a new route added without copying this boilerplate would be unprotected. This pattern is corroborated by the confirmed-missing auth checks on several non-`/api/admin/` routes (see §15).

### Roles/permissions — Implemented, binary only
`User.role` enum `["user","admin"]`, default `"user"`. No granular permission system beyond this binary flag.

### User model — see §4 for full field list.

### Profile functionality
`GET /api/auth/me` returns a safe projection (`_id,name,email,role,phone,address,isActive`). No dedicated profile-edit API route was identified by the sub-agents — **Needs Verification** whether profile editing exists anywhere in the UI.

---

## 4. DATABASE / MONGODB

### Connection architecture — `src/lib/db.ts` (57 lines, full file read)
Classic Next.js serverless-reuse pattern via `global.mongooseCache = {conn, promise}`. `connectDB()` returns the cached connection immediately if it exists **and** `mongoose.connection.readyState === 1` (an extra staleness guard beyond the typical pattern). Otherwise starts (or awaits an in-flight) `mongoose.connect()` with `dbName:"cafe_app"`, `serverSelectionTimeoutMS:5000`, `connectTimeoutMS:5000` (explicit "fail fast instead of 90s hang" comment), `socketTimeoutMS:45000`, `maxPoolSize:10`, `minPoolSize:2`, `retryWrites:true`. On error, resets the cached promise to `null` so the next call retries cleanly.

### Models (16 files, all read in full)

| Model | Key fields | Indexes | Notable |
|---|---|---|---|
| **User** | name, dob, email (unique), phone, password, role (enum user/admin), address (embedded), isActive, loyaltyPoints, referralCode, referredBy, referralRewardGranted, deliveredOrderCount, firstDeliveryFreeUsed, passwordReset{} subdoc, loginSecurity{} subdoc, notificationPreferences{} (9 bool flags) | `referralCode` unique+sparse, `phone` (non-unique) | Dev-only stale-schema guard force-recompiles model if hot-reload cached an old shape |
| **Order** | orderId (unique), user (optional, null=guest), customerName/phone/address, items[] (productId/name/qty/price/image), totalAmount, deliveryFee, platformFee, redeemedPoints/Amount, status (enum: received/preparing/out_for_delivery/delivered/**cancelled**), paymentMethod (enum cod/razorpay), razorpayOrderId, razorpayPaymentId (unique+sparse, no default), whatsappSent, isFirstDeliveryFreeApplied | `{user,createdAt}`, `{status,createdAt}`, `{createdAt}`, `{phone}` | **`"cancelled"` is a legal enum value with zero code paths that ever set it** — dead schema capability |
| **Product** | name, slug (unique), description, shortDescription, price, compareAtPrice (nullable), category (plain String, no Category model), image, stock, isAvailable, isFeatured, tags[], ingredients[], rating | `{isAvailable,stock,isFeatured,createdAt}`, `{createdAt}`, `{category,createdAt}` | No variants/options schema exists |
| **Shop** | isOpen (bool, default true) | — | Also exports `getShopStatus()`/`setShopStatus()` helpers with a 30s in-process cache |
| **LoginAttempt** | ip (unique), failedCount, windowStart, blockedUntil, lastAttemptAt | `{ip}` unique, `{updatedAt}` **TTL 3h** | Auto-expires stale IP-tracking docs |
| **PendingSignup** | name, dob, email (unique), phone, password (pre-hashed), referralCodeInput, address{}, OTP state fields | `{email}` unique, `{createdAt}` **TTL 24h** | Auto-expires abandoned signups |
| **LoyaltyLedger** | user, type (enum: order_reward/referral_referrer/referral_referee/redemption/admin_credit/admin_debit/expiry), points (signed), balanceAfter, order, referredUser, note | `{user,createdAt}`, `{order,type}` sparse | Immutable append-only; sparse index is the idempotency guard (≤1 `order_reward` per order) |
| **NotificationLog** | event, channel (enum push/email/whatsapp/sms), user, isBroadcast, title/body/url/imageUrl, priority, category, campaignId, sentCount/failedCount/deactivatedCount, status, readAt | `{user,createdAt}`, `{isBroadcast,createdAt}`, `{event,createdAt}`, `{user,readAt}` | One row per send/broadcast event, not per recipient |
| **PushSubscription** | user (optional — anonymous allowed), endpoint (unique), p256dh/auth, fcmToken, isActive, failCount, preferences{} | `{user,isActive}` | — |
| **Review** | userName, rating (1-5), comment, isApproved (default **true**) | — | **Not linked to Order or User at all** — not purchase-gated |
| **ReviewReward** | user, instagramLink, status (enum pending/approved/rejected), rewardItem (enum burger/pizza), rewardUsed, adminNote | `{user}` unique+sparse | One submission per account |
| **Booking** | name, phone, date, time, guests, note | — | Simple table-reservation model |
| **AutomationRule / AutomationExecution / AutomationUserState / AutomationWindowClaim** | Marketing-automation engine support models (rule definitions, per-run audit log, per-user cooldown/frequency state, distributed-lock claims for cron dedup) | Various, incl. `{rule,windowKey}` **unique** (atomic cron-dedup lock) | Substantial unused-looking infra — **Needs Verification** on current activation/usage extent |

### Aggregation pipelines (7 files)
- `src/app/api/users/route.ts` — orders-per-phone `$group`.
- `src/app/admin/page.tsx` — **unbounded** lifetime-revenue `$sum` (no `$match`) + bounded today's-revenue `$sum`.
- `src/app/api/navbar/route.ts`, `src/app/api/loyalty/route.ts`, `src/app/api/admin/loyalty/route.ts` (×2), `src/app/api/admin/loyalty/[userId]/route.ts` — repeated loyalty-ledger-sum self-healing repair pattern.
- `src/lib/automation/audienceResolver.ts` — audience-segmentation aggregates (order-history lookup, birthday matching).

### populate() usage — 5 files, all field-limited
`src/app/api/loyalty/route.ts`, `review-reward/approved`, `admin/review-rewards`, `admin/loyalty/[userId]` — all use `.select()`-scoped populates; no unbounded deep population found.

### Potentially expensive queries
- `Order.aggregate([{$group:{_id:null,total:{$sum:"$totalAmount"}}}])` with no `$match` — `src/app/admin/page.tsx:80` — full collection scan on every dashboard load (`force-dynamic`, no caching).
- `Order.find().sort({createdAt:-1}).lean()` with **no `.limit()`** — `src/app/admin/orders/page.tsx:15` (comment: "no limit so client-side date filtering works correctly") — fetches the entire orders collection.
- `PushSubscription.find({isActive:true}).lean()` with no limit — `src/lib/notifications/providers/webPushProvider.ts:207` — fetches every active subscriber for every broadcast.

---

## 5. API ROUTES

Full inventory, 47 route files. Grouped by area. (Methods column lists all HTTP methods exported by that file.)

### Auth
| Route | Methods | Auth | Notes |
|---|---|---|---|
| `/api/auth/register` | POST | none | Step 1 signup, rate-limited 5/hr |
| `/api/auth/verify-signup-otp` | POST | OTP-gated | Creates User, auto-login |
| `/api/auth/resend-signup-otp` | POST | none | Rate-limited |
| `/api/auth/login` | POST | none | IP + email lockout |
| `/api/auth/logout` | POST | none | Clears cookie |
| `/api/auth/me` | GET | session | Blocks suspended accounts, clears cookie if blocked |
| `/api/auth/me/first-delivery` | GET | optional | Display-only eligibility; fails safe |
| `/api/auth/forgot-password` | POST | none | Anti-enumeration, rate-limited |
| `/api/auth/verify-otp` | POST | none | Issues single-use reset JWT |
| `/api/auth/reset-password` | POST | token-gated | Double verification (JWT + stored hash) |

### Admin
| Route | Methods | Auth | Notes |
|---|---|---|---|
| `/api/admin/loyalty` | GET, POST | admin | List+analytics / manual credit-debit |
| `/api/admin/loyalty/[userId]` | GET | admin | Full ledger for one user |
| `/api/admin/notifications/broadcast` | POST | admin | Test-send or broadcast push |
| `/api/admin/orders/[id]/status` | PATCH | admin | Status update; triggers loyalty/email/push on delivered; **no transition graph enforced** |
| `/api/admin/review-rewards` | GET | admin | List submissions |
| `/api/admin/review-rewards/approve` | POST | admin | Approve/reject, idempotent |
| `/api/admin/review-rewards/delete` | DELETE | admin | Hard delete |
| `/api/admin/users/export` | GET | admin | Exports name+phone for all users |

### Users
| Route | Methods | Auth | Notes |
|---|---|---|---|
| `/api/users` | GET | admin | Order-count aggregation per user |
| `/api/users/[id]` | PATCH | **none found** | **Can set any user's `role` to admin or toggle `isActive` — no visible auth guard** |

### Orders
| Route | Methods | Auth | Notes |
|---|---|---|---|
| `/api/orders` | GET | admin | List/search/filter |
| `/api/orders` | POST | optional | **Legacy** COD creation path, independent of `createOrderCore` |
| `/api/orders/cod` | POST | optional | Primary COD path, delegates to `createOrderCore` |
| `/api/orders/my` | GET | session | Own orders only |
| `/api/orders/[id]` | GET | **none found** | **Exposes full order PII to any caller with the ObjectId** |
| `/api/orders/[id]` | PATCH | **none found** | Second, inconsistent status-update implementation (excludes "cancelled" from its whitelist) |
| `/api/orders/track/[orderId]` | GET | none (by design) | Public guest tracking, projected fields |

### Payments / Razorpay
| Route | Methods | Auth | Notes |
|---|---|---|---|
| `/api/payment/create-order` | POST | optional | Computes authoritative total server-side, creates Razorpay order |
| `/api/payment/verify` | POST | optional | HMAC signature verify, delegates to `createOrderCore` |
| `/api/payment/webhook` | POST | signature-verified | **Stub** — verifies+dedupes only, never creates/reconciles an order |

### Loyalty / Delivery
| Route | Methods | Auth | Notes |
|---|---|---|---|
| `/api/loyalty` | GET, POST | session | Balance+history / redeem, idempotent by orderId |
| `/api/delivery/eligibility` | GET | optional | First-order-free-delivery check only, no geography |

### Products / Reviews
| Route | Methods | Auth | Notes |
|---|---|---|---|
| `/api/products` | GET | none | Search/filter, CDN-cached (`revalidate=30`) |
| `/api/products` | POST | **none found** | Product create — relies on admin-only UI, not route-level auth |
| `/api/products/[id]` | GET | none | — |
| `/api/products/[id]` | PATCH, DELETE | **none found** | Update/delete with no visible auth |
| `/api/reviews` | GET | none | List (public/admin-filtered) |
| `/api/reviews` | POST | none (client-side only, per code comment) | Auto-approved on submit |
| `/api/reviews/[id]` | PATCH, DELETE | **none found** | Moderation actions unguarded at the route level |

### Review-Reward / Notifications / Push / Misc
| Route | Methods | Auth | Notes |
|---|---|---|---|
| `/api/review-reward/submit` | POST | session | One per user |
| `/api/review-reward/status` | GET | optional | — |
| `/api/review-reward/approved` | GET | none | Public wall, name-redacted |
| `/api/notifications` | GET, DELETE | session | Inbox + clear-all |
| `/api/notifications/[id]` | DELETE | session | Ownership enforced by query filter |
| `/api/notifications/[id]/read` | PATCH | session | Idempotent |
| `/api/notifications/read-all` | PATCH | session | — |
| `/api/notifications/preferences` | GET, PATCH | session | — |
| `/api/push/subscribe` | POST | optional | Anonymous allowed |
| `/api/push/unsubscribe` | POST | none | — |
| `/api/push/send-campaign` | POST, GET | cron bearer secret | Twice-daily broadcast, unbounded concurrency (see §12) |
| `/api/shop/status` | GET, POST | GET: none / POST: admin | Fails open if DB unreachable |
| `/api/navbar` | GET | optional | Combined session+loyalty+unread-count endpoint |
| `/api/upload/image` | POST | admin | Cloudinary upload, folder-allowlisted |

**Cross-cutting finding**: the no-visible-auth routes above (`users/[id]` PATCH, `products` POST/PATCH/DELETE, `reviews/[id]` PATCH/DELETE, `orders/[id]` GET/PATCH) contrast with the otherwise-consistent `isAdmin()` pattern used throughout `/api/admin/**`. Whether these are genuinely unguarded or rely on some other mechanism not visible to static analysis is flagged **Needs Verification**, but no guard was found in the route files themselves.

---

## 6. ORDER SYSTEM

### Lifecycle
Cart (client-only, localStorage) → Checkout (client component) → one of:
- **COD**: `POST /api/orders/cod` → shop-open check → COD cap check (`grossTotal < ₹549`) → loyalty redemption validation → `createOrderCore()`.
- **Online**: `POST /api/payment/create-order` (computes authoritative total, creates Razorpay order) → client completes payment → `POST /api/payment/verify` (HMAC verify) → `createOrderCore()`.

`createOrderCore()` (`src/lib/createOrderCore.ts`) is the documented single source of truth: re-validates stock/availability (not price — see §15), decrements stock concurrently, applies Review Reward / first-free-delivery / loyalty redemption, writes the Order at status `"received"` always, fires (all fire-and-forget, non-blocking) Telegram notification, customer/admin emails, and — only via the admin status-update routes, not at creation — eventual loyalty crediting.

### Statuses actually present
`received → preparing → out_for_delivery → delivered`, plus an unused `cancelled` enum value (schema-only, no code path sets it).

### Status transitions
No transition graph is enforced in either status-update route — an admin PATCH can move any order from any status to any other status. The only safeguards are idempotency checks around the `delivered` transition (loyalty award, delivered email/push only fire if `previousStatus !== "delivered"`).

### COD flow
Enforced: shop must be open, `grossTotal < ₹549` (`COD_MAX_ORDER_AMOUNT`, `src/lib/constants.ts`), loyalty redemption re-validated server-side.

### Online payment flow / Razorpay
See §7.

### Cancellation / refund — Not implemented
No cancellation API, no admin cancel button, no Razorpay refund call (`razorpay.payments.refund` never invoked) anywhere in the codebase. Terms and Contact pages advertise a refund process in copy only.

### Kitchen/admin handling
Admin orders page (`src/app/admin/orders/page.tsx`) polls every 5 seconds via `OrderTable.tsx` (`setInterval`, no visibility-pause), fetching the full order list (no DB-level date bound).

### Telegram notifications
One call site only: `notifyAdminTelegram()` inside `createOrderCore.ts`, fire-and-forget, fires exactly once per order (no duplicate-send risk since it lives in the shared core, and the Razorpay duplicate-payment guard skips a second call on replay).

### Order completion / loyalty / review effects
Loyalty points are earned **only** when an admin marks an order `delivered` (not at order creation), rate 1pt/₹10 on orders ≥₹189, idempotent via ledger-existence check. Referral bonuses (+50 referrer / +25 referee) fire once, on the referee's first delivered order, via atomic CAS. The `Review` model is **not** linked to orders/purchases at all — it's a free-standing testimonial system, auto-approved by default. The separate "Review Reward" (Instagram promo) system is unrelated to post-purchase reviews.

---

## 7. CART

- **Architecture**: Zustand + `persist` middleware, `localStorage`-only (`src/store/cartStore.ts`), key `"foodknock-cart-v1"`, schema version 3 with a `migrate()` that wipes the cart on any mismatch. `MAX_CART_ITEMS = 50`.
- **No server sync** — purely client-side state until checkout.
- **Quantity updates**: clamped to the `stock` value captured at add-to-cart time (can go stale until checkout re-validates server-side).
- **Product/price validation**: stock and availability are re-validated server-side at order creation (via `Product.find`), but **price is never re-validated against the DB** (see §15 — the critical finding).
- **Coupon interaction**: no coupon system exists anywhere in the codebase (confirmed by targeted grep — a cart-page "tag" icon is the only coupon-adjacent artifact, and it's cosmetic/unused).
- **Loyalty interaction**: redemption request flows from client cart/checkout state but is clamped server-side against the live `User.loyaltyPoints` balance.
- **Delivery interaction**: delivery fee is computed server-side from hardcoded constants (`src/lib/delivery.ts`), not client-supplied.
- **Duplicate/unnecessary API calls**: on pages like `my-orders`, both the page's own `useEffect` and the `<Navbar>` it renders independently call session-checking endpoints (`/api/auth/me` and `/api/navbar` respectively) on the same page load.

---

## 8. RAZORPAY

- **Order creation**: `src/app/api/payment/create-order/route.ts` — computes `finalAmount` server-side (client item prices + server delivery/platform fee − server-validated loyalty discount, floored at ₹1), calls `razorpay.orders.create({amount: finalAmount*100, currency:"INR", receipt, notes})`.
- **Payment verification**: `src/app/api/payment/verify/route.ts` — HMAC-SHA256 over `orderId|paymentId` using `RAZORPAY_KEY_SECRET`, compared via `!==` string equality (not `crypto.timingSafeEqual` — minor hardening gap, low practical risk given signature entropy). On mismatch, order is never created.
- **Webhook**: `src/app/api/payment/webhook/route.ts` — verifies `x-razorpay-signature` via HMAC over the raw body. On `payment.captured`, only **checks** for an existing order by `razorpayPaymentId` and logs — **never creates one if absent** (explicit TODO-style comment in the code). This means a payment captured without a completing client request leaves Razorpay holding money with no corresponding Order document, and the webhook does not compensate.
- **COD vs online**: COD orders never populate `razorpayOrderId`/`razorpayPaymentId` (intentionally, documented in the Order model header, to keep the sparse unique index collision-free).
- **Duplicate payment/order protection**: `createOrderCore.ts` checks `Order.findOne({razorpayPaymentId})` before any stock mutation and returns the existing order if found — guards against double-submit/race with the webhook. Backed by a DB-level `unique: true, sparse: true` index on `razorpayPaymentId`.
- **Refund logic**: not implemented — no `razorpay.refunds.*`/`razorpay.payments.refund` call anywhere.
- **Security concern**: the Razorpay *charge amount itself* is derived from client-submitted item prices (same root cause as §15's pricing finding) — so while the DB order total and the Razorpay charge stay internally consistent with each other, neither is anchored to the true `Product.price`.

---

## 9. PRODUCTS / MENU

- **Model**: single `Product` schema (`src/models/Product.ts`), no separate `Category` collection — category is a plain String field. No variants/options.
- **Menu list**: `src/app/(main)/menu/page.tsx` — server component, `force-dynamic` (explicitly, to avoid a prior ISR-write cost blowup — see §12), fetches `Product.find({isAvailable:true})` with a narrow projection, `.lean()`, custom `serializeMongoDocs()` for perf. All search/filter/sort happens **client-side** in `MenuClient.tsx` over the full result set — no pagination, no server-side query params driving the DB query.
- **Product detail**: `src/app/(main)/menu/[slug]/page.tsx` — also `force-dynamic`; `getProduct()` wrapped in React `cache()` to dedupe the metadata/page double-fetch; upsell+related products merged into a single `.limit(7)` query (previously two separate queries).
- **Images / Cloudinary**: `src/lib/cdnImage.ts` injects `f_auto,q_auto:eco,fl_progressive,dpr_auto,w_{bucket},c_limit` into Cloudinary URLs, bucketed to the nearest 100px for CDN cache-hit sharing. Non-Cloudinary URLs pass through unchanged. Product create/update routes reject raw base64 image payloads — images must already be a Cloudinary URL obtained via `/api/upload/image` (folder-allowlisted: `foodknock/products` or `foodknock/notifications` only).
- **Product API**: `GET /api/products` supports category/slug/search/featured filters; free-text search uses a hand-rolled `escapeRegex()` to avoid ReDoS; `.maxTimeMS(8000)` guard; CDN-cached (`revalidate=30`, `s-maxage=60`). No pagination — full filtered result returned in one response. Slug uniqueness on create/update uses a sequential `while(await Product.findOne(...))` loop — bounded in practice but technically O(n) round trips on name collisions.

---

## 10. ADMIN PANEL

| Area | Configurable via UI | Hardcoded / needs code change |
|---|---|---|
| Dashboard | — | Lifetime-revenue aggregate has no date bound (perf risk, not a config gap) |
| Orders | Status updates (no transition enforcement) | — |
| Products | Full CRUD (name/price/stock/images/featured/availability) | — |
| Users | View, VIP/repeat flagging | VIP threshold ₹2000, repeat-order threshold 3 — `src/app/admin/users/page.tsx` |
| Loyalty | Manual credit/debit, view ledger | Tier labels/thresholds (Zero/Low/Active/VIP) hardcoded in the admin page |
| Review Rewards | Approve/reject/delete | Reward-item choice is burger/pizza only (enum) |
| Reviews | Approve/reject (via ReviewTable) | Auto-approval default (`isApproved: true`) is a model default, not a toggle |
| Notifications | Compose and broadcast/test push | — |
| Coupons | **No UI — feature does not exist** | N/A |
| Delivery pricing | **No UI** | `MIN_ORDER_AMOUNT=189`, `FREE_DELIVERY_AT=339`, `FLAT_DELIVERY_FEE=29`, `PLATFORM_FEE=1` — `src/lib/delivery.ts` |
| COD cap | **No UI** | `COD_MAX_ORDER_AMOUNT=549` — `src/lib/constants.ts` |
| OTP/security tunables | **No UI** | Expiry/attempt/lockout constants — `src/lib/otp.ts` |
| Shop open/closed | Yes — toggle on dashboard | Backed by `Shop` model |

Admin orders list and dashboard revenue aggregate both do unbounded full-collection work (see §4, §12).

---

## 11. TELEGRAM / NOTIFICATIONS

- **Telegram**: single function `notifyAdminTelegram()` in `src/lib/createOrderCore.ts`, raw `fetch` to the Bot API. Missing env vars → silent no-op (order still succeeds). Fires exactly once per order (lives in the shared order-creation core, not duplicated per payment method). Fire-and-forget — never blocks or fails the order response.
- **Web Push**: service worker (`public/sw.js`) handles FCM-wrapped and raw payload shapes, validates click-through URLs against an allowlist, generates unique tags so sequential status pushes don't overwrite each other in the tray, and focuses an existing same-origin window on click rather than opening duplicates.
- **Admin broadcast**: `src/app/api/admin/notifications/broadcast/route.ts` — admin-gated, test-mode (send to self) or full broadcast; rich-payload fields are allow-listed, invalid values silently dropped rather than erroring.
- **Order status change notifications**: on transition to `delivered`, fires loyalty award (fire-and-forget), delivered email (awaited, skipped for guest orders), and a combined push+WhatsApp event emission. The route's own comment acknowledges its try/catch can only catch synchronous construction errors, not async delivery failures inside the notification engine — a documented, known limitation.
- **Email**: `src/lib/mailer.ts`, provider-agnostic SMTP, lazily-cached transporter singleton. Four templates (welcome, order-confirmation, admin-alert, delivered). All fire-and-forget relative to the order-creation response.
- **WhatsApp**: full provider exists (`src/lib/notifications/providers/whatsappProvider.ts` + client/templates/phone-format helpers), wired into the generic event engine for `order.delivered` and signup OTP.
- **Duplicate-notification risk**: low — the architecture's "single source of truth" pattern (one core function, one call site) consistently prevents double-sends across the payment-method branches that were sampled.

---

## 12. SEO

- **Root metadata** (`src/app/layout.tsx`): full title template, description, OpenGraph, Twitter card, icons, keywords, `robots` directives (index/follow, max-image-preview, max-snippet), canonical (`alternates.canonical`), and a single `FoodEstablishment` JSON-LD block (name/address/geo/hours/cuisine/price range) injected into every page.
- **Dynamic metadata**: only `src/app/(main)/menu/[slug]/page.tsx` has a true `generateMetadata()` — per-product title/description/OpenGraph image/Twitter card, deduped against the page body via React `cache()`. It does **not** set a per-product canonical URL — a gap.
- **Static per-page metadata**: menu list, founders, contact, reviews, loyalty, my-orders, track-order, cart layouts.
- **No explicit metadata** (falls back to root defaults): home page, checkout, privacy, terms, review-rewards, auth, and the dynamic order-detail pages (`my-orders/[orderId]`, `track-order/[orderId]` — no per-order `<title>`).
- **Sitemap** (`src/app/sitemap.ts`): static routes + dynamically generated `/menu/{slug}` entries for every available product; wrapped in try/catch so a DB outage degrades to static-only. `checkout`, `founders`, `review-rewards`, and order-detail pages are intentionally/incidentally excluded.
- **Robots** (`src/app/robots.ts`): allows `/`, disallows `/admin/`, `/api/`, `/order-success/`.
- **Structured data**: only the one site-wide `FoodEstablishment` block — no per-product `Product`/`Offer` schema, no `BreadcrumbList`, no `FAQPage`.
- **Indexability**: generally sound for the main content pages; product-detail canonical is the one notable gap for a page type that matters for SEO.

---

## 13. PERFORMANCE

### Server vs Client Components
Home, menu list, and menu detail are server components with server-side data fetching. However, **cart, checkout, my-orders, track-order, loyalty, and review-rewards are all `"use client"`** and fetch their data via `useEffect` after mount — producing a loading-skeleton → content swap rather than SSR content. Several of these files also carry a dead `export const dynamic = "force-dynamic"` (a no-op on client components, left over from copy-paste).

### useEffect / duplicate fetching
`<Navbar>` is mounted independently by all 18 pages under `(main)/` (no shared layout exists for that route group), so its own `/api/navbar` fetch (JWT verify + `User.findById` + conditional loyalty aggregate) re-runs on every single navigation, stacked on top of whatever the page itself fetches. On `my-orders`, both the page and the Navbar independently verify the session on the same load.

### Caching / revalidation
Nearly every page route is `export const dynamic = "force-dynamic"`, with explicit in-code comments stating this replaced a prior `revalidate`/ISR setup that was "causing 1.4M ISR writes on Vercel." The trade-off made was: eliminate ISR write costs by removing caching entirely, rather than tuning the revalidation window. Only two API routes have any CDN-level caching at all (`/api/products` — `revalidate=30`, `s-maxage=60`; `/api/shop/status` — `revalidate=10`, `s-maxage=10`). Every page-rendering route that a real user actually navigates to has zero caching.

### Polling
- Admin `OrderTable.tsx`: `setInterval` every 5 seconds, no pause on tab-hidden, fetching up to 200 orders with `cache:"no-store"` — up to 720 queries/hour per open admin tab.
- No polling found on any customer-facing page (my-orders, track-order) despite UI copy suggesting "live" status — status only updates on manual reload.

### Navigation / scroll restoration (the Back-button bug)
No explicit `scrollTo(0,0)`-on-navigation anti-pattern was found anywhere in the codebase — the three `scrollTo`/`scrollRestoration` hits that exist are all deliberate, user-triggered UI behaviors (category jump-to, back-to-top button, pagination scroll), not automatic on-mount resets. No `AnimatePresence`/framer-motion page-transition wrapper exists around the route tree. The most probable code-grounded mechanism (not confirmed by a live repro) is that the affected pages are the same `"use client"` pages that render a short loading skeleton before their real (taller) content mounts a beat later — the browser/Next.js scroll-restoration offset gets computed against the skeleton's shorter document height, then visually "loses" the intended position once real content expands the page. This is corroborated by the fact that every page in the suspect list (cart, checkout, my-orders, track-order, loyalty, review-rewards) shares the identical skeleton→fetch→content pattern.

### Vercel / CPU (see §14 for full treatment)
No reconnect-per-request issue (connection caching is correct). No Edge-runtime usage anywhere (consistent with Mongoose's Node-only requirement). The push-campaign cron is the single highest-confidence concrete CPU-spike source identified (§14).

---

## 14. VERCEL / SERVERLESS

- **Runtime**: no route opts into the Edge runtime (`export const runtime` not found anywhere) — everything runs on Node.js serverless/Fluid functions, consistent with Mongoose usage.
- **Crons**: two, both hitting `/api/push/send-campaign` (morning/evening), bearer-secret authenticated.
- **DB connection reuse**: correctly cached (`src/lib/db.ts`), not a contributor.
- **Middleware cost**: negligible — runs only on `/admin/*`, checks cookie presence only, no DB call.
- **Identified concrete CPU-cost contributors** (ranked by confidence):
  1. **High confidence**: the push-campaign cron (`src/app/api/push/send-campaign/route.ts` → `broadcastCampaign()` → `webPushProvider.ts`) fetches **all** active `PushSubscription` documents with no limit, then runs per-subscriber preference checks and `webpush.sendNotification()` calls (VAPID JWT signing + ECDH + AES-GCM encryption — genuinely CPU-bound crypto) **all concurrently with no batching/throttling**, twice a day. This produces a workload shape — O(subscriber-count) crypto ops, unbounded parallelism, in a short burst, on a fixed cron schedule — that matches what "Fluid Active CPU spikes" typically look like.
  2. **High confidence**: every page route being `force-dynamic` with zero caching (documented trade-off vs. a prior ISR-write-cost problem) means page-view volume translates almost linearly into serverless invocation + live-DB-query volume, with no CDN layer absorbing repeat traffic.
  3. **Medium-high confidence**: the per-navigation `<Navbar>` remount (no shared layout) doubles up server work (session verify + loyalty aggregate) on top of each page's own data fetch, on every single client-side navigation across the whole public site.
  4. **Low-medium confidence**: admin 5-second order polling, uncapped by tab visibility — real but likely small in absolute volume (admin-only, few concurrent sessions).

The user's own report of "high Fluid Active CPU usage" is treated here as a reported concern, not proven to any single cause — items 1-2 above are the strongest code-level candidates but confirming which actually dominates billed CPU-ms requires looking at Vercel's own function-level usage breakdown (**Needs Verification / Needs Measurement**, see §20).

---

## 15. SECURITY

### Critical
- **Client-trusted order pricing.** In `src/app/api/orders/route.ts`, `src/app/api/orders/cod/route.ts`, `src/lib/createOrderCore.ts`, and `src/app/api/payment/create-order/route.ts`, each cart item's `price` is taken verbatim from the client request body and used to compute `subtotal`/`totalAmount`/the Razorpay charge amount. The `Product` documents fetched for the same request are used only to check `stock`/`isAvailable`/existence by `_id` — `product.price` is never read to override the submitted value. A modified client request (devtools, intercepted fetch, scripted client) can place COD or paid orders at arbitrary, attacker-chosen prices for real products.

### High
- **No visible server-side auth** on: `PATCH /api/users/[id]` (role/isActive changes — effectively an admin-privilege-escalation vector if reachable), `POST /api/products`, `PATCH`/`DELETE /api/products/[id]`, `PATCH`/`DELETE /api/reviews/[id]`, `GET`/`PATCH /api/orders/[id]` (the GET additionally exposes customer PII — name/phone/address — to any caller who has or guesses a valid ObjectId).
- **No session revocation**: a stolen/leaked JWT remains valid for its full 7-day life regardless of "logout"; `isActive=false` is checked on subsequent requests but the token itself is never invalidated.

### Medium
- **No general-purpose rate limiting** on `/api/orders`, `/api/orders/cod`, `/api/payment/create-order`, `/api/payment/verify`, or API traffic generally — only OTP requests and login attempts have DB-backed throttling. Combined with the pricing issue, this raises the ceiling on scripted-abuse damage before detection.
- **Razorpay signature comparison** uses `!==` string equality rather than `crypto.timingSafeEqual` — a minor timing-attack surface, low practical severity given the signature's entropy and short validity window.
- **Razorpay webhook does not reconcile orphaned captures** (see §8) — not an exploitable vulnerability per se, but an operational/financial-reconciliation gap.

### Well-implemented (for contrast)
- Password/OTP hashing, layered login brute-force defense, anti-enumeration responses, single-use password-reset tokens with a distinct signing secret, server-side-clamped loyalty redemption (never trusts the client's requested point amount beyond using it as a request), admin-route auth (consistently present on every `/api/admin/**` route actually sampled), Cloudinary upload folder-allowlisting and file-type/size validation, secrets uniformly read via `process.env.*` with no hardcoded credentials observed.

### Coupon/loyalty abuse — Needs Verification / low risk as designed
No coupon system exists to abuse. Loyalty redemption is independently re-derived and capped server-side (20% of order value, min 50 points, live balance check) — the client's requested redemption is a request, not a trusted value.

---

## 16. CURRENT BUSINESS RULES

| Rule | Value | Hardcoded or DB/config-driven |
|---|---|---|
| Minimum order amount | ₹189 | Hardcoded — `src/lib/delivery.ts` |
| Free delivery threshold | ₹339 | Hardcoded — `src/lib/delivery.ts` |
| Flat delivery fee | ₹29 (no zones/distance) | Hardcoded — `src/lib/delivery.ts` |
| Platform fee | ₹1 | Hardcoded — `src/lib/delivery.ts` |
| First-order free delivery | Free if logged in, delivery type, never used before, 0 prior delivered orders | Logic hardcoded; per-user flags DB-stored (`User` model) |
| COD max order amount | < ₹549 | Hardcoded — `src/lib/constants.ts` |
| COD availability | Logged-in users only; under cap; shop open | Hardcoded logic |
| Loyalty earn rate | 1 pt / ₹10 spent, orders ≥ ₹189, credited on delivery (not creation) | Hardcoded — `src/lib/loyaltyService.ts` |
| Loyalty redemption | Min 50 pts; max 20% of order value; 1 pt = ₹0.5 | Hardcoded (duplicated in two files — `loyaltyService.ts` and `delivery.ts` — must be kept in sync manually) |
| Referral rewards | +50 referrer / +25 referee, once, on referee's first delivered order | Hardcoded |
| Coupon system | Does not exist | N/A |
| Service area / delivery zones | Does not exist — no geographic restriction anywhere | N/A |
| Product availability | Per-product `isAvailable`/`stock` flags | DB-driven via admin UI |
| Order cancellation | Not implemented | N/A |
| Refund policy | Not implemented (advertised in marketing copy only) | N/A |
| Shop open/closed | Global toggle | DB-driven via admin UI |
| Review Reward (Instagram promo) | One free item/account, admin-approved, auto-applied once subtotal ≥ ₹150 | Threshold hardcoded; approval DB-driven |

---

## 17. FEATURE INVENTORY

| Feature | Status | Evidence/File | Notes |
|---|---|---|---|
| Signup with OTP | Fully Implemented | `src/app/api/auth/register`, `verify-signup-otp` | Email OTP primary, WhatsApp secondary |
| Login with brute-force protection | Fully Implemented | `src/app/api/auth/login`, `src/lib/loginSecurity.ts` | IP + email layered lockout |
| Password reset | Fully Implemented | `forgot-password`→`verify-otp`→`reset-password` | Dual JWT+hash verification |
| Phone/SMS verification | Missing | — | Phone collected but never independently verified |
| Admin role/auth | Fully Implemented | `src/app/admin/layout.tsx` | DB-backed, 3-layer defense |
| Session revocation | Missing | — | Stateless JWT, no blacklist |
| Order creation (COD) | Fully Implemented (duplicated) | `createOrderCore.ts`, `/api/orders/cod`, legacy `/api/orders` | Two independent implementations |
| Order creation (Razorpay) | Fully Implemented | `/api/payment/create-order`, `/verify` | Server-authoritative pricing of fees, not item price |
| Razorpay webhook reconciliation | Partially Implemented | `/api/payment/webhook` | Verifies+dedupes only, never creates orders |
| Order status transitions | Partially Implemented | two separate PATCH routes | No transition graph; inconsistent status whitelists |
| Order cancellation | Missing | — | Enum value exists, no code path |
| Refunds | Missing | — | Marketing copy only |
| Loyalty points | Fully Implemented | `src/lib/loyaltyService.ts` | Earned on delivery, redeemed with server-side caps |
| Referral rewards | Fully Implemented | `createOrderCore.ts` | Atomic CAS, one-time |
| Coupons | Missing | — | No model/API/UI found |
| Cart | Fully Implemented (client-only) | `src/store/cartStore.ts` | No server sync |
| Price integrity at checkout | **Missing / Critical Gap** | `createOrderCore.ts`, order routes | Client-submitted price trusted |
| Product CRUD | Fully Implemented (UI); auth gap at route level | `/api/products*` | See §15 |
| Menu search/filter | Fully Implemented (client-side only) | `MenuClient.tsx` | Full dataset sent to browser |
| Admin dashboard | Fully Implemented | `src/app/admin/page.tsx` | One unbounded aggregate |
| Admin order list | Fully Implemented, unscaled | `src/app/admin/orders/page.tsx` | Full-collection fetch |
| Telegram order alerts | Fully Implemented | `createOrderCore.ts` | Single call site, no dup risk |
| Web Push notifications | Fully Implemented | `public/sw.js`, `webPushProvider.ts` | Unbounded broadcast concurrency |
| WhatsApp notifications | Fully Implemented | `src/lib/notifications/whatsapp/*` | Used for OTP + order.delivered |
| Email notifications | Fully Implemented | `src/lib/mailer.ts` | 4 templates, fire-and-forget |
| SEO metadata | Fully Implemented (main pages); gap on product canonical | `src/app/layout.tsx`, `menu/[slug]` | — |
| Sitemap/robots | Fully Implemented | `sitemap.ts`, `robots.ts` | — |
| Structured data | Partially Implemented | root layout only | Site-wide only, no per-product schema |
| Scroll restoration on Back | Needs Verification (bug reported) | suspect: skeleton-first client pages | No forced scrollTo(0,0) found; likely layout-shift cause |
| Automated tests | Missing | — | No test files/config anywhere |
| Marketing automation engine | Needs Verification | `src/lib/automation/**`, 4 models | Infra present; activation/usage extent unconfirmed |

---

## 18. ARCHITECTURE MAP

```
Customer (browser)
   │
   ▼
Frontend (Next.js App Router, React 19)
   ├─ Server Components: home, menu list/detail  → direct Mongoose queries, force-dynamic
   └─ Client Components: cart, checkout, my-orders, track-order, loyalty, review-rewards
          → useEffect → fetch → API routes
   │
   ▼
API / Server Layer (src/app/api/**/route.ts, Node.js runtime, Vercel Fluid)
   ├─ Auth: register/login/logout/me/forgot-reset-password (JWT + bcrypt, src/lib/auth.ts)
   ├─ Orders: /orders/cod, /orders (legacy), /orders/[id], /orders/my, /orders/track
   │     → src/lib/createOrderCore.ts (single source of truth: stock, loyalty, review-reward,
   │        first-free-delivery, order write)
   ├─ Payments: /payment/create-order, /payment/verify, /payment/webhook
   │     → Razorpay SDK (order creation, HMAC signature verification)
   ├─ Admin: /admin/** (orders status, loyalty, review-rewards, users export, notifications broadcast)
   │     → gated by src/app/admin/layout.tsx (DB-backed role check)
   ├─ Products/Reviews/Loyalty/Notifications/Push/Shop status — see §5
   └─ middleware.ts — cookie-presence pre-filter for /admin/* only
   │
   ▼
Database (MongoDB via Mongoose, src/lib/db.ts cached connection)
   16 models: User, Order, Product, Shop, LoginAttempt, PendingSignup, LoyaltyLedger,
   NotificationLog, PushSubscription, Review, ReviewReward, Booking,
   AutomationRule/Execution/UserState/WindowClaim
   │
   ▼
External Services
   ├─ Razorpay — payment order creation + signature verification (no refund calls)
   ├─ Cloudinary — image hosting + on-the-fly transforms (src/lib/cdnImage.ts)
   ├─ Telegram Bot API — admin order alerts (single call site, fire-and-forget)
   ├─ Web Push (VAPID) — browser push via service worker (public/sw.js)
   ├─ WhatsApp provider — OTP + order.delivered messages
   ├─ SMTP (nodemailer) — welcome/OTP/order-confirmation/admin-alert/delivered emails
   └─ Vercel Cron — twice-daily push-campaign broadcast trigger
```

---

## 19. IMPORTANT FILE MAP

| Area | Key files | Purpose | Risk/Importance |
|---|---|---|---|
| DB connection | `src/lib/db.ts` | Cached Mongoose connection | High — single point of failure for every request |
| Auth core | `src/lib/auth.ts`, `src/lib/otp.ts`, `src/lib/loginSecurity.ts` | Hashing, JWT signing, brute-force tracking | High — security-critical, well-implemented |
| Order creation | `src/lib/createOrderCore.ts` | Single source of truth for order writes | Critical — contains the client-trusted-price gap |
| Legacy order route | `src/app/api/orders/route.ts` | Independent duplicate order-creation path | High — drift risk, should be reconciled/removed |
| Razorpay | `src/app/api/payment/create-order`, `/verify`, `/webhook` | Payment lifecycle | High — webhook is a stub, reconciliation gap |
| Loyalty | `src/lib/loyaltyService.ts`, `src/models/LoyaltyLedger.ts` | Points earn/redeem, immutable ledger | Medium — well-guarded |
| Delivery/business rules | `src/lib/delivery.ts`, `src/lib/constants.ts` | Pricing constants | Medium — all hardcoded, no admin config |
| Cart | `src/store/cartStore.ts` | Client-only cart state | Medium — no server sync, price not re-validated until order write |
| Admin gate | `src/app/admin/layout.tsx`, `src/middleware.ts` | Role/auth enforcement for admin routes | High — correct as implemented, but pattern not shared/reusable |
| Unguarded routes | `src/app/api/users/[id]`, `src/app/api/products/route.ts` + `[id]`, `src/app/api/reviews/[id]`, `src/app/api/orders/[id]` | Mutations with no visible auth check | Critical — needs verification + fix |
| Notifications engine | `src/lib/notifications/**`, `src/lib/mailer.ts`, `public/sw.js` | Push/WhatsApp/email dispatch | Medium — generally well-isolated, fire-and-forget |
| Push broadcast | `src/lib/webpush.ts`, `src/lib/notifications/providers/webPushProvider.ts` | Cron-triggered mass push | High — unbounded concurrency, likely CPU-spike source |
| SEO | `src/app/layout.tsx`, `sitemap.ts`, `robots.ts`, `menu/[slug]/page.tsx` | Metadata, structured data | Low-Medium — mostly solid, product canonical gap |
| Navbar | `src/components/shared/Navbar.tsx` | Session/loyalty/notification display, no shared layout | Medium — remounts and refetches on every navigation |

---

## 20. CURRENT PROBLEMS / OBSERVATIONS

### A. Website/page loading feels slow
**What the code does**: Every page-rendering route (`force-dynamic`) performs a live Mongo query (or several) on every request with zero caching, by deliberate design (documented trade-off against a prior ISR-write-cost problem). On top of that, client-fetched pages (cart, checkout, my-orders, etc.) add a client-side round trip after mount, and every page independently remounts `<Navbar>` which performs its own session+loyalty fetch.
**Evidence**: `src/app/(main)/menu/page.tsx` comments (lines 1-16), `src/app/(main)/my-orders/page.tsx` (useEffect fetch chain), `src/components/shared/Navbar.tsx` (per-mount fetch), absence of a shared `(main)/layout.tsx`.
**Likely contributing patterns**: no caching layer for pages; stacked session checks; client-side data-fetching waterfalls on several high-traffic pages.
**Confidence**: High that these patterns exist and are capable of causing perceived slowness; Medium on exact magnitude without real traffic/timing data.
**What to measure next**: Vercel's per-route response-time breakdown; a waterfall trace (browser devtools) of a cold navigation to `my-orders` or `checkout`; whether `/api/navbar` latency is a meaningful fraction of page load.

### B. Browser Back returns to the top instead of preserving scroll/state
**What the code does**: No code path forcibly resets scroll on navigation — this was actively searched for and not found. The pages affected by user reports (cart, checkout, my-orders, track-order, loyalty, review-rewards) are all `"use client"` pages that render a short loading skeleton before real content mounts.
**Evidence**: `grep -rn "scrollTo|scrollRestoration"` → only 3 hits, all deliberate/user-triggered (`MenuClient.tsx`, `ProductGrid.tsx`); no `usePathname`-driven scroll reset in `src/app/layout.tsx`; no `AnimatePresence` wrapping the route tree.
**Likely contributing pattern**: scroll-restoration offset is computed/restored against the skeleton's shorter document height; by the time real (taller) content mounts, the restored offset no longer corresponds to the same visual position — perceptible as "jumped to top."
**Confidence**: Medium — this is a plausible, code-grounded mechanism consistent with every affected page sharing the same skeleton-first pattern, but it was not confirmed by reproducing the bug live in a browser.
**What to measure next**: reproduce in a real browser with devtools' "Preserve log" and the Back/Forward cache enabled/disabled; check whether the issue persists if the skeleton is temporarily given the same approximate height as the real content; check whether Next.js's `bfcache`/scroll-restoration behaves differently for soft (client-router) vs. hard navigations.

### C. Vercel Fluid Active CPU usage has been unusually high
**Treated strictly as a reported infrastructure concern — not attributed to a single proven cause.**
**What the code does**: (1) the twice-daily push-campaign cron fetches all active subscriptions with no limit and fires unbounded-concurrency `webpush.sendNotification()` calls (per-message VAPID/ECDH/AES-GCM crypto) for every one of them in parallel in a single invocation; (2) every page route is `force-dynamic` with no caching, so CPU cost scales close to linearly with page-view volume; (3) every navigation remounts `<Navbar>`, adding a second server round trip per page view.
**Evidence**: `src/lib/notifications/providers/webPushProvider.ts` (`PushSubscription.find({isActive:true})` no limit; `Promise.all` over all subscribers), `vercel.json` (cron schedule), in-code comments in `menu/page.tsx`/`menu/[slug]/page.tsx`/`products/[id]/route.ts` documenting the force-dynamic trade-off.
**Confidence**: High that items (1) and (2) are real, identifiable workload shapes capable of producing CPU spikes; **not** confirmed which one dominates actual billed CPU-ms, or whether both together fully explain the reported usage level.
**What to measure next**: Vercel's function-level CPU/duration breakdown by route (especially `/api/push/send-campaign` vs. page-rendering routes) over a time window that includes a 05:30/10:30 UTC cron firing; current active-subscriber count (to estimate the cron's actual fan-out); whether CPU spikes correlate with cron firing times or with general traffic volume.

---

## 21. CLOSING NOTE

This audit is strictly observational. No source files, configuration, dependencies, or database schemas were modified in the course of producing it. Items marked **Needs Verification** should be confirmed by direct testing/measurement before any remediation work is scoped, particularly: the exact runtime reachability of the no-visible-auth routes (§15), the live reproduction of the Back-button scroll issue (§20B), and the Vercel function-level CPU breakdown (§20C).


{
  _id: ObjectId('6aca3bc09155bef35bec1ea3'),
  name: 'Kajal Sharma',
  dob: ISODate('2026-01-08T00:00:00.000Z'),
  email: 'walow91306@18lover.com',
  phone: '9878766738',
  password: '$2b$10$Ycfc./D/C1h/m1kJTyBpvehfdwdc8It8LPIGC9ajUUSbGq1uAjovG',
  role: 'user',
  address: {
    line1: '',
    line2: '',
    city: 'GUSAINSAR',
    state: 'Rajasthan',
    pincode: '334001',
    landmark: ''
  },
  isActive: true,
  loyaltyPoints: NumberInt('0'),
  referralCode: 'KAJ0ZDSE',
  referredBy: null,
  referralRewardGranted: false,
  deliveredOrderCount: NumberInt('0'),
  firstDeliveryFreeUsed: false,
  createdAt: ISODate('2026-10-10T13:21:04.778Z'),
  updatedAt: ISODate('2026-10-10T13:21:04.778Z'),
  __v: NumberInt('0')
}
,
