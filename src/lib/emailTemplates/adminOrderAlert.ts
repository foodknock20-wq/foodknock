// src/lib/emailTemplates/adminOrderAlert.ts
// Admin new-order alert — sent to ADMIN_EMAIL immediately after order
// creation. Information-dense, scan-friendly layout for internal
// operational use — every business-relevant field is surfaced.

import { renderEmailShell, escapeHtml, formatCurrency, formatDateTime, plainTextFooter, BRAND_COLOR } from "./shell";
import { formatDistance } from "@/lib/formatDistance";

export type AdminOrderAlertItem = {
    name:     string;
    quantity: number;
    price:    number;
};

export type AdminOrderAlertEmailData = {
    orderId:              string;
    customerName:         string;
    customerEmail?:       string;
    phone:                string;
    address:              string;
    landmark?:            string;
    note?:                string;
    orderType:            string;
    totalAmount:          number;
    deliveryFee:          number;
    platformFee:          number;
    redeemedPoints?:      number;
    redeemedAmount?:      number;
    paymentMethod:        string;
    items:                AdminOrderAlertItem[];
    createdAt:            Date;
    // Phase 10 — admin-facing only; never included in customer emails.
    distanceKm?:          number | null;
    mapsUrl?:             string | null;
    deliveryInstructions?: string;
    // Phase 11 — coupon, admin-facing only (never in customer emails).
    couponCode?:          string | null;
    couponDiscountAmount?: number;
};

function itemsRowsHtml(items: AdminOrderAlertItem[]): string {
    return items
        .map(
            (item) => `
        <tr>
          <td style="padding:6px 0;font-size:12.5px;color:#1c1917;border-bottom:1px solid #f5f5f4;">
            ${escapeHtml(item.name)} <span style="color:#a8a29e;">× ${item.quantity}</span>
          </td>
          <td align="right" style="padding:6px 0;font-size:12.5px;font-weight:700;color:#1c1917;border-bottom:1px solid #f5f5f4;white-space:nowrap;">
            ${formatCurrency(item.price * item.quantity)}
          </td>
        </tr>`
        )
        .join("");
}

function infoRow(label: string, value: string, opts?: { mono?: boolean; href?: string }): string {
    const inner = opts?.href
        ? `<a href="${opts.href}" style="color:#1c1917;text-decoration:none;">${value}</a>`
        : value;
    return `
      <tr>
        <td style="font-size:11.5px;color:#78716c;padding:4px 0;width:110px;vertical-align:top;">${escapeHtml(label)}</td>
        <td style="font-size:13px;font-weight:700;color:#1c1917;padding:4px 0;${opts?.mono ? "font-family:monospace;" : ""}">${inner}</td>
      </tr>`;
}

