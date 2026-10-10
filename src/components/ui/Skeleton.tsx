// src/components/ui/Skeleton.tsx
//
// FoodKnock UI 2.0 — Phase 1 design-system primitive. Dark, fk-token
// shimmer skeletons for the new (non-live) ProductCardShell/CategoryCardShell
// foundations — see src/components/ui/ProductCardShell.tsx. The existing
// route-level loading.tsx skeletons (menu/loading.tsx, (main)/loading.tsx)
// are bespoke, pixel-matched to the still-light-themed live pages they
// precede, and are intentionally left untouched this phase rather than
// reskinned dark — see Phase 1 plan's scope boundary.

import { cn } from "@/lib/utils";

export function Skeleton({ className }: { className?: string }) {
    return <div className={cn("fk-skeleton rounded-fk-sm", className)} aria-hidden="true" />;
}

export function ProductCardSkeleton() {
    return (
        <div className="overflow-hidden rounded-fk-lg border border-fk-border bg-fk-surface-elevated">
            <Skeleton className="h-36 w-full rounded-none sm:h-44" />
            <div className="space-y-2 p-3 sm:p-4">
                <Skeleton className="h-4 w-20 rounded-fk-pill" />
                <Skeleton className="h-4 w-[85%]" />
                <Skeleton className="h-4 w-[55%]" />
                <div className="mt-2 flex items-center justify-between gap-2">
                    <Skeleton className="h-5 w-14" />
                    <Skeleton className="h-9 w-20 rounded-fk-md" />
                </div>
            </div>
        </div>
    );
}

export function CategorySkeleton() {
    return (
        <div className="flex shrink-0 flex-col items-center gap-2">
            <Skeleton className="h-16 w-16 rounded-fk-lg" />
            <Skeleton className="h-3 w-12" />
        </div>
    );
}

export function SectionSkeleton({ cards = 4 }: { cards?: number }) {
    return (
        <div>
            <div className="mb-4 flex items-center justify-between">
                <Skeleton className="h-6 w-40" />
                <Skeleton className="h-8 w-20 rounded-fk-md" />
            </div>
            <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
                {Array.from({ length: cards }).map((_, i) => (
                    <ProductCardSkeleton key={i} />
                ))}
            </div>
        </div>
    );
}

export function ListSkeleton({ rows = 4 }: { rows?: number }) {
    return (
        <div className="space-y-3">
            {Array.from({ length: rows }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 rounded-fk-md border border-fk-border bg-fk-surface-elevated p-3">
                    <Skeleton className="h-12 w-12 shrink-0 rounded-fk-md" />
                    <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-[70%]" />
                        <Skeleton className="h-3 w-[40%]" />
                    </div>
                </div>
            ))}
        </div>
    );
}
