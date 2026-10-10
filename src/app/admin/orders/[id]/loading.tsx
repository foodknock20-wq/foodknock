// src/app/admin/orders/[id]/loading.tsx
// Phase 15C — Next.js route-level Suspense boundary for the order detail
// page (didn't exist before; the list's loading.tsx from Phase 15B only
// covers /admin/orders itself, not this nested dynamic segment).

export default function Loading() {
    return (
        <div className="animate-pulse space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-2">
                    <div className="h-3 w-24 rounded-full bg-white/[0.06]" />
                    <div className="h-6 w-40 rounded-lg bg-white/[0.08]" />
                    <div className="h-3 w-32 rounded-full bg-white/[0.05]" />
                </div>
                <div className="h-9 w-40 rounded-xl bg-white/[0.05]" />
            </div>

            <div className="grid gap-5 lg:grid-cols-5">
                <div className="space-y-5 lg:col-span-3">
                    {Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="h-28 rounded-2xl border border-white/[0.06] bg-white/[0.03]" />
                    ))}
                </div>
                <div className="space-y-5 lg:col-span-2">
                    <div className="h-72 rounded-2xl border border-white/[0.06] bg-white/[0.03]" />
                </div>
            </div>
        </div>
    );
}
