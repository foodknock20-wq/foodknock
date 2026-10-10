"use client";

// src/components/admin/loyalty/InconsistencyRowActions.tsx
//
// Phase 17.1B — single "Repair" action per row, mirroring the existing
// admin action-button idiom (disabled-while-submitting, toast on result,
// router.refresh() to pull the server component's fresh state). Posts to
// the admin-gated /api/admin/loyalty/inconsistencies route — all the
// actual safety logic (re-verification, idempotent CAS writes, never
// guessing) lives server-side.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "react-hot-toast";
import { RefreshCw } from "lucide-react";

export default function InconsistencyRowActions({
    kind,
    orderMongoId,
    claimId,
}: {
    kind: "redemption" | "staleClaim";
    orderMongoId?: string;
    claimId?: string;
}) {
    const router = useRouter();
    const [busy, setBusy] = useState(false);

    const handleRepair = async () => {
        setBusy(true);
        try {
            const res = await fetch("/api/admin/loyalty/inconsistencies", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(kind === "redemption" ? { orderMongoId } : { claimId }),
            });
            const data = await res.json();
            if (data.success) {
                toast.success(
                    kind === "redemption"
                        ? (data.alreadyConsistent ? "Already consistent" : `Repaired — balance now ${data.balanceAfter}`)
                        : `Resolved: ${data.action}${data.balanceAfter !== undefined ? ` (balance ${data.balanceAfter})` : ""}`
                );
                router.refresh();
            } else {
                toast.error(data.message || "Repair failed — needs manual review");
            }
        } catch {
            toast.error("Network error — try again");
        } finally {
            setBusy(false);
        }
    };

    return (
        <button
            onClick={handleRepair}
            disabled={busy}
            className="mt-3 flex items-center gap-1.5 rounded-xl border border-amber-500/30 bg-amber-500/15 px-3 py-2 text-[12px] font-black text-amber-300 transition-all hover:bg-amber-500/25 disabled:cursor-wait disabled:opacity-50"
        >
            <RefreshCw size={12} className={busy ? "animate-spin" : ""} />
            {busy ? "Working…" : "Repair"}
        </button>
    );
}
