"use client";

// src/components/shared/Navbar.tsx
// FoodKnock — Premium mobile-first navbar
// Playfair Display logo · DM Sans body · Ember orange accents

import Link from "next/link";
import Image from "next/image";
import {
    ShoppingCart, Menu, X, LogOut, Loader2, LayoutDashboard,
    ChevronRight, UtensilsCrossed, User, Sparkles,
} from "lucide-react";
import { useCartStore } from "@/store/cartStore";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import InstallPwaButton from "@/components/shared/InstallPwaButton";

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

// ─── Constants ────────────────────────────────────────────────────────────
const baseNavLinks = [
    { href: "/", label: "Home" },
    { href: "/menu", label: "Menu" },
    { href: "/review-rewards", label: "Review Rewards" },
    { href: "/loyalty", label: "Rewards" },
    { href: "/contact", label: "Contact" },
];

function getFirstName(name: string): string {
    return name.split(" ")[0] ?? name;
}

function Avatar({ name }: { name: string }) {
    return (
        <span
            className="inline-flex h-8 w-8 items-center justify-center rounded-xl text-[13px] font-bold text-white"
            style={{ background: "linear-gradient(135deg, #FF5C1A 0%, #FFB347 100%)" }}
        >
            {getFirstName(name)[0].toUpperCase()}
        </span>
    );
}

