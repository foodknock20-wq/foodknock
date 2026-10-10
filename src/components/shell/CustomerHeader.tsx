"use client";

// src/components/shell/CustomerHeader.tsx
//
// FoodKnock UI 2.0 — Phase 1: dark restyle of the header that used to live
// inside src/components/shared/Navbar.tsx. One base component with a
// `variant` prop instead of five duplicated header files (spec section
// 14). Every existing page keeps the "default" variant in this phase
// (same content/behavior as before, just restyled) — "minimal"/"back" are
// wired and available for Phase 2+ to use on specific routes without
// adding another header component.
//
// All auth/scroll/PWA state is owned by the parent CustomerShell and
// passed down as props — this component is purely presentational plus
// routing links, exactly mirroring how the pre-Phase-1 Navbar split
// state (top-level) from rendering (JSX below).

import Link from "next/link";
import {
    ShoppingCart, LogOut, Loader2, LayoutDashboard, User, Star, Bell, ArrowLeft,
} from "lucide-react";
import { useCartStore, selectTotalItems } from "@/store/cartStore";
import LocationTrigger from "./LocationTrigger";
import { getPreferredAuthMode } from "@/lib/authDeviceMemory";
import type { AuthUser, AuthState } from "./types";

const LOGO_SRC = "/logo/logo.jpg";

function getFirstName(name: string): string {
    return name.split(" ")[0] ?? name;
}

function Avatar({ name }: { name: string }) {
    return (
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-fk-sm bg-gradient-to-br from-[var(--fk-accent)] to-[var(--fk-gold)] text-[13px] font-bold text-white">
            {getFirstName(name)[0].toUpperCase()}
        </span>
    );
}

// Pre-Phase 17 Phase 4 — premium mobile profile button. Reuses the SAME
// /account destination the desktop avatar (renderDesktopAuth, below)
// already links to — no new route, no second "My Account" system. Always
// visible regardless of auth state (unlike the loyalty/notification
// icons, which only make sense once signed in): a logged-out tap routes
// to sign-in, exactly like BottomNavigation's always-visible Account tab.
function ProfileButton({ authState, user, authHref }: { authState: AuthState; user: AuthUser | null; authHref: string }) {
    if (authState === "loading") {
        return (
            <span className="flex h-9 w-9 items-center justify-center rounded-fk-md border border-fk-border bg-fk-surface-elevated">
                <Loader2 size={14} className="animate-spin text-fk-gold" />
            </span>
        );
    }

    if (authState === "authenticated" && user) {
        return (
            <Link
                href="/account"
                aria-label="My Account"
                title="My Account"
                className="flex h-9 w-9 items-center justify-center rounded-fk-md border border-fk-border bg-fk-surface-elevated shadow-sm transition-all active:scale-95 hover:border-[var(--fk-accent)]/40"
            >
                <Avatar name={user.name} />
            </Link>
        );
    }

    return (
        <Link
            href={authHref}
            aria-label="Sign in to FoodKnock"
            title="Sign in"
            className="flex h-9 w-9 items-center justify-center rounded-fk-md border border-fk-border bg-fk-surface-elevated text-fk-text-secondary shadow-sm transition-all active:scale-95 hover:text-[var(--fk-accent)]"
        >
            <User size={17} strokeWidth={2} />
        </Link>
    );
}

export interface CustomerHeaderProps {
    variant?: "default" | "minimal" | "back";
    backHref?: string;
    title?: string;
    authState: AuthState;
    user: AuthUser | null;
    loyaltyBalance: number | null;
    unreadNotifications: number;
    loggingOut: boolean;
    mounted: boolean;
    scrolled: boolean;
    onLogout: () => void;
}

