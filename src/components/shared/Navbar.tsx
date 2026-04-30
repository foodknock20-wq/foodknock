"use client";

// src/components/shared/Navbar.tsx
// FoodKnock — Premium mobile-first navbar with rotating ticker, smart header, floating bottom nav
// PATCH: Logo Next/Image replaced with native img + cdnImage — zero Vercel image optimizer usage

import Link from "next/link";
import {
    ShoppingCart, LogOut, Loader2, LayoutDashboard,
    UtensilsCrossed, User, Star, Phone, ChevronRight, X,
    ClipboardList, Home, Gift, LogIn, Award, MessageSquare,
    Download, Zap,
} from "lucide-react";
import { useCartStore } from "@/store/cartStore";
import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { cdnImage } from "@/lib/cdnImage";

// ─── Types ────────────────────────────────────────────────────────────────
type AuthUser = {
    id: string;
    name: string;
    email: string;
    role: string;
    phone?: string;
    address?: string;
};
type AuthState = "loading" | "authenticated" | "unauthenticated";

interface BeforeInstallPromptEvent extends Event {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

// ─── Constants ────────────────────────────────────────────────────────────
const baseNavLinks = [
    { href: "/", label: "Home" },
    { href: "/menu", label: "Menu" },
    { href: "/review-rewards", label: "Review Rewards" },
    { href: "/loyalty", label: "Rewards" },
    { href: "/contact", label: "Contact" },
];

const TICKER_MESSAGES = [
    { icon: "🚚", text: "Free Delivery on orders above ₹339" },
    { icon: "🍦", text: "Summer Ice Creams Available" },
    { icon: "🥘", text: "Fresh Thalis from ₹149" },
    { icon: "⭐", text: "4.9 Rated by Customers" },
];

const DISMISS_KEY = "fk_pwa_dismissed_v1";

// PATCH: logo is a local static file — cdnImage will return it as-is (non-Cloudinary).
// Using native <img> eliminates the Vercel /_next/image optimizer call entirely.
const LOGO_SRC = "/logo/logo.jpg";

function getFirstName(name: string): string {
    return name.split(" ")[0] ?? name;
}

function Avatar({ name, size = "sm" }: { name: string; size?: "sm" | "lg" }) {
    const dim = size === "lg" ? "h-12 w-12 text-base" : "h-8 w-8 text-[13px]";
    return (
        <span
            className={`inline-flex items-center justify-center rounded-xl font-bold text-white ${dim}`}
            style={{ background: "linear-gradient(135deg, #FF5C1A 0%, #FFB347 100%)" }}
        >
            {getFirstName(name)[0].toUpperCase()}
        </span>
    );
}

// ─── Rotating Ticker ──────────────────────────────────────────────────────
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
            className="relative overflow-hidden text-center font-semibold text-white"
            style={{
                background: "linear-gradient(90deg, #FF5C1A 0%, #FF8C42 50%, #FF5C1A 100%)",
                height: "34px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "10.5px",
            }}
        >
            <div
                className={`inline-flex items-center gap-1.5 transition-opacity duration-300 ${fade ? "opacity-100" : "opacity-0"}`}
            >
                <span className="text-[12px] leading-none">{msg.icon}</span>
                {msg.text}
            </div>
            <div
                className="pointer-events-none absolute inset-0"
                style={{
                    background: "linear-gradient(105deg, transparent 30%, rgba(255,255,255,0.15) 50%, transparent 70%)",
                    animation: "shimmer 3s infinite",
                }}
            />
        </div>
    );
}

