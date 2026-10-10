// src/lib/__tests__/siteStats.test.ts
//
// CRITICAL FINAL FIX — covers the exact aggregation bug this phase fixed:
// the homepage's displayed review count/average used to come from a
// `.limit(10)`-capped query (src/app/(main)/page.tsx's getHomeData()),
// silently showing "10 reviews" and a 10-review average forever regardless
// of how many approved reviews actually existed. `computeSiteStats()`
// (src/lib/siteStats.ts) is the pure function that now owns this
// computation — tested directly, no DB mocking needed.

import { test } from "node:test";
import assert from "node:assert/strict";
import { computeSiteStats } from "../siteStats.ts";

test("computeSiteStats: totalReviews is the authoritative count, not the ratings-sample length", () => {
    // The exact bug shape — a small bounded sample (as if only 10 of 88
    // approved reviews were fetched) must not cap the reported total.
    const ratings = [5, 4, 5];
    const result = computeSiteStats(ratings, 88);
    assert.equal(result.totalReviews, 88);
});

test("computeSiteStats: avgRating is the mean of the ratings sample, rounded to 1 decimal", () => {
    const result = computeSiteStats([5, 5, 4, 4, 4], 88);
    assert.equal(result.avgRating, "4.4");
});

test("computeSiteStats: owner-reported scenario — 88 reviews averaging to 4.9", () => {
    const ratings = Array(80).fill(5).concat(Array(8).fill(4));
    const result = computeSiteStats(ratings, 88);
    assert.equal(result.totalReviews, 88);
    assert.equal(result.avgRating, "4.9");
});

test("computeSiteStats: zero reviews — avgRating is null, never a fabricated fallback number", () => {
    const result = computeSiteStats([], 0);
    assert.equal(result.avgRating, null);
    assert.equal(result.totalReviews, 0);
});

test("computeSiteStats: totalApproved can be a real number even when the ratings sample is empty (defensive — should not happen, but must not crash or fabricate)", () => {
    const result = computeSiteStats([], 5);
    assert.equal(result.avgRating, null);
    assert.equal(result.totalReviews, 5);
});
