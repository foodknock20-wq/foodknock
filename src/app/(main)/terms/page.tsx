export const dynamic = "force-dynamic";

// src/app/(main)/terms/page.tsx
// Premium branded Terms & Conditions — FoodKnock
// Light warm food-brand visual language. Not a boring legal dump.

import Link from "next/link";
import Navbar from "@/components/shared/Navbar";
import Footer from "@/components/shared/Footer";
import {
    ShieldCheck, Globe, UtensilsCrossed, Package,
    Truck, CreditCard, MessageSquare, Users,
    Copyright, Scale, RefreshCw, Mail,
} from "lucide-react";

const CONTACT_EMAIL = "foodknock20@gmail.com";
const LAST_UPDATED  = "January 2025";

const SECTIONS = [
    {
        id:    "introduction",
        emoji: "👋",
        icon:  ShieldCheck,
        title: "Introduction",
        body:  `Welcome to FoodKnock ("we", "us", or "our"). These Terms & Conditions govern your use of our website and food ordering services. By placing an order or browsing our site, you agree to these terms.\n\nPlease read them carefully — they're written in plain language, not legalese. We are a local food delivery platform based in Danta, Sikar, Rajasthan.`,
    },
    {
        id:    "acceptance",
        emoji: "✅",
        icon:  Users,
        title: "Acceptance of Terms",
        body:  `By accessing our website, creating an account, or placing an order, you confirm that:\n\n• You are at least 13 years old\n• You agree to be bound by these Terms\n• The information you provide is accurate and complete\n\nIf you do not agree, please do not use our website or services. Continued use of our site after any updates constitutes acceptance of the revised terms.`,
    },
    {
        id:    "use-of-website",
        emoji: "🖥️",
        icon:  Globe,
        title: "Use of Website",
        body:  `Our website is designed to help you browse our menu, place orders, leave reviews, and contact us. You agree to use it only for lawful purposes.\n\nYou must not:\n• Attempt to gain unauthorized access to any part of the site\n• Upload harmful or malicious content\n• Use the site in a way that could damage, disable, or impair its functionality\n• Create fake accounts or submit false reviews\n\nWe reserve the right to restrict access if misuse is detected.`,
    },
    {
        id:    "menu-pricing",
        emoji: "🍕",
        icon:  UtensilsCrossed,
        title: "Menu, Pricing & Availability",
        body:  `Prices shown on our menu are in Indian Rupees (₹) and are inclusive of applicable taxes unless stated otherwise. Menu items and prices may change without prior notice.\n\nWe strive to keep our online menu updated, but availability of certain items may vary based on stock, season, or preparation time. Images on the menu are for illustration purposes and may differ slightly from the actual serving.`,
    },
    {
        id:    "orders",
        emoji: "📦",
        icon:  Package,
        title: "Order Acceptance & Cancellation",
        body:  `Placing an order through our website constitutes an offer to purchase. Your order is confirmed only after we accept it — you will receive an on-screen confirmation and an email notification.\n\nWe reserve the right to decline an order if:\n• An item is unavailable\n• Incorrect or incomplete information is provided\n• A technical error has occurred with pricing\n\nIf you need to cancel an order, email us at ${CONTACT_EMAIL} immediately. Once food preparation has begun, cancellation may not be possible and a refund will be subject to our refund policy.`,
    },
    {
        id:    "delivery",
        emoji: "🛵",
        icon:  Truck,
        title: "Delivery & Pickup Terms",
        body:  `Delivery is available within our service area around Danta, Sikar, Rajasthan. Estimated delivery times are provided as a guideline (typically 20–30 minutes) and may vary depending on order volume, weather, and traffic.\n\nWe are not liable for delays outside our reasonable control. For pickup orders, please arrive after receiving your email confirmation.\n\nEnsure your delivery address is accurate — we cannot be responsible for failed deliveries due to incorrect or incomplete address information provided by you.`,
    },
    {
        id:    "payments",
        emoji: "💳",
        icon:  CreditCard,
        title: "Payments, Charges & Refunds",
        body:  `FoodKnock accepts online payments only. All transactions are processed securely through our payment gateway using industry-standard SSL encryption. We do not store your card details.\n\nA delivery fee may apply to orders below the minimum order value (displayed at checkout). A small platform convenience fee may be added.\n\nRefunds: If your order was not delivered or was significantly incorrect, please email us at ${CONTACT_EMAIL} within 24 hours. Eligible refunds will be processed back to your original payment method within 5–7 business days.`,
    },
    {
        id:    "account",
        emoji: "👤",
        icon:  Users,
        title: "Your Account",
        body:  `You are responsible for maintaining the confidentiality of your account credentials. You agree to notify us immediately at ${CONTACT_EMAIL} if you suspect unauthorized access to your account.\n\nForgot your password? Email ${CONTACT_EMAIL} with subject "Password Reset Request" and we will send you a secure reset link.\n\nWant to delete your account? Email ${CONTACT_EMAIL} with subject "Account Deletion Request". We will permanently delete your account and data within 7 business days.\n\nYou are responsible for all orders placed under your account.`,
    },
    {
        id:    "communication",
        emoji: "✉️",
        icon:  MessageSquare,
        title: "Communication",
        body:  `We communicate primarily via email. By creating an account, you consent to receiving order confirmations, delivery updates, and support messages to your registered email address.\n\nPromotional communications are opt-in only. You can unsubscribe from marketing emails at any time using the link in the email footer or by contacting us at ${CONTACT_EMAIL}.\n\nWe do not use WhatsApp or phone calls as primary customer service channels.`,
    },
    {
        id:    "responsibilities",
        emoji: "🤝",
        icon:  Users,
        title: "User Responsibilities",
        body:  `When using our service, you agree to:\n\n• Provide accurate contact and delivery information\n• Be available to receive your delivery at the provided address\n• Treat our delivery staff respectfully\n• Not misuse our review system by posting false, malicious, or spam content\n\nYou are responsible for any orders placed using your account credentials.`,
    },
    {
        id:    "ip",
        emoji: "©️",
        icon:  Copyright,
        title: "Intellectual Property",
        body:  `All content on this website — including our logo, brand name "FoodKnock", images, menu design, and written content — is the property of FoodKnock. You may not copy, reproduce, distribute, or use our brand assets or content without prior written permission.\n\nOur brand name and identity are protected under applicable intellectual property laws.`,
    },
    {
        id:    "liability",
        emoji: "⚖️",
        icon:  Scale,
        title: "Limitation of Liability",
        body:  `While we take every effort to ensure quality and timely service, FoodKnock is not liable for indirect, incidental, or consequential damages arising from use of our services. Our maximum liability in any matter is limited to the value of the order in question.\n\nFood allergies: please inform us of any allergies in your order notes. We take reasonable precautions but cannot guarantee a completely allergen-free environment. Customers with severe allergies place orders at their own risk.`,
    },
    {
        id:    "changes",
        emoji: "🔄",
        icon:  RefreshCw,
        title: "Changes to These Terms",
        body:  `We may update these Terms & Conditions from time to time to reflect changes in our services, legal requirements, or business practices. When we make significant changes, we will update the "Last Updated" date on this page.\n\nYour continued use of the website after any changes constitutes your acceptance of the revised terms. We encourage you to review this page periodically.`,
    },
    {
        id:    "contact",
        emoji: "✉️",
        icon:  Mail,
        title: "Contact Information",
        body:  `If you have any questions about these Terms, please contact us:\n\nFoodKnock\nRamgarh Bas Stand Circle, Danta, Sikar, Rajasthan\nEmail: ${CONTACT_EMAIL}\n\nWe're a real local team and will respond as quickly as possible.`,
    },
];

