// src/lib/mailer.ts
// Provider-agnostic SMTP mailer for the Forgot Password module.
//
// Deliberately built only against generic SMTP credentials — SMTP_HOST,
// SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM — with NO provider-specific
// code path (no Gmail-only logic, no vendor SDKs). This means switching
// from Gmail SMTP to Resend, SendGrid, Mailgun, Zoho, Brevo, etc. later is
// purely an environment-variable change; this file never needs to be
// touched again for a provider swap, since every transactional provider
// exposes a standard SMTP endpoint.
//
// Vercel-friendly: nodemailer's SMTP transport is a stateless per-invocation
// connection (no persistent workers, no queues, no background processing) —
// safe to call directly from a serverless route handler.

import nodemailer, { type Transporter } from "nodemailer";
import {
    renderWelcomeEmailHtml,
    renderWelcomeEmailText,
    type WelcomeEmailData,
} from "./emailTemplates/welcome";
import {
    renderOrderConfirmationEmailHtml,
    renderOrderConfirmationEmailText,
    type OrderConfirmationEmailData,
} from "./emailTemplates/orderConfirmation";
import {
    renderAdminOrderAlertEmailHtml,
    renderAdminOrderAlertEmailText,
    type AdminOrderAlertEmailData,
} from "./emailTemplates/adminOrderAlert";
import {
    renderAdminOrderCancelledAlertEmailHtml,
    renderAdminOrderCancelledAlertEmailText,
    type AdminOrderCancelledAlertEmailData,
} from "./emailTemplates/adminOrderCancelledAlert";
import {
    renderOrderDeliveredEmailHtml,
    renderOrderDeliveredEmailText,
    type OrderDeliveredEmailData,
} from "./emailTemplates/orderDelivered";

// ── Lazy-initialized singleton transporter ──────────────────────────────
// Reused across invocations on warm serverless instances (mirrors the
// connection-caching pattern already used in src/lib/db.ts), but cheap to
// recreate on a cold start since it's just a config object, not a live
// connection — nodemailer connects lazily on first send.
let cachedTransporter: Transporter | null = null;

function getTransporter(): Transporter {
    if (cachedTransporter) return cachedTransporter;

    const host = process.env.SMTP_HOST;
    const port = process.env.SMTP_PORT;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;

    if (!host || !port || !user || !pass) {
        throw new Error(
            "MAILER_CONFIG_ERROR: SMTP_HOST, SMTP_PORT, SMTP_USER, and SMTP_PASS must all be set."
        );
    }

    const portNum = Number(port);

    cachedTransporter = nodemailer.createTransport({
        host,
        port: portNum,
        // Port 465 is implicit TLS; everything else (587, 25, custom ports
        // used by providers like Mailgun/Brevo) uses STARTTLS, which
        // nodemailer negotiates automatically when secure is false.
        secure: portNum === 465,
        auth: { user, pass },
    });

    return cachedTransporter;
}

// ── Sender identity ──────────────────────────────────────────────────────
function getFromAddress(): string {
    const from = process.env.SMTP_FROM;
    if (!from) {
        throw new Error("MAILER_CONFIG_ERROR: SMTP_FROM must be set.");
    }
    return from;
}

// ── OTP email ─────────────────────────────────────────────────────────────
type SendOtpEmailParams = {
    to:   string;
    name: string;
    otp:  string;
};

/**
 * Sends the password-reset OTP email. Throws on transport failure — callers
 * (forgot-password route) decide how to handle/log that without ever
 * leaking delivery failure details back to the client (anti-enumeration).
 */
export async function sendOtpEmail({ to, name, otp }: SendOtpEmailParams): Promise<void> {
    const transporter = getTransporter();
    const from = getFromAddress();

    const subject = "Your FoodKnock password reset code";

    const text =
        `Hi ${name || "there"},\n\n` +
        `Your FoodKnock password reset code is: ${otp}\n\n` +
        `This code expires in 10 minutes. If you didn't request this, you can safely ignore this email.\n\n` +
        `— FoodKnock`;

    const html = `
        <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#1c1917;">
            <p style="font-size:15px;">Hi ${escapeHtml(name || "there")},</p>
            <p style="font-size:15px;">Your FoodKnock password reset code is:</p>
            <p style="font-size:28px;font-weight:700;letter-spacing:4px;color:#ea580c;margin:16px 0;">
                ${escapeHtml(otp)}
            </p>
            <p style="font-size:13px;color:#78716c;">This code expires in 10 minutes. If you didn't request this, you can safely ignore this email.</p>
            <p style="font-size:13px;color:#78716c;margin-top:24px;">— FoodKnock</p>
        </div>
    `.trim();

    await transporter.sendMail({ from, to, subject, text, html });
}

// ── Signup verification email ────────────────────────────────────────────
type SendSignupOtpEmailParams = {
    to:   string;
    name: string;
    otp:  string;
};

/**
 * Sends the signup email-verification OTP. Reuses the same transporter and
 * sender identity as sendOtpEmail, with copy specific to account creation
 * rather than password reset. Throws on transport failure — callers
 * (register / resend-signup-otp routes) decide how to surface that.
 */
