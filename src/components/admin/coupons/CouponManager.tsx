"use client";

// src/components/admin/coupons/CouponManager.tsx
//
// Phase 11 — admin coupon management: create, bulk-generate, list/filter
// (bounded/paginated — never the full collection), pause/activate. Mirrors
// DeliverySettingsForm.tsx's visual language (Card/Field/inputClass) and
// its "each action has its own independent request" philosophy.

import { useCallback, useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { Loader2, Plus, Sparkles, Search, Pause, Play, Copy, Download } from "lucide-react";

type CouponRow = {
    _id: string;
    code: string;
    discountType: "FIXED" | "PERCENTAGE";
    discountValue: number;
    minimumOrderValue: number;
    maximumDiscount: number | null;
    usageLimit: number | null;
    usedCount: number;
    status: "ACTIVE" | "PAUSED";
    startsAt: string | null;
    expiresAt: string | null;
    description: string;
    createdAt: string;
};

const inputClass =
    "w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-3.5 py-2.5 text-sm font-medium text-stone-100 outline-none transition-colors focus:border-amber-400/50 focus:bg-white/[0.05]";

function Card({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
    return (
        <div className="overflow-hidden rounded-2xl border border-white/[0.06] bg-[#111118]">
            <div className="border-b border-white/[0.06] px-5 py-4">
                <h2 className="font-serif text-base font-bold text-white">{title}</h2>
                {sub && <p className="mt-0.5 text-[12px] text-stone-600">{sub}</p>}
            </div>
            <div className="space-y-3 px-5 py-4">{children}</div>
        </div>
    );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wide text-stone-500">{label}</label>
            {children}
        </div>
    );
}

function StatusBadge({ coupon, now }: { coupon: CouponRow; now: number }) {
    const expired = coupon.expiresAt && new Date(coupon.expiresAt).getTime() < now;
    const exhausted = coupon.usageLimit != null && coupon.usedCount >= coupon.usageLimit;

    if (coupon.status === "PAUSED") {
        return <span className="rounded-full bg-stone-500/15 px-2 py-0.5 text-[10px] font-bold text-stone-400">PAUSED</span>;
    }
    if (expired) {
        return <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-[10px] font-bold text-red-400">EXPIRED</span>;
    }
    if (exhausted) {
        return <span className="rounded-full bg-orange-500/15 px-2 py-0.5 text-[10px] font-bold text-orange-400">EXHAUSTED</span>;
    }
    return <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-400">ACTIVE</span>;
}

export default function CouponManager() {
    // Snapshot once per mount — StatusBadge needs "now" only for a rough
    // expired/exhausted display check, not millisecond freshness, and a
    // component render must stay pure (no Date.now() calls during render).
    const [now] = useState(() => Date.now());

    // ── Create single coupon ──────────────────────────────────────────────
    const [discountType, setDiscountType] = useState<"FIXED" | "PERCENTAGE">("FIXED");
    const [discountValue, setDiscountValue] = useState("100");
    const [minimumOrderValue, setMinimumOrderValue] = useState("399");
    const [maximumDiscount, setMaximumDiscount] = useState("");
    const [usageLimit, setUsageLimit] = useState("");
    const [expiresAt, setExpiresAt] = useState("");
    const [description, setDescription] = useState("");
    const [creating, setCreating] = useState(false);

    // ── Bulk generate ──────────────────────────────────────────────────────
    const [bulkQuantity, setBulkQuantity] = useState("100");
    const [bulkDiscountType, setBulkDiscountType] = useState<"FIXED" | "PERCENTAGE">("FIXED");
    const [bulkDiscountValue, setBulkDiscountValue] = useState("50");
    const [generating, setGenerating] = useState(false);
    const [bulkResult, setBulkResult] = useState<string[] | null>(null);

    // ── List ───────────────────────────────────────────────────────────────
    const [coupons, setCoupons] = useState<CouponRow[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState<"" | "ACTIVE" | "PAUSED">("");
    const [loadingList, setLoadingList] = useState(false);
    const limit = 25;

    const loadCoupons = useCallback(async () => {
        setLoadingList(true);
        try {
            const params = new URLSearchParams({ page: String(page), limit: String(limit) });
            if (search.trim()) params.set("search", search.trim());
            if (statusFilter) params.set("status", statusFilter);
            const res = await fetch(`/api/admin/coupons?${params}`, { credentials: "include" });
            const data = await res.json();
            if (data.success) {
                setCoupons(data.coupons);
                setTotal(data.total);
            }
        } catch {
            toast.error("Failed to load coupons");
        } finally {
            setLoadingList(false);
        }
    }, [page, search, statusFilter]);

    useEffect(() => { loadCoupons(); }, [loadCoupons]);

    async function handleCreate() {
        setCreating(true);
        try {
            const res = await fetch("/api/admin/coupons", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({
                    discountType,
                    discountValue: Number(discountValue),
                    minimumOrderValue: Number(minimumOrderValue || 0),
                    maximumDiscount: maximumDiscount ? Number(maximumDiscount) : null,
                    usageLimit: usageLimit ? Number(usageLimit) : null,
                    expiresAt: expiresAt || null,
                    description,
                }),
            });
            const data = await res.json();
            if (!data.success) throw new Error(data.message);
            toast.success(`Created ${data.coupon.code}`);
            setDescription("");
            setPage(1);
            loadCoupons();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Failed to create coupon");
        } finally {
            setCreating(false);
        }
    }

    async function handleBulkGenerate() {
        setGenerating(true);
        setBulkResult(null);
        try {
            const res = await fetch("/api/admin/coupons/bulk", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({
                    quantity: Number(bulkQuantity),
                    discountType: bulkDiscountType,
                    discountValue: Number(bulkDiscountValue),
                }),
            });
            const data = await res.json();
            if (!data.success) throw new Error(data.message);
            toast.success(`Generated ${data.count} coupons`);
            setBulkResult(data.codes);
            setPage(1);
            loadCoupons();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Failed to generate coupons");
        } finally {
            setGenerating(false);
        }
    }

    async function handleToggleStatus(coupon: CouponRow) {
        const nextStatus = coupon.status === "ACTIVE" ? "PAUSED" : "ACTIVE";
        try {
            const res = await fetch(`/api/admin/coupons/${coupon._id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ status: nextStatus }),
            });
            const data = await res.json();
            if (!data.success) throw new Error(data.message);
            setCoupons((prev) => prev.map((c) => (c._id === coupon._id ? { ...c, status: nextStatus } : c)));
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Failed to update coupon");
        }
    }

    function copyCode(code: string) {
        navigator.clipboard?.writeText(code).then(() => toast.success("Copied"));
    }

    function downloadBulkCsv() {
        if (!bulkResult) return;
        const csv = ["code", ...bulkResult].join("\n");
        const blob = new Blob([csv], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `foodknock-coupons-${Date.now()}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    }

    const totalPages = Math.max(1, Math.ceil(total / limit));

    return (
        <div className="space-y-5">
            <div className="grid gap-5 lg:grid-cols-2">
                {/* ── Create single coupon ── */}
                <Card title="Create Coupon" sub="Single coupon, secure random code auto-generated">
                    <div className="grid grid-cols-2 gap-3">
                        <Field label="Discount Type">
                            <select value={discountType} onChange={(e) => setDiscountType(e.target.value as "FIXED" | "PERCENTAGE")} className={inputClass}>
                                <option value="FIXED">Fixed (₹)</option>
                                <option value="PERCENTAGE">Percentage (%)</option>
                            </select>
                        </Field>
                        <Field label={discountType === "FIXED" ? "Discount (₹)" : "Discount (%)"}>
                            <input type="number" value={discountValue} onChange={(e) => setDiscountValue(e.target.value)} className={inputClass} min={1} />
                        </Field>
                        <Field label="Minimum Order (₹)">
                            <input type="number" value={minimumOrderValue} onChange={(e) => setMinimumOrderValue(e.target.value)} className={inputClass} min={0} />
                        </Field>
                        <Field label="Max Discount (₹, optional)">
                            <input type="number" value={maximumDiscount} onChange={(e) => setMaximumDiscount(e.target.value)} className={inputClass} placeholder="Uncapped" min={0} />
                        </Field>
                        <Field label="Global Usage Limit">
                            <input type="number" value={usageLimit} onChange={(e) => setUsageLimit(e.target.value)} className={inputClass} placeholder="Unlimited" min={1} />
                        </Field>
                        <Field label="Expires">
                            <input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} className={inputClass} />
                        </Field>
                    </div>
                    <Field label="Description (internal note)">
                        <input value={description} onChange={(e) => setDescription(e.target.value)} className={inputClass} maxLength={200} placeholder="e.g. Weekend promo" />
                    </Field>
                    <button
                        type="button"
                        onClick={handleCreate}
                        disabled={creating}
                        className="flex items-center gap-1.5 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-[13px] font-bold text-amber-400 transition-all hover:bg-amber-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        {creating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                        {creating ? "Creating…" : "Create Coupon"}
                    </button>
                </Card>

                {/* ── Bulk generate ── */}
                <Card title="Bulk Generate" sub="Each generated coupon is independent and single-use (usageLimit:1)">
                    <div className="grid grid-cols-3 gap-3">
                        <Field label="Quantity">
                            <input type="number" value={bulkQuantity} onChange={(e) => setBulkQuantity(e.target.value)} className={inputClass} min={1} max={5000} />
                        </Field>
                        <Field label="Type">
                            <select value={bulkDiscountType} onChange={(e) => setBulkDiscountType(e.target.value as "FIXED" | "PERCENTAGE")} className={inputClass}>
                                <option value="FIXED">Fixed (₹)</option>
                                <option value="PERCENTAGE">Percentage (%)</option>
                            </select>
                        </Field>
                        <Field label="Value">
                            <input type="number" value={bulkDiscountValue} onChange={(e) => setBulkDiscountValue(e.target.value)} className={inputClass} min={1} />
                        </Field>
                    </div>
                    <button
                        type="button"
                        onClick={handleBulkGenerate}
                        disabled={generating}
                        className="flex items-center gap-1.5 rounded-xl border border-violet-500/30 bg-violet-500/10 px-4 py-2 text-[13px] font-bold text-violet-400 transition-all hover:bg-violet-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        {generating ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                        {generating ? "Generating…" : "Generate Coupons"}
                    </button>
                    {bulkResult && (
                        <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-3">
                            <div className="mb-2 flex items-center justify-between">
                                <p className="text-[12px] font-bold text-stone-300">{bulkResult.length} codes generated</p>
                                <button type="button" onClick={downloadBulkCsv} className="flex items-center gap-1 text-[11px] font-bold text-amber-400 hover:text-amber-300">
                                    <Download size={11} /> Export CSV
                                </button>
                            </div>
                            <p className="max-h-24 overflow-y-auto font-mono text-[11px] text-stone-500">
                                {bulkResult.slice(0, 50).join(", ")}{bulkResult.length > 50 ? "…" : ""}
                            </p>
                        </div>
                    )}
                </Card>
            </div>

            {/* ── List ── */}
            <Card title="All Coupons" sub={`${total} total`}>
                <div className="flex flex-wrap items-center gap-2">
                    <div className="relative flex-1 min-w-[180px]">
                        <Search size={13} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-500" />
                        <input
                            value={search}
                            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                            placeholder="Search code…"
                            className={`${inputClass} pl-8`}
                        />
                    </div>
                    <select
                        value={statusFilter}
                        onChange={(e) => { setStatusFilter(e.target.value as "" | "ACTIVE" | "PAUSED"); setPage(1); }}
                        className={`${inputClass} w-auto`}
                    >
                        <option value="">All statuses</option>
                        <option value="ACTIVE">Active</option>
                        <option value="PAUSED">Paused</option>
                    </select>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-[12px]">
                        <thead>
                            <tr className="border-b border-white/[0.06] text-stone-500">
                                <th className="py-2 pr-3 font-bold">Code</th>
                                <th className="py-2 pr-3 font-bold">Discount</th>
                                <th className="py-2 pr-3 font-bold">Min Order</th>
                                <th className="py-2 pr-3 font-bold">Usage</th>
                                <th className="py-2 pr-3 font-bold">Status</th>
                                <th className="py-2 pr-3 font-bold">Expires</th>
                                <th className="py-2 font-bold">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loadingList ? (
                                <tr><td colSpan={7} className="py-6 text-center text-stone-500"><Loader2 size={16} className="mx-auto animate-spin" /></td></tr>
                            ) : coupons.length === 0 ? (
                                <tr><td colSpan={7} className="py-6 text-center text-stone-500">No coupons found</td></tr>
                            ) : (
                                coupons.map((c) => (
                                    <tr key={c._id} className="border-b border-white/[0.03] text-stone-300">
                                        <td className="py-2.5 pr-3">
                                            <button onClick={() => copyCode(c.code)} className="flex items-center gap-1 font-mono font-bold text-stone-100 hover:text-amber-400">
                                                {c.code} <Copy size={10} />
                                            </button>
                                        </td>
                                        <td className="py-2.5 pr-3">{c.discountType === "FIXED" ? `₹${c.discountValue}` : `${c.discountValue}%`}{c.maximumDiscount != null ? ` (max ₹${c.maximumDiscount})` : ""}</td>
                                        <td className="py-2.5 pr-3">₹{c.minimumOrderValue}</td>
                                        <td className="py-2.5 pr-3">{c.usedCount}/{c.usageLimit ?? "∞"}</td>
                                        <td className="py-2.5 pr-3"><StatusBadge coupon={c} now={now} /></td>
                                        <td className="py-2.5 pr-3">{c.expiresAt ? new Date(c.expiresAt).toLocaleDateString() : "Never"}</td>
                                        <td className="py-2.5">
                                            <button
                                                onClick={() => handleToggleStatus(c)}
                                                className="flex items-center gap-1 rounded-lg border border-white/[0.08] px-2 py-1 text-[11px] font-bold text-stone-300 hover:bg-white/[0.05]"
                                            >
                                                {c.status === "ACTIVE" ? <><Pause size={10} /> Pause</> : <><Play size={10} /> Activate</>}
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {totalPages > 1 && (
                    <div className="flex items-center justify-between pt-2">
                        <button
                            disabled={page <= 1}
                            onClick={() => setPage((p) => Math.max(1, p - 1))}
                            className="rounded-lg border border-white/[0.08] px-3 py-1.5 text-[12px] font-bold text-stone-300 disabled:opacity-40"
                        >
                            Previous
                        </button>
                        <span className="text-[12px] text-stone-500">Page {page} of {totalPages}</span>
                        <button
                            disabled={page >= totalPages}
                            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                            className="rounded-lg border border-white/[0.08] px-3 py-1.5 text-[12px] font-bold text-stone-300 disabled:opacity-40"
                        >
                            Next
                        </button>
                    </div>
                )}
            </Card>
        </div>
    );
}
