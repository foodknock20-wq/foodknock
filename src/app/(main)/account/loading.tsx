// src/app/(main)/account/loading.tsx
//
// Route-level skeleton for the Account hub ("/account"). AccountShell
// (tab nav) lives in account/layout.tsx and stays mounted during
// navigation — this only replaces the hub content, matching AccountHub's
// actual structure: profile identity header, rewards snapshot, quick
// actions grid, settings list, security list. No fake balances or names.

import { SkeletonBlock, SkeletonCard } from "@/components/account/AccountSkeleton";

export default function AccountLoading() {
    return (
        <div className="space-y-5" aria-busy="true" aria-label="Loading account">
            {/* Profile identity header */}
            <SkeletonCard className="flex items-center gap-4 p-5">
                <SkeletonBlock className="h-14 w-14 shrink-0 rounded-full" />
                <div className="min-w-0 flex-1 space-y-2">
                    <SkeletonBlock className="h-5 w-40" />
                    <SkeletonBlock className="h-3.5 w-28" />
                    <SkeletonBlock className="h-3 w-48" />
                </div>
            </SkeletonCard>

            {/* Rewards snapshot */}
            <SkeletonCard className="flex items-center gap-4 p-5">
                <SkeletonBlock className="h-11 w-11 shrink-0 rounded-fk-md" />
                <div className="min-w-0 flex-1 space-y-2">
                    <SkeletonBlock className="h-3 w-32" />
                    <SkeletonBlock className="h-6 w-20" />
                </div>
                <SkeletonBlock className="h-4 w-20 shrink-0" />
            </SkeletonCard>

            {/* Quick actions grid */}
            <div className="grid grid-cols-4 gap-2.5">
                {Array.from({ length: 4 }).map((_, i) => (
                    <SkeletonCard key={i} className="flex flex-col items-center gap-2 py-4">
                        <SkeletonBlock className="h-9 w-9 rounded-fk-sm" />
                        <SkeletonBlock className="h-3 w-12" />
                    </SkeletonCard>
                ))}
            </div>

            {/* Settings list */}
            <div className="overflow-hidden rounded-fk-lg border border-fk-border bg-fk-surface-elevated">
                {Array.from({ length: 2 }).map((_, i) => (
                    <div
                        key={i}
                        className={`flex items-center gap-3 px-4 py-3.5 ${i !== 1 ? "border-b border-fk-border" : ""}`}
                    >
                        <SkeletonBlock className="h-9 w-9 shrink-0 rounded-fk-sm" />
                        <div className="flex-1 space-y-1.5">
                            <SkeletonBlock className="h-3.5 w-28" />
                            <SkeletonBlock className="h-3 w-40" />
                        </div>
                    </div>
                ))}
            </div>

            {/* Security list */}
            <div className="overflow-hidden rounded-fk-lg border border-fk-border bg-fk-surface-elevated">
                {Array.from({ length: 2 }).map((_, i) => (
                    <div
                        key={i}
                        className={`flex items-center gap-3 px-4 py-3.5 ${i !== 1 ? "border-b border-fk-border" : ""}`}
                    >
                        <SkeletonBlock className="h-9 w-9 shrink-0 rounded-fk-sm" />
                        <SkeletonBlock className="h-3.5 w-32" />
                    </div>
                ))}
            </div>
        </div>
    );
}
