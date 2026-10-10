"use client";

// src/components/loyalty/SpinWheelSection.tsx
//
// Phase 12 finalization — Digital Spin & Win, rebuilt.
//
// GEOMETRY FIX: the previous version positioned labels with a CSS
// absolute-div + rotate trick that collided near the hub. This version
// draws the wheel as an SVG with each of the 8 segments as its own
// mathematically-computed pie-slice <path> (polar coordinates, not magic
// pixels) and each label placed at a fixed radius along its segment's own
// mid-angle, counter-rotated to stay horizontal/readable. No two labels
// can ever occupy the same segment, and the SVG viewBox scales fluidly at
// any width (no hardcoded desktop-only pixel size) — mobile-first.
//
// AUTHORITY: the server (POST /api/spin) decides the result BEFORE any
// animation starts. This component only computes the rotation angle
// needed to land the pointer on the server-returned slotIndex — it can
// never show a result that doesn't match what was actually granted.
//
// IDEMPOTENCY: a fresh key is generated once per spin attempt and resent
// unchanged if that same attempt is retried (e.g. the fetch throws but
// may have actually reached the server) — see handleSpin.

import { useEffect, useRef, useState } from "react";
import { toast } from "react-hot-toast";
import { Loader2, Sparkles, X, Gift, ArrowRight, Percent, Truck, Coins, type LucideIcon } from "lucide-react";
import { LOYALTY_CHANGED_EVENT } from "@/lib/clientEvents";
import SpinConfirmationDialog from "./SpinConfirmationDialog";

const LOGO_SRC = "/logo/logo.jpg";

// Presentation-only icon mapping, keyed off the REAL, server-defined
// rewardType enum (src/lib/spin.ts's SpinRewardType) — never off fuzzy
// label-text matching. If a future rewardType isn't in this map, it simply
// renders without a segment icon rather than guessing; reward text remains
// the single source of truth either way.
const REWARD_TYPE_ICON: Record<string, LucideIcon> = {
    DISCOUNT_FIXED: Percent,
    DISCOUNT_PERCENTAGE: Percent,
    FREE_DELIVERY: Truck,
    LOYALTY_POINTS: Coins,
};

type Slot = { slotIndex: number; label: string; rewardType: string; specialBandGated?: boolean };
type SpinStatus = { balance: number; spinCost: number; canSpin: boolean; slots: Slot[] };
type SpinOutcome = {
    rewardLabel: string; rewardType: string; rewardValue: number; slotIndex: number;
    couponCode: string | null; pointsAwarded: number; newBalance: number;
};

const SIZE = 300;
const CENTER = SIZE / 2;
const RADIUS = 136;
const LABEL_RADIUS = 92;
const ICON_RADIUS = 60;
// Small static "marquee bulb" dots around the outer rim — purely
// decorative (reference-image translation of its lit-bulb ring), a fixed
// count so this is O(1) DOM/SVG nodes, never per-reward or data-driven.
const BULB_COUNT = 16;

// Restrained FoodKnock palette — brand orange alternating with warm cream,
// not a rainbow of per-slice colors.
const SLICE_FILL = ["#FF5C1A", "#FFF4E8"];
const SLICE_TEXT = ["#FFFFFF", "#9A3412"];

function describeSlice(index: number, total: number): { path: string; midAngleDeg: number } {
    const segment = 360 / total;
    const startDeg = index * segment - 90; // -90 so slot 0 starts at the top
    const endDeg = startDeg + segment;
    const midAngleDeg = startDeg + segment / 2;

    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const x1 = CENTER + RADIUS * Math.cos(toRad(startDeg));
    const y1 = CENTER + RADIUS * Math.sin(toRad(startDeg));
    const x2 = CENTER + RADIUS * Math.cos(toRad(endDeg));
    const y2 = CENTER + RADIUS * Math.sin(toRad(endDeg));

    const path = `M${CENTER},${CENTER} L${x1.toFixed(2)},${y1.toFixed(2)} A${RADIUS},${RADIUS} 0 0,1 ${x2.toFixed(2)},${y2.toFixed(2)} Z`;
    return { path, midAngleDeg };
}

function labelPosition(midAngleDeg: number): { x: number; y: number } {
    const rad = (midAngleDeg * Math.PI) / 180;
    return { x: CENTER + LABEL_RADIUS * Math.cos(rad), y: CENTER + LABEL_RADIUS * Math.sin(rad) };
}

