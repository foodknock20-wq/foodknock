import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

// Merge Tailwind class strings safely (later classes win on conflicting
// utilities) — the standard clsx + tailwind-merge combo, used by every
// component in src/components/ui and src/components/shell.
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Phase 17.6 (guest-tracking privacy follow-up): the suffix used to be a
// 4-digit number (1,000–9,999 possibilities). A per-IP rate limit already
// exists at the lookup route as a second layer (see
// src/app/api/orders/track/[orderId]/route.ts), but shrinking the space an
// attacker has to search is a strictly additive, zero-risk improvement: it
// changes nothing about the ID's shape (`ORD-{timestamp}-{suffix}`),
// nothing about how existing orderId values already stored on real orders
// are looked up, and nothing about any API response shape — only new
// orders get a longer, harder suffix. 8 base36 characters (0-9, A-Z) is
// ~36^8 ≈ 2.8 trillion combinations, versus 9,000 before.
//
// Phase 17.7: upgraded from Math.random() (not cryptographically secure)
// to the Web Crypto API's getRandomValues(). This file is imported by
// client components (cn() is used throughout src/components/ui and
// src/components/shell), so Node's `crypto` module is deliberately NOT
// imported here — that would risk a client-bundle failure, since Node
// built-ins aren't available in the browser. `globalThis.crypto` is the
// right choice instead: it's the standard Web Crypto API, available
// natively in every browser AND in Node's own server runtime (global,
// no import, since Node 19) — the exact same object, same
// getRandomValues() method, in both environments this file runs in.
function randomOrderSuffix(length: number): string {
  const ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const bytes = new Uint8Array(length);
  globalThis.crypto.getRandomValues(bytes);
  let s = "";
  for (let i = 0; i < length; i++) s += ALPHABET[bytes[i] % ALPHABET.length];
  return s;
}

// Generate unique order ID
export function generateOrderId(): string {
  const timestamp = Date.now();
  const random = randomOrderSuffix(8);

  return `ORD-${timestamp}-${random}`;
}

// Format currency in INR
export function formatCurrency(amount: number): string {
  return `₹${amount.toFixed(2)}`;
}

// Create WhatsApp message link
export function createWhatsAppLink(message: string): string {
  const phone = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER;

  if (!phone) {
    console.error("WhatsApp number not defined in env");
    return "#";
  }

  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}

// Generate slug from text
export function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-");
}

// Simple date formatter
export function formatDate(date: Date | string): string {
  const d = new Date(date);
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}