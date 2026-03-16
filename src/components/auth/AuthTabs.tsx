"use client";

// src/components/auth/AuthTabs.tsx
// Premium light warm auth shell — FoodKnock
// Zero dark surfaces. Emotionally engaging. FOMO-driven.

import { useState } from "react";
import LoginForm from "./LoginForm";
import RegisterForm from "./RegisterForm";
import { Star, Flame, Zap, Gift, Shield } from "lucide-react";

type Tab = "login" | "register";
type AuthTabsProps = { redirectTo?: string };

const PERKS = [
    { icon: "⚡", text: "Faster checkout every time"      },
    { icon: "🎁", text: "Exclusive member-only deals"     },
    { icon: "📦", text: "Order history & 1-tap reorder"   },
    { icon: "🎂", text: "Birthday surprise gift from us"  },
];

export default function AuthTabs({ redirectTo = "/" }: AuthTabsProps) {
    const [activeTab, setActiveTab] = useState<Tab>("login");

    return (
        <div className="w-full max-w-[440px]">

            {/* ── FOMO nudge pill ── */}
            <div className="mb-4 flex items-center gap-3 rounded-2xl border border-amber-200 bg-gradient-to-r from-orange-50 to-amber-50 px-4 py-3 shadow-sm">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 to-amber-400 shadow-sm">
                    <Gift size={14} className="text-white" strokeWidth={2.5} />
                </div>
                <p className="text-[11px] font-bold leading-snug text-stone-700">
                    <span className="font-black text-orange-600">2,450+ customers</span> already ordering smarter —{" "}
                    <span className="text-stone-500">join free today!</span>
                </p>
            </div>

            {/* ── Main card ── */}
            <div className="overflow-hidden rounded-3xl border border-amber-200/80 bg-white shadow-2xl shadow-orange-100/50">

                {/* ── Gradient header ── */}
                <div className="relative overflow-hidden bg-gradient-to-br from-orange-500 via-amber-500 to-yellow-400 px-6 pb-6 pt-7">

                    {/* Texture overlay */}
                    <div
                        className="pointer-events-none absolute inset-0 opacity-[0.06]"
                        style={{
                            backgroundImage: "radial-gradient(circle, white 1px, transparent 1px)",
                            backgroundSize: "13px 13px",
                        }}
                    />
                    {/* Glow orbs */}
                    <div className="pointer-events-none absolute -right-8 -top-8 h-36 w-36 rounded-full bg-white/20 blur-2xl" />
                    <div className="pointer-events-none absolute -left-4 bottom-0 h-24 w-24 rounded-full bg-white/10 blur-xl" />
                    <div className="pointer-events-none absolute left-1/2 top-0 h-20 w-20 -translate-x-1/2 rounded-full bg-white/10 blur-2xl" />

                    {/* Floating food emojis */}
                    <div className="pointer-events-none absolute right-5 top-4 flex gap-2 select-none text-2xl opacity-20">
                        <span style={{ animation: "authBob 2.4s ease-in-out infinite alternate" }}>🍔</span>
                        <span style={{ animation: "authBob 3.1s ease-in-out infinite alternate" }}>🥤</span>
                        <span style={{ animation: "authBob 2.7s ease-in-out infinite alternate" }}>🍟</span>
                    </div>

                    <div className="relative z-10">
                        {/* Brand row */}
                        <div className="mb-4 flex items-center gap-3">
                            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/30 bg-white/20 text-xl backdrop-blur-sm shadow-lg">
                                🍔
                            </div>
                            <div>
                                <p className="text-[9px] font-black uppercase tracking-[0.28em] text-white/60">Fast Food</p>
                                <p className="text-[15px] font-black leading-tight text-white tracking-tight">FoodKnock</p>
                            </div>
                        </div>

                        {/* Dynamic headline */}
                        <h2 className="text-[1.45rem] font-black leading-tight tracking-tight text-white drop-shadow-sm">
                            {activeTab === "login"
                                ? "Welcome back, foodie! 👋"
                                : "Join the food family! 🍕"}
                        </h2>
                        <p className="mt-1 text-[12.5px] font-medium text-white/80">
                            {activeTab === "login"
                                ? "Your cart, deals & saved address are waiting."
                                : "Free to join. Deals & perks from day one."}
                        </p>
                    </div>
                </div>

                {/* ── Tab switcher ── */}
                <div className="relative flex gap-1 border-b border-amber-100 bg-amber-50/70 p-1.5">
                    {/* Sliding pill */}
                    <div
                        className="absolute bottom-1.5 top-1.5 rounded-xl border border-amber-200/70 bg-white shadow-md transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]"
                        style={{
                            width: "calc(50% - 8px)",
                            left: activeTab === "login" ? "6px" : "calc(50% + 2px)",
                        }}
                        aria-hidden="true"
                    />
                    {(["login", "register"] as Tab[]).map((tab) => (
                        <button
                            key={tab}
                            type="button"
                            onClick={() => setActiveTab(tab)}
                            aria-selected={activeTab === tab}
                            role="tab"
                            className={`relative z-10 flex-1 rounded-xl py-2.5 text-[13px] font-black transition-colors duration-200 ${
                                activeTab === tab ? "text-orange-600" : "text-stone-400 hover:text-stone-600"
                            }`}
                        >
                            {tab === "login" ? "Sign In" : "Create Account"}
                        </button>
                    ))}
                </div>

                {/* ── Context-aware social proof ── */}
                <div className="px-6 pt-5">
                    {activeTab === "login" ? (
                        <div className="flex items-center gap-3 rounded-2xl border border-amber-100 bg-gradient-to-r from-amber-50 to-orange-50 px-4 py-3">
                            <div className="flex gap-0.5 shrink-0">
                                {[1,2,3,4,5].map((i) => (
                                    <Star key={i} size={13} className="fill-amber-400 text-amber-400" />
                                ))}
                            </div>
                            <div className="min-w-0 flex-1">
                                <p className="text-[11px] font-black text-stone-800">
                                    Rated <span className="text-orange-600">4.9/5</span> by 2,450+ real customers
                                </p>
                                <p className="text-[10px] text-stone-400">Sikar & Danta's most loved food spot</p>
                            </div>
                            <div className="flex -space-x-1.5 shrink-0">
                                {["from-amber-400 to-orange-500", "from-orange-400 to-red-500", "from-yellow-400 to-amber-500"].map((g, i) => (
                                    <div
                                        key={i}
                                        className={`flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-gradient-to-br ${g} text-[9px] font-black text-white shadow`}
                                    >
                                        {["P","R","A"][i]}
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 gap-2">
                            {PERKS.map((p) => (
                                <div
                                    key={p.text}
                                    className="flex items-center gap-2 rounded-xl border border-amber-100 bg-amber-50/80 px-3 py-2.5 transition-all hover:border-amber-200 hover:bg-amber-50"
                                >
                                    <span className="shrink-0 text-base">{p.icon}</span>
                                    <span className="text-[10.5px] font-bold leading-tight text-stone-600">{p.text}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* ── Form ── */}
                <div className="px-6 pb-6 pt-5">
                    {activeTab === "login" ? (
                        <LoginForm redirectTo={redirectTo} />
                    ) : (
                        <RegisterForm onSuccess={() => setActiveTab("login")} />
                    )}
                </div>

                {/* ── Trust footer ── */}
                <div className="flex items-center justify-center gap-6 border-t border-amber-100 bg-gradient-to-r from-amber-50/60 to-orange-50/40 px-6 py-3.5">
                    {[
                        { icon: Flame,  text: "Fresh Daily"   },
                        { icon: Zap,    text: "Fast Delivery" },
                        { icon: Shield, text: "Safe & Secure" },
                    ].map(({ icon: Icon, text }) => (
                        <div key={text} className="flex items-center gap-1.5 text-[10.5px] font-bold text-stone-400">
                            <Icon size={11} className="text-amber-500" strokeWidth={2.5} />
                            {text}
                        </div>
                    ))}
                </div>
            </div>

            {/* ── Terms ── */}
            <p className="mt-4 text-center text-[11px] text-stone-400">
                By continuing, you agree to our{" "}
                <a href="/terms" className="font-bold text-stone-500 underline underline-offset-2 transition-colors hover:text-orange-600">Terms</a>
                {" "}&{" "}
                <a href="/privacy" className="font-bold text-stone-500 underline underline-offset-2 transition-colors hover:text-orange-600">Privacy Policy</a>
            </p>

            <style jsx global>{`
                @keyframes authBob {
                    from { transform: translateY(0px) rotate(-5deg); }
                    to   { transform: translateY(-8px) rotate(5deg); }
                }
            `}</style>
        </div>
    );
}