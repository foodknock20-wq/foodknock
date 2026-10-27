// INCIDENT (Vercel Fluid Active CPU): pure static content page — no
// per-request/server data is read here (compile-time-constant SECTIONS +
// metadata). The previous `force-dynamic` turned every visit, including every
// crawler/bot hit, into a serverless function invocation + SSR, burning Active
// CPU for zero freshness benefit. `force-static` prerenders it once at build
// and serves it from the CDN with no function invocation. Do NOT re-add
// force-dynamic unless this page starts reading genuine per-request data.
export const dynamic = "force-static";

// src/app/(main)/privacy/page.tsx
// Premium branded Privacy Policy — FoodKnock
// Light warm food-brand visual language. Clear, honest, not corporate.

import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
    title: "Privacy Policy — FoodKnock",
    description: "How FoodKnock collects, uses, and protects your data. Clear, honest, no fine-print surprises.",
    alternates: { canonical: "https://www.foodknock.com/privacy" },
};
import Footer from "@/components/shared/Footer";
import {
    Lock, ShieldCheck, Eye, Server, Cookie,
    Link2, Mail, Settings, RefreshCw, HelpCircle,
    Package, Smartphone, CreditCard, MapPin, Bell,
} from "lucide-react";

const CONTACT_EMAIL = "foodknock20@gmail.com";
const LAST_UPDATED  = "October 2026";

