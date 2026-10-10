"use client";

// src/components/admin/orders/OrderFiltersBar.tsx
//
// Phase 15C — compact advanced-filter popover for Orders 2.0. Every
// option here is backed by a real, existing Order field (payment method,
// cancellation.refundStatus, coupon/offer snapshot, redeemedPoints,
// createdAt) — nothing invented. URL-synced via router.push, same pattern
// as AdminListSearchBar/Pagination, so refresh/back/forward all just work
// without any extra client state to keep in sync.

import { useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { SlidersHorizontal, X } from "lucide-react";

export type OrderFiltersValue = {
    search?: string;
    status?: string;
    payment?: string;
    date?: string;
    dateFrom?: string;
    dateTo?: string;
    cancellation?: string;
    refund?: string;
    promotion?: string;
    loyalty?: string;
    attention?: string;
    sort?: string;
};

const PAYMENT_OPTIONS = [
    { value: "", label: "Any payment method" },
    { value: "cod", label: "Cash on Delivery" },
    { value: "razorpay", label: "Online (Razorpay)" },
];

const DATE_OPTIONS = [
    { value: "", label: "Any date" },
    { value: "today", label: "Today" },
    { value: "yesterday", label: "Yesterday" },
    { value: "7d", label: "Last 7 days" },
    { value: "30d", label: "Last 30 days" },
];

const REFUND_OPTIONS = [
    { value: "", label: "Any refund state" },
    { value: "not_applicable", label: "Not required" },
    { value: "pending_manual", label: "Pending manual refund" },
    { value: "completed", label: "Refund completed" },
];

const PROMOTION_OPTIONS = [
    { value: "", label: "Any promotion" },
    { value: "coupon", label: "Coupon used" },
    { value: "offer", label: "Offer used" },
    { value: "none", label: "No promotion" },
];

const LOYALTY_OPTIONS = [
    { value: "", label: "Any loyalty state" },
    { value: "redeemed", label: "Loyalty redeemed" },
    { value: "none", label: "No redemption" },
];

const SORT_OPTIONS = [
    { value: "", label: "Newest first" },
    { value: "oldest", label: "Oldest first" },
    { value: "highest", label: "Highest value" },
    { value: "lowest", label: "Lowest value" },
];

// Keys this bar owns — everything except `search`/`status`/`attention`,
// which are driven by AdminListSearchBar and the quick-filter tabs
// respectively. Used to count "how many advanced filters are active".
const ADVANCED_KEYS: (keyof OrderFiltersValue)[] = ["payment", "date", "cancellation", "refund", "promotion", "loyalty", "sort"];

export default function OrderFiltersBar({ value }: { value: OrderFiltersValue }) {
    const router = useRouter();
    const pathname = usePathname();
    const [open, setOpen] = useState(false);

    const activeCount = ADVANCED_KEYS.filter((k) => value[k]).length;

    const update = (patch: Partial<OrderFiltersValue>) => {
        const params = new URLSearchParams();
        const next = { ...value, ...patch };
        for (const [k, v] of Object.entries(next)) {
            if (v) params.set(k, v);
        }
        params.set("page", "1"); // any filter change resets pagination
        router.push(`${pathname}?${params.toString()}`, { scroll: false });
    };

    const clearAdvanced = () => {
        const patch: Partial<OrderFiltersValue> = {};
        ADVANCED_KEYS.forEach((k) => { patch[k] = undefined; });
        update(patch);
        setOpen(false);
    };

    return (
        <div className="relative shrink-0">
            <button
                type="button"
                onClick={() => setOpen((o) => !o)}
                className={`flex items-center gap-2 rounded-xl border px-3.5 py-2.5 text-[13px] font-bold transition-colors ${activeCount > 0
                    ? "border-amber-500/40 bg-amber-500/15 text-amber-400"
                    : "border-white/[0.07] bg-white/[0.03] text-stone-400 hover:bg-white/[0.06]"
                    }`}
            >
                <SlidersHorizontal size={13} />
                Filters
                {activeCount > 0 && (
                    <span className="rounded-full bg-amber-500/25 px-1.5 py-0.5 text-[10px] text-amber-200">{activeCount}</span>
                )}
            </button>

            {open && (
                <>
                    <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden="true" />
                    <div className="absolute right-0 top-full z-50 mt-2 w-[min(90vw,320px)] rounded-2xl border border-white/10 bg-[#13131c] p-4 shadow-2xl">
                        <div className="mb-3 flex items-center justify-between">
                            <p className="text-[11px] font-black uppercase tracking-wider text-stone-400">Advanced Filters</p>
                            <button onClick={() => setOpen(false)} className="text-stone-300 hover:text-stone-100">
                                <X size={14} />
                            </button>
                        </div>

                        <div className="space-y-2.5">
                            <FilterSelect label="Payment" value={value.payment ?? ""} options={PAYMENT_OPTIONS} onChange={(v) => update({ payment: v || undefined })} />
                            <FilterSelect label="Date" value={value.date ?? ""} options={DATE_OPTIONS} onChange={(v) => update({ date: v || undefined, dateFrom: undefined, dateTo: undefined })} />
                            <FilterSelect label="Refund" value={value.refund ?? ""} options={REFUND_OPTIONS} onChange={(v) => update({ refund: v || undefined })} />
                            <FilterSelect label="Promotion" value={value.promotion ?? ""} options={PROMOTION_OPTIONS} onChange={(v) => update({ promotion: v || undefined })} />
                            <FilterSelect label="Loyalty" value={value.loyalty ?? ""} options={LOYALTY_OPTIONS} onChange={(v) => update({ loyalty: v || undefined })} />
                            <FilterSelect label="Sort" value={value.sort ?? ""} options={SORT_OPTIONS} onChange={(v) => update({ sort: v || undefined })} />
                        </div>

                        <button
                            onClick={clearAdvanced}
                            disabled={activeCount === 0}
                            className="mt-4 w-full rounded-xl border border-white/10 bg-white/[0.03] py-2 text-[12px] font-bold text-stone-400 transition-colors hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-40"
                        >
                            Clear Filters
                        </button>
                    </div>
                </>
            )}
        </div>
    );
}

function FilterSelect({
    label, value, options, onChange,
}: {
    label: string;
    value: string;
    options: { value: string; label: string }[];
    onChange: (v: string) => void;
}) {
    return (
        <div>
            <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-stone-600">{label}</label>
            <select
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="w-full appearance-none rounded-xl border border-white/10 bg-[#0f0f16] px-3 py-2 text-[12.5px] text-stone-200 outline-none focus:border-amber-500/40"
            >
                {options.map((o) => (
                    <option key={o.value} value={o.value} className="bg-[#0f0f16]">{o.label}</option>
                ))}
            </select>
        </div>
    );
}