export default function CustomerHeader({
    variant = "default",
    backHref = "/",
    title,
    authState,
    user,
    loyaltyBalance,
    unreadNotifications,
    loggingOut,
    mounted,
    scrolled,
    onLogout,
}: CustomerHeaderProps) {
    const totalItems = useCartStore(selectTotalItems);
    const count = mounted ? totalItems : 0;

    // AUTH 2.0 — smart "Sign in to FoodKnock" routing. `mounted` is the
    // same existing SSR-safe flag `count` above already relies on (false
    // during SSR/first paint, true after mount) — reused here instead of
    // adding a second effect, since getPreferredAuthMode() reads
    // localStorage and must never run during SSR or the initial
    // hydration pass (see src/lib/authDeviceMemory.ts).
    const authHref = mounted ? `/auth?mode=${getPreferredAuthMode()}` : "/auth?mode=signup";

    const renderDesktopAuth = () => {
        if (authState === "loading") {
            return (
                <div className="flex h-9 w-9 items-center justify-center">
                    <Loader2 size={15} className="animate-spin text-fk-gold" />
                </div>
            );
        }
        if (authState === "authenticated" && user) {
            return (
                <div className="flex items-center gap-2">
                    {user.role === "admin" && (
                        <Link
                            href="/admin"
                            className="flex items-center gap-1.5 rounded-fk-md border border-fk-border bg-fk-surface-selected px-3 py-1.5 text-[11px] font-bold text-fk-gold transition-colors hover:brightness-110"
                        >
                            <LayoutDashboard size={11} />
                            Admin
                        </Link>
                    )}
                    <Link
                        href="/account"
                        aria-label="My Account"
                        title="My Account"
                        className="flex items-center gap-2 rounded-fk-md border border-fk-border bg-fk-surface-elevated px-3 py-1.5 transition-all hover:bg-fk-surface-interactive"
                    >
                        <Avatar name={user.name} />
                        <span className="text-[13px] font-semibold text-fk-text">{getFirstName(user.name)}</span>
                        {loyaltyBalance !== null && loyaltyBalance > 0 && (
                            <div className="ml-1 flex items-center gap-1 rounded-fk-sm border border-fk-border bg-fk-surface-selected px-2 py-0.5">
                                <Star size={10} className="text-fk-gold" fill="currentColor" />
                                <span className="text-[11px] font-black text-[var(--fk-accent)]">{loyaltyBalance}</span>
                            </div>
                        )}
                    </Link>
                    <Link
                        href="/notifications"
                        aria-label={`Notifications${unreadNotifications > 0 ? `, ${unreadNotifications} unread` : ""}`}
                        className="relative flex h-9 w-9 items-center justify-center rounded-fk-md border border-fk-border bg-fk-surface-elevated text-fk-text-secondary transition-all hover:text-[var(--fk-accent)]"
                    >
                        <Bell size={15} strokeWidth={2} />
                        {unreadNotifications > 0 && (
                            <span className="absolute -right-1 -top-1 flex h-[17px] min-w-[17px] items-center justify-center rounded-full bg-fk-danger px-1 text-[9px] font-black text-white">
                                {unreadNotifications > 9 ? "9+" : unreadNotifications}
                            </span>
                        )}
                    </Link>
                    <button
                        onClick={onLogout}
                        disabled={loggingOut}
                        aria-label="Logout"
                        className="flex h-9 w-9 items-center justify-center rounded-fk-md border border-fk-border bg-fk-surface-elevated text-fk-text-secondary transition-all hover:border-fk-danger/40 hover:text-fk-danger"
                    >
                        {loggingOut ? <Loader2 size={13} className="animate-spin" /> : <LogOut size={13} />}
                    </button>
                </div>
            );
        }
        return (
            <Link
                href={authHref}
                className="flex items-center gap-1.5 rounded-fk-md border border-fk-border bg-fk-surface-elevated px-4 py-2 text-[13px] font-semibold text-fk-text-secondary transition-all hover:text-[var(--fk-accent)]"
            >
                <User size={13} />
                Sign In
            </Link>
        );
    };

    return (
        <header
            className={
                "sticky top-0 z-40 border-b transition-all duration-300 " +
                (scrolled ? "border-fk-border bg-fk-bg/97 shadow-[0_2px_16px_rgba(28,25,23,0.08)] backdrop-blur-xl" : "border-transparent bg-fk-bg/90 backdrop-blur-md")
            }
            style={{ paddingTop: "var(--fk-safe-top)" }}
        >
            <div className="mx-auto flex h-[58px] max-w-7xl items-center justify-between px-3 sm:px-4 md:px-6 lg:px-8 lg:h-16">
                {variant === "back" ? (
                    <Link href={backHref} aria-label="Go back" className="flex items-center gap-3">
                        <span className="flex h-9 w-9 items-center justify-center rounded-fk-md bg-fk-surface-elevated text-fk-text">
                            <ArrowLeft size={17} />
                        </span>
                        {title && <span className="truncate text-[15px] font-bold text-fk-text">{title}</span>}
                    </Link>
                ) : (
                    <Link href="/" className="flex items-center gap-2" aria-label="FoodKnock Home">
                        <div className="relative h-[34px] w-[34px] shrink-0 overflow-hidden rounded-fk-sm shadow-md shadow-black/15 lg:h-9 lg:w-9">
                            <img src={LOGO_SRC} alt="FoodKnock" width={36} height={36} fetchPriority="high" className="h-full w-full object-cover" />
                        </div>
                        <div className="leading-none">
                            <p className="font-display text-[1.05rem] font-extrabold tracking-tight text-fk-text">FoodKnock</p>
                            <p className="mt-px text-[7.5px] font-bold uppercase tracking-[0.18em] text-[var(--fk-accent)] sm:text-[9px]">
                                Fresh in Minutes
                            </p>
                        </div>
                    </Link>
                )}

                {variant === "default" && (
                    <nav className="hidden items-center gap-1 lg:flex" aria-label="Main navigation">
                        <Link href="/" className="rounded-fk-md px-4 py-2 text-[13.5px] font-medium text-fk-text-secondary transition-all hover:bg-fk-surface-interactive hover:text-fk-text">Home</Link>
                        <Link href="/menu" className="rounded-fk-md px-4 py-2 text-[13.5px] font-medium text-fk-text-secondary transition-all hover:bg-fk-surface-interactive hover:text-fk-text">Menu</Link>
                        <Link href="/review-rewards" className="rounded-fk-md px-4 py-2 text-[13.5px] font-medium text-fk-text-secondary transition-all hover:bg-fk-surface-interactive hover:text-fk-text">Review Rewards</Link>
                        <Link href="/loyalty" className="rounded-fk-md px-4 py-2 text-[13.5px] font-medium text-fk-text-secondary transition-all hover:bg-fk-surface-interactive hover:text-fk-text">Rewards</Link>
                        <Link
                            href={authState === "authenticated" ? "/my-orders" : "/track-order"}
                            className="rounded-fk-md px-4 py-2 text-[13.5px] font-medium text-fk-text-secondary transition-all hover:bg-fk-surface-interactive hover:text-fk-text"
                        >
                            {authState === "authenticated" ? "My Orders" : "Track Order"}
                        </Link>
                        <Link href="/contact" className="rounded-fk-md px-4 py-2 text-[13.5px] font-medium text-fk-text-secondary transition-all hover:bg-fk-surface-interactive hover:text-fk-text">Contact</Link>
                    </nav>
                )}

                <div className="flex items-center gap-1.5 sm:gap-2">
                    {variant === "default" && (
                        <div className="hidden lg:flex lg:items-center lg:gap-2">
                            <LocationTrigger isLoggedIn={authState === "authenticated"} variant="chip" />
                            {renderDesktopAuth()}
                        </div>
                    )}

                    <div className="flex items-center gap-1.5 lg:hidden">
                        {authState === "authenticated" && loyaltyBalance !== null && loyaltyBalance > 0 && (
                            <Link
                                href="/loyalty"
                                aria-label={`${loyaltyBalance} FoodKnock points`}
                                className="flex h-9 items-center gap-1 rounded-fk-md border border-fk-border bg-fk-gold-soft px-2 text-[11px] font-black text-fk-gold"
                            >
                                <Star size={12} className="fill-fk-gold text-fk-gold" />
                                {loyaltyBalance}
                            </Link>
                        )}
                        {authState === "authenticated" && (
                            <Link
                                href="/notifications"
                                aria-label={`Notifications${unreadNotifications > 0 ? `, ${unreadNotifications} unread` : ""}`}
                                className="relative flex h-9 w-9 items-center justify-center rounded-fk-md border border-fk-border bg-fk-surface-elevated text-fk-text-secondary transition-all hover:text-[var(--fk-accent)]"
                            >
                                <Bell size={17} strokeWidth={2} />
                                {unreadNotifications > 0 && (
                                    <span className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-fk-danger px-1 text-[9px] font-black text-white">
                                        {unreadNotifications > 9 ? "9+" : unreadNotifications}
                                    </span>
                                )}
                            </Link>
                        )}
                        {/* Pre-Phase 17 Phase 4 — the mobile top-header Cart icon
                            that used to sit here is removed: Cart is already
                            prominently available via BottomNavigation (mobile-
                            only, `lg:hidden`), so a second cart entry point here
                            was duplicate UI. Desktop has NO bottom navigation,
                            so its header Cart icon below is intentionally kept —
                            it's the only cart entry point at that breakpoint.
                            A premium profile button takes this slot instead,
                            reusing the existing /account destination (same one
                            the desktop avatar below already links to) — no new
                            account/profile route, no duplicate "My Account". */}
                        <ProfileButton authState={authState} user={user} authHref={authHref} />
                    </div>

                    <Link
                        href="/cart"
                        aria-label={`Cart, ${count} items`}
                        className="relative hidden h-10 w-10 items-center justify-center rounded-fk-md border border-fk-border bg-fk-surface-elevated text-fk-text-secondary transition-all hover:text-[var(--fk-accent)] lg:flex"
                    >
                        <ShoppingCart size={18} strokeWidth={2} />
                        {count > 0 && (
                            <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-fk-danger text-[10px] font-black text-white">
                                {count > 9 ? "9+" : count}
                            </span>
                        )}
                    </Link>
                </div>
            </div>

            {variant === "default" && (
                <div className="lg:hidden">
                    <LocationTrigger isLoggedIn={authState === "authenticated"} variant="bar" />
                </div>
            )}
        </header>
    );
}
