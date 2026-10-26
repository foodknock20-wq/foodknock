// INCIDENT (Vercel Fluid Active CPU): this is a pure static content page —
// it reads NO per-request/server data (the FAQS array + FAQPage JSON-LD are
// compile-time constants). The previous `force-dynamic` made every visit,
// including every crawler/bot hit, invoke a serverless function and SSR the
// page — burning Active CPU for zero freshness benefit. `force-static`
// prerenders it once at build and serves it from the CDN with no function
// invocation. Do NOT re-add force-dynamic unless this page starts reading
// genuine per-request data.
export const dynamic = "force-static";

// src/app/(main)/faq/page.tsx
//
// SEO — new page. Answers real, common customer questions using only
// verified application behavior (payment methods, order tracking routes,
// loyalty points, vegetarian-only menu, Danta/Sikar service area) — no
// invented delivery times, coverage claims, or business statistics.
//
// FAQPage JSON-LD is included for completeness and for non-Google answer
// engines, but Google's current rich-result guidelines limit the FAQ rich
// snippet to a narrow set of authoritative site types — this page is not
// expected to produce a Google FAQ rich result, and the content exists
// primarily as genuinely useful, crawlable page content, not as a
// rich-snippet attempt. See FOODKNOCK_SEO_REPORT.md.

import type { Metadata } from "next";
import Link from "next/link";
import Footer from "@/components/shared/Footer";
import { HelpCircle, Mail, MessageCircle } from "lucide-react";

export const metadata: Metadata = {
    title: "FAQ — FoodKnock",
    description: "Answers to common questions about ordering from FoodKnock — our vegetarian menu, delivery in Danta, payment options, order tracking and support.",
    alternates: { canonical: "https://www.foodknock.com/faq" },
    openGraph: {
        title: "FoodKnock FAQ — Ordering, Delivery & Support",
        description: "Everything you need to know about ordering vegetarian food online from FoodKnock in Danta, Sikar, Rajasthan.",
        url: "https://www.foodknock.com/faq",
    },
};

const CONTACT_EMAIL = "foodknock20@gmail.com";
const WHATSAPP_LINK = "https://wa.me/918764821399";

type FaqItem = { question: string; answer: string };

// Every answer below is written to match actual, current app behavior —
// not aspirational copy. If the behavior changes, update the answer here.
const FAQS: FaqItem[] = [
    {
        question: "What is FoodKnock?",
        answer: "FoodKnock is an online food-ordering platform operating as a vegetarian-only cloud kitchen, based in Danta, Sikar, Rajasthan. You browse the menu, place an order, and track it online or via the FoodKnock app.",
    },
    {
        question: "Is FoodKnock vegetarian-only?",
        answer: "Yes. FoodKnock does not prepare or sell any non-vegetarian food. Every item on the menu is vegetarian.",
    },
    {
        question: "Where does FoodKnock deliver?",
        answer: "FoodKnock delivers from its kitchen in Danta, Sikar, Rajasthan, within a delivery radius of the kitchen. Exact delivery fees scale with distance, and availability for any specific address depends on actual serviceability — select or confirm your delivery location after signing in, and FoodKnock will tell you whether it currently delivers there.",
    },
    {
        question: "How do I check if my address is serviceable?",
        answer: "Sign in, then select or confirm your delivery location from the location picker. FoodKnock checks real-time serviceability for that location and shows you the result before you add items to your cart or check out.",
    },
    {
        question: "How can I browse the menu?",
        answer: "The full menu is available at foodknock.com/menu, organized by category, with search and filtering. No account is required to browse — you only need to sign in to select a delivery location and place an order.",
    },
    {
        question: "What payment options are available?",
        answer: "FoodKnock supports Cash on Delivery (COD) and secure online payments via Razorpay (cards, UPI, net banking, and wallets, subject to what Razorpay itself supports).",
    },
    {
        question: "How can I track my order?",
        answer: "Once you're logged in, open My Orders to see full, real-time status for any order you've placed. A public order-status lookup is also available for anyone holding a specific order ID, showing status and item details without requiring login.",
    },
    {
        question: "Does FoodKnock have a loyalty/rewards program?",
        answer: "Yes. Logged-in customers earn loyalty points on eligible orders, which can be redeemed toward future orders. Your current balance and history are available on the Loyalty page after signing in.",
    },
    {
        question: "How do I contact FoodKnock support?",
        answer: "Reach FoodKnock via WhatsApp, phone, or email — see the Contact page for current channels and response details.",
    },
    {
        question: "What should I do if there's an issue with my order?",
        answer: "Contact FoodKnock support (WhatsApp, phone, or email — see the Contact page) with your order ID, and describe the issue. Support will help resolve it according to FoodKnock's current policies.",
    },
    {
        question: "Can I cancel an order?",
        answer: "Order cancellation is available from My Orders for eligible orders, depending on how far the order has progressed. If a cancellation isn't available from there, contact support directly.",
    },
];