// The fixed pointer sits at the top of the wheel, which in this SVG's
// angle convention (0deg = +x/right, increasing clockwise — matches both
// the <path> arc math above and CSS rotate()) is -90deg. ONE authoritative
// constant, referenced by both the geometry comment below and the
// rotation math — never redefined separately.
const POINTER_ANGLE_DEG = -90;

// THE authoritative mapping from "which slot the server picked" to "how
// far the wheel must rotate so that slot's center sits under the fixed
// pointer" — reuses describeSlice()'s midAngleDeg (the EXACT same value
// used to place that slot's label), so the animation target and the
// visible label can never disagree about where a given slot actually is.
//
// Previous bug (root cause of the pointer/reward mismatch): the old code
// computed this same midAngleDeg value and then used it DIRECTLY as the
// rotation amount, instead of converting it to "how much rotation is
// needed to bring it to the pointer". Algebraically, substituting
// midAngleDeg in place of the required (POINTER_ANGLE_DEG - midAngleDeg)
// causes the midAngleDeg terms to cancel out of the final apparent-angle
// equation entirely — the landing position ended up INDEPENDENT of which
// slot was selected, always resting wherever the (slot-irrelevant)
// leftover arithmetic happened to point, regardless of the server result.
function rotationNeededForSlot(slotIndex: number, totalSlots: number): number {
    const { midAngleDeg } = describeSlice(slotIndex, totalSlots);
    return POINTER_ANGLE_DEG - midAngleDeg;
}

/**
 * Given the wheel's current rotation and the rotation value that would
 * satisfy "target slot under pointer" (mod 360, from
 * rotationNeededForSlot), returns a NEW absolute rotation that:
 *   1. is always >= prevRotation + extraSpins*360 (always spins forward,
 *      regardless of how much the wheel has already rotated across
 *      previous spins — no accumulated-angle drift between consecutive
 *      spins),
 *   2. lands EXACTLY on the segment's center angle (not its edge — no
 *      boundary rounding risk).
 */
function nextRotation(prevRotation: number, requiredRotationMod360: number, extraFullSpins: number): number {
    const normalizedPrev = ((prevRotation % 360) + 360) % 360;
    const normalizedTarget = ((requiredRotationMod360 % 360) + 360) % 360;
    let delta = normalizedTarget - normalizedPrev;
    if (delta <= 0) delta += 360; // always move forward, never 0/negative (would look like no spin happened)
    return prevRotation + delta + extraFullSpins * 360;
}

