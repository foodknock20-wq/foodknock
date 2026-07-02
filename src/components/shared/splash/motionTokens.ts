// src/components/shared/splash/motionTokens.ts
//
// FoodKnock Splash System — single source of truth for every timing
// value, easing curve, and duration used across the splash's layers.
//
// WHY THIS FILE EXISTS: the choreography brief specifies concrete offsets
// (0.00s, 0.08s, 0.20s, 0.35s, 0.45s, 0.55s–0.70s, 0.80s, 1.00s, 1.20s,
// 1.40s) and an explicit rule — "never wait for one animation to finish
// before starting another; everything should overlap." Scattering those
// eleven numbers as inline animation-delay values across five separate
// component files makes it impossible to verify at a glance that the
// choreography still matches the brief after a future edit. Every offset
// below is declared exactly once, with the specific brief requirement it
// satisfies recorded next to it — grep THIS file, not five others, to
// audit the timeline.
//
// UNITS: "seconds" fields are plain numbers (not "0.35s" strings) so they
// can be used directly both in delayOf()'s CSS-string formatting AND in
// splashDebug.ts's dev-only timing-mark logger without a parse step.

import type { TimingStep } from "./types";

// ── Entrance choreography — one authoritative offset per element ──────────
// Every gap between consecutive steps below is deliberately kept under the
// brief's "never keep the logo static for more than 300–400ms" ceiling —
// see each entry's own "Gap from previous" note.

export const VEIL_IN: TimingStep = {
    atSeconds: 0.0,
    reason: "Background fades in first — brief: '0.00s Background fades in.'",
};

export const LOGO_IN: TimingStep = {
    atSeconds: 0.08,
    reason:
        "Logo fades + scales 0.88→1 — brief: '0.08s Logo fades + scales from 0.88 → 1.' " +
        "Gap from VEIL_IN: 0.08s (well under the 300–400ms static-logo ceiling).",
};

export const GLOW_IN: TimingStep = {
    atSeconds: 0.2,
    reason:
        "Soft orange glow appears behind the logo — brief: '0.20s Soft orange glow begins " +
        "behind logo.' Gap from LOGO_IN: 0.12s — glow starts WHILE the logo's own 620ms " +
        "entrance animation is still running, satisfying 'logo scaling should still be " +
        "running while glow starts.'",
};

export const LOGO_BREATHE_START: TimingStep = {
    atSeconds: 0.35,
    reason:
        "Continuous breathing loop attaches — brief: '0.35s Logo begins subtle breathing " +
        "animation.' Gap from GLOW_IN: 0.15s. This is also the latest point the logo could " +
        "still be considered 'static' — from here forward it is in continuous motion until " +
        "the exit sequence begins.",
};

export const GLOW_PULSE_START: TimingStep = {
    atSeconds: 0.45,
    reason:
        "Glow's bloom softens/enlarges into its own continuous pulse loop — brief: '0.45s " +
        "Shadow becomes softer and larger.' Overlaps LOGO_BREATHE_START by design ('glow " +
        "should continue while particles appear').",
};

export const PARTICLES_START: TimingStep = {
    atSeconds: 0.55,
    reason:
        "First particle begins appearing — brief gives this one a range (0.55s–0.70s) " +
        "rather than a single instant; particles are individually staggered within it — " +
        "see PARTICLES_END and particles.ts.",
};

export const PARTICLES_END: TimingStep = {
    atSeconds: 0.7,
    reason: "Last particle's entrance offset — closes out the 0.55s–0.70s staggered window.",
};

export const BRAND_TEXT_START: TimingStep = {
    atSeconds: 0.8,
    reason:
        "Wordmark reveal begins — brief: '0.80s Brand text reveals smoothly.' Particles are " +
        "still actively drifting at this point (their loops run 5.6s–7.8s), satisfying " +
        "'particles should continue while text animates.'",
};

export const TAGLINE_START: TimingStep = {
    atSeconds: 0.88,
    reason:
        "Tagline follows the wordmark by 80ms — deliberately small so the two read as one " +
        "connected reveal, not two separate events.",
};

