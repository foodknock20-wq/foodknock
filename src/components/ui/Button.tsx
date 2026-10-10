"use client";

// src/components/ui/Button.tsx
//
// FoodKnock UI 2.0 — Phase 1 design-system primitive. Hand-written variant
// map (no class-variance-authority dependency added — none of it existed
// in the repo and this is the only component family that needs variants).
// Standardizes the ~40 copy-pasted "orange-to-amber gradient CTA" class
// strings found across the codebase into one reusable component for new
// shell/primitive work. Existing call sites are NOT migrated in this
// phase — see Phase 1 plan's scope boundary.

import { forwardRef } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "compact";
type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: ButtonVariant;
    size?: ButtonSize;
    loading?: boolean;
    icon?: React.ReactNode;
    fullWidth?: boolean;
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
    primary:
        "bg-gradient-to-r from-[var(--fk-accent)] to-[var(--fk-gold)] text-white shadow-lg shadow-black/20 hover:brightness-110 active:scale-[0.97]",
    secondary:
        "border border-fk-border bg-fk-surface-elevated text-fk-text hover:bg-fk-surface-interactive active:scale-[0.97]",
    ghost:
        "text-fk-text-secondary hover:bg-fk-surface-interactive hover:text-fk-text active:scale-[0.97]",
    danger:
        "bg-fk-danger text-white hover:brightness-110 active:scale-[0.97]",
    compact:
        "bg-fk-surface-interactive text-fk-text text-[12px] hover:bg-fk-surface-elevated active:scale-[0.97]",
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
    sm: "h-9 min-h-[36px] px-3.5 text-[13px] rounded-fk-md gap-1.5",
    md: "h-11 min-h-[44px] px-5 text-[14px] rounded-fk-md gap-2",
    lg: "h-[52px] min-h-[52px] px-6 text-[15px] rounded-fk-lg gap-2",
};

const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
    {
        variant = "primary",
        size = "md",
        loading = false,
        icon,
        fullWidth = false,
        disabled,
        className,
        children,
        ...props
    },
    ref
) {
    return (
        <button
            ref={ref}
            disabled={disabled || loading}
            className={cn(
                "inline-flex items-center justify-center font-bold transition-all duration-150",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--fk-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-fk-bg",
                "disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100",
                "motion-reduce:transition-none motion-reduce:active:scale-100",
                VARIANT_CLASSES[variant],
                SIZE_CLASSES[size],
                fullWidth && "w-full",
                className
            )}
            {...props}
        >
            {loading ? (
                <Loader2 size={16} className="animate-spin motion-reduce:animate-none" />
            ) : (
                icon
            )}
            {children}
        </button>
    );
});

export default Button;