export function renderAdminOrderAlertEmailHtml(data: AdminOrderAlertEmailData): string {
    const paymentBadgeColor = data.paymentMethod === "cod" ? "#16a34a" : "#2563eb";
    const hasLoyalty = (data.redeemedPoints ?? 0) > 0;

    const bodyHtml = `
    <div style="display:inline-block;background-color:${paymentBadgeColor};color:#fff;font-size:11px;font-weight:800;padding:4px 10px;border-radius:6px;text-transform:uppercase;letter-spacing:0.04em;margin-bottom:14px;">
      ${escapeHtml(data.paymentMethod.toUpperCase())} · ${escapeHtml(data.orderType.toUpperCase())}
    </div>

    <h1 style="margin:0 0 4px;font-size:18px;font-weight:900;color:#1c1917;">
      🔥 New Order — ${escapeHtml(data.orderId)}
    </h1>
    <p style="margin:0 0 16px;font-size:11.5px;color:#a8a29e;">
      ${escapeHtml(formatDateTime(data.createdAt))}
    </p>

    <div style="font-size:11px;font-weight:800;color:#78716c;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:6px;">
      Customer
    </div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:14px;">
      ${infoRow("Name", escapeHtml(data.customerName))}
      ${infoRow("Phone", escapeHtml(data.phone), { href: `tel:${data.phone}` })}
      ${data.customerEmail ? infoRow("Email", escapeHtml(data.customerEmail), { href: `mailto:${data.customerEmail}` }) : ""}
      ${infoRow("Address", escapeHtml(data.address || "—"))}
      ${data.landmark ? infoRow("Landmark", escapeHtml(data.landmark)) : ""}
      ${data.note ? infoRow("Note", escapeHtml(data.note)) : ""}
      ${data.deliveryInstructions ? infoRow("Delivery Instructions", escapeHtml(data.deliveryInstructions)) : ""}
      ${typeof data.distanceKm === "number" ? infoRow("Distance from kitchen", formatDistance(data.distanceKm)) : ""}
      ${data.couponCode ? infoRow("Coupon", `${escapeHtml(data.couponCode)} (-${formatCurrency(data.couponDiscountAmount ?? 0)})`) : ""}
      ${data.mapsUrl ? infoRow("Navigate", "Open in Google Maps (to customer)", { href: escapeHtml(data.mapsUrl) }) : ""}
    </table>

    <div style="font-size:11px;font-weight:800;color:#78716c;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:6px;">
      Items
    </div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:14px;">
      ${itemsRowsHtml(data.items)}
    </table>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:16px;">
      <tr>
        <td style="padding:3px 0;font-size:12px;color:#78716c;">Delivery Fee</td>
        <td align="right" style="padding:3px 0;font-size:12px;color:#44403c;">${formatCurrency(data.deliveryFee)}</td>
      </tr>
      <tr>
        <td style="padding:3px 0;font-size:12px;color:#78716c;">Platform Fee</td>
        <td align="right" style="padding:3px 0;font-size:12px;color:#44403c;">${formatCurrency(data.platformFee)}</td>
      </tr>
      ${hasLoyalty ? `
      <tr>
        <td style="padding:3px 0;font-size:12px;color:#78716c;">Loyalty Points Redeemed</td>
        <td align="right" style="padding:3px 0;font-size:12px;color:#44403c;">${data.redeemedPoints} pts</td>
      </tr>
      <tr>
        <td style="padding:3px 0;font-size:12px;color:#78716c;">Loyalty Discount Applied</td>
        <td align="right" style="padding:3px 0;font-size:12px;color:#dc2626;">− ${formatCurrency(data.redeemedAmount ?? 0)}</td>
      </tr>` : ""}
    </table>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#fff7ed;border:1px solid #fde7d0;border-radius:10px;">
      <tr>
        <td style="padding:12px 16px;font-size:13px;font-weight:800;color:#1c1917;">Total Charged</td>
        <td align="right" style="padding:12px 16px;font-size:17px;font-weight:900;color:${BRAND_COLOR};">${formatCurrency(data.totalAmount)}</td>
      </tr>
    </table>
  `;

    return renderEmailShell({
        previewText: `New order ${data.orderId} from ${data.customerName} — ${formatCurrency(data.totalAmount)}`,
        bodyHtml,
    });
}

export function renderAdminOrderAlertEmailText(data: AdminOrderAlertEmailData): string {
    const itemLines = data.items
        .map((i) => `  - ${i.name} x${i.quantity} — ${formatCurrency(i.price * i.quantity)}`)
        .join("\n");

    const loyaltyLines = (data.redeemedPoints ?? 0) > 0
        ? `Loyalty Points Redeemed: ${data.redeemedPoints} pts\nLoyalty Discount Applied: -${formatCurrency(data.redeemedAmount ?? 0)}\n`
        : "";

    return (
        `New Order — ${data.orderId}\n` +
        `Placed: ${formatDateTime(data.createdAt)}\n\n` +
        `Customer: ${data.customerName}\n` +
        `Phone: ${data.phone}\n` +
        (data.customerEmail ? `Email: ${data.customerEmail}\n` : "") +
        `Address: ${data.address || "—"}\n` +
        (data.landmark ? `Landmark: ${data.landmark}\n` : "") +
        (data.note ? `Note: ${data.note}\n` : "") +
        (data.deliveryInstructions ? `Delivery Instructions: ${data.deliveryInstructions}\n` : "") +
        (typeof data.distanceKm === "number" ? `Distance from kitchen: ${formatDistance(data.distanceKm)}\n` : "") +
        (data.mapsUrl ? `Navigate: ${data.mapsUrl}\n` : "") +
        (data.couponCode ? `Coupon: ${data.couponCode} (-${formatCurrency(data.couponDiscountAmount ?? 0)})\n` : "") +
        `Type: ${data.orderType.toUpperCase()}\n` +
        `Payment: ${data.paymentMethod.toUpperCase()}\n\n` +
        `Items:\n${itemLines}\n\n` +
        `Delivery Fee: ${formatCurrency(data.deliveryFee)}\n` +
        `Platform Fee: ${formatCurrency(data.platformFee)}\n` +
        loyaltyLines +
        `Total Charged: ${formatCurrency(data.totalAmount)}` +
        plainTextFooter()
    );
}