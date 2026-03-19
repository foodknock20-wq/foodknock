"use client";

// src/components/admin/AdminTopbar.tsx
// Premium dark admin topbar — FoodKnock

import { usePathname } from "next/navigation";
import { Menu, Bell, Search, ShieldCheck } from "lucide-react";

const PAGE_META: Record<string, { title: string; subtitle: string }> = {
    "/admin":          { title: "Dashboard",  subtitle: "Overview of your FoodKnock operations"    },
    "/admin/products": { title: "Products",   subtitle: "Manage your menu items and stock"          },
    "/admin/orders":   { title: "Orders",     subtitle: "View and manage customer orders"           },
    "/admin/users":    { title: "Users",      subtitle: "Registered customer accounts"              },
    "/admin/reviews":  { title: "Reviews",    subtitle: "Customer feedback and ratings"             },
    "/admin/offers":   { title: "Offers",     subtitle: "Promotions and discount deals"             },
    "/admin/loyalty":  { title: "Loyalty",    subtitle: "Manage points, rewards and referrals"      },
};

function getPageMeta(pathname: string) {
    return (
        PAGE_META[pathname] ??
        PAGE_META[Object.keys(PAGE_META).find((k) => pathname.startsWith(k) && k !== "/admin") ?? ""] ??
        { title: "Admin", subtitle: "FoodKnock Admin Panel" }
    );
}

type Props = { onMenuClick: () => void };

export default function AdminTopbar({ onMenuClick }: Props) {
    const pathname          = usePathname();
    const { title, subtitle } = getPageMeta(pathname);

    return (
        <header className="relative flex shrink-0 items-center justify-between border-b border-white/[0.05] bg-[#0c0c12]/90 px-4 py-3 backdrop-blur-xl md:px-6">

            {/* Subtle bottom glow line */}
            <div
                className="pointer-events-none absolute bottom-0 left-1/2 h-px w-2/3 -translate-x-1/2 opacity-40"
                style={{ background: "linear-gradient(90deg, transparent, #f97316 40%, #fbbf24 60%, transparent)" }}
                aria-hidden="true"
            />

            {/* ── Left: hamburger + page info ── */}
            <div className="flex min-w-0 items-center gap-3">
                <button
                    onClick={onMenuClick}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/[0.07] text-stone-500 transition-all duration-200 hover:border-white/10 hover:bg-white/[0.05] hover:text-white md:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                    aria-label="Toggle sidebar"
                >
                    <Menu size={16} strokeWidth={2} />
                </button>

                <div className="min-w-0">
                    <div className="flex items-center gap-2.5">
                        <h1 className="text-lg font-black leading-none tracking-tight text-white md:text-[1.2rem]">
                            {title}
                        </h1>
                        {/* Subtle live indicator on dashboard */}
                        {pathname === "/admin" && (
                            <span className="flex items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-emerald-400">
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                Live
                            </span>
                        )}
                    </div>
                    <p className="mt-0.5 hidden truncate text-[11px] text-stone-600 sm:block">
                        {subtitle}
                    </p>
                </div>
            </div>

            {/* ── Right: search + bell + admin badge ── */}
            <div className="flex items-center gap-2 md:gap-2.5">

                {/* Search shell (desktop) */}
                <div className="relative hidden md:block">
                    <Search
                        size={12}
                        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-600"
                        strokeWidth={2}
                    />
                    <input
                        type="text"
                        readOnly
                        placeholder="Search…"
                        className="w-44 cursor-default rounded-xl border border-white/[0.06] bg-white/[0.03] py-1.5 pl-8 pr-3 text-xs text-stone-600 placeholder:text-stone-700 transition-colors focus:outline-none hover:border-white/10 lg:w-52"
                        aria-label="Search (coming soon)"
                    />
                </div>

                {/* Notification bell */}
                <button
                    className="relative flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.07] text-stone-500 transition-all duration-200 hover:border-white/10 hover:bg-white/[0.05] hover:text-stone-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                    aria-label="Notifications"
                >
                    <Bell size={14} strokeWidth={2} />
                    <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-amber-400 shadow-[0_0_5px_1px_rgba(251,191,36,0.55)]" />
                </button>

                {/* Admin badge */}
                <div className="flex items-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.03] px-3 py-1.5 transition-colors hover:border-white/10">
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-orange-500 to-amber-400 text-[10px] font-black text-white shadow shadow-orange-500/20">
                        A
                    </div>
                    <p className="hidden text-xs font-bold leading-none text-stone-300 sm:block">Admin</p>
                    <ShieldCheck size={12} className="hidden text-amber-400/80 sm:block" strokeWidth={2.5} />
                </div>
            </div>
        </header>
    );
}