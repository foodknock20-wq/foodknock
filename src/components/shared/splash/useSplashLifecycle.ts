"use client";

// src/components/shared/splash/useSplashLifecycle.ts
//
// FoodKnock Splash System — lifecycle hook.
//
// Extracts the splash's entire state machine (readiness detection →
// dissolve → hidden) out of the orchestrator component. Nothing about the
// actual readiness signals changed from the original single-file
// implementation: still document.readyState === "complete" (or the
// `load` event) AND document.fonts.ready — no fake delay, no hardcoded
// setTimeout wait. What moved is WHERE this logic lives.
//
// OPTIONAL SAFETY NET (`maxActiveMs`): disabled (undefined) by default,
// meaning behavior is UNCHANGED from a strict "wait for real readiness,
// however long that takes, never a fake delay" contract. If a caller
// explicitly opts in with a value, that becomes a last-resort ceiling for
// pathological environments only (e.g. a browser extension that somehow
// prevents `load` from ever firing) — hitting it is logged distinctly via
// splashDebug's "ready-fallback" event, specifically so it's never
// confused with genuine readiness during a QA timing review.
// SplashScreen.tsx does NOT pass this option today — it's exposed here,
// off by default, for future defensive use without requiring a change to
// this file's core contract.

import { useState, useEffect, useRef } from "react";
import type { SplashPhase } from "./types";
import { EXIT_TOTAL_MS, EXIT_REDUCED_MOTION_MS } from "./motionTokens";
import { markSplashEvent } from "./splashDebug";

/**
 * Resolves once the document is fully loaded AND web fonts have settled —
 * the two real "the app is actually ready to look right" signals. Both
 * are awaited so the wordmark can never dissolve away a frame before its
 * final font has swapped in, which would otherwise produce a visible
 * one-frame typeface jump right as the veil is fading.
 */
function waitForDomAndFontsReady(): Promise<void> {
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

/**
 * Watches prefers-reduced-motion, including LIVE changes if the user
 * toggles the OS setting mid-session — rare, but cheap to handle correctly.
 */
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

export type SplashLifecycle = {
    phase: SplashPhase;
    /** Convenience derived flag — `phase === "dissolving"`. Layers only ever need this boolean, never the raw phase enum. */
    dissolving: boolean;
    reducedMotion: boolean;
};

export type UseSplashLifecycleOptions = {
    /**
     * Last-resort ceiling on the "active" phase, in milliseconds.
     * UNDEFINED BY DEFAULT — leaving this unset means the hook waits for
     * genuine readiness with no cap whatsoever, exactly like the original
     * implementation. Only set this if you specifically need a defensive
     * fallback for environments where `load` might never fire; doing so
     * is a deliberate, distinctly-logged deviation from "always wait for
     * real readiness," not a general-purpose timeout.
     */
    maxActiveMs?: number;
};

export function useSplashLifecycle(options?: UseSplashLifecycleOptions): SplashLifecycle {
    const { maxActiveMs } = options ?? {};
    const [phase, setPhase] = useState<SplashPhase>("active");
    const reducedMotion = useReducedMotion();
    const unmountTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const fallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const resolvedRef = useRef(false);
    const mountedAtRef = useRef<number | null>(null);

    useEffect(() => {
        mountedAtRef.current = typeof performance !== "undefined" ? performance.now() : Date.now();
        markSplashEvent("mounted");
    }, []);

    useEffect(() => {
        let cancelled = false;

        const resolveOnce = (event: "ready" | "ready-fallback") => {
            if (cancelled || resolvedRef.current) return;
            resolvedRef.current = true;
            if (fallbackTimerRef.current) clearTimeout(fallbackTimerRef.current);

            const activeMs =
                mountedAtRef.current != null
                    ? Math.round(
                          (typeof performance !== "undefined" ? performance.now() : Date.now()) -
                              mountedAtRef.current
                      )
                    : null;
            markSplashEvent(event, activeMs != null ? { activeMs } : undefined);
            setPhase("dissolving");
        };

        waitForDomAndFontsReady().then(() => resolveOnce("ready"));

        if (typeof maxActiveMs === "number" && maxActiveMs > 0) {
            fallbackTimerRef.current = setTimeout(() => resolveOnce("ready-fallback"), maxActiveMs);
        }

        return () => {
            cancelled = true;
            if (fallbackTimerRef.current) clearTimeout(fallbackTimerRef.current);
        };
    }, [maxActiveMs]);

    useEffect(() => {
        if (phase !== "dissolving") return;
        markSplashEvent("dissolving");
        const totalMs = reducedMotion ? EXIT_REDUCED_MOTION_MS : EXIT_TOTAL_MS;
        unmountTimerRef.current = setTimeout(() => {
            markSplashEvent("hidden");
            setPhase("hidden");
        }, totalMs);
        return () => {
            if (unmountTimerRef.current) clearTimeout(unmountTimerRef.current);
        };
    }, [phase, reducedMotion]);

    return {
        phase,
        dissolving: phase === "dissolving",
        reducedMotion,
    };
}