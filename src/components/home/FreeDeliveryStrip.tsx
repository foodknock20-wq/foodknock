"use client";

// src/components/home/FreeDeliveryStrip.tsx
//
// FoodKnock UI 2.0 — light theme rework, spec section 17 ("Promo / Free
// Delivery Strip"). Real data only: reads the actual FREE_DELIVERY_AT
// constant (src/lib/delivery.ts — the same constant checkout/cart already
// use, never recomputed here) and the real cart subtotal
// (selectTotalPrice). Three honest states — never a fabricated discount
// or progress value. Rendered INLINE in the Home page flow (not `fixed`),
// so it can never cover the bottom nav or FloatingCart. Dismissible for
// the session, same sessionStorage pattern already used by
// src/components/shared/InstallPwaButton.tsx's dismiss flag.

import { useEffect, useState } from "react";
import { Truck, X, CheckCircle2 } from "lucide-react";
import { useCartStore, selectTotalPrice } from "@/store/cartStore";
import { FREE_DELIVERY_AT } from "@/lib/delivery";
import { formatCurrency } from "@/lib/utils";

const DISMISS_KEY = "fk_free_delivery_strip_dismissed_v1";

export default function FreeDeliveryStrip() {
    const subtotal = useCartStore(selectTotalPrice);
    const [mounted, setMounted] = useState(false);
    const [dismissed, setDismissed] = useState(false);

    useEffect(() => {
        setMounted(true);
        try {
            setDismissed(sessionStorage.getItem(DISMISS_KEY) === "1");
        } catch { }
    }, []);

    if (!mounted || dismissed) return null;

    const unlocked = subtotal > 0 && subtotal >= FREE_DELIVERY_AT;
    const remaining = Math.max(0, FREE_DELIVERY_AT - subtotal);
    const progressPct = subtotal > 0 ? Math.min(100, Math.round((subtotal / FREE_DELIVERY_AT) * 100)) : 0;

    function dismiss() {
        setDismissed(true);
        try { sessionStorage.setItem(DISMISS_KEY, "1"); } catch { }
    }

    return (
        <div className="mx-4 mt-4 overflow-hidden rounded-fk-md border border-fk-border bg-fk-surface-elevated px-4 py-3 md:mx-8">
            <div className="flex items-center gap-3">
                <span
                    className={
                        unlocked
                            ? "flex h-9 w-9 shrink-0 items-center justify-center rounded-fk-sm bg-fk-success/10 text-fk-success"
                            : "flex h-9 w-9 shrink-0 items-center justify-center rounded-fk-sm bg-fk-surface-selected text-[var(--fk-accent)]"
                    }
                >
                    {unlocked ? <CheckCircle2 size={18} /> : <Truck size={18} />}
                </span>
                <div className="min-w-0 flex-1">
                    {unlocked ? (
                        <p className="text-[13px] font-bold text-fk-text">Free delivery unlocked — no coupon needed</p>
                    ) : subtotal > 0 ? (
                        <p className="text-[13px] font-bold text-fk-text">
                            Add {formatCurrency(remaining)} more for <span className="text-[var(--fk-accent)]">free delivery</span>
                        </p>
                    ) : (
                        <p className="text-[13px] font-bold text-fk-text">
                            Free delivery on orders above {formatCurrency(FREE_DELIVERY_AT)}
                        </p>
                    )}
                    {subtotal > 0 && !unlocked && (
                        <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-fk-pill bg-fk-surface-interactive">
                            <div
                                className="h-full rounded-fk-pill bg-gradient-to-r from-[var(--fk-accent)] to-[var(--fk-gold)] transition-all"
                                style={{ width: `${progressPct}%` }}
                            />
                        </div>
                    )}
                </div>
                <button onClick={dismiss} aria-label="Dismiss" className="shrink-0 text-fk-text-tertiary">
                    <X size={16} />
                </button>
            </div>
        </div>
    );
}
