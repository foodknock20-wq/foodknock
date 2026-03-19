"use client";

// src/components/admin/ShopToggle.tsx
//
// Displays current shop status and lets admins toggle open / closed.
// Calls POST /api/shop/status with { isOpen: boolean }.
// Designed to sit naturally alongside the existing dark admin dashboard theme.

import { useEffect, useState, useCallback } from "react";
import { Store, Loader2, Power } from "lucide-react";

type Status = "open" | "closed" | "loading" | "error";

export default function ShopToggle() {
    const [status,   setStatus]   = useState<Status>("loading");
    const [toggling, setToggling] = useState(false);

    // ── Fetch current status on mount ────────────────────────────────────────
    useEffect(() => {
        fetch("/api/shop/status")
            .then((r) => r.ok ? r.json() : Promise.reject())
            .then((d) => setStatus(d.isOpen ? "open" : "closed"))
            .catch(() => setStatus("error"));
    }, []);

    // ── Toggle handler ────────────────────────────────────────────────────────
    const handleToggle = useCallback(async () => {
        if (toggling || status === "loading" || status === "error") return;

        const nextOpen = status === "closed"; // flip

        setToggling(true);
        try {
            const res = await fetch("/api/shop/status", {
                method:  "POST",
                headers: { "Content-Type": "application/json" },
                body:    JSON.stringify({ isOpen: nextOpen }),
            });
            const data = await res.json();
            if (data.success) {
                setStatus(data.isOpen ? "open" : "closed");
            }
        } catch {
            // silently ignore — status stays as-is
        } finally {
            setToggling(false);
        }
    }, [status, toggling]);

    // ── Derived UI values ─────────────────────────────────────────────────────
    const isOpen    = status === "open";
    const isLoading = status === "loading" || toggling;

    return (
        <div className="overflow-hidden rounded-2xl border border-white/[0.06] bg-[#111118]">
            {/* Header row — matches SectionCard style from admin dashboard */}
            <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4">
                <div className="flex items-center gap-3">
                    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-colors ${
                        isLoading  ? "bg-white/[0.06]" :
                        isOpen     ? "bg-emerald-500/15" :
                                     "bg-rose-500/15"
                    }`}>
                        <Store
                            size={16}
                            strokeWidth={2}
                            className={
                                isLoading  ? "text-stone-500" :
                                isOpen     ? "text-emerald-400" :
                                             "text-rose-400"
                            }
                        />
                    </div>
                    <div>
                        <h2 className="font-serif text-base font-bold text-white">Shop Status</h2>
                        <p className="mt-0.5 text-[11px] text-stone-600">Control whether customers can place orders</p>
                    </div>
                </div>

                {/* Status pill */}
                {status === "loading" ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1 text-[11px] font-semibold text-stone-500">
                        <Loader2 size={11} className="animate-spin" /> Loading…
                    </span>
                ) : status === "error" ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-[11px] font-semibold text-amber-400">
                        Unknown
                    </span>
                ) : (
                    <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-bold ${
                        isOpen
                            ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
                            : "border-rose-500/20 bg-rose-500/10 text-rose-400"
                    }`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${isOpen ? "bg-emerald-400 shadow-[0_0_5px_1px_rgba(52,211,153,0.6)]" : "bg-rose-400"}`} />
                        {isOpen ? "Open" : "Closed"}
                    </span>
                )}
            </div>

            {/* Body */}
            <div className="flex items-center justify-between gap-4 px-5 py-4">
                <div>
                    {status === "error" ? (
                        <p className="text-sm text-stone-500">Could not reach database. Refresh to retry.</p>
                    ) : isOpen ? (
                        <>
                            <p className="text-sm font-semibold text-stone-200">Customers can browse and order</p>
                            <p className="mt-0.5 text-[12px] text-stone-600">Click to close the shop and stop new orders</p>
                        </>
                    ) : (
                        <>
                            <p className="text-sm font-semibold text-stone-200">New orders are paused</p>
                            <p className="mt-0.5 text-[12px] text-stone-600">Click to reopen and resume accepting orders</p>
                        </>
                    )}
                </div>

                {/* Toggle button */}
                <button
                    type="button"
                    onClick={handleToggle}
                    disabled={isLoading || status === "error"}
                    aria-label={isOpen ? "Close shop" : "Open shop"}
                    className={`group flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-[13px] font-bold transition-all active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50 ${
                        isOpen
                            ? "border border-rose-500/30 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20"
                            : "border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
                    }`}
                >
                    {isLoading ? (
                        <Loader2 size={14} className="animate-spin" />
                    ) : (
                        <Power size={14} strokeWidth={2.5} />
                    )}
                    {isLoading ? "Updating…" : isOpen ? "Close Shop" : "Open Shop"}
                </button>
            </div>
        </div>
    );
}