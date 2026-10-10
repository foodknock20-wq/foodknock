// src/components/admin/shared/AdminDashboardSkeleton.tsx
//
// Route-loading skeleton for /admin (the dashboard), which actually has
// a very different shape from the list pages AdminListSkeleton covers:
// shop-status pill, range tabs, KPI cards, a trend chart + donut chart,
// a recent-orders list, and a low-stock alert strip. Presentational only.

export default function AdminDashboardSkeleton() {
    return (
        <div className="animate-pulse space-y-6">
            {/* Shop status + range tabs */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="h-10 w-full max-w-xs rounded-xl bg-white/[0.05] sm:w-56" />
                <div className="h-9 w-64 rounded-xl bg-white/[0.04]" />
            </div>

            {/* KPI cards */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="h-24 rounded-xl border border-white/[0.06] bg-white/[0.03]" />
                ))}
            </div>

            {/* Trend chart + donut chart */}
            <div className="grid gap-4 lg:grid-cols-3">
                <div className="h-64 rounded-2xl border border-white/[0.06] bg-[#111118] p-5 lg:col-span-2">
                    <div className="mb-4 h-4 w-32 rounded bg-white/[0.06]" />
                    <div className="h-44 rounded-xl bg-white/[0.03]" />
                </div>
                <div className="h-64 rounded-2xl border border-white/[0.06] bg-[#111118] p-5">
                    <div className="mb-4 h-4 w-24 rounded bg-white/[0.06]" />
                    <div className="mx-auto h-36 w-36 rounded-full bg-white/[0.03]" />
                </div>
            </div>

            {/* Recent orders */}
            <div className="rounded-2xl border border-white/[0.06] bg-[#111118] p-5">
                <div className="mb-4 h-4 w-28 rounded bg-white/[0.06]" />
                <div className="space-y-2.5">
                    {Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="h-12 rounded-xl border border-white/[0.04] bg-white/[0.02]" />
                    ))}
                </div>
            </div>
        </div>
    );
}