const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQS.map((f) => ({
        "@type": "Question",
        name: f.question,
        acceptedAnswer: { "@type": "Answer", text: f.answer },
    })),
};

export default function FaqPage() {
    return (
        <>
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />

            <main className="bg-[#FFFBF5]">
                <div className="border-b border-amber-100 bg-gradient-to-b from-amber-50/60 to-transparent">
                    <div className="mx-auto max-w-4xl px-4 py-12 md:px-8">
                        <div className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-white px-4 py-1.5 text-[11px] font-bold text-orange-700 shadow-sm">
                            <HelpCircle size={13} /> Frequently Asked Questions
                        </div>
                        <h1 className="mt-4 text-3xl font-black leading-tight text-stone-800 sm:text-4xl">
                            Questions about ordering from FoodKnock?
                        </h1>
                        <p className="mt-4 max-w-lg text-[15px] leading-relaxed text-stone-500">
                            Straight answers about our vegetarian menu, delivery in Danta, payments, order tracking and support.
                        </p>
                    </div>
                </div>

                <div className="mx-auto max-w-4xl px-4 py-10 md:px-8">
                    <div className="space-y-3">
                        {FAQS.map((f) => (
                            <details
                                key={f.question}
                                className="group overflow-hidden rounded-2xl border border-amber-200 bg-white shadow-sm"
                            >
                                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 text-left text-[15px] font-bold text-stone-800">
                                    {f.question}
                                    <span className="shrink-0 text-orange-500 transition-transform group-open:rotate-45">+</span>
                                </summary>
                                <p className="px-5 pb-4 text-[14px] leading-relaxed text-stone-600">{f.answer}</p>
                            </details>
                        ))}
                    </div>

                    <div className="mt-10 flex flex-col items-center gap-4 rounded-2xl border border-amber-200 bg-gradient-to-r from-orange-50 to-amber-50 px-6 py-8 text-center">
                        <p className="text-[15px] font-bold text-stone-800">Still have a question?</p>
                        <div className="flex flex-wrap items-center justify-center gap-3">
                            <a
                                href={WHATSAPP_LINK}
                                className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm"
                            >
                                <MessageCircle size={15} /> WhatsApp Us
                            </a>
                            <a
                                href={`mailto:${CONTACT_EMAIL}`}
                                className="inline-flex items-center gap-2 rounded-full border border-amber-300 bg-white px-5 py-2.5 text-sm font-bold text-orange-700 shadow-sm"
                            >
                                <Mail size={15} /> Email Support
                            </a>
                            <Link
                                href="/contact"
                                className="inline-flex items-center gap-2 rounded-full border border-amber-300 bg-white px-5 py-2.5 text-sm font-bold text-orange-700 shadow-sm"
                            >
                                Contact Page
                            </Link>
                        </div>
                    </div>
                </div>
            </main>
            <Footer />
        </>
    );
}
