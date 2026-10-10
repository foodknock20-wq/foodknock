// src/lib/emailTemplates/adminOrderCancelledAlert.ts
// Admin cancellation alert — sent to ADMIN_EMAIL when a CUSTOMER cancels an
// order (see src/lib/orderCancellation.ts). Mirrors adminOrderAlert.ts's
// structure exactly — same shared shell/helpers, same information-dense
// layout — for the cancellation event instead of the new-order event.

import { renderEmailShell, escapeHtml, formatCurrency, formatDateTime, plainTextFooter, BRAND_COLOR } from "./shell";

export type AdminOrderCancelledAlertEmailData = {
    orderId:         string;
    customerName:    string;
    totalAmount:     number;
    paymentMethod:   string;
    address:         string;
    landmark?:       string;
    orderType:       string;
    reason:          string;
    note?:           string;
    cancelledByType: string;
    cancelledAt:     Date;
    refundStatus:    "not_applicable" | "pending_manual" | "completed";
    mapsUrl?:        string | null;
};

function infoRow(label: string, value: string, opts?: { href?: string }): string {
    const inner = opts?.href
        ? `<a href="${opts.href}" style="color:#1c1917;text-decoration:none;">${value}</a>`
        : value;
    return `
      <tr>
        <td style="font-size:11.5px;color:#78716c;padding:4px 0;width:120px;vertical-align:top;">${escapeHtml(label)}</td>
        <td style="font-size:13px;font-weight:700;color:#1c1917;padding:4px 0;">${inner}</td>
      </tr>`;
}

function refundLabel(status: AdminOrderCancelledAlertEmailData["refundStatus"]): { text: string; color: string } {
    if (status === "pending_manual") return { text: "PENDING — process manually via Razorpay dashboard", color: "#b45309" };
    if (status === "completed") return { text: "Completed", color: "#16a34a" };
    return { text: "Not required (COD)", color: "#78716c" };
}

export function renderAdminOrderCancelledAlertEmailHtml(data: AdminOrderCancelledAlertEmailData): string {
    const refund = refundLabel(data.refundStatus);

    const bodyHtml = `
    <div style="display:inline-block;background-color:#dc2626;color:#fff;font-size:11px;font-weight:800;padding:4px 10px;border-radius:6px;text-transform:uppercase;letter-spacing:0.04em;margin-bottom:14px;">
      CANCELLED BY ${escapeHtml(data.cancelledByType.toUpperCase())}
    </div>

    <h1 style="margin:0 0 4px;font-size:18px;font-weight:900;color:#1c1917;">
      🚫 Order Cancelled — ${escapeHtml(data.orderId)}
    </h1>
    <p style="margin:0 0 16px;font-size:11.5px;color:#a8a29e;">
      ${escapeHtml(formatDateTime(data.cancelledAt))}
    </p>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:14px;">
      ${infoRow("Customer", escapeHtml(data.customerName))}
      ${infoRow("Address", escapeHtml(data.address || "—"))}
      ${data.landmark ? infoRow("Landmark", escapeHtml(data.landmark)) : ""}
      ${infoRow("Payment", escapeHtml(data.paymentMethod.toUpperCase()))}
      ${infoRow("Reason", escapeHtml(data.reason))}
      ${data.note ? infoRow("Note", escapeHtml(data.note)) : ""}
      ${data.mapsUrl ? infoRow("Navigate", "Open in Google Maps", { href: escapeHtml(data.mapsUrl) }) : ""}
    </table>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#fef2f2;border:1px solid #fecaca;border-radius:10px;margin-bottom:14px;">
      <tr>
        <td style="padding:12px 16px;font-size:13px;font-weight:800;color:#1c1917;">Order Total</td>
        <td align="right" style="padding:12px 16px;font-size:17px;font-weight:900;color:${BRAND_COLOR};">${formatCurrency(data.totalAmount)}</td>
      </tr>
    </table>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td style="padding:3px 0;font-size:12px;color:#78716c;">Refund</td>
        <td align="right" style="padding:3px 0;font-size:12px;font-weight:700;color:${refund.color};">${refund.text}</td>
      </tr>
    </table>
  `;

    return renderEmailShell({
        previewText: `Order ${data.orderId} cancelled by ${data.cancelledByType} — ${formatCurrency(data.totalAmount)}`,
        bodyHtml,
    });
}

export function renderAdminOrderCancelledAlertEmailText(data: AdminOrderCancelledAlertEmailData): string {
    const refund = refundLabel(data.refundStatus);

    return (
        `Order Cancelled — ${data.orderId}\n` +
        `Cancelled by: ${data.cancelledByType}\n` +
        `At: ${formatDateTime(data.cancelledAt)}\n\n` +
        `Customer: ${data.customerName}\n` +
        `Address: ${data.address || "—"}\n` +
        (data.landmark ? `Landmark: ${data.landmark}\n` : "") +
        `Payment: ${data.paymentMethod.toUpperCase()}\n` +
        `Reason: ${data.reason}\n` +
        (data.note ? `Note: ${data.note}\n` : "") +
        (data.mapsUrl ? `Navigate: ${data.mapsUrl}\n` : "") +
        `\nOrder Total: ${formatCurrency(data.totalAmount)}\n` +
        `Refund: ${refund.text}` +
        plainTextFooter()
    );
}