// ─── Account Bottom Sheet ─────────────────────────────────────────────────
function AccountSheet({
    open,
    onClose,
    authState,
    user,
    loggingOut,
    onLogout,
    loyaltyBalance,
    pwaPrompt,
    onInstallPWA,
}: {
    open: boolean;
    onClose: () => void;
    authState: AuthState;
    user: AuthUser | null;
    loggingOut: boolean;
    onLogout: () => void;
    loyaltyBalance: number | null;
    pwaPrompt: BeforeInstallPromptEvent | null;
    onInstallPWA: () => void;
}) {
    const sheetRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) return;
        const handler = (e: MouseEvent) => {
            if (sheetRef.current && !sheetRef.current.contains(e.target as Node)) {
                onClose();
            }
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, [open, onClose]);

    useEffect(() => {
        if (open) {
            document.body.style.overflow = "hidden";
        } else {
            document.body.style.overflow = "";
        }
        return () => { document.body.style.overflow = ""; };
    }, [open]);

    const showPWA = pwaPrompt && !window.matchMedia("(display-mode: standalone)").matches && !sessionStorage.getItem(DISMISS_KEY);

    return (
        <>
            <div
                className={`fixed inset-0 z-[60] transition-all duration-300 lg:hidden ${open ? "pointer-events-auto bg-black/40 backdrop-blur-sm" : "pointer-events-none bg-transparent"}`}
                aria-hidden="true"
            />

            <div
                ref={sheetRef}
                className={`fixed bottom-0 left-0 right-0 z-[70] rounded-t-3xl transition-transform duration-[350ms] ease-[cubic-bezier(0.34,1.1,0.64,1)] lg:hidden ${open ? "translate-y-0" : "translate-y-full"}`}
                style={{
                    background: "linear-gradient(160deg, #fdfaf6 0%, #fffaf4 100%)",
                    boxShadow: "0 -8px 40px rgba(0,0,0,0.18), 0 -1px 0 rgba(255,92,26,0.15)",
                    paddingBottom: "calc(80px + env(safe-area-inset-bottom, 0px))",
                }}
                aria-modal="true"
                role="dialog"
            >
                <div className="flex justify-center pt-3 pb-1">
                    <div className="h-1 w-10 rounded-full bg-stone-200" />
                </div>

                <button
                    onClick={onClose}
                    aria-label="Close account hub"
                    className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-xl bg-stone-100 text-stone-400 transition-colors hover:bg-stone-200"
                >
                    <X size={15} />
                </button>

                <div className="px-5 pb-2 pt-3">
                    <h2 className="mb-4 text-base font-black text-stone-900">FoodKnock Account Center</h2>

                    {authState === "loading" && (
                        <div className="flex justify-center py-6">
                            <Loader2 size={20} className="animate-spin text-amber-400" />
                        </div>
                    )}

                    {authState === "authenticated" && user && (
                        <div className="mb-5 rounded-2xl border border-orange-100 bg-gradient-to-br from-orange-50 to-amber-50 px-4 py-4">
                            <div className="flex items-center gap-3.5">
                                <Avatar name={user.name} size="lg" />
                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-[15px] font-bold text-stone-900">{user.name}</p>
                                    <p className="truncate text-[11px] text-stone-400">{user.email}</p>
                                </div>
                            </div>
                            {loyaltyBalance !== null && loyaltyBalance > 0 && (
                                <div className="mt-3 flex items-center gap-2 rounded-xl border border-amber-200 bg-white/60 px-3 py-2">
                                    <Star size={14} className="text-amber-500" fill="currentColor" />
                                    <span className="text-sm font-black text-orange-600">{loyaltyBalance} pts</span>
                                    <span className="text-[11px] text-stone-400">available</span>
                                </div>
                            )}
                        </div>
                    )}

                    {authState === "unauthenticated" && (
                        <Link
                            href="/auth"
                            onClick={onClose}
                            className="mb-5 flex items-center justify-between rounded-2xl border px-4 py-4"
                            style={{
                                background: "linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%)",
                                borderColor: "rgba(255,92,26,0.18)",
                            }}
                        >
                            <div className="flex items-center gap-3">
                                <div
                                    className="flex h-10 w-10 items-center justify-center rounded-xl"
                                    style={{ background: "linear-gradient(135deg, #FF5C1A 0%, #FFB347 100%)" }}
                                >
                                    <LogIn size={17} className="text-white" />
                                </div>
                                <div>
                                    <p className="text-[14px] font-bold text-stone-900">Sign in to FoodKnock</p>
                                    <p className="text-[11px] text-stone-400">Track orders &amp; earn rewards</p>
                                </div>
                            </div>
                            <ChevronRight size={16} className="text-orange-400" />
                        </Link>
                    )}

                    <div className="space-y-2">
                        {authState === "authenticated" && user?.role === "admin" && (
                            <SheetRow
                                href="/admin"
                                icon={<LayoutDashboard size={15} />}
                                label="Admin Panel"
                                accent="amber"
                                onClick={onClose}
                            />
                        )}
                        <SheetRow
                            href="/review-rewards"
                            icon={<MessageSquare size={15} />}
                            label="Review Rewards"
                            onClick={onClose}
                        />
                        <SheetRow
                            href="/review"
                            icon={<MessageSquare size={15} />}
                            label="Write a Review"
                            onClick={onClose}
                        />
                        <SheetRow
                            href="/contact"
                            icon={<Phone size={15} />}
                            label="Contact Us"
                            onClick={onClose}
                        />
                        {showPWA && (
                            <button
                                onClick={() => {
                                    onInstallPWA();
                                    onClose();
                                }}
                                className="flex w-full items-center justify-between rounded-2xl border border-violet-100 bg-violet-50 px-4 py-3.5 text-[14px] font-semibold text-violet-700 transition-colors hover:bg-violet-100"
                            >
                                <div className="flex items-center gap-3">
                                    <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet-100 text-violet-600">
                                        <Download size={15} />
                                    </span>
                                    Install App
                                </div>
                                <ChevronRight size={14} className="text-stone-300" />
                            </button>
                        )}
                    </div>

                    {authState === "authenticated" && (
                        <button
                            onClick={onLogout}
                            disabled={loggingOut}
                            className="mt-4 flex w-full items-center gap-3 rounded-2xl border border-red-100 bg-red-50 px-4 py-3.5 text-[13.5px] font-semibold text-red-500 transition-all hover:bg-red-100 disabled:opacity-50"
                        >
                            {loggingOut ? <Loader2 size={15} className="animate-spin" /> : <LogOut size={15} />}
                            Logout
                        </button>
                    )}

                    <p className="mt-5 text-center text-[10px] text-stone-400">
                        Fresh made daily • Secure ordering
                    </p>
                </div>
            </div>
        </>
    );
}