const SECTIONS = [
    {
        id:    "introduction",
        emoji: "👋",
        icon:  HelpCircle,
        title: "Introduction",
        body:  `FoodKnock ("we", "us") respects your privacy. This Privacy Policy explains what information we collect, how we use it, and your rights around that data.\n\nWe are a local food delivery platform based in Danta, Sikar, Rajasthan. We collect only what we need to serve you well — nothing more. We never sell your data to anyone, ever.`,
    },
    {
        id:    "information-we-collect",
        emoji: "📋",
        icon:  Eye,
        title: "Information We Collect",
        body:  `Information you give us directly:\n\n• Account details when you register: your name, email address and phone number (both required), and a password (stored only in securely hashed form). You can optionally add a date of birth.\n• Delivery details: one or more saved delivery addresses (flat/house, locality, city, state, pincode, landmark) and any delivery instructions you add.\n• Order information: the items you order, order totals, order status and timestamps, and any note you attach to an order.\n• Reviews and feedback you voluntarily submit.\n• Messages you send us for customer support.\n\nInformation generated or collected automatically:\n\n• Precise delivery location (GPS latitude/longitude) only when you choose to share it or drop a map pin at checkout — see "Location & Delivery" below.\n• Push-notification subscription details (a device/browser push token) if you enable notifications — see "Notifications" below.\n• Basic, aggregate website usage data (such as which pages are visited) through our analytics tool — see "Cookies & Analytics" below.\n• Loyalty points, referral code and promotion-eligibility state tied to your account.\n\nWe do not collect or store your payment card, UPI or bank details on our servers — those are handled directly by our payment gateway (see "Online Payments"). We do not require government IDs.`,
    },
    {
        id:    "how-we-use",
        emoji: "🔧",
        icon:  Settings,
        title: "How We Use Your Information",
        body:  `We use the information above to:\n\n• Create and manage your account and sign you in securely.\n• Process and fulfil your food orders and coordinate delivery to your address.\n• Send you order confirmations and updates, delivery notifications, and one-time codes for signup and password reset (by email, push and/or WhatsApp — see "Notifications").\n• Reconcile payments and process refunds.\n• Respond to your support queries, complaints and privacy requests.\n• Keep accounts secure and prevent fraud and abuse — including login-protection, verifying account ownership before deletion, and preventing repeated misuse of our first-order promotion.\n• Run loyalty, referral and promotional features you take part in.\n• Understand aggregate usage so we can improve our menu and service.\n\nWe do not sell your data, and we do not use it for advertising networks, data brokers, or third-party marketing.`,
    },
    {
        id:    "order-contact",
        emoji: "📦",
        icon:  Package,
        title: "Order & Account Information",
        body:  `When you place an order, your name, email address, and delivery address are used to fulfill your order and coordinate delivery. This information may be shared with our delivery team solely to complete your delivery.\n\nOrder records are retained for a reasonable period for customer service purposes. Your account information is stored securely and used only to personalise your experience and process orders.`,
    },
    {
        id:    "payments",
        emoji: "💳",
        icon:  CreditCard,
        title: "Online Payments",
        body:  `FoodKnock processes online payments through Razorpay, our payment gateway. We do not collect or store your card, UPI or bank details on our servers — that information is entered directly with Razorpay and handled under their security standards and privacy policy. All transactions are encrypted in transit.\n\nWe receive only what we need to fulfil your order: a transaction/payment reference and confirmation status, never your full payment credentials. These payment references are kept with the order record for reconciliation and refunds.`,
    },
    {
        id:    "location",
        emoji: "📍",
        icon:  MapPin,
        title: "Location & Delivery",
        body:  `There are two separate things here, and we treat them differently:\n\n• Delivery address you enter: the address you type or save is ordinary account data, used to deliver your order.\n\n• Precise device location (GPS): we access your device's current location only when you actively tap "use my current location" or move the pin on the map at checkout. We do not track your location in the background and we do not collect it continuously. Your browser always asks for permission first, and you can decline and type your address instead.\n\nWhen you share a precise location, the latitude/longitude is used to check delivery serviceability, pre-fill your address and attach delivery coordinates to that order so it can be delivered. To turn coordinates into a readable address and to show the map, we send the coordinates to OpenStreetMap (Nominatim geocoding and map tiles). Delivery coordinates stored on an order are scrubbed when you delete your account.`,
    },
    {
        id:    "notifications",
        emoji: "🔔",
        icon:  Bell,
        title: "Notifications",
        body:  `With your agreement we send you order updates, delivery alerts, one-time verification codes and occasional offers through:\n\n• Email — delivered via our email (SMTP) provider.\n• WhatsApp — for things like signup verification codes and "order delivered" messages, sent through the WhatsApp Business Cloud API (operated by Meta). This uses the phone number on your account.\n• Web/app push — if you enable it, we store a push subscription (a device/browser token) and deliver messages through Firebase Cloud Messaging (operated by Google) and standard web-push services.\n\nYou can manage notification categories in your account settings, turn off browser/device push at any time, and ask us to stop promotional messages. Your push subscription is deleted when you delete your account.`,
    },
    {
        id:    "account-management",
        emoji: "⚙️",
        icon:  Smartphone,
        title: "Account Deletion & Password Reset",
        body:  `You have full control over your account:\n\n• Forgot your password? Use the "Forgot password?" option on the sign-in screen to receive a one-time code by email and set a new password.\n\n• Want to delete your account? You can do it yourself, immediately, from within the app: go to Account → Delete Account, re-enter your password, and confirm on the final step. Your profile is removed and you are signed out right away. You can also start from our public page at /delete-account.\n\nWhen you delete your account we immediately remove your profile (name, phone, date of birth and other profile details), saved addresses, notification preferences, push subscriptions, spin/game records and personalised marketing state. Past orders and payment records are kept in anonymized form (your name, phone and address are scrubbed) where we need them for legal, accounting and fraud-prevention reasons — see "Data Storage & Retention" below. Deleting your account does not by itself cancel an active order or trigger a refund; contact us first if you have one in progress.\n\nIf you can't sign in, email us at ${CONTACT_EMAIL} from your account's email address so we can verify it's you before deleting anything. We never action an unverified deletion request.`,
    },
    {
        id:    "promotion-data",
        emoji: "🎟️",
        icon:  ShieldCheck,
        title: "First-Order Promotion Record",
        body:  `To stop our first-order free-delivery offer from being claimed repeatedly by deleting and recreating an account, we keep a minimal record when that benefit has been used. It stores a one-way keyed code derived from your verified email (never your raw email) together with the fact that the benefit was used. This record is kept even after account deletion.\n\nThis code is pseudonymous, not anonymous: because we hold the key, it is still treated as personal data. It is used only to prevent promotion abuse, is never shown to staff or shared with anyone, and is kept separate from our financial records.`,
    },
    {
        id:    "cookies",
        emoji: "🍪",
        icon:  Cookie,
        title: "Cookies & Analytics",
        body:  `Our website uses essential cookies to keep you logged in and remember your preferences. Without these, features like staying signed in will not work; you can still disable cookies in your browser settings.\n\nFor usage insights we use Vercel Web Analytics, which is cookie-less and measures aggregate traffic (such as which pages are visited and general device/browser type). It is designed not to track individual visitors across sites and is not tied to your name or account. We do not use advertising or cross-site tracking pixels.`,
    },
    {
        id:    "data-sharing",
        emoji: "🔗",
        icon:  Link2,
        title: "Data Sharing & Third Parties",
        body:  `We do not sell, rent, or trade your personal data. We share the minimum necessary information with the service providers that run FoodKnock:\n\n• Our delivery team — your name, address, phone and delivery coordinates, solely to complete your delivery.\n• Razorpay — to process your online payment securely (see "Online Payments").\n• Vercel — our hosting platform and the provider of our cookie-less web analytics.\n• Our cloud-hosted MongoDB database provider, where account and order data is stored.\n• WhatsApp Business Cloud API (Meta) — your phone number and message content, to send verification codes and order updates.\n• Our email (SMTP) provider — your email address and message content, to send emails such as order and password-reset messages.\n• Firebase Cloud Messaging (Google) and standard web-push services — your push token, to deliver notifications you enabled.\n• OpenStreetMap — latitude/longitude you share, to convert it into an address and show the map.\n\nWe share this information with each provider only for the specific purpose described above, and never with advertisers, data brokers, or marketing platforms.`,
    },
    {
        id:    "data-security",
        emoji: "🔒",
        icon:  Lock,
        title: "Data Security",
        body:  `We take reasonable steps to protect your personal information from unauthorized access, misuse, or disclosure. Our website uses HTTPS encryption for all data in transit.\n\nHowever, no internet transmission or digital storage is 100% secure. While we do our best, we cannot guarantee absolute security of data transmitted over the internet. Please do not share sensitive personal information beyond what is needed for your order.`,
    },
    {
        id:    "your-choices",
        emoji: "✅",
        icon:  ShieldCheck,
        title: "Your Rights",
        body:  `You have the right to:\n\n• Request access to the personal information we hold about you\n• Request correction of inaccurate information\n• Request deletion of your account and data (see Account Management section above)\n• Opt out of any promotional communications from us\n\nTo exercise any of these rights, email us at ${CONTACT_EMAIL}. We will respond within a reasonable time frame.`,
    },
    {
        id:    "data-storage",
        emoji: "🖥️",
        icon:  Server,
        title: "Data Storage & Retention",
        body:  `Your data is stored on secure cloud-hosted databases. We retain personal data only for as long as necessary to provide our services or as required by law.\n\nWhen you delete your account, your profile and personal details are removed from our active systems immediately. Order and payment records are retained in anonymized form for legitimate legal, accounting and fraud-prevention purposes, and a minimal pseudonymous promotion record is kept to prevent repeat-offer abuse (see the sections above). Copies of data may persist for a limited time in routine encrypted backups before being overwritten in the normal backup rotation.`,
    },
    {
        id:    "changes",
        emoji: "🔄",
        icon:  RefreshCw,
        title: "Changes to This Policy",
        body:  `We may update this Privacy Policy from time to time as our services or legal requirements change. When we do, we will update the "Last Updated" date at the top of this page.\n\nYour continued use of our website after any changes to this policy means you accept those changes. We encourage you to review this policy periodically.`,
    },
    {
        id:    "contact",
        emoji: "✉️",
        icon:  Mail,
        title: "Contact Us",
        body:  `For any privacy-related questions, data requests, or concerns, please contact us:\n\nFoodKnock\nPhone : +91 8764821399\nEmail: ${CONTACT_EMAIL}\n\nWe genuinely care about your trust. We will always respond with honesty and transparency.`,
    },
];

