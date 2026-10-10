"use client";

// src/components/ui/ErrorState.tsx — FoodKnock UI 2.0 Phase 1 primitive.
// Generic network/API failure state — no existing equivalent was found in
// the audit (src/app/admin/analytics/error.tsx is a Next.js route error
// boundary, not a reusable component).

import { AlertTriangle } from "lucide-react";
import Button from "./Button";

export interface ErrorStateProps {
    title?: string;
    description?: string;
    onRetry?: () => void;
}

export default function ErrorState({
    title = "Something went wrong",
    description = "Please check your connection and try again.",
    onRetry,
}: ErrorStateProps) {
    return (
        <div className="flex flex-col items-center px-6 py-16 text-center">
            <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-fk-lg bg-fk-surface-elevated">
                <AlertTriangle size={28} className="text-fk-danger" strokeWidth={1.75} />
            </div>
            <h2 className="font-display text-[19px] font-black text-fk-text">{title}</h2>
            <p className="mt-2 max-w-[300px] text-[13.5px] leading-relaxed text-fk-text-secondary">{description}</p>
            {onRetry && (
                <Button variant="primary" size="md" onClick={onRetry} className="mt-6">
                    Try again
                </Button>
            )}
        </div>
    );
}
