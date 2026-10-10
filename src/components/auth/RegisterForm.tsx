"use client";

// src/components/auth/RegisterForm.tsx
// Premium registration form — FoodKnock
//
// AUTH EXPERIENCE 2.0: signup collects ONLY name, mobile, email, password
// (+ confirmPassword, client-side only, never sent to the server). DOB,
// referral code, and delivery address used to be collected here — all
// three were already optional/defaulted on the backend
// (src/app/api/auth/register/route.ts's normalizedBody defaults every
// address subfield to "" and treats dob/referralCode as optional), so
// removing them from this form required ZERO backend changes. Address now
// lives exclusively in Account → Saved Addresses (Phase 9); DOB lives in
// Account → Profile; referral code entry is deferred (see Phase 9
// finalization report) rather than cluttering this screen.
//
// Step 1 of the OTP-gated signup flow: submits registration data, sends
// the verification OTP, and hands off to the OTP screen — no account is
// created here (see verify-signup-otp for that).

import { useState } from "react";
import { toast } from "react-hot-toast";
import { User, Mail, Lock, Phone, Eye, EyeOff, ArrowRight, Loader2, XCircle, Gift, Check } from "lucide-react";
import { validateIndianMobile, normalizeIndianMobile } from "@/lib/validation/phone";
import { validateFullName } from "@/lib/validation/name";

// ── Types ────────────────────────────────────────────────────────────────
type FormState = {
    name: string;
    email: string;
    phone: string;
    password: string;
    confirmPassword: string;
    referralCode: string;
};

type FieldErrors = Partial<Record<keyof FormState, string>>;

const BASE_INITIAL: Omit<FormState, "referralCode"> = { name: "", email: "", phone: "", password: "", confirmPassword: "" };

// ── Field component ──────────────────────────────────────────────────────
type FieldProps = {
    id: string;
    label: string;
    type?: string;
    value: string;
    onChange: (v: string) => void;
    placeholder: string;
    autoComplete?: string;
    inputMode?: "text" | "tel" | "email";
    icon: React.ReactNode;
    rightEl?: React.ReactNode;
    error?: string;
};

function Field({
    id, label, type = "text", value, onChange, placeholder,
    autoComplete, inputMode, icon, rightEl, error,
}: FieldProps) {
    return (
        <div className="flex flex-col gap-1.5">
            <label htmlFor={id} className="flex items-center gap-1 text-[11px] font-black uppercase tracking-[0.18em] text-stone-500">
                {label} <span className="text-orange-500">*</span>
            </label>
            <div className="relative flex items-center">
                <span className={`pointer-events-none absolute left-3.5 ${error ? "text-red-400" : "text-stone-400"}`}>
                    {icon}
                </span>
                <input
                    id={id}
                    type={type}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder={placeholder}
                    autoComplete={autoComplete}
                    inputMode={inputMode}
                    required
                    aria-invalid={!!error}
                    aria-describedby={error ? `${id}-error` : undefined}
                    className={`w-full rounded-xl border ${error
                        ? "border-red-300 bg-red-50/50 focus:border-red-400 focus:ring-red-100"
                        : "border-amber-200 bg-amber-50/50 focus:border-orange-400 focus:ring-orange-100"
                        } py-3 pl-10 pr-10 text-sm font-medium text-stone-800 placeholder:text-stone-400 transition-all duration-200 hover:border-amber-300 focus:bg-white focus:outline-none focus:ring-2`}
                />
                {rightEl && <span className="absolute right-3.5">{rightEl}</span>}
            </div>
            {error && (
                <p id={`${id}-error`} className="flex items-center gap-1 text-[11px] font-bold text-red-500" role="alert">
                    <XCircle size={11} className="shrink-0" /> {error}
                </p>
            )}
        </div>
    );
}

// ── Main component ───────────────────────────────────────────────────────
type RegisterFormProps = {
    onOtpSent: (email: string) => void;
    onSwitchToLogin: () => void;
    // Referral Experience 2.0: pre-fills the referral field when the user
    // arrived via a share link (/auth?ref=CODE — see auth/page.tsx, which
    // reads this server-side and passes it down the same way it already
    // does for redirectTo/initialMode). Purely a UI convenience — the
    // server re-validates whatever code is actually submitted regardless
    // of where it came from (see handleSubmit's referralCodeStatus check).
    initialReferralCode?: string;
};

