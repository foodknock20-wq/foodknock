// src/app/admin/analytics/loading.tsx
// Phase 15D — Suspense boundary while the ~13 bounded aggregations run.

export default function Loading() {
    return (
        <div className="animate-pulse space-y-6 pb-8">
            <div className="space-y-2">
                <div className="h-3 w-20 rounded-full bg-white/[0.06]" />
                <div className="h-7 w-64 rounded-lg bg-white/[0.08]" />
                <div className="h-3 w-40 rounded-full bg-white/[0.05]" />
            </div>
            <div className="h-11 w-full max-w-xl rounded-xl bg-white/[0.04]" />
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-7">
                {Array.from({ length: 7 }).map((_, i) => (
                    <div key={i} className="h-24 rounded-2xl border border-white/[0.06] bg-white/[0.03]" />
                ))}
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
                {Array.from({ length: 2 }).map((_, i) => (
                    <div key={i} className="h-52 rounded-2xl border border-white/[0.06] bg-white/[0.03]" />
                ))}
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
                {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="h-40 rounded-2xl border border-white/[0.06] bg-white/[0.03]" />
                ))}
            </div>
        </div>
    );
}
