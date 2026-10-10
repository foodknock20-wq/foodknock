"use client";

// src/components/orders/CustomerCancelControl.tsx
//
// Phase 14 — THE single customer cancellation UI, used by BOTH the Order
// Success page (primary location) and /my-orders/[orderId] (fallback).
// Both call the exact same cancellation authority
// (POST /api/orders/[id]/cancel → cancelOrder()) — this component holds no
// business logic of its own beyond that one fetch call.
//
// ── TIMER DESIGN ──────────────────────────────────────────────────────────
// There is exactly ONE clock: `now`, ticked every second regardless of
// whether the confirm dialog is open. `deadline` is fixed once
// (order.createdAt + CUSTOMER_CANCEL_WINDOW_MS) and never recalculated or
// reset. `remainingMs = deadline - now` is derived fresh on every tick.
// The main button's label always reads this live value. The confirm
// dialog's displayed number is a SNAPSHOT taken at the moment it opens
// (`frozenSeconds`) — a deliberate visual pause so the countdown text
// doesn't jitter while someone is reading reasons, per the agreed UX.
// Freezing the DISPLAY never freezes the actual deadline: `expired` below
// is still derived live from `now`/`deadline` on every render, so if the
// real deadline passes while the dialog happens to still be open, the
// Cancel button disables itself and the copy switches to "window expired"
// regardless of what the frozen number said. Closing the dialog ("Keep
// Order") touches nothing but `showDialog` — `now`/`deadline` were never
// paused, so the main button immediately reflects the real remaining time,
// never resetting to 30s or to whatever the dialog had shown.
//
// The server (CUSTOMER_CANCEL_WINDOW_MS in src/lib/constants.ts) remains
// the only authority on whether a cancellation is actually accepted — this
// component's countdown is a UI prediction of that same deadline, nothing
// more. A stale/expired client request still gets a clean 409 from the
// server (see /api/orders/[id]/cancel), handled below without pretending
// to succeed.

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Ban, XCircle } from "lucide-react";
import { CUSTOMER_CANCEL_WINDOW_MS } from "@/lib/constants";

export type CancellationState = {
    reason?: string | null;
    note?: string | null;
    cancelledAt?: string | null;
    refundStatus?: "not_applicable" | "pending_manual" | "completed";
};

const CANCELLABLE_STATUSES = ["received", "preparing", "out_for_delivery"];

const CUSTOMER_CANCEL_REASON_OPTIONS: { value: string; label: string }[] = [
    { value: "changed_mind", label: "Changed my mind" },
    { value: "ordered_by_mistake", label: "Ordered by mistake" },
    { value: "payment_issue", label: "Payment issue" },
    { value: "delivery_issue", label: "Delivery issue" },
    { value: "other", label: "Other" },
];

