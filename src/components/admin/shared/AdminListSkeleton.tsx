// src/components/admin/shared/AdminListSkeleton.tsx
//
// Phase 15B — shared route-loading skeleton for Admin 2.0 list pages.
// Used from each section's loading.tsx (Next.js's native route-level
// Suspense boundary — no custom client-side loading state machine, no
// extra re-renders). Shape roughly matches the common
// header + stat-strip + table/card-list layout every list page in this
// admin already uses, which is what keeps the swap-in of real content
// from jumping the layout around.

export default function AdminListSkeleton({ statCards = 4 }: { statCards?: number }) {
    return (
        <div className="animate-pulse space-y-6">
            {/* Header */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-2">
                    <div className="h-4 w-28 rounded-full bg-white/[0.06]" />
                    <div className="h-7 w-48 rounded-lg bg-white/[0.08]" />
                </div>
                <div className="h-10 w-32 rounded-xl bg-white/[0.05]" />
            </div>

            {/* Stat strip — static Tailwind classes only (dynamic template
                class names don't survive Tailwind's build-time JIT scan). */}
            <div className={`grid gap-3 grid-cols-2 ${statCards >= 4 ? "sm:grid-cols-4" : statCards === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
                {Array.from({ length: statCards }).map((_, i) => (
                    <div key={i} className="h-20 rounded-xl border border-white/[0.06] bg-white/[0.03]" />
                ))}
            </div>

            {/* List card */}
            <div className="rounded-2xl border border-white/[0.06] bg-[#111118] p-5">
                <div className="mb-5 h-10 w-full max-w-sm rounded-xl bg-white/[0.04]" />
                <div className="space-y-2.5">
                    {Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} className="h-14 rounded-xl border border-white/[0.04] bg-white/[0.02]" />
                    ))}
                </div>
            </div>
        </div>
    );
}
