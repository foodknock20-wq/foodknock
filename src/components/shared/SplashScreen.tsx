"use client";

// src/components/shared/SplashScreen.tsx
//
// FoodKnock — cinematic startup splash, orchestrator.
//
// This file is now intentionally thin: it composes four independently
// documented modules — useSplashLifecycle (state machine + readiness),
// Veil, ParticleField, LogoMark, BrandReveal (visual layers) — rather
// than containing all of the splash's logic and markup itself. Every
// individual timing offset, easing curve, and duration lives in
// splash/motionTokens.ts; every readiness/exit-timing decision lives in
// splash/useSplashLifecycle.ts. See each file's own header for full
// rationale.
//
// ARCHITECTURE (unchanged from every prior revision): a small, always-
// mounted client overlay in the root layout (same pattern as
// NotificationPrompt/OfflineOverlay). Zero effect on business logic,
// auth, orders, notifications, routing, offline handling, or the service
// worker. Identical markup on server and first client paint — no
// hydration mismatch. IMPORT PATH IS UNCHANGED
// (@/components/shared/SplashScreen), so layout.tsx requires zero edits
// for this refactor.
//
// NO FAKE DELAY (unchanged, enforced in useSplashLifecycle.ts): readiness
// is derived only from document.readyState/`load` + document.fonts.ready.
//
// ── THE HANDOFF (why this isn't "just a fade") ────────────────────────
// Three independently-timed layers, deliberately overlapping so there is
// never one single visible "cut" between splash and home:
//   1. CONTENT (this wrapper, below) — logo + brand text dissolve
//      together: blur-out + scale-up + fade, over 620ms.
//   2. BLOOM (nested inside LogoMark, inside this same content wrapper)
//      — expands and brightens rather than shrinking, on its own 750ms
//      transition, composing with this wrapper's fade to produce a brief
//      brightening flash right as it dissolves.
//   3. VEIL (a sibling of this content wrapper, in Veil.tsx) — fades
//      LAST, after a 180ms delay, over 850ms — revealing the home screen
//      underneath (already mounted and genuinely rendering the whole
//      time) through the thinning wash while content/bloom are still
//      resolving on top of it.
// pointer-events switch to none the instant the exit begins — home is
// interactive immediately, before the visual animation has even finished.
//
// No "use client" on the four imported layer components: none of them
// use hooks or browser-only APIs directly, so they're bundled as client
// components transitively (they're only ever reachable through this
// file's own client module graph) without needing to declare it
// themselves — the more precise, idiomatic Next.js pattern.

import { useSplashLifecycle } from "./splash/useSplashLifecycle";
import Veil from "./splash/layers/Veil";
import ParticleField from "./splash/layers/ParticleField";
import LogoMark from "./splash/layers/LogoMark";
import BrandReveal from "./splash/layers/BrandReveal";

export default function SplashScreen() {
    const { phase, dissolving, reducedMotion } = useSplashLifecycle();

    if (phase === "hidden") return null;

    return (
        <div
            aria-hidden={dissolving}
            role={dissolving ? undefined : "status"}
            aria-label={dissolving ? undefined : "FoodKnock is loading"}
            className="fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden"
            style={{
                pointerEvents: dissolving ? "none" : "auto",
                paddingTop: "env(safe-area-inset-top, 0px)",
                paddingBottom: "env(safe-area-inset-bottom, 0px)",
                paddingLeft: "env(safe-area-inset-left, 0px)",
                paddingRight: "env(safe-area-inset-right, 0px)",
            }}
        >
            <Veil dissolving={dissolving} reducedMotion={reducedMotion} />
            <ParticleField dissolving={dissolving} reducedMotion={reducedMotion} />

            {/* Shared CONTENT dissolve wrapper — see file header, layer 1. */}
            <div
                className="relative flex flex-col items-center px-6"
                style={{
                    opacity: dissolving ? 0 : 1,
                    filter: dissolving ? "blur(14px)" : "blur(0px)",
                    transform: dissolving ? "scale(1.07) translateY(-4px)" : "scale(1) translateY(0)",
                    transition: reducedMotion
                        ? "opacity 220ms ease"
                        : "opacity 620ms cubic-bezier(0.4, 0, 0.2, 1), " +
                          "filter 620ms cubic-bezier(0.4, 0, 0.2, 1), " +
                          "transform 620ms cubic-bezier(0.4, 0, 0.2, 1)",
                    willChange: dissolving ? "opacity, filter, transform" : undefined,
                }}
            >
                <LogoMark dissolving={dissolving} reducedMotion={reducedMotion} />
                <BrandReveal dissolving={dissolving} reducedMotion={reducedMotion} />
            </div>
        </div>
    );
}