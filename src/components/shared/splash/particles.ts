// src/components/shared/splash/particles.ts
//
// FoodKnock Splash System — ambient particle field configuration.
//
// Deliberately data-only (see ParticleConfig's doc comment in types.ts).
// ParticleField.tsx contains no hardcoded position/size/color values — it
// just maps this array. Growing the field, re-theming its palette for a
// future seasonal variant, or removing a particle entirely is a one-line
// change here, never a JSX edit.
//
// Five particles (spread across all four screen quadrants plus one
// near-center accent) — still comfortably cheap: each is a single
// absolutely-positioned <span> animating only `transform` and `opacity`
// via CSS keyframes, so five of them costs the compositor essentially
// nothing extra over three.

import type { ParticleConfig } from "./types";
import { PARTICLES_START, PARTICLES_END } from "./motionTokens";

/**
 * Linearly interpolates each particle's entrance delay across the
 * PARTICLES_START–PARTICLES_END window (0.55s–0.70s per the brief) so
 * they visibly stagger in one-by-one rather than all snapping into
 * existence at once.
 */
function staggeredDelay(index: number, total: number): number {
    if (total <= 1) return PARTICLES_START.atSeconds;
    const span = PARTICLES_END.atSeconds - PARTICLES_START.atSeconds;
    return Number((PARTICLES_START.atSeconds + (span * index) / (total - 1)).toFixed(3));
}

const RAW_PARTICLES: Omit<ParticleConfig, "delaySeconds">[] = [
    {
        id: "particle-top-left",
        top: "22%",
        left: "18%",
        size: 90,
        color: "#FFD9B3",
        driftKeyframe: "fkParticleDrift1",
        durationSeconds: 6.5,
        peakOpacity: 0.5,
    },
    {
        id: "particle-bottom-right",
        bottom: "20%",
        right: "16%",
        size: 110,
        color: "#FFC98A",
        driftKeyframe: "fkParticleDrift2",
        durationSeconds: 7.8,
        peakOpacity: 0.4,
    },
    {
        id: "particle-mid-left",
        top: "62%",
        left: "12%",
        size: 56,
        color: "#FFEAD1",
        driftKeyframe: "fkParticleDrift3",
        durationSeconds: 5.6,
        peakOpacity: 0.45,
    },
    {
        id: "particle-top-right-accent",
        top: "16%",
        right: "22%",
        size: 42,
        color: "#FFE3C2",
        driftKeyframe: "fkParticleDrift4",
        durationSeconds: 6.9,
        peakOpacity: 0.38,
    },
    {
        id: "particle-bottom-center",
        bottom: "12%",
        left: "46%",
        size: 68,
        color: "#FFDCB0",
        driftKeyframe: "fkParticleDrift5",
        durationSeconds: 7.2,
        peakOpacity: 0.42,
    },
];

export const SPLASH_PARTICLES: ParticleConfig[] = RAW_PARTICLES.map((p, i) => ({
    ...p,
    delaySeconds: staggeredDelay(i, RAW_PARTICLES.length),
}));