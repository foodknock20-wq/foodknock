// src/app/admin/coupons/page.tsx
//
// Phase 11 — admin Coupon Management. Server component just renders the
// shell; CouponManager (client) owns all data fetching/mutation — mirrors
// src/app/admin/delivery/page.tsx's split, but coupons are paginated (the
// list can grow into the thousands via bulk generation) so, unlike
// delivery settings, there's no single server-fetched initial payload —
// the client component fetches its own first page on mount.

import CouponManager from "@/components/admin/coupons/CouponManager";
import AdminPageHeader from "@/components/admin/shared/AdminPageHeader";
import { Ticket } from "lucide-react";

export default function AdminCouponsPage() {
    return (
        <div className="space-y-5 pb-8">
            <AdminPageHeader
                icon={Ticket}
                title="Coupons"
                description="Create, bulk-generate, and manage discount coupons — one per order, server-validated"
            />

            <CouponManager />
        </div>
    );
}
