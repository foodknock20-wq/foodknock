// src/app/admin/campaigns/page.tsx
//
// Phase 12 — admin Campaign Center shell. CampaignCenter (client) owns
// all data/mutations across its four tabs (Campaigns / Offers / Spin
// Rewards / Offline Distribution) — same server-shell/client-body split
// as /admin/delivery and /admin/coupons.

import CampaignCenter from "@/components/admin/campaigns/CampaignCenter";
import AdminPageHeader from "@/components/admin/shared/AdminPageHeader";
import { Sparkles } from "lucide-react";

export default function AdminCampaignsPage() {
    return (
        <div className="space-y-5 pb-8">
            <AdminPageHeader
                icon={Sparkles}
                title="Campaigns"
                description="Campaigns, automatic offers, Digital Spin rewards, and physical distribution tracking"
            />

            <CampaignCenter />
        </div>
    );
}
