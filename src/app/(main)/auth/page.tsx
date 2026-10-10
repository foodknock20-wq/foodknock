export const dynamic = "force-dynamic";

// src/app/(main)/auth/page.tsx
// Premium light warm food-brand auth page for FoodKnock — split layout with visual story
//
// FoodKnock Phase 6 — the "Social proof" + "Mini testimonials" sections
// here used to be entirely fabricated (three hardcoded named people with
// invented quotes, plus a flat "4.9/5 · 2,450+ customers" claim), then
// later replaced with a real `Review.find()` query.
//
// Responsive + content audit (this pass) — removed the real-data query
// entirely anyway, per an explicit instruction for this specific page:
// auth should not fetch reviews/products/stats just for decoration, even
// when the data is genuine — it's an unnecessary DB round-trip on the
// highest-traffic entry point for a page whose job is authentication, not
// social proof. Also replaced two BRAND_BENEFITS claims that were never
// actually substantiated by anything in the backend ("Order in under 60
// seconds" — no speed guarantee exists anywhere in the order pipeline;
// "birthday surprises" / "early access to new items" — no such feature
// exists) with claims that map to real, already-shipped features audited
// elsewhere in this app: Reorder (src/components/orders/ReorderButton.tsx)
// and live order tracking (/track-order, OrderTimeline).
import AuthTabs from "@/components/auth/AuthTabs";
import Link from "next/link";
import { Repeat2, Clock, ShieldCheck, ArrowLeft } from "lucide-react";

const BRAND_BENEFITS = [
    {
        icon: Repeat2,
        title: "Reorder in one tap",
        sub: "Your past orders are saved — reorder a favourite instantly.",
        bg: "bg-amber-50",
        border: "border-amber-200",
        iconColor: "text-amber-600",
        iconBg: "bg-amber-100",
        emoji: "🔁",
    },
    {
        icon: Clock,
        title: "Fresh food in 30–45 mins",
        sub: "Hot, made-to-order delivery right to your doorstep",
        bg: "bg-red-50",
        border: "border-red-100",
        iconColor: "text-red-500",
        iconBg: "bg-red-100",
        emoji: "🛵",
    },
    {
        icon: ShieldCheck,
        title: "Earn loyalty points",
        sub: "Every order adds points. Redeem for free food & discounts.",
        bg: "bg-green-50",
        border: "border-green-200",
        iconColor: "text-green-600",
        iconBg: "bg-green-100",
        emoji: "💎",
    },
];

type AuthPageProps = { searchParams?: Promise<{ redirect?: string; mode?: string; ref?: string }> };

