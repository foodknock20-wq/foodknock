// src/app/admin/delivery/page.tsx
//
// Phase 10 — admin Delivery & Serviceability settings. Server component
// fetches the current singleton via the same getDeliverySettings() every
// other caller uses (one authoritative source, no duplicate fetch logic),
// then hands it to a client form for editing.

import { getDeliverySettings } from "@/lib/deliverySettings";
import DeliverySettingsForm from "@/components/admin/delivery/DeliverySettingsForm";
import AdminPageHeader from "@/components/admin/shared/AdminPageHeader";
import { MapPin } from "lucide-react";

export default async function AdminDeliveryPage() {
    const settings = await getDeliverySettings();

    return (
        <div className="space-y-5 pb-8">
            <AdminPageHeader
                icon={MapPin}
                title="Delivery Settings"
                description="Kitchen location, service radius, order rules, and distance-based pricing — applies immediately"
            />

            <DeliverySettingsForm initialSettings={settings} />
        </div>
    );
}
