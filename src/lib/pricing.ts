// src/lib/pricing.ts
//
// ── SERVER-AUTHORITATIVE PRICING FOUNDATION (Phase 2A) ──────────────────────
//
// Problem this solves:
//   Every order-creation path (Razorpay create-order, COD, the legacy
//   /api/orders route, and verify's pre-PendingPayment fallback) computed
//   subtotal/financials from client-supplied item.price. A request could
//   send { _id, quantity, price: 1 } for a ₹199 product and the server would
//   happily charge/record ₹1.
//
// Fix:
//   calculateAuthoritativePricing() is the single place that turns client
//   cart input (productId + quantity ONLY — price is read but never used)
//   into a trustworthy { items, subtotal }. Unit price, name and image are
//   always re-derived from the live Product document in MongoDB. Callers
//   must use the returned `items`/`subtotal`, never the client's own values.
//
// Snapshot semantics (preserves historical order pricing — see Order model):
//   This is called ONCE at the point a charge/order is first computed
//   (Razorpay create-order step, or immediately before a COD order is
//   created). The resulting price is then carried forward as-is (e.g. via
//   PendingPayment.payload) for the rest of that payment's lifecycle, even
//   if Product.price changes later — exactly like Razorpay has already
//   charged the customer. createOrderCore does not re-derive price from the
//   DB a second time; it trusts the authoritative snapshot produced here.
//
// Stock decrement itself still happens only in createOrderCore (inventory
// mutation needs the live Mongoose document, not this lean projection) —
// but as of Phase 4, calculateAuthoritativePricing ALSO rejects insufficient
// stock up front (see below), so a Razorpay order is never even created for
// a quantity that's already known to be unfulfillable.

import mongoose from "mongoose";
import Product from "@/models/Product";

export interface ClientCartItemInput {
    _id:      string;
    quantity: number;
    // Any client-supplied `price`/`name`/`image` is intentionally ignored.
    [key: string]: unknown;
}

export interface AuthoritativeOrderItem {
    _id:      string;
    name:     string;
    price:    number; // authoritative — sourced from Product.price
    quantity: number;
    image:    string;
}

export interface AuthoritativePricing {
    items:    AuthoritativeOrderItem[];
    subtotal: number;
}

export async function calculateAuthoritativePricing(
    rawItems: ClientCartItemInput[]
): Promise<AuthoritativePricing> {
    if (!Array.isArray(rawItems) || rawItems.length === 0) {
        throw Object.assign(new Error("Cart is empty"), { status: 400 });
    }

    for (const raw of rawItems) {
        if (typeof raw?._id !== "string" || !raw._id || !mongoose.Types.ObjectId.isValid(raw._id)) {
            throw Object.assign(new Error("Invalid item in cart"), { status: 400 });
        }
        if (typeof raw?.quantity !== "number" || !Number.isInteger(raw.quantity) || raw.quantity < 1) {
            throw Object.assign(new Error("Invalid item quantity"), { status: 400 });
        }
    }

    // One bulk fetch regardless of cart size / duplicate product IDs.
    const uniqueIds = [...new Set(rawItems.map((i) => i._id))].map(
        (id) => new mongoose.Types.ObjectId(id)
    );
    const products = await Product.find({ _id: { $in: uniqueIds } })
        .select("name price image isAvailable stock")
        .lean<Array<{ _id: mongoose.Types.ObjectId; name: string; price: number; image?: string; isAvailable?: boolean; stock?: number }>>();

    const productMap = new Map(products.map((p) => [String(p._id), p]));

    let subtotal = 0;
    const items: AuthoritativeOrderItem[] = rawItems.map((raw) => {
        const product = productMap.get(raw._id);

        if (!product) {
            console.error("PRICING_PRODUCT_NOT_FOUND", { productId: raw._id });
            throw Object.assign(
                new Error("One or more items in your cart are no longer available"),
                { status: 404 }
            );
        }
        if (product.isAvailable === false) {
            throw Object.assign(
                new Error(`"${product.name}" is currently unavailable`),
                { status: 400 }
            );
        }
        // PHASE 4: reject insufficient stock before a Razorpay order/COD
        // order is ever created — previously only createOrderCore's final
        // stock-decrement step caught this, which for Razorpay meant a
        // customer could pay before discovering the item was unfulfillable.
        if (typeof product.stock === "number" && product.stock < raw.quantity) {
            throw Object.assign(
                new Error(`"${product.name}" only has ${product.stock} left in stock`),
                { status: 400 }
            );
        }

        const price = product.price;
        subtotal += price * raw.quantity;

        return {
            _id:      raw._id,
            name:     product.name,
            price,
            quantity: raw.quantity,
            image:    product.image ?? "",
        };
    });

    return { items, subtotal };
}

