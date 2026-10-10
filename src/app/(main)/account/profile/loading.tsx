// src/app/(main)/account/profile/loading.tsx
//
// Matches ProfileForm's actual shape: name + DOB fields with a save
// button, then a read-only contact-details card. ProfileForm itself needs
// no fetch (user comes from AccountContext set by the layout), so this
// only shows up while the layout's own auth/user fetch is still pending.

import { SkeletonBlock, SkeletonCard } from "@/components/account/AccountSkeleton";

export default function AccountProfileLoading() {
    return (
        <div className="space-y-5" aria-busy="true" aria-label="Loading profile">
            <SkeletonCard>
                <SkeletonBlock className="h-3 w-20" />
                <SkeletonBlock className="mt-1.5 h-10 w-full rounded-fk-md" />
                <SkeletonBlock className="mt-4 h-3 w-24" />
                <SkeletonBlock className="mt-1.5 h-10 w-full rounded-fk-md" />
                <SkeletonBlock className="mt-4 h-11 w-full rounded-fk-md" />
            </SkeletonCard>

            <div className="overflow-hidden rounded-fk-lg border border-fk-border bg-fk-surface-elevated">
                <SkeletonBlock className="m-4 h-3 w-28" />
                {Array.from({ length: 2 }).map((_, i) => (
                    <div
                        key={i}
                        className={`flex items-center gap-3 px-4 py-3.5 ${i === 0 ? "border-b border-fk-border" : ""}`}
                    >
                        <SkeletonBlock className="h-4 w-4 shrink-0" />
                        <div className="flex-1 space-y-1.5">
                            <SkeletonBlock className="h-3.5 w-36" />
                            <SkeletonBlock className="h-3 w-44" />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
