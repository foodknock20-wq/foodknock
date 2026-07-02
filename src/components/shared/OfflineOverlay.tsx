"use client";

// src/components/shared/OfflineOverlay.tsx
//
// FoodKnock — premium offline experience overlay.
//
// PURELY CLIENT-SIDE. Does NOT touch public/sw.js, does NOT change
// routing, does NOT redirect, does NOT reload, and does NOT interfere
// with Push Notifications, FCM, Web Push, notificationclick, caching,
// background sync, the install prompt, or the manifest in any way. It
// mounts once in the root layout (same pattern as the existing
// NotificationPrompt) and renders a full-screen branded overlay ON TOP
// of whatever page is currently mounted underneath — that page is NEVER
// unmounted, reloaded, or navigated away from. Dismissing the overlay
// simply stops rendering it, revealing the exact same page/scroll
// position/component state the user already had.
//
// ── DETECTION STRATEGY (UNCHANGED) ──────────────────────────────────────
// 1. `navigator.onLine` is used ONLY as a cheap synchronous first guess
//    on mount, to decide whether to show the overlay before the first
//    real check resolves — never trusted alone for the actual decision,
//    since it's well known to report `true` on networks with no real
//    internet (captive portals, dead Wi-Fi, etc).
// 2. Every actual show/hide decision is confirmed by a REAL network
//    request to /ping.txt (a static file — see file header there),
//    sent with `cache: "no-store"` and a short abort-timeout. This is
//    what makes both the Retry button and automatic reconnection
//    genuinely reliable rather than optimistic.
// 3. Native `online`/`offline` browser events drive the primary
//    detection loop. `online` triggers a re-verification via the same
//    real probe before dismissing (a flaky reconnect blip must not
//    flash the app and then immediately re-show the overlay).
// 4. A background recheck interval runs ONLY while the overlay is
//    showing, as a supplement in case a browser/WebView context (some
//    Android TWA/WebView implementations are less reliable here) ever
//    fails to fire the `online` event promptly. It stops immediately
//    the moment connectivity is confirmed, and never runs at all while
//    the app is healthy — zero background cost in the normal case.
//
// ── ENGAGEMENT LAYER (NEW, purely presentational) ───────────────────────
// While the user waits, a rotating strip of short, FoodKnock-flavoured
// food facts/tips keeps the screen from feeling dead — cycles every few
// seconds via a simple setInterval, entirely local UI state, zero network
// calls, zero effect on the connectivity detection above. An elapsed-time
// counter gives honest, reassuring feedback ("still trying, X seconds")
// instead of a static frozen screen.

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { WifiOff, RotateCw, Wifi, Sparkles } from "lucide-react";

const PING_URL = "/ping.txt";
const PING_TIMEOUT_MS = 4000;
const BACKGROUND_RECHECK_MS = 6000;

type ConnState = "online" | "offline" | "checking";

/**
 * Performs one real connectivity check against /ping.txt. Returns true
 * only on a genuine successful response — never inferred from
 * navigator.onLine, except as a fast-fail shortcut when the browser is
 * ABSOLUTELY certain there is no network at all (airplane mode, Wi-Fi
 * off), which skips a doomed round trip rather than waiting for it to
 * time out.
 */
async function probeConnectivity(): Promise<boolean> {
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
        return false;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), PING_TIMEOUT_MS);

    try {
        const res = await fetch(`${PING_URL}?t=${Date.now()}`, {
            method: "GET",
            cache: "no-store",
            signal: controller.signal,
        });
        return res.ok;
    } catch {
        return false;
    } finally {
        clearTimeout(timeoutId);
    }
}

