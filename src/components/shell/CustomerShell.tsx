"use client";

// src/components/shell/CustomerShell.tsx
//
// FoodKnock UI 2.0 — Phase 1: replaces src/components/shared/Navbar.tsx as
// the single stateful top-level customer-shell component. Owns exactly
// the same state/effects Navbar used to (combined GET /api/navbar fetch,
// scroll tracking, beforeinstallprompt capture, logout, notification/
// loyalty-changed event listeners) and composes the new presentational
// pieces: RotatingTicker, CustomerHeader, {children}, BottomNavigation,
// AccountDialog.
//
// IMPORTANT: fetchNavbarData() calling setIsLoggedIn() is load-bearing —
// src/store/authStore.ts's own header comment notes other components
// (e.g. ProductCard's guest-gated "Add to cart") read isLoggedIn as a
// cheap hint instead of firing their own fetch, treating `null` as
// optimistic-true. Dropping this call would silently break that gating,
// so it is preserved verbatim from the old Navbar.
//
// /auth renders bare children (no shell) — same shell-less behavior the
// pre-Phase-1 per-page layout gave it (auth/page.tsx never rendered
// <Navbar/>/<Footer/>).

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { useLocationStore } from "@/store/locationStore";
import { useCartStore, selectTotalItems } from "@/store/cartStore";
import { NOTIFICATIONS_CHANGED_EVENT } from "@/components/notifications/NotificationInbox";
import { LOYALTY_CHANGED_EVENT } from "@/lib/clientEvents";
import CustomerHeader from "./CustomerHeader";
import BottomNavigation from "./BottomNavigation";
import FloatingCart from "./FloatingCart";
import AccountDialog from "./AccountDialog";
import type { AuthUser, AuthState, BeforeInstallPromptEvent } from "./types";

// FoodKnock Phase 6 — removed a fourth ticker message ("4.9 Rated by
// Customers") that had no real data behind it anywhere in this
// component — it rotated site-wide, on every page that renders
// CustomerShell, regardless of whether FoodKnock actually had any
// reviews yet. The three remaining messages are all real, verifiable
// facts (FREE_DELIVERY_AT=339 — src/lib/delivery.ts — and real seasonal/
// menu promotions), consistent with the "no fake data" rule applied
// everywhere else.
const TICKER_MESSAGES = [
    { icon: "🚚", text: "Free Delivery on orders above ₹389" },
    { icon: "🍦", text: "Summer Ice Creams Available" },
    { icon: "🥘", text: "Fresh Thalis from ₹199" },

    { icon: "🍕", text: "Hot & Fresh Pizzas Made to Order" },
    { icon: "🍔", text: "Craving Burgers? We've Got You!" },
    { icon: "🍟", text: "Crispy Fries. Freshly Served." },
    { icon: "🍫", text: "Sweet Cravings? Treat Yourself Today" },
    { icon: "🔥", text: "Fresh Food. Packed Hot. Delivered Fast." },
    { icon: "⚡", text: "Order Now. Freshness in Minutes." },
    { icon: "❤️", text: "Made Fresh with Love at FoodKnock" },

    { icon: "🎁", text: "Earn Loyalty Points on Every Order" },
    { icon: "⭐", text: "Earn 10% Loyalty Points on Eligible Orders" },
    { icon: "💛", text: "Your Next Craving Is Just a Tap Away" },
    { icon: "🛍️", text: "Fresh Picks Waiting for You" },
    { icon: "😋", text: "Something Delicious Is Waiting for You" },

    { icon: "🍕", text: "Pizza Night Starts at FoodKnock" },
    { icon: "🍦", text: "Cool Down with Your Favourite Ice Creams" },
    { icon: "🥪", text: "Quick Bites for Every Craving" },
    { icon: "🍰", text: "Save Room for Something Sweet" },
    { icon: "🌶️", text: "Big Flavours. Freshly Prepared." },
    { icon: "✨", text: "Discover Something Delicious Today" },

    { icon: "📍", text: "Serving Fresh Food in Danta" },
    { icon: "🏠", text: "Your Local Food, Delivered to Your Door" },
    { icon: "👨‍🍳", text: "Prepared Fresh When You Order" },
    { icon: "🥡", text: "Packed Fresh for Every Order" },
    { icon: "🚀", text: "Fast Delivery. Fresh Food. Zero Hassle." },

    { icon: "💸", text: "Great Food at Prices You'll Love" },
    { icon: "🔥", text: "Popular Picks Are Selling Fast" },
    { icon: "👀", text: "See What's Trending Right Now" },
    { icon: "🧡", text: "FoodKnock — Fresh in Minute" },
    { icon: "🍽️", text: "Your Cravings. Our Kitchen. One Tap Away." },
];

