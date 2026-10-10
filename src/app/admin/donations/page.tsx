export const dynamic = "force-dynamic";

// src/app/admin/donations/page.tsx
//
// Pre-Phase 17 — Phase 2: Street Animal Support — minimal operational
// visibility for admins. Same server-side pagination/search/filter pattern
// as /admin/reviews and /admin/product-reviews — bounded queries only,
// never an unbounded fetch. Observation only: no manual "mark successful"
// action exists (the existing payment architecture has no safe audited
// mechanism for that, and this phase doesn't add one — status transitions
// only ever happen via verified Razorpay reconciliation).

import { connectDB } from "@/lib/db";
import Donation from "@/models/Donation";
import Pagination from "@/components/admin/shared/Pagination";
import AdminListSearchBar from "@/components/admin/shared/AdminListSearchBar";
import { parseAdminPagination, buildPaginationMeta } from "@/lib/adminPagination";
import AdminPageHeader from "@/components/admin/shared/AdminPageHeader";
import Link from "next/link";
import { PawPrint, CheckCircle2, XCircle, Clock, Ban } from "lucide-react";

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

type DonationRow = {
    _id: string;
    customerName: string;
    amount: number;
    status: "pending" | "success" | "failed" | "cancelled";
    razorpayOrderId: string;
    razorpayPaymentId: string | null;
    createdAt: string;
};

async function getDonations(searchParams: Awaited<SearchParams>) {
    await connectDB();

    const { page, limit, skip } = parseAdminPagination(searchParams, { defaultLimit: 25, maxLimit: 100 });
    const search = typeof searchParams.search === "string" ? searchParams.search.trim() : "";
    const status = typeof searchParams.status === "string" && ["pending", "success", "failed", "cancelled"].includes(searchParams.status)
        ? searchParams.status
        : "all";

    const filter: Record<string, unknown> = {};
    if (status !== "all") filter.status = status;
    if (search) {
        filter.$or = [
            { razorpayOrderId: { $regex: search, $options: "i" } },
            { razorpayPaymentId: { $regex: search, $options: "i" } },
        ];
    }

    const [rows, total, statsAgg] = await Promise.all([
        Donation.find(filter)
            .populate("userId", "name email")
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean(),
        Donation.countDocuments(filter),
        // Bounded single-document output regardless of collection size.
        Donation.aggregate<{ _id: string; count: number; amountSum: number }>([
            { $group: { _id: "$status", count: { $sum: 1 }, amountSum: { $sum: "$amountPaise" } } },
        ]),
    ]);

    const donations: DonationRow[] = rows.map((r: {
        _id: { toString(): string };
        userId?: { name?: string; email?: string } | null;
        amountPaise: number;
        status: "pending" | "success" | "failed" | "cancelled";
        razorpayOrderId: string;
        razorpayPaymentId?: string;
        createdAt?: Date | string;
    }) => ({
        _id: String(r._id),
        customerName: r.userId?.name ?? "Unknown customer",
        amount: r.amountPaise / 100,
        status: r.status,
        razorpayOrderId: r.razorpayOrderId,
        razorpayPaymentId: r.razorpayPaymentId ?? null,
        createdAt: r.createdAt ? new Date(r.createdAt).toISOString() : new Date().toISOString(),
    }));

    const byStatus: Record<string, { count: number; amountSum: number }> = {};
    for (const s of statsAgg) byStatus[s._id] = { count: s.count, amountSum: s.amountSum };

    const successCount = byStatus.success?.count ?? 0;
    const successAmount = (byStatus.success?.amountSum ?? 0) / 100;
    const pendingCount = byStatus.pending?.count ?? 0;
    const failedCount = (byStatus.failed?.count ?? 0) + (byStatus.cancelled?.count ?? 0);
    const totalCount = successCount + pendingCount + failedCount;

    return {
        donations,
        meta: buildPaginationMeta(total, page, limit),
        stats: { totalCount, successCount, successAmount, pendingCount, failedCount },
        filters: { search, status },
    };
}

const STATUS_BADGE: Record<DonationRow["status"], { label: string; className: string; icon: typeof CheckCircle2 }> = {
    success: { label: "Success", className: "border-emerald-500/25 bg-emerald-500/10 text-emerald-400", icon: CheckCircle2 },
    pending: { label: "Pending", className: "border-amber-500/25 bg-amber-500/10 text-amber-400", icon: Clock },
    failed: { label: "Failed", className: "border-rose-500/25 bg-rose-500/10 text-rose-400", icon: XCircle },
    cancelled: { label: "Cancelled", className: "border-stone-500/25 bg-stone-500/10 text-stone-400", icon: Ban },
};

