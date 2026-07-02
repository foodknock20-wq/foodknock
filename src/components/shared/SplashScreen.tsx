"use client";

// src/components/shared/SplashScreen.tsx
//
// FoodKnock — cinematic startup splash with a seamless dissolve handoff
// into the home screen (Apple/CRED/Arc/Nothing-tier polish, FoodKnock's
// own orange/white branding, real brand logo).
//
// ARCHITECTURE: unchanged from the previous version — a small, always-
// mounted client overlay in the root layout (same pattern as
// NotificationPrompt/OfflineOverlay). Zero dependency on and zero effect
// on business logic, auth, orders, notifications, or the service worker.
// Renders identically on server and first client paint (fully visible,
// "loading" phase) — no hydration mismatch, since nothing about initial
// markup depends on any client-only value.
//
// NO FAKE DELAY: readiness is still derived from real signals only —
// document.readyState === "complete" (or `load`) AND document.fonts.ready.
// If the app is already fully loaded when this effect runs, the dissolve
// begins almost immediately. There is no hardcoded setTimeout wait.
//
// ── THE HANDOFF (why this isn't "just a fade") ────────────────────────
// Three independently-timed layers, deliberately overlapping so there is
// never one single visible "cut":
//   1. CONTENT layer (logo, wordmark, tagline, loader) dissolves first —
//      blur-out + scale-up + fade, ~650ms.
//   2. BLOOM layer (the glow behind the logo) EXPANDS and brightens
//      rather than just fading, ~750ms, starting alongside the content
//      dissolve — this is the "light spreads" moment.
//   3. VEIL layer (the background wash) fades LAST, after a short delay,
//      over ~850ms — so the home screen underneath (already mounted and
//      genuinely rendering the whole time, not a simulated second screen)
//      becomes visible THROUGH the thinning veil while the bloom is still
//      resolving on top of it. That overlap is what reads as one
//      continuous event rather than two screens swapping.
// The moment the dissolve begins, the whole overlay switches to
// `pointer-events: none` — home is interactive immediately, before the
// visual animation has even finished.
//
// PERFORMANCE: only transform/opacity/filter are ever animated (GPU
// compositable). `filter: blur()` is used sparingly — only on the content
// layer, only once, only for the ~650ms dissolve — never as a continuous
// idle-state animation, so this stays smooth at 90/120Hz. `will-change`
// is applied only to elements that are actively mid-animation and removed
// once settled.
//
// REDUCED MOTION: identical visual design (logo, glow, wordmark, loader)
// — every transform-based motion (breathing, floating, blur-dissolve,
// bloom-expand) is replaced with a plain, fast opacity fade instead.

import { useState, useEffect, useRef, useCallback } from "react";

type Phase = "loading" | "dissolving" | "hidden";

function useReducedMotion(): boolean {
    const [reduced, setReduced] = useState(false);
    useEffect(() => {
        const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
        setReduced(mq.matches);
        const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
        mq.addEventListener("change", handler);
        return () => mq.removeEventListener("change", handler);
    }, []);
    return reduced;
}

/** Resolves once the document is fully loaded AND web fonts have settled. */
function waitForAppReady(): Promise<void> {
    return new Promise((resolve) => {
        const fontsReady =
            typeof document !== "undefined" && "fonts" in document
                ? document.fonts.ready.catch(() => undefined)
                : Promise.resolve();

        const domReady =
            typeof document !== "undefined" && document.readyState === "complete"
                ? Promise.resolve()
                : new Promise<void>((res) => {
                      window.addEventListener("load", () => res(), { once: true });
                  });

        Promise.all([domReady, fontsReady]).then(() => resolve());
    });
}

const LOGO_SRC = "/logo/logo.jpg"; // Same asset Navbar.tsx uses — pixel-identical brand mark.

// Total time from "dissolve starts" to "fully removed from DOM" — the
// veil (the slowest layer) determines this ceiling.
const VEIL_FADE_MS = 850;
const VEIL_DELAY_MS = 180;
const TOTAL_DISSOLVE_MS = VEIL_DELAY_MS + VEIL_FADE_MS;

