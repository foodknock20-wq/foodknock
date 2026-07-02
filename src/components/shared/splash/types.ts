// src/components/shared/splash/types.ts
//
// FoodKnock Splash System — shared type contracts.
//
// Centralizing these types keeps every layer structurally interchangeable:
// any component that accepts `SplashLayerProps` can be reordered or reused
// (e.g. a future seasonal/festival splash variant) without hunting a prop
// shape scattered across five files.

/**
 * The three states the splash lifecycle can be in — identical semantics
 * to the original single-file implementation; only WHERE this is declared
 * changed.
 *
 *  "active"     — splash fully visible, entrance/idle choreography running.
 *  "dissolving" — real readiness confirmed; the layered exit is playing.
 *  "hidden"     — exit finished; eligible for removal from the tree.
 */
export type SplashPhase = "active" | "dissolving" | "hidden";

/**
 * Every layer component receives exactly this and nothing more. A layer
 * should only ever need "are we mid-exit" and "should motion be
 * suppressed" — never the raw timers or readiness-detection internals
 * that produced those two facts.
 */
export type SplashLayerProps = {
    /** True once real app-readiness has been confirmed and the exit sequence has begun. */
    dissolving: boolean;
    /** True when the user's OS/browser has requested reduced motion. */
    reducedMotion: boolean;
};

/**
 * One entry in the ambient particle field (see particles.ts). Deliberately
 * data-only — ParticleField.tsx contains zero hardcoded positions, sizes,
 * or colors, so growing, shrinking, or re-theming the particle field for a
 * future brand variant is a data change, never a component-code change.
 */
export type ParticleConfig = {
    /** Stable key — must be unique within the particle array. */
    id: string;
    /** CSS `top` offset, e.g. "22%". Set either `top` or `bottom`, never both. */
    top?: string;
    bottom?: string;
    /** CSS `left` offset, e.g. "18%". Set either `left` or `right`, never both. */
    left?: string;
    right?: string;
    /** Diameter in pixels. */
    size: number;
    /** Radial-gradient core color (hex). */
    color: string;
    /** Name of the CSS @keyframes rule (declared in ParticleField.tsx's <style jsx>) driving this particle's unique drift path. */
    driftKeyframe: string;
    /** Total loop duration in seconds — deliberately varied per particle (5.6s–7.8s) so the field never falls into a visible unison rhythm. */
    durationSeconds: number;
    /** Entrance offset in seconds, matching "particles begin appearing, staggered" from 0.55s–0.70s. */
    delaySeconds: number;
    /** Peak opacity once fully drifting — kept low (0.38–0.5) so particles read as ambient texture, never competing with the logo for attention. Wired into CSS via a `--fk-particle-peak` custom property, not duplicated per keyframe. */
    peakOpacity: number;
};

/**
 * Resolved timing for one animation step in the entrance choreography.
 * motionTokens.ts exports a fully-typed table of these so every offset in
 * the splash traces back to one documented source of truth instead of
 * being a magic number re-typed in five different files.
 */
export type TimingStep = {
    /** Seconds from first paint — matches the brief's timeline notation exactly (e.g. 0.35 for "0.35s"). */
    atSeconds: number;
    /** One-line rationale — required on every entry so a future edit can't silently drop the reasoning behind a specific offset. */
    reason: string;
};