function SheetRow({
    href,
    icon,
    label,
    accent,
    onClick,
}: {
    href: string;
    icon: React.ReactNode;
    label: string;
    accent?: "amber";
    onClick: () => void;
}) {
    const accentStyle = accent === "amber"
        ? "bg-amber-50 border-amber-100 text-amber-700"
        : "bg-white border-stone-100 text-stone-700";

    return (
        <Link
            href={href}
            onClick={onClick}
            className={`flex items-center justify-between rounded-2xl border px-4 py-3.5 text-[14px] font-semibold transition-colors hover:bg-orange-50 ${accentStyle}`}
        >
            <div className="flex items-center gap-3">
                <span className={`flex h-8 w-8 items-center justify-center rounded-xl ${accent === "amber" ? "bg-amber-100 text-amber-600" : "bg-stone-100 text-stone-500"}`}>
                    {icon}
                </span>
                {label}
            </div>
            <ChevronRight size={14} className="text-stone-300" />
        </Link>
    );
}

// ─── Bottom Nav ───────────────────────────────────────────────────────────
function BottomNav({
    authState,
    totalItems,
    mounted,
    onAccountClick,
}: {
    authState: AuthState;
    totalItems: number;
    mounted: boolean;
    onAccountClick: () => void;
}) {
    const pathname = usePathname();
    const ordersHref = authState === "authenticated" ? "/my-orders" : "/track-order";

    const isActive = (href: string) => {
        if (href === "/") return pathname === "/";
        return pathname.startsWith(href);
    };

    const accountActive = pathname.startsWith("/account");

    return (
        <nav
            className="fixed bottom-0 left-0 right-0 z-50 lg:hidden"
            style={{
                background: "rgba(255,251,245,0.98)",
                backdropFilter: "blur(24px)",
                WebkitBackdropFilter: "blur(24px)",
                borderTop: "1px solid rgba(245,158,11,0.12)",
                boxShadow: "0 -4px 32px rgba(0,0,0,0.10), 0 -1px 0 rgba(255,255,255,0.8) inset",
                paddingBottom: "env(safe-area-inset-bottom, 0px)",
            }}
            aria-label="Main navigation"
        >
            <div className="flex h-[68px] items-center justify-around px-1">
                <BottomNavTab href="/menu" icon={<UtensilsCrossed size={21} strokeWidth={1.7} />} label="Menu" active={isActive("/menu")} />
                <BottomNavTab href={ordersHref} icon={<ClipboardList size={21} strokeWidth={1.7} />} label="Orders" active={isActive("/my-orders") || isActive("/track-order")} />

                {/* Hero Cart Button */}
                <Link
                    href="/cart"
                    aria-label={`Cart, ${mounted ? totalItems : 0} items`}
                    className="relative -mt-6 flex flex-col items-center"
                >
                    <span
                        className="flex h-[54px] w-[54px] items-center justify-center rounded-[18px] text-white transition-transform active:scale-95"
                        style={{
                            background: "linear-gradient(140deg, #FF5C1A 0%, #FF8C42 100%)",
                            boxShadow: "0 8px 24px rgba(255,92,26,0.45), 0 2px 8px rgba(255,92,26,0.2)",
                        }}
                    >
                        <ShoppingCart size={22} strokeWidth={2} />
                        {mounted && totalItems > 0 && (
                            <span
                                className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-black text-white"
                                style={{
                                    background: "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
                                    boxShadow: "0 2px 8px rgba(239,68,68,0.55)",
                                }}
                            >
                                {totalItems > 9 ? "9+" : totalItems}
                            </span>
                        )}
                    </span>
                    <span
                        className="mt-1.5 text-[9px] font-bold uppercase tracking-wider"
                        style={{ color: mounted && totalItems > 0 ? "#FF5C1A" : "#78716c" }}
                    >
                        {mounted && totalItems > 0 ? `${totalItems} item${totalItems !== 1 ? "s" : ""}` : "Cart"}
                    </span>
                </Link>

                <BottomNavTab href="/loyalty" icon={<Gift size={21} strokeWidth={1.7} />} label="Rewards" active={isActive("/loyalty")} />

                {/* Account Tab */}
                <button
                    onClick={onAccountClick}
                    className="relative flex flex-col items-center gap-0 px-2 py-1"
                    aria-label="Account"
                >
                    {accountActive && (
                        <span
                            className="absolute -top-1.5 left-1/2 h-[3px] w-6 -translate-x-1/2 rounded-full"
                            style={{ background: "linear-gradient(90deg, #FF5C1A, #FF8C42)" }}
                        />
                    )}
                    <span
                        className={`flex h-8 w-8 items-center justify-center rounded-xl transition-all ${accountActive ? "text-orange-500" : "text-stone-500"}`}
                        style={accountActive ? {
                            background: "rgba(255,92,26,0.10)",
                        } : {}}
                    >
                        <User size={21} strokeWidth={1.7} />
                    </span>
                    <span
                        className="text-[9px] font-bold uppercase tracking-wider"
                        style={{ color: accountActive ? "#FF5C1A" : "#57534e" }}
                    >
                        Account
                    </span>
                </button>
            </div>
        </nav>
    );
}

