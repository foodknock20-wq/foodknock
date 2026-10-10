"use client";

// src/hooks/useAddToCart.ts
//
// FoodKnock Phase 3 (Menu/Search/Discovery) — consolidates add-to-cart
// logic that was independently copy-pasted across SIX product-card
// implementations (src/components/products/ProductCard.tsx,
// CategorySection.tsx's SectionCard, ComboSection.tsx's ComboCard,
// TopPicksSection.tsx's TopPickCard, ThaliSection.tsx's ThaliCard,
// IceCreamSection.tsx's ChillerCard) — each re-implementing the same
// guest-gate check, the same `cartStore.addItem` call shape, and a
// bespoke toast. This is a pure logic extraction: every call site keeps
// its own JSX/visual layout, only the `handleAdd` callback + transient
// "added" flash state move here. No behavior change to the cart itself —
// still the same `useCartStore().addItem`, same guest-gate semantics
// `ProductCard.tsx` already had (the other five previously lacked it;
// adopting this hook makes that guest-gate consistent across all six,
// which is a disclosed, intentional fix, not a regression).

import { useCallback, useRef, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toastError, toastSuccess } from "@/lib/toast";
import { useCartStore } from "@/store/cartStore";
import { useAuthStore } from "@/store/authStore";

export interface AddToCartProduct {
    _id: string;
    name: string;
    price: number;
    image: string;
    stock: number;
    category: string;
    isAvailable: boolean;
}

export function useAddToCart() {
    const addItem = useCartStore((s) => s.addItem);
    const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
    const router = useRouter();
    const [addingId, setAddingId] = useState<string | null>(null);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        return () => {
            if (timerRef.current !== null) clearTimeout(timerRef.current);
        };
    }, []);

    const handleAdd = useCallback(
        (product: AddToCartProduct, successMessage?: string, quantity: number = 1) => {
            const unavailable = !product.isAvailable || product.stock <= 0;
            if (unavailable) {
                toastError("This item is currently unavailable", 4500, { id: "fk-item-unavailable" });
                return;
            }
            if (isLoggedIn === false) {
                // Stable id — the same "only one visible toast of this
                // kind at a time" fix already applied below for the
                // add-to-cart success toast (id: "fk-add-to-cart").
                // Without it, tapping "Add" on several product cards in a
                // row while logged out (a real, easy-to-trigger sequence —
                // e.g. multiple items on the Home product rail) would
                // stack a duplicate "Please sign in..." card per tap
                // instead of this one simply re-appearing/resetting.
                toastError("Please sign in to add items to your cart", 4500, { id: "fk-signin-required" });
                router.push("/auth");
                return;
            }

            if (timerRef.current !== null) clearTimeout(timerRef.current);

            setAddingId(product._id);
            // cartStore.addItem increments by 1 against an existing line (or
            // seeds quantity 1 for a new line) — calling it `quantity` times
            // is the same end state as a single call with that quantity,
            // without needing a second cartStore API. Default stays 1, so
            // every pre-existing call site (6 product-card implementations)
            // is unaffected.
            for (let i = 0; i < Math.max(1, quantity); i++) {
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
            // Stable id → react-hot-toast replaces/updates the existing
            // toast in place instead of stacking a new one. Fixes rapid
            // sequential adds (e.g. tapping multiple Cart "Frequently Bought
            // Together" cards back to back) piling up as several
            // simultaneously-visible toasts. Explicit duration so this
            // never falls back to the library default. Shared across every
            // call site of this hook (Menu, Product Detail, Home rail, Cart
            // recommendations) by design — "max one visible add-to-cart
            // toast at a time" is the desired behavior everywhere, not just
            // here.
            toastSuccess(successMessage ?? `${product.name} added! 🛒`, 2200, { id: "fk-add-to-cart" });

            timerRef.current = setTimeout(() => {
                setAddingId(null);
                timerRef.current = null;
            }, 700);
        },
        [addItem, isLoggedIn, router]
    );

    return { handleAdd, addingId };
}
