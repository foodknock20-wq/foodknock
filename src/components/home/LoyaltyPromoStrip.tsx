"use client";

// src/components/home/LoyaltyPromoStrip.tsx
//
// FoodKnock UI 2.0 — Phase 2: compact loyalty presentation (spec section
// 22). Pure presentation layer — reads the real balance already shared
// globally by src/components/shell/CustomerShell.tsx (via useAuthStore,
// populated from its existing GET /api/navbar fetch) instead of firing a
// second network call or duplicating the loyalty engine.

import Link from "next/link";
import { Gift, LogIn } from "lucide-react";
import { useAuthStore } from "@/store/authStore";

export default function LoyaltyPromoStrip() {
    const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
    const loyaltyBalance = useAuthStore((s) => s.loyaltyBalance);

    if (isLoggedIn === false) {
        return (
            <Link
                href="/auth?mode=login"
                className="mx-4 flex items-center justify-between gap-3 rounded-fk-lg border border-fk-border bg-fk-surface-elevated px-4 py-3.5 md:mx-8"
            >
                <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-fk-md bg-fk-surface-selected text-fk-gold">
                        <Gift size={18} />
                    </span>
                    <div>
                        <p className="text-[13.5px] font-bold text-fk-text">Sign in to earn FoodKnock Points</p>
                        <p className="text-[11px] text-fk-text-tertiary">Points on every order, redeemable for rewards</p>
                    </div>
                </div>
                <LogIn size={16} className="shrink-0 text-fk-text-tertiary" />
            </Link>
        );
    }

    if (isLoggedIn === null) return null; // not resolved yet — avoid a flash of the wrong state

    return (
        <Link
            href="/loyalty"
            className="mx-4 flex items-center justify-between gap-3 rounded-fk-lg border border-fk-border bg-fk-surface-elevated px-4 py-3.5 md:mx-8"
        >
            <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-fk-md bg-fk-surface-selected text-fk-gold">
                    <Gift size={18} />
                </span>
                <div>
                    <p className="text-[13.5px] font-bold text-fk-text">
                        You have <span className="text-[var(--fk-accent)]">{loyaltyBalance ?? 0} points</span>
                    </p>
                    <p className="text-[11px] text-fk-text-tertiary">Redeem them for rewards on your next order</p>
                </div>
            </div>
        </Link>
    );
}