export default function TermsPage() {
    return (
        <>
            <Navbar />

            <main className="min-h-screen bg-[#FFFBF5]">

                {/* ── Glow orbs ── */}
                <div className="pointer-events-none fixed -left-32 top-0 h-[400px] w-[400px] rounded-full opacity-20 blur-3xl" style={{ background: "radial-gradient(ellipse, #fed7aa, transparent 70%)" }} aria-hidden="true" />
                <div className="pointer-events-none fixed -right-32 bottom-0 h-[350px] w-[350px] rounded-full opacity-15 blur-3xl" style={{ background: "radial-gradient(ellipse, #fde68a, transparent 70%)" }} aria-hidden="true" />

                {/* ── Hero header ── */}
                <div className="relative overflow-hidden border-b border-amber-100/80 bg-white">
                    <div className="pointer-events-none absolute -top-20 left-1/2 h-56 w-3/4 -translate-x-1/2 rounded-full opacity-50 blur-3xl" style={{ background: "radial-gradient(ellipse, #fed7aa, transparent 70%)" }} aria-hidden="true" />
                    <div className="pointer-events-none absolute right-0 top-0 h-40 w-40 rounded-full opacity-20 blur-2xl" style={{ background: "radial-gradient(ellipse, #fb923c, transparent 70%)" }} aria-hidden="true" />

                    <div className="relative mx-auto max-w-4xl px-4 pb-12 pt-12 md:px-8 md:pb-16 md:pt-18">
                        {/* Badge */}
                        <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-4 py-2 shadow-sm">
                            <ShieldCheck size={12} className="text-amber-600" strokeWidth={2.5} />
                            <span className="text-[10.5px] font-black uppercase tracking-[0.25em] text-amber-700">Terms & Conditions</span>
                        </div>

                        <h1 className="text-[2.6rem] font-black leading-[1.1] tracking-tight text-stone-900 md:text-[3.2rem]">
                            Fair terms,{" "}
                            <span className="bg-clip-text text-transparent" style={{ backgroundImage: "linear-gradient(135deg, #ea580c 20%, #d97706 80%)" }}>
                                plain language.
                            </span>
                        </h1>
                        <p className="mt-4 max-w-lg text-[15px] leading-relaxed text-stone-500">
                            Simple, clear, and honest — these terms govern how FoodKnock works.{" "}
                            <span className="font-bold text-stone-700">Last updated: {LAST_UPDATED}.</span>
                        </p>

                        {/* Key points chips */}
                        <div className="mt-6 flex flex-wrap gap-2.5">
                            {[
                                { emoji: "💳", text: "Online payments only",      color: "border-blue-200   bg-blue-50   text-blue-800"    },
                                { emoji: "🛵", text: "20–30 min delivery",        color: "border-orange-200 bg-orange-50 text-orange-800"  },
                                { emoji: "💬", text: "Support via email",         color: "border-amber-200  bg-amber-50  text-amber-800"   },
                                { emoji: "🔄", text: "Easy refund process",       color: "border-emerald-200 bg-emerald-50 text-emerald-800"},
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
                                    {/* Email highlight for relevant sections */}
                                    {(s.id === "contact" || s.id === "orders" || s.id === "payments" || s.id === "account") && (
                                        <div className="mt-4 inline-flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5">
                                            <Mail size={13} className="text-amber-600 shrink-0" />
                                            <a href={`mailto:${CONTACT_EMAIL}`} className="text-sm font-black text-orange-600 hover:underline">
                                                {CONTACT_EMAIL}
                                            </a>
                                        </div>
                                    )}
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
                                <h3 className="text-xl font-black text-white md:text-2xl">Questions about these terms? 🙋</h3>
                                <p className="mt-2 text-sm text-white/80">We're a real local team — reach out anytime and we'll answer honestly.</p>
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
