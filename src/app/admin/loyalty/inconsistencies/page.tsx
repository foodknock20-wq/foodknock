export const dynamic = "force-dynamic";

// src/app/admin/loyalty/inconsistencies/page.tsx
//
// Phase 17.1B — admin visibility for the two loyalty-integrity diagnostics:
// orders whose recorded redemption never reached the ledger, and ledger
// claims stuck "pending" past a crashed process. Server component reads
// directly via the same functions the API route calls (consistent with
// the Phase 17.1A payment-reconciliation page's pattern); a small client
// component handles the two repair actions.

import { connectDB } from "@/lib/db";
import {
    findInconsistentLoyaltyRedemptions,
    findStalePendingLedgerClaims,
} from "@/lib/loyaltyService";
import AdminPageHeader from "@/components/admin/shared/AdminPageHeader";
import InconsistencyRowActions from "@/components/admin/loyalty/InconsistencyRowActions";
import { ShieldAlert } from "lucide-react";

export default async function AdminLoyaltyInconsistenciesPage() {
    await connectDB();

    const [redemptionCandidates, staleClaims] = await Promise.all([
        findInconsistentLoyaltyRedemptions(100),
        findStalePendingLedgerClaims(100),
    ]);

    const totalCount = redemptionCandidates.length + staleClaims.length;

    return (
        <div className="space-y-6">
            <AdminPageHeader
                icon={ShieldAlert}
                title="Loyalty Inconsistencies"
                description={
                    totalCount > 0
                        ? `${totalCount} item${totalCount !== 1 ? "s" : ""} need review`
                        : "No known inconsistencies"
                }
            />

            <div className="rounded-2xl border border-white/[0.06] bg-[#111118] p-5">
                <h2 className="mb-3 text-sm font-black text-stone-200">Failed redemption deductions</h2>
                <p className="mb-4 text-[12px] text-stone-500">
                    An order recorded a points discount, but the deduction was never confirmed against the user&apos;s ledger.
                </p>
                {redemptionCandidates.length === 0 ? (
                    <p className="py-6 text-center text-[13px] text-stone-600">None found.</p>
                ) : (
                    <div className="space-y-3">
                        {redemptionCandidates.map((c) => (
                            <div key={c.orderMongoId} className="rounded-xl border border-white/[0.06] bg-[#0f0f16] p-4">
                                <p className="font-mono text-[11px] text-stone-500">{c.orderId}</p>
                                <p className="mt-1 text-[12px] text-stone-400">
                                    {c.redeemedPoints} pts (₹{c.redeemedAmount}) · user {c.userId}
                                </p>
                                {c.reason && <p className="mt-1 text-[11px] text-rose-400">{c.reason}</p>}
                                <InconsistencyRowActions kind="redemption" orderMongoId={c.orderMongoId} />
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className="rounded-2xl border border-white/[0.06] bg-[#111118] p-5">
                <h2 className="mb-3 text-sm font-black text-stone-200">Stale pending ledger claims</h2>
                <p className="mb-4 text-[12px] text-stone-500">
                    A loyalty operation was claimed but never finalized — almost always a crashed/killed request mid-operation.
                </p>
                {staleClaims.length === 0 ? (
                    <p className="py-6 text-center text-[13px] text-stone-600">None found.</p>
                ) : (
                    <div className="space-y-3">
                        {staleClaims.map((c) => (
                            <div key={c.claimId} className="rounded-xl border border-white/[0.06] bg-[#0f0f16] p-4">
                                <p className="text-[12px] font-semibold text-stone-300">
                                    {c.type} · {c.points > 0 ? "+" : ""}{c.points} pts · user {c.userId}
                                </p>
                                <p className="mt-1 font-mono text-[11px] text-stone-500">
                                    {c.orderId ?? "no order"} · claimed {new Date(c.createdAt).toLocaleString("en-IN")}
                                </p>
                                <InconsistencyRowActions kind="staleClaim" claimId={c.claimId} />
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
