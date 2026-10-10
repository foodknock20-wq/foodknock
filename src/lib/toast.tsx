"use client";

// src/lib/toast.tsx
//
// FoodKnock UI 2.0 — Phase 1 created a thin `toastSuccess`/`toastError`/
// `toastInfo` wrapper here around react-hot-toast's default `toast.success`/
// `toast.error` — same library, same global <Toaster> (src/app/layout.tsx),
// just named helpers. Those plain calls rendered the library's own default
// card: a plain white box + a basic colored icon, no brand treatment — the
// "generic error box" this redesign addresses.
//
// Premium Toast Redesign — still the SAME library (react-hot-toast), still
// the SAME global <Toaster>, still a `.ts`→`.tsx` rename of the same file
// (every existing import site uses the extension-less `@/lib/toast`, so no
// caller needed to change). What changed: these helpers now render through
// `toast.custom()` with FoodKnock's own card markup (icon container, left
// accent border, design tokens already used throughout the rest of this
// app) instead of react-hot-toast's built-in `toast.success`/`toast.error`
// rendering. No second toast system, no new dependency, no new <Toaster>.
//
// Auto-dismiss is now owned by THIS file, not react-hot-toast's internal
// timer — `toast.custom(..., { duration: Infinity })` tells the library to
// never auto-dismiss on its own, and PremiumToastCard below runs its own
// pausable `setTimeout`. That's what makes real hover-pause/resume
// possible: react-hot-toast's own internal timer has no public pause API,
// so owning the timer here is the only way to pause and resume it instead
// of merely resetting it.
//
// TOAST AUTO-DISMISS FIX — two real, reproducible lifecycle bugs found and
// fixed in PremiumToastCard below (see its own inline comments for the
// full trace):
//   1. The dismiss-timer effect was keyed on `[t.id]` only. Several call
//      sites share one stable `id` by design (e.g. useAddToCart.ts's
//      "fk-add-to-cart", so rapid add-to-cart taps update one visible
//      toast instead of stacking a new one per tap). react-hot-toast
//      updates an existing id's content WITHOUT remounting the React
//      component, so a second call delivered a new message/duration to
//      the same component instance — but since `t.id` never changed, the
//      effect never re-ran to restart the timer, and `remainingRef`'s
//      `useRef(duration)` initial value stayed frozen to the FIRST call's
//      duration forever. This is the exact reported bug ("Maggi, Momos &
//      Chocolate Shake Combo added!" never disappearing during checkout).
//   2. `pause()`/`resume()` were wired to `onMouseEnter`/`onMouseLeave`.
//      Touch browsers can synthesize `mouseenter` from a tap with no
//      matching `mouseleave` ever firing, permanently pausing the timer
//      with no event left to resume it. Fixed with Pointer Events gated
//      on `pointerType === "mouse"` — touch input never engages pause at
//      all, so touch users never depend on hover to resume.

import toast, { type Toast } from "react-hot-toast";
import { useEffect, useRef } from "react";
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from "lucide-react";

type ToastKind = "success" | "error" | "warning" | "info";

// Pure, directly unit-testable extractions of the two bug-fix decision
// rules below (no DOM/jsdom available in this project's test setup, and
// adding one just for this would be an unnecessary new dependency — see
// src/lib/__tests__/toastTimer.test.ts for why these are tested standalone
// instead of through a rendered component).
//
// Root cause #2's fix — only a genuine mouse should ever pause/resume the
// timer. PointerEvent.pointerType is "mouse" | "pen" | "touch"; a touch tap
// must never engage pause (see this file's header for the full bug).
export function isHoverPausePointer(pointerType: string): boolean {
    return pointerType === "mouse";
}

// The actual remaining-time math used by both `pause()` (shrink by elapsed)
// and as the general "never go negative" guard — pulled out so its
// arithmetic has a direct test independent of any timer/DOM mechanics.
export function computeRemainingMs(remaining: number, elapsedMs: number): number {
    return Math.max(0, remaining - elapsedMs);
}

const KIND_CONFIG: Record<ToastKind, {
    Icon: typeof CheckCircle2;
    iconBg: string;
    iconColor: string;
    accent: string;
}> = {
    success: { Icon: CheckCircle2, iconBg: "bg-fk-success/10", iconColor: "text-fk-success", accent: "border-l-fk-success" },
    error: { Icon: XCircle, iconBg: "bg-fk-danger/10", iconColor: "text-fk-danger", accent: "border-l-fk-danger" },
    warning: { Icon: AlertTriangle, iconBg: "bg-amber-50", iconColor: "text-amber-600", accent: "border-l-amber-400" },
    info: { Icon: Info, iconBg: "bg-blue-50", iconColor: "text-blue-600", accent: "border-l-blue-400" },
};

