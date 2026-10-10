"use client";

// src/components/shell/AccountDialog.tsx
//
// Luxury Navigation 2.0 — replaces AccountSheet (a <BottomSheet>, i.e. a
// bottom-attached drawer) with a centered, floating "Account Command
// Center" dialog. Same props, same data, same destinations, same logout
// behavior as the sheet it replaces — only the presentation changed.
//
// Why a new component instead of reusing <Dialog> directly: Dialog's
// chrome (src/components/ui/Dialog.tsx) is shaped for confirmation-style
// prompts — a forced tone-icon box + title + description, max-w-400,
// fixed padding, no internal scroll region, no close button (relies on
// Escape/backdrop/footer actions). An account panel needs its own chrome
// (identity card, a close button, a scrollable grouped-action body with a
// stable header/footer) that doesn't fit that shape. This component
// reuses Dialog's PROVEN mechanics instead — identical portal target,
// identical z-index layering (z-[100] backdrop / z-[101] panel, so it's
// guaranteed above BottomNavigation's z-50 and FloatingCart's z-40 without
// inventing a new number), identical focus-trap/Escape/scroll-lock effect,
// identical framer-motion dependency already in the bundle (Dialog
// already uses it) — just with account-specific content and a slightly
// more restrained (non-spring) entrance per this task's "luxury = restraint"
// direction.

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import Link from "next/link";
import {
    X, LogOut, Loader2, LayoutDashboard, User, Star, Phone,
    ChevronRight, LogIn, MessageSquare, Download, Bell,
} from "lucide-react";
import { getPreferredAuthMode } from "@/lib/authDeviceMemory";
import type { AuthUser, AuthState, BeforeInstallPromptEvent } from "./types";

const DISMISS_KEY = "fk_pwa_dismissed_v1";

function getFirstName(name: string): string {
    return name.split(" ")[0] ?? name;
}

function Avatar({ name }: { name: string }) {
    return (
        <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-fk-md bg-gradient-to-br from-[var(--fk-accent)] to-[var(--fk-gold)] text-base font-bold text-white shadow-fk-sm">
            {getFirstName(name)[0].toUpperCase()}
        </span>
    );
}

// ─── Compact premium action row ───────────────────────────────────────────
function ActionRow({
    href, icon, label, accent, onClick,
}: {
    href: string; icon: React.ReactNode; label: string; accent?: "gold"; onClick: () => void;
}) {
    return (
        <Link
            href={href}
            onClick={onClick}
            className="group flex items-center justify-between rounded-fk-md px-3 py-3 text-[14px] font-semibold text-fk-text transition-colors hover:bg-fk-surface-interactive active:scale-[0.99] motion-reduce:active:scale-100"
        >
            <div className="flex items-center gap-3">
                <span
                    className={
                        accent === "gold"
                            ? "flex h-9 w-9 shrink-0 items-center justify-center rounded-fk-sm bg-fk-gold-soft text-fk-gold"
                            : "flex h-9 w-9 shrink-0 items-center justify-center rounded-fk-sm bg-fk-surface-selected text-fk-text-secondary"
                    }
                >
                    {icon}
                </span>
                {label}
            </div>
            <ChevronRight size={14} className="shrink-0 text-fk-text-tertiary transition-transform group-hover:translate-x-0.5" />
        </Link>
    );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
    return (
        <p className="px-3 pb-1.5 pt-3 text-[10px] font-black uppercase tracking-[0.18em] text-fk-text-tertiary first:pt-0">
            {children}
        </p>
    );
}

