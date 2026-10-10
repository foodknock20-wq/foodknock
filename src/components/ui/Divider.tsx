// src/components/ui/Divider.tsx — FoodKnock UI 2.0 Phase 1 primitive.
// Premium UI leans on dividers/spacing instead of boxing everything in
// cards — see Phase 1 spec section 8.

import { cn } from "@/lib/utils";

export default function Divider({ className }: { className?: string }) {
    return <div role="separator" className={cn("h-px w-full bg-fk-border", className)} />;
}