export default function SplashScreen() {
    const [phase, setPhase] = useState<Phase>("loading");
    const reducedMotion = useReducedMotion();
    const unmountTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        let cancelled = false;
        waitForAppReady().then(() => {
            if (!cancelled) setPhase("dissolving");
        });
        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        if (phase !== "dissolving") return;
        const totalMs = reducedMotion ? 220 : TOTAL_DISSOLVE_MS;
        unmountTimerRef.current = setTimeout(() => setPhase("hidden"), totalMs);
        return () => {
            if (unmountTimerRef.current) clearTimeout(unmountTimerRef.current);
        };
    }, [phase, reducedMotion]);

    const dissolving = phase === "dissolving";

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
            {/* ══ LAYER 1 — VEIL (background wash, dissolves LAST) ══ */}
            <div
                className="absolute inset-0"
                style={{
                    background:
                        "radial-gradient(ellipse at 50% 42%, #FFF7ED 0%, #FFFBF5 55%, #FFFFFF 100%)",
                    opacity: dissolving ? 0 : 1,
                    transition: reducedMotion
                        ? "opacity 200ms ease"
                        : `opacity ${VEIL_FADE_MS}ms cubic-bezier(0.4, 0, 0.2, 1) ${VEIL_DELAY_MS}ms`,
                    willChange: dissolving ? "opacity" : undefined,
                }}
                aria-hidden="true"
            />

            {/* ══ Ambient floating particles — idle only, never during dissolve ══ */}
            {!reducedMotion && (
                <>
                    <span
                        className="absolute rounded-full"
                        style={{
                            top: "22%",
                            left: "18%",
                            width: 90,
                            height: 90,
                            background: "radial-gradient(circle, #FFD9B3 0%, transparent 70%)",
                            opacity: dissolving ? 0 : 0.5,
                            transform: "translateZ(0)",
                            animation: dissolving ? "none" : "fkSplashFloat1 6.5s ease-in-out infinite",
                            transition: "opacity 380ms ease",
                            willChange: "transform, opacity",
                        }}
                        aria-hidden="true"
                    />
                    <span
                        className="absolute rounded-full"
                        style={{
                            bottom: "20%",
                            right: "16%",
                            width: 110,
                            height: 110,
                            background: "radial-gradient(circle, #FFC98A 0%, transparent 70%)",
                            opacity: dissolving ? 0 : 0.4,
                            animation: dissolving ? "none" : "fkSplashFloat2 7.8s ease-in-out infinite",
                            transition: "opacity 380ms ease",
                            willChange: "transform, opacity",
                        }}
                        aria-hidden="true"
                    />
                    <span
                        className="absolute rounded-full"
                        style={{
                            top: "62%",
                            left: "12%",
                            width: 56,
                            height: 56,
                            background: "radial-gradient(circle, #FFEAD1 0%, transparent 70%)",
                            opacity: dissolving ? 0 : 0.45,
                            animation: dissolving ? "none" : "fkSplashFloat3 5.6s ease-in-out infinite",
                            transition: "opacity 380ms ease",
                            willChange: "transform, opacity",
                        }}
                        aria-hidden="true"
                    />
                </>
            )}

            {/* ══ LAYER 2 — CONTENT (logo, wordmark, tagline, loader) ══ */}
            <div
                className="relative flex flex-col items-center px-6"
                style={{
                    opacity: dissolving ? 0 : 1,
                    filter: dissolving ? "blur(14px)" : "blur(0px)",
                    transform: dissolving ? "scale(1.07) translateY(-4px)" : "scale(1) translateY(0)",
                    transition: reducedMotion
                        ? "opacity 220ms ease"
                        : "opacity 620ms cubic-bezier(0.4, 0, 0.2, 1), filter 620ms cubic-bezier(0.4, 0, 0.2, 1), transform 620ms cubic-bezier(0.4, 0, 0.2, 1)",
                    willChange: dissolving ? "opacity, filter, transform" : undefined,
                }}
            >
                {/* ── Logo + bloom ── */}
                <div className="relative mb-7 flex h-[108px] w-[108px] items-center justify-center sm:h-[126px] sm:w-[126px]">
                    {/* ══ LAYER 2b — BLOOM (expands + brightens on dissolve) ══ */}
                    <span
                        className="absolute inset-0 -m-6 rounded-full"
                        style={{
                            background: "radial-gradient(circle, #FFB347 0%, transparent 72%)",
                            opacity: dissolving ? 0.9 : 0.55,
                            transform: dissolving
                                ? "scale(2.4)"
                                : reducedMotion
                                ? "scale(1)"
                                : undefined,
                            animation:
                                !dissolving && !reducedMotion
                                    ? "fkSplashGlowPulse 2.6s ease-in-out infinite"
                                    : "none",
                            transition: dissolving
                                ? "transform 750ms cubic-bezier(0.16, 1, 0.3, 1), opacity 750ms cubic-bezier(0.16, 1, 0.3, 1) 280ms"
                                : undefined,
                            willChange: "transform, opacity",
                        }}
                        aria-hidden="true"
                    />

                    {/* Logo mark — real brand asset, subtle depth + float */}
                    <div
                        className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-[28px]"
                        style={{
                            boxShadow:
                                "0 24px 56px rgba(255,92,26,0.30), 0 2px 8px rgba(120,53,15,0.12), inset 0 1px 1px rgba(255,255,255,0.5), inset 0 -1px 3px rgba(154,52,18,0.15)",
                            animation: reducedMotion
                                ? "fkSplashLogoInReduced 0.32s ease-out both"
                                : "fkSplashLogoIn 0.75s cubic-bezier(0.16, 1, 0.3, 1) both, fkSplashLogoFloat 4.2s ease-in-out 0.9s infinite",
                            willChange: "transform, opacity",
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
                        {/* Soft inner glow sheen for premium depth */}
                        <div
                            className="pointer-events-none absolute inset-0"
                            style={{
                                background:
                                    "linear-gradient(155deg, rgba(255,255,255,0.28) 0%, transparent 40%, rgba(120,53,15,0.06) 100%)",
                            }}
                            aria-hidden="true"
                        />
                    </div>
                </div>

                {/* ── Wordmark ── */}
                <h1
                    className="text-[26px] font-black leading-none tracking-tight text-stone-900 sm:text-[30px]"
                    style={{
                        fontFamily: "'Playfair Display', Georgia, serif",
                        animation: reducedMotion
                            ? "fkSplashTextInReduced 0.3s ease-out 0.05s both"
                            : "fkSplashTextIn 0.6s cubic-bezier(0.16, 1, 0.3, 1) 0.2s both",
                    }}
                >
                    FoodKnock
                </h1>

                {/* ── Tagline ── */}
                <p
                    className="mt-2 text-[11px] font-black uppercase tracking-[0.32em] text-orange-500"
                    style={{
                        animation: reducedMotion
                            ? "fkSplashTextInReduced 0.3s ease-out 0.1s both"
                            : "fkSplashTextIn 0.6s cubic-bezier(0.16, 1, 0.3, 1) 0.34s both",
                    }}
                >
                    Fresh in Minutes
                </p>

                {/* ── Loading indicator — a slow rotating gradient ring,
                    timed in step with the bloom pulse so it never feels
                    like a separate, disconnected element ── */}
                <div
                    className="mt-9 flex items-center justify-center"
                    style={{
                        animation: reducedMotion
                            ? "fkSplashTextInReduced 0.3s ease-out 0.14s both"
                            : "fkSplashTextIn 0.6s cubic-bezier(0.16, 1, 0.3, 1) 0.48s both",
                    }}
                >
                    <div
                        className="relative h-6 w-6"
                        style={{
                            animation: reducedMotion ? "none" : "fkSplashRingSpin 1.3s linear infinite",
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
            </div>

            <style jsx>{`
                @keyframes fkSplashLogoIn {
                    0% {
                        opacity: 0;
                        transform: scale(0.9) translateY(6px);
                    }
                    100% {
                        opacity: 1;
                        transform: scale(1) translateY(0);
                    }
                }
                @keyframes fkSplashLogoInReduced {
                    from { opacity: 0; }
                    to   { opacity: 1; }
                }
                @keyframes fkSplashLogoFloat {
                    0%, 100% { transform: translateY(0); }
                    50%      { transform: translateY(-5px); }
                }
                @keyframes fkSplashTextIn {
                    0% {
                        opacity: 0;
                        transform: translateY(8px);
                    }
                    100% {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }
                @keyframes fkSplashTextInReduced {
                    from { opacity: 0; }
                    to   { opacity: 1; }
                }
                @keyframes fkSplashGlowPulse {
                    0%, 100% {
                        transform: scale(1);
                        opacity: 0.45;
                    }
                    50% {
                        transform: scale(1.14);
                        opacity: 0.68;
                    }
                }
                @keyframes fkSplashRingSpin {
                    from { transform: rotate(0deg); }
                    to   { transform: rotate(360deg); }
                }
                @keyframes fkSplashFloat1 {
                    0%, 100% { transform: translate(0, 0); }
                    50%      { transform: translate(10px, -14px); }
                }
                @keyframes fkSplashFloat2 {
                    0%, 100% { transform: translate(0, 0); }
                    50%      { transform: translate(-12px, 10px); }
                }
                @keyframes fkSplashFloat3 {
                    0%, 100% { transform: translate(0, 0); }
                    50%      { transform: translate(8px, 12px); }
                }
            `}</style>
        </div>
    );
}