export default function AccountDialog({
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
    const panelRef = useRef<HTMLDivElement | null>(null);
    const previouslyFocusedRef = useRef<HTMLElement | null>(null);
    const [mounted, setMounted] = useState(false);
    const prefersReducedMotion = useReducedMotion();
    useEffect(() => { setMounted(true); }, []);

    // Same focus-trap / Escape / scroll-lock pattern as Dialog.tsx and
    // BottomSheet.tsx — one proven implementation, reused by hand here
    // only because this component can't literally wrap <Dialog> (see file
    // header), not because the behavior itself is meant to differ.
    useEffect(() => {
        if (!open) return;

        previouslyFocusedRef.current = document.activeElement as HTMLElement | null;
        const panel = panelRef.current;
        panel?.querySelector<HTMLElement>('button, [href], input, [tabindex]:not([tabindex="-1"])')?.focus();

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                e.preventDefault();
                onClose();
                return;
            }
            if (e.key === "Tab" && panel) {
                const focusable = panel.querySelectorAll<HTMLElement>(
                    'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
                );
                if (focusable.length === 0) return;
                const first = focusable[0];
                const last = focusable[focusable.length - 1];
                if (e.shiftKey && document.activeElement === first) {
                    e.preventDefault();
                    last.focus();
                } else if (!e.shiftKey && document.activeElement === last) {
                    e.preventDefault();
                    first.focus();
                }
            }
        };

        document.addEventListener("keydown", handleKeyDown);
        document.body.style.overflow = "hidden";

        return () => {
            document.removeEventListener("keydown", handleKeyDown);
            document.body.style.overflow = "";
            previouslyFocusedRef.current?.focus?.();
        };
    }, [open, onClose]);

    const showPWA =
        typeof window !== "undefined" &&
        !!pwaPrompt &&
        !window.matchMedia("(display-mode: standalone)").matches &&
        !sessionStorage.getItem(DISMISS_KEY);

    const authHref = `/auth?mode=${getPreferredAuthMode()}`;

    if (!mounted) return null;

    const entrance = prefersReducedMotion
        ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 }, transition: { duration: 0.01 } }
        : {
            initial: { opacity: 0, scale: 0.96, y: 6 },
            animate: { opacity: 1, scale: 1, y: 0 },
            exit: { opacity: 0, scale: 0.97, y: 4 },
            transition: { duration: 0.2, ease: "easeOut" as const },
        };

    return createPortal(
        <AnimatePresence>
            {open && (
                <>
                    {/* Backdrop — translucent charcoal, not flat black; same
                        z-[100] as Dialog.tsx so this always sits above
                        BottomNavigation (z-50) and FloatingCart (z-40). */}
                    <motion.div
                        key="account-backdrop"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: prefersReducedMotion ? 0.01 : 0.18 }}
                        className="fixed inset-0 z-[100] bg-[#1c1917]/55 backdrop-blur-sm"
                        onClick={onClose}
                        aria-hidden="true"
                    />

                    <div className="fixed inset-0 z-[101] flex items-center justify-center p-4" role="presentation">
                        <motion.div
                            key="account-panel"
                            ref={panelRef}
                            role="dialog"
                            aria-modal="true"
                            aria-label="FoodKnock Account"
                            {...entrance}
                            onClick={(e) => e.stopPropagation()}
                            className="flex max-h-[85vh] w-[90vw] max-w-[420px] flex-col overflow-hidden rounded-[26px] border border-fk-border bg-fk-surface-elevated shadow-fk-lg motion-reduce:transition-none"
                        >
                            {/* ── Header (fixed) ── */}
                            <div className="flex shrink-0 items-center justify-between px-5 pb-1 pt-5">
                                <h2 className="font-display text-[16px] font-black text-fk-text">FoodKnock Account</h2>
                                <button
                                    onClick={onClose}
                                    aria-label="Close"
                                    className="flex h-8 w-8 items-center justify-center rounded-fk-sm bg-fk-surface-interactive text-fk-text-tertiary transition-colors hover:text-fk-text"
                                >
                                    <X size={15} />
                                </button>
                            </div>

                            {/* ── Scrollable body ── */}
                            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-2 pt-3">
                                {authState === "loading" && (
                                    <div className="flex justify-center py-6">
                                        <Loader2 size={20} className="animate-spin text-fk-gold" />
                                    </div>
                                )}

                                {authState === "authenticated" && user && (
                                    <div className="mb-4 rounded-fk-md border border-fk-border bg-gradient-to-br from-fk-gold-soft to-fk-surface-elevated px-4 py-4">
                                        <div className="flex items-center gap-3.5">
                                            <Avatar name={user.name} />
                                            <div className="min-w-0 flex-1">
                                                <p className="truncate text-[16px] font-black text-fk-text">{user.name}</p>
                                                <p className="truncate text-[11.5px] text-fk-text-tertiary">{user.email}</p>
                                            </div>
                                        </div>
                                        {loyaltyBalance !== null && loyaltyBalance > 0 && (
                                            <div className="mt-3 flex items-center gap-2 rounded-fk-sm border border-fk-border bg-fk-surface-elevated px-3 py-2">
                                                <Star size={14} className="text-fk-gold" fill="currentColor" />
                                                <span className="text-[15px] font-black text-[var(--fk-accent)]">{loyaltyBalance} pts</span>
                                                <span className="text-[11px] text-fk-text-tertiary">available</span>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {authState === "unauthenticated" && (
                                    <Link
                                        href={authHref}
                                        onClick={onClose}
                                        className="mb-4 flex items-center justify-between rounded-fk-md border border-fk-border bg-fk-surface-selected px-4 py-4"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="flex h-10 w-10 items-center justify-center rounded-fk-sm bg-gradient-to-br from-[var(--fk-accent)] to-[var(--fk-gold)]">
                                                <LogIn size={17} className="text-white" />
                                            </div>
                                            <div>
                                                <p className="text-[14px] font-bold text-fk-text">Sign in to FoodKnock</p>
                                                <p className="text-[11px] text-fk-text-tertiary">Track orders &amp; earn rewards</p>
                                            </div>
                                        </div>
                                        <ChevronRight size={16} className="text-[var(--fk-accent)]" />
                                    </Link>
                                )}

                                <div>
                                    {authState === "authenticated" && (
                                        <>
                                            <SectionLabel>Quick Actions</SectionLabel>
                                            <ActionRow href="/account" icon={<User size={15} />} label="My Account" onClick={onClose} />
                                            <ActionRow href="/notifications" icon={<Bell size={15} />} label="Notifications" onClick={onClose} />
                                        </>
                                    )}
                                    <SectionLabel>Rewards &amp; Support</SectionLabel>
                                    <ActionRow href="/review-rewards" icon={<MessageSquare size={15} />} label="Review Rewards" onClick={onClose} />
                                    <ActionRow href="/reviews" icon={<MessageSquare size={15} />} label="Write a Review" onClick={onClose} />
                                    <ActionRow href="/contact" icon={<Phone size={15} />} label="Contact Us" onClick={onClose} />

                                    {authState === "authenticated" && user?.role === "admin" && (
                                        <>
                                            <SectionLabel>Admin</SectionLabel>
                                            <ActionRow href="/admin" icon={<LayoutDashboard size={15} />} label="Admin Panel" accent="gold" onClick={onClose} />
                                        </>
                                    )}

                                    {showPWA && (
                                        <button
                                            onClick={() => { onInstallPWA(); onClose(); }}
                                            className="flex w-full items-center justify-between rounded-fk-md px-3 py-3 text-[14px] font-semibold text-fk-text transition-colors hover:bg-fk-surface-interactive"
                                        >
                                            <div className="flex items-center gap-3">
                                                <span className="flex h-9 w-9 items-center justify-center rounded-fk-sm bg-fk-surface-selected text-fk-text-secondary">
                                                    <Download size={15} />
                                                </span>
                                                Install App
                                            </div>
                                            <ChevronRight size={14} className="text-fk-text-tertiary" />
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* ── Footer (fixed) ── */}
                            {authState === "authenticated" && (
                                <div className="shrink-0 border-t border-fk-border px-5 py-3.5">
                                    <button
                                        onClick={onLogout}
                                        disabled={loggingOut}
                                        className="flex w-full items-center justify-center gap-2 rounded-fk-md border border-fk-danger/30 bg-fk-danger/10 px-4 py-3 text-[13.5px] font-semibold text-fk-danger transition-all hover:brightness-110 disabled:opacity-50"
                                    >
                                        {loggingOut ? <Loader2 size={15} className="animate-spin" /> : <LogOut size={15} />}
                                        Logout
                                    </button>
                                </div>
                            )}
                        </motion.div>
                    </div>
                </>
            )}
        </AnimatePresence>,
        document.body
    );
}
