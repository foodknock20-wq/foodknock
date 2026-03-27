"use client";

// src/components/admin/AdminSidebar.tsx
// Premium dark admin sidebar — FoodKnock

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
    LayoutDashboard, Package, ShoppingBag, Users,
    Star, Tag, LogOut, X, ChevronRight, Zap,
} from "lucide-react";
import { useState } from "react";

const navItems = [
    { href: "/admin",          label: "Dashboard", icon: LayoutDashboard, exact: true },
    { href: "/",               label: "Home",       icon: Zap,             exact: true },
    { href: "/admin/products", label: "Products",   icon: Package                     },
    { href: "/admin/orders",   label: "Orders",     icon: ShoppingBag                 },
    { href: "/admin/users",    label: "Users",      icon: Users                       },
    { href: "/admin/reviews",  label: "Reviews",    icon: Star                        },
    { href: "/admin/review-rewards", label: "Review Rewards", icon: Star },
    { href: "/admin/loyalty",  label: "Loyalty",    icon: Tag                         }
];

type Props = { isOpen: boolean; onClose: () => void };

export default function AdminSidebar({ isOpen, onClose }: Props) {
    const pathname   = usePathname();
    const router     = useRouter();
    const [loggingOut, setLoggingOut] = useState(false);

    const isActive = (href: string, exact?: boolean) =>
        exact ? pathname === href : pathname.startsWith(href);

    const handleLogout = async () => {
        setLoggingOut(true);
        try { await fetch("/api/auth/logout", { method: "POST", credentials: "include" }); } catch { /* ignore */ }
        try { localStorage.removeItem("cafeapp_user"); } catch { /* ignore */ }
        router.push("/auth");
        router.refresh();
    };

    return (
        <aside
            className={`
                fixed inset-y-0 left-0 z-40 flex w-64 flex-col
                bg-[#0c0c12] border-r border-white/[0.05]
                transition-transform duration-300 ease-in-out
                md:relative md:translate-x-0
                ${isOpen ? "translate-x-0" : "-translate-x-full"}
            `}
        >
            {/* Ambient top glow */}
            <div
                className="pointer-events-none absolute left-1/2 top-0 h-32 w-48 -translate-x-1/2 rounded-full opacity-20 blur-3xl"
                style={{ background: "radial-gradient(ellipse, #f97316, transparent 70%)" }}
                aria-hidden="true"
            />
            {/* Bottom ambient */}
            <div
                className="pointer-events-none absolute bottom-10 left-4 h-24 w-24 rounded-full opacity-10 blur-2xl"
                style={{ background: "radial-gradient(ellipse, #fbbf24, transparent 70%)" }}
                aria-hidden="true"
            />

            {/* ── Brand header ── */}
            <div className="relative flex items-center justify-between border-b border-white/[0.05] px-5 py-[18px]">
                <Link href="/admin" className="group flex items-center gap-3" onClick={onClose}>
                    {/* Logo mark */}
                    <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 to-amber-400 shadow-lg shadow-orange-500/25 transition-all duration-300 group-hover:shadow-orange-500/40 group-hover:scale-105">
                        <span className="text-lg">🍔</span>
                        <div className="absolute inset-0 rounded-xl border border-white/20" />
                    </div>
                    <div>
                        <p className="text-[15px] font-black leading-none tracking-tight text-white">FoodKnock</p>
                        <p className="mt-0.5 text-[9px] font-black uppercase tracking-[0.22em] text-orange-500/60">
                            Admin Panel
                        </p>
                    </div>
                </Link>

                <button
                    onClick={onClose}
                    className="flex h-7 w-7 items-center justify-center rounded-lg text-stone-600 transition-colors hover:bg-white/5 hover:text-white md:hidden"
                    aria-label="Close sidebar"
                >
                    <X size={15} />
                </button>
            </div>

            {/* ── Navigation ── */}
            <nav className="relative flex-1 overflow-y-auto px-3 py-5" aria-label="Admin navigation">
                <p className="mb-3 px-3 text-[9.5px] font-black uppercase tracking-[0.22em] text-stone-600">
                    Navigation
                </p>
                <ul className="space-y-0.5">
                    {navItems.map(({ href, label, icon: Icon, exact }) => {
                        const active = isActive(href, exact);
                        return (
                            <li key={href}>
                                <Link
                                    href={href}
                                    onClick={onClose}
                                    className={`
                                        group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold
                                        transition-all duration-200 outline-none
                                        focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-inset
                                        ${active
                                            ? "bg-gradient-to-r from-orange-500/15 to-amber-500/8 text-white"
                                            : "text-stone-500 hover:bg-white/[0.04] hover:text-stone-200"
                                        }
                                    `}
                                >
                                    {/* Active left accent bar */}
                                    {active && (
                                        <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-gradient-to-b from-orange-400 to-amber-400" />
                                    )}

                                    <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-all duration-200 ${
                                        active
                                            ? "bg-gradient-to-br from-orange-500/20 to-amber-500/15 text-amber-400"
                                            : "bg-white/[0.04] text-stone-600 group-hover:bg-white/[0.06] group-hover:text-stone-400"
                                    }`}>
                                        <Icon size={14} strokeWidth={active ? 2.5 : 2} />
                                    </span>

                                    <span className="flex-1 text-white">{label}</span>

                                    {active && (
                                        <ChevronRight size={12} className="text-amber-500/50 shrink-0" />
                                    )}
                                </Link>
                            </li>
                        );
                    })}
                </ul>
            </nav>

            {/* ── Bottom: admin chip + logout ── */}
            <div className="relative space-y-1 border-t border-white/[0.05] px-3 py-4">

                {/* Admin user chip */}
                <div className="flex items-center gap-3 rounded-xl border border-white/[0.04] bg-white/[0.03] px-3 py-2.5">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-orange-500 to-amber-400 text-[11px] font-black text-white shadow-md shadow-orange-500/20">
                        A
                    </div>
                    <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-bold text-white">Admin</p>
                        <p className="text-[10px] text-stone-600">Super Admin</p>
                    </div>
                    <span className="shrink-0 rounded-full border border-amber-500/25 bg-amber-500/10 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-amber-400">
                        Pro
                    </span>
                </div>

                {/* Logout */}
                <button
                    onClick={handleLogout}
                    disabled={loggingOut}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-stone-500 transition-all duration-200 hover:bg-red-500/8 hover:text-red-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:ring-inset disabled:opacity-50"
                >
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/[0.04] text-stone-600">
                        <LogOut size={14} strokeWidth={2} />
                    </span>
                    {loggingOut ? "Logging out…" : "Logout"}
                </button>
            </div>
        </aside>
    );
}