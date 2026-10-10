"use client";

// src/components/ui/IconButton.tsx — FoodKnock UI 2.0 Phase 1 primitive.
// Icon-only button; aria-label is required (not optional) so every
// instance stays screen-reader accessible by construction.

import { forwardRef } from "react";
import { cn } from "@/lib/utils";

type IconButtonVariant = "default" | "selected" | "ghost";
type IconButtonSize = "sm" | "md";

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    "aria-label": string;
    variant?: IconButtonVariant;
    size?: IconButtonSize;
}

const VARIANT_CLASSES: Record<IconButtonVariant, string> = {
    default: "border border-fk-border bg-fk-surface-elevated text-fk-text-secondary hover:text-fk-text hover:bg-fk-surface-interactive",
    selected: "bg-fk-surface-selected text-[var(--fk-accent)]",
    ghost: "text-fk-text-secondary hover:bg-fk-surface-interactive hover:text-fk-text",
};

const SIZE_CLASSES: Record<IconButtonSize, string> = {
    sm: "h-9 w-9 min-h-[36px] min-w-[36px] rounded-fk-sm",
    md: "h-11 w-11 min-h-[44px] min-w-[44px] rounded-fk-md",
};

const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
    { variant = "default", size = "md", className, children, ...props },
    ref
) {
    return (
        <button
            ref={ref}
            className={cn(
                "relative inline-flex shrink-0 items-center justify-center transition-colors duration-150 active:scale-95",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--fk-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-fk-bg",
                "motion-reduce:transition-none motion-reduce:active:scale-100",
                "disabled:cursor-not-allowed disabled:opacity-50",
                VARIANT_CLASSES[variant],
                SIZE_CLASSES[size],
                className
            )}
            {...props}
        >
            {children}
        </button>
    );
});

export default IconButton;
