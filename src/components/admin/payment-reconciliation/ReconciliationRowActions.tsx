"use client";

// src/components/admin/payment-reconciliation/ReconciliationRowActions.tsx
//
// Phase 17.1A (audit finding F1) — the only two actions an admin can take
// on a flagged orphaned-payment case: attempt recovery (re-verifies
// everything server-side before creating anything) or dismiss with a
// mandatory note. Mirrors the existing admin fetch/toast/disabled-button
// idiom used throughout (see OrderDetailActions.tsx) — same
// disabled-while-submitting guard against double-submission, same
// router.refresh() to pull the server component's fresh state after a
// mutation instead of hand-rolling client-side state sync.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "react-hot-toast";
import { RefreshCw, Ban } from "lucide-react";

type ReconciliationState = "pending_review" | "recovered" | "recovery_failed" | "dismissed" | null;

export default function ReconciliationRowActions({
    id,
    reconciliationState,
    orderId,
}: {
    id: string;
    reconciliationState: ReconciliationState;
    orderId: string | null;
}) {
    const router = useRouter();
    const [busy, setBusy] = useState(false);
    const [showDismiss, setShowDismiss] = useState(false);
    const [note, setNote] = useState("");

    const canRecover = reconciliationState !== "recovered" && reconciliationState !== "dismissed";
    const canDismiss = reconciliationState === "pending_review" || reconciliationState === "recovery_failed";

    if (reconciliationState === "recovered") {
        return (
            <p className="mt-3 text-[12px] font-semibold text-emerald-400">
                Order {orderId ?? ""} created — no further action needed.
            </p>
        );
    }
    if (reconciliationState === "dismissed") {
        return null;
    }

    const handleRecover = async () => {
        setBusy(true);
        try {
            const res = await fetch(`/api/admin/payment-reconciliation/${id}/recover`, { method: "POST" });
            const data = await res.json();
            if (data.success) {
                toast.success(data.alreadyResolved ? `Already recovered as ${data.orderId}` : `Order ${data.orderId} created`);
                router.refresh();
            } else {
                toast.error(data.message || "Recovery attempt failed");
                router.refresh();
            }
        } catch {
            toast.error("Network error — try again");
        } finally {
            setBusy(false);
        }
    };

    const handleDismiss = async () => {
        if (note.trim().length < 5) {
            toast.error("Add a short note (at least 5 characters) explaining why this is being dismissed");
            return;
        }
        setBusy(true);
        try {
            const res = await fetch(`/api/admin/payment-reconciliation/${id}/dismiss`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ note }),
            });
            const data = await res.json();
            if (data.success) {
                toast.success("Case dismissed");
                setShowDismiss(false);
                router.refresh();
            } else {
                toast.error(data.message || "Failed to dismiss");
            }
        } catch {
            toast.error("Network error — try again");
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="mt-3 flex flex-wrap items-center gap-2">
            {canRecover && (
                <button
                    onClick={handleRecover}
                    disabled={busy}
                    className="flex items-center gap-1.5 rounded-xl border border-amber-500/30 bg-amber-500/15 px-3 py-2 text-[12px] font-black text-amber-300 transition-all hover:bg-amber-500/25 disabled:cursor-wait disabled:opacity-50"
                >
                    <RefreshCw size={12} className={busy ? "animate-spin" : ""} />
                    {busy ? "Working…" : "Attempt Recovery"}
                </button>
            )}
            {canDismiss && !showDismiss && (
                <button
                    onClick={() => setShowDismiss(true)}
                    disabled={busy}
                    className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-[12px] font-black text-stone-300 transition-all hover:bg-white/[0.06]"
                >
                    <Ban size={12} /> Dismiss
                </button>
            )}

            {showDismiss && (
                <div className="mt-2 w-full rounded-xl border border-white/10 bg-[#0b0b10] p-3">
                    <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-stone-500">
                        Why is this being dismissed? (required)
                    </label>
                    <textarea
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        maxLength={300}
                        rows={2}
                        placeholder="e.g. confirmed refunded manually in Razorpay dashboard on 10 Jan"
                        className="mb-2 w-full resize-none rounded-lg border border-white/10 bg-[#0f0f16] px-3 py-2 text-[13px] text-stone-200 outline-none focus:border-amber-400/40"
                    />
                    <div className="flex gap-2">
                        <button
                            onClick={() => { setShowDismiss(false); setNote(""); }}
                            disabled={busy}
                            className="flex-1 rounded-lg border border-white/10 bg-white/[0.03] py-2 text-[12px] font-bold text-stone-300 hover:bg-white/[0.06]"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleDismiss}
                            disabled={busy}
                            className="flex-1 rounded-lg border border-rose-500/30 bg-rose-500/15 py-2 text-[12px] font-black text-rose-300 hover:bg-rose-500/25 disabled:cursor-wait disabled:opacity-50"
                        >
                            {busy ? "Dismissing…" : "Confirm Dismiss"}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
