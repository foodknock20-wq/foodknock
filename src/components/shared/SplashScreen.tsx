"use client";

// src/components/shared/SplashScreen.tsx
//
// FoodKnock — premium startup splash screen (Paytm/Blinkit/Swiggy/Zomato/
// PhonePe-tier polish, FoodKnock's own orange/white branding).
//
// ARCHITECTURE NOTE: Next.js App Router's loading.tsx only covers
// route-segment Suspense boundaries during navigation — it does NOT cover
// true first-load app initialization/hydration, which is what this splash
// is for. This is therefore a small, always-mounted client overlay in the
// root layout, the same established pattern as NotificationPrompt and
// OfflineOverlay in this codebase. It has zero dependency on and zero
// effect on business logic, auth, orders, notifications, or the service
// worker — it only reads document/window readiness signals and renders
// a decorative overlay on top of whatever mounts underneath it.
//
// NO HYDRATION MISMATCH: the splash renders visible by DEFAULT on both
// the server and the first client render (identical markup either side),
// so React never has anything to reconcile-diff here. It only becomes
// invisible after a client-only `useEffect` confirms real readiness —
// exactly the kind of state change that's supposed to happen after
// hydration, not during it.
//
// NO FAKE DELAY: readiness is derived from real signals —
// `document.readyState === "complete"` (or the `load` event firing) AND
// `document.fonts.ready` (so the wordmark never flashes an unstyled
// fallback font mid-fade). If the app is already fully loaded by the time
// this effect runs (fast connection, warm cache), the splash fades almost
// immediately. If initialization takes longer, it stays visible until
// those real signals fire — never a hardcoded setTimeout(..., 2500).
//
// ANIMATION: pure `transform`/`opacity` transitions only (GPU-accelerated,
// no layout-triggering properties), respects `prefers-reduced-motion` by
// swapping every animation for an instant/near-instant fade.

import { useState, useEffect, useRef } from "react";

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

/** Resolves once the document is fully loaded AND web fonts have settled — the two real "app is actually ready to look right" signals, no artificial waiting involved. */
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

const FADE_OUT_MS = 480;