export default function PrivacyPage() {
    return (
        <>

            <main className="relative min-h-screen overflow-x-hidden bg-[#FFFBF5]">

                {/* ── Glow orbs ── */}
                <div className="pointer-events-none absolute -left-32 top-0 h-[400px] w-[400px] rounded-full opacity-20 blur-3xl" style={{ background: "radial-gradient(ellipse, #fed7aa, transparent 70%)" }} aria-hidden="true" />
                <div className="pointer-events-none absolute -right-32 bottom-0 h-[350px] w-[350px] rounded-full opacity-15 blur-3xl" style={{ background: "radial-gradient(ellipse, #fde68a, transparent 70%)" }} aria-hidden="true" />

                {/* ── Hero header ── */}
                <div className="relative overflow-hidden border-b border-amber-100/80 bg-white">
                    <div className="pointer-events-none absolute -top-20 left-1/2 h-56 w-3/4 -translate-x-1/2 rounded-full opacity-50 blur-3xl" style={{ background: "radial-gradient(ellipse, #fed7aa, transparent 70%)" }} aria-hidden="true" />
                    <div className="pointer-events-none absolute right-0 top-0 h-40 w-40 rounded-full opacity-20 blur-2xl" style={{ background: "radial-gradient(ellipse, #fb923c, transparent 70%)" }} aria-hidden="true" />

                    <div className="relative mx-auto max-w-4xl px-4 pb-12 pt-12 md:px-8 md:pb-16 md:pt-18">
                        {/* Badge */}
                        <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-4 py-2 shadow-sm">
                            <Lock size={12} className="text-amber-600" strokeWidth={2.5} />
                            <span className="text-[10.5px] font-black uppercase tracking-[0.25em] text-amber-700">Privacy Policy</span>
                        </div>

                        <h1 className="text-[2.6rem] font-black leading-[1.1] tracking-tight text-stone-900 md:text-[3.2rem]">
                            Your privacy,{" "}
                            <span className="bg-clip-text text-transparent" style={{ backgroundImage: "linear-gradient(135deg, #ea580c 20%, #d97706 80%)" }}>
                                our responsibility.
                            </span>
                        </h1>
                        <p className="mt-4 max-w-lg text-[15px] leading-relaxed text-stone-500">
                            Written in plain language — not corporate legalese. We&apos;re a small team that genuinely cares.{" "}
                            <span className="font-bold text-stone-700">Last updated: {LAST_UPDATED}.</span>
                        </p>

                        {/* Commitment chips */}
                        <div className="mt-6 flex flex-wrap gap-2.5">
                            {[
                                { emoji: "🔒", text: "We never sell your data",    color: "border-emerald-200 bg-emerald-50 text-emerald-800"  },
                                { emoji: "📵", text: "No spam, ever",              color: "border-blue-200   bg-blue-50   text-blue-800"        },
                                { emoji: "💛", text: "Minimal data collection",    color: "border-amber-200  bg-amber-50  text-amber-800"       },
                                { emoji: "💳", text: "Secure Razorpay payments",   color: "border-orange-200 bg-orange-50 text-orange-800"      },
                            ].map(({ emoji, text, color }) => (
                                <div key={text} className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-[12px] font-bold ${color} shadow-sm`}>
                                    <span>{emoji}</span>{text}
                                </div>
                            ))}
                        </div>

                        {/* Brand note */}
                        <div className="mt-6 inline-flex items-center gap-3 rounded-2xl border border-orange-200 bg-gradient-to-r from-orange-50 to-amber-50 px-5 py-3 shadow-sm">
                            <span className="text-2xl">🍔</span>
                            <div>
                                <p className="text-[11px] font-black uppercase tracking-[0.15em] text-orange-600">FoodKnock</p>
                                <p className="text-[12px] font-bold text-orange-700/80">Danta, Sikar, Rajasthan</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ── Table of contents ── */}
                <div className="mx-auto max-w-4xl px-4 py-8 md:px-8">
                    <div className="overflow-hidden rounded-3xl border border-amber-200 bg-white shadow-sm">
                        <div className="border-b border-amber-100 bg-gradient-to-r from-amber-50 to-orange-50 px-6 py-4">
                            <p className="text-[10.5px] font-black uppercase tracking-[0.25em] text-orange-500">Quick Navigation</p>
                        </div>
                        <div className="grid grid-cols-1 gap-1.5 p-4 sm:grid-cols-2">
                            {SECTIONS.map((s, i) => {
                                const Icon = s.icon;
                                return (
                                    <a
                                        key={s.id}
                                        href={`#${s.id}`}
                                        className="group flex items-center gap-3 rounded-xl border border-transparent px-3.5 py-2.5 text-sm font-semibold text-stone-600 transition-all duration-200 hover:border-amber-200 hover:bg-amber-50 hover:text-orange-700"
                                    >
                                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-orange-100 text-[10px] font-black text-orange-700 transition-colors group-hover:bg-orange-200">
                                            {i + 1}
                                        </span>
                                        <Icon size={13} className="shrink-0 text-stone-400 transition-colors group-hover:text-orange-500" strokeWidth={2} />
                                        {s.title}
                                    </a>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* ── Sections ── */}
                <div className="mx-auto max-w-4xl space-y-4 px-4 pb-10 md:px-8">
                    {SECTIONS.map((s, i) => {
                        const Icon = s.icon;
                        return (
                            <div
                                key={s.id}
                                id={s.id}
                                className="group scroll-mt-24 overflow-hidden rounded-3xl border border-amber-100 bg-white shadow-sm transition-shadow duration-200 hover:shadow-md hover:shadow-orange-100/50"
                            >
                                {/* Header */}
                                <div className="flex items-center gap-3.5 border-b border-amber-100 bg-gradient-to-r from-amber-50/80 to-orange-50/60 px-6 py-4">
                                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-orange-100 to-amber-100 text-[11px] font-black text-orange-700">
                                        {i + 1}
                                    </div>
                                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/80 shadow-sm">
                                        <Icon size={15} className="text-orange-500" strokeWidth={2} />
                                    </div>
                                    <h2 className="text-[15px] font-black text-stone-900">{s.title}</h2>
                                    <span className="ml-auto text-xl opacity-70">{s.emoji}</span>
                                </div>
                                {/* Body */}
                                <div className="px-6 py-5">
                                    <p className="whitespace-pre-line text-sm leading-[1.85] text-stone-600">
                                        {s.body}
                                    </p>
                                    {/* Highlight email if present */}
                                    {s.id === "contact" || s.id === "account-management" ? (
                                        <div className="mt-4 inline-flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5">
                                            <Mail size={13} className="text-amber-600 shrink-0" />
                                            <a href={`mailto:${CONTACT_EMAIL}`} className="text-sm font-black text-orange-600 hover:underline">
                                                {CONTACT_EMAIL}
                                            </a>
                                        </div>
                                    ) : null}
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* ── Bottom CTA ── */}
                <div className="mx-auto max-w-4xl px-4 pb-16 md:px-8 md:pb-24">
                    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-orange-500 via-amber-500 to-yellow-400 p-8 shadow-xl shadow-orange-200/60 md:p-10">
                        {/* Texture */}
                        <div className="pointer-events-none absolute inset-0 opacity-[0.06]" style={{ backgroundImage: "radial-gradient(circle, white 1px, transparent 1px)", backgroundSize: "16px 16px" }} aria-hidden="true" />
                        {/* Glow orbs */}
                        <div className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full bg-white/20 blur-2xl" aria-hidden="true" />
                        <div className="pointer-events-none absolute -bottom-8 left-10 h-28 w-28 rounded-full bg-white/10 blur-2xl" aria-hidden="true" />

                        <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <h3 className="text-xl font-black text-white md:text-2xl">Privacy questions? We&apos;re real humans. 🙋</h3>
                                <p className="mt-2 text-sm text-white/80">A real local team — reach out anytime and we&apos;ll answer honestly.</p>
                            </div>
                            <div className="flex shrink-0 flex-wrap gap-3">
                                <a
                                    href={`mailto:${CONTACT_EMAIL}`}
                                    className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-black text-orange-600 shadow-md transition-all hover:bg-orange-50 hover:shadow-lg active:scale-[0.97]"
                                >
                                    <Mail size={15} />
                                    Email Us
                                </a>
                                <Link
                                    href="/contact"
                                    className="inline-flex items-center gap-2 rounded-full border-2 border-white/40 bg-white/15 px-6 py-3 text-sm font-black text-white transition-all hover:bg-white/25 active:scale-[0.97]"
                                >
                                    Contact Page
                                </Link>
                            </div>
                        </div>
                    </div>
                </div>

            </main>

            <Footer />
        </>
    );
}