export const LOADER_REVEAL: TimingStep = {
    atSeconds: 0.95,
    reason:
        "Loading indicator fades into view — brief: '1.00s Loading animation is already " +
        "running.' The ring's ROTATION animation (see BrandReveal.tsx) runs from component " +
        "mount (t=0), independent of this reveal offset — by 0.95s it has already completed " +
        "roughly half a rotation, so it visibly reads as 'already in motion' the instant it " +
        "becomes visible, rather than a ring that starts spinning on cue.",
};

export const BG_SHIFT_START: TimingStep = {
    atSeconds: 1.2,
    reason: "Secondary background gradient begins its slow alternating shift — brief: '1.20s Background gradient slowly shifts.'",
};

export const LIGHT_SWEEP_START: TimingStep = {
    atSeconds: 1.4,
    reason:
        "First diagonal light sweep crosses the logo — brief: '1.40s Light sweep crosses " +
        "the logo.' Unlike every other entry here, this one RECURS (every " +
        "LIGHT_SWEEP_INTERVAL_SECONDS) for as long as the splash remains active, so a " +
        "slower-than-expected real load never goes visually silent after the brief's " +
        "example timeline nominally ends at 2.0s.",
};

/** How often the light sweep repeats after its first pass, for as long as the splash is still active. */
export const LIGHT_SWEEP_INTERVAL_SECONDS = 4.5;

/** How often the secondary background gradient completes one alternate-direction cycle. */
export const BG_SHIFT_CYCLE_SECONDS = 6.5;

/** Logo breathing loop period. */
export const LOGO_BREATHE_CYCLE_SECONDS = 3.4;

/** Glow pulse loop period. */
export const GLOW_PULSE_CYCLE_SECONDS = 2.6;

/** Loading ring — one full rotation. */
export const LOADER_SPIN_SECONDS = 1.3;

// ── Exit / dissolve timing ─────────────────────────────────────────────
// Three independently-timed layers, deliberately overlapping — see
// SplashScreen.tsx's own header for the full rationale. These are the
// ONLY numbers that determine total visible exit duration; everything
// above only shapes the (unbounded, readiness-gated) entrance/idle phase.

/** Content layer (logo/text/loader): blur-out + scale-up + fade duration. */
export const EXIT_CONTENT_MS = 620;

/** Bloom layer: expand + brighten duration. */
export const EXIT_BLOOM_MS = 750;

/** Veil layer fades LAST, after this delay, over EXIT_VEIL_MS — revealing home through the thinning wash while the bloom is still resolving on top of it. */
export const EXIT_VEIL_DELAY_MS = 180;
export const EXIT_VEIL_MS = 850;

/** Total time from "dissolve starts" to "safe to unmount" — governed by the slowest layer (the veil, including its own start delay). */
export const EXIT_TOTAL_MS = EXIT_VEIL_DELAY_MS + EXIT_VEIL_MS;

/** Reduced-motion exit: every layer above is skipped in favor of one fast, simple opacity fade. */
export const EXIT_REDUCED_MOTION_MS = 220;

// ── Easing curves ───────────────────────────────────────────────────────
// Named once, reused everywhere, so "which curve does the exit use" is
// answerable by reading this block rather than diffing five files.

/** Standard Material-style ease-out — used for the veil's exit fade. */
export const EASE_STANDARD = "cubic-bezier(0.4, 0, 0.2, 1)";

/** Gentle overshoot-free "settle" curve — used for every entrance animation. Matches the curve already used elsewhere in this codebase's own premium UI (e.g. FounderDetailPanel's rise-in). */
export const EASE_SETTLE = "cubic-bezier(0.16, 1, 0.3, 1)";

/** Constant angular velocity — used only for the continuously-rotating loader ring. */
export const EASE_LINEAR = "linear";

// ── Derived helper ──────────────────────────────────────────────────────

/** Formats a TimingStep's offset as a CSS animation-delay string, e.g. "0.35s". Centralizing this conversion means every layer passes the SAME step object into the SAME formatter, rather than five independent template literals that could silently drift out of sync with the table above. */
export function delayOf(step: TimingStep): string {
    return `${step.atSeconds}s`;
}