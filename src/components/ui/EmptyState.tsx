"use client";

// src/components/ui/EmptyState.tsx — FoodKnock UI 2.0 Phase 1 primitive.
// Generalizes src/components/notifications/EmptyInboxState.tsx (hardcoded
// icon/copy/CTA) into a reusable, prop-driven primitive. EmptyInboxState
// itself is left as-is this phase (not migrated).

import Link from "next/link";
import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";

export interface EmptyStateProps {
    icon: LucideIcon;
    title: string;
    description?: string;
    ctaLabel?: string;
    ctaHref?: string;
    onCtaClick?: () => void;
}

export default function EmptyState({ icon: Icon, title, description, ctaLabel, ctaHref, onCtaClick }: EmptyStateProps) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: "easeOut" }}
            className="flex flex-col items-center px-6 py-16 text-center"
        >
            <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-fk-lg bg-fk-surface-selected">
                <Icon size={28} className="text-[var(--fk-accent)]" strokeWidth={1.75} />
            </div>
            <h2 className="font-display text-[19px] font-black text-fk-text">{title}</h2>
            {description && (
                <p className="mt-2 max-w-[300px] text-[13.5px] leading-relaxed text-fk-text-secondary">{description}</p>
            )}
            {ctaLabel && ctaHref && (
                <Link
                    href={ctaHref}
                    onClick={onCtaClick}
                    className="mt-6 flex items-center gap-2 rounded-fk-pill bg-gradient-to-r from-[var(--fk-accent)] to-[var(--fk-gold)] px-6 py-3 text-[13.5px] font-black text-white shadow-lg shadow-black/20 transition-all hover:brightness-110 active:scale-[0.97]"
                >
                    {ctaLabel}
                </Link>
            )}
            {ctaLabel && !ctaHref && onCtaClick && (
                <button
                    onClick={onCtaClick}
                    className="mt-6 flex items-center gap-2 rounded-fk-pill bg-gradient-to-r from-[var(--fk-accent)] to-[var(--fk-gold)] px-6 py-3 text-[13.5px] font-black text-white shadow-lg shadow-black/20 transition-all hover:brightness-110 active:scale-[0.97]"
                >
                    {ctaLabel}
                </button>
            )}
        </motion.div>
    );
}
