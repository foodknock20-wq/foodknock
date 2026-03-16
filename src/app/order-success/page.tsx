"use client";
export const dynamic = "force-dynamic";


// src/app/order-success/page.tsx

import { Suspense, useEffect, useState, useRef } from "react";
import { useSearchParams }              from "next/navigation";
import Link                             from "next/link";
import Navbar                           from "@/components/shared/Navbar";
import Footer                           from "@/components/shared/Footer";
import {
    CheckCircle2, Clock, Flame, MapPin, Package,
    Phone, ShoppingBag, Star, Sparkles, ArrowRight,
    Bike, ChefHat, Home, ReceiptText, Smartphone,
} from "lucide-react";

const DELIVERY_STEPS = [
    { icon: ReceiptText, label: "Order Confirmed",  sub: "We've received your order",       done: true  },
    { icon: ChefHat,     label: "Being Prepared",   sub: "Our kitchen is on it",            done: true  },
    { icon: Bike,        label: "Out for Delivery", sub: "Rider will call you when nearby", done: false },
    { icon: Home,        label: "Delivered",         sub: "Enjoy your meal! 🍽️",            done: false },
];

function AnimCounter({ to, prefix = "", suffix = "" }: { to: number; prefix?: string; suffix?: string }) {
    const [val, setVal] = useState(0);
    const ref = useRef<ReturnType<typeof setInterval> | null>(null);
    useEffect(() => {
        const step = Math.ceil(to / 30);
        ref.current = setInterval(() => {
            setVal((v) => {
                if (v + step >= to) { clearInterval(ref.current!); return to; }
                return v + step;
            });
        }, 30);
        return () => clearInterval(ref.current!);
    }, [to]);
    return <>{prefix}{val.toLocaleString("en-IN")}{suffix}</>;
}

