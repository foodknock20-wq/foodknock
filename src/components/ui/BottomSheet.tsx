"use client";

// src/components/ui/BottomSheet.tsx
//
// FoodKnock UI 2.0 — Phase 1 design-system primitive. Generalizes the
// fixed-overlay mechanism already proven across
// src/components/shared/LocationPickerSheet.tsx and Navbar's inline
// AccountSheet (mobile bottom sheet / desktop centered modal, outside-
// click-close, Escape-close, body-scroll-lock, safe-area bottom padding)
// into one reusable base with header/body/footer slots, so future sheets
// (filters, sort, product options, coupon, payment) don't hand-roll this
// again.
//
// Pre-Phase 17 Phase 4 — ROOT-CAUSE FIX: now rendered through a React
// portal into document.body, not in document order. `position: fixed`
// only escapes to the viewport if NO ancestor establishes a new containing
// block — but `transform`, `filter`, AND `backdrop-filter` (Tailwind's
// `backdrop-blur-*`, used by CustomerHeader's sticky header) all do this
// per the CSS Filter Effects spec. LocationPickerSheet is rendered via
// LocationTrigger, which lives INSIDE CustomerHeader's `backdrop-blur-xl`
// header element — so before this fix, the sheet's "fixed" backdrop/panel
// were actually positioned/clipped relative to that header, not the
// viewport: exactly the reported bug ("sheet appears in normal document
// flow and visually moves page content"). Portaling to document.body
// removes the sheet from that ancestor chain entirely, independent of
// where any future caller mounts the trigger. Every existing BottomSheet
// consumer (LocationPickerSheet, MenuFilters, MenuSort, SpinConfirmationDialog,
// ReferralPill, WriteReviewSheet, ...) gets this fix automatically — one
// implementation, not a per-caller workaround. (Account used to be one of
// these too — src/components/shell/AccountSheet.tsx — until Luxury
// Navigation 2.0 moved it to a centered AccountDialog; see that file.)
//
// SSR/hydration safety: renders null until mounted (server and the very
// first client paint both render nothing — sheets are always closed at
// initial mount, so there is no visible content to lose), then swaps to
// the portal. No hydration mismatch, no flash.

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface BottomSheetProps {
    open: boolean;
    onClose: () => void;
    title?: string;
    children: React.ReactNode;
    footer?: React.ReactNode;
    ariaLabel?: string;
}

export default function BottomSheet({ open, onClose, title, children, footer, ariaLabel }: BottomSheetProps) {
    const sheetRef = useRef<HTMLDivElement>(null);
    const [mounted, setMounted] = useState(false);
    useEffect(() => { setMounted(true); }, []);

    useEffect(() => {
        if (!open) return;
        const handleClick = (e: MouseEvent) => {
            if (sheetRef.current && !sheetRef.current.contains(e.target as Node)) onClose();
        };
        const handleKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        document.addEventListener("mousedown", handleClick);
        document.addEventListener("keydown", handleKey);
        return () => {
            document.removeEventListener("mousedown", handleClick);
            document.removeEventListener("keydown", handleKey);
        };
    }, [open, onClose]);

    useEffect(() => {
        document.body.style.overflow = open ? "hidden" : "";
        return () => {
            document.body.style.overflow = "";
        };
    }, [open]);

    if (!mounted) return null;

    return createPortal(
        <>
            <div
                className={cn(
                    "fixed inset-0 z-[60] transition-all duration-300",
                    open ? "pointer-events-auto bg-black/50 backdrop-blur-sm" : "pointer-events-none bg-transparent"
                )}
                aria-hidden="true"
            />
            <div
                className={cn(
                    "fixed inset-0 z-[70] flex items-end justify-center sm:items-center",
                    !open && "pointer-events-none"
                )}
            >
                <div
                    ref={sheetRef}
                    className={cn(
                        "flex w-full max-w-md flex-col rounded-t-fk-lg border border-fk-border bg-fk-surface-elevated transition-transform duration-[300ms] ease-[cubic-bezier(0.34,1.1,0.64,1)] sm:rounded-fk-lg",
                        "motion-reduce:transition-none",
                        open ? "translate-y-0 opacity-100" : "translate-y-full opacity-0 sm:translate-y-4"
                    )}
                    style={{
                        boxShadow: "0 -8px 32px rgba(28,25,23,0.14)",
                        // Reviews 2.1 — ROOT-CAUSE FIX: `overflowY: auto` used to
                        // live on THIS outer element, making header/handle/
                        // children/footer all one scrollable region — a `footer`
                        // (e.g. a sticky submit CTA) could scroll out of view
                        // along with long content, with no guarantee it stays
                        // visible. No existing caller passes `footer` today (all
                        // 7 current consumers put their own action button inside
                        // `children`), so this restructure is zero-risk for them
                        // and only changes behavior for content tall enough to
                        // overflow in the first place — exactly the previously-
                        // broken case. Now only the middle content region
                        // scrolls; header and footer are fixed flex children of
                        // this column, so a `footer` is now ALWAYS visible.
                        maxHeight: "90vh",
                    }}
                    aria-modal="true"
                    role="dialog"
                    aria-label={ariaLabel ?? title}
                >
                    <div className="flex shrink-0 justify-center pt-3 pb-1 sm:hidden">
                        <div className="h-1 w-10 rounded-full bg-fk-border" />
                    </div>

                    {title && (
                        <div className="flex shrink-0 items-center justify-between px-5 pt-3 sm:pt-5">
                            <h2 className="font-display text-base font-black text-fk-text">{title}</h2>
                            <button
                                onClick={onClose}
                                aria-label="Close"
                                className="flex h-8 w-8 items-center justify-center rounded-fk-sm bg-fk-surface-interactive text-fk-text-tertiary transition-colors hover:text-fk-text"
                            >
                                <X size={15} />
                            </button>
                        </div>
                    )}

                    <div
                        className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pt-4"
                        style={{ paddingBottom: footer ? "16px" : "calc(16px + var(--fk-safe-bottom))" }}
                    >
                        {children}
                    </div>

                    {footer && (
                        <div
                            className="shrink-0 border-t border-fk-border px-5 pt-4"
                            style={{ paddingBottom: "calc(16px + var(--fk-safe-bottom))" }}
                        >
                            {footer}
                        </div>
                    )}
                </div>
            </div>
        </>,
        document.body
    );
}
