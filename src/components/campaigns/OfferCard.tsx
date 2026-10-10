// src/components/campaigns/OfferCard.tsx
//
// Phase 12 completion — reusable offer presentation. Server component (no
// client JS needed just to render a card) used by both the campaign
// detail page and the homepage strip — one offer-card definition, not two.

import type { PublicOffer } from "@/lib/campaignPublic";
import { Tag, Truck } from "lucide-react";

function headline(offer: PublicOffer): string {
    if (offer.discountType === "FREE_DELIVERY") return "FREE DELIVERY";
    if (offer.discountType === "PERCENTAGE") return `${offer.discountValue}% OFF`;
    return `₹${offer.discountValue} OFF`;
}

export default function OfferCard({ offer }: { offer: PublicOffer }) {
    return (
        <div className="flex items-start gap-3 rounded-2xl border border-orange-100 bg-white p-4 shadow-sm">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-50">
                {offer.discountType === "FREE_DELIVERY" ? (
                    <Truck size={17} className="text-orange-600" />
                ) : (
                    <Tag size={17} className="text-orange-600" />
                )}
            </div>
            <div className="min-w-0">
                <p className="text-[15px] font-black text-stone-900">{headline(offer)}</p>
                {offer.name && <p className="text-[12.5px] font-semibold text-stone-600">{offer.name}</p>}
                <p className="mt-0.5 text-[11.5px] text-stone-400">
                    {offer.minimumOrderValue > 0 ? `On orders above ₹${offer.minimumOrderValue}` : "No minimum order"}
                    {offer.discountType === "PERCENTAGE" && offer.maximumDiscount != null && ` · up to ₹${offer.maximumDiscount} off`}
                </p>
            </div>
        </div>
    );
}