// ─── Inner component — uses useSearchParams, must be inside <Suspense> ───────
function OrderSuccessContent() {
    const params  = useSearchParams();
    const orderId = params.get("orderId") ?? "";

    const [visible,      setVisible]      = useState(false);
    const [ringDone,     setRingDone]     = useState(false);
    const [pointsEarned] = useState(Math.floor(Math.random() * 30) + 10);

    useEffect(() => {
        const t1 = setTimeout(() => setVisible(true),  100);
        const t2 = setTimeout(() => setRingDone(true), 900);
        return () => { clearTimeout(t1); clearTimeout(t2); };
    }, []);

    return (
        <div className="relative mx-auto max-w-2xl px-4 py-12 md:py-16">

            {/* ── Animated success badge ── */}
            <div className={`mb-8 flex flex-col items-center text-center transition-all duration-700 ${visible ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"}`}>
                <div className="relative mb-6">
                    <div className={`absolute inset-0 rounded-full bg-emerald-400/20 transition-all duration-1000 ${ringDone ? "scale-[1.6] opacity-0" : "scale-100 opacity-100"}`} />
                    <div className={`absolute inset-0 rounded-full bg-emerald-400/15 transition-all duration-700 delay-200 ${ringDone ? "scale-[1.4] opacity-0" : "scale-100 opacity-100"}`} />
                    <div className="relative flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-2xl shadow-emerald-300/50">
                        <CheckCircle2 size={44} className="text-white" strokeWidth={2.5} />
                    </div>
                    {ringDone && (
                        <>
                            {[0, 60, 120, 180, 240, 300].map((deg) => (
                                <div
                                    key={deg}
                                    className="absolute h-2 w-2 rounded-full bg-amber-400 shadow-sm shadow-amber-300 animate-ping"
                                    style={{
                                        top:   `${50 + 54 * Math.sin((deg * Math.PI) / 180)}%`,
                                        left:  `${50 + 54 * Math.cos((deg * Math.PI) / 180)}%`,
                                        animationDelay: `${deg / 300}s`,
                                        animationDuration: "1.4s",
                                    }}
                                />
                            ))}
                        </>
                    )}
                </div>

                <h1 className="text-3xl font-black tracking-tight text-stone-900 md:text-4xl">
                    Order Placed! 🎉
                </h1>
                <p className="mt-2 text-base font-medium text-stone-500">
                    When Hunger Knocks, <span className="font-black text-orange-500">FoodKnock Delivers.</span>
                </p>

                {orderId && (
                    <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-stone-200 bg-white px-4 py-2 shadow-sm">
                        <Package size={13} className="text-orange-500" />
                        <span className="text-[11px] font-black uppercase tracking-widest text-stone-500">Order ID</span>
                        <span className="font-mono text-[13px] font-black text-stone-900">{orderId.slice(-8).toUpperCase()}</span>
                    </div>
                )}
            </div>

            {/* ── Card stack ── */}
            <div className={`flex flex-col gap-4 transition-all duration-700 delay-200 ${visible ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"}`}>

                {/* 1 · Delivery steps */}
                <div className="overflow-hidden rounded-3xl border border-stone-100 bg-white shadow-sm">
                    <div className="border-b border-stone-100 bg-gradient-to-r from-orange-50/70 to-red-50/40 px-5 py-4">
                        <div className="flex items-center gap-3">
                            <Bike size={18} className="text-orange-500" />
                            <div>
                                <p className="text-[13px] font-black text-stone-900">Your Order is on its way</p>
                                <p className="text-[11px] text-stone-500">Estimated time: 30–45 minutes</p>
                            </div>
                        </div>
                    </div>
                    <div className="px-5 py-5">
                        <div className="relative space-y-0">
                            {DELIVERY_STEPS.map((step, i) => {
                                const Icon   = step.icon;
                                const last   = i === DELIVERY_STEPS.length - 1;
                                const active = !step.done && (i === 0 || DELIVERY_STEPS[i - 1]?.done);
                                return (
                                    <div key={step.label} className="relative flex gap-4">
                                        {!last && (
                                            <div className={`absolute left-[18px] top-10 h-full w-0.5 ${step.done ? "bg-emerald-200" : "bg-stone-100"}`} />
                                        )}
                                        <div className={`relative z-10 mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 transition-all ${
                                            step.done
                                                ? "border-emerald-300 bg-emerald-50 text-emerald-600"
                                                : active
                                                    ? "border-orange-400 bg-orange-50 text-orange-500 shadow-md shadow-orange-100"
                                                    : "border-stone-200 bg-stone-50 text-stone-400"
                                        }`}>
                                            {step.done
                                                ? <CheckCircle2 size={16} className="text-emerald-500" strokeWidth={2.5} />
                                                : <Icon size={15} strokeWidth={1.8} />
                                            }
                                            {active && (
                                                <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-orange-500 animate-pulse" />
                                            )}
                                        </div>
                                        <div className={`pb-6 ${last ? "pb-0" : ""}`}>
                                            <p className={`text-[13px] font-black ${step.done ? "text-emerald-700" : active ? "text-orange-600" : "text-stone-400"}`}>
                                                {step.label}
                                                {active && <span className="ml-1.5 text-[10px] font-bold uppercase tracking-wide text-orange-400">· In progress</span>}
                                            </p>
                                            <p className={`text-[11px] ${step.done ? "text-stone-500" : "text-stone-400"}`}>{step.sub}</p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* 2 · Rider notice */}
                <div className="flex items-start gap-4 rounded-3xl border border-blue-100 bg-gradient-to-r from-blue-50/80 to-sky-50/60 px-5 py-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-blue-100">
                        <Phone size={17} className="text-blue-600" />
                    </div>
                    <div>
                        <p className="text-[13px] font-black text-stone-900">Rider will call you directly</p>
                        <p className="text-[12px] leading-relaxed text-stone-500">
                            When your order is out for delivery, our rider will call the mobile number you provided.
                            Please keep your phone reachable!
                        </p>
                    </div>
                </div>

                {/* 3 · Points earned */}
                <div className="overflow-hidden rounded-3xl border border-violet-100 bg-gradient-to-br from-violet-50 to-purple-50 shadow-sm">
                    <div className="flex items-center gap-4 px-5 py-5">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 shadow-md shadow-violet-200">
                            <Sparkles size={20} className="text-white" />
                        </div>
                        <div className="flex-1">
                            <p className="text-[11px] font-black uppercase tracking-widest text-violet-500">FoodKnock Rewards</p>
                            <p className="text-[13px] font-black text-stone-900">
                                You'll earn{" "}
                                <span className="text-violet-700">
                                    <AnimCounter to={pointsEarned} /> pts
                                </span>{" "}
                                on delivery
                            </p>
                            <p className="text-[11px] text-stone-500">Points are credited once your order is marked delivered.</p>
                        </div>
                        <div className="shrink-0">
                            <div className="flex items-center gap-1">
                                {[1,2,3,4,5].map((i) => <Star key={i} size={12} className="fill-amber-400 text-amber-400" />)}
                            </div>
                            <p className="mt-0.5 text-right text-[10px] font-bold text-stone-400">Loyalty</p>
                        </div>
                    </div>
                </div>

                {/* 4 · Info strip */}
                <div className="grid grid-cols-3 gap-3">
                    {[
                        { icon: Clock, label: "Prep time",  val: "10–15 min", color: "text-amber-600 bg-amber-50 border-amber-100"   },
                        { icon: Bike,  label: "Delivery",   val: "20–30 min", color: "text-orange-600 bg-orange-50 border-orange-100" },
                        { icon: Flame, label: "Made fresh", val: "Every time", color: "text-red-600 bg-red-50 border-red-100"         },
                    ].map(({ icon: Icon, label, val, color }) => (
                        <div key={label} className={`flex flex-col items-center rounded-2xl border px-3 py-3.5 text-center ${color}`}>
                            <Icon size={18} strokeWidth={1.8} />
                            <p className="mt-1.5 text-[10px] font-bold uppercase tracking-wide opacity-70">{label}</p>
                            <p className="text-[12px] font-black">{val}</p>
                        </div>
                    ))}
                </div>

                {/* 5 · CTAs */}
                <div className="flex flex-col gap-3 pt-2 sm:flex-row">
                    <Link href="/menu" className="group flex flex-1 items-center justify-center gap-2.5 rounded-2xl bg-gradient-to-r from-orange-500 to-red-500 px-6 py-4 text-[14px] font-black text-white shadow-lg shadow-orange-200/60 transition-all hover:brightness-105 active:scale-[0.98]">
                        <Package size={16} strokeWidth={2.5} />
                        Order More with Us
                        <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" />
                    </Link>
                    <Link href="/my-orders" className="group flex flex-1 items-center justify-center gap-2.5 rounded-2xl border border-stone-200 bg-white px-6 py-4 text-[14px] font-black text-stone-700 shadow-sm transition-all hover:border-orange-300 hover:bg-orange-50 active:scale-[0.98]">
                        <ShoppingBag size={16} strokeWidth={2.5} />
                        My Orders
                    </Link>
                </div>

                {/* 6 · App nudge */}
                <div className="flex items-center gap-4 rounded-3xl border border-stone-100 bg-white px-5 py-4 shadow-sm">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500 to-red-500 shadow-md shadow-orange-100">
                        <Smartphone size={17} className="text-white" />
                    </div>
                    <div>
                        <p className="text-[13px] font-black text-stone-900">Coming soon: FoodKnock App</p>
                        <p className="text-[11px] text-stone-500">
                            Real-time tracking · faster checkout · app-only deals.{" "}
                            <span className="font-bold text-orange-500">iOS & Android.</span>
                        </p>
                    </div>
                </div>

                {/* 7 · Brand note */}
                <div className="pb-4 pt-2 text-center">
                    <p className="text-[12px] font-bold text-stone-400">
                        Thank you for choosing{" "}
                        <span className="font-black text-orange-500">FoodKnock</span> 🧡
                    </p>
                    <p className="mt-0.5 text-[11px] italic text-stone-300">
                        "When Hunger Knocks, FoodKnock Delivers."
                    </p>
                </div>

            </div>
        </div>
    );
}

// ─── Page — wraps content in Suspense (required for useSearchParams) ─────────
export default function OrderSuccessPage() {
    return (
        <>
            <Navbar />
            <main className="min-h-screen bg-[#FAFAF9]">
                <div className="pointer-events-none absolute left-0 right-0 top-0 h-64 opacity-30"
                    style={{ background: "radial-gradient(ellipse 80% 60% at 50% 0%, #fed7aa, transparent)" }} />
                <Suspense fallback={
                    <div className="flex min-h-[60vh] items-center justify-center">
                        <div className="h-10 w-10 animate-spin rounded-full border-4 border-orange-200 border-t-orange-500" />
                    </div>
                }>
                    <OrderSuccessContent />
                </Suspense>
            </main>
            <Footer />
        </>
    );
}