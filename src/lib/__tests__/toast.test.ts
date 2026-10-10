// src/lib/__tests__/toast.test.ts
//
// Premium Toast Redesign — src/lib/toast.tsx returns JSX, so its CARD
// rendering (icons, animation classes, hover pause/resume) cannot be
// exercised without a DOM/component-render environment, which this repo
// does not have. What's tested here instead is the actual, real,
// observable CONTRACT this file has with react-hot-toast via its
// exported, pure `resolveToastOptions()` helper: every premium toast
// asks the library for `duration: Infinity` (this file owns the real
// auto-dismiss timer itself, for pause/resume — see toast.tsx's header),
// and a caller-supplied `id` passes through unmodified (the mechanism
// the sign-in-required-toast duplicate-prevention fix depends on).
//
// Mocking the `react-hot-toast` module itself was tried first and
// abandoned — Node's experimental `--experimental-test-module-mocks`
// reliably intercepts the package when it's imported directly inside a
// test file, but does NOT reliably intercept it when the same package is
// instead imported transitively through another file (reproduced with a
// minimal, non-JSX, plain `.ts` repro — a real environment/tooling
// limitation, not something specific to this file). Testing the pure
// `resolveToastOptions()` function directly sidesteps that limitation
// and is the more robust test regardless.
//
// This file imports src/lib/toast.tsx (real JSX), so unlike every other
// pure-logic test file in this directory it must run via `tsx` (which
// does a real JSX transform), not Node's native `--experimental-strip-types`
// (type-stripping only — cannot parse JSX, confirmed by trying it first).
//
//   npx tsx --test src/lib/__tests__/toast.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveToastOptions } from "../toast.tsx";

test("resolveToastOptions: always returns duration:Infinity — react-hot-toast must never auto-dismiss a premium toast on its own", () => {
    assert.equal(resolveToastOptions().duration, Infinity);
    assert.equal(resolveToastOptions({}).duration, Infinity);
    assert.equal(resolveToastOptions({ id: "anything" }).duration, Infinity);
});

test("resolveToastOptions: a caller-supplied id passes through unmodified — this is what prevents the sign-in-required toast from stacking on repeated taps", () => {
    assert.equal(resolveToastOptions({ id: "fk-signin-required" }).id, "fk-signin-required");
});

test("resolveToastOptions: omitting id leaves it undefined — callers that don't need dedup get react-hot-toast's normal per-call auto-generated id, unchanged", () => {
    assert.equal(resolveToastOptions().id, undefined);
    assert.equal(resolveToastOptions({}).id, undefined);
});
