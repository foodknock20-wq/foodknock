"use client";

// src/components/checkout/CouponBox.tsx
//
// Phase 11 — checkout coupon UI. Owns its own apply/remove/loading/error
// state; the parent (checkout page) only needs the resolved discount
// amount + code to fold into its own total calculation — this component
// never computes the final payable total itself (that stays server-
// authoritative, re-verified at order creation regardless of what this
// shows).
//
// Stale-response protection: an AbortController cancels any in-flight
// validate request before a new one starts, so a fast double-Apply (or an
// Apply that races a cart change) can never have an older response
// overwrite a newer one.

import { useRef, useState } from "react";
import { Tag, Loader2, X, Check, ChevronRight } from "lucide-react";

export type AppliedCoupon = {
    code: string;
    discountAmount: number;
};

export default function CouponBox({
    cartItems,
    onApplied,
    onRemoved,
    disabled,
}: {
    cartItems: Array<{ _id: string; quantity: number }>;
    onApplied: (coupon: AppliedCoupon) => void;
    onRemoved: () => void;
    disabled?: boolean;
}) {
    const [expanded, setExpanded] = useState(false);
    const [code, setCode] = useState("");
    const [applying, setApplying] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [applied, setApplied] = useState<AppliedCoupon | null>(null);
    const abortRef = useRef<AbortController | null>(null);

    async function handleApply() {
        const trimmed = code.trim();
        if (!trimmed || applying) return;

        abortRef.current?.abort();
        const controller = new AbortController();
        abortRef.current = controller;

        setApplying(true);
        setError(null);

        try {
            const res = await fetch("/api/coupons/validate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ code: trimmed, cartItems }),
                signal: controller.signal,
            });
            const data = await res.json();

            if (controller.signal.aborted) return;

            if (!data.success) {
                setError(data.message || "That coupon code isn't valid.");
                setApplied(null);
                return;
            }

            const result: AppliedCoupon = { code: data.code, discountAmount: data.discountAmount };
            setApplied(result);
            onApplied(result);
        } catch {
            if (controller.signal.aborted) return;
            setError("Couldn't apply the coupon right now. Please try again.");
        } finally {
            if (!controller.signal.aborted) setApplying(false);
        }
    }

    function handleRemove() {
        abortRef.current?.abort();
        setApplied(null);
        setCode("");
        setError(null);
        onRemoved();
    }

    if (applied) {
        return (
            <div className="flex items-center justify-between rounded-fk-lg border border-fk-success/30 bg-fk-success/10 px-4 py-3">
                <div className="flex items-center gap-2 min-w-0">
                    <Check size={14} className="shrink-0 text-fk-success" />
                    <div className="min-w-0">
                        <p className="truncate text-[13px] font-bold text-fk-success">{applied.code} applied</p>
                        <p className="text-[11px] font-medium text-fk-success/80">You saved ₹{applied.discountAmount}</p>
                    </div>
                </div>
                <button
                    type="button"
                    onClick={handleRemove}
                    className="shrink-0 text-[11.5px] font-bold text-fk-success underline decoration-fk-success/40 underline-offset-2 hover:brightness-90"
                >
                    Remove
                </button>
            </div>
        );
    }

    if (!expanded) {
        return (
            <button
                type="button"
                onClick={() => setExpanded(true)}
                disabled={disabled}
                className="flex w-full items-center justify-between rounded-fk-lg border border-dashed border-fk-border bg-fk-surface-interactive px-4 py-3 text-left transition-colors hover:border-[var(--fk-accent)]/40 hover:bg-fk-surface-selected disabled:cursor-not-allowed disabled:opacity-60"
            >
                <span className="flex items-center gap-2 text-[13px] font-bold text-fk-text-secondary">
                    <Tag size={14} className="text-[var(--fk-accent)]" /> Have a coupon code?
                </span>
                <ChevronRight size={14} className="text-fk-text-tertiary" />
            </button>
        );
    }

    return (
        <div className="rounded-fk-lg border border-fk-border bg-fk-surface-elevated p-3">
            <div className="flex items-center gap-2">
                <input
                    type="text"
                    value={code}
                    onChange={(e) => { setCode(e.target.value.toUpperCase()); setError(null); }}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleApply(); } }}
                    placeholder="Enter coupon code"
                    maxLength={20}
                    disabled={applying || disabled}
                    aria-label="Coupon code"
                    aria-invalid={!!error}
                    className="min-w-0 flex-1 rounded-fk-md border border-fk-border bg-fk-surface-elevated px-3 py-2.5 text-[13px] font-bold uppercase tracking-wide text-fk-text outline-none transition-colors focus:border-[var(--fk-accent)] disabled:opacity-60"
                />
                <button
                    type="button"
                    onClick={handleApply}
                    disabled={applying || disabled || !code.trim()}
                    className="flex shrink-0 items-center gap-1.5 rounded-fk-md bg-[var(--fk-accent)] px-4 py-2.5 text-[13px] font-bold text-white transition-colors hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                >
                    {applying ? <Loader2 size={13} className="animate-spin" /> : "Apply"}
                </button>
                <button
                    type="button"
                    onClick={() => { setExpanded(false); setCode(""); setError(null); }}
                    aria-label="Close coupon input"
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-fk-md text-fk-text-tertiary hover:bg-fk-surface-interactive"
                >
                    <X size={14} />
                </button>
            </div>
            {error && (
                <p role="alert" className="mt-2 text-[11.5px] font-semibold text-fk-danger">
                    {error}
                </p>
            )}
        </div>
    );
}
