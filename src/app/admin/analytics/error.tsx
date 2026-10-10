"use client";

// src/app/admin/analytics/error.tsx
// Phase 15D — route-level error boundary. Never exposes the raw error
// (stack traces/internal messages) to the admin UI; offers a retry that
// re-runs the server render without a full page reload.

import { useEffect } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";

export default function AnalyticsError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
    useEffect(() => {
        console.error("ADMIN_ANALYTICS_ERROR", error);
    }, [error]);

    return (
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-rose-500/20 bg-rose-500/6 px-6 py-16 text-center">
            <AlertTriangle size={24} className="text-rose-400" />
            <p className="text-sm font-bold text-stone-200">Unable to load analytics</p>
            <p className="max-w-sm text-[11px] text-stone-600">
                Something went wrong computing this section. Your data is unaffected — try again.
            </p>
            <button
                type="button"
                onClick={() => reset()}
                className="mt-2 flex items-center gap-1.5 rounded-xl border border-amber-500/20 bg-amber-500/8 px-4 py-2 text-[11px] font-bold text-amber-400 hover:bg-amber-500/15"
            >
                <RotateCcw size={12} />
                Retry
            </button>
        </div>
    );
}
