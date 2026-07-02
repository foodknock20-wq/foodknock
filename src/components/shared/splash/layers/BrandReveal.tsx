// src/components/shared/splash/layers/BrandReveal.tsx
//
// FoodKnock Splash System — wordmark, tagline, and loading indicator.
//
// Three elements, each with its OWN entrance offset (BRAND_TEXT_START,
// TAGLINE_START, LOADER_REVEAL) rather than one shared animation — this
// is what produces the "reads as one connected reveal, not three separate
// events" feel: each starts only ~80ms after the previous, well inside
// the "never wait for one animation to finish" rule, so they visibly
// cascade rather than either snapping in together or feeling disjointed.
//
// The loading ring's ROTATION is intentionally a SEPARATE animation from
// its reveal fade-in — rotation is applied unconditionally from the
// moment this component mounts (t=0 for the whole splash), independent
// of LOADER_REVEAL's opacity delay. By the time the ring fades into view
// at ~0.95s it has already completed a significant fraction of a
// rotation, so it visibly reads as "already spinning" rather than a
// static ring that starts moving right as it appears — directly
// satisfying the brief's "1.00s Loading animation is already running."
//
// Text/loader exit behavior is intentionally NOT defined here — these
// elements inherit their dissolve purely from SplashScreen.tsx's shared
// "content" wrapper (opacity/blur/scale), same as the original
// single-file implementation. Only the entrance animation is local to
// each element.

import type { SplashLayerProps } from "../types";
import {
    EASE_SETTLE,
    EASE_LINEAR,
    BRAND_TEXT_START,
    TAGLINE_START,
    LOADER_REVEAL,
    LOADER_SPIN_SECONDS,
    delayOf,
} from "../motionTokens";

export default function BrandReveal({ reducedMotion }: SplashLayerProps) {
    return (
        <>
            <h1
                className="text-[26px] font-black leading-none tracking-tight text-stone-900 sm:text-[30px]"
                style={{
                    fontFamily: "'Playfair Display', Georgia, serif",
                    animation: reducedMotion
                        ? "fkTextInReduced 300ms ease-out 0.7s both"
                        : `fkTextIn 560ms ${EASE_SETTLE} ${delayOf(BRAND_TEXT_START)} both`,
                }}
            >
                FoodKnock
            </h1>

            <p
                className="mt-2 text-[11px] font-black uppercase tracking-[0.32em] text-orange-500"
                style={{
                    animation: reducedMotion
                        ? "fkTextInReduced 300ms ease-out 0.78s both"
                        : `fkTextIn 560ms ${EASE_SETTLE} ${delayOf(TAGLINE_START)} both`,
                }}
            >
                Fresh in Minutes
            </p>

            <div
                className="mt-9 flex items-center justify-center"
                style={{
                    animation: reducedMotion
                        ? "fkTextInReduced 300ms ease-out 0.82s both"
                        : `fkTextIn 560ms ${EASE_SETTLE} ${delayOf(LOADER_REVEAL)} both`,
                }}
            >
                <div
                    className="relative h-6 w-6"
                    style={{
                        animation: reducedMotion
                            ? "none"
                            : `fkRingSpin ${LOADER_SPIN_SECONDS}s ${EASE_LINEAR} infinite`,
                        opacity: reducedMotion ? 0.7 : 1,
                        willChange: reducedMotion ? undefined : "transform",
                    }}
                >
                    <div
                        className="h-full w-full rounded-full"
                        style={{
                            background:
                                "conic-gradient(from 0deg, #FF5C1A 0%, #FFB347 35%, transparent 70%, transparent 100%)",
                            WebkitMask:
                                "radial-gradient(farthest-side, transparent calc(100% - 3px), #000 calc(100% - 3px))",
                            mask: "radial-gradient(farthest-side, transparent calc(100% - 3px), #000 calc(100% - 3px))",
                        }}
                    />
                </div>
            </div>

            <style jsx>{`
                @keyframes fkTextIn {
                    0%   { opacity: 0; transform: translateY(8px); }
                    100% { opacity: 1; transform: translateY(0); }
                }
                @keyframes fkTextInReduced {
                    from { opacity: 0; }
                    to   { opacity: 1; }
                }
                @keyframes fkRingSpin {
                    from { transform: rotate(0deg); }
                    to   { transform: rotate(360deg); }
                }
            `}</style>
        </>
    );
}