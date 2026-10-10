"use client";

// src/components/ui/Input.tsx — FoodKnock UI 2.0 Phase 1 primitive.
// Standardized text input (default/focus/error/disabled/loading states).
// Does not replace src/components/auth/OtpInput.tsx, which already has
// its own bespoke a11y/navigation behavior — this is for plain single
// fields (search, address lines, coupon code, etc.).

import { forwardRef } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    error?: boolean;
    loading?: boolean;
    leadingIcon?: React.ReactNode;
    trailingIcon?: React.ReactNode;
}

const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
    { error = false, loading = false, leadingIcon, trailingIcon, disabled, className, ...props },
    ref
) {
    return (
        <div className="relative flex items-center">
            {leadingIcon && (
                <span className="pointer-events-none absolute left-3.5 flex items-center text-fk-text-tertiary">
                    {leadingIcon}
                </span>
            )}
            <input
                ref={ref}
                disabled={disabled || loading}
                className={cn(
                    "h-11 min-h-[44px] w-full rounded-fk-md border bg-fk-surface-elevated px-3.5 text-[14px] text-fk-text placeholder:text-fk-text-tertiary",
                    "transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-fk-bg",
                    error
                        ? "border-fk-danger focus:ring-fk-danger"
                        : "border-fk-border focus:border-[var(--fk-accent)] focus:ring-[var(--fk-accent)]",
                    disabled && "cursor-not-allowed opacity-50",
                    leadingIcon && "pl-10",
                    (trailingIcon || loading) && "pr-10",
                    className
                )}
                aria-invalid={error || undefined}
                {...props}
            />
            {loading ? (
                <Loader2 size={16} className="absolute right-3.5 animate-spin text-fk-text-tertiary motion-reduce:animate-none" />
            ) : (
                trailingIcon && <span className="absolute right-3.5 flex items-center text-fk-text-tertiary">{trailingIcon}</span>
            )}
        </div>
    );
});

export default Input;
