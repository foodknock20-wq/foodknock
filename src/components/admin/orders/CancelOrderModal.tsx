"use client";

// src/components/admin/orders/CancelOrderModal.tsx
// Shared admin cancel-confirmation modal — used by both OrderTable.tsx
// (card quick-action) and the order detail page's quick actions, so there
// is exactly one admin cancellation UI, not two independently maintained
// copies.

import { useState } from "react";
import { XCircle } from "lucide-react";

export const ADMIN_CANCEL_REASON_OPTIONS: { value: string; label: string }[] = [
    { value: "out_of_stock", label: "Out of stock" },
    { value: "kitchen_issue", label: "Kitchen issue" },
    { value: "delivery_issue", label: "Delivery issue" },
    { value: "customer_request", label: "Customer request" },
    { value: "payment_issue", label: "Payment issue" },
    { value: "operational_issue", label: "Operational issue" },
    { value: "other", label: "Other" },
];

export default function CancelOrderModal({
    orderId,
    onClose,
    onConfirm,
}: {
    orderId: string;
    onClose: () => void;
    onConfirm: (id: string, reason: string, note: string) => Promise<void>;
}) {
    const [reason, setReason] = useState(ADMIN_CANCEL_REASON_OPTIONS[0].value);
    const [note, setNote] = useState("");
    const [submitting, setSubmitting] = useState(false);

    const handleConfirm = async () => {
        setSubmitting(true);
        await onConfirm(orderId, reason, note);
        setSubmitting(false);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
            <div
                className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#13131c] p-5 shadow-2xl"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="mb-4 flex items-center gap-2">
                    <XCircle size={16} className="text-rose-400" />
                    <h3 className="text-sm font-black text-white">Cancel Order?</h3>
                </div>

                <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-stone-500">
                    Reason
                </label>
                <select
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    className="mb-3 w-full rounded-xl border border-white/10 bg-[#0f0f16] px-3 py-2.5 text-[13px] text-stone-200 outline-none focus:border-rose-400/40"
                >
                    {ADMIN_CANCEL_REASON_OPTIONS.map((r) => (
                        <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                </select>

                <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-stone-500">
                    Note (optional)
                </label>
                <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    maxLength={300}
                    rows={2}
                    className="mb-4 w-full resize-none rounded-xl border border-white/10 bg-[#0f0f16] px-3 py-2.5 text-[13px] text-stone-200 outline-none focus:border-rose-400/40"
                    placeholder="Add any extra context for this cancellation…"
                />

                <div className="flex gap-2">
                    <button
                        onClick={onClose}
                        disabled={submitting}
                        className="flex-1 rounded-xl border border-white/10 bg-white/[0.03] py-2.5 text-[12px] font-black text-stone-300 transition-all hover:bg-white/[0.06]"
                    >
                        Keep Order
                    </button>
                    <button
                        onClick={handleConfirm}
                        disabled={submitting}
                        className="flex-1 rounded-xl border border-rose-500/30 bg-rose-500/15 py-2.5 text-[12px] font-black text-rose-300 transition-all hover:bg-rose-500/25 disabled:cursor-wait disabled:opacity-50"
                    >
                        {submitting ? "Cancelling…" : "Cancel Order"}
                    </button>
                </div>
            </div>
        </div>
    );
}
