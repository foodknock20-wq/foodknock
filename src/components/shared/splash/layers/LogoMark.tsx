// src/components/shared/splash/layers/LogoMark.tsx
//
// FoodKnock Splash System — logo mark layer (bloom + real brand logo).
//
// Three NESTED animation scopes, matching exactly how the brief describes
// overlapping motion ("logo scaling should still be running while glow
// starts... glow should continue while particles appear"):
//
//   1. Bloom (the glow span) — appears at GLOW_IN (0.2s), settles into a
//      continuous pulse loop from GLOW_PULSE_START (0.45s). It is
//      intentionally left inside the SAME DOM subtree that the
//      orchestrator's shared "content" wrapper applies its own
//      opacity/blur/scale exit transition to — so on exit, the bloom's
//      own expand-and-brighten transition plays out AS that parent fade
//      proceeds, producing a brief brightening flash right as the logo
//      dissolves (the "light bloom" effect), achieved by composition
//      rather than a fourth independent exit layer.
//   2. Outer wrapper — the logo's ONE-SHOT entrance (fade + scale
//      0.88→1) at LOGO_IN (0.08s). Runs exactly once, never repeats.
//   3. Inner wrapper — the CONTINUOUS breathing loop, attaching at
//      LOGO_BREATHE_START (0.35s), nested inside the outer wrapper so the
//      transforms compose naturally (entrance settles directly into
//      breathing, no visible seam between the two).
//
// The light sweep is nested one level deeper still, inside the logo
// image's own clipping box, so its diagonal gradient is naturally masked
// to the logo's rounded-rect shape.

import type { SplashLayerProps } from "../types";
import {
    EASE_SETTLE,
    GLOW_IN,
    GLOW_PULSE_START,
    GLOW_PULSE_CYCLE_SECONDS,
    LOGO_IN,
    LOGO_BREATHE_START,
    LOGO_BREATHE_CYCLE_SECONDS,
    LIGHT_SWEEP_START,
    LIGHT_SWEEP_INTERVAL_SECONDS,
    delayOf,
} from "../motionTokens";

/** Same asset src/components/shared/Navbar.tsx uses for the header logo — reusing it here (rather than a drawn SVG mark) is what makes the splash's brand mark pixel-identical to what the user sees in the navbar and PWA icon a moment later. */
const LOGO_SRC = "/logo/logo.jpg";

export default function LogoMark({ dissolving, reducedMotion }: SplashLayerProps) {
    return (
        <div className="relative mb-7 flex h-[108px] w-[108px] items-center justify-center sm:h-[126px] sm:w-[126px]">
            {/* ── Bloom ── */}
            <span
                className="absolute inset-0 -m-6 rounded-full"
                style={{
                    background: "radial-gradient(circle, #FFB347 0%, transparent 72%)",
                    opacity: dissolving ? 0.9 : undefined,
                    transform: dissolving ? "scale(2.4)" : undefined,
                    animation: dissolving
                        ? undefined
                        : reducedMotion
                        ? `fkGlowInReduced 300ms ease-out ${delayOf(GLOW_IN)} both`
                        : `fkGlowIn 550ms ${EASE_SETTLE} ${delayOf(GLOW_IN)} both, ` +
                          `fkGlowPulse ${GLOW_PULSE_CYCLE_SECONDS}s ease-in-out ${delayOf(GLOW_PULSE_START)} infinite`,
                    transition: dissolving
                        ? `transform 750ms ${EASE_SETTLE}, opacity 750ms ${EASE_SETTLE} 280ms`
                        : undefined,
                    willChange: "transform, opacity",
                }}
                aria-hidden="true"
            />

            {/* ── Outer wrapper: one-shot entrance ── */}
            <div
                style={{
                    animation: reducedMotion
                        ? `fkLogoInReduced 320ms ease-out ${delayOf(LOGO_IN)} both`
                        : `fkLogoIn 620ms ${EASE_SETTLE} ${delayOf(LOGO_IN)} both`,
                    willChange: "transform, opacity",
                }}
            >
                {/* ── Inner wrapper: continuous breathing loop ── */}
                <div
                    className="relative flex h-[108px] w-[108px] items-center justify-center overflow-hidden rounded-[28px] sm:h-[126px] sm:w-[126px]"
                    style={{
                        boxShadow:
                            "0 24px 56px rgba(255,92,26,0.30), 0 2px 8px rgba(120,53,15,0.12), " +
                            "inset 0 1px 1px rgba(255,255,255,0.5), inset 0 -1px 3px rgba(154,52,18,0.15)",
                        animation: reducedMotion
                            ? "none"
                            : `fkLogoBreathe ${LOGO_BREATHE_CYCLE_SECONDS}s ease-in-out ${delayOf(LOGO_BREATHE_START)} infinite`,
                        willChange: reducedMotion ? undefined : "transform",
                    }}
                >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src={LOGO_SRC}
                        alt="FoodKnock"
                        width={126}
                        height={126}
                        fetchPriority="high"
                        className="h-full w-full object-cover"
                    />

                    {/* Soft inner glow sheen — premium depth, static, no motion needed */}
                    <div
                        className="pointer-events-none absolute inset-0"
                        style={{
                            background:
                                "linear-gradient(155deg, rgba(255,255,255,0.28) 0%, transparent 40%, rgba(120,53,15,0.06) 100%)",
                        }}
                        aria-hidden="true"
                    />

                    {/* ── Light sweep — first pass at LIGHT_SWEEP_START,
                        then RECURS every LIGHT_SWEEP_INTERVAL_SECONDS for
                        as long as the splash is still active, so a
                        longer-than-expected real load never goes visually
                        silent. ── */}
                    {!reducedMotion && (
                        <div
                            className="pointer-events-none absolute inset-0"
                            style={{
                                background:
                                    "linear-gradient(115deg, transparent 40%, rgba(255,255,255,0.55) 50%, transparent 60%)",
                                transform: "translateX(-140%)",
                                opacity: dissolving ? 0 : undefined,
                                animation: dissolving
                                    ? undefined
                                    : `fkLightSweep ${LIGHT_SWEEP_INTERVAL_SECONDS}s ease-in-out ${delayOf(LIGHT_SWEEP_START)} infinite`,
                            }}
                            aria-hidden="true"
                        />
                    )}
                </div>
            </div>

            <style jsx>{`
                @keyframes fkLogoIn {
                    0%   { opacity: 0; transform: scale(0.88) translateY(6px); }
                    100% { opacity: 1; transform: scale(1) translateY(0); }
                }
                @keyframes fkLogoInReduced {
                    from { opacity: 0; }
                    to   { opacity: 1; }
                }
                @keyframes fkLogoBreathe {
                    0%, 100% { transform: scale(1) translateY(0); }
                    50%      { transform: scale(1.035) translateY(-3px); }
                }
                @keyframes fkGlowIn {
                    0%   { opacity: 0;   transform: scale(0.7); }
                    100% { opacity: 0.5; transform: scale(1); }
                }
                @keyframes fkGlowInReduced {
                    from { opacity: 0; }
                    to   { opacity: 0.5; }
                }
                @keyframes fkGlowPulse {
                    0%, 100% { transform: scale(1);    opacity: 0.45; }
                    50%      { transform: scale(1.14); opacity: 0.68; }
                }
                @keyframes fkLightSweep {
                    0%, 12%   { transform: translateX(-140%); opacity: 0; }
                    18%       { opacity: 0.9; }
                    38%, 100% { transform: translateX(140%);  opacity: 0; }
                }
            `}</style>
        </div>
    );
}