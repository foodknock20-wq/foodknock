"use client";

// src/components/home/ProductRail.tsx
//
// FoodKnock UI 2.0 — Phase 2: the one reusable product rail used 4× on
// Home (Featured Products / Popular Right Now / Under ₹99 / Combo Deals)
// instead of 4 bespoke components — spec section 40. This is the first
// phase src/components/ui/ProductCardShell.tsx is wired to the REAL cart:
// add-to-cart mirrors src/components/products/ProductCard.tsx's existing
// handleAdd exactly (same guest-gate via useAuthStore, same addItem from
// cartStore, same toast feedback) — same cart, same rules, nothing
// reinvented. Once a product is in the cart, the card shows a live +/-
// stepper driven by the real cart quantity (cartStore.increaseQty/
// decreaseQty), not a fake local counter.
//
// Premium Toast Redesign: this component used to hand-roll its OWN copy of
// the exact same guest-gate + toast + redirect logic `useAddToCart`
// (src/hooks/useAddToCart.ts) already centralizes — a second, independent
// implementation of the identical "Please sign in to add items to your
// cart" flow, with its own un-deduplicated toast (no stable `id`, unlike
// the shared hook's). That duplication is the direct cause the task asked
// to find: two different code paths could each show their own "Please
// sign in..." toast depending on which product card the user tapped (this
// rail vs. every other product-card surface in the app), with no
// coordination between them. Now this rail uses the SAME shared hook
// every other add-to-cart surface already uses — one implementation, one
// toast instance (deduplicated via the hook's stable ids), not two.
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useCartStore, selectItems } from "@/store/cartStore";
import { useAddToCart } from "@/hooks/useAddToCart";
import ProductCardShell, { type ProductCardShellProduct } from "@/components/ui/ProductCardShell";

export type RailProduct = ProductCardShellProduct & { slug: string; category: string };

export default function ProductRail({
    title,
    viewAllHref,
    products,
}: {
    title: string;
    viewAllHref: string;
    products: RailProduct[];
}) {
    const items = useCartStore(selectItems);
    const increaseQty = useCartStore((s) => s.increaseQty);
    const decreaseQty = useCartStore((s) => s.decreaseQty);
    const { handleAdd } = useAddToCart();

    if (products.length === 0) return null;

    return (
        <section className="py-3">
            <div className="mb-3 flex items-center justify-between gap-2 px-4 md:px-8">
                <h2 className="min-w-0 truncate font-display text-[17px] font-black text-fk-text sm:text-[18px]">{title}</h2>
                <Link href={viewAllHref} className="flex shrink-0 items-center gap-1 text-[12px] font-bold text-[var(--fk-accent)]">
                    View all <ArrowRight size={12} />
                </Link>
            </div>
            <div className="fk-rail-scroll flex gap-3 overflow-x-auto px-4 pb-2.5 md:grid md:grid-cols-4 md:px-8 md:pb-1 lg:grid-cols-5">
                {products.map((product) => {
                    const cartItem = items.find((i) => i._id === product._id);
                    return (
                        <ProductCardShell
                            key={product._id}
                            product={product}
                            href={`/menu/${product.slug}`}
                            onAdd={() => handleAdd(product, `${product.name} added! 🛒`)}
                            quantity={cartItem?.quantity ?? 0}
                            onIncrease={() => increaseQty(product._id)}
                            onDecrease={() => decreaseQty(product._id)}
                            className="w-[148px] shrink-0 sm:w-[160px] md:w-auto"
                        />
                    );
                })}
            </div>
        </section>
    );
}
