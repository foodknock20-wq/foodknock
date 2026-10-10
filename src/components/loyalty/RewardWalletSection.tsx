"use client";

// src/components/loyalty/RewardWalletSection.tsx
//
// Phase 12 — "My Rewards": past Spin outcomes with their live wallet
// status (AVAILABLE/USED/EXPIRED), derived from Phase 11's own Coupon
// fields via GET /api/spin/history — no duplicate reward-status storage.

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "react-hot-toast";
import { Loader2, Gift, Copy } from "lucide-react";
import { LOYALTY_CHANGED_EVENT } from "@/lib/clientEvents";

type WalletItem = {
    id: string; rewardLabel: string; rewardType: string; rewardValue: number;
    pointsAwarded: number; couponCode: string | null;
    walletStatus: "AVAILABLE" | "USED" | "EXPIRED" | "POINTS";
    expiresAt: string | null; minimumOrderValue: number; createdAt: string;
};

const STATUS_META: Record<WalletItem["walletStatus"], { label: string; cls: string }> = {
    AVAILABLE: { label: "Available", cls: "bg-fk-success/10 text-fk-success border-fk-success/25" },
    USED:      { label: "Used",      cls: "bg-fk-surface-interactive text-fk-text-secondary border-fk-border" },
    EXPIRED:   { label: "Expired",   cls: "bg-fk-danger/10 text-fk-danger border-fk-danger/25" },
    POINTS:    { label: "Credited",  cls: "bg-violet-50 text-violet-700 border-violet-200" },
};

export default function RewardWalletSection() {
    const [items, setItems] = useState<WalletItem[] | null>(null);
    // In-flight guard — prevents two overlapping GETs if the refresh event
    // somehow fires twice in quick succession. Not component state: a ref
    // avoids an extra render just to track this.
    const fetchingRef = useRef(false);

    // `background: true` is the post-spin refresh path (see the event
    // listener below). It must NEVER reset `items` to null — that's what
    // shows the full loading spinner, which would make an already-visible
    // reward list disappear and flash back in. A full, authoritative
    // re-fetch (not a manual array splice) is the simplest way to
    // guarantee the list is always exactly what the server has — no
    // client-side merge logic to get wrong, no possibility of a duplicate
    // entry, correct order for free (the API already returns newest-first,
    // bounded to the same MAX_HISTORY limit as the initial load).
    const loadHistory = useCallback(async (opts: { background?: boolean } = {}) => {
        if (fetchingRef.current) return;
        fetchingRef.current = true;
        try {
            const res = await fetch("/api/spin/history", { credentials: "include" });
            const data = res.ok ? await res.json() : null;
            if (data?.success) {
                setItems(data.items);
            } else if (!opts.background) {
                setItems([]);
            }
            // A background refresh that fails is a no-op — the previously
            // loaded list simply stays as-is rather than being blanked.
        } catch {
            if (!opts.background) setItems([]);
        } finally {
            fetchingRef.current = false;
        }
    }, []);

    useEffect(() => { loadHistory(); }, [loadHistory]);

    // Reuses the SAME event SpinWheelSection already dispatches once a
    // spin's result has settled (balance refresh) — a spin is also exactly
    // when a new SpinRecord exists server-side, so one listener covers
    // both without a second event or any wheel-side change.
    useEffect(() => {
        const handler = () => loadHistory({ background: true });
        window.addEventListener(LOYALTY_CHANGED_EVENT, handler);
        return () => window.removeEventListener(LOYALTY_CHANGED_EVENT, handler);
    }, [loadHistory]);

    function copyCode(code: string) {
        navigator.clipboard?.writeText(code).then(() => toast.success("Copied"));
    }

    if (items === null) {
        return (
            <div className="flex items-center justify-center rounded-fk-lg border border-fk-border bg-fk-surface-elevated p-8 shadow-sm">
                <Loader2 size={18} className="animate-spin text-[var(--fk-accent)]" />
            </div>
        );
    }

    return (
        <div className="overflow-hidden rounded-fk-lg border border-fk-border bg-fk-surface-elevated shadow-sm">
            <div className="flex items-center gap-2.5 border-b border-fk-border bg-fk-surface-selected px-5 py-4">
                <div className="flex h-8 w-8 items-center justify-center rounded-fk-sm bg-fk-gold-soft">
                    <Gift size={14} className="text-amber-600" />
                </div>
                <h2 className="text-sm font-black text-fk-text">My Rewards</h2>
                <span className="ml-auto rounded-fk-pill border border-fk-border bg-fk-gold-soft px-3 py-0.5 text-[11px] font-black text-[var(--fk-accent)]">
                    {items.length}
                </span>
            </div>

            {items.length === 0 ? (
                <p className="px-5 py-8 text-center text-[12px] text-fk-text-tertiary">
                    No rewards yet — spin the wheel above to win your first one 🎡
                </p>
            ) : (
                <div className="divide-y divide-fk-border">
                    {items.map((item) => {
                        const meta = STATUS_META[item.walletStatus];
                        return (
                            <div key={item.id} className="flex items-center justify-between gap-3 px-5 py-3.5">
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2">
                                        <p className="truncate text-[13px] font-bold text-fk-text">🎡 {item.rewardLabel}</p>
                                        <span className={`shrink-0 rounded-fk-pill border px-2 py-0.5 text-[10px] font-bold ${meta.cls}`}>{meta.label}</span>
                                    </div>
                                    <p className="mt-0.5 text-[11px] text-fk-text-tertiary">
                                        {new Date(item.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
                                        {item.minimumOrderValue > 0 && ` · Min order ₹${item.minimumOrderValue}`}
                                        {item.expiresAt && ` · Expires ${new Date(item.expiresAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}`}
                                    </p>
                                </div>
                                {item.couponCode && item.walletStatus === "AVAILABLE" && (
                                    <button
                                        onClick={() => copyCode(item.couponCode!)}
                                        className="flex shrink-0 items-center gap-1 rounded-fk-md border border-fk-border bg-fk-gold-soft px-3 py-1.5 text-[11px] font-black text-[var(--fk-accent)] hover:brightness-105"
                                    >
                                        <Copy size={11} /> {item.couponCode}
                                    </button>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
