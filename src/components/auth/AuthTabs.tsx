"use client";

// src/components/auth/AuthTabs.tsx
// Premium light warm auth shell — FoodKnock
// Zero dark surfaces. Emotionally engaging. FOMO-driven.

import { useState, useLayoutEffect } from "react";
import { useRouter } from "next/navigation";
import LoginForm from "./LoginForm";
import RegisterForm from "./RegisterForm";
import ForgotPasswordForm from "./ForgotPasswordForm";
import VerifyOtpForm from "./VerifyOtpForm";
import ResetPasswordForm from "./ResetPasswordForm";
import ResetSuccessScreen from "./ResetSuccessScreen";
import VerifySignupOtpForm from "./VerifySignupOtpForm";
import { hasAuthenticatedBefore } from "@/lib/authDeviceMemory";
import { Flame, Zap, Shield } from "lucide-react";

type Tab = "login" | "register";
type View = Tab | "forgot-password" | "verify-otp" | "reset-password" | "reset-success" | "verify-signup-otp";
type AuthTabsProps = { redirectTo?: string; initialMode?: Tab; hasExplicitMode?: boolean; initialReferralCode?: string };

// Responsive + content audit — two of these were unsubstantiated marketing
// claims with no backing feature ("Exclusive member-only deals" and
// "Birthday surprise gift from us" — no such program exists anywhere in
// the app). Replaced with real, already-shipped features: saved addresses
// (Account → Addresses) and loyalty points (src/lib/loyaltyService.ts).
const PERKS = [
    { icon: "⭐", text: "Earn loyalty points on every order" },
    { icon: "📍", text: "Save addresses for faster checkout" },
    { icon: "📦", text: "Order history & 1-tap reorder" },
    { icon: "🔔", text: "Live order tracking & updates" },
];

