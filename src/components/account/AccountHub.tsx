"use client";

// src/components/account/AccountHub.tsx
//
// FoodKnock Phase 5 — Account 2.0. Restructured from a flat settings list
// into a premium personal hub: profile identity header → real loyalty
// snapshot (teaser only — full experience stays on /loyalty, not
// duplicated here) → compact quick-action grid → remaining settings list
// → security. Every value is real: `user` comes from AccountContext (the
// same server-fetched doc account/layout.tsx already validated), nothing
// here is fetched or computed a second time. No new password-change or
// session-revocation infrastructure — same Phase 9 decision as before.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "react-hot-toast";
import {
    User, MapPin, Package, Gift, Bell, KeyRound, LogOut, ChevronRight,
    Sparkles, HelpCircle, ArrowRight, Trash2,
} from "lucide-react";
import { useAccountUser } from "@/components/account/AccountContext";

const SETTINGS_SECTIONS = [
    { href: "/account/profile", label: "Profile", desc: "Name, date of birth, contact details", icon: User },
    { href: "/account/preferences", label: "Notification Preferences", desc: "What we notify you about", icon: Bell },
];

const QUICK_ACTIONS = [
    { href: "/my-orders", label: "Orders", icon: Package },
    { href: "/loyalty", label: "Rewards", icon: Gift },
    { href: "/account/addresses", label: "Addresses", icon: MapPin },
    { href: "/contact", label: "Help", icon: HelpCircle },
];

function getInitial(name: string): string {
    const trimmed = name.trim();
    return trimmed ? trimmed[0].toUpperCase() : "F";
}

function memberSinceLabel(createdAt: string | null): string | null {
    if (!createdAt) return null;
    const d = new Date(createdAt);
    if (Number.isNaN(d.getTime())) return null;
    return d.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
}