export default async function AuthPage({ searchParams }: AuthPageProps) {
    const params     = await searchParams;
    const redirectTo = params?.redirect || "/";
    // AUTH 2.0 — smart entry routing. Explicit URL intent always wins
    // (checked here, server-side, deterministic). When NO explicit mode
    // is given, the SSR-safe default is Create Account — the actual
    // "has this device authenticated before?" check can only happen
    // client-side (it reads localStorage), so it's deferred to AuthTabs's
    // one-time layout-effect correction (see that file) rather than
    // guessed here. `hasExplicitMode` tells AuthTabs whether it's allowed
    // to apply that correction at all.
    const hasExplicitMode = params?.mode === "login" || params?.mode === "signup";
    const initialMode: "login" | "register" = params?.mode === "login" ? "login" : "register";
    // REFERRAL EXPERIENCE 2.0: /auth?ref=CODE pre-fills the signup form's
    // referral field (display hygiene only — trimmed/uppercased/length-
    // capped to the same 8-char shape referral codes are generated in;
    // the server re-validates whatever is actually submitted regardless
    // of this value, see register/route.ts's resolveReferrer() call).
    const initialReferralCode = (params?.ref ?? "").trim().toUpperCase().slice(0, 8);

    return (
        <div className="relative min-h-screen overflow-hidden bg-[#FFFBF5]">

            {/* ── Ambient glow orbs ── */}
            <div
                className="pointer-events-none absolute -left-40 -top-40 h-[560px] w-[560px] rounded-full opacity-40 blur-3xl"
                style={{ background: "radial-gradient(ellipse, #fed7aa, transparent 70%)" }}
                aria-hidden="true"
            />
            <div
                className="pointer-events-none absolute -right-40 bottom-10 h-[480px] w-[480px] rounded-full opacity-25 blur-3xl"
                style={{ background: "radial-gradient(ellipse, #fde68a, transparent 70%)" }}
                aria-hidden="true"
            />
            <div
                className="pointer-events-none absolute left-1/2 top-1/3 h-[300px] w-[300px] -translate-x-1/2 rounded-full opacity-10 blur-3xl"
                style={{ background: "radial-gradient(ellipse, #fb923c, transparent 70%)" }}
                aria-hidden="true"
            />

            {/* Dot grid texture */}
            <div
                className="pointer-events-none absolute inset-0 opacity-[0.022]"
                style={{
                    backgroundImage: "radial-gradient(circle, #92400e 1px, transparent 1px)",
                    backgroundSize: "28px 28px",
                }}
                aria-hidden="true"
            />

            {/* Responsive composition fix — ROOT CAUSE of the "narrow auth
                sidebar" bug: this grid previously switched to 2 columns at
                `md:` (768px) while the wider gap/padding only applied from
                `lg:` (1024px) up. In the 768-1023px gap (tablet + small
                laptop) that meant: 2 columns already active, but with the
                NARROWER md: gap/padding — at 768px each column computed to
                only ~320px, well under the auth card's own 440px target,
                which is exactly the squeezed "sidebar" that was reported.
                Fixed by moving the 2-column switch itself to `lg:` (1024px)
                — tablet/small-laptop now gets the full single-column
                composition (card centered, free to use its real max-width)
                instead of a cramped split that never had enough room. */}
            <div className="relative mx-auto grid min-h-screen max-w-7xl px-4 py-10 lg:grid-cols-[1.08fr_1fr] lg:items-center lg:gap-10 lg:px-12 lg:py-14 xl:gap-16 xl:px-16">

                {/* ════════════════════════════════════════════
                    LEFT — Visual story (desktop/laptop only, lg:+)
                ════════════════════════════════════════════ */}
                <div className="hidden flex-col justify-center lg:flex">

                    {/* Back link */}
                    <Link
                        href="/"
                        className="group mb-10 inline-flex w-fit items-center gap-2 rounded-full border border-amber-200 bg-white/80 px-4 py-2 text-xs font-black text-stone-500 shadow-sm backdrop-blur-sm transition-all hover:border-orange-300 hover:bg-white hover:text-orange-600"
                    >
                        <ArrowLeft size={13} className="transition-transform group-hover:-translate-x-0.5" />
                        Back to FoodKnock
                    </Link>

                    {/* Brand identity */}
                    <div className="mb-7 flex items-center gap-4">
                        <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500 to-amber-400 shadow-xl shadow-orange-200/60">
                            <span className="text-3xl">🍔</span>
                            <div className="absolute inset-0 rounded-2xl border-2 border-white/30" />
                            {/* Shine dot */}
                            <div className="absolute right-2 top-2 h-2 w-2 rounded-full bg-white/50" />
                        </div>
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-orange-500/70">Est. Sikar</p>
                            <p className="text-2xl font-black leading-tight tracking-tight text-stone-900">FoodKnock</p>
                            <p className="text-xs font-bold text-stone-400">Fresh. Fast. Flavourful.</p>
                        </div>
                    </div>

                    {/* Headline */}
                    <h1 className="text-[2.6rem] font-black leading-[1.12] tracking-tight text-stone-900 lg:text-[3.1rem]">
                        Your favourite café,{" "}
                        <span
                            className="bg-clip-text text-transparent"
                            style={{ backgroundImage: "linear-gradient(135deg, #ea580c 20%, #d97706 80%)" }}
                        >
                            now smarter.
                        </span>
                    </h1>
                    <p className="mt-5 max-w-[420px] text-[15px] leading-relaxed text-stone-500">
                        Join FoodKnock to save your addresses, reorder favourites in one tap, and check out faster every time.
                    </p>

                    {/* Benefit cards */}
                    <div className="mt-8 flex flex-col gap-2.5">
                        {BRAND_BENEFITS.map(({ icon: Icon, emoji, title, sub, bg, border, iconBg, iconColor }) => (
                            <div
                                key={title}
                                className={`group flex items-start gap-4 rounded-2xl border ${border} ${bg} p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:shadow-orange-100/60`}
                            >
                                <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border ${border} ${iconBg} transition-transform duration-200 group-hover:scale-105`}>
                                    <Icon size={18} className={iconColor} strokeWidth={2} />
                                </div>
                                <div>
                                    <p className="text-sm font-black text-stone-900">{title}</p>
                                    <p className="mt-0.5 text-xs leading-relaxed text-stone-500">{sub}</p>
                                </div>
                                <span className="ml-auto shrink-0 text-lg opacity-60">{emoji}</span>
                            </div>
                        ))}
                    </div>

                </div>

                {/* ════════════════════════════════════════════
                    RIGHT — Auth card
                ════════════════════════════════════════════ */}
                <div className="flex w-full flex-col items-center justify-center">

                    {/* Back link — shown whenever the left visual story is
                        hidden (everything below lg:, i.e. mobile/tablet/
                        small-laptop), matching the grid's own breakpoint. */}
                    <Link
                        href="/"
                        className="group mb-6 inline-flex items-center gap-1.5 text-sm font-bold text-stone-500 transition-colors hover:text-orange-600 lg:hidden"
                    >
                        <ArrowLeft size={13} />
                        Back to FoodKnock
                    </Link>

                    <AuthTabs
                        redirectTo={redirectTo}
                        initialMode={initialMode}
                        hasExplicitMode={hasExplicitMode}
                        initialReferralCode={initialReferralCode}
                    />

                    <p className="mt-5 text-center text-[11px] text-stone-400">
                        Need help?{" "}
                        <a href="mailto:foodknock20@gmail.com" className="font-bold text-orange-500 hover:underline">
                            foodknock20@gmail.com
                        </a>
                    </p>
                </div>
            </div>
        </div>
    );
}