export default function AuthTabs({ redirectTo = "/", initialMode = "register", hasExplicitMode = false, initialReferralCode = "" }: AuthTabsProps) {
    const router = useRouter();
    const [view, setView] = useState<View>(initialMode);
    const [resetEmail, setResetEmail] = useState("");
    const [resetToken, setResetToken] = useState("");
    const [signupEmail, setSignupEmail] = useState("");

    // AUTH 2.0 — smart entry routing, priority #3: "previously authenticated
    // device marker". Runs in useLayoutEffect (not useEffect) so the
    // correction commits before the browser paints — a returning visitor
    // should never see a visible "Create Account → Sign In" flash. Only
    // ever applies when:
    //   - the URL gave no explicit mode (priority #1/#2 already won server-
    //     side in page.tsx if it did — see `hasExplicitMode`)
    //   - the current view is still the untouched SSR default ("register")
    // so it can only ever flip the DEFAULT, never override a deliberate
    // choice (explicit URL, or the user having already manually switched
    // tabs in this session).
    useLayoutEffect(() => {
        if (!hasExplicitMode && view === "register" && hasAuthenticatedBefore()) {
            setView("login");
        }
        // Intentionally runs once on mount only — this is a one-time
        // initial-default correction, not an ongoing sync.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // The pill tab-switcher only applies to login/register — treat any
    // other view as "login" for the purpose of which pill is highlighted,
    // though the switcher itself is hidden entirely during the
    // forgot-password and signup-verification sub-flows (see isTabView below).
    const activeTab: Tab = view === "register" ? "register" : "login";
    const isTabView = view === "login" || view === "register";

    // Keeps the URL's ?mode= in sync with the visible tab (AUTH EXPERIENCE
    // 2.0 §7) via router.replace — no history-entry spam from toggling
    // tabs, no full page reload, and the existing ?redirect= param (used
    // by every guard that sends a guest here) is preserved untouched.
    // REFERRAL EXPERIENCE 2.0: ?ref= is preserved too (so a refresh after
    // switching tabs doesn't lose the original referral hint) but — per
    // spec §17 — is only ever read by RegisterForm; LoginForm never
    // receives it, so a referral link never injects a code into sign-in.
    const switchTab = (tab: Tab) => {
        setView(tab);
        setResetEmail("");
        setResetToken("");
        setSignupEmail("");

        const qs = new URLSearchParams();
        qs.set("mode", tab);
        if (redirectTo && redirectTo !== "/") qs.set("redirect", redirectTo);
        if (initialReferralCode) qs.set("ref", initialReferralCode);
        router.replace(`/auth?${qs.toString()}`, { scroll: false });
    };

    const goToLogin = () => switchTab("login");

    return (
        // Responsive fix — bumped from 440px to 460px (top of the spec's
        // 420-460px recommended card width), giving the form a touch more
        // breathing room on laptop/desktop now that it's no longer forced
        // into a cramped column (see auth/page.tsx's grid breakpoint fix).
        <div className="w-full max-w-[460px]">

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

                    {/* Floating food emojis — `fk-auth-bob` (not inline
                        `style`) so prefers-reduced-motion can turn it off;
                        the previous inline-style version had no reduced-
                        motion guard at all. */}
                    <div className="pointer-events-none absolute right-5 top-4 flex gap-2 select-none text-2xl opacity-20">
                        <span className="fk-auth-bob" style={{ animationDuration: "2.4s" }}>🍔</span>
                        <span className="fk-auth-bob" style={{ animationDuration: "3.1s" }}>🥤</span>
                        <span className="fk-auth-bob" style={{ animationDuration: "2.7s" }}>🍟</span>
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
                            {view === "login" && "Welcome back, foodie! 👋"}
                            {view === "register" && "Join the food family! 🍕"}
                            {view === "forgot-password" && "Let's get you back in 🔑"}
                            {view === "verify-otp" && "Almost there! 📩"}
                            {view === "reset-password" && "Choose a new password 🔐"}
                            {view === "reset-success" && "You're all set! 🎉"}
                            {view === "verify-signup-otp" && "One last step! 📩"}
                        </h2>
                        <p className="mt-1 text-[12.5px] font-medium text-white/80">
                            {view === "login" && "Your cart and saved addresses are waiting."}
                            {view === "register" && "Free to join. Start ordering in minutes."}
                            {view === "forgot-password" && "We'll send a code to verify it's you."}
                            {view === "verify-otp" && "Enter the code we just sent you."}
                            {view === "reset-password" && "Make it strong and memorable."}
                            {view === "reset-success" && "Your account is secure and ready to go."}
                            {view === "verify-signup-otp" && "Confirm your email to activate your account."}
                        </p>
                    </div>
                </div>

                {/* ── Tab switcher (hidden during sub-flows) ── */}
                {isTabView && (
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
                                onClick={() => switchTab(tab)}
                                aria-selected={activeTab === tab}
                                role="tab"
                                className={`relative z-10 flex-1 rounded-xl py-2.5 text-[13px] font-black transition-colors duration-200 ${activeTab === tab ? "text-orange-600" : "text-stone-400 hover:text-stone-600"
                                    }`}
                            >
                                {tab === "login" ? "Sign In" : "Create Account"}
                            </button>
                        ))}
                    </div>
                )}

                {/* ── Context-aware intro (login/register only) ──
                    FoodKnock Phase 6: the login-tab box here used to show a
                    fabricated "Rated 4.9/5 by 2,450+ real customers" claim
                    with fake avatar initials — no backing data existed
                    anywhere for either number. Replaced with a real,
                    always-true fact instead of inventing a replacement
                    statistic. */}
                {isTabView && (
                    <div className="px-6 pt-5">
                        {activeTab === "login" ? (
                            <div className="flex items-center gap-3 rounded-2xl border border-amber-100 bg-gradient-to-r from-amber-50 to-orange-50 px-4 py-3">
                                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 to-amber-400 shadow-sm">
                                    <Flame size={16} className="text-white" strokeWidth={2.5} />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="text-[11px] font-black text-stone-800">Made fresh in Danta, Sikar</p>
                                    <p className="text-[10px] text-stone-400">Cooked to order, every time you sign in</p>
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
                )}

                {/* ── Form / sub-flow content ── */}
                <div className="px-6 pb-6 pt-5">
                    {view === "login" && (
                        <LoginForm
                            redirectTo={redirectTo}
                            onForgotPassword={() => setView("forgot-password")}
                            onSwitchToRegister={() => switchTab("register")}
                        />
                    )}
                    {view === "register" && (
                        <RegisterForm
                            onOtpSent={(email) => { setSignupEmail(email); setView("verify-signup-otp"); }}
                            onSwitchToLogin={() => switchTab("login")}
                            initialReferralCode={initialReferralCode}
                        />
                    )}
                    {view === "verify-signup-otp" && (
                        <VerifySignupOtpForm
                            email={signupEmail}
                            onBackToStart={goToLogin}
                        />
                    )}
                    {view === "forgot-password" && (
                        <ForgotPasswordForm
                            onCodeSent={(email) => { setResetEmail(email); setView("verify-otp"); }}
                            onBackToLogin={goToLogin}
                        />
                    )}
                    {view === "verify-otp" && (
                        <VerifyOtpForm
                            email={resetEmail}
                            onVerified={(token) => { setResetToken(token); setView("reset-password"); }}
                            onBackToLogin={goToLogin}
                        />
                    )}
                    {view === "reset-password" && (
                        <ResetPasswordForm
                            resetToken={resetToken}
                            onSuccess={() => setView("reset-success")}
                        />
                    )}
                    {view === "reset-success" && (
                        <ResetSuccessScreen onDone={goToLogin} />
                    )}
                </div>

                {/* ── Trust footer ── */}
                <div className="flex items-center justify-center gap-6 border-t border-amber-100 bg-gradient-to-r from-amber-50/60 to-orange-50/40 px-6 py-3.5">
                    {[
                        { icon: Flame, text: "Fresh Daily" },
                        { icon: Zap, text: "Fast Delivery" },
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
                .fk-auth-bob {
                    animation-name: authBob;
                    animation-timing-function: ease-in-out;
                    animation-iteration-count: infinite;
                    animation-direction: alternate;
                }
                @media (prefers-reduced-motion: reduce) {
                    .fk-auth-bob { animation: none; }
                }
            `}</style>
        </div>
    );
}