export default function SplashScreen() {
    // Visible by default on BOTH server and first client render — this is
    // what guarantees zero hydration mismatch (see file header).
    const [ready, setReady] = useState(false);
    const [unmounted, setUnmounted] = useState(false);
    const reducedMotion = useReducedMotion();
    const unmountTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        let cancelled = false;

        waitForAppReady().then(() => {
            if (cancelled) return;
            setReady(true);
        });

        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        if (!ready) return;
        // Remove from the DOM entirely once the fade-out transition
        // finishes — prevents the (now invisible) overlay from continuing
        // to sit in the accessibility tree or intercept any stray pointer
        // events during the transition.
        unmountTimerRef.current = setTimeout(
            () => setUnmounted(true),
            reducedMotion ? 60 : FADE_OUT_MS
        );
        return () => {
            if (unmountTimerRef.current) clearTimeout(unmountTimerRef.current);
        };
    }, [ready, reducedMotion]);

    if (unmounted) return null;

    return (
        <div
            aria-hidden={ready}
            role={ready ? undefined : "status"}
            aria-label={ready ? undefined : "FoodKnock is loading"}
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-white"
            style={{
                opacity: ready ? 0 : 1,
                transition: reducedMotion
                    ? "opacity 60ms linear"
                    : `opacity ${FADE_OUT_MS}ms cubic-bezier(0.4, 0, 0.2, 1)`,
                pointerEvents: ready ? "none" : "auto",
                paddingTop: "env(safe-area-inset-top, 0px)",
                paddingBottom: "env(safe-area-inset-bottom, 0px)",
                paddingLeft: "env(safe-area-inset-left, 0px)",
                paddingRight: "env(safe-area-inset-right, 0px)",
            }}
        >
            {/* Soft background gradient wash — subtle, never competes with the logo */}
            <div
                className="pointer-events-none absolute inset-0"
                style={{
                    background:
                        "radial-gradient(ellipse at 50% 42%, #FFF7ED 0%, #FFFBF5 55%, #FFFFFF 100%)",
                }}
                aria-hidden="true"
            />

            <div className="relative flex flex-col items-center px-6">
                {/* ── Logo + pulsing glow ── */}
                <div className="relative mb-7 flex h-[104px] w-[104px] items-center justify-center sm:h-[120px] sm:w-[120px]">
                    {/* Pulsing orange glow behind the logo */}
                    <span
                        className="absolute inset-0 -m-6 rounded-full"
                        style={{
                            background: "radial-gradient(circle, #FFB347 0%, transparent 72%)",
                            opacity: 0.55,
                            animation: reducedMotion
                                ? "none"
                                : "fkSplashGlowPulse 2.2s ease-in-out infinite",
                            willChange: "transform, opacity",
                        }}
                        aria-hidden="true"
                    />

                    {/* Logo mark — fades in, scales 0.9 → 1 */}
                    <div
                        className="relative flex h-full w-full items-center justify-center rounded-[28px] shadow-xl"
                        style={{
                            background: "linear-gradient(135deg, #FF5C1A 0%, #FFB347 100%)",
                            boxShadow: "0 20px 48px rgba(255,92,26,0.32)",
                            animation: reducedMotion
                                ? "fkSplashLogoInReduced 0.3s ease-out both"
                                : "fkSplashLogoIn 0.7s cubic-bezier(0.16, 1, 0.3, 1) both",
                            willChange: "transform, opacity",
                        }}
                    >
                        {/* Simple, brand-accurate mark: a stylized "F" knot —
                            deliberately typographic/geometric rather than an
                            <img>, so the splash has zero network dependency
                            and can never itself be the thing waiting to load. */}
                        <svg
                            width="52"
                            height="52"
                            viewBox="0 0 52 52"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                            className="sm:h-[60px] sm:w-[60px]"
                        >
                            <path
                                d="M14 10h24a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2H20v8h14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2H20v10a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2V12a2 2 0 0 1 2-2Z"
                                fill="white"
                            />
                        </svg>
                    </div>
                </div>

                {/* ── Wordmark ── */}
                <h1
                    className="text-[26px] font-black leading-none tracking-tight text-stone-900 sm:text-[30px]"
                    style={{
                        fontFamily: "'Playfair Display', Georgia, serif",
                        animation: reducedMotion
                            ? "fkSplashTextInReduced 0.3s ease-out 0.05s both"
                            : "fkSplashTextIn 0.6s cubic-bezier(0.16, 1, 0.3, 1) 0.18s both",
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
                            : "fkSplashTextIn 0.6s cubic-bezier(0.16, 1, 0.3, 1) 0.32s both",
                    }}
                >
                    Fresh in Minutes
                </p>

                {/* ── Loading dots — continuous, only while not ready ── */}
                <div
                    className="mt-9 flex items-center gap-1.5"
                    style={{
                        animation: reducedMotion
                            ? "fkSplashTextInReduced 0.3s ease-out 0.14s both"
                            : "fkSplashTextIn 0.6s cubic-bezier(0.16, 1, 0.3, 1) 0.46s both",
                    }}
                >
                    {[0, 1, 2].map((i) => (
                        <span
                            key={i}
                            className="h-2 w-2 rounded-full"
                            style={{
                                background: "linear-gradient(135deg, #FF5C1A, #FFB347)",
                                animation: reducedMotion
                                    ? "none"
                                    : `fkSplashDotBounce 1.1s ease-in-out ${i * 0.15}s infinite`,
                                opacity: reducedMotion ? 0.6 : undefined,
                                willChange: "transform, opacity",
                            }}
                        />
                    ))}
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
                        transform: scale(1.12);
                        opacity: 0.65;
                    }
                }
                @keyframes fkSplashDotBounce {
                    0%, 80%, 100% {
                        transform: translateY(0) scale(0.85);
                        opacity: 0.5;
                    }
                    40% {
                        transform: translateY(-6px) scale(1);
                        opacity: 1;
                    }
                }
            `}</style>
        </div>
    );
}