export default function AccountHub() {
    const user = useAccountUser();
    const router = useRouter();
    const [loggingOut, setLoggingOut] = useState(false);

    async function handleLogout() {
        setLoggingOut(true);
        try {
            await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
        } catch {
            // Best-effort — clearing client state below is what actually matters.
        } finally {
            toast.success("Logged out");
            router.push("/");
            router.refresh();
        }
    }

    const displayName = user.name?.trim() || "Welcome to FoodKnock";
    const sinceLabel = memberSinceLabel(user.createdAt);

    return (
        <div className="space-y-5">
            {/* ── Profile identity header ── */}
            <div className="flex items-center gap-4 rounded-fk-lg border border-fk-border bg-fk-surface-elevated p-5 shadow-sm">
                <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[var(--fk-accent)] to-[var(--fk-gold)] text-xl font-black text-white shadow-fk-sm">
                    {getInitial(user.name)}
                </span>
                <div className="min-w-0 flex-1">
                    <p className="truncate text-lg font-black text-fk-text">{displayName}</p>
                    {user.phone && <p className="text-sm text-fk-text-secondary">{user.phone}</p>}
                    <p className="mt-0.5 text-[11.5px] text-fk-text-tertiary">
                        {sinceLabel ? `FoodKnock customer since ${sinceLabel}` : "Your FoodKnock account"}
                    </p>
                </div>
            </div>

            {/* ── Rewards snapshot — real balance only, teaser to /loyalty ── */}
            <Link
                href="/loyalty"
                className="group flex items-center gap-4 overflow-hidden rounded-fk-lg border border-fk-border bg-gradient-to-r from-fk-gold-soft to-fk-surface-elevated p-5 shadow-sm transition-all hover:shadow-fk-md"
            >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-fk-md bg-fk-surface-elevated text-fk-gold shadow-sm">
                    <Sparkles size={20} strokeWidth={2} />
                </span>
                <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-black uppercase tracking-[0.18em] text-fk-text-tertiary">FoodKnock Rewards</p>
                    <p className="mt-0.5 text-2xl font-black leading-none text-fk-text">
                        {user.loyaltyPoints.toLocaleString("en-IN")} <span className="text-sm font-bold text-fk-text-secondary">pts</span>
                    </p>
                </div>
                <span className="flex shrink-0 items-center gap-1 text-[12.5px] font-bold text-[var(--fk-accent)]">
                    View rewards
                    <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" />
                </span>
            </Link>

            {/* ── Quick actions ── */}
            <div className="grid grid-cols-4 gap-2.5">
                {QUICK_ACTIONS.map((a) => {
                    const Icon = a.icon;
                    return (
                        <Link
                            key={a.href}
                            href={a.href}
                            className="flex flex-col items-center gap-2 rounded-fk-md border border-fk-border bg-fk-surface-elevated py-4 text-center shadow-sm transition-all hover:border-[var(--fk-accent)]/30 hover:shadow-fk-md"
                        >
                            <span className="flex h-9 w-9 items-center justify-center rounded-fk-sm bg-fk-surface-selected text-[var(--fk-accent)]">
                                <Icon size={17} strokeWidth={2} />
                            </span>
                            <span className="text-[11.5px] font-bold text-fk-text">{a.label}</span>
                        </Link>
                    );
                })}
            </div>

            {/* ── Remaining settings ── */}
            <div className="overflow-hidden rounded-fk-lg border border-fk-border bg-fk-surface-elevated">
                {SETTINGS_SECTIONS.map((s, i) => {
                    const Icon = s.icon;
                    return (
                        <Link
                            key={s.href}
                            href={s.href}
                            className={[
                                "flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-fk-surface-interactive",
                                i !== SETTINGS_SECTIONS.length - 1 ? "border-b border-fk-border" : "",
                            ].join(" ")}
                        >
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-fk-sm bg-fk-surface-selected">
                                <Icon size={16} className="text-[var(--fk-accent)]" strokeWidth={2} />
                            </div>
                            <div className="flex-1">
                                <p className="text-[14px] font-semibold text-fk-text">{s.label}</p>
                                <p className="text-[12px] text-fk-text-tertiary">{s.desc}</p>
                            </div>
                            <ChevronRight size={16} className="text-fk-text-tertiary" />
                        </Link>
                    );
                })}
            </div>

            {/* ── Security ── */}
            <div className="overflow-hidden rounded-fk-lg border border-fk-border bg-fk-surface-elevated">
                <p className="px-4 pt-3.5 text-[11px] font-bold uppercase tracking-wide text-fk-text-tertiary">Security</p>
                <Link
                    href="/auth?mode=login"
                    className="flex items-center gap-3 border-b border-fk-border px-4 py-3.5 transition-colors hover:bg-fk-surface-interactive"
                >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-fk-sm bg-fk-surface-selected">
                        <KeyRound size={16} className="text-[var(--fk-accent)]" strokeWidth={2} />
                    </div>
                    <div className="flex-1">
                        <p className="text-[14px] font-semibold text-fk-text">Change Password</p>
                        <p className="text-[12px] text-fk-text-tertiary">Use &quot;Forgot password?&quot; on the sign-in screen</p>
                    </div>
                    <ChevronRight size={16} className="text-fk-text-tertiary" />
                </Link>
                <Link
                    href="/account/delete"
                    className="flex items-center gap-3 border-b border-fk-border px-4 py-3.5 transition-colors hover:bg-fk-surface-interactive"
                >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-fk-sm bg-fk-surface-selected">
                        <Trash2 size={16} className="text-fk-text-secondary" strokeWidth={2} />
                    </div>
                    <div className="flex-1">
                        <p className="text-[14px] font-semibold text-fk-text">Delete Account</p>
                        <p className="text-[12px] text-fk-text-tertiary">Permanently remove your FoodKnock account</p>
                    </div>
                    <ChevronRight size={16} className="text-fk-text-tertiary" />
                </Link>
                <button
                    onClick={handleLogout}
                    disabled={loggingOut}
                    className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-fk-danger/5 disabled:opacity-60"
                >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-fk-sm bg-fk-danger/10">
                        <LogOut size={16} className="text-fk-danger" strokeWidth={2} />
                    </div>
                    <div className="flex-1">
                        <p className="text-[14px] font-semibold text-fk-danger">
                            {loggingOut ? "Logging out…" : "Logout"}
                        </p>
                    </div>
                </button>
            </div>
        </div>
    );
}