export default function RegisterForm({ onOtpSent, onSwitchToLogin, initialReferralCode = "" }: RegisterFormProps) {
    const [form, setForm] = useState<FormState>({ ...BASE_INITIAL, referralCode: initialReferralCode });
    const [showPass, setShowPass] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [loading, setLoading] = useState(false);
    const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

    const set = (key: keyof FormState) => (v: string) => {
        setForm((f) => ({ ...f, [key]: v }));
        if (fieldErrors[key]) setFieldErrors((e) => { const n = { ...e }; delete n[key]; return n; });
        // Re-check the match as the user types either password field —
        // catches the error the moment it's fixed, not just on submit.
        if ((key === "password" || key === "confirmPassword") && fieldErrors.confirmPassword) {
            setFieldErrors((e) => { const n = { ...e }; delete n.confirmPassword; return n; });
        }
    };

    const strength = form.password.length === 0 ? 0 : form.password.length < 6 ? 1 : form.password.length < 10 ? 2 : 3;
    const strengthLabel = ["", "Weak", "Good", "Strong"][strength];
    const strengthColor = ["", "bg-red-400", "bg-amber-400", "bg-green-500"][strength];

    const validate = (): boolean => {
        const errs: FieldErrors = {};

        const nameResult = validateFullName(form.name);
        if (!nameResult.ok) errs.name = nameResult.message;

        const phoneResult = validateIndianMobile(form.phone);
        if (!phoneResult.ok) errs.phone = phoneResult.message;

        if (!form.email.trim()) {
            errs.email = "Enter a valid email address";
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
            errs.email = "Enter a valid email address";
        }
        if (!form.password) {
            errs.password = "Please create a password";
        } else if (form.password.length < 6) {
            errs.password = "Password must be at least 6 characters";
        }
        if (!form.confirmPassword) {
            errs.confirmPassword = "Please confirm your password";
        } else if (form.confirmPassword !== form.password) {
            errs.confirmPassword = "Passwords do not match";
        }

        setFieldErrors(errs);
        return Object.keys(errs).length === 0;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!validate()) {
            toast.error("Please fix the highlighted fields.", {
                style: { border: "1.5px solid #fca5a5", borderRadius: "14px", fontWeight: "700", fontSize: "13px" },
            });
            return;
        }

        setLoading(true);

        try {
            // Step 1: send registration data + request the email OTP.
            // confirmPassword is validated above but intentionally never
            // sent — the server never needs to see it. No account is
            // created here — see verify-signup-otp for that.
            const referralCode = form.referralCode.trim().toUpperCase();
            const registerRes = await fetch("/api/auth/register", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: form.name.trim(),
                    email: form.email.trim(),
                    phone: normalizeIndianMobile(form.phone),
                    password: form.password,
                    ...(referralCode ? { referralCode } : {}),
                }),
            });
            const registerData = await registerRes.json();

            if (!registerRes.ok) {
                const msg: string = registerData.message ?? "";

                // Both duplicate-email and duplicate-phone return 409 — check
                // message content for "phone" before falling back to the
                // status-code shortcut, which would otherwise always match
                // the email branch first.
                if (msg.toLowerCase().includes("phone")) {
                    setFieldErrors({ phone: "This mobile number is already registered." });
                    toast.error("This mobile number is already in use.", {
                        style: { border: "1.5px solid #fca5a5", borderRadius: "14px", fontWeight: "700", fontSize: "13px" },
                    });
                } else if (registerRes.status === 409 || msg.toLowerCase().includes("email")) {
                    setFieldErrors({ email: "An account with this email already exists." });
                    toast.error("This email is already registered. Try signing in instead.", {
                        style: { border: "1.5px solid #fca5a5", borderRadius: "14px", fontWeight: "700", fontSize: "13px" },
                    });
                } else {
                    toast.error(msg || "Registration failed. Please try again.", {
                        style: { border: "1.5px solid #fca5a5", borderRadius: "14px", fontWeight: "700", fontSize: "13px" },
                    });
                }
                return;
            }

            toast.success("Verification code sent! Check your inbox. 📩", {
                duration: 2400,
                style: {
                    background: "#fff", color: "#1c1917",
                    border: "1.5px solid #fed7aa", borderRadius: "16px",
                    fontWeight: "700", fontSize: "13px",
                    boxShadow: "0 8px 24px rgba(249,115,22,0.15)",
                },
                iconTheme: { primary: "#f97316", secondary: "#fff" },
            });

            // Referral Experience 2.0: register's response reuses the same
            // resolveReferrer() lookup it already performs for the
            // self-referral guard — no new query, no new endpoint. A
            // referral code that didn't match any user is never an error
            // (signup already succeeded above); this is purely informational.
            if (referralCode && registerData.referralCodeStatus === "not_found") {
                toast("That referral code isn't valid, but you're all set — continuing without it.", {
                    duration: 3200,
                    icon: "ℹ️",
                    style: { border: "1.5px solid #fde68a", borderRadius: "14px", fontWeight: "600", fontSize: "12.5px" },
                });
            }

            const verifiedEmail = registerData.email ?? form.email.trim().toLowerCase();
            setForm({ ...BASE_INITIAL, referralCode: "" });
            onOtpSent(verifiedEmail);
        } catch {
            toast.error("Something went wrong. Please check your connection and try again.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-3.5">
            <Field
                id="reg-name" label="Full Name" value={form.name} onChange={set("name")}
                placeholder="Your full name" autoComplete="name"
                icon={<User size={15} strokeWidth={2} />}
                error={fieldErrors.name}
            />
            {/* Customer Identity Validation Repair — fixed +91 prefix, exactly
                10 digits editable. The prefix is a non-editable visual
                segment (not part of the input value), so the user can never
                type "+91+91" or end up with the prefix doubled in the
                stored value — form.phone itself only ever holds the bare
                digits, matching the canonical storage format. */}
            <div className="flex flex-col gap-1.5">
                <label htmlFor="reg-phone" className="flex items-center gap-1 text-[11px] font-black uppercase tracking-[0.18em] text-stone-500">
                    Mobile Number <span className="text-orange-500">*</span>
                </label>
                <div className={`flex items-stretch overflow-hidden rounded-xl border transition-all duration-200 focus-within:bg-white focus-within:ring-2 ${fieldErrors.phone
                    ? "border-red-300 bg-red-50/50 focus-within:border-red-400 focus-within:ring-red-100"
                    : "border-amber-200 bg-amber-50/50 focus-within:border-orange-400 focus-within:ring-orange-100"
                    }`}>
                    <span className="flex shrink-0 items-center gap-1.5 border-r border-amber-200/70 bg-amber-100/50 px-3 text-sm font-bold text-stone-600">
                        <Phone size={14} strokeWidth={2} />
                        +91
                    </span>
                    <input
                        id="reg-phone"
                        type="tel"
                        inputMode="numeric"
                        autoComplete="tel-national"
                        maxLength={10}
                        value={form.phone}
                        onChange={(e) => set("phone")(e.target.value.replace(/\D/g, "").slice(0, 10))}
                        onPaste={(e) => {
                            e.preventDefault();
                            set("phone")(normalizeIndianMobile(e.clipboardData.getData("text")).slice(0, 10));
                        }}
                        placeholder="9876543210"
                        required
                        aria-invalid={!!fieldErrors.phone}
                        aria-describedby={fieldErrors.phone ? "reg-phone-error" : undefined}
                        className="w-full bg-transparent py-3 pl-3 pr-3 text-sm font-medium text-stone-800 placeholder:text-stone-400 outline-none"
                    />
                </div>
                {fieldErrors.phone && (
                    <p id="reg-phone-error" className="flex items-center gap-1 text-[11px] font-bold text-red-500" role="alert">
                        <XCircle size={11} className="shrink-0" /> {fieldErrors.phone}
                    </p>
                )}
            </div>
            <Field
                id="reg-email" label="Email" type="email" value={form.email} onChange={set("email")}
                placeholder="you@example.com" autoComplete="email" inputMode="email"
                icon={<Mail size={15} strokeWidth={2} />}
                error={fieldErrors.email}
            />

            {/* Password with strength meter */}
            <div className="flex flex-col gap-1.5">
                <label htmlFor="reg-password" className="flex items-center gap-1 text-[11px] font-black uppercase tracking-[0.18em] text-stone-500">
                    Password <span className="text-orange-500">*</span>
                </label>
                <div className="relative flex items-center">
                    <span className={`pointer-events-none absolute left-3.5 ${fieldErrors.password ? "text-red-400" : "text-stone-400"}`}>
                        <Lock size={15} strokeWidth={2} />
                    </span>
                    <input
                        id="reg-password"
                        type={showPass ? "text" : "password"}
                        value={form.password}
                        onChange={(e) => set("password")(e.target.value)}
                        placeholder="Create a password"
                        autoComplete="new-password"
                        required
                        aria-invalid={!!fieldErrors.password}
                        className={`w-full rounded-xl border ${fieldErrors.password
                            ? "border-red-300 bg-red-50/50 focus:border-red-400 focus:ring-red-100"
                            : "border-amber-200 bg-amber-50/50 focus:border-orange-400 focus:ring-orange-100"
                            } py-3 pl-10 pr-10 text-sm font-medium text-stone-800 placeholder:text-stone-400 transition-all focus:bg-white focus:outline-none focus:ring-2`}
                    />
                    <button
                        type="button"
                        onClick={() => setShowPass((p) => !p)}
                        aria-label={showPass ? "Hide password" : "Show password"}
                        className="absolute right-3.5 text-stone-400 transition-colors hover:text-orange-500 focus:outline-none"
                    >
                        {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                </div>
                {form.password.length > 0 && (
                    <div className="mt-0.5 flex items-center gap-2">
                        <div className="flex flex-1 gap-1">
                            {[1, 2, 3].map((i) => (
                                <div key={i} className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${i <= strength ? strengthColor : "bg-stone-100"}`} />
                            ))}
                        </div>
                        <span className={`text-[10px] font-black ${strength === 1 ? "text-red-500" : strength === 2 ? "text-amber-500" : "text-green-600"}`}>
                            {strengthLabel}
                        </span>
                    </div>
                )}
                {fieldErrors.password && (
                    <p className="flex items-center gap-1 text-[11px] font-bold text-red-500" role="alert">
                        <XCircle size={11} className="shrink-0" /> {fieldErrors.password}
                    </p>
                )}
            </div>

            <Field
                id="reg-confirm-password" label="Confirm Password"
                type={showConfirm ? "text" : "password"}
                value={form.confirmPassword} onChange={set("confirmPassword")}
                placeholder="Re-enter your password" autoComplete="new-password"
                icon={<Lock size={15} strokeWidth={2} />}
                rightEl={
                    <button
                        type="button"
                        onClick={() => setShowConfirm((p) => !p)}
                        aria-label={showConfirm ? "Hide password" : "Show password"}
                        className="text-stone-400 transition-colors hover:text-orange-500 focus:outline-none"
                    >
                        {showConfirm ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                }
                error={fieldErrors.confirmPassword}
            />

            {/* ── Referral code — compact, optional, visually secondary ── */}
            <div className="flex flex-col gap-1.5">
                <label htmlFor="reg-referral" className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-[0.18em] text-stone-400">
                    <Gift size={12} className="text-stone-400" />
                    Referral Code
                    <span className="rounded-full bg-stone-100 px-1.5 py-0.5 text-[9px] font-bold normal-case tracking-normal text-stone-400">optional</span>
                </label>
                <div className="relative flex items-center">
                    <input
                        id="reg-referral"
                        value={form.referralCode}
                        onChange={(e) => set("referralCode")(e.target.value.toUpperCase().replace(/\s/g, ""))}
                        placeholder="Have a code? Enter it here"
                        autoComplete="off"
                        maxLength={8}
                        className="w-full rounded-xl border border-stone-200 bg-stone-50/60 py-2.5 pl-3.5 pr-10 text-sm font-medium uppercase tracking-wide text-stone-700 placeholder:text-stone-400 placeholder:normal-case placeholder:tracking-normal transition-all duration-200 hover:border-stone-300 focus:border-orange-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-100"
                    />
                    {form.referralCode.trim().length > 0 && (
                        <span className="absolute right-3.5 flex items-center gap-1 text-[11px] font-bold text-green-600">
                            <Check size={14} strokeWidth={2.5} />
                        </span>
                    )}
                </div>
                {form.referralCode.trim().length > 0 && (
                    <p className="flex items-center gap-1 text-[11px] font-bold text-green-600">
                        <Check size={11} strokeWidth={2.5} className="shrink-0" /> Referral applied
                    </p>
                )}
            </div>

            <button
                type="submit"
                disabled={loading}
                className="group mt-1 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 py-3.5 text-sm font-black text-white shadow-lg shadow-orange-200/70 transition-all duration-300 hover:brightness-110 hover:shadow-orange-300 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
            >
                {loading
                    ? <><Loader2 size={16} className="animate-spin" /> Sending verification code...</>
                    : <>Create Account <ArrowRight size={15} className="transition-transform duration-300 group-hover:translate-x-1" /></>
                }
            </button>

            <p className="text-center text-[12.5px] font-medium text-stone-500">
                Already have an account?{" "}
                <button
                    type="button"
                    onClick={onSwitchToLogin}
                    className="font-black text-orange-600 transition-colors hover:text-orange-700"
                >
                    Sign In
                </button>
            </p>
        </form>
    );
}
