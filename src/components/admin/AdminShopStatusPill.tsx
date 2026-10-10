"use client";

// src/components/admin/AdminShopStatusPill.tsx
//
// Phase 15B — compact, read-only shop OPEN/CLOSED indicator for the admin
// shell. Reuses the exact same authoritative /api/shop/status endpoint
// ShopToggle.tsx already calls — no second source of truth, no duplicated
// shop-status logic. This component never WRITES shop status; the actual
// toggle control stays exactly where it already is (the dashboard's
// ShopToggle). Clicking this pill just navigates there.
//
// Rendered once, in the sidebar (present in the DOM on every admin page,
// desktop and mobile), so shop status is "visible everywhere" per the
// Phase 15B brief without a second fetch anywhere else in the shell.

import { useEffect, useState } from "react";
import Link from "next/link";
import { Store, Loader2 } from "lucide-react";

type Status = "open" | "closed" | "loading" | "error";

export default function AdminShopStatusPill() {
    const [status, setStatus] = useState<Status>("loading");

    useEffect(() => {
        let cancelled = false;
        fetch("/api/shop/status")
            .then((r) => (r.ok ? r.json() : Promise.reject()))
            .then((d) => { if (!cancelled) setStatus(d.isOpen ? "open" : "closed"); })
            .catch(() => { if (!cancelled) setStatus("error"); });
        return () => { cancelled = true; };
    }, []);

    if (status === "error") return null; // fail quiet — not critical chrome

    const isOpen = status === "open";
    const isLoading = status === "loading";

    return (
        <Link
            href="/admin"
            title={isLoading ? "Loading shop status…" : isOpen ? "Shop is open — click to manage" : "Shop is closed — click to manage"}
            className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-[11px] font-bold transition-colors ${isLoading
                ? "border-white/[0.06] bg-white/[0.02] text-stone-600"
                : isOpen
                    ? "border-emerald-500/20 bg-emerald-500/8 text-emerald-400 hover:bg-emerald-500/14"
                    : "border-rose-500/20 bg-rose-500/8 text-rose-400 hover:bg-rose-500/14"
                }`}
        >
            {isLoading ? (
                <Loader2 size={12} className="animate-spin" />
            ) : (
                <Store size={12} strokeWidth={2.5} />
            )}
            {isLoading ? "Checking shop…" : isOpen ? "Shop Open" : "Shop Closed"}
            {!isLoading && (
                <span className={`ml-auto h-1.5 w-1.5 rounded-full ${isOpen ? "bg-emerald-400 shadow-[0_0_5px_1px_rgba(52,211,153,0.5)]" : "bg-rose-400"}`} />
            )}
        </Link>
    );
}
