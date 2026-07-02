// src/components/shared/splash/layers/ParticleField.tsx
//
// FoodKnock Splash System — ambient particle field layer.
//
// Renders SPLASH_PARTICLES (particles.ts) — this component contains no
// hardcoded position/size/color/timing values itself; every visual
// property comes from that data array. Each particle's peak opacity is
// threaded through as a `--fk-particle-peak` CSS custom property rather
// than duplicated as a literal inside each @keyframes rule, so the config
// value in particles.ts is the actual thing driving the rendered result
// — not a second, independently-maintained number.
//
// Each particle's own @keyframes rule is still declared individually
// (styled-jsx), one per particle, since each drifts along a distinct
// transform path — a single shared keyframe would make every particle
// move in lockstep, which reads as far less organic than five staggered,
// independently-timed drifts.

import type { CSSProperties } from "react";
import type { SplashLayerProps } from "../types";
import { SPLASH_PARTICLES } from "../particles";

export default function ParticleField({ dissolving, reducedMotion }: SplashLayerProps) {
    if (reducedMotion) return null;

    return (
        <>
            {SPLASH_PARTICLES.map((p) => {
                const particleStyle: CSSProperties = {
                    top: p.top,
                    bottom: p.bottom,
                    left: p.left,
                    right: p.right,
                    width: p.size,
                    height: p.size,
                    background: `radial-gradient(circle, ${p.color} 0%, transparent 70%)`,
                    opacity: dissolving ? 0 : undefined,
                    animation: dissolving
                        ? undefined
                        : `${p.driftKeyframe} ${p.durationSeconds}s ease-in-out ${p.delaySeconds}s infinite`,
                    transition: dissolving ? "opacity 380ms ease" : undefined,
                    willChange: "transform, opacity",
                    // CSS custom property — the one place p.peakOpacity is
                    // actually consumed. Cast is the standard, widely-used
                    // TypeScript workaround for custom properties, since
                    // React's CSSProperties type doesn't include arbitrary
                    // "--*" keys by default.
                    "--fk-particle-peak": p.peakOpacity,
                } as CSSProperties;

                return <span key={p.id} className="absolute rounded-full" style={particleStyle} aria-hidden="true" />;
            })}

            <style jsx>{`
                @keyframes fkParticleDrift1 {
                    0%, 100% { transform: translate(0, 0);        opacity: 0; }
                    8%       { opacity: var(--fk-particle-peak, 0.5); }
                    50%      { transform: translate(10px, -14px); opacity: var(--fk-particle-peak, 0.5); }
                    92%      { opacity: var(--fk-particle-peak, 0.5); }
                }
                @keyframes fkParticleDrift2 {
                    0%, 100% { transform: translate(0, 0);        opacity: 0; }
                    8%       { opacity: var(--fk-particle-peak, 0.4); }
                    50%      { transform: translate(-12px, 10px); opacity: var(--fk-particle-peak, 0.4); }
                    92%      { opacity: var(--fk-particle-peak, 0.4); }
                }
                @keyframes fkParticleDrift3 {
                    0%, 100% { transform: translate(0, 0);       opacity: 0; }
                    8%       { opacity: var(--fk-particle-peak, 0.45); }
                    50%      { transform: translate(8px, 12px);  opacity: var(--fk-particle-peak, 0.45); }
                    92%      { opacity: var(--fk-particle-peak, 0.45); }
                }
                @keyframes fkParticleDrift4 {
                    0%, 100% { transform: translate(0, 0);        opacity: 0; }
                    8%       { opacity: var(--fk-particle-peak, 0.38); }
                    50%      { transform: translate(-9px, -8px);  opacity: var(--fk-particle-peak, 0.38); }
                    92%      { opacity: var(--fk-particle-peak, 0.38); }
                }
                @keyframes fkParticleDrift5 {
                    0%, 100% { transform: translate(0, 0);       opacity: 0; }
                    8%       { opacity: var(--fk-particle-peak, 0.42); }
                    50%      { transform: translate(6px, -10px); opacity: var(--fk-particle-peak, 0.42); }
                    92%      { opacity: var(--fk-particle-peak, 0.42); }
                }
            `}</style>
        </>
    );
}