export const dynamic = "force-dynamic";

// src/app/admin/payment-reconciliation/page.tsx
//
// Phase 17.1A (audit finding F1) — admin visibility for Razorpay payments
// captured without a matching FoodKnock order. Same server-side
// pagination/search/filter pattern as /admin/donations: bounded queries
// only, server component does the real DB read, a small client component
// handles the two interactive actions (recover / dismiss).
//
// Default filter is "pending_review" — the queue an admin actually needs
// to work through. Other tabs (recovered/recovery_failed/dismissed/all)
// are for audit/history, not day-to-day triage.

import { connectDB } from "@/lib/db";
import PendingPayment from "@/models/PendingPayment";
import Pagination from "@/components/admin/shared/Pagination";
import AdminListSearchBar from "@/components/admin/shared/AdminListSearchBar";
import { parseAdminPagination, buildPaginationMeta } from "@/lib/adminPagination";
import AdminPageHeader from "@/components/admin/shared/AdminPageHeader";
import ReconciliationRowActions from "@/components/admin/payment-reconciliation/ReconciliationRowActions";
import Link from "next/link";
import { ShieldAlert, CheckCircle2, XCircle, Ban, HelpCircle } from "lucide-react";

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

type ReconRow = {
    _id: string;
    razorpayOrderId: string;
    razorpayPaymentId: string | null;
    status: string;
    expectedAmount: number;
    orderId: string | null;
    customerName: string;
    phoneLast4: string;
    createdAt: string;
    reconciliationState: "pending_review" | "recovered" | "recovery_failed" | "dismissed" | null;
    reviewReason: string | null;
    recoveryAttempts: number;
    lastRecoveryError: string;
};

const STATE_TABS = [
    { value: "pending_review", label: "Needs Review" },
    { value: "recovery_failed", label: "Recovery Failed" },
    { value: "recovered", label: "Recovered" },
    { value: "dismissed", label: "Dismissed" },
    { value: "all", label: "All" },
] as const;

async function getReconciliationRows(searchParams: Awaited<SearchParams>) {
    await connectDB();

    const { page, limit, skip } = parseAdminPagination(searchParams, { defaultLimit: 25, maxLimit: 100 });
    const search = typeof searchParams.search === "string" ? searchParams.search.trim() : "";
    const stateParam = typeof searchParams.state === "string" ? searchParams.state : "pending_review";
    const state = (STATE_TABS.map((t) => t.value) as readonly string[]).includes(stateParam)
        ? (stateParam as (typeof STATE_TABS)[number]["value"])
        : "pending_review";

    const filter: Record<string, unknown> = {};
    if (state === "all") filter.reconciliationState = { $ne: null };
    else filter.reconciliationState = state;

    if (search) {
        filter.$or = [
            { razorpayOrderId: { $regex: search, $options: "i" } },
            { razorpayPaymentId: { $regex: search, $options: "i" } },
            { "payload.customerName": { $regex: search, $options: "i" } },
        ];
    }

    const [rows, total, pendingCount] = await Promise.all([
        PendingPayment.find(filter)
            .sort({ updatedAt: -1 })
            .skip(skip)
            .limit(limit)
            .select(
                "razorpayOrderId razorpayPaymentId status expectedAmount orderId createdAt " +
                "reconciliationState reviewReason recoveryAttempts lastRecoveryError payload.customerName payload.phone"
            )
            .lean(),
        PendingPayment.countDocuments(filter),
        PendingPayment.countDocuments({ reconciliationState: "pending_review" }),
    ]);

    const items: ReconRow[] = (rows as Array<Record<string, unknown>>).map((r) => ({
        _id:                String(r._id),
        razorpayOrderId:    String(r.razorpayOrderId),
        razorpayPaymentId:  (r.razorpayPaymentId as string | undefined) ?? null,
        status:             String(r.status),
        expectedAmount:     Number(r.expectedAmount),
        orderId:            (r.orderId as string | null) ?? null,
        customerName:       (r.payload as { customerName?: string } | undefined)?.customerName ?? "—",
        phoneLast4:         String((r.payload as { phone?: string } | undefined)?.phone ?? "").slice(-4),
        createdAt:          r.createdAt ? new Date(r.createdAt as Date).toISOString() : new Date().toISOString(),
        reconciliationState: (r.reconciliationState as ReconRow["reconciliationState"]) ?? null,
        reviewReason:       (r.reviewReason as string | null) ?? null,
        recoveryAttempts:   Number(r.recoveryAttempts ?? 0),
        lastRecoveryError:  String(r.lastRecoveryError ?? ""),
    }));

    return { items, meta: buildPaginationMeta(total, page, limit), filters: { search, state }, pendingCount };
}

const REASON_LABEL: Record<string, string> = {
    captured_no_order: "Captured, no order",
    amount_mismatch: "Amount mismatch",
    currency_mismatch: "Currency mismatch",
    not_captured_on_recheck: "No longer captured",
    // Phase 17.1A follow-up — a "processing" claim went stale (the process
    // that won it crashed before completing or releasing it).
    stale_processing_claim: "Stale claim (crash recovery)",
};

