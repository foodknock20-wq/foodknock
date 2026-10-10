"use client";

// src/components/account/AccountShell.tsx
//
// Shared tab navigation for every /account/* page — consistent IA
// ("My Account" hub with Profile / Addresses / Orders / Loyalty /
// Preferences / Security), mobile-first horizontal scroller.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { User, MapPin, Package, Gift, Bell, ShieldCheck } from "lucide-react";

const TABS = [
    { href: "/account", label: "Overview", icon: User, exact: true },
    { href: "/account/profile", label: "Profile", icon: User },
    { href: "/account/addresses", label: "Addresses", icon: MapPin },
    { href: "/my-orders", label: "Orders", icon: Package, external: true },
    { href: "/loyalty", label: "Loyalty", icon: Gift, external: true },
    { href: "/account/preferences", label: "Notifications", icon: Bell },
];

export default function AccountShell({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();

    return (
        <div className="min-h-screen bg-fk-bg">
            <div className="mx-auto max-w-3xl px-4 pt-6">
                <div className="mb-1 inline-flex items-center gap-2 rounded-fk-pill border border-fk-border bg-fk-surface-selected px-3 py-1">
                    <ShieldCheck size={11} className="text-[var(--fk-accent)]" />
                    <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--fk-accent)]">
                        My Account
                    </span>
                </div>
                <h1 className="font-display text-2xl font-black text-fk-text">
                    Account
                </h1>

                <div className="mt-4 flex gap-2 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    {TABS.map((tab) => {
                        const isActive = pathname === tab.href;
                        const Icon = tab.icon;
                        return (
                            <Link
                                key={tab.href}
                                href={tab.href}
                                className={[
                                    "flex shrink-0 items-center gap-1.5 rounded-fk-pill border px-3.5 py-2 text-[12px] font-bold transition-colors",
                                    isActive
                                        ? "border-[var(--fk-accent)]/40 bg-gradient-to-r from-[var(--fk-accent)] to-[var(--fk-gold)] text-white"
                                        : "border-fk-border bg-fk-surface-elevated text-fk-text-secondary hover:border-[var(--fk-accent)]/30",
                                ].join(" ")}
                            >
                                <Icon size={13} strokeWidth={2.5} />
                                {tab.label}
                            </Link>
                        );
                    })}
                </div>
            </div>

            <div className="mx-auto max-w-3xl px-4 pb-14 pt-2">{children}</div>
        </div>
    );
}
