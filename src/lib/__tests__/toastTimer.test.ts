// src/lib/__tests__/toastTimer.test.ts
//
// TOAST AUTO-DISMISS FIX — covers the two pure decision rules extracted
// from PremiumToastCard (src/lib/toast.tsx) as part of fixing the real,
// reported "Combo added!" toast that never disappeared. Full component
// lifecycle (mount → timer → dismiss → exit animation → DOM removal)
// cannot be exercised here — this project has no jsdom/React Testing
// Library, and adding one just for this would be a new dependency this
// task explicitly says to avoid. What's tested is the actual, isolated
// logic each bug fix hinges on:
//
//   1. `isHoverPausePointer` — root cause #2 (touch ghost-`mouseenter`
//      permanently pausing the timer with no `mouseleave` to resume it).
//      The fix gates pause/resume on `pointerType === "mouse"`; this tests
//      that gate directly for all three real PointerEvent.pointerType
//      values.
//   2. `computeRemainingMs` — the remaining-time arithmetic pause() uses
//      to shrink the countdown by elapsed time, including the "never
//      negative" floor (a stale/large elapsed reading must not produce a
//      negative remaining duration that `resume()`'s `> 0` check would
//      then treat inconsistently).
//
// Must run via `npx tsx --test` (imports the real-JSX toast.tsx), same as
// the existing toast.test.ts — the native `--experimental-strip-types`
// runner cannot parse JSX.
//
//   npx tsx --test src/lib/__tests__/toastTimer.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";
import { isHoverPausePointer, computeRemainingMs } from "../toast.tsx";

test("isHoverPausePointer: a real mouse engages pause/resume", () => {
    assert.equal(isHoverPausePointer("mouse"), true);
});

test("isHoverPausePointer: touch never engages pause/resume — this is the actual fix for the permanently-paused-toast bug", () => {
    assert.equal(isHoverPausePointer("touch"), false);
});

test("isHoverPausePointer: pen is treated the same as touch, not as mouse", () => {
    assert.equal(isHoverPausePointer("pen"), false);
});

test("computeRemainingMs: subtracts elapsed time from the remaining duration", () => {
    assert.equal(computeRemainingMs(2200, 800), 1400);
});

test("computeRemainingMs: never goes negative when elapsed exceeds remaining", () => {
    assert.equal(computeRemainingMs(2200, 5000), 0);
});

test("computeRemainingMs: zero elapsed leaves the remaining duration unchanged", () => {
    assert.equal(computeRemainingMs(3000, 0), 3000);
});
