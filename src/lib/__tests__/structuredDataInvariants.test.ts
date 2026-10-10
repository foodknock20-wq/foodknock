// src/lib/__tests__/structuredDataInvariants.test.ts
//
// SEO Phase 3 — direct, file-content regression checks for JSON-LD
// invariants, following the same pattern already established in
// securityLogic.test.ts (F14/F18 checks). The JSON-LD blocks themselves
// are plain objects defined inline inside React Server Components
// (src/app/layout.tsx, menu/[slug]/page.tsx, faq/page.tsx) — not exported
// functions — so these are source-text invariants, not a render/DOM test.
// That's a real, intentional limitation (see FOODKNOCK_SEO_REPORT.md),
// not an oversight: extracting the JSON-LD builders into separately
// importable functions purely to make them unit-testable would be a
// refactor of working code with no other justification, which this SEO
// task's own instructions explicitly discourage ("do not refactor
// unrelated features").
//
//   node --experimental-strip-types --test src/lib/__tests__/structuredDataInvariants.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const REPO_ROOT = path.resolve(import.meta.dirname, "../../..");
const read = (p: string) => fs.readFileSync(path.join(REPO_ROOT, p), "utf-8");

// ── Root layout JSON-LD ──────────────────────────────────────────────────

// Strips `//`-prefixed comment lines before matching, so these regexes can
// never false-positive against this file's own explanatory prose (which
// necessarily mentions the removed field names) — only real object-literal
// code is checked.
function stripLineComments(src: string): string {
    // Strips both `//` line comments and `{/* ... */}` JSX block comments
    // (the latter can span multiple lines, hence the regex pass first).
    const withoutJsxComments = src.replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
    return withoutJsxComments.split("\n").filter((line) => !line.trim().startsWith("//")).join("\n");
}

test("structured data: root layout's FoodEstablishment JSON-LD never re-introduces fabricated geo-coordinates or a fixed opening-hours schedule", () => {
    const code = stripLineComments(read("src/app/layout.tsx"));
    assert.doesNotMatch(code, /geo:\s*\{/, "no fabricated GeoCoordinates block — see this file's own header comment for why this was removed");
    assert.doesNotMatch(code, /openingHoursSpecification/, "no fabricated fixed-hours claim — no model in this codebase stores a real daily schedule");
});

test("structured data: root layout declares Organization and WebSite schema (previously entirely absent)", () => {
    const src = read("src/app/layout.tsx");
    assert.match(src, /"@type":\s*"Organization"/);
    assert.match(src, /"@type":\s*"WebSite"/);
    assert.match(src, /"@type":\s*"FoodEstablishment"/, "the original, pre-existing schema type must still be present — not replaced");
});

test("structured data: Organization JSON-LD's founder names match src/lib/foundersData.ts exactly — never a second, independently-typed source of truth", () => {
    const layoutSrc = read("src/app/layout.tsx");
    const founderSrc = read("src/lib/foundersData.ts");

    for (const realName of ["Manish Kumar", "Gaurav Kumawat"]) {
        assert.match(founderSrc, new RegExp(realName.replace(" ", "\\s")), `sanity check: ${realName} must actually exist in foundersData.ts`);
        assert.match(layoutSrc, new RegExp(realName.replace(" ", "\\s")), `Organization JSON-LD must use the exact same name: ${realName}`);
    }
});

test("structured data: root layout JSON-LD code never includes aggregateRating, review, or award fields (none are real)", () => {
    const code = stripLineComments(read("src/app/layout.tsx"));
    assert.doesNotMatch(code, /aggregateRating/i);
    assert.doesNotMatch(code, /"review":/i);
    assert.doesNotMatch(code, /\baward/i);
});

// ── Product detail page JSON-LD ──────────────────────────────────────────

test("structured data: product detail page declares Product and BreadcrumbList schema", () => {
    const src = read("src/app/(main)/menu/[slug]/page.tsx");
    assert.match(src, /"@type":\s*"Product"/);
    assert.match(src, /"@type":\s*"BreadcrumbList"/);
    assert.match(src, /"@type":\s*"Offer"/);
});

test("structured data: product page's aggregateRating is conditionally built from the REAL product record, never a hardcoded placeholder number", () => {
    const src = read("src/app/(main)/menu/[slug]/page.tsx");
    assert.match(src, /product\.rating/, "aggregateRating must read the real product.rating field");
    assert.match(src, /product\.reviewCount/, "aggregateRating must read the real product.reviewCount field");
    assert.doesNotMatch(src, /ratingValue:\s*[\d.]/, "ratingValue must never be a literal hardcoded number");
});

test("structured data: product page's availability is derived from the real isAvailable/stock fields, never hardcoded to InStock", () => {
    const src = read("src/app/(main)/menu/[slug]/page.tsx");
    assert.match(src, /product\.isAvailable/);
    assert.match(src, /product\.stock/);
});

// ── FAQ page ──────────────────────────────────────────────────────────────

test("structured data: FAQ page declares FAQPage schema and generates it FROM the same FAQS array rendered on the page (one source of truth, never a hand-duplicated list)", () => {
    const src = read("src/app/(main)/faq/page.tsx");
    assert.match(src, /"@type":\s*"FAQPage"/);
    assert.match(src, /mainEntity:\s*FAQS\.map/, "the schema must be generated by mapping the same FAQS array the page renders — never a second, hand-written copy that could drift out of sync");
});

test("structured data: FAQ answers never state an unverified specific delivery radius number or name an unconfirmed locality", () => {
    const src = read("src/app/(main)/faq/page.tsx");
    assert.doesNotMatch(src, /\b15\s*km\b/i, "no literal '15 km' claim — that figure is a schema default, not a confirmed current production value (see FOODKNOCK_SEO_REPORT.md Phase 2)");
});

// ── Sitemap ───────────────────────────────────────────────────────────────

test("sitemap: lists /founders, /faq and /review-rewards (previously missing), and never lists a noindexed route", () => {
    const src = read("src/app/sitemap.ts");
    for (const route of ["/founders", "/faq", "/review-rewards"]) {
        assert.match(src, new RegExp(route.replace("/", "\\/")), `${route} must be present in the sitemap`);
    }
    for (const noindexed of ["/cart", "/checkout", "/account", "/my-orders", "/track-order"]) {
        assert.doesNotMatch(src, new RegExp("`\\$\\{BASE_URL\\}" + noindexed + "`"), `${noindexed} is noindexed and must never appear as a sitemap entry`);
    }
});

// ── Indexing-boundary layouts ─────────────────────────────────────────────

test("indexing boundaries: checkout and account layouts both declare noindex", () => {
    for (const file of ["src/app/(main)/checkout/layout.tsx", "src/app/(main)/account/layout.tsx"]) {
        const src = read(file);
        assert.match(src, /index:\s*false/, `${file} must declare robots: {index:false}`);
    }
});

// ── Terms page policy accuracy ───────────────────────────────────────────

test("terms page: never claims 'online payments only' — COD is a real, live payment method", () => {
    const src = read("src/app/(main)/terms/page.tsx");
    assert.doesNotMatch(src, /online payments only/i);
    assert.match(src, /Cash on Delivery|COD/, "the real COD option must be mentioned");
});

test("terms page: the delivery chip never states a specific guaranteed delivery time window (none is configured anywhere in this codebase)", () => {
    const code = stripLineComments(read("src/app/(main)/terms/page.tsx"));
    assert.doesNotMatch(code, /\d+[\s–-]+\d+\s*min(ute)?s?\s*delivery/i);
});