export default async function AdminDonationsPage({ searchParams }: { searchParams: SearchParams }) {
    const resolvedSearchParams = await searchParams;
    const { donations, meta, stats, filters } = await getDonations(resolvedSearchParams);

    return (
        <div className="space-y-6">
            <AdminPageHeader
                icon={PawPrint}
                title="Street Animal Donations"
                description={`${stats.totalCount} contribution${stats.totalCount !== 1 ? "s" : ""} — independent of food-order payments`}
            />

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                    { label: "Successful", value: stats.successCount, color: "text-emerald-400" },
                    { label: "Total Raised", value: `₹${stats.successAmount.toLocaleString("en-IN")}`, color: "text-amber-400" },
                    { label: "Pending", value: stats.pendingCount, color: stats.pendingCount > 0 ? "text-amber-400" : "text-stone-600" },
                    { label: "Failed / Cancelled", value: stats.failedCount, color: "text-stone-500" },
                ].map(({ label, value, color }) => (
                    <div key={label} className="rounded-xl border border-white/[0.06] bg-[#111118] px-4 py-3">
                        <p className="text-[11px] font-semibold uppercase tracking-widest text-stone-600">{label}</p>
                        <p className={`mt-1 font-serif text-2xl font-black ${color}`}>{value}</p>
                    </div>
                ))}
            </div>

            <div className="rounded-2xl border border-white/[0.06] bg-[#111118] p-5">
                <div className="mb-5 flex flex-col gap-3">
                    <AdminListSearchBar placeholder="Search by Razorpay order/payment ID…" />
                    <div className="flex flex-wrap gap-1.5">
                        {([
                            { value: "all", label: "All" },
                            { value: "success", label: "Success" },
                            { value: "pending", label: "Pending" },
                            { value: "failed", label: "Failed" },
                            { value: "cancelled", label: "Cancelled" },
                        ] as const).map((o) => {
                            const params = new URLSearchParams();
                            if (filters.search) params.set("search", filters.search);
                            if (o.value !== "all") params.set("status", o.value);
                            params.set("page", "1");
                            const active = filters.status === o.value;
                            return (
                                <Link
                                    key={o.value}
                                    href={`/admin/donations?${params.toString()}`}
                                    className={`rounded-lg border px-2.5 py-1.5 text-[11.5px] font-bold transition-colors ${active
                                        ? "border-amber-500/40 bg-amber-500/15 text-amber-400"
                                        : "border-white/[0.07] bg-white/[0.03] text-stone-300 hover:bg-white/[0.06]"
                                        }`}
                                >
                                    {o.label}
                                </Link>
                            );
                        })}
                    </div>
                </div>

                {donations.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-24 text-center">
                        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-white/[0.06] bg-white/[0.03]">
                            <PawPrint size={26} className="text-stone-600" strokeWidth={1.5} />
                        </div>
                        <p className="text-base font-black text-white">No contributions found</p>
                        <p className="mt-1.5 text-sm text-stone-600">Try changing the filters or search term.</p>
                    </div>
                ) : (
                    <>
                        {/* Desktop table */}
                        <div className="hidden overflow-hidden rounded-2xl border border-white/[0.06] md:block">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-white/[0.06] bg-white/[0.02]">
                                        {["Customer", "Amount", "Status", "Razorpay Order", "Razorpay Payment", "Date"].map((h) => (
                                            <th key={h} className="px-4 py-3.5 text-left text-[10px] font-black uppercase tracking-[0.18em] text-stone-600">
                                                {h}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/[0.03]">
                                    {donations.map((d) => {
                                        const badge = STATUS_BADGE[d.status];
                                        const Icon = badge.icon;
                                        return (
                                            <tr key={d._id} className="group transition-colors hover:bg-white/[0.02]">
                                                <td className="px-4 py-3.5 font-semibold text-stone-200">{d.customerName}</td>
                                                <td className="px-4 py-3.5 font-black text-amber-400">₹{d.amount.toLocaleString("en-IN")}</td>
                                                <td className="px-4 py-3.5">
                                                    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider ${badge.className}`}>
                                                        <Icon size={9} strokeWidth={3} /> {badge.label}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3.5 font-mono text-[11px] text-stone-500">{d.razorpayOrderId}</td>
                                                <td className="px-4 py-3.5 font-mono text-[11px] text-stone-500">{d.razorpayPaymentId ?? "—"}</td>
                                                <td className="px-4 py-3.5 text-[11px] text-stone-600">
                                                    {new Date(d.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {/* Mobile cards */}
                        <div className="space-y-3 md:hidden">
                            {donations.map((d) => {
                                const badge = STATUS_BADGE[d.status];
                                const Icon = badge.icon;
                                return (
                                    <div key={d._id} className="rounded-2xl border border-white/[0.06] bg-[#0f0f16] p-4">
                                        <div className="flex items-center justify-between gap-2">
                                            <p className="font-bold text-white">{d.customerName}</p>
                                            <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider ${badge.className}`}>
                                                <Icon size={9} strokeWidth={3} /> {badge.label}
                                            </span>
                                        </div>
                                        <p className="mt-1 text-lg font-black text-amber-400">₹{d.amount.toLocaleString("en-IN")}</p>
                                        <p className="mt-2 truncate font-mono text-[10.5px] text-stone-600">{d.razorpayOrderId}</p>
                                        <p className="mt-2 text-[11px] text-stone-600">
                                            {new Date(d.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                                        </p>
                                    </div>
                                );
                            })}
                        </div>
                    </>
                )}

                <Pagination
                    meta={meta}
                    basePath="/admin/donations"
                    searchParams={{
                        search: filters.search || undefined,
                        status: filters.status !== "all" ? filters.status : undefined,
                    }}
                    itemLabel="contributions"
                />
            </div>
        </div>
    );
}
