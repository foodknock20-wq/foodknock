// src/components/admin/analytics/AnalyticsSection.tsx
// Phase 15D — consistent section shell for every Analytics 2.0 block.

export default function AnalyticsSection({
    title, description, children, badge,
}: {
    title: string;
    description?: string;
    badge?: string;
    children: React.ReactNode;
}) {
    return (
        <div className="overflow-hidden rounded-2xl border border-white/[0.06] bg-[#0d0d14] p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                    <h2 className="font-serif text-[15px] font-bold text-white">{title}</h2>
                    {description && <p className="mt-0.5 text-[10px] text-stone-600">{description}</p>}
                </div>
                {badge && (
                    <span className="shrink-0 rounded-full border border-amber-500/20 bg-amber-500/8 px-2.5 py-1 text-[9px] font-black uppercase tracking-wider text-amber-400">
                        {badge}
                    </span>
                )}
            </div>
            {children}
        </div>
    );
}
