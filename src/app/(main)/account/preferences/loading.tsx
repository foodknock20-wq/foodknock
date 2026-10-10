// src/app/(main)/account/preferences/loading.tsx
//
// Matches NotificationSettings' one-toggle-per-category list (9 rows:
// orderUpdates, offers, rewards, lunchDeals, eveningDeals, festivalOffers,
// flashSales, priceDrops, systemUpdates). This page does its own
// getNotificationPreferences() DB fetch beyond the layout's user fetch.

import { SkeletonBlock } from "@/components/account/AccountSkeleton";

const ROWS = 9;

export default function AccountPreferencesLoading() {
    return (
        <div className="overflow-hidden rounded-fk-lg border border-fk-border bg-fk-surface-elevated" aria-busy="true" aria-label="Loading preferences">
            {Array.from({ length: ROWS }).map((_, i) => (
                <div
                    key={i}
                    className={`flex items-center gap-3 px-4 py-3.5 ${i !== ROWS - 1 ? "border-b border-fk-border" : ""}`}
                >
                    <SkeletonBlock className="h-9 w-9 shrink-0 rounded-fk-sm" />
                    <div className="flex-1 space-y-1.5">
                        <SkeletonBlock className="h-3.5 w-32" />
                        <SkeletonBlock className="h-3 w-44" />
                    </div>
                    <SkeletonBlock className="h-7 w-12 shrink-0 rounded-full" />
                </div>
            ))}
        </div>
    );
}
