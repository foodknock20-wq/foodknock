"use client";

// src/components/orders/ReorderButton.tsx
//
// Reorder — resolves a past order's items against CURRENT Product data and
// adds whatever's still valid to the cart. Never trusts the order's own
// snapshot price/stock (that's what was true at order time, not now).
//
// ── ROOT CAUSE FIX (Orders 2.0 / Reorder reliability audit) ─────────────
// Reorder was showing "These items are currently unavailable" even for
// real, in-stock FoodKnock products. Traced end to end: the bug was NOT
// here — it was that src/lib/createOrderCore.ts never actually persisted
// `productId` on Order.items (it carried the product id under a `_id` key
// that Mongoose silently discarded against OrderItemSchema's `productId`
// field). Every item's `productId` was `null` in the database, so this
// component's own `withProductId` filter correctly, honestly reported
// "nothing to resolve" — because there genuinely was nothing to resolve.
// Fixed at the source (createOrderCore.ts) so all orders placed from now
// on carry a real productId; pre-fix historical orders still can't be
// reordered by id (that data was never captured) — see this task's final
// report for the full explanation.
//
// Error classification (this file) — distinguishes:
//   A. all available        → full success
//   B. some available       → partial success, names what's missing
//   C. none available       → "unavailable" state with a Browse Menu CTA
//   D. the bulk product fetch itself failed (network/API) → a DISTINCT
//      "couldn't refresh products" message — never silently reclassified
//      as "items unavailable", which would be a lie about the real cause.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "react-hot-toast";
import { Loader2, RotateCcw, ArrowRight } from "lucide-react";
import { useCartStore } from "@/store/cartStore";

type ReorderItem = { productId: string | null; name: string; quantity: number; price: number };

type ProductLite = {
    _id: string;
    name: string;
    price: number;
    image: string;
    stock: number;
    category: string;
    isAvailable: boolean;
};

export default function ReorderButton({ items, status }: { items: ReorderItem[]; status: string }) {
    const addItem = useCartStore((s) => s.addItem);
    const router = useRouter();
    const [busy, setBusy] = useState(false);

    // Reorder only ever makes sense for a completed, delivered order — never
    // blindly enabled for cancelled/failed/pending/abandoned orders.
    if (status !== "delivered") return null;

    async function handleReorder() {
        if (busy) return;
        setBusy(true);

        const withProductId = items.filter((i): i is ReorderItem & { productId: string } => !!i.productId);
        const noProductId = items.length - withProductId.length;

        let products: ProductLite[] = [];
        if (withProductId.length > 0) {
            try {
                const ids = withProductId.map((i) => i.productId).join(",");
                const res = await fetch(`/api/products?ids=${encodeURIComponent(ids)}`);
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const data = await res.json();
                if (!data?.success) throw new Error("Malformed response");
                products = data.products;
            } catch (err) {
                // Classification D — the resolution request itself failed.
                // This is NEVER the same message as "items unavailable":
                // we don't actually know availability, so we must not claim
                // we do.
                console.error("REORDER_PRODUCT_FETCH_FAILED", err);
                setBusy(false);
                toast.error("Couldn't refresh products. Please try again.");
                return;
            }
        }

        const byId = new Map(products.map((p) => [p._id, p]));

        let added = 0;
        let addedUnits = 0;
        let priceChanged = 0;
        let unavailable = noProductId;

        for (const item of withProductId) {
            const product = byId.get(item.productId);
            if (!product || !product.isAvailable || product.stock <= 0) {
                unavailable++;
                continue;
            }

            if (product.price !== item.price) priceChanged++;

            // Clamp to current stock (never restore the historical quantity
            // if that now exceeds what's actually available).
            const qty = Math.max(1, Math.min(item.quantity, product.stock));
            for (let i = 0; i < qty; i++) {
                addItem({
                    _id: product._id,
                    name: product.name,
                    price: product.price,
                    image: product.image,
                    quantity: 1,
                    stock: product.stock,
                    category: product.category,
                });
            }
            added++;
            addedUnits += qty;
        }

        setBusy(false);

        // Classification C — nothing could be added at all.
        if (added === 0) {
            toast.error(
                (t) => (
                    <div className="flex flex-col gap-2">
                        <p className="text-sm font-bold text-fk-text">None of these items are currently available.</p>
                        <button
                            onClick={() => { toast.dismiss(t.id); router.push("/menu"); }}
                            className="self-start text-xs font-black text-[var(--fk-accent)] hover:underline"
                        >
                            Browse Menu →
                        </button>
                    </div>
                ),
                { duration: 6000 }
            );
            return;
        }

        // Classification A/B — full or partial success. Never auto-navigates
        // to checkout/payment — only ever offers a "View Cart" action.
        const itemWord = added === 1 ? "item" : "items";
        const notes: string[] = [];
        if (unavailable > 0) notes.push(`${unavailable} unavailable`);
        if (priceChanged > 0) notes.push(`${priceChanged} price${priceChanged > 1 ? "s" : ""} updated`);

        toast.success(
            (t) => (
                <div className="flex flex-col gap-2">
                    <p className="text-sm font-bold text-fk-text">Added to cart</p>
                    <p className="text-xs text-fk-text-secondary">
                        {added} {itemWord} from your previous order{addedUnits !== added ? ` (${addedUnits} units)` : ""}
                        {notes.length > 0 ? ` — ${notes.join(", ")}.` : "."}
                    </p>
                    <button
                        onClick={() => { toast.dismiss(t.id); router.push("/cart"); }}
                        className="flex items-center gap-1 self-start text-xs font-black text-[var(--fk-accent)] hover:underline"
                    >
                        View Cart <ArrowRight size={11} />
                    </button>
                </div>
            ),
            { duration: 6000 }
        );
    }

    return (
        <button
            onClick={handleReorder}
            disabled={busy}
            aria-label="Reorder this order"
            className="group flex items-center justify-center gap-2 rounded-fk-md border border-[var(--fk-accent)]/25 bg-gradient-to-b from-fk-gold-soft to-fk-surface-elevated px-5 py-3 text-sm font-black text-[var(--fk-accent)] shadow-fk-sm transition-all hover:border-[var(--fk-accent)]/40 hover:shadow-fk-md active:scale-[0.98] disabled:cursor-wait disabled:opacity-70"
        >
            {busy ? (
                <>
                    <Loader2 size={16} className="animate-spin" /> Adding to cart…
                </>
            ) : (
                <>
                    <RotateCcw size={16} strokeWidth={2.25} className="transition-transform group-hover:-rotate-45" />
                    Reorder Items
                </>
            )}
        </button>
    );
}
