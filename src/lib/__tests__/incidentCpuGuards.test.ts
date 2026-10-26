// src/lib/__tests__/incidentCpuGuards.test.ts
//
// Regression guards for the Vercel Fluid Active-CPU incident remediation.
// Same source-text-invariant pattern as structuredDataInvariants.test.ts —
// the things being guarded are route-segment config and a React client
// component's effect wiring, neither of which is an importable pure function,
// so these are deliberately file-content checks (no DB, no DOM), not a
// render test. Each is paired with the exact behaviour it protects.
//
//   npx tsx --test src/lib/__tests__/incidentCpuGuards.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const REPO_ROOT = path.resolve(import.meta.dirname, "../../..");
const read = (p: string) => fs.readFileSync(path.join(REPO_ROOT, p), "utf-8");

// Strip `//` line comments and `{/* ... */}` JSX comments so the regexes
// below only ever match real code — never this file's or the target file's
// explanatory prose (which necessarily mentions "force-dynamic" etc).
function stripComments(src: string): string {
    const withoutJsx = src.replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
    return withoutJsx.split("\n").filter((l) => !l.trim().startsWith("//")).join("\n");
}

// ── Fix 1 — static content pages must stay statically rendered ────────────
//
// These four pages read NO per-request/server data (compile-time-constant
// JSX + metadata). They must be force-static so every visit (including bot/
// crawler hits) is served from the CDN instead of invoking a serverless
// function and burning Active CPU. Re-introducing force-dynamic here, or
// adding a DB/model import, would silently reintroduce the regression.
const STATIC_CONTENT_PAGES = [
    "src/app/(main)/faq/page.tsx",
    "src/app/(main)/privacy/page.tsx",
    "src/app/(main)/terms/page.tsx",
    "src/app/(main)/contact/page.tsx",
];

for (const page of STATIC_CONTENT_PAGES) {
    test(`static content: ${page} is force-static (served from CDN, no per-request function invocation)`, () => {
        const code = stripComments(read(page));
        assert.match(code, /export const dynamic\s*=\s*["']force-static["']/,
            "page must declare `export const dynamic = \"force-static\"`");
        assert.doesNotMatch(code, /dynamic\s*=\s*["']force-dynamic["']/,
            "page must NOT be force-dynamic — it has no per-request data and must not invoke a function per visit");
    });

    test(`static content: ${page} reads no per-request server data (no DB / model / connectDB import)`, () => {
        const code = stripComments(read(page));
        assert.doesNotMatch(code, /from\s+["']@\/lib\/db["']/, "no DB connection import");
        assert.doesNotMatch(code, /from\s+["']@\/models\//, "no Mongoose model import");
        assert.doesNotMatch(code, /\bconnectDB\b/, "no connectDB() call");
        // Any of these would make the page genuinely dynamic and invalidate
        // the force-static decision above.
        assert.doesNotMatch(code, /\b(cookies|headers)\s*\(\s*\)/, "no cookies()/headers() dynamic APIs");
    });
}

// ── Fix 2 — admin order-table live poll must be visibility-gated ──────────
//
// The admin OrderTable polls GET /api/orders every 5s while the tab is open.
// Without visibility gating a backgrounded/idle tab issued a serverless
// invocation + DB read every 5s around the clock. The poll must (a) skip the
// network call while the tab is hidden, (b) re-poll immediately on becoming
// visible (so the live new-order toast/sound is preserved when the admin is
// watching), and (c) still clean up both the interval and the listener.
test("admin OrderTable: live poll is gated on document.visibilityState (no fetch while tab hidden)", () => {
    const code = stripComments(read("src/components/admin/orders/OrderTable.tsx"));
    assert.match(code, /visibilityState\s*===\s*["']hidden["']/,
        "poll must early-return while the tab is hidden");
    assert.match(code, /addEventListener\(\s*["']visibilitychange["']/,
        "must register a visibilitychange listener to re-poll on return");
    assert.match(code, /removeEventListener\(\s*["']visibilitychange["']/,
        "must remove the visibilitychange listener on cleanup (no leak)");
    assert.match(code, /clearInterval\(/,
        "interval cleanup must be preserved");
});

// ── Fix 4 (Phase 6) — home page data cache ────────────────────────────────
//
// The home page is force-dynamic (unchanged) and was running ~8 DB reads +
// aggregation on every request. getHomeData() now sits behind the same
// in-process 30s TTL cache pattern proven on /menu + Shop.ts: public,
// non-personalized, display-only; failures are never cached; checkout stays
// authoritative. Guard the cache shape and that no per-user/private data is
// read into this cached public bundle.
test("home cache: getHomeData() is backed by a bounded in-process TTL cache with in-flight dedup", () => {
    const code = stripComments(read("src/app/(main)/page.tsx"));
    assert.match(code, /HOME_CACHE_TTL_MS\s*=\s*30_000/, "30s TTL constant");
    assert.match(code, /cachedHomeData !== null && Date\.now\(\) < homeCacheExpiresAt/, "fast-path cache hit");
    assert.match(code, /homeCacheInFlight/, "in-flight de-duplication");
    assert.match(code, /function fetchHomeDataFresh/, "fresh fetch is separated from the cache wrapper");
});

test("home cache: a failed refresh is NEVER cached (fetcher re-throws; wrapper serves bounded stale or empty)", () => {
    const code = stripComments(read("src/app/(main)/page.tsx"));
    // fetcher must throw on error (so the wrapper's catch decides), not return
    // an empty object that would get cached for the full TTL as a "success".
    assert.match(code, /throw error/, "fetchHomeDataFresh must re-throw on error");
    assert.match(code, /HOME_STALE_MAX_MS/, "bounded stale fallback ceiling");
    assert.match(code, /homeCacheExpiresAt = Date\.now\(\) \+ HOME_CACHE_TTL_MS/, "expiry set only on success");
});

test("home cache: the cached home bundle contains NO per-user/private data (public, display-only)", () => {
    const code = stripComments(read("src/app/(main)/page.tsx"));
    assert.doesNotMatch(code, /\b(cookies|headers)\s*\(\s*\)/, "no cookies()/headers() in the home data path");
    assert.doesNotMatch(code, /useAuthStore|loyaltyPoints|\btoken\b/, "no auth/loyalty/token data cached");
    assert.doesNotMatch(code, /fetch\(\s*["'`]\/api\//, "no internal API round-trips");
});
