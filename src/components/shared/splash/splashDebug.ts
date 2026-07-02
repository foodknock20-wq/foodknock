// src/components/shared/splash/splashDebug.ts
//
// FoodKnock Splash System — development-only lifecycle logger.
//
// Exists purely to make the splash's real-world timing verifiable during
// QA: "did it really wait for readiness, or did someone accidentally
// reintroduce a fake delay?" is now answerable from the console instead
// of manually timing a screen recording.
//
// COMPLETELY INERT IN PRODUCTION: every call is a no-op unless
// process.env.NODE_ENV !== "production" — zero effect on production
// behavior, timing, or (after dead-code elimination) bundle size.

type SplashEventName = "mounted" | "ready" | "ready-fallback" | "dissolving" | "hidden";

const IS_DEV = process.env.NODE_ENV !== "production";

export function markSplashEvent(name: SplashEventName, detail?: Record<string, unknown>): void {
    if (!IS_DEV) return;
    if (typeof console === "undefined") return;

    const label = `[FoodKnock Splash] ${name}`;
    if (detail) {
        // eslint-disable-next-line no-console
        console.log(label, detail);
    } else {
        // eslint-disable-next-line no-console
        console.log(label);
    }

    // Also record a real Performance Timeline mark when available — lets
    // the same data show up in the browser's Performance panel alongside
    // paint/hydration marks, for anyone profiling startup more rigorously
    // than a console.log affords.
    if (typeof performance !== "undefined" && typeof performance.mark === "function") {
        try {
            performance.mark(`foodknock-splash:${name}`);
        } catch {
            // Some sandboxed/unusual environments can throw on mark names
            // — never let a debug-only utility affect the actual splash.
        }
    }
}