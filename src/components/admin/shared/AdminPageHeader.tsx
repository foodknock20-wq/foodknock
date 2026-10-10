// src/components/admin/shared/AdminPageHeader.tsx
//
// Phase 15E.6 — Admin UI 2.0. Replaces the per-page "eyebrow pill + giant
// font-serif h1 + description" header pattern (Orders/Customers/Products/
// Categories each independently built their own ~150-200px decorative
// header: "ORDERS" eyebrow -> "Order Operations" 36px serif heading ->
// subtitle). That consumed a large fraction of the first viewport before
// any real data appeared, and the serif display heading read as editorial/
// marketing copy rather than an operations tool — and its invented title
// ("Order Operations", "User Management") didn't match the breadcrumb/nav
// label ("Orders", "Customers"), which reads as two different products.
//
// This component is compact by construction: icon + title inline (one
// line), an optional metric/description line underneath, optional actions
// on the right. No serif font, no eyebrow pill. Title should always match
// the nav label the user just clicked.

import type { LucideIcon } from "lucide-react";

export default function AdminPageHeader({
    icon: Icon,
    title,
    description,
    actions,
}: {
    icon: LucideIcon;
    title: string;
    description?: React.ReactNode;
    actions?: React.ReactNode;
}) {
    return (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3 min-w-0">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-amber-500/20 bg-amber-500/10">
                    <Icon size={16} className="text-amber-400" strokeWidth={2} />
                </div>
                <div className="min-w-0">
                    <h1 className="text-lg font-bold tracking-tight text-stone-100 sm:text-xl">{title}</h1>
                    {description && (
                        <p className="truncate text-[12.5px] text-stone-400">{description}</p>
                    )}
                </div>
            </div>
            {actions && (
                <div className="flex shrink-0 items-center gap-2.5">{actions}</div>
            )}
        </div>
    );
}
