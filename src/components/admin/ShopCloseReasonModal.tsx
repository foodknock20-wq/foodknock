"use client";

// src/components/admin/ShopCloseReasonModal.tsx
//
// Phase 15E.8 — shared close-reason picker, used by every admin surface
// that can close the shop (ShopToggle card, Dashboard hero). One modal,
// one validation rule (custom requires text), not reimplemented per call
// site. isOpen/closed itself stays authoritative in Shop.ts — this only
// collects WHY before the close request is sent.

import { useState } from "react";
import { X, Loader2, PowerOff } from "lucide-react";
import { SHOP_CLOSE_REASONS } from "@/lib/shopCloseReasons";

export default function ShopCloseReasonModal({
    onClose, onConfirm, submitting,
}: {
    onClose: () => void;
    onConfirm: (reasonCode: string, reasonText: string) => void;
    submitting: boolean;
}) {
    const [code, setCode] = useState<string>(SHOP_CLOSE_REASONS[0].code);
    const [text, setText] = useState("");

    const isCustom = code === "custom";
    const canSubmit = !isCustom || text.trim().length > 0;

    return (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 backdrop-blur-sm sm:items-center" onClick={onClose}>
            <div
                className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#13131c] p-5 shadow-2xl"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="mb-4 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-rose-500/25 bg-rose-500/10">
                            <PowerOff size={15} className="text-rose-400" />
                        </div>
                        <h3 className="text-sm font-black text-white">Close Shop</h3>
                    </div>
                    <button onClick={onClose} className="text-stone-300 hover:text-stone-100">
                        <X size={16} />
                    </button>
                </div>

                <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-stone-400">
                    Reason
                </label>
                <select
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    className="mb-3 w-full rounded-xl border border-white/10 bg-[#0f0f16] px-3 py-2.5 text-[13px] text-stone-200 outline-none focus:border-rose-400/40"
                >
                    {SHOP_CLOSE_REASONS.map((r) => (
                        <option key={r.code} value={r.code}>{r.label}</option>
                    ))}
                </select>

                {isCustom && (
                    <>
                        <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-stone-400">
                            Describe the reason
                        </label>
                        <textarea
                            value={text}
                            onChange={(e) => setText(e.target.value)}
                            maxLength={200}
                            rows={2}
                            placeholder="e.g. Gas cylinder delivery delayed"
                            className="mb-3 w-full resize-none rounded-xl border border-white/10 bg-[#0f0f16] px-3 py-2.5 text-[13px] text-stone-200 outline-none placeholder:text-stone-600 focus:border-rose-400/40"
                        />
                    </>
                )}

                <p className="mb-4 text-[11px] text-stone-400">
                    Customers will see this reason on the menu and checkout while the shop is closed.
                </p>

                <div className="flex gap-2">
                    <button
                        onClick={onClose}
                        disabled={submitting}
                        className="flex-1 rounded-xl border border-white/10 bg-white/[0.03] py-2.5 text-[12px] font-black text-stone-300 transition-all hover:bg-white/[0.06] hover:text-stone-100"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={() => onConfirm(code, text.trim())}
                        disabled={submitting || !canSubmit}
                        className="flex-1 rounded-xl border border-rose-500/30 bg-rose-500/15 py-2.5 text-[12px] font-black text-rose-300 transition-all hover:bg-rose-500/25 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {submitting ? <Loader2 size={14} className="mx-auto animate-spin" /> : "Close Shop"}
                    </button>
                </div>
            </div>
        </div>
    );
}
