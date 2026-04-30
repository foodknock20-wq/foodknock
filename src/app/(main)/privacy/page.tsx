export const dynamic = "force-dynamic";

// src/app/(main)/privacy/page.tsx
// Premium branded Privacy Policy — FoodKnock
// Light warm food-brand visual language. Clear, honest, not corporate.

import Link from "next/link";
import Navbar from "@/components/shared/Navbar";
import Footer from "@/components/shared/Footer";
import {
    Lock, ShieldCheck, Eye, Server, Cookie,
    Link2, Mail, Settings, RefreshCw, HelpCircle,
    Package, Smartphone, CreditCard,
} from "lucide-react";

const CONTACT_EMAIL = "foodknock20@gmail.com";
const LAST_UPDATED  = "January 2025";

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
        body:  `When you use our website or place an order, we may collect:\n\n• Your name, email address, and delivery address when you register or place an order\n• Reviews or feedback you voluntarily submit on our website\n• Basic website usage data (pages visited, browser type) for analytics purposes\n\nWe do not collect payment card details directly — all payments are processed securely through our payment gateway. We do not require government IDs. We keep data collection minimal and purposeful.`,
    },
    {
        id:    "how-we-use",
        emoji: "🔧",
        icon:  Settings,
        title: "How We Use Your Information",
        body:  `The information you provide is used solely to:\n\n• Process and fulfill your food orders\n• Coordinate delivery to your address\n• Send order confirmations and updates to your registered email\n• Respond to your support queries or complaints\n• Improve our menu and service based on honest feedback\n\nWe do not use your information for advertising networks, data brokers, or any third-party marketing purposes.`,
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
        body:  `FoodKnock processes all payments online through a secure payment gateway. We do not store your card details on our servers. All transactions are encrypted using industry-standard SSL/TLS protocols.\n\nYour payment information is handled entirely by our payment processor and is subject to their security standards and privacy policy. We receive only a transaction confirmation — never your full card details.`,
    },
    {
        id:    "account-management",
        emoji: "⚙️",
        icon:  Smartphone,
        title: "Account Deletion & Password Reset",
        body:  `You have full control over your account:\n\n• Forgot your password? Send an email to ${CONTACT_EMAIL} with the subject "Password Reset Request" and we will send you a secure reset link within a few hours.\n\n• Want to delete your account? Email us at ${CONTACT_EMAIL} with the subject "Account Deletion Request". We will permanently delete your account and associated data within 7 business days, except where we are legally required to retain certain records.\n\nWe take all such requests seriously and will confirm via email once completed.`,
    },
    {
        id:    "cookies",
        emoji: "🍪",
        icon:  Cookie,
        title: "Cookies & Analytics",
        body:  `Our website uses basic cookies to remember your preferences, keep you logged in, and improve your browsing experience. We may use privacy-respecting analytics tools to understand how visitors use our site (e.g., which pages are most visited). This data is anonymous and not linked to any personal identity.\n\nYou can choose to disable cookies in your browser settings. Some features of the website (like staying logged in) may not work if cookies are disabled.`,
    },
    {
        id:    "data-sharing",
        emoji: "🔗",
        icon:  Link2,
        title: "Data Sharing & Third Parties",
        body:  `We do not sell, rent, or trade your personal data to any third parties.\n\nWe may share minimal necessary information with:\n• Our delivery partners (name, address) solely to complete your delivery\n• Our payment gateway to process your transaction securely\n• Our website hosting and technical service providers, who are bound to keep data secure\n\nWe do not share your data with advertisers, data brokers, or marketing platforms.`,
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
        body:  `Your data is stored on secure servers. We retain personal data only for as long as necessary to provide our services or as required by law.\n\nWhen you delete your account, we will remove your personal data from our active systems within 7 business days. Some data may be retained in secure backups for a limited additional period before being permanently erased.`,
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
                            Written in plain language — not corporate legalese. We're a small team that genuinely cares.{" "}
                            <span className="font-bold text-stone-700">Last updated: {LAST_UPDATED}.</span>
                        </p>

                        {/* Commitment chips */}
                        <div className="mt-6 flex flex-wrap gap-2.5">
                            {[
                                { emoji: "🔒", text: "We never sell your data",    color: "border-emerald-200 bg-emerald-50 text-emerald-800"  },
                                { emoji: "📵", text: "No spam, ever",              color: "border-blue-200   bg-blue-50   text-blue-800"        },
                                { emoji: "💛", text: "Minimal data collection",    color: "border-amber-200  bg-amber-50  text-amber-800"       },
                                { emoji: "💳", text: "Payments 100% secure",       color: "border-orange-200 bg-orange-50 text-orange-800"      },
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
                                <h3 className="text-xl font-black text-white md:text-2xl">Privacy questions? We're real humans. 🙋</h3>
                                <p className="mt-2 text-sm text-white/80">A real local team — reach out anytime and we'll answer honestly.</p>
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
