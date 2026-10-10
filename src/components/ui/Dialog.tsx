"use client";

// src/components/ui/Dialog.tsx
//
// FoodKnock UI 2.0 — Phase 1 design-system primitive. Generalizes the
// focus-trap / Escape / body-scroll-lock / focus-return behavior already
// proven in src/components/notifications/ConfirmModal.tsx into a reusable
// base, so new dialogs don't hand-roll that logic again. ConfirmModal
// itself is left as-is in this phase (not migrated) to avoid regressing
// its existing callers.
//
// Pre-Phase 17 Phase 4 — same root-cause portal fix as BottomSheet.tsx:
// `position: fixed` escapes to the viewport only if no ancestor establishes
// a new containing block, and `backdrop-filter`/`transform`/`filter` all do
// (CSS Filter Effects spec) — a Dialog mounted under CustomerHeader's
// `backdrop-blur-*` sticky header would otherwise be positioned/clipped
// relative to that header instead of the viewport. Portaling to
// document.body makes every Dialog consumer safe regardless of where it's
// triggered from, without each caller needing to know why.

import { useEffect, useRef, useCallback, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, Info, TriangleAlert, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

type DialogTone = "info" | "warning" | "error" | "success" | "confirmation";

export interface DialogProps {
    open: boolean;
    onClose: () => void;
    title: string;
    description?: string;
    tone?: DialogTone;
    children?: React.ReactNode;
    footer?: React.ReactNode;
    closeOnBackdrop?: boolean;
}

const TONE_ICON: Record<DialogTone, React.ReactNode> = {
    info: <Info size={20} className="text-[var(--fk-accent)]" strokeWidth={2.25} />,
    warning: <TriangleAlert size={20} className="text-fk-gold" strokeWidth={2.25} />,
    error: <XCircle size={20} className="text-fk-danger" strokeWidth={2.25} />,
    success: <CheckCircle2 size={20} className="text-fk-success" strokeWidth={2.25} />,
    confirmation: <TriangleAlert size={20} className="text-fk-danger" strokeWidth={2.25} />,
};

export default function Dialog({
    open,
    onClose,
    title,
    description,
    tone = "info",
    children,
    footer,
    closeOnBackdrop = true,
}: DialogProps) {
    const dialogRef = useRef<HTMLDivElement | null>(null);
    const previouslyFocusedRef = useRef<HTMLElement | null>(null);
    const [mounted, setMounted] = useState(false);
    useEffect(() => { setMounted(true); }, []);

    useEffect(() => {
        if (!open) return;

        previouslyFocusedRef.current = document.activeElement as HTMLElement | null;
        const dialog = dialogRef.current;
        dialog?.querySelector<HTMLElement>('button, [href], input, [tabindex]:not([tabindex="-1"])')?.focus();

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                e.preventDefault();
                onClose();
                return;
            }
            if (e.key === "Tab" && dialog) {
                const focusable = dialog.querySelectorAll<HTMLElement>(
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

    const handleBackdropClick = useCallback(() => {
        if (closeOnBackdrop) onClose();
    }, [closeOnBackdrop, onClose]);

    if (!mounted) return null;

    return createPortal(
        <AnimatePresence>
            {open && (
                <>
                    <motion.div
                        key="backdrop"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.18 }}
                        className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm"
                        onClick={handleBackdropClick}
                        aria-hidden="true"
                    />
                    <div className="fixed inset-0 z-[101] flex items-center justify-center p-4" role="presentation">
                        <motion.div
                            key="dialog"
                            ref={dialogRef}
                            role="alertdialog"
                            aria-modal="true"
                            aria-labelledby="fk-dialog-title"
                            aria-describedby={description ? "fk-dialog-description" : undefined}
                            initial={{ opacity: 0, scale: 0.94, y: 12 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.96, y: 8 }}
                            transition={{ type: "spring", stiffness: 420, damping: 32 }}
                            onClick={(e) => e.stopPropagation()}
                            className={cn(
                                "w-full max-w-[400px] rounded-fk-lg border border-fk-border bg-fk-surface-elevated p-6 shadow-fk-lg",
                                "motion-reduce:transition-none"
                            )}
                        >
                            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-fk-md bg-fk-surface-selected">
                                {TONE_ICON[tone]}
                            </div>

                            <h2 id="fk-dialog-title" className="font-display text-[17px] font-black text-fk-text">
                                {title}
                            </h2>
                            {description && (
                                <p id="fk-dialog-description" className="mt-1.5 text-[13.5px] leading-relaxed text-fk-text-secondary">
                                    {description}
                                </p>
                            )}

                            {children && <div className="mt-4">{children}</div>}
                            {footer && <div className="mt-6 flex items-center gap-2.5">{footer}</div>}
                        </motion.div>
                    </div>
                </>
            )}
        </AnimatePresence>,
        document.body
    );
}