export async function sendSignupOtpEmail({ to, name, otp }: SendSignupOtpEmailParams): Promise<void> {
    const transporter = getTransporter();
    const from = getFromAddress();

    const subject = "Verify your email for FoodKnock";

    const text =
        `Hi ${name || "there"},\n\n` +
        `Welcome to FoodKnock! Your email verification code is: ${otp}\n\n` +
        `This code expires in 10 minutes. If you didn't request this, you can safely ignore this email.\n\n` +
        `— FoodKnock`;

    const html = `
        <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#1c1917;">
            <p style="font-size:15px;">Hi ${escapeHtml(name || "there")},</p>
            <p style="font-size:15px;">Welcome to FoodKnock! Your email verification code is:</p>
            <p style="font-size:28px;font-weight:700;letter-spacing:4px;color:#ea580c;margin:16px 0;">
                ${escapeHtml(otp)}
            </p>
            <p style="font-size:13px;color:#78716c;">This code expires in 10 minutes. If you didn't request this, you can safely ignore this email.</p>
            <p style="font-size:13px;color:#78716c;margin-top:24px;">— FoodKnock</p>
        </div>
    `.trim();

    await transporter.sendMail({ from, to, subject, text, html });
}

// ── Minimal HTML escaping for interpolated values ───────────────────────
function escapeHtml(value: string): string {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

// ═══════════════════════════════════════════════════════════════════════
// Transactional emails — Welcome, Order Confirmation, Admin Alert,
// Order Delivered. All reuse getTransporter()/getFromAddress() above —
// no new transporter is ever created, and switching SMTP providers later
// remains a pure environment-variable change with zero code touched here.
// ═══════════════════════════════════════════════════════════════════════

/**
 * Sends the welcome email after successful signup verification + account
 * creation. Throws on transport failure — callers must treat this as
 * non-fatal (fire-and-forget with logging), since a welcome email failing
 * to send must never block or roll back account creation.
 */
export async function sendWelcomeEmail(to: string, data: WelcomeEmailData): Promise<void> {
    const transporter = getTransporter();
    const from = getFromAddress();

    await transporter.sendMail({
        from,
        to,
        subject: `Welcome to FoodKnock, ${data.name?.trim()?.split(/\s+/)[0] || "there"}! 🎉`,
        text: renderWelcomeEmailText(data),
        html: renderWelcomeEmailHtml(data),
    });
}

/**
 * Sends the order confirmation email to the customer immediately after
 * order creation (COD or Razorpay — identical template either way, the
 * paymentMethod field is just displayed). Non-fatal — callers must treat
 * failures as fire-and-forget, never blocking the order response.
 */
export async function sendOrderConfirmationEmail(to: string, data: OrderConfirmationEmailData): Promise<void> {
    const transporter = getTransporter();
    const from = getFromAddress();

    await transporter.sendMail({
        from,
        to,
        subject: `Order Confirmed — ${data.orderId} | FoodKnock`,
        text: renderOrderConfirmationEmailText(data),
        html: renderOrderConfirmationEmailHtml(data),
    });
}

/**
 * Sends the new-order alert to the admin inbox (ADMIN_EMAIL env var).
 * Silently no-ops if ADMIN_EMAIL isn't configured, rather than throwing —
 * this is an internal operational notification, not a customer-facing
 * email, so a missing config shouldn't surface as a hard error to callers
 * that are already treating this as fire-and-forget.
 */
export async function sendAdminOrderAlertEmail(data: AdminOrderAlertEmailData): Promise<void> {
    const adminEmail = process.env.ADMIN_EMAIL;
    if (!adminEmail) {
        console.warn("ADMIN_ORDER_ALERT_SKIPPED: ADMIN_EMAIL is not configured.");
        return;
    }

    const transporter = getTransporter();
    const from = getFromAddress();

    await transporter.sendMail({
        from,
        to: adminEmail,
        subject: `🔥 New Order ${data.orderId} — ${data.paymentMethod.toUpperCase()}`,
        text: renderAdminOrderAlertEmailText(data),
        html: renderAdminOrderAlertEmailHtml(data),
    });
}

/**
 * Phase 14 — sends the cancellation alert to the admin inbox (ADMIN_EMAIL
 * env var) when a CUSTOMER cancels an order. Mirrors
 * sendAdminOrderAlertEmail's exact pattern: silently no-ops if ADMIN_EMAIL
 * isn't configured rather than throwing, since this is an internal
 * operational notification, not a customer-facing email.
 */
export async function sendAdminOrderCancelledAlertEmail(data: AdminOrderCancelledAlertEmailData): Promise<void> {
    const adminEmail = process.env.ADMIN_EMAIL;
    if (!adminEmail) {
        console.warn("ADMIN_ORDER_CANCELLED_ALERT_SKIPPED: ADMIN_EMAIL is not configured.");
        return;
    }

    const transporter = getTransporter();
    const from = getFromAddress();

    await transporter.sendMail({
        from,
        to: adminEmail,
        subject: `🚫 Order Cancelled ${data.orderId} — by ${data.cancelledByType}`,
        text: renderAdminOrderCancelledAlertEmailText(data),
        html: renderAdminOrderCancelledAlertEmailHtml(data),
    });
}

/**
 * Sends the order-delivered thank-you email when an order's status
 * transitions to "delivered". Non-fatal — callers must treat failures as
 * fire-and-forget, never rolling back the status change.
 */
export async function sendOrderDeliveredEmail(to: string, data: OrderDeliveredEmailData): Promise<void> {
    const transporter = getTransporter();
    const from = getFromAddress();

    await transporter.sendMail({
        from,
        to,
        subject: `Delivered! Enjoy your meal 🎉 — ${data.orderId}`,
        text: renderOrderDeliveredEmailText(data),
        html: renderOrderDeliveredEmailHtml(data),
    });
}