function RotatingTicker() {
    const [index, setIndex] = useState(0);
    const [fade, setFade] = useState(true);

    useEffect(() => {
        const timer = setInterval(() => {
            setFade(false);
            setTimeout(() => {
                setIndex((i) => (i + 1) % TICKER_MESSAGES.length);
                setFade(true);
            }, 300);
        }, 3500);
        return () => clearInterval(timer);
    }, []);

    const msg = TICKER_MESSAGES[index];

    return (
        <div
            className="relative flex h-[34px] items-center justify-center overflow-hidden text-center text-[10.5px] font-semibold text-white"
            style={{ background: "linear-gradient(90deg, var(--fk-accent) 0%, var(--fk-gold) 50%, var(--fk-accent) 100%)" }}
        >
            <div className={`inline-flex items-center gap-1.5 transition-opacity duration-300 ${fade ? "opacity-100" : "opacity-0"}`}>
                <span className="text-[12px] leading-none">{msg.icon}</span>
                {msg.text}
            </div>
        </div>
    );
}

export default function CustomerShell({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const setIsLoggedIn = useAuthStore((s) => s.setIsLoggedIn);
    const setGlobalLoyaltyBalance = useAuthStore((s) => s.setLoyaltyBalance);
    const router = useRouter();
    // Must be called unconditionally, before the `/auth` early return below
    // — React requires every hook to run in the same order on every render,
    // and this component already early-returns for that one route.
    const totalCartItems = useCartStore(selectTotalItems);

    const [mounted, setMounted] = useState(false);
    const [scrolled, setScrolled] = useState(false);
    const [authState, setAuthState] = useState<AuthState>("loading");
    const [user, setUser] = useState<AuthUser | null>(null);
    const [loggingOut, setLoggingOut] = useState(false);
    const [sheetOpen, setSheetOpen] = useState(false);
    const [loyaltyBalance, setLoyaltyBalance] = useState<number | null>(null);
    const [unreadNotifications, setUnreadNotifications] = useState(0);
    const [pwaPrompt, setPwaPrompt] = useState<BeforeInstallPromptEvent | null>(null);

    const rafRef = useRef<number | null>(null);
    const lastScrollY = useRef(0);
    const fetchInFlight = useRef(false);

    const fetchNavbarData = useCallback(async () => {
        if (fetchInFlight.current) return;
        fetchInFlight.current = true;
        try {
            const res = await fetch("/api/navbar", { credentials: "include", cache: "no-store" });
            if (res.ok) {
                const data = await res.json();
                if (data.success && data.user) {
                    // Auth-gated location flow fix: reconcile the persisted
                    // location's owner against whoever the server says is
                    // ACTUALLY authenticated right now (never trust a
                    // client-side flag) — this is what stops a different
                    // account logging in on the same device from silently
                    // inheriting the previous account's delivery location,
                    // even across a session expiry that never went through
                    // an explicit logout click.
                    useLocationStore.getState().syncOwner(data.user.id);
                    setUser(data.user);
                    setAuthState("authenticated");
                    setIsLoggedIn(true);
                    {
                        const balance = typeof data.loyaltyBalance === "number" ? Math.max(0, Math.floor(data.loyaltyBalance)) : null;
                        setLoyaltyBalance(balance);
                        setGlobalLoyaltyBalance(balance);
                    }
                    setUnreadNotifications(typeof data.unreadNotifications === "number" ? data.unreadNotifications : 0);
                    try {
                        localStorage.setItem(
                            "cafeapp_user",
                            JSON.stringify({
                                name: data.user.name,
                                email: data.user.email,
                                phone: data.user.phone ?? "",
                                address: data.user.address ?? "",
                            })
                        );
                    } catch { }
                    return;
                }
            }
            // Confirmed by the server (not a network error — see the catch
            // block below, which is deliberately NOT treated the same way,
            // since a transient fetch failure doesn't mean the session is
            // actually gone and shouldn't wipe a legitimately logged-in
            // user's location over a flaky connection): there is no
            // authenticated user right now. Reconcile the location store
            // against "no owner" too, so an expired session's leftover
            // location never resurfaces for whoever uses this device next.
            useLocationStore.getState().syncOwner(null);
            setUser(null);
            setAuthState("unauthenticated");
            setIsLoggedIn(false);
            setLoyaltyBalance(null);
            setGlobalLoyaltyBalance(null);
            setUnreadNotifications(0);
            try { localStorage.removeItem("cafeapp_user"); } catch { }
        } catch {
            setUser(null);
            setAuthState("unauthenticated");
            setIsLoggedIn(false);
            setLoyaltyBalance(null);
            setGlobalLoyaltyBalance(null);
            setUnreadNotifications(0);
            try { localStorage.removeItem("cafeapp_user"); } catch { }
        } finally {
            fetchInFlight.current = false;
        }
    }, [setIsLoggedIn, setGlobalLoyaltyBalance]);

    useEffect(() => {
        setMounted(true);
        fetchNavbarData();

        const handleScroll = () => {
            if (rafRef.current) return;
            rafRef.current = requestAnimationFrame(() => {
                const currentY = window.scrollY;
                if (Math.abs(currentY - lastScrollY.current) > 8) {
                    setScrolled(currentY > 8);
                    lastScrollY.current = currentY;
                }
                rafRef.current = null;
            });
        };
        window.addEventListener("scroll", handleScroll, { passive: true });

        const pwaHandler = (e: Event) => {
            e.preventDefault();
            setPwaPrompt(e as BeforeInstallPromptEvent);
        };
        window.addEventListener("beforeinstallprompt", pwaHandler);

        return () => {
            window.removeEventListener("scroll", handleScroll);
            window.removeEventListener("beforeinstallprompt", pwaHandler);
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
        };
    }, [fetchNavbarData]);

    useEffect(() => {
        if (authState !== "authenticated") return;
        const handler = () => fetchNavbarData();
        window.addEventListener(NOTIFICATIONS_CHANGED_EVENT, handler);
        window.addEventListener(LOYALTY_CHANGED_EVENT, handler);
        return () => {
            window.removeEventListener(NOTIFICATIONS_CHANGED_EVENT, handler);
            window.removeEventListener(LOYALTY_CHANGED_EVENT, handler);
        };
    }, [authState, fetchNavbarData]);

    const handleLogout = useCallback(async () => {
        setLoggingOut(true);
        setSheetOpen(false);
        try { await fetch("/api/auth/logout", { method: "POST", credentials: "include" }); } catch { }
        try { localStorage.removeItem("cafeapp_user"); } catch { }
        setUser(null);
        setAuthState("unauthenticated");
        setLoyaltyBalance(null);
        setGlobalLoyaltyBalance(null);
        setUnreadNotifications(0);
        // Auth-gated location flow fix: locationStore persists to
        // localStorage with no awareness of auth state of its own (see its
        // own header comment) — without this, a previously-selected
        // delivery location would survive logout and be shown to the next
        // guest, or inherited by a different account signing in on the
        // same device. syncOwner(null) clears it immediately (synchronously,
        // before the isLoggedIn flip settles, and before the next
        // fetchNavbarData() call would otherwise reconcile it) — it also
        // aborts any in-flight serviceability fetch for it:
        // useActiveLocationServiceability's effect depends on `location`,
        // so setting it to null re-runs that effect's cleanup, which calls
        // AbortController.abort() on whatever request was in flight for
        // the now-cleared location.
        useLocationStore.getState().syncOwner(null);
        setLoggingOut(false);
        router.push("/");
        router.refresh();
    }, [router, setGlobalLoyaltyBalance]);

    const handleInstallPWA = useCallback(async () => {
        if (!pwaPrompt) return;
        try {
            await pwaPrompt.prompt();
            await pwaPrompt.userChoice;
        } catch { }
        setPwaPrompt(null);
    }, [pwaPrompt]);

    // auth/page.tsx is intentionally shell-less — same behavior as the
    // pre-Phase-1 per-page layout, which never rendered <Navbar/>/<Footer/>
    // on this route.
    if (pathname === "/auth") {
        return <>{children}</>;
    }

    // Pre-Phase 17 Phase 4 — FloatingCart previously rendered unconditionally
    // on every route, including /cart and /checkout, where the page already
    // IS the cart/checkout interface — a floating "View cart" pill hovering
    // over the cart page itself was duplicate UI. Centralized here (one
    // pathname check, not scattered across pages) rather than each page
    // needing to know about FloatingCart's existence.
    // Spin & Eat reliability audit — FloatingCart is a fixed, z-40 pill.
    // When the user has cart items AND is on the Spin deep-link state, the
    // Spin section's CTA/wheel area can scroll into the same fixed screen
    // band FloatingCart occupies, visually covering AND intercepting taps
    // on an interactive control — a real, reproducible root cause of
    // "Spin button does nothing" on mobile. Scoped to exactly the Spin tab
    // (not all of /loyalty — Rewards doesn't have this dense a bottom
    // interactive area), using the SAME centralized hide-list pattern
    // already established for /cart and /checkout above.
    // Final customer-pages polish — real-device screenshots showed
    // FloatingCart (a sizeable fixed pill, ~56px tall + safe-area, sitting
    // just above BottomNavigation) visually covering Footer links on
    // content-heavy informational pages (/terms, /privacy, /founders —
    // and by the same reasoning, every other read-only/reference/
    // management page below). This is a route-policy fix, not a z-index
    // fix: the pill was never WRONGLY layered, it's simply the wrong
    // AFFORDANCE on a page the customer is reading, not shopping on.
    // Hiding it never removes cart access — BottomNavigation's own Cart
    // tab (MENU | ORDERS | CART | REWARDS | ACCOUNT) is always present and
    // unaffected by this list.
    //
    // Policy — kept ONLY on active shopping/discovery surfaces where a
    // floating "view cart" affordance genuinely helps complete an order
    // in progress:
    //   /            (Home)
    //   /menu, /menu/[slug]
    // Hidden everywhere else: /cart + /checkout (pre-existing — the page
    // itself IS the cart/checkout UI), the Spin tab of /loyalty
    // (pre-existing — a real reproducible tap-interception bug), and now
    // every informational/reference page (legal, founders, contact,
    // reviews, review-rewards, notifications) plus order-history/
    // tracking/account/account-adjacent pages, where the customer is
    // reading or managing something, not actively building a cart.
    const hideFloatingCart =
        pathname.startsWith("/cart") ||
        pathname.startsWith("/checkout") ||
        (pathname.startsWith("/loyalty") && searchParams.get("tab") === "spin") ||
        pathname.startsWith("/privacy") ||
        pathname.startsWith("/terms") ||
        pathname.startsWith("/founders") ||
        pathname.startsWith("/contact") ||
        pathname.startsWith("/reviews") ||
        pathname.startsWith("/review-rewards") ||
        pathname.startsWith("/notifications") ||
        pathname.startsWith("/track-order") ||
        pathname.startsWith("/order-success") ||
        pathname.startsWith("/account") ||
        pathname.startsWith("/my-orders") ||
        pathname.startsWith("/campaigns");

    // GLOBAL FOOTER/LAYOUT FIX — FloatingCart is a SECOND fixed element
    // (above BottomNavigation) that can be visible at the same time as a
    // page's own Footer, on exactly the routes NOT in hideFloatingCart's
    // list above (Home, /menu, /menu/[slug], and /loyalty outside its Spin
    // tab) whenever the cart actually has items. The global bottom-padding
    // reservation in src/app/layout.tsx only ever accounts for
    // BottomNavigation's own footprint (--fk-bottom-nav-clearance) — it
    // has no way to know, at that outer layout level, whether THIS
    // specific route will also stack FloatingCart above it. Without this,
    // FloatingCart's own extra ~66px reach would sit directly over the
    // last ~66px of Footer's content exactly when the cart is non-empty —
    // the reported "floating cart bar overlapping footer links" bug.
    // Reading cart state here (gated on `mounted`, same SSR-safety pattern
    // FloatingCart.tsx and CustomerHeader.tsx already use for cart/auth
    // state) lets this extra clearance apply ONLY when actually needed —
    // zero added padding on every other route, and zero added padding on
    // these same routes whenever the cart is empty.
    const floatingCartVisible = mounted && !hideFloatingCart && totalCartItems > 0;

    // CART + CHECKOUT PREMIUM LAYOUT FIX — /cart and /checkout hide
    // FloatingCart (they're both in hideFloatingCart's list above) but
    // each renders its OWN page-local sticky action bar instead
    // (MobileCheckoutBar / CheckoutStickyBar) under the exact same
    // `items.length > 0` condition, stacked above --fk-bottom-nav-clearance
    // the same way FloatingCart is. Those two bars already reserve the
    // correct clearance for their own page's main content (their pb-[...]
    // literal was replaced with the same shared chain as part of this same
    // fix), but nothing previously reserved any EXTRA space after Footer
    // for them specifically — Footer sat only --fk-bottom-nav-clearance
    // above BottomNavigation, with the sticky bar's own ~76px additional
    // reach landing almost directly on top of it, reading as "cramped."
    // `totalCartItems` is the exact same store value — and the exact same
    // `items.length > 0` condition — both page components themselves use
    // to decide whether to render their own bar, so this can never
    // disagree with whether the bar is actually on screen.
    const stickyActionBarVisible =
        mounted && (pathname.startsWith("/cart") || pathname.startsWith("/checkout")) && totalCartItems > 0;
    const extraBottomClearanceVar = floatingCartVisible
        ? "var(--fk-floating-cart-extra-clearance)"
        : stickyActionBarVisible
            ? "var(--fk-sticky-actionbar-extra-clearance)"
            : null;

    return (
        <>
            <RotatingTicker />
            <CustomerHeader
                authState={authState}
                user={user}
                loyaltyBalance={loyaltyBalance}
                unreadNotifications={unreadNotifications}
                loggingOut={loggingOut}
                mounted={mounted}
                scrolled={scrolled}
                onLogout={handleLogout}
            />

            <div
                style={extraBottomClearanceVar ? { paddingBottom: extraBottomClearanceVar } : undefined}
            >
                {children}
            </div>

            {!hideFloatingCart && <FloatingCart />}
            <BottomNavigation authState={authState} onAccountClick={() => setSheetOpen(true)} accountOpen={sheetOpen} />

            <AccountDialog
                open={sheetOpen}
                onClose={() => setSheetOpen(false)}
                authState={authState}
                user={user}
                loggingOut={loggingOut}
                onLogout={handleLogout}
                loyaltyBalance={loyaltyBalance}
                pwaPrompt={pwaPrompt}
                onInstallPWA={handleInstallPWA}
            />
        </>
    );
}
