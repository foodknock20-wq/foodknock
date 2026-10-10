"use client";

// src/components/ui/Badge.tsx — FoodKnock UI 2.0 Phase 1 primitive.
// Generic status/discount badge — generalizes the bespoke badge markup
// duplicated across OrderStatusBadge/ProductCard/CategorySection into one
// shape-level primitive. Domain-specific badges (order status colors,
// etc.) can wrap this rather than re-implementing the pill markup.

import { cn } from "@/lib/utils";

type BadgeTone = "accent" | "gold" | "success" | "danger" | "neutral";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
    tone?: BadgeTone;
    icon?: React.ReactNode;
}

const TONE_CLASSES: Record<BadgeTone, string> = {
    accent: "bg-fk-surface-selected text-[var(--fk-accent)]",
    gold: "bg-fk-surface-selected text-fk-gold",
    success: "bg-fk-surface-elevated text-fk-success",
    danger: "bg-fk-surface-elevated text-fk-danger",
    neutral: "bg-fk-surface-elevated text-fk-text-secondary",
};

export default function Badge({ tone = "neutral", icon, className, children, ...props }: BadgeProps) {
    return (
        <span
            className={cn(
                "inline-flex items-center gap-1 rounded-fk-pill px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider",
                TONE_CLASSES[tone],
                className
            )}
            {...props}
        >
            {icon}
            {children}
        </span>
    );
}

export function DiscountBadge({ percent, className }: { percent: number; className?: string }) {
    if (percent <= 0) return null;
    return (
        <Badge tone="danger" className={cn("normal-case tracking-normal", className)}>
            {percent}% OFF
        </Badge>
    );
}