function ConfirmDialog({
    displaySeconds,
    expired,
    onClose,
    onConfirm,
}: {
    displaySeconds: number;
    expired: boolean;
    onClose: () => void;
    onConfirm: (reason: string, note: string) => Promise<void>;
}) {
    const [reason, setReason] = useState(CUSTOMER_CANCEL_REASON_OPTIONS[0].value);
    const [note, setNote] = useState("");
    const [submitting, setSubmitting] = useState(false);
    // Drives a short, lightweight enter transition (fade + slight scale,
    // no translate-from-bottom) — flipped true one frame after mount so
    // the CSS transition actually has an initial state to animate from.
    const [entered, setEntered] = useState(false);

    // Background page must stay locked while the dialog is open — this is
    // the ONLY instance of the dialog mounted at a time (parent renders it
    // conditionally), so mount/unmount is a reliable open/close signal.
    useEffect(() => {
        const original = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        const frame = requestAnimationFrame(() => setEntered(true));
        return () => {
            document.body.style.overflow = original;
            cancelAnimationFrame(frame);
        };
    }, []);

    // ── Rendered into document.body via a portal — see file header ──────
    // "fixed inset-0" only resolves against the true viewport when nothing
    // between this node and <body> has a `transform` (Order Success's own
    // Tailwind `translate-y-*` entrance-animation wrappers do, permanently
    // — `translate-y-0` is still a non-`none` transform value) or a
    // filter/contain/perspective. A portal sidesteps that entirely instead
    // of chasing every current and future ancestor that might trip it.
    return createPortal(
        <div
            className={`fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 transition-opacity duration-150 ${entered ? "opacity-100" : "opacity-0"}`}
            onClick={onClose}
        >
            <div
                className={`flex w-full max-w-sm flex-col overflow-hidden rounded-fk-lg border border-fk-border bg-fk-surface-elevated shadow-2xl transition-all duration-150 ${entered ? "scale-100 opacity-100" : "scale-95 opacity-0"}`}
                style={{ maxHeight: "calc(100dvh - 2rem)" }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header — fixed, never scrolls away */}
                <div className="shrink-0 border-b border-fk-border px-4 pb-2.5 pt-4">
                    <div className="flex items-center gap-1.5">
                        <XCircle size={16} className="shrink-0 text-fk-danger" />
                        <h3 className="text-[15px] font-black leading-tight text-fk-text">Cancel this order?</h3>
                    </div>
                    <p className={`mt-1 text-[12.5px] font-bold leading-snug ${expired ? "text-fk-text-tertiary" : "text-fk-danger"}`}>
                        {expired
                            ? "Cancellation window expired"
                            : `${displaySeconds} second${displaySeconds === 1 ? "" : "s"} left to cancel. This action cannot be undone.`}
                    </p>
                </div>

                {/* Content — the ONLY scrollable region */}
                <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
                    <div className="space-y-1.5">
                        {CUSTOMER_CANCEL_REASON_OPTIONS.map((r) => (
                            <label
                                key={r.value}
                                className={`flex cursor-pointer items-center gap-2 rounded-fk-md border px-3 py-2 text-[13px] font-semibold transition-all ${reason === r.value ? "border-[var(--fk-accent)]/50 bg-fk-surface-selected text-[var(--fk-accent)]" : "border-fk-border bg-fk-surface-elevated text-fk-text-secondary"
                                    }`}
                            >
                                <input
                                    type="radio"
                                    name="cancel-reason"
                                    value={r.value}
                                    checked={reason === r.value}
                                    onChange={() => setReason(r.value)}
                                    className="accent-[var(--fk-accent)]"
                                />
                                {r.label}
                            </label>
                        ))}
                    </div>

                    {reason === "other" && (
                        <textarea
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            maxLength={300}
                            rows={2}
                            placeholder="Tell us a bit more (optional)…"
                            className="mt-2 w-full resize-none rounded-fk-md border border-fk-border bg-fk-surface-interactive px-3 py-2 text-[13px] text-fk-text outline-none focus:border-[var(--fk-accent)]"
                        />
                    )}
                </div>

                {/* Footer — fixed, always reachable without scrolling the page */}
                <div className="flex shrink-0 gap-2 border-t border-fk-border px-4 py-3">
                    <button
                        onClick={onClose}
                        disabled={submitting}
                        className="flex-1 rounded-fk-pill border border-fk-border bg-fk-surface-elevated py-2.5 text-[13px] font-bold text-fk-text-secondary transition-all hover:bg-fk-surface-interactive"
                    >
                        Keep Order
                    </button>
                    <button
                        onClick={async () => { setSubmitting(true); await onConfirm(reason, note); setSubmitting(false); }}
                        disabled={submitting || expired}
                        className="flex-1 rounded-fk-pill bg-fk-danger py-2.5 text-[13px] font-black text-white shadow-md transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {submitting ? "Cancelling…" : "Cancel Order"}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}

export default function CustomerCancelControl({
    orderMongoId,
    createdAt,
    status,
    onCancelled,
}: {
    orderMongoId: string;
    createdAt: string;
    status: string;
    onCancelled: (cancellation: CancellationState) => void;
}) {
    // Fixed once — never recalculated, never reset by opening/closing the dialog.
    const [deadline] = useState<number>(() => new Date(createdAt).getTime() + CUSTOMER_CANCEL_WINDOW_MS);
    const [now, setNow] = useState<number>(() => Date.now());
    const [showDialog, setShowDialog] = useState(false);
    // Snapshot of the countdown, captured only at the instant the dialog
    // opens — see file header. Irrelevant to `expired`, which stays live.
    const [frozenSeconds, setFrozenSeconds] = useState(0);
    const [error, setError] = useState("");

    const eligible = CANCELLABLE_STATUSES.includes(status);

    // Single clock — ticks regardless of dialog open/closed state, which is
    // exactly what makes "Keep Order" resume from the real remaining time
    // instead of resetting (see file header).
    useEffect(() => {
        if (!eligible) return;
        const interval = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(interval);
    }, [eligible]);

    if (!eligible) return null;

    const remainingMs = Math.max(0, deadline - now);
    const remainingSeconds = Math.ceil(remainingMs / 1000);
    const expired = remainingMs <= 0;

    const openDialog = () => {
        setFrozenSeconds(remainingSeconds);
        setShowDialog(true);
    };

    const handleConfirm = async (reason: string, note: string) => {
        setError("");
        try {
            const res = await fetch(`/api/orders/${orderMongoId}/cancel`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ reason, note }),
            });
            const data = await res.json();
            if (data.success) {
                setShowDialog(false);
                onCancelled(data.order?.cancellation ?? { reason, cancelledAt: new Date().toISOString() });
            } else {
                setError(data.message || "Failed to cancel order.");
                setShowDialog(false);
            }
        } catch {
            setError("Network error — please try again.");
            setShowDialog(false);
        }
    };

    return (
        <div className="overflow-hidden rounded-fk-lg border border-fk-danger/25 bg-fk-surface-elevated shadow-sm">
            <div className="border-b border-fk-danger/15 bg-fk-danger/5 px-5 py-3.5">
                <h2 className="text-xs font-black uppercase tracking-wider text-fk-text-secondary">Cancellation</h2>
            </div>
            <div className="p-5">
                {error && <p className="mb-3 text-sm font-semibold text-fk-danger">{error}</p>}
                <button
                    onClick={openDialog}
                    disabled={expired}
                    className={`flex w-full items-center justify-center gap-2 rounded-fk-lg border px-5 py-3 text-sm font-black transition-all ${expired
                        ? "cursor-not-allowed border-fk-border bg-fk-surface-interactive text-fk-text-tertiary"
                        : "border-fk-danger/30 bg-fk-danger/5 text-fk-danger hover:bg-fk-danger/10"
                        }`}
                >
                    <Ban size={15} />
                    {expired ? "Cancellation window expired" : `Cancel Order · ${remainingSeconds}s`}
                </button>
                {!expired && (
                    <p className="mt-2 text-center text-xs text-fk-text-tertiary">
                        You can cancel within 30 seconds of placing this order.
                    </p>
                )}
                {showDialog && (
                    <ConfirmDialog
                        displaySeconds={frozenSeconds}
                        expired={expired}
                        onClose={() => setShowDialog(false)}
                        onConfirm={handleConfirm}
                    />
                )}
            </div>
        </div>
    );
}