// ── PHASE 4: CART VALIDATION (display/UX, not order creation) ───────────────
//
// Distinct responsibility from calculateAuthoritativePricing above: that
// function is fail-fast (throws on the first problem) because it feeds order
// creation, where "mostly valid" is not good enough. The cart page instead
// needs the status of EVERY item at once so it can show the customer exactly
// what's wrong and let them fix it — so this never throws for a bad item,
// it reports it. Both functions resolve price/stock/availability from the
// exact same Product fields; this is not a second pricing authority, just a
// different (non-throwing, all-items) shape over the same source of truth.

export type CartItemStatus =
    | "AVAILABLE"
    | "PRICE_CHANGED"
    | "OUT_OF_STOCK"
    | "INSUFFICIENT_STOCK"
    | "PRODUCT_UNAVAILABLE"
    | "INVALID_ITEM";

export interface CartValidationInput {
    _id:      string;
    quantity: number;
    /** Client's currently-displayed price, used ONLY to detect+report a change — never trusted financially. */
    price?: number;
}

export interface CartValidationItem {
    _id:               string;
    status:             CartItemStatus;
    requestedQuantity:  number;
    name?:              string;
    image?:             string;
    currentPrice?:      number;
    previousPrice?:     number;
    priceChanged?:      boolean;
    availableStock?:    number;
}

export interface CartValidationResult {
    items:   CartValidationItem[];
    isValid: boolean; // true only if every item can proceed to checkout as-is
}

const ORDERABLE_STATUSES: CartItemStatus[] = ["AVAILABLE", "PRICE_CHANGED"];

export async function validateCartItems(
    rawItems: CartValidationInput[]
): Promise<CartValidationResult> {
    if (!Array.isArray(rawItems) || rawItems.length === 0) {
        return { items: [], isValid: true };
    }

    const validRaw: CartValidationInput[] = [];
    const results: CartValidationItem[] = [];

    for (const raw of rawItems) {
        const quantityValid =
            typeof raw?.quantity === "number" && Number.isInteger(raw.quantity) && raw.quantity > 0;
        const idValid = typeof raw?._id === "string" && raw._id && mongoose.Types.ObjectId.isValid(raw._id);

        if (!idValid || !quantityValid) {
            results.push({
                _id:               typeof raw?._id === "string" ? raw._id : "",
                status:            "INVALID_ITEM",
                requestedQuantity: typeof raw?.quantity === "number" ? raw.quantity : 0,
            });
            continue;
        }
        validRaw.push(raw);
    }

    if (validRaw.length > 0) {
        const uniqueIds = [...new Set(validRaw.map((i) => i._id))].map(
            (id) => new mongoose.Types.ObjectId(id)
        );
        const products = await Product.find({ _id: { $in: uniqueIds } })
            .select("name price image isAvailable stock")
            .lean<Array<{ _id: mongoose.Types.ObjectId; name: string; price: number; image?: string; isAvailable?: boolean; stock?: number }>>();

        const productMap = new Map(products.map((p) => [String(p._id), p]));

        for (const raw of validRaw) {
            const product = productMap.get(raw._id);

            if (!product) {
                results.push({
                    _id:               raw._id,
                    status:            "PRODUCT_UNAVAILABLE",
                    requestedQuantity: raw.quantity,
                });
                continue;
            }

            const stock = typeof product.stock === "number" ? product.stock : 0;

            if (stock <= 0) {
                results.push({
                    _id:               raw._id,
                    status:            "OUT_OF_STOCK",
                    requestedQuantity: raw.quantity,
                    name:              product.name,
                    image:             product.image ?? "",
                    currentPrice:      product.price,
                    availableStock:    0,
                });
                continue;
            }

            if (product.isAvailable === false) {
                results.push({
                    _id:               raw._id,
                    status:            "PRODUCT_UNAVAILABLE",
                    requestedQuantity: raw.quantity,
                    name:              product.name,
                    image:             product.image ?? "",
                    currentPrice:      product.price,
                });
                continue;
            }

            if (stock < raw.quantity) {
                results.push({
                    _id:               raw._id,
                    status:            "INSUFFICIENT_STOCK",
                    requestedQuantity: raw.quantity,
                    name:              product.name,
                    image:             product.image ?? "",
                    currentPrice:      product.price,
                    availableStock:    stock,
                });
                continue;
            }

            const priceChanged =
                typeof raw.price === "number" && Math.abs(raw.price - product.price) > 0.009;

            results.push({
                _id:               raw._id,
                status:            priceChanged ? "PRICE_CHANGED" : "AVAILABLE",
                requestedQuantity: raw.quantity,
                name:              product.name,
                image:             product.image ?? "",
                currentPrice:      product.price,
                previousPrice:     priceChanged ? raw.price : undefined,
                priceChanged,
                availableStock:    stock,
            });
        }
    }

    // Preserve the caller's original item order in the response.
    const byId = new Map(results.map((r) => [r._id, r]));
    const ordered = rawItems
        .map((raw) => byId.get(typeof raw?._id === "string" ? raw._id : ""))
        .filter((r): r is CartValidationItem => !!r);

    return {
        items:   ordered,
        isValid: ordered.every((r) => ORDERABLE_STATUSES.includes(r.status)),
    };
}
