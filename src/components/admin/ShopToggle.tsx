"use client";

// src/components/admin/ShopToggle.tsx
//
// Compact shop open/closed control — embedded directly in the Dashboard
// hero (Phase 15E.8), matching the reference dashboard's inline
// "Shop [is OPEN] [Close Shop]" composition instead of a separate
// full-width card (the previous standalone-card version duplicated the
// hero's own "Store Live" badge — removed in favor of this one real,
// functional control). Still the single source of truth for shop open/
// closed admin actions: GET/POST /api/shop/status, which reads/writes the
// Shop singleton (src/models/Shop.ts) — no second status authority.
//
// Phase 15E.8 addition: closing now collects a reason (ShopCloseReasonModal)
// — see src/lib/shopCloseReasons.ts for the shared allowlist consumed by
// both this control and customer-facing messaging.

import { useEffect, useState, useCallback } from "react";
import { Store, Loader2, Power, AlertCircle } from "lucide-react";
import ShopCloseReasonModal from "./ShopCloseReasonModal";

type Status = "open" | "closed" | "loading" | "error";

export default function ShopToggle() {
    const [status, setStatus] = useState<Status>("loading");
    const [toggling, setToggling] = useState(false);
    const [reasonLabel, setReasonLabel] = useState<string | null>(null);
    const [showReasonModal, setShowReasonModal] = useState(false);

    const refresh = useCallback(() => {
        return fetch("/api/shop/status")
            .then((r) => r.ok ? r.json() : Promise.reject())
            .then((d) => {
                setStatus(d.isOpen ? "open" : "closed");
                setReasonLabel(d.closedReasonLabel ?? null);
            })
            .catch(() => setStatus("error"));
    }, []);

    useEffect(() => { refresh(); }, [refresh]);

    const applyStatus = useCallback(async (isOpen: boolean, reasonCode?: string, reasonText?: string) => {
        setToggling(true);
        try {
            const res = await fetch("/api/shop/status", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ isOpen, reasonCode, reasonText }),
            });
            const data = await res.json();
            if (data.success) {
                setStatus(data.isOpen ? "open" : "closed");
                setReasonLabel(data.closedReasonLabel ?? null);
                setShowReasonModal(false);
            }
        } catch {
            // silently ignore — status stays as-is, admin can retry
        } finally {
            setToggling(false);
        }
    }, []);

    const handleClick = () => {
        if (toggling || status === "loading" || status === "error") return;
        if (status === "open") {
            setShowReasonModal(true);
        } else {
            applyStatus(true);
        }
    };

    const isOpen = status === "open";
    const isLoading = status === "loading" || toggling;

    return (
        <>
            <div className="flex flex-col gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-2.5 sm:flex-row sm:items-center sm:gap-3">
                <div className="flex items-center gap-2">
                    <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
                        status === "loading" ? "bg-white/[0.06]" : isOpen ? "bg-emerald-500/15" : "bg-rose-500/15"
                    }`}>
                        {status === "loading" ? (
                            <Loader2 size={13} className="animate-spin text-stone-300" />
                        ) : (
                            <Store size={13} className={isOpen ? "text-emerald-400" : "text-rose-400"} />
                        )}
                    </div>
                    <div className="leading-tight">
                        <span className="text-[13px] font-bold text-stone-200">Shop</span>{" "}
                        {status === "error" ? (
                            <span className="inline-flex items-center gap-1 text-[12px] font-bold text-amber-400">
                                <AlertCircle size={11} /> Unknown
                            </span>
                        ) : (
                            <span className={`text-[12px] font-black uppercase ${isOpen ? "text-emerald-400" : "text-rose-400"}`}>
                                is {status === "loading" ? "…" : isOpen ? "OPEN" : "CLOSED"}
                            </span>
                        )}
                        <p className="text-[10.5px] text-stone-400">
                            {isOpen ? "Accepting orders now" : reasonLabel ? reasonLabel : "New orders paused"}
                        </p>
                    </div>
                </div>

                <button
                    type="button"
                    onClick={handleClick}
                    disabled={isLoading || status === "error"}
                    aria-label={isOpen ? "Close shop" : "Reopen shop"}
                    className={`flex shrink-0 items-center justify-center gap-1.5 rounded-lg px-3.5 py-2 text-[12px] font-bold transition-all active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50 ${
                        isOpen
                            ? "border border-rose-500/30 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20"
                            : "border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20"
                    }`}
                >
                    {isLoading ? <Loader2 size={13} className="animate-spin" /> : <Power size={13} strokeWidth={2.5} />}
                    {isLoading ? "Updating…" : isOpen ? "Close Shop" : "Reopen"}
                </button>
            </div>

            {showReasonModal && (
                <ShopCloseReasonModal
                    submitting={toggling}
                    onClose={() => setShowReasonModal(false)}
                    onConfirm={(code, text) => applyStatus(false, code, text)}
                />
            )}
        </>
    );
}
