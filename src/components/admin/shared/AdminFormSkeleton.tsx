// src/components/admin/shared/AdminFormSkeleton.tsx
//
// Route-loading skeleton for admin pages whose page.tsx does an async DB
// fetch before rendering a form (e.g. product new/edit, which await
// getDistinctCategories()/getProduct()). Mirrors the shared
// header + image box + field-grid shape those pages actually use —
// presentational only, no data fetching.

export default function AdminFormSkeleton({ withImage = true }: { withImage?: boolean }) {
    return (
        <div className="animate-pulse pb-10">
            {/* Back link + badge + heading */}
            <div className="mb-7 space-y-4">
                <div className="h-3.5 w-28 rounded-full bg-white/[0.05]" />
                <div className="h-6 w-32 rounded-full bg-white/[0.06]" />
                <div className="h-7 w-56 rounded-lg bg-white/[0.08]" />
                <div className="h-px bg-white/[0.04]" />
            </div>

            <div className="space-y-5">
                {withImage && (
                    <div className="h-32 w-full max-w-xs rounded-2xl border border-white/[0.06] bg-white/[0.03]" />
                )}

                {/* Field grid */}
                <div className="grid gap-4 sm:grid-cols-2">
                    {Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} className="space-y-2">
                            <div className="h-3 w-20 rounded-full bg-white/[0.05]" />
                            <div className="h-11 w-full rounded-xl border border-white/[0.06] bg-white/[0.03]" />
                        </div>
                    ))}
                </div>

                {/* Description textarea */}
                <div className="space-y-2">
                    <div className="h-3 w-24 rounded-full bg-white/[0.05]" />
                    <div className="h-24 w-full rounded-xl border border-white/[0.06] bg-white/[0.03]" />
                </div>

                {/* Action buttons */}
                <div className="flex gap-3">
                    <div className="h-11 w-32 rounded-xl bg-white/[0.08]" />
                    <div className="h-11 w-24 rounded-xl border border-white/[0.06] bg-white/[0.03]" />
                </div>
            </div>
        </div>
    );
}
