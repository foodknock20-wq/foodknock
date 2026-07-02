// src/components/shared/splash/layers/Veil.tsx
//
// FoodKnock Splash System — background veil layer.
//
// Two stacked gradients:
//   1. The base wash — present from the very first frame ("0.00s
//      Background fades in"), fades out LAST during the exit (after
//      EXIT_VEIL_DELAY_MS) — this is what lets the home screen underneath
//      become visible THROUGH this layer while the bloom above it is
//      still resolving. See SplashScreen.tsx's header for the full
//      three-layer dissolve rationale.
//   2. A secondary, slowly alternating radial gradient beginning at
//      BG_SHIFT_START (1.2s) that keeps gently breathing for as long as
//      the splash remains active, adding depth that never settles into a
//      static frame.
//
// Both layers are transform/opacity-only — no layout-affecting property
// is ever touched, keeping this cheap even on lower-end Android devices.
//
// No "use client" directive: this component uses no hooks and no
// browser-only APIs itself — it's only ever reachable through
// SplashScreen.tsx's ("use client") module graph, so it's bundled as a
// client component transitively without needing to declare it explicitly.

import type { SplashLayerProps } from "../types";
import {
    EASE_STANDARD,
    EXIT_VEIL_DELAY_MS,
    EXIT_VEIL_MS,
    BG_SHIFT_START,
    BG_SHIFT_CYCLE_SECONDS,
} from "../motionTokens";

export default function Veil({ dissolving, reducedMotion }: SplashLayerProps) {
    return (
        <>
            {/* Layer 1 — base wash, appears t=0, dissolves LAST */}
            <div
                className="absolute inset-0"
                style={{
                    background:
                        "radial-gradient(ellipse at 50% 42%, #FFF7ED 0%, #FFFBF5 55%, #FFFFFF 100%)",
                    opacity: dissolving ? 0 : 1,
                    animation: reducedMotion ? "none" : "fkVeilIn 500ms ease-out both",
                    transition: dissolving
                        ? reducedMotion
                            ? "opacity 200ms ease"
                            : `opacity ${EXIT_VEIL_MS}ms ${EASE_STANDARD} ${EXIT_VEIL_DELAY_MS}ms`
                        : undefined,
                    willChange: "opacity",
                }}
                aria-hidden="true"
            />

            {/* Layer 2 — slow shifting gradient, begins at BG_SHIFT_START */}
            {!reducedMotion && (
                <div
                    className="absolute inset-0"
                    style={{
                        background: "radial-gradient(ellipse at 60% 55%, #FFEDD9 0%, transparent 60%)",
                        opacity: dissolving ? 0 : undefined,
                        animation: dissolving
                            ? undefined
                            : `fkBgShift ${BG_SHIFT_CYCLE_SECONDS}s ease-in-out ${BG_SHIFT_START.atSeconds}s infinite alternate`,
                        transition: dissolving ? "opacity 400ms ease" : undefined,
                        willChange: "opacity, transform",
                    }}
                    aria-hidden="true"
                />
            )}

            <style jsx>{`
                @keyframes fkVeilIn {
                    from { opacity: 0; }
                    to   { opacity: 1; }
                }
                @keyframes fkBgShift {
                    from { opacity: 0.25; transform: scale(1); }
                    to   { opacity: 0.55; transform: scale(1.08); }
                }
            `}</style>
        </>
    );
}