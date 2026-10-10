"use client";

// src/components/admin/users/CustomerLoyaltyPanel.tsx
//
// Phase 15F — admin visibility layer only. Reuses the EXISTING
// GET /api/admin/loyalty/[userId] route (built for the Loyalty admin
// section) — no new loyalty query, no write path, no change to the
// underlying ledger/financial logic.

import { useEffect, useState } from "react";
import { Loader2, Gift, ArrowUpRight, ArrowDownRight } from "lucide-react";

type LedgerEntry = {
    id: string;
    type: string;
    points: number;
    balanceAfter: number;
    note: string;
    createdAt: string;
};

const TYPE_LABEL: Record<string, string> = {
    order_reward: "Order Reward",
    referral_referrer: "Referral Bonus",
    referral_referee: "Welcome Bonus",
    redemption: "Redeemed at Checkout",
    admin_credit: "Admin Credit",
    admin_debit: "Admin Debit",
    expiry: "Expired",
    spin_cost: "Spin Cost",
    spin_refund: "Spin Refund",
    spin_reward_points: "Spin Reward",
    redemption_reversal: "Redemption Reversed",
};

export default function CustomerLoyaltyPanel({
    userId, currentBalance, referralCode,
}: {
    userId: string;
    currentBalance: number;
    referralCode: string | null;
}) {
    const [ledger, setLedger] = useState<LedgerEntry[] | null>(null);
    const [error, setError] = useState(false);

    useEffect(() => {
        let cancelled = false;
        fetch(`/api/admin/loyalty/${userId}`)
            .then((r) => r.ok ? r.json() : Promise.reject())
            .then((d) => { if (!cancelled) setLedger(d.ledger ?? []); })
            .catch(() => { if (!cancelled) setError(true); });
        return () => { cancelled = true; };
    }, [userId]);

    return (
        <div className="rounded-2xl border border-white/[0.06] bg-[#0d0d14] p-4 sm:p-5">
            <div className="mb-3 flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-[14px] font-bold text-white">
                    <Gift size={14} className="text-amber-400" /> Loyalty
                </h2>
                <span className="font-mono text-base font-black text-amber-400">{currentBalance} pts</span>
            </div>
            {referralCode && (
                <p className="mb-3 text-[11px] text-stone-500">Referral code: <span className="font-mono text-stone-300">{referralCode}</span></p>
            )}

            {error ? (
                <p className="text-[12px] text-stone-500">Couldn&apos;t load loyalty history.</p>
            ) : ledger === null ? (
                <div className="flex items-center gap-2 py-4 text-[12px] text-stone-500">
                    <Loader2 size={13} className="animate-spin" /> Loading history…
                </div>
            ) : ledger.length === 0 ? (
                <p className="text-[12px] text-stone-500">No loyalty activity yet.</p>
            ) : (
                <div className="space-y-2">
                    {ledger.slice(0, 6).map((e) => (
                        <div key={e.id} className="flex items-center justify-between gap-2 text-[12px]">
                            <div className="flex items-center gap-1.5 min-w-0">
                                {e.points >= 0 ? (
                                    <ArrowUpRight size={11} className="shrink-0 text-emerald-400" />
                                ) : (
                                    <ArrowDownRight size={11} className="shrink-0 text-rose-400" />
                                )}
                                <span className="truncate text-stone-300">{TYPE_LABEL[e.type] ?? e.type}</span>
                            </div>
                            <span className={`shrink-0 font-mono font-bold ${e.points >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                                {e.points >= 0 ? "+" : ""}{e.points}
                            </span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
