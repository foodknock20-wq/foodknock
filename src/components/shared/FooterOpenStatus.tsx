"use client";

// src/components/shared/FooterOpenStatus.tsx
//
// FINAL UI/UX MASTER PROMPT — Phase 3. Footer.tsx used to hardcode a static
// "Open Now · Taking Orders" badge — always green, regardless of whether an
// admin had actually toggled the shop closed via /admin/delivery
// (src/models/Shop.ts's real `isOpen` flag — the same signal /menu's closed
// banner and checkout already gate on). That's a real-vs-fabricated-data
// problem, not just styling.
//
// Footer itself must stay a plain, synchronous component importable from
// BOTH server pages and the ~10 "use client" pages that render it
// (cart/checkout/my-orders/loyalty/etc.) — a Client Component cannot render
// an async Server Component by direct import, so the live lookup is
// isolated here instead of making Footer itself async. This hits the same
// public, CDN-cached (`s-maxage=10`) GET /api/shop/status endpoint every
// other client-side shop-status read in the app already uses — no new
// endpoint, no new polling cadence invented.
//
// Fails open (shows "Open Now") on any fetch error or before the first
// response arrives, matching that endpoint's own fail-open contract — a
// network hiccup in the footer must never tell a customer the kitchen is
// closed when it might not be.

import { useEffect, useState } from "react";

type Status = { isOpen: boolean; closedReasonLabel: string | null };

export default function FooterOpenStatus() {
    const [status, setStatus] = useState<Status>({ isOpen: true, closedReasonLabel: null });

    useEffect(() => {
        let cancelled = false;
        fetch("/api/shop/status")
            .then((res) => res.json())
            .then((data) => {
                if (cancelled || !data?.success) return;
                setStatus({ isOpen: data.isOpen !== false, closedReasonLabel: data.closedReasonLabel ?? null });
            })
            .catch(() => {});
        return () => { cancelled = true; };
    }, []);

    if (status.isOpen) {
        return (
            <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-4 py-2">
                <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                </span>
                <span className="text-[11px] font-bold text-emerald-400">Open Now · Taking Orders</span>
            </div>
        );
    }

    return (
        <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-red-500/20 bg-red-500/10 px-4 py-2">
            <span className="relative flex h-2 w-2 rounded-full bg-red-400" />
            <span className="text-[11px] font-bold text-red-400">
                Currently Closed{status.closedReasonLabel ? ` · ${status.closedReasonLabel}` : ""}
            </span>
        </div>
    );
}
