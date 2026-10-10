// src/app/(main)/account/addresses/loading.tsx
//
// Matches AddressManager's default (non-form) view: a couple of address
// cards plus the "Add new address" action beneath them. This page does
// its own server-side listAddresses() fetch on top of the layout's user
// fetch, so it's the one /account subroute most likely to actually show
// this skeleton on a slow connection.

import { SkeletonBlock, SkeletonCard } from "@/components/account/AccountSkeleton";

export default function AccountAddressesLoading() {
    return (
        <div className="space-y-4" aria-busy="true" aria-label="Loading addresses">
            {Array.from({ length: 2 }).map((_, i) => (
                <SkeletonCard key={i}>
                    <div className="flex items-start gap-3">
                        <SkeletonBlock className="h-9 w-9 shrink-0 rounded-fk-sm" />
                        <div className="flex-1 space-y-2">
                            <SkeletonBlock className="h-3.5 w-24" />
                            <SkeletonBlock className="h-3 w-full" />
                            <SkeletonBlock className="h-3 w-3/4" />
                        </div>
                    </div>
                    <div className="mt-3 flex gap-2">
                        <SkeletonBlock className="h-7 w-24 rounded-fk-sm" />
                        <SkeletonBlock className="h-7 w-16 rounded-fk-sm" />
                    </div>
                </SkeletonCard>
            ))}

            <SkeletonBlock className="h-11 w-full rounded-fk-md" />
        </div>
    );
}