function BottomNavTab({ href, icon, label, active }: { href: string; icon: React.ReactNode; label: string; active: boolean }) {
    return (
        <Link
            href={href}
            className="relative flex flex-col items-center gap-0 px-2 py-1"
        >
            {active && (
                <span
                    className="absolute -top-1.5 left-1/2 h-[3px] w-6 -translate-x-1/2 rounded-full"
                    style={{ background: "linear-gradient(90deg, #FF5C1A, #FF8C42)" }}
                />
            )}
            <span
                className="flex h-8 w-8 items-center justify-center rounded-xl transition-all"
                style={active ? {
                    color: "#FF5C1A",
                    background: "rgba(255,92,26,0.10)",
                } : {
                    color: "#57534e",
                }}
            >
                {icon}
            </span>
            <span
                className="text-[9px] font-bold uppercase tracking-wider"
                style={{ color: active ? "#FF5C1A" : "#57534e" }}
            >
                {label}
            </span>
        </Link>
    );
}

// ─── Main Component ───────────────────────────────────────────────────────
export default function Navbar() {
    const totalItems = useCartStore((s) => s.getTotalItems());
    const [mounted, setMounted] = useState(false);
    const [scrolled, setScrolled] = useState(false);
    const [authState, setAuthState] = useState<AuthState>("loading");
    const [user, setUser] = useState<AuthUser | null>(null);
    const [loggingOut, setLoggingOut] = useState(false);
    const [sheetOpen, setSheetOpen] = useState(false);
    const [loyaltyBalance, setLoyaltyBalance] = useState<number | null>(null);
    const [pwaPrompt, setPwaPrompt] = useState<BeforeInstallPromptEvent | null>(null);
    const router = useRouter();

    const rafRef = useRef<number | null>(null);
    const lastScrollY = useRef(0);

    const fetchMe = useCallback(async () => {
        try {
            const res = await fetch("/api/auth/me", { credentials: "include" });
            if (res.ok) {
                const data = await res.json();
                if (data.success && data.user) {
                    setUser(data.user);
                    setAuthState("authenticated");
                    try {
                        localStorage.setItem("cafeapp_user", JSON.stringify({
                            name: data.user.name,
                            email: data.user.email,
                            phone: data.user.phone ?? "",
                            address: data.user.address ?? "",
                        }));
                    } catch { }
                    return;
                }
            }
        } catch { }
        setUser(null);
        setAuthState("unauthenticated");
        try { localStorage.removeItem("cafeapp_user"); } catch { }
    }, []);

    const fetchLoyalty = useCallback(async () => {
        try {
            const res = await fetch("/api/loyalty", { credentials: "include" });
            if (res.ok) {
                const json = await res.json();
                if (json.success && typeof json.balance === "number") {
                    setLoyaltyBalance(Math.max(0, Math.floor(json.balance)));
                }
            }
        } catch { }
    }, []);

    useEffect(() => {
        setMounted(true);
        fetchMe();

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
    }, [fetchMe]);

    useEffect(() => {
        if (authState === "authenticated") {
            fetchLoyalty();
        }
    }, [authState, fetchLoyalty]);

    const navLinks = [
        ...baseNavLinks.slice(0, 2),
        authState === "authenticated"
            ? { href: "/my-orders", label: "My Orders" }
            : { href: "/track-order", label: "Track Order" },
        ...baseNavLinks.slice(2),
    ];

    const handleLogout = async () => {
        setLoggingOut(true);
        setSheetOpen(false);
        try { await fetch("/api/auth/logout", { method: "POST", credentials: "include" }); } catch { }
        try { localStorage.removeItem("cafeapp_user"); } catch { }
        setUser(null);
        setAuthState("unauthenticated");
        setLoyaltyBalance(null);
        setLoggingOut(false);
        router.push("/");
        router.refresh();
    };

    const handleInstallPWA = async () => {
        if (!pwaPrompt) return;
        try {
            await pwaPrompt.prompt();
            await pwaPrompt.userChoice;
        } catch { }
        setPwaPrompt(null);
    };

    const renderDesktopAuth = () => {
        if (authState === "loading") return (
            <div className="flex h-9 w-9 items-center justify-center">
                <Loader2 size={15} className="animate-spin text-amber-400" />
            </div>
        );

        if (authState === "authenticated" && user) return (
            <div className="flex items-center gap-2">
                {user.role === "admin" && (
                    <Link
                        href="/admin"
                        className="flex items-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-1.5 text-[11px] font-bold text-amber-700 transition-colors hover:bg-amber-100"
                    >
                        <LayoutDashboard size={11} />
                        Admin
                    </Link>
                )}
                <div className="flex items-center gap-2 rounded-xl border border-stone-200/80 bg-white/80 px-3 py-1.5 shadow-sm backdrop-blur-sm">
                    <Avatar name={user.name} />
                    <span className="text-[13px] font-semibold text-stone-700">{getFirstName(user.name)}</span>
                    {loyaltyBalance !== null && loyaltyBalance > 0 && (
                        <div className="ml-1 flex items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-2 py-0.5">
                            <Star size={10} className="text-amber-500" fill="currentColor" />
                            <span className="text-[11px] font-black text-orange-600">{loyaltyBalance}</span>
                        </div>
                    )}
                </div>
                <button
                    onClick={handleLogout}
                    disabled={loggingOut}
                    aria-label="Logout"
                    className="flex h-9 w-9 items-center justify-center rounded-xl border border-stone-200 bg-white/80 text-stone-400 shadow-sm transition-all hover:border-red-200 hover:bg-red-50 hover:text-red-500"
                >
                    {loggingOut ? <Loader2 size={13} className="animate-spin" /> : <LogOut size={13} />}
                </button>
            </div>
        );

        return (
            <Link
                href="/auth"
                className="flex items-center gap-1.5 rounded-xl border border-stone-200 bg-white/80 px-4 py-2 text-[13px] font-semibold text-stone-600 shadow-sm backdrop-blur-sm transition-all hover:border-orange-300 hover:text-orange-600"
            >
                <User size={13} />
                Sign In
            </Link>
        );
    };

    const headerBg = scrolled
        ? "bg-white/97 backdrop-blur-xl shadow-[0_2px_20px_rgba(0,0,0,0.08)] border-b border-stone-100"
        : "bg-white/90 backdrop-blur-md border-b border-transparent";

    return (
        <>
            <RotatingTicker />

            <header
                className={`sticky top-0 z-40 transition-all duration-300 fk-header ${scrolled ? "fk-header-scrolled" : ""} ${headerBg}`}
            >
                <div
                    className="mx-auto flex max-w-7xl items-center justify-between px-3 sm:px-4 md:px-6 lg:px-8 transition-all duration-300"
                    style={{ height: "var(--header-h, 58px)" }}
                >
                    {/* Logo — PATCH: native <img> + cdnImage; logo.jpg is local so returned as-is */}
                    <Link href="/" className="flex items-center gap-2" aria-label="FoodKnock Home">
                        <div
                            className="relative overflow-hidden rounded-[10px] transition-all duration-300"
                            style={{
                                width: "var(--logo-sz, 34px)",
                                height: "var(--logo-sz, 34px)",
                                boxShadow: "0 2px 10px rgba(255,92,26,0.28)",
                                flexShrink: 0,
                            }}
                        >
                            {/* PATCH: replaced next/image <Image> with native <img>
                                Local /logo/logo.jpg is served from the public dir — no optimizer needed */}
                            <img
                                src={LOGO_SRC}
                                alt="FoodKnock"
                                width={36}
                                height={36}
                                fetchPriority="high"
                                style={{
                                    width: "100%",
                                    height: "100%",
                                    objectFit: "cover",
                                    display: "block",
                                }}
                            />
                        </div>
                        {/* Desktop wordmark */}
                        <div className="hidden sm:block">
                            <p
                                className="font-extrabold leading-none text-stone-900 tracking-tight"
                                style={{ fontSize: "1.1rem", fontFamily: "'Playfair Display', Georgia, serif" }}
                            >
                                FoodKnock
                            </p>
                            <p className="mt-px text-[9px] font-bold uppercase tracking-[0.2em] text-orange-500">
                                Delivering Fresh in Minutes
                            </p>
                        </div>
                        {/* Mobile wordmark — compact */}
                        <div className="sm:hidden leading-none">
                            <p
                                className="font-extrabold text-stone-900 leading-none"
                                style={{ fontSize: "1.05rem", fontFamily: "'Playfair Display', Georgia, serif", letterSpacing: "-0.01em" }}
                            >
                                FoodKnock
                            </p>
                            <p className="mt-[3px] text-[7.5px] font-bold uppercase tracking-[0.18em] text-orange-500 leading-none">
                                Fresh in Minutes
                            </p>
                        </div>
                    </Link>

                    {/* Desktop nav */}
                    <nav className="hidden items-center gap-1 lg:flex" aria-label="Main navigation">
                        {navLinks.map(({ href, label }) => (
                            <Link
                                key={href}
                                href={href}
                                className="relative rounded-xl px-4 py-2 text-[13.5px] font-medium text-stone-500 transition-all duration-200 hover:bg-orange-50 hover:text-orange-600"
                            >
                                {label}
                            </Link>
                        ))}
                    </nav>

                    {/* Right side */}
                    <div className="flex items-center gap-1.5 sm:gap-2">
                        {/* Desktop auth */}
                        <div className="hidden lg:flex lg:items-center lg:gap-2">
                            {renderDesktopAuth()}
                        </div>

                        {/* Mobile right cluster */}
                        <div className="flex items-center gap-1.5 lg:hidden">
                            {/* Premium live status chip */}
                            <div
                                className="flex items-center gap-1.5 rounded-full px-2.5 py-[5px]"
                                style={{
                                    background: "rgba(236,253,245,0.9)",
                                    border: "1px solid rgba(52,211,153,0.25)",
                                    backdropFilter: "blur(8px)",
                                    WebkitBackdropFilter: "blur(8px)",
                                }}
                            >
                                <span
                                    className="h-[7px] w-[7px] rounded-full"
                                    style={{
                                        background: "#10b981",
                                        boxShadow: "0 0 0 2px rgba(16,185,129,0.2)",
                                        animation: "livePulse 2s ease-in-out infinite",
                                    }}
                                />
                                <span
                                    className="font-semibold leading-none"
                                    style={{ fontSize: "10px", color: "#047857", letterSpacing: "0.02em" }}
                                >
                                    Live Kitchen
                                </span>
                            </div>

                            {/* Mobile cart icon in header */}
                            <Link
                                href="/cart"
                                aria-label={`Cart, ${mounted ? totalItems : 0} items`}
                                className="relative flex h-9 w-9 items-center justify-center rounded-xl border bg-white/80 text-stone-600 backdrop-blur-sm transition-all hover:text-orange-500"
                                style={{ borderColor: "rgba(214,211,208,0.7)" }}
                            >
                                <ShoppingCart size={17} strokeWidth={2} />
                                {mounted && totalItems > 0 && (
                                    <span
                                        className="absolute -right-1 -top-1 flex h-[18px] w-[18px] items-center justify-center rounded-full text-[9px] font-black text-white"
                                        style={{ background: "linear-gradient(135deg, #FF5C1A 0%, #FF8C42 100%)" }}
                                    >
                                        {totalItems > 9 ? "9+" : totalItems}
                                    </span>
                                )}
                            </Link>
                        </div>

                        {/* Desktop cart icon */}
                        <Link
                            href="/cart"
                            aria-label={`Cart, ${mounted ? totalItems : 0} items`}
                            className="relative hidden h-10 w-10 items-center justify-center rounded-xl border border-stone-200/80 bg-white/80 text-stone-600 shadow-sm backdrop-blur-sm transition-all hover:border-orange-300 hover:text-orange-500 lg:flex"
                        >
                            <ShoppingCart size={18} strokeWidth={2} />
                            {mounted && totalItems > 0 && (
                                <span
                                    className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-black text-white"
                                    style={{ background: "linear-gradient(135deg, #FF5C1A 0%, #FF8C42 100%)" }}
                                >
                                    {totalItems > 9 ? "9+" : totalItems}
                                </span>
                            )}
                        </Link>
                    </div>
                </div>
            </header>

            <BottomNav
                authState={authState}
                totalItems={mounted ? totalItems : 0}
                mounted={mounted}
                onAccountClick={() => setSheetOpen(true)}
            />

            <AccountSheet
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

            <style jsx global>{`
                @keyframes shimmer {
                    0%   { transform: translateX(-100%); }
                    100% { transform: translateX(200%); }
                }
                @keyframes livePulse {
                    0%, 100% { opacity: 1; transform: scale(1); }
                    50%       { opacity: 0.65; transform: scale(0.88); }
                }
                @media (max-width: 1023px) {
                    :root {
                        --header-h: 58px;
                        --logo-sz: 34px;
                    }
                }
                @media (max-width: 1023px) {
                    header.fk-header-scrolled {
                        --header-h: 52px;
                        --logo-sz: 30px;
                    }
                }
                @media (max-width: 360px) {
                    :root {
                        --header-h: 54px;
                        --logo-sz: 30px;
                    }
                }
                @media (min-width: 1024px) {
                    :root {
                        --header-h: 64px;
                        --logo-sz: 36px;
                    }
                }
            `}</style>
        </>
    );
}