function PremiumToastCard({
    t,
    kind,
    message,
    duration,
    dismissible,
}: {
    t: Toast;
    kind: ToastKind;
    message: string;
    duration: number;
    dismissible: boolean;
}) {
    // Real pause/resume, not just "reset the timer on hover" — elapsed
    // time is tracked explicitly so leaving and re-entering the card
    // mid-countdown resumes with the ACTUAL remaining time, not a fresh
    // full duration (which would make hovering briefly keep a toast alive
    // far longer than intended).
    const remainingRef = useRef(duration);
    // `Date.now()` is only ever read inside the effect/pause/resume below
    // (never during render) — the ref itself just needs a numeric initial
    // value here; this avoids calling the impure `Date.now()` during the
    // render phase itself.
    const startRef = useRef(0);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // TOAST AUTO-DISMISS FIX — root cause #1: several call sites share ONE
    // stable toast `id` on purpose (e.g. useAddToCart.ts's "fk-add-to-cart",
    // so rapid add-to-cart taps update one visible toast instead of
    // stacking). react-hot-toast updates an existing id in place — it does
    // NOT unmount/remount the React component — so a second add-to-cart
    // call delivers a brand-new `message`/`duration` to this SAME component
    // instance. The effect used to be keyed on `[t.id]` only (that id never
    // changes across those updates), so it never re-ran: the dismiss timer
    // armed on the FIRST call was the only one that would ever fire, and
    // `remainingRef`'s `useRef(duration)` initial value was likewise frozen
    // to that first call's duration forever. A toast updated this way could
    // end up effectively stuck (or dismiss using stale timing) regardless
    // of how many further adds happened — exactly the reported "Combo
    // added!" toast during checkout never disappearing. Fixed by keying the
    // effect on the actual content that changes per call (`message`,
    // `duration`) in addition to `t.id`, and resetting `remainingRef`
    // inside the effect body itself (not just as a one-time initial value)
    // so every update — not only the very first mount — (re)arms a fresh,
    // correctly-timed dismiss.
    useEffect(() => {
        if (!Number.isFinite(duration)) return; // Infinity = never auto-dismiss (e.g. a loading toast resolved manually)
        remainingRef.current = duration;
        startRef.current = Date.now();
        if (timerRef.current !== null) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => toast.dismiss(t.id), remainingRef.current);
        return () => {
            if (timerRef.current !== null) clearTimeout(timerRef.current);
        };
    }, [t.id, message, duration]);

    // TOAST AUTO-DISMISS FIX — root cause #2: `pause()`/`resume()` were
    // wired to `onMouseEnter`/`onMouseLeave`. Mobile/touch browsers can
    // synthesize a `mouseenter` from a tap WITHOUT ever firing a matching
    // `mouseleave` (no real pointer "leaves" a touch target the way a
    // mouse does) — pausing the timer permanently with no event left to
    // resume it, exactly the "hover/focus pause logic leaves the timer
    // paused permanently" / "touch users must not depend on hover" cases
    // the task asked to check for. Fixed by switching to Pointer Events and
    // gating on `pointerType === "mouse"`, which — unlike MouseEvent —
    // reliably distinguishes a real mouse from a touch/pen input, so touch
    // taps on the toast (e.g. tapping its dismiss button) never engage
    // pause/resume at all.
    function pause(e: React.PointerEvent) {
        if (!isHoverPausePointer(e.pointerType) || !Number.isFinite(duration) || timerRef.current === null) return;
        clearTimeout(timerRef.current);
        timerRef.current = null;
        remainingRef.current = computeRemainingMs(remainingRef.current, Date.now() - startRef.current);
    }

    function resume(e: React.PointerEvent) {
        if (!isHoverPausePointer(e.pointerType) || !Number.isFinite(duration) || timerRef.current !== null || remainingRef.current <= 0) return;
        startRef.current = Date.now();
        timerRef.current = setTimeout(() => toast.dismiss(t.id), remainingRef.current);
    }

    const { Icon, iconBg, iconColor, accent } = KIND_CONFIG[kind];
    const urgent = kind === "error" || kind === "warning";

    return (
        <div
            role={urgent ? "alert" : "status"}
            aria-live={urgent ? "assertive" : "polite"}
            // Desktop-only convenience, not required for touchscreen
            // usability (the task's own requirement) — Pointer Events +
            // the `pointerType === "mouse"` guard above mean touch taps
            // never engage pause/resume at all (see this file's header for
            // why MouseEvent-based handlers were the actual bug here).
            onPointerEnter={pause}
            onPointerLeave={resume}
            className={[
                // w-[min(92vw,360px)] rather than `w-full max-w-[360px]` —
                // react-hot-toast positions each toast via its own
                // transform-based wrapper, which has no bounded width of
                // its own for `w-full` to resolve against (it sizes to
                // its content, not the viewport). `min(92vw,360px)` is
                // self-contained: on a 320px phone it resolves to ~294px
                // (leaving real margin on both sides, never touching the
                // viewport edge), and caps at a fixed 360px from roughly
                // tablet width up — correct on both ends without a
                // separate breakpoint override.
                "pointer-events-auto flex w-[min(92vw,360px)] items-start gap-3 rounded-fk-lg border border-fk-border bg-white px-4 py-3.5 shadow-fk-md",
                `border-l-[3px] ${accent}`,
                // Entry/exit motion: fade + a slight vertical rise, driven
                // by react-hot-toast's own `t.visible` flag (false during
                // its exit phase) — the same visible-flag pattern already
                // used elsewhere in this codebase for other custom toasts
                // (src/components/admin/orders/OrderTable.tsx's new-order
                // toast), not a new animation convention. `transition-all`
                // is skipped under reduced motion; `motion-reduce:` utility
                // variants null out the transform/opacity transition so
                // the card only ever snaps between states, never animates.
                "transition-[opacity,transform] duration-200 ease-out motion-reduce:transition-none",
                t.visible ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-1",
            ].join(" ")}
        >
            <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${iconBg}`}>
                <Icon size={16} className={iconColor} strokeWidth={2.25} aria-hidden="true" />
            </div>
            <p className="flex-1 pt-0.5 text-[13.5px] font-semibold leading-snug text-fk-text">{message}</p>
            {dismissible && (
                <button
                    type="button"
                    aria-label="Dismiss notification"
                    onClick={() => toast.dismiss(t.id)}
                    className="shrink-0 rounded-full p-1 text-fk-text-tertiary transition-colors hover:bg-fk-surface-interactive hover:text-fk-text"
                >
                    <X size={14} aria-hidden="true" />
                </button>
            )}
        </div>
    );
}

// Pure, side-effect-free — deliberately factored out of `show()` below so
// the actual contract this file has with react-hot-toast (always
// duration:Infinity; a caller-supplied id passed through unmodified) is
// directly unit-testable without mocking the `react-hot-toast` module
// itself. (That mocking approach was tried first — Node's experimental
// `--experimental-test-module-mocks` reliably intercepts react-hot-toast
// when it's imported directly inside a test file, but does NOT reliably
// intercept it when the SAME package is instead imported transitively
// through another file — reproduced with a minimal, non-JSX, plain `.ts`
// repro file, so this is a real tooling limitation in this environment,
// not a mistake specific to this file's own JSX/`.tsx` extension. Testing
// this pure function directly sidesteps that limitation entirely instead
// of fighting it, and is arguably the more robust test either way.)
export function resolveToastOptions(options?: { id?: string }): { duration: number; id: string | undefined } {
    return {
        // Infinity here is deliberate — see this file's header. The card
        // owns its own timer so it can be paused/resumed; asking
        // react-hot-toast to ALSO auto-dismiss after durationMs would race
        // two independent dismiss triggers against each other.
        duration: Infinity,
        id: options?.id,
    };
}

function show(
    kind: ToastKind,
    message: string,
    durationMs: number,
    options?: { id?: string; dismissible?: boolean }
) {
    const dismissible = options?.dismissible ?? true;
    return toast.custom(
        (t) => <PremiumToastCard t={t} kind={kind} message={message} duration={durationMs} dismissible={dismissible} />,
        resolveToastOptions(options)
    );
}

// Guideline durations (task's own bands): success ~2.5–3.5s, info ~3–4s,
// ordinary errors ~4–5s. Callers needing a different duration (e.g. a
// longer-lived actionable error) can still pass one explicitly — these are
// defaults, not hardcoded floors.
export function toastSuccess(message: string, durationMs = 3000, options?: { id?: string; dismissible?: boolean }) {
    return show("success", message, durationMs, options);
}

export function toastError(message: string, durationMs = 4500, options?: { id?: string; dismissible?: boolean }) {
    return show("error", message, durationMs, options);
}

export function toastWarning(message: string, durationMs = 4500, options?: { id?: string; dismissible?: boolean }) {
    return show("warning", message, durationMs, options);
}

export function toastInfo(message: string, durationMs = 3500, options?: { id?: string; dismissible?: boolean }) {
    return show("info", message, durationMs, options);
}

// For a loading→success/error transition (task's "loading notifications
// resolve into success or error when the existing workflow supports it"):
// callers that already use react-hot-toast's own `toast.loading(...)` can
// resolve that SAME toast id into one of these premium cards by passing
// the loading toast's id through `options.id` — `toast.custom()` with a
// matching id replaces the existing toast in place rather than stacking a
// second one, exactly like `toast.success(msg, {id})` already does
// elsewhere in this codebase (e.g. useAddToCart.ts's "fk-add-to-cart" id).
