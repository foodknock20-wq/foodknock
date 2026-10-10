"use client";

// src/components/admin/orders/DeleteOrderModal.tsx
//
// Phase 15C — the ONE UI for the high-risk "delete this order" action.
// Deliberately NOT a one-click button: requires the admin to type the
// order's exact human-readable orderId before the request is even sent,
// and is only ever reachable for an already-cancelled order (see
// OrderDetailActions.tsx — this modal is simply never rendered for an
// active order).
//
// The server (src/lib/orderDeletion.ts, via POST /api/admin/orders/[id]/delete)
// is the ONLY authority on what actually happens — hard delete vs. a safe
// archive fallback. This component has no opinion about which outcome is
// "correct" and never tries to predict it; it just reports whatever the
// server actually did.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Loader2 } from "lucide-react";

export default function DeleteOrderModal({
    orderId,
    orderMongoId,
    onClose,
}: {
    /** Human-readable order ID — what the admin must type to confirm. */
    orderId: string;
    orderMongoId: string;
    onClose: () => void;
}) {
    const router = useRouter();
    const [confirmText, setConfirmText] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState("");

    const matches = confirmText.trim() === orderId;

    const handleDelete = async () => {
        if (!matches) return;
        setSubmitting(true);
        setError("");
        try {
            const res = await fetch(`/api/admin/orders/${orderMongoId}/delete`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ confirm: confirmText.trim() }),
            });
            const data = await res.json();
            if (!data.success) {
                setError(data.message || "Failed to delete order.");
                setSubmitting(false);
                return;
            }
            if (data.mode === "deleted") {
                router.push("/admin/orders");
                router.refresh();
            } else {
                // Archived — stays on this page but reflects the new state.
                onClose();
                router.refresh();
            }
        } catch {
            setError("Network error — please try again.");
            setSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
            <div
                className="w-full max-w-sm rounded-2xl border border-rose-500/20 bg-[#13131c] p-5 shadow-2xl"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="mb-3 flex items-center gap-2">
                    <AlertTriangle size={18} className="text-rose-400" />
                    <h3 className="text-sm font-black text-white">Delete Order</h3>
                </div>

                <p className="mb-3 text-[12.5px] leading-relaxed text-stone-400">
                    This is permanent for orders with no financial references elsewhere
                    (COD, no coupon/offer, no loyalty redeemed). If this order has any
                    such reference, it will instead be <span className="font-bold text-amber-400">archived</span>{" "}
                    (hidden from the operational list, but kept intact for audit/financial integrity) —
                    never silently destroyed.
                </p>

                <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-stone-500">
                    Type <span className="font-mono text-rose-400">{orderId}</span> to confirm
                </label>
                <input
                    type="text"
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value)}
                    placeholder={orderId}
                    className="mb-3 w-full rounded-xl border border-white/10 bg-[#0f0f16] px-3 py-2.5 font-mono text-[13px] text-stone-200 outline-none focus:border-rose-400/40"
                />

                {error && <p className="mb-3 text-[12px] font-semibold text-rose-400">{error}</p>}

                <div className="flex gap-2">
                    <button
                        onClick={onClose}
                        disabled={submitting}
                        className="flex-1 rounded-xl border border-white/10 bg-white/[0.03] py-2.5 text-[12px] font-black text-stone-300 transition-all hover:bg-white/[0.06]"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleDelete}
                        disabled={!matches || submitting}
                        className="flex-1 rounded-xl border border-rose-500/30 bg-rose-500/15 py-2.5 text-[12px] font-black text-rose-300 transition-all hover:bg-rose-500/25 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                        {submitting ? <Loader2 size={13} className="mx-auto animate-spin" /> : "Delete Order"}
                    </button>
                </div>
            </div>
        </div>
    );
}
