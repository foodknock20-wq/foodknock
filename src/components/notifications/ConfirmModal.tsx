"use client";

// src/components/notifications/ConfirmModal.tsx
//
// FoodKnock — premium confirmation modal, replacing window.confirm().
// Generic enough to reuse anywhere a destructive confirm is needed, but
// introduced here specifically for NotificationInbox's "Clear all".
//
// Full keyboard/focus handling: Escape closes, click-outside-content
// closes, focus is trapped inside while open and returned to the
// triggering element on close, initial focus lands on Cancel (safer
// default for a destructive action).

import { useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, TriangleAlert } from "lucide-react";

type Props = {
    open: boolean;
    title: string;
    description: string;
    confirmLabel?: string;
    cancelLabel?: string;
    loading?: boolean;
    destructive?: boolean;
    onConfirm: () => void;
    onCancel: () => void;
};

export default function ConfirmModal({
    open,
    title,
    description,
    confirmLabel = "Confirm",
    cancelLabel = "Cancel",
    loading = false,
    destructive = true,
    onConfirm,
    onCancel,
}: Props) {
    const dialogRef = useRef<HTMLDivElement | null>(null);
    const cancelBtnRef = useRef<HTMLButtonElement | null>(null);
    const previouslyFocusedRef = useRef<HTMLElement | null>(null);

    useEffect(() => {
        if (!open) return;

        previouslyFocusedRef.current = document.activeElement as HTMLElement | null;
        cancelBtnRef.current?.focus();

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape" && !loading) {
                e.preventDefault();
                onCancel();
                return;
            }
            if (e.key === "Tab") {
                const dialog = dialogRef.current;
                if (!dialog) return;
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
    }, [open, loading, onCancel]);

    const handleBackdropClick = useCallback(() => {
        if (!loading) onCancel();
    }, [loading, onCancel]);

    return (
        <AnimatePresence>
            {open && (
                <>
                    <motion.div
                        key="backdrop"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.18 }}
                        className="fixed inset-0 z-[100] bg-stone-900/40 backdrop-blur-sm"
                        onClick={handleBackdropClick}
                        aria-hidden="true"
                    />
                    <div
                        className="fixed inset-0 z-[101] flex items-center justify-center p-4"
                        role="presentation"
                    >
                        <motion.div
                            key="dialog"
                            ref={dialogRef}
                            role="alertdialog"
                            aria-modal="true"
                            aria-labelledby="confirm-modal-title"
                            aria-describedby="confirm-modal-description"
                            initial={{ opacity: 0, scale: 0.94, y: 12 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.96, y: 8 }}
                            transition={{ type: "spring", stiffness: 420, damping: 32 }}
                            onClick={(e) => e.stopPropagation()}
                            className="w-full max-w-[380px] rounded-3xl border border-orange-100 bg-white p-6 shadow-2xl shadow-orange-900/10"
                        >
                            <div
                                className={[
                                    "mb-4 flex h-11 w-11 items-center justify-center rounded-2xl",
                                    destructive ? "bg-red-50" : "bg-orange-50",
                                ].join(" ")}
                            >
                                <TriangleAlert
                                    size={20}
                                    className={destructive ? "text-red-500" : "text-orange-500"}
                                    strokeWidth={2.25}
                                />
                            </div>

                            <h2
                                id="confirm-modal-title"
                                className="text-[17px] font-black text-stone-900"
                                style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
                            >
                                {title}
                            </h2>
                            <p
                                id="confirm-modal-description"
                                className="mt-1.5 text-[13.5px] leading-relaxed text-stone-500"
                            >
                                {description}
                            </p>

                            <div className="mt-6 flex items-center gap-2.5">
                                <button
                                    ref={cancelBtnRef}
                                    type="button"
                                    onClick={onCancel}
                                    disabled={loading}
                                    className="flex min-h-[44px] flex-1 items-center justify-center rounded-2xl border border-stone-200 bg-white px-4 text-[13.5px] font-bold text-stone-600 transition-colors hover:bg-stone-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 focus-visible:ring-offset-2 disabled:opacity-50"
                                >
                                    {cancelLabel}
                                </button>
                                <button
                                    type="button"
                                    onClick={onConfirm}
                                    disabled={loading}
                                    className={[
                                        "flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-2xl px-4 text-[13.5px] font-black text-white transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-70",
                                        destructive
                                            ? "bg-gradient-to-r from-red-500 to-rose-500 hover:brightness-105 focus-visible:ring-red-400"
                                            : "bg-gradient-to-r from-orange-500 to-amber-500 hover:brightness-105 focus-visible:ring-orange-400",
                                    ].join(" ")}
                                >
                                    {loading && <Loader2 size={14} className="animate-spin" />}
                                    {loading ? "Working…" : confirmLabel}
                                </button>
                            </div>
                        </motion.div>
                    </div>
                </>
            )}
        </AnimatePresence>
    );
}