// ─── Component ────────────────────────────────────────────────────────────
export default function Navbar() {
    const totalItems = useCartStore((s) => s.getTotalItems());
    const [isOpen, setIsOpen] = useState(false);
    const [mounted, setMounted] = useState(false);
    const [scrolled, setScrolled] = useState(false);
    const [authState, setAuthState] = useState<AuthState>("loading");
    const [user, setUser] = useState<AuthUser | null>(null);
    const [loggingOut, setLoggingOut] = useState(false);
    const router = useRouter();

    // ── Auth ──────────────────────────────────────────────────────────────
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

    useEffect(() => {
        setMounted(true);
        fetchMe();
        const onScroll = () => setScrolled(window.scrollY > 8);
        window.addEventListener("scroll", onScroll, { passive: true });
        return () => window.removeEventListener("scroll", onScroll);
    }, [fetchMe]);

    // ── Nav links ─────────────────────────────────────────────────────────
    const navLinks = [
        ...baseNavLinks.slice(0, 2),
        authState === "authenticated"
            ? { href: "/my-orders", label: "My Orders" }
            : { href: "/track-order", label: "Track Order" },
        ...baseNavLinks.slice(2),
    ];

    const handleLogout = async () => {
        setLoggingOut(true);
        setIsOpen(false);
        try { await fetch("/api/auth/logout", { method: "POST", credentials: "include" }); } catch { }
        try { localStorage.removeItem("cafeapp_user"); } catch { }
        setUser(null);
        setAuthState("unauthenticated");
        setLoggingOut(false);
        router.push("/");
        router.refresh();
    };

    // ── Desktop Auth ──────────────────────────────────────────────────────
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

    // ── Mobile Auth ───────────────────────────────────────────────────────
    const renderMobileAuth = () => {
        if (authState === "loading") return (
            <div className="flex justify-center py-4">
                <Loader2 size={18} className="animate-spin text-amber-400" />
            </div>
        );

        if (authState === "authenticated" && user) return (
            <div className="space-y-3">
                {user.role === "admin" && (
                    <Link
                        href="/admin"
                        onClick={() => setIsOpen(false)}
                        className="flex items-center justify-between rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3.5 text-sm font-bold text-amber-700 transition-colors hover:bg-amber-100"
                    >
                        <div className="flex items-center gap-3">
                            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-100">
                                <LayoutDashboard size={15} className="text-amber-600" />
                            </div>
                            Admin Panel
                        </div>
                        <ChevronRight size={15} className="text-amber-400" />
                    </Link>
                )}
                <div className="flex items-center gap-3 rounded-2xl border border-stone-100 bg-stone-50 px-4 py-3.5">
                    <Avatar name={user.name} />
                    <div>
                        <p className="text-[14px] font-bold text-stone-800">{user.name}</p>
                        <p className="text-[11px] text-stone-400">{user.email}</p>
                    </div>
                </div>
                <button
                    onClick={handleLogout}
                    disabled={loggingOut}
                    className="flex w-full items-center justify-center gap-2 rounded-2xl border border-red-100 bg-red-50 py-3 text-[13px] font-semibold text-red-500 transition-all hover:bg-red-100"
                >
                    {loggingOut ? <Loader2 size={14} className="animate-spin" /> : <LogOut size={14} />}
                    Logout
                </button>
            </div>
        );

        return (
            <Link
                href="/auth"
                onClick={() => setIsOpen(false)}
                className="flex items-center justify-between rounded-2xl px-4 py-4 font-semibold text-stone-700"
                style={{ background: "linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%)", border: "1px solid rgba(255,92,26,0.15)" }}
            >
                <div className="flex items-center gap-3">
                    <div
                        className="flex h-9 w-9 items-center justify-center rounded-xl"
                        style={{ background: "linear-gradient(135deg, #FF5C1A 0%, #FFB347 100%)" }}
                    >
                        <User size={16} className="text-white" />
                    </div>
                    <div>
                        <p className="text-[14px] font-bold text-stone-800">Sign in to FoodKnock</p>
                        <p className="text-[11px] text-stone-400">Track orders & earn rewards</p>
                    </div>
                </div>
                <ChevronRight size={16} className="text-orange-400" />
            </Link>
        );
    };

    const headerBg = scrolled
        ? "bg-white/95 backdrop-blur-xl shadow-[0_2px_20px_rgba(0,0,0,0.08)] border-b border-stone-100"
        : "bg-white/90 backdrop-blur-md border-b border-transparent";

    return (
        <>
            {/* ── Announcement Strip ── */}
            <div
                className="relative overflow-hidden py-2.5 text-center text-[11px] font-semibold text-white"
                style={{ background: "linear-gradient(90deg, #FF5C1A 0%, #FF8C42 50%, #FF5C1A 100%)" }}
            >
                <span className="inline-flex items-center gap-2">
                    <Sparkles size={11} className="opacity-80" />
                    Get Free Delivery on orders above ₹299 · Order fresh, delivered fast
                    <Sparkles size={11} className="opacity-80" />
                </span>
                {/* Moving shimmer */}
                <div
                    className="pointer-events-none absolute inset-0"
                    style={{
                        background: "linear-gradient(105deg, transparent 30%, rgba(255,255,255,0.15) 50%, transparent 70%)",
                        animation: "shimmer 3s infinite",
                    }}
                />
            </div>

            {/* ── Main Header ── */}
            <header
                className={`sticky top-0 z-40 transition-all duration-300 ${headerBg}`}
            >
                <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 md:px-6 lg:px-8">

                    {/* Logo */}
                    <Link href="/" className="flex items-center gap-2.5" aria-label="FoodKnock Home">
                        <div className="relative h-9 w-9 overflow-hidden rounded-xl" style={{ boxShadow: "0 2px 12px rgba(255,92,26,0.3)" }}>
                            <Image
                                src="/logo/logo.jpg"
                                alt="FoodKnock"
                                fill
                                className="object-cover"
                                priority
                            />
                        </div>
                        <div className="hidden sm:block">
                            <p
                                className="font-extrabold leading-none text-stone-900 tracking-tight"
                                style={{ fontSize: "1.1rem", fontFamily: "'Playfair Display', Georgia, serif" }}
                            >
                                FoodKnock
                            </p>
                            <p className="mt-px text-[9px] font-bold uppercase tracking-[0.2em] text-orange-500">
                                Fresh · Fast · Delicious
                            </p>
                        </div>
                        <span
                            className="font-extrabold text-stone-900 sm:hidden"
                            style={{ fontSize: "1.1rem", fontFamily: "'Playfair Display', Georgia, serif" }}
                        >
                            FoodKnock
                        </span>
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

                    {/* Right actions */}
                    <div className="flex items-center gap-2">
                        <div className="hidden lg:flex lg:items-center lg:gap-2">
                            {renderDesktopAuth()}
                        </div>

                        {/* Order Now CTA — desktop */}
                        <Link
                            href="/menu"
                            className="hidden items-center gap-2 rounded-xl px-5 py-2.5 text-[13px] font-bold text-white shadow-sm transition-all duration-200 hover:shadow-md hover:brightness-105 lg:flex"
                            style={{ background: "linear-gradient(135deg, #FF5C1A 0%, #FF8C42 100%)" }}
                        >
                            <UtensilsCrossed size={13} strokeWidth={2.5} />
                            Order Now
                        </Link>

                        {/* Cart */}
                        <Link
                            href="/cart"
                            aria-label={`Cart, ${mounted ? totalItems : 0} items`}
                            className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-stone-200/80 bg-white/80 text-stone-600 shadow-sm backdrop-blur-sm transition-all hover:border-orange-300 hover:text-orange-500"
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

                        {/* Burger */}
                        <button
                            className="flex h-10 w-10 items-center justify-center rounded-xl border border-stone-200/80 bg-white/80 text-stone-600 shadow-sm backdrop-blur-sm transition-all hover:border-orange-300 hover:text-orange-500 lg:hidden"
                            onClick={() => setIsOpen(!isOpen)}
                            aria-expanded={isOpen}
                            aria-controls="fk-mobile-menu"
                            aria-label={isOpen ? "Close menu" : "Open menu"}
                        >
                            <span className={`absolute transition-all duration-200 ${isOpen ? "opacity-100 rotate-0" : "opacity-0 rotate-90"}`}>
                                <X size={18} />
                            </span>
                            <span className={`absolute transition-all duration-200 ${isOpen ? "opacity-0 -rotate-90" : "opacity-100 rotate-0"}`}>
                                <Menu size={18} />
                            </span>
                        </button>
                    </div>
                </div>

                {/* ── Mobile Drawer ── */}
                <div
                    id="fk-mobile-menu"
                    aria-hidden={!isOpen}
                    className={`overflow-hidden transition-all duration-300 ease-in-out lg:hidden ${isOpen ? "max-h-[100vh] opacity-100" : "max-h-0 opacity-0"}`}
                    style={{ borderTop: isOpen ? "1px solid rgba(0,0,0,0.06)" : "none" }}
                >
                    <div className="max-h-[calc(100dvh-7rem)] overflow-y-auto overscroll-contain">
                        <div className="space-y-4 px-4 pb-8 pt-4">

                            {/* Auth section */}
                            {renderMobileAuth()}

                            {/* Nav links */}
                            <div className="overflow-hidden rounded-2xl border border-stone-100 bg-stone-50">
                                {navLinks.map(({ href, label }, i) => (
                                    <Link
                                        key={href}
                                        href={href}
                                        onClick={() => setIsOpen(false)}
                                        className={`flex items-center justify-between px-4 py-4 text-[14px] font-medium text-stone-700 transition-colors hover:bg-orange-50 hover:text-orange-600 ${i !== navLinks.length - 1 ? "border-b border-stone-100" : ""}`}
                                    >
                                        {label}
                                        <ChevronRight size={15} className="text-stone-300" />
                                    </Link>
                                ))}
                            </div>

                            {/* Cart row */}
                            <Link
                                href="/cart"
                                onClick={() => setIsOpen(false)}
                                className="flex items-center justify-between rounded-2xl border border-stone-100 bg-white px-4 py-4 text-[14px] font-semibold text-stone-700 transition-all hover:border-orange-200 hover:bg-orange-50"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-stone-100">
                                        <ShoppingCart size={15} className="text-stone-500" />
                                    </div>
                                    View Cart
                                </div>
                                {mounted && totalItems > 0 && (
                                    <span
                                        className="flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-black text-white"
                                        style={{ background: "linear-gradient(135deg, #FF5C1A 0%, #FF8C42 100%)" }}
                                    >
                                        {totalItems}
                                    </span>
                                )}
                            </Link>

                            {/* CTA */}
                            <Link
                                href="/menu"
                                onClick={() => setIsOpen(false)}
                                className="flex w-full items-center justify-center gap-2.5 rounded-2xl py-4 text-[15px] font-black text-white shadow-lg transition-all active:scale-[0.98]"
                                style={{
                                    background: "linear-gradient(135deg, #FF5C1A 0%, #FF8C42 100%)",
                                    boxShadow: "0 8px 24px rgba(255,92,26,0.35)",
                                }}
                            >
                                <UtensilsCrossed size={17} strokeWidth={2.5} />
                                Order Fresh Now
                            </Link>
                        </div>
                    </div>
                </div>
            </header>

            <InstallPwaButton />

            <style jsx global>{`
                @keyframes shimmer {
                    0%   { transform: translateX(-100%); }
                    100% { transform: translateX(200%); }
                }
            `}</style>
        </>
    );
}