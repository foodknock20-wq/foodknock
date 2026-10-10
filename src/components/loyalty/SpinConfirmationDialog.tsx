"use client";

// src/components/loyalty/SpinConfirmationDialog.tsx
//
// Premium Spin confirmation layer — PRESENTATION ONLY. This component owns
// no business logic whatsoever: no API calls, no point deduction, no wheel
// state. It receives the real, already-fetched balance/spinCost as props
// and a single `onConfirm` callback; the caller (SpinWheelSection) is the
// one that actually invokes the EXISTING, unmodified `handleSpin()` when
// the user confirms. "Remaining after spin" below is a pure display
// calculation (balance - spinCost) — it never touches, reserves, or
// debits anything. The server remains the sole authority on the real
// balance.
//
// Reuses the existing BottomSheet primitive (portal, backdrop blur,
// outside-click/Escape close, body-scroll-lock, reduced-motion-aware
// transitions, mobile-bottom-sheet/desktop-centered hybrid) rather than
// building a second modal system. The built-in `title` row is skipped in
// favor of a custom premium header (icon badge + large heading) built
// directly in `children` — the sheet's close semantics (Escape, outside
// click, body scroll lock) still apply either way since those live in
// BottomSheet itself, not in its title row.

import { Sparkles, ArrowRight, Star, Disc3, X } from "lucide-react";
import BottomSheet from "@/components/ui/BottomSheet";

export default function SpinConfirmationDialog({
    open,
    onClose,
    onConfirm,
    balance,
    spinCost,
}: {
    open: boolean;
    onClose: () => void;
    onConfirm: () => void;
    balance: number;
    spinCost: number;
}) {
    const remaining = Math.max(0, balance - spinCost);

    return (
        <BottomSheet open={open} onClose={onClose} ariaLabel="Confirm your spin">
            <div className="relative -mt-1 pb-1 text-center">
                <button
                    onClick={onClose}
                    aria-label="Close"
                    className="absolute -right-1 -top-1 flex h-8 w-8 items-center justify-center rounded-fk-sm bg-fk-surface-interactive text-fk-text-tertiary transition-colors hover:text-fk-text"
                >
                    <X size={15} />
                </button>

                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-[var(--fk-accent)] to-[var(--fk-gold)] shadow-fk-md">
                    <Sparkles size={24} className="text-white" strokeWidth={2.25} />
                </div>

                <h2 className="relative mt-3.5 font-display text-[22px] font-black tracking-tight text-fk-text">
                    Ready to Spin?
                </h2>
                <p className="relative mx-auto mt-1.5 max-w-[280px] text-[13px] leading-relaxed text-fk-text-secondary">
                    Use {spinCost} points for a chance to unlock a tasty surprise.
                </p>

                {/* ── Premium points summary ── */}
                <div className="relative mt-5 overflow-hidden rounded-fk-lg border border-fk-border bg-fk-surface-elevated text-left shadow-sm">
                    <div className="flex items-center justify-between px-4 py-3">
                        <span className="flex items-center gap-2 text-[12.5px] font-bold text-fk-text-secondary">
                            <Star size={14} className="text-fk-gold" /> Your points
                        </span>
                        <span className="text-[14px] font-black text-fk-text">{balance.toLocaleString("en-IN")} pts</span>
                    </div>
                    <div className="h-px bg-fk-border" />
                    <div className="flex items-center justify-between px-4 py-3">
                        <span className="flex items-center gap-2 text-[12.5px] font-bold text-fk-text-secondary">
                            <Disc3 size={14} className="text-[var(--fk-accent)]" /> Spin cost
                        </span>
                        <span className="text-[14px] font-black text-[var(--fk-accent)]">-{spinCost.toLocaleString("en-IN")} pts</span>
                    </div>
                    <div className="h-px bg-fk-border" />
                    <div className="flex items-center justify-between bg-fk-surface-selected px-4 py-3">
                        <span className="flex items-center gap-2 text-[12.5px] font-bold text-fk-text-secondary">
                            <Sparkles size={14} className="text-fk-success" /> Remaining after spin
                        </span>
                        <span className="text-[14px] font-black text-fk-text">{remaining.toLocaleString("en-IN")} pts</span>
                    </div>
                </div>

                {/* ── Actions ── */}
                <button
                    onClick={onConfirm}
                    className="relative mt-5 flex w-full items-center justify-center gap-2 rounded-fk-lg bg-gradient-to-b from-[var(--fk-accent)] to-amber-600 py-3.5 text-[14px] font-black text-white shadow-[0_6px_20px_rgba(255,92,26,0.35)] transition-all hover:brightness-105 active:scale-[0.98]"
                >
                    <Sparkles size={16} /> Spin Now — {spinCost} pts <ArrowRight size={15} />
                </button>
                <button
                    onClick={onClose}
                    className="relative mt-2.5 w-full py-2 text-[13px] font-bold text-fk-text-tertiary transition-colors hover:text-fk-text-secondary"
                >
                    Maybe Later
                </button>
            </div>
        </BottomSheet>
    );
}
