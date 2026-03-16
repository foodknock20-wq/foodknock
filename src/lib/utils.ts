// Generate unique order ID
export function generateOrderId(): string {
  const timestamp = Date.now();
  const random = Math.floor(1000 + Math.random() * 9000);

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