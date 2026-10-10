// src/components/ui/PriceDisplay.tsx — FoodKnock UI 2.0 Phase 1 primitive.
// Strong price hierarchy per spec section 10 — price must read clearly,
// compare-at price visually subordinate and struck through.

import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils";

export interface PriceDisplayProps {
    price: number;
    compareAtPrice?: number | null;
    size?: "sm" | "md" | "lg";
    className?: string;
}

const SIZE_CLASSES = {
    sm: "text-[13px]",
    md: "text-[15px]",
    lg: "text-[19px]",
};

export default function PriceDisplay({ price, compareAtPrice, size = "md", className }: PriceDisplayProps) {
    const hasDiscount = typeof compareAtPrice === "number" && compareAtPrice > price;
    return (
        <span className={cn("inline-flex items-baseline gap-1.5", className)}>
            <span className={cn("font-black text-fk-text", SIZE_CLASSES[size])}>{formatCurrency(price)}</span>
            {hasDiscount && (
                <span className="text-[12px] font-medium text-fk-text-tertiary line-through">
                    {formatCurrency(compareAtPrice!)}
                </span>
            )}
        </span>
    );
}