export default async function AdminPaymentReconciliationPage({ searchParams }: { searchParams: SearchParams }) {
    const resolvedSearchParams = await searchParams;
    const { items, meta, filters, pendingCount } = await getReconciliationRows(resolvedSearchParams);

    return (
        <div className="space-y-6">
            <AdminPageHeader
                icon={ShieldAlert}
                title="Payment Reconciliation"
                description={
                    pendingCount > 0
                        ? `${pendingCount} captured payment${pendingCount !== 1 ? "s" : ""} awaiting review — Razorpay confirmed the charge but no order exists yet`
                        : "No payments currently awaiting review"
                }
            />

            <div className="rounded-2xl border border-white/[0.06] bg-[#111118] p-5">
                <div className="mb-5 flex flex-col gap-3">
                    <AdminListSearchBar placeholder="Search by Razorpay order/payment ID or customer name…" />
                    <div className="flex flex-wrap gap-1.5">
                        {STATE_TABS.map((t) => {
                            const params = new URLSearchParams();
                            if (filters.search) params.set("search", filters.search);
                            if (t.value !== "pending_review") params.set("state", t.value);
                            params.set("page", "1");
                            const active = filters.state === t.value;
                            return (
                                <Link
                                    key={t.value}
                                    href={`/admin/payment-reconciliation?${params.toString()}`}
                                    className={`rounded-lg border px-2.5 py-1.5 text-[11.5px] font-bold transition-colors ${active
                                        ? "border-amber-500/40 bg-amber-500/15 text-amber-400"
                                        : "border-white/[0.07] bg-white/[0.03] text-stone-300 hover:bg-white/[0.06]"
                                        }`}
                                >
                                    {t.label}
                                </Link>
                            );
                        })}
                    </div>
                </div>

                {items.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-24 text-center">
                        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-white/[0.06] bg-white/[0.03]">
                            <CheckCircle2 size={26} className="text-emerald-500" strokeWidth={1.5} />
                        </div>
                        <p className="text-base font-black text-white">Nothing here</p>
                        <p className="mt-1.5 text-sm text-stone-600">No records match this filter.</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {items.map((row) => (
                            <div key={row._id} className="rounded-2xl border border-white/[0.06] bg-[#0f0f16] p-4">
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2">
                                            <p className="font-bold text-white">{row.customerName}</p>
                                            {row.phoneLast4 && (
                                                <span className="text-[11px] text-stone-600">•••{row.phoneLast4}</span>
                                            )}
                                        </div>
                                        <p className="mt-1 font-mono text-[11px] text-stone-500">
                                            {row.razorpayOrderId}
                                            {row.razorpayPaymentId ? ` · ${row.razorpayPaymentId}` : ""}
                                        </p>
                                        <p className="mt-1 text-[11px] text-stone-600">
                                            Expected ₹{row.expectedAmount.toLocaleString("en-IN")} ·{" "}
                                            {new Date(row.createdAt).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                                            {row.recoveryAttempts > 0 ? ` · ${row.recoveryAttempts} attempt${row.recoveryAttempts !== 1 ? "s" : ""}` : ""}
                                        </p>
                                        {row.lastRecoveryError && (
                                            <p className="mt-1 text-[11px] text-rose-400">{row.lastRecoveryError}</p>
                                        )}
                                    </div>

                                    <div className="flex shrink-0 items-center gap-2">
                                        <StateBadge state={row.reconciliationState} reason={row.reviewReason} />
                                    </div>
                                </div>

                                <ReconciliationRowActions
                                    id={row._id}
                                    reconciliationState={row.reconciliationState}
                                    orderId={row.orderId}
                                />
                            </div>
                        ))}
                    </div>
                )}

                <Pagination
                    meta={meta}
                    basePath="/admin/payment-reconciliation"
                    searchParams={{
                        search: filters.search || undefined,
                        state: filters.state !== "pending_review" ? filters.state : undefined,
                    }}
                    itemLabel="records"
                />
            </div>
        </div>
    );
}

function StateBadge({ state, reason }: { state: ReconRow["reconciliationState"]; reason: string | null }) {
    if (state === "recovered") {
        return (
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-emerald-400">
                <CheckCircle2 size={9} strokeWidth={3} /> Recovered
            </span>
        );
    }
    if (state === "dismissed") {
        return (
            <span className="inline-flex items-center gap-1 rounded-full border border-stone-500/25 bg-stone-500/10 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-stone-400">
                <Ban size={9} strokeWidth={3} /> Dismissed
            </span>
        );
    }
    if (state === "recovery_failed") {
        return (
            <span className="inline-flex items-center gap-1 rounded-full border border-rose-500/25 bg-rose-500/10 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-rose-400">
                <XCircle size={9} strokeWidth={3} /> Recovery Failed
            </span>
        );
    }
    return (
        <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/25 bg-amber-500/10 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-amber-400">
            <HelpCircle size={9} strokeWidth={3} /> {reason ? (REASON_LABEL[reason] ?? "Needs Review") : "Needs Review"}
        </span>
    );
}
