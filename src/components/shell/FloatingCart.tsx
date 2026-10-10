"use client";

// src/components/shell/FloatingCart.tsx
//
// FoodKnock customer shell — light theme rework. Upgraded from a small
// icon+badge embedded in the bottom nav's hero slot to the richer
// Blinkit-style floating pill: real product thumbnails, item count, cart
// total, "View cart" label, arrow — rendered as its own fixed element
// (by src/components/shell/CustomerShell.tsx, positioned above
// BottomNavigation) rather than inside the nav row. Reads real cart state
// only (selectItems/selectTotalItems/selectTotalPrice from
// src/store/cartStore.ts) — never reimplements cart math. Renders nothing
// when the cart is empty.

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useCartStore, selectItems, selectTotalItems, selectTotalPrice } from "@/store/cartStore";
import { cdnImage } from "@/lib/cdnImage";
import { formatCurrency } from "@/lib/utils";

export default function FloatingCart() {
    const items = useCartStore(selectItems);
    const totalItems = useCartStore(selectTotalItems);
    const totalPrice = useCartStore(selectTotalPrice);
    const [mounted, setMounted] = useState(false);
    useEffect(() => setMounted(true), []);

    if (!mounted || totalItems === 0) return null;

    const thumbnails = items.slice(0, 3);

    return (
        <div
            className="fixed left-0 right-0 z-40 flex justify-center px-3 lg:hidden"
            style={{ bottom: "calc(var(--fk-bottom-nav-clearance) + var(--fk-safe-bottom) + 10px)" }}
        >
            <Link
                href="/cart"
                aria-label={`View cart, ${totalItems} item${totalItems !== 1 ? "s" : ""}, ${formatCurrency(totalPrice)}`}
                className="flex w-full max-w-md items-center gap-3 rounded-fk-pill bg-gradient-to-r from-[var(--fk-accent)] to-[var(--fk-gold)] py-2.5 pl-2.5 pr-4 text-white shadow-fk-lg transition-transform active:scale-[0.98]"
            >
                <span className="flex -space-x-3">
                    {thumbnails.map((item) => (
                        <img
                            key={item._id}
                            src={cdnImage(item.image, 80)}
                            alt=""
                            className="h-9 w-9 shrink-0 rounded-full border-2 border-white object-cover"
                        />
                    ))}
                </span>
                <span className="min-w-0 flex-1">
                    <span className="block text-[13px] font-black leading-tight">
                        View cart <span className="font-bold opacity-90">· {totalItems} item{totalItems !== 1 ? "s" : ""}</span>
                    </span>
                    <span className="block text-[11px] font-bold leading-tight opacity-90">{formatCurrency(totalPrice)}</span>
                </span>
                <ArrowRight size={18} className="shrink-0" />
            </Link>
        </div>
    );
}
