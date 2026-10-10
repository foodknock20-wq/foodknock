"use client";

// src/components/shell/BottomNavigation.tsx
//
// Luxury Navigation 2.0 — same 5 destinations, same order, same
// authenticated-vs-guest Orders/Track-Order branching, same cart badge
// logic as before. What changed: the container is now a floating
// "island" (inset margins + fully rounded on all sides + its own
// elevation) instead of an edge-to-edge bar glued to the viewport bottom,
// and the active state is a soft warm icon badge instead of the previous
// thin top indicator line. `accountOpen` is new — Account isn't a real
// route (it opens CustomerShell's AccountDialog), so its "active" state
// can't come from `pathname` alone; it now also lights up for as long as
// the dialog is actually open, and correctly turns off the moment it
// closes without needing any navigation.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { UtensilsCrossed, ClipboardList, Gift, User, ShoppingCart } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCartStore, selectTotalItems } from "@/store/cartStore";

export type ShellAuthState = "loading" | "authenticated" | "unauthenticated";

export default function BottomNavigation({
    authState,
    onAccountClick,
    accountOpen = false,
}: {
    authState: ShellAuthState;
    onAccountClick: () => void;
    accountOpen?: boolean;
}) {
    const pathname = usePathname();
    const totalItems = useCartStore(selectTotalItems);
    const ordersHref = authState === "authenticated" ? "/my-orders" : "/track-order";

    const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));
    const accountActive = pathname.startsWith("/account") || accountOpen;

    return (
        <nav
            className="fixed inset-x-3 z-50 lg:hidden"
            style={{ bottom: "calc(10px + var(--fk-safe-bottom))" }}
            aria-label="Main navigation"
        >
            <div className="flex h-[66px] items-center justify-around rounded-[26px] border border-fk-border bg-fk-surface-elevated/95 px-1 shadow-fk-lg backdrop-blur-xl">
                <NavTab href="/menu" icon={<UtensilsCrossed size={21} strokeWidth={1.7} />} label="Menu" active={isActive("/menu")} />
                <NavTab
                    href={ordersHref}
                    icon={<ClipboardList size={21} strokeWidth={1.7} />}
                    label="Orders"
                    active={isActive("/my-orders") || isActive("/track-order")}
                />
                <NavTab href="/cart" icon={<ShoppingCart size={21} strokeWidth={1.7} />} label="Cart" active={isActive("/cart")} badge={totalItems} />
                <NavTab href="/loyalty" icon={<Gift size={21} strokeWidth={1.7} />} label="Rewards" active={isActive("/loyalty")} />

                <button
                    onClick={onAccountClick}
                    aria-label="Account"
                    aria-pressed={accountOpen}
                    className="relative flex flex-1 flex-col items-center gap-1 py-1.5 transition-transform active:scale-95 motion-reduce:active:scale-100"
                >
                    <span
                        className={cn(
                            "flex h-[34px] w-[34px] items-center justify-center rounded-[13px] transition-all duration-200",
                            accountActive
                                ? "bg-gradient-to-br from-fk-gold-soft to-fk-surface-selected text-[var(--fk-accent)] ring-1 ring-[var(--fk-accent)]/25"
                                : "text-fk-text-secondary"
                        )}
                    >
                        <User size={21} strokeWidth={1.7} />
                    </span>
                    <span
                        className={cn(
                            "text-[9px] tracking-wide transition-colors",
                            accountActive ? "font-bold text-[var(--fk-accent)]" : "font-semibold text-fk-text-secondary"
                        )}
                    >
                        Account
                    </span>
                </button>
            </div>
        </nav>
    );
}

function NavTab({
    href,
    icon,
    label,
    active,
    badge,
}: {
    href: string;
    icon: React.ReactNode;
    label: string;
    active: boolean;
    badge?: number;
}) {
    return (
        <Link
            href={href}
            className="relative flex flex-1 flex-col items-center gap-1 py-1.5 transition-transform active:scale-95 motion-reduce:active:scale-100"
        >
            <span
                className={cn(
                    "relative flex h-[34px] w-[34px] items-center justify-center rounded-[13px] transition-all duration-200",
                    active
                        ? "bg-gradient-to-br from-fk-gold-soft to-fk-surface-selected text-[var(--fk-accent)] ring-1 ring-[var(--fk-accent)]/25"
                        : "text-fk-text-secondary"
                )}
            >
                {icon}
                {!!badge && badge > 0 && (
                    <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-fk-danger px-1 text-[9px] font-black text-white">
                        {badge > 9 ? "9+" : badge}
                    </span>
                )}
            </span>
            <span className={cn("text-[9px] tracking-wide transition-colors", active ? "font-bold text-[var(--fk-accent)]" : "font-semibold text-fk-text-secondary")}>
                {label}
            </span>
        </Link>
    );
}
