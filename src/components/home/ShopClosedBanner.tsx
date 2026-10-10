// src/components/home/ShopClosedBanner.tsx
//
// FoodKnock UI 2.0 — Phase 2: Home-facing shop-status awareness (spec
// section 23), absent from Home before this phase. Reuses the existing
// server-side getShopStatus()/describeCloseReason() exactly as
// src/app/(main)/menu/page.tsx already does — no new shop-status source,
// no bypass of closed-shop ordering rules (those are enforced elsewhere,
// unchanged). Renders nothing when the shop is open.

import { AlertTriangle } from "lucide-react";

export default function ShopClosedBanner({ closedReasonLabel }: { closedReasonLabel: string | null }) {
    return (
        <div className="mx-4 mt-4 flex items-center gap-3 rounded-fk-md border border-fk-danger/30 bg-fk-danger/10 px-4 py-3 md:mx-8">
            <AlertTriangle size={18} className="shrink-0 text-fk-danger" />
            <p className="text-[13px] text-fk-text">
                <span className="font-black">We&apos;re currently closed.</span>{" "}
                {closedReasonLabel ? <span>{closedReasonLabel}</span> : "Back online soon — browse the menu in the meantime."}
            </p>
        </div>
    );
}