// ── Engagement content — rotating while the user waits ────────────────
// Deliberately short, warm, food-brand-flavoured lines. Pure UI copy,
// zero business logic, zero data fetching — safe to edit/extend freely
// without touching anything above this point.
const WAITING_TIPS: { emoji: string; text: string }[] = [
    { emoji: "🍔", text: "Your cravings are safe with us — we'll be right back." },
    { emoji: "⚡", text: "Once you're back online, everything picks up exactly where you left off." },
    { emoji: "🔥", text: "Fresh food, fast delivery — worth the wait for a stable connection too." },
    { emoji: "📦", text: "No refresh needed. We're watching the network for you." },
    { emoji: "🍕", text: "Did you know? Our kitchen preps orders fresh, never pre-made." },
    { emoji: "💛", text: "Hang tight — this usually reconnects in just a few seconds." },
    { emoji: "🛵", text: "Meanwhile, your cart and progress are exactly as you left them." },
];

function formatElapsed(seconds: number): string {
    if (seconds < 60) return `${seconds}s`;
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}m ${s}s`;
}

export default function OfflineOverlay() {
    const [state, setState] = useState<ConnState>("checking");
    const [retrying, setRetrying] = useState(false);
    const mountedRef = useRef(true);
    const backgroundTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // ── Engagement layer state (new, purely presentational) ────────────
    const [tipIndex, setTipIndex] = useState(0);
    const [elapsedSeconds, setElapsedSeconds] = useState(0);
    const engagementTimersRef = useRef<{
        tip: ReturnType<typeof setInterval> | null;
        clock: ReturnType<typeof setInterval> | null;
    }>({ tip: null, clock: null });

    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
        };
    }, []);

    const runCheck = useCallback(async (): Promise<boolean> => {
        const ok = await probeConnectivity();
        if (mountedRef.current) {
            setState(ok ? "online" : "offline");
        }
        return ok;
    }, []);

    // Initial state — a quick synchronous guess from navigator.onLine so
    // the overlay doesn't flash unnecessarily while the first real probe
    // (below) is still in flight.
    useEffect(() => {
        if (typeof navigator !== "undefined" && navigator.onLine === false) {
            setState("offline");
        }
        void runCheck();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Native browser connectivity events — the primary detection path.
    useEffect(() => {
        const handleOnline = () => {
            // Confirmed via real probe before dismissing — never trust
            // the event alone.
            void runCheck();
        };
        const handleOffline = () => {
            if (mountedRef.current) setState("offline");
        };

        window.addEventListener("online", handleOnline);
        window.addEventListener("offline", handleOffline);
        return () => {
            window.removeEventListener("online", handleOnline);
            window.removeEventListener("offline", handleOffline);
        };
    }, [runCheck]);

    // Background recheck loop — active ONLY while offline. Stops the
    // instant connectivity is confirmed; never runs while healthy.
    useEffect(() => {
        if (state !== "offline") {
            if (backgroundTimerRef.current) {
                clearInterval(backgroundTimerRef.current);
                backgroundTimerRef.current = null;
            }
            return;
        }

        backgroundTimerRef.current = setInterval(() => {
            void runCheck();
        }, BACKGROUND_RECHECK_MS);

        return () => {
            if (backgroundTimerRef.current) {
                clearInterval(backgroundTimerRef.current);
                backgroundTimerRef.current = null;
            }
        };
    }, [state, runCheck]);

    // ── Engagement timers — tip rotation + elapsed clock — ONLY while
    // the overlay is actually showing. Reset the moment it hides, so a
    // future offline session always starts fresh at 0s / tip #0 rather
    // than continuing a stale counter. Purely local UI state, no network
    // involvement whatsoever. ─────────────────────────────────────────
    useEffect(() => {
        if (state !== "offline") {
            if (engagementTimersRef.current.tip) clearInterval(engagementTimersRef.current.tip);
            if (engagementTimersRef.current.clock) clearInterval(engagementTimersRef.current.clock);
            engagementTimersRef.current.tip = null;
            engagementTimersRef.current.clock = null;
            setTipIndex(0);
            setElapsedSeconds(0);
            return;
        }

        engagementTimersRef.current.tip = setInterval(() => {
            setTipIndex((i) => (i + 1) % WAITING_TIPS.length);
        }, 3600);

        engagementTimersRef.current.clock = setInterval(() => {
            setElapsedSeconds((s) => s + 1);
        }, 1000);

        return () => {
            if (engagementTimersRef.current.tip) clearInterval(engagementTimersRef.current.tip);
            if (engagementTimersRef.current.clock) clearInterval(engagementTimersRef.current.clock);
            engagementTimersRef.current.tip = null;
            engagementTimersRef.current.clock = null;
        };
    }, [state]);

    const handleRetry = useCallback(async () => {
        setRetrying(true);
        await runCheck();
        if (mountedRef.current) setRetrying(false);
    }, [runCheck]);

    const currentTip = useMemo(() => WAITING_TIPS[tipIndex], [tipIndex]);

    if (state !== "offline") return null;

    return (
        <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="offline-overlay-title"
            aria-describedby="offline-overlay-description"
            className="fixed inset-0 z-[999] flex items-center justify-center overflow-y-auto bg-[#FFFBF5] px-5 py-8"
            style={{
                paddingTop: "max(2rem, env(safe-area-inset-top, 0px))",
                paddingBottom: "max(2rem, env(safe-area-inset-bottom, 0px))",
                animation: "fkOfflineFadeIn 0.28s ease both",
            }}
        >
            {/* Ambient warm glow — FoodKnock's existing brand language, now
                two layered pulses for a slightly more alive backdrop */}
            <div
                className="pointer-events-none absolute -top-24 left-1/2 h-[420px] w-[420px] -translate-x-1/2 rounded-full opacity-20 blur-3xl"
                style={{
                    background: "radial-gradient(ellipse, #fb923c, transparent 70%)",
                    animation: "fkOfflineGlowPulse 5s ease-in-out infinite",
                }}
                aria-hidden="true"
            />
            <div
                className="pointer-events-none absolute -bottom-24 left-1/2 h-[320px] w-[320px] -translate-x-1/2 rounded-full opacity-10 blur-3xl"
                style={{
                    background: "radial-gradient(ellipse, #fbbf24, transparent 70%)",
                    animation: "fkOfflineGlowPulse 5s ease-in-out infinite 1.2s",
                }}
                aria-hidden="true"
            />

            <div
                className="relative flex w-full max-w-sm flex-col items-center text-center"
                style={{ animation: "fkOfflineRiseIn 0.36s cubic-bezier(0.16, 1, 0.3, 1) both" }}
            >
                {/* Large illustration/icon — layered pulse rings for a
                    "searching for signal" feeling */}
                <div className="relative mb-6 flex h-28 w-28 items-center justify-center sm:h-32 sm:w-32">
                    <span
                        className="absolute inset-0 rounded-full border-2 border-orange-300/50"
                        style={{ animation: "fkOfflineRing 2.4s ease-out infinite" }}
                        aria-hidden="true"
                    />
                    <span
                        className="absolute inset-0 rounded-full border-2 border-amber-300/40"
                        style={{ animation: "fkOfflineRing 2.4s ease-out infinite 0.8s" }}
                        aria-hidden="true"
                    />
                    <div
                        className="absolute inset-0 -m-3 rounded-full opacity-70 blur-xl"
                        style={{ background: "radial-gradient(circle, #FFB347, transparent 70%)" }}
                        aria-hidden="true"
                    />
                    <div
                        className="relative flex h-24 w-24 items-center justify-center rounded-[28px] shadow-lg sm:h-28 sm:w-28"
                        style={{
                            background: "linear-gradient(135deg, #FF5C1A 0%, #FFB347 100%)",
                            boxShadow: "0 16px 40px rgba(255,92,26,0.35)",
                            animation: "fkOfflineIconFloat 3s ease-in-out infinite",
                        }}
                    >
                        <WifiOff size={38} className="text-white sm:h-10 sm:w-10" strokeWidth={2} />
                    </div>
                </div>

                {/* Brand mark */}
                <p className="mb-2 text-[10px] font-black uppercase tracking-[0.28em] text-orange-500">
                    FoodKnock
                </p>

                <h1
                    id="offline-overlay-title"
                    className="mb-2 text-[22px] font-black leading-tight text-stone-900 sm:text-[24px]"
                    style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
                >
                    No Internet Connection
                </h1>

                <p
                    id="offline-overlay-description"
                    className="mb-1.5 max-w-[280px] text-[14px] leading-relaxed text-stone-500"
                >
                    We&apos;re trying to reconnect you. Your page will resume automatically the moment you&apos;re back online.
                </p>

                {/* Elapsed time — honest, reassuring feedback instead of a
                    frozen static screen */}
                <p className="mb-6 text-[11px] font-semibold text-stone-400">
                    Trying for {formatElapsed(elapsedSeconds)}…
                </p>

                {/* Animated status indicator */}
                <div className="mb-6 flex items-center gap-2 rounded-full border border-red-200 bg-red-50 px-4 py-2">
                    <span className="relative flex h-2 w-2">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                        <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
                    </span>
                    <span className="text-[12px] font-bold text-red-600">
                        {retrying ? "Checking connection…" : "Offline"}
                    </span>
                </div>

                {/* Rotating engagement tip — keeps the screen alive while
                    waiting, purely presentational, no network involvement */}
                <div
                    key={tipIndex}
                    className="mb-7 flex w-full items-center gap-2.5 rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 px-4 py-3 text-left shadow-sm"
                    style={{ animation: "fkOfflineTipIn 0.4s ease both" }}
                >
                    <span className="shrink-0 text-[18px] leading-none">{currentTip.emoji}</span>
                    <p className="text-[12.5px] font-medium leading-snug text-stone-600">
                        {currentTip.text}
                    </p>
                </div>

                {/* Retry button — performs a real /ping.txt request */}
                <button
                    onClick={handleRetry}
                    disabled={retrying}
                    aria-label="Retry connection"
                    className="flex min-h-[48px] items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 px-8 text-[14px] font-black text-white shadow-lg shadow-orange-200 transition-all hover:brightness-110 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-70"
                >
                    <RotateCw size={16} strokeWidth={2.5} className={retrying ? "animate-spin" : ""} />
                    {retrying ? "Retrying…" : "Retry"}
                </button>

                <p className="mt-5 flex items-center gap-1.5 text-[11px] text-stone-400">
                    <Wifi size={11} />
                    We&apos;ll reconnect automatically — no need to refresh
                </p>

                {/* Small closing flourish — reinforces brand warmth without
                    adding any interactive/functional surface area */}
                <div className="mt-6 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-orange-300">
                    <Sparkles size={11} />
                    Fresh &amp; Fast, Even When You&apos;re Not
                </div>
            </div>

            <style jsx>{`
                @keyframes fkOfflineFadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                @keyframes fkOfflineRiseIn {
                    from { opacity: 0; transform: translateY(14px) scale(0.97); }
                    to { opacity: 1; transform: translateY(0) scale(1); }
                }
                @keyframes fkOfflineGlowPulse {
                    0%, 100% { opacity: 0.20; transform: translateX(-50%) scale(1); }
                    50%      { opacity: 0.32; transform: translateX(-50%) scale(1.06); }
                }
                @keyframes fkOfflineIconFloat {
                    0%, 100% { transform: translateY(0); }
                    50%      { transform: translateY(-5px); }
                }
                @keyframes fkOfflineRing {
                    0%   { transform: scale(0.85); opacity: 0.65; }
                    100% { transform: scale(1.35); opacity: 0; }
                }
                @keyframes fkOfflineTipIn {
                    from { opacity: 0; transform: translateY(6px); }
                    to   { opacity: 1; transform: translateY(0); }
                }
            `}</style>
        </div>
    );
}