// src/store/cartStore.ts
// PERF: getTotalItems and getTotalPrice moved out of the store object as
//       standalone selector functions. Components should use them like:
//         const totalItems = useCartStore(selectTotalItems);
//         const totalPrice = useCartStore(selectTotalPrice);
//       This prevents re-renders from other store slices — only the items
//       array reference triggers the selector to recompute.
//
//       The inline methods are kept for backward compatibility with any code
//       that calls get().getTotalItems() / get().getTotalPrice() directly,
//       but component-level usage should prefer the exported selectors.

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export type CartItem = {
  _id: string;
  name: string;
  price: number;
  image: string;
  quantity: number;
  stock: number;
  category: string;
};

type CartStore = {
  items: CartItem[];
  addItem: (item: CartItem) => void;
  removeItem: (id: string) => void;
  increaseQty: (id: string) => void;
  decreaseQty: (id: string) => void;
  setQuantity: (id: string, quantity: number) => void;
  updateItem: (id: string, patch: Partial<Pick<CartItem, "price" | "stock">>) => void;
  clearCart: () => void;
  getTotalItems: () => number;
  getTotalPrice: () => number;
};

// PERF: stable selector functions — use these in components instead of
//       useCartStore(s => s.getTotalItems()) which creates a new function each render
export const selectTotalItems = (s: CartStore) =>
  s.items.reduce((sum, i) => sum + i.quantity, 0);

export const selectTotalPrice = (s: CartStore) =>
  s.items.reduce((sum, i) => sum + i.price * i.quantity, 0);

export const selectItems = (s: CartStore) => s.items;

// safe localStorage wrapper
const safeStorage = {
  getItem: (name: string) => {
    try {
      return localStorage.getItem(name);
    } catch {
      return null;
    }
  },

  setItem: (name: string, value: string) => {
    try {
      localStorage.setItem(name, value);
    } catch (err) {
      console.warn("⚠️ Cart storage quota exceeded, resetting cart");
      try {
        localStorage.removeItem(name);
      } catch {}
    }
  },

  removeItem: (name: string) => {
    try {
      localStorage.removeItem(name);
    } catch {}
  },
};

const MAX_CART_ITEMS = 50;

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],

      addItem: (item) => {
        try {
          const items = get().items;

          // cart size limit
          if (items.length >= MAX_CART_ITEMS) {
            console.warn("Cart item limit reached");
            return;
          }

          const existing = items.find((i) => i._id === item._id);

          if (existing) {
            set({
              items: items.map((i) =>
                i._id === item._id
                  ? { ...i, quantity: Math.min(i.quantity + 1, i.stock) }
                  : i
              ),
            });
          } else {
            set({
              items: [
                ...items,
                {
                  _id: item._id,
                  name: item.name,
                  price: item.price,
                  image: item.image,
                  stock: item.stock,
                  category: item.category,
                  quantity: Math.min(1, item.stock),
                },
              ],
            });
          }
        } catch (err) {
          console.error("Cart addItem error:", err);
          set({ items: [] });
        }
      },

      removeItem: (id) => {
        try {
          set({
            items: get().items.filter((i) => i._id !== id),
          });
        } catch {
          set({ items: [] });
        }
      },

      increaseQty: (id) => {
        try {
          set({
            items: get().items.map((i) =>
              i._id === id
                ? { ...i, quantity: Math.min(i.quantity + 1, i.stock) }
                : i
            ),
          });
        } catch {
          set({ items: [] });
        }
      },

      decreaseQty: (id) => {
        try {
          const updated = get()
            .items.map((i) =>
              i._id === id ? { ...i, quantity: i.quantity - 1 } : i
            )
            .filter((i) => i.quantity > 0);

          set({ items: updated });
        } catch {
          set({ items: [] });
        }
      },

      // PHASE 4: lets the cart page set an exact, server-validated quantity
      // (e.g. "reduce to 2 available") instead of only +/-1 stepping.
      // Clamped to [0, stock] exactly like increaseQty; 0 removes the item,
      // consistent with decreaseQty's existing behavior.
      setQuantity: (id, quantity) => {
        try {
          const items = get().items;
          const target = items.find((i) => i._id === id);
          if (!target) return;

          const clamped = Math.max(0, Math.min(Math.floor(quantity), target.stock));
          if (clamped <= 0) {
            set({ items: items.filter((i) => i._id !== id) });
            return;
          }
          set({
            items: items.map((i) => (i._id === id ? { ...i, quantity: clamped } : i)),
          });
        } catch {
          set({ items: [] });
        }
      },

      // PHASE 4: syncs server-authoritative price/stock onto an existing
      // cart line after validation (e.g. price changed from ₹199 → ₹229,
      // or stock dropped) — never changes identity (_id) or quantity.
      updateItem: (id, patch) => {
        try {
          set({
            items: get().items.map((i) => (i._id === id ? { ...i, ...patch } : i)),
          });
        } catch {}
      },

      clearCart: () => {
        try {
          set({ items: [] });
        } catch {}
      },

      // PERF: kept for backward compat — prefer selectTotalItems/selectTotalPrice
      //       as standalone selectors in component subscriptions
      getTotalItems: () => selectTotalItems(get()),
      getTotalPrice: () => selectTotalPrice(get()),
    }),
    {
      name: "foodknock-cart-v1",
      version: 3,

      storage: createJSONStorage(() => safeStorage as Storage),

      migrate: (persisted: any, version) => {
        try {
          if (!persisted || version < 3) {
            return { items: [] };
          }
          return persisted;
        } catch {
          return { items: [] };
        }
      },

      partialize: (state) => ({
        items: state.items,
      }),
    }
  )
);