export default function SpinWheelSection() {
    const [status, setStatus] = useState<SpinStatus | null>(null);
    const [loading, setLoading] = useState(true);
    const [spinning, setSpinning] = useState(false);
    const [rotation, setRotation] = useState(0);
    const [result, setResult] = useState<SpinOutcome | null>(null);
    // Premium Spin confirmation modal — pure UI state, no business logic.
    // The existing handleSpin() below is completely untouched; this only
    // gates WHEN it's called (after explicit user confirmation instead of
    // immediately on CTA click). See SpinConfirmationDialog's own header
    // comment for the full rationale.
    const [confirmOpen, setConfirmOpen] = useState(false);
    const idempotencyKeyRef = useRef<string | null>(null);
    const [reducedMotion] = useState(
        () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
    );

    useEffect(() => {
        fetch("/api/spin", { credentials: "include" })
            .then((r) => (r.ok ? r.json() : null))
            .then((data) => { if (data?.success) setStatus(data); })
            .catch(() => {})
            .finally(() => setLoading(false));
    }, []);

    async function handleSpin() {
        if (!status || spinning) return;
        if (!status.canSpin) {
            toast.error(`You need ${status.spinCost - status.balance} more points to spin.`);
            return;
        }

        // A fresh key per NEW attempt; unchanged across a retry of the same
        // attempt (see the catch block) so the server can detect a dropped-
        // response retry and replay the original result instead of spinning
        // twice.
        if (!idempotencyKeyRef.current) {
            idempotencyKeyRef.current = crypto.randomUUID();
        }

        setSpinning(true);
        setResult(null);

        try {
            const res = await fetch("/api/spin", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ idempotencyKey: idempotencyKeyRef.current }),
            });
            const data = await res.json();

            if (!data.success) {
                toast.error(data.message || "Something went wrong. Please try again.");
                setSpinning(false);
                idempotencyKeyRef.current = null;
                return;
            }

            idempotencyKeyRef.current = null; // this attempt is resolved — next click is a new one

            const required = rotationNeededForSlot(data.slotIndex, status.slots.length);
            const extraFullSpins = reducedMotion ? 1 : 5;
            setRotation((prev) => nextRotation(prev, required, extraFullSpins));

            const settleDelay = reducedMotion ? 200 : 3200;
            setTimeout(() => {
                setSpinning(false);
                setResult(data);
                setStatus((prev) => (prev ? { ...prev, balance: data.newBalance, canSpin: data.newBalance >= prev.spinCost } : prev));
                // Refresh the Navbar chip + this page's own hero balance —
                // both fetch independently and would otherwise show the
                // pre-spin number until a full reload.
                window.dispatchEvent(new CustomEvent(LOYALTY_CHANGED_EVENT));
            }, settleDelay);
        } catch {
            // Network drop — keep the SAME idempotency key so a user-initiated
            // retry (clicking Spin again) replays the original result if the
            // request actually reached the server, instead of spinning twice.
            toast.error("Couldn't reach FoodKnock. Please try again.");
            setSpinning(false);
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center rounded-fk-lg border border-fk-border bg-fk-surface-elevated p-10 shadow-sm">
                <Loader2 size={20} className="animate-spin text-[var(--fk-accent)]" />
            </div>
        );
    }
    if (!status) return null;

    const n = status.slots.length;

    return (
        <div
            className="relative overflow-hidden rounded-fk-lg border border-amber-200/70 shadow-fk-md"
            style={{ background: "linear-gradient(180deg, #FFFBF3 0%, #FFF4E2 45%, #FFEFD9 100%)" }}
        >
            {/* ── Premium ambient background — static, no animation loops.
                A soft warm glow centered behind where the wheel sits, plus a
                handful of tiny lightweight CSS "sparkle" dots. Purely
                decorative; none of this affects layout or interaction. ── */}
            <div
                className="pointer-events-none absolute left-1/2 top-[38%] h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full opacity-[0.16] blur-3xl"
                style={{ background: "radial-gradient(circle, var(--fk-accent), transparent 70%)" }}
                aria-hidden="true"
            />
            <div
                className="pointer-events-none absolute inset-0 opacity-[0.05]"
                style={{ backgroundImage: "radial-gradient(circle, #D4A017 1px, transparent 1px)", backgroundSize: "26px 26px" }}
                aria-hidden="true"
            />
            <span aria-hidden="true" className="pointer-events-none absolute left-[10%] top-[8%] h-[5px] w-[5px] rounded-full bg-fk-gold opacity-40" />
            <span aria-hidden="true" className="pointer-events-none absolute right-[9%] top-[14%] h-1 w-1 rounded-full bg-fk-gold opacity-40" />
            <span aria-hidden="true" className="pointer-events-none absolute left-[5%] top-[46%] h-1 w-1 rounded-full bg-fk-gold opacity-40" />
            <span aria-hidden="true" className="pointer-events-none absolute right-[6%] top-[58%] h-[5px] w-[5px] rounded-full bg-fk-gold opacity-40" />

            {/* ── Premium hero header ── */}
            <div className="relative px-6 pt-7 text-center">
                <span className="relative inline-flex items-center gap-1.5 rounded-fk-pill border border-amber-300/70 bg-fk-surface-elevated/80 px-3.5 py-1.5 text-[10px] font-black uppercase tracking-[0.22em] text-amber-700 shadow-fk-sm backdrop-blur-sm">
                    <Sparkles size={10} /> FoodKnock Rewards
                </span>
                <h2 className="relative mt-3 font-display text-[28px] font-black leading-[1.05] tracking-tight text-fk-text sm:text-[32px]">
                    Spin &amp; Eat
                </h2>
                <p className="relative mx-auto mt-1.5 max-w-xs text-[13px] leading-relaxed text-fk-text-secondary">
                    Use {status.spinCost} points and unlock a tasty surprise.
                </p>
                <div className="relative mt-4 inline-flex items-center gap-2.5 rounded-fk-lg border border-amber-200/80 bg-fk-surface-elevated px-4 py-2.5 shadow-fk-sm">
                    <span className="text-xl font-black leading-none text-fk-text">{status.balance.toLocaleString("en-IN")}</span>
                    <span className="text-[11px] font-bold text-fk-text-tertiary">points available</span>
                    <span className="h-3.5 w-px bg-fk-border" />
                    <span className="text-[11px] font-black text-[var(--fk-accent)]">{status.spinCost} pts / spin</span>
                </div>
            </div>

            {/* ── Wheel ── */}
            <div className="relative mx-auto mt-6 w-full max-w-[300px] px-6 sm:max-w-[340px]">
                <div className="relative aspect-square w-full">
                    {/* Static ambient glow directly behind the wheel — purely
                        decorative, no animation, cheap (one blurred radial
                        gradient, not a filter stack on the wheel itself). */}
                    <div
                        className="pointer-events-none absolute inset-[-6%] rounded-full opacity-50 blur-2xl"
                        style={{ background: "radial-gradient(circle, #FFD9A8 0%, transparent 72%)" }}
                        aria-hidden="true"
                    />
                    {/* Fixed pointer — never rotates */}
                    <div
                        className="absolute left-1/2 top-[-4px] z-10 -translate-x-1/2"
                        style={{ filter: "drop-shadow(0 3px 4px rgba(120,53,15,0.35))" }}
                        aria-hidden="true"
                    >
                        <svg width="26" height="30" viewBox="0 0 26 30">
                            <defs>
                                <linearGradient id="pointerGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                                    <stop offset="0%" stopColor="#FFB84D" />
                                    <stop offset="100%" stopColor="#D4A017" />
                                </linearGradient>
                            </defs>
                            {/* Same geometry as before — only fill treatment upgraded for depth */}
                            <path d="M13 30 L1 8 Q13 -2 25 8 Z" fill="url(#pointerGradient)" />
                            <path d="M13 24 L5 9 Q13 3 21 9 Z" fill="#FF5C1A" />
                            <circle cx={13} cy={10} r={2} fill="#FFF4E0" opacity={0.85} />
                        </svg>
                    </div>

                    <svg
                        viewBox={`0 0 ${SIZE} ${SIZE}`}
                        className="h-full w-full motion-reduce:transition-none"
                        style={{
                            transform: `rotate(${rotation}deg)`,
                            transition: `transform ${status && spinning ? (reducedMotion ? "0.2s" : "3.2s") : "0s"} cubic-bezier(0.17,0.84,0.44,1)`,
                        }}
                        role="img"
                        aria-label="Spin and Eat wheel"
                    >
                        <defs>
                            <filter id="wheelShadow" x="-20%" y="-20%" width="140%" height="140%">
                                <feDropShadow dx="0" dy="3" stdDeviation="6" floodColor="#7C2D12" floodOpacity="0.18" />
                            </filter>
                            <linearGradient id="wheelGoldRing" x1="0%" y1="0%" x2="100%" y2="100%">
                                <stop offset="0%" stopColor="#FFE8C2" />
                                <stop offset="50%" stopColor="#D4A017" />
                                <stop offset="100%" stopColor="#FFE8C2" />
                            </linearGradient>
                            <clipPath id="wheelMedallionClip">
                                <circle cx={CENTER} cy={CENTER} r={27} />
                            </clipPath>
                        </defs>

                        {/* Outer premium ring — richer gold gradient outline
                            (purely a visual stroke addition; segment/label
                            geometry below is byte-for-byte unchanged) */}
                        <circle cx={CENTER} cy={CENTER} r={RADIUS + 13} fill="none" stroke="#C9820A" strokeWidth={1} opacity={0.5} />
                        <circle cx={CENTER} cy={CENTER} r={RADIUS + 9} fill="none" stroke="url(#wheelGoldRing)" strokeWidth={4} />
                        {/* Static "marquee bulb" ring — a fixed, small set of
                            dots translating the reference image's lit-rim
                            motif. No animation, no per-dot filters. */}
                        {Array.from({ length: BULB_COUNT }).map((_, i) => {
                            const deg = (360 / BULB_COUNT) * i;
                            const rad = (deg * Math.PI) / 180;
                            const bx = CENTER + (RADIUS + 9) * Math.cos(rad);
                            const by = CENTER + (RADIUS + 9) * Math.sin(rad);
                            return <circle key={`bulb-${i}`} cx={bx} cy={by} r={2.1} fill="#FFE8B8" stroke="#B45309" strokeWidth={0.5} />;
                        })}
                        <circle cx={CENTER} cy={CENTER} r={RADIUS + 6} fill="none" stroke="#FFD9A8" strokeWidth={3} />
                        <circle cx={CENTER} cy={CENTER} r={RADIUS + 1} fill="none" stroke="#FFFFFF" strokeWidth={2} />

                        <g filter="url(#wheelShadow)">
                            {status.slots.map((slot, i) => {
                                const { path } = describeSlice(i, n);
                                const fill = SLICE_FILL[i % 2];
                                return <path key={slot.slotIndex} d={path} fill={fill} stroke="#FFFFFF" strokeWidth={2} />;
                            })}
                        </g>

                        {/* Reward-type icons — presentation only, keyed off
                            the real rewardType enum (see REWARD_TYPE_ICON
                            above). Positioned at ICON_RADIUS (between the
                            hub and the label ring), counter-rotated with the
                            exact same technique the labels below already
                            use, so icon and label always share one
                            consistent orientation per segment. */}
                        {status.slots.map((slot, i) => {
                            const { midAngleDeg } = describeSlice(i, n);
                            const iconRad = (midAngleDeg * Math.PI) / 180;
                            const ix = CENTER + ICON_RADIUS * Math.cos(iconRad);
                            const iy = CENTER + ICON_RADIUS * Math.sin(iconRad);
                            const Icon = REWARD_TYPE_ICON[slot.rewardType];
                            if (!Icon) return null;
                            const iconColor = SLICE_TEXT[i % 2];
                            // Special visual distinction for the band-gated
                            // reward (currently ₹200 OFF) — a small gold ring
                            // behind its icon. Driven by the real
                            // specialBandGated flag from the API, never by
                            // matching the label string.
                            return (
                                <g key={`icon-${slot.slotIndex}`} transform={`translate(${ix}, ${iy}) rotate(${midAngleDeg + 90})`}>
                                    {slot.specialBandGated && (
                                        <circle r={10} fill="none" stroke="url(#wheelGoldRing)" strokeWidth={1.5} />
                                    )}
                                    <Icon x={-7} y={-7} width={14} height={14} color={iconColor} strokeWidth={2.5} opacity={0.85} />
                                </g>
                            );
                        })}

                        {status.slots.map((slot, i) => {
                            const { midAngleDeg } = describeSlice(i, n);
                            const { x, y } = labelPosition(midAngleDeg);
                            const textColor = SLICE_TEXT[i % 2];
                            // Longer admin-entered labels ("Free Delivery",
                            // "+50 Points") need a smaller size to fit the
                            // same segment arc-width as "₹25 OFF" — scaled
                            // by length rather than a fixed size for every
                            // label, so this keeps working if an admin
                            // later renames a slot to something longer.
                            const fontSize = slot.label.length > 10 ? 9.5 : slot.label.length > 7 ? 11 : 13;
                            return (
                                <text
                                    key={slot.slotIndex}
                                    x={x}
                                    y={y}
                                    fill={textColor}
                                    fontSize={fontSize}
                                    fontWeight={800}
                                    textAnchor="middle"
                                    dominantBaseline="middle"
                                    transform={`rotate(${midAngleDeg + 90}, ${x}, ${y})`}
                                >
                                    {slot.label}
                                </text>
                            );
                        })}

                        {/* Center hub — premium FoodKnock medallion. Uses the
                            same real logo asset CustomerHeader already uses
                            (/logo/logo.jpg), clipped to a circle, instead of
                            a generic emoji. Extra gold frame ring added for
                            dimensional depth around the existing hub. */}
                        <circle cx={CENTER} cy={CENTER} r={33} fill="none" stroke="url(#wheelGoldRing)" strokeWidth={2} />
                        <circle cx={CENTER} cy={CENTER} r={30} fill="#FFFFFF" stroke="#FFD9A8" strokeWidth={3} />
                        <image
                            href={LOGO_SRC}
                            x={CENTER - 27}
                            y={CENTER - 27}
                            width={54}
                            height={54}
                            clipPath="url(#wheelMedallionClip)"
                            preserveAspectRatio="xMidYMid slice"
                        />
                        <circle cx={CENTER} cy={CENTER} r={30} fill="none" stroke="#FF5C1A" strokeWidth={1.5} opacity={0.5} />
                    </svg>
                </div>

                {/* Stage/platform beneath the wheel — CSS-only layered
                    "pedestal" ellipses translating the reference image's
                    grounded-platform feeling. Purely decorative, static. */}
                <div className="pointer-events-none relative mx-auto -mt-2 h-5 w-[86%]" aria-hidden="true">
                    <div
                        className="absolute inset-x-0 top-0 h-5 rounded-[50%] opacity-80"
                        style={{ background: "linear-gradient(180deg, #E8A33D 0%, #B8720E 100%)", boxShadow: "0 6px 14px rgba(120,53,15,0.25)" }}
                    />
                    <div
                        className="absolute inset-x-[8%] top-1 h-3 rounded-[50%]"
                        style={{ background: "linear-gradient(180deg, #FFE8C2 0%, #E8A33D 100%)" }}
                    />
                </div>
            </div>

            {/* ── CTA ── */}
            <div className="flex flex-col items-center gap-2 px-6 pb-7 pt-6">
                <button
                    onClick={() => setConfirmOpen(true)}
                    disabled={spinning || !status.canSpin}
                    aria-label={spinning ? "Spinning" : status.canSpin ? `Spin for ${status.spinCost} points` : `Need ${status.spinCost - status.balance} more points to spin`}
                    className="group relative flex w-full max-w-[280px] items-center justify-center gap-2 overflow-hidden rounded-fk-pill bg-gradient-to-b from-[var(--fk-accent)] to-amber-600 py-4 text-[15px] font-black text-white shadow-[0_8px_24px_rgba(255,92,26,0.4)] ring-1 ring-amber-300/50 transition-all hover:brightness-105 active:scale-[0.97] disabled:cursor-not-allowed disabled:from-fk-surface-interactive disabled:to-fk-surface-interactive disabled:text-fk-text-tertiary disabled:shadow-none disabled:ring-0"
                >
                    {/* Subtle inner top highlight — a static gradient sliver, not a filter/animation */}
                    <span
                        className="pointer-events-none absolute inset-x-0 top-0 h-1/2 rounded-t-fk-pill opacity-25"
                        style={{ background: "linear-gradient(180deg, #FFFFFF, transparent)" }}
                        aria-hidden="true"
                    />
                    {spinning ? (
                        <><Loader2 size={16} className="animate-spin" /> Spinning…</>
                    ) : status.canSpin ? (
                        <>
                            <Sparkles size={16} /> Spin for {status.spinCost} pts
                            <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" />
                        </>
                    ) : (
                        `Need ${status.spinCost - status.balance} more points`
                    )}
                </button>
            </div>

            {/* ── Premium Spin confirmation — opens on CTA click; the
                EXISTING handleSpin() (unchanged below) only ever runs after
                the user explicitly confirms here. No API call, no point
                deduction, and no wheel animation happen just from opening
                this dialog. ── */}
            <SpinConfirmationDialog
                open={confirmOpen}
                onClose={() => setConfirmOpen(false)}
                onConfirm={() => {
                    setConfirmOpen(false);
                    handleSpin();
                }}
                balance={status.balance}
                spinCost={status.spinCost}
            />

            {/* ── Result reveal ── */}
            {result && (
                <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Spin result">
                    <div className="relative w-full max-w-sm overflow-hidden rounded-fk-lg bg-fk-surface-elevated p-7 text-center shadow-2xl">
                        <div
                            className="pointer-events-none absolute left-1/2 top-0 h-48 w-48 -translate-x-1/2 -translate-y-1/2 rounded-full opacity-[0.15] blur-3xl"
                            style={{ background: "radial-gradient(circle, var(--fk-accent), transparent 70%)" }}
                        />
                        <button onClick={() => setResult(null)} aria-label="Close" className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-fk-md bg-fk-surface-interactive text-fk-text-tertiary hover:bg-fk-surface-selected">
                            <X size={15} />
                        </button>
                        <div className="relative mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-fk-lg bg-gradient-to-br from-[var(--fk-accent)] to-[var(--fk-gold)] shadow-fk-lg">
                            <Gift size={28} className="text-white" />
                        </div>
                        <p className="relative text-[11px] font-black uppercase tracking-[0.2em] text-[var(--fk-accent)]">You Won</p>
                        <h3 className="relative mt-1 text-2xl font-black text-fk-text">{result.rewardLabel}</h3>
                        {result.couponCode && (
                            <>
                                <p className="relative mt-3 text-[12px] text-fk-text-secondary">Your reward is ready to use.</p>
                                <p className="relative mt-2 rounded-fk-md border border-dashed border-amber-300 bg-fk-gold-soft px-4 py-2.5 font-mono text-sm font-black tracking-wide text-amber-700">
                                    {result.couponCode}
                                </p>
                            </>
                        )}
                        {result.pointsAwarded > 0 && (
                            <p className="relative mt-3 text-sm font-bold text-fk-success">+{result.pointsAwarded} loyalty points added</p>
                        )}
                        <p className="relative mt-4 text-[11px] text-fk-text-tertiary">Find it anytime under &quot;My Rewards&quot; below.</p>
                        <button
                            onClick={() => setResult(null)}
                            className="relative mt-5 w-full rounded-fk-lg bg-fk-text py-3 text-[13px] font-bold text-white transition-colors hover:brightness-110"
                        >
                            Awesome!
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
