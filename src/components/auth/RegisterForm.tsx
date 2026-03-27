"use client";

// src/components/auth/RegisterForm.tsx
// Premium registration form — FoodKnock
// - Referral code field with +25pts incentive
// - Client-side format validation
// - Server-side self-referral error mapped
// - Password strength meter
// - No phone numbers in toasts

import { useState } from "react";
import { toast } from "react-hot-toast";
import {
    User, Mail, Lock, Phone, Calendar, MapPin,
    Eye, EyeOff, ArrowRight, Loader2, Building2,
    Hash, Navigation, XCircle, Gift,
} from "lucide-react";

// ── Types ────────────────────────────────────────────────────────────────
type FormState = {
    name:         string;
    dob:          string;
    email:        string;
    phone:        string;
    password:     string;
    referralCode: string;
    addressLine1: string;
    addressLine2: string;
    city:         string;
    state:        string;
    pincode:      string;
    landmark:     string;
};

type FieldErrors = Partial<Record<keyof FormState, string>>;

const INITIAL: FormState = {
    name: "", dob: "", email: "", phone: "", password: "",
    referralCode: "",
    addressLine1: "", addressLine2: "", city: "", state: "", pincode: "", landmark: "",
};

const REQUIRED_FIELDS: (keyof FormState)[] = [
    "name", "email", "phone", "password", "addressLine1", "city", "state", "pincode",
];

const FIELD_LABELS: Partial<Record<keyof FormState, string>> = {
    name: "Full Name", email: "Email", phone: "Phone", password: "Password",
    addressLine1: "Address Line 1", city: "City", state: "State", pincode: "Pincode",
};

// ── Field component ──────────────────────────────────────────────────────
type FieldProps = {
    id:            string;
    label:         string;
    type?:         string;
    value:         string;
    onChange:      (v: string) => void;
    placeholder:   string;
    autoComplete?: string;
    icon:          React.ReactNode;
    rightEl?:      React.ReactNode;
    required?:     boolean;
    colSpan?:      boolean;
    optional?:     boolean;
    error?:        string;
    hint?:         string;
};

function Field({
    id, label, type = "text", value, onChange, placeholder,
    autoComplete, icon, rightEl, required, colSpan, optional, error, hint,
}: FieldProps) {
    return (
        <div className={`flex flex-col gap-1.5 ${colSpan ? "sm:col-span-2" : ""}`}>
            <label
                htmlFor={id}
                className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-[0.18em] text-stone-500"
            >
                {label}
                {optional && (
                    <span className="rounded-full bg-stone-100 px-1.5 py-0.5 text-[9px] font-bold normal-case tracking-normal text-stone-400">
                        optional
                    </span>
                )}
                {required && <span className="text-orange-500">*</span>}
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
                    required={required}
                    aria-invalid={!!error}
                    aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
                    className={`w-full rounded-xl border ${
                        error
                            ? "border-red-300 bg-red-50/50 focus:border-red-400 focus:ring-red-100"
                            : "border-amber-200 bg-amber-50/50 focus:border-orange-400 focus:ring-orange-100"
                    } py-2.5 pl-10 pr-10 text-sm font-medium text-stone-800 placeholder:text-stone-400 transition-all duration-200 hover:border-amber-300 focus:bg-white focus:outline-none focus:ring-2`}
                />
                {rightEl && <span className="absolute right-3.5">{rightEl}</span>}
            </div>
            {error && (
                <p id={`${id}-error`} className="flex items-center gap-1 text-[11px] font-bold text-red-500">
                    <XCircle size={11} className="shrink-0" /> {error}
                </p>
            )}
            {!error && hint && (
                <p id={`${id}-hint`} className="text-[11px] text-stone-400">{hint}</p>
            )}
        </div>
    );
}

function SectionHead({ emoji, title }: { emoji: string; title: string }) {
    return (
        <div className="flex items-center gap-2.5 pt-1">
            <span className="text-base">{emoji}</span>
            <span className="text-[11px] font-black uppercase tracking-[0.2em] text-orange-600">{title}</span>
            <div className="h-px flex-1 bg-gradient-to-r from-amber-200/80 to-transparent" />
        </div>
    );
}

// ── Main component ───────────────────────────────────────────────────────
export default function RegisterForm({ onSuccess }: { onSuccess: () => void }) {
    const [form,        setForm]        = useState<FormState>(INITIAL);
    const [showPass,    setShowPass]    = useState(false);
    const [loading,     setLoading]     = useState(false);
    const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

    const set = (key: keyof FormState) => (v: string) => {
        setForm((f) => ({ ...f, [key]: v }));
        if (fieldErrors[key]) setFieldErrors((e) => { const n = { ...e }; delete n[key]; return n; });
    };

    const strength      = form.password.length === 0 ? 0 : form.password.length < 6 ? 1 : form.password.length < 10 ? 2 : 3;
    const strengthLabel = ["", "Weak", "Good", "Strong"][strength];
    const strengthColor = ["", "bg-red-400", "bg-amber-400", "bg-green-500"][strength];

    const validate = (): boolean => {
        const errs: FieldErrors = {};

        for (const key of REQUIRED_FIELDS) {
            if (!form[key].trim()) {
                errs[key] = `${FIELD_LABELS[key] ?? key} is required.`;
            }
        }
        if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
            errs.email = "Please enter a valid email address.";
        }
        if (form.phone.trim() && form.phone.replace(/\D/g, "").length < 10) {
            errs.phone = "Phone must be at least 10 digits.";
        }
        if (form.password && form.password.length < 6) {
            errs.password = "Password must be at least 6 characters.";
        }
        if (form.pincode.trim() && !/^\d{4,10}$/.test(form.pincode.trim())) {
            errs.pincode = "Please enter a valid pincode.";
        }
        if (form.referralCode.trim()) {
            const cleaned = form.referralCode.trim().toUpperCase().replace(/\s/g, "");
            if (!/^[A-Z0-9]{4,8}$/.test(cleaned)) {
                errs.referralCode = "Referral codes are 4–8 letters/numbers with no spaces.";
            }
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
            // 1) Register
            const registerRes = await fetch("/api/auth/register", {
                method:  "POST",
                headers: { "Content-Type": "application/json" },
                body:    JSON.stringify({
                    ...form,
                    referralCode: form.referralCode.trim().toUpperCase() || undefined,
                }),
            });
            const registerData = await registerRes.json();

            if (!registerRes.ok) {
                const msg: string = registerData.message ?? "";

                if (registerRes.status === 409 || msg.toLowerCase().includes("email")) {
                    setFieldErrors({ email: "An account with this email already exists." });
                    toast.error("This email is already registered. Try signing in instead.", {
                        style: { border: "1.5px solid #fca5a5", borderRadius: "14px", fontWeight: "700", fontSize: "13px" },
                    });
                } else if (msg.toLowerCase().includes("phone")) {
                    setFieldErrors({ phone: "This phone number is already registered." });
                    toast.error("This phone number is already in use.", {
                        style: { border: "1.5px solid #fca5a5", borderRadius: "14px", fontWeight: "700", fontSize: "13px" },
                    });
                } else if (msg.toLowerCase().includes("own referral") || msg.toLowerCase().includes("self")) {
                    setFieldErrors({ referralCode: "You can't use your own referral code." });
                    toast.error("Self-referral isn't allowed.", {
                        style: { border: "1.5px solid #fca5a5", borderRadius: "14px", fontWeight: "700", fontSize: "13px" },
                    });
                } else {
                    toast.error(msg || "Registration failed. Please try again.", {
                        style: { border: "1.5px solid #fca5a5", borderRadius: "14px", fontWeight: "700", fontSize: "13px" },
                    });
                }
                return;
            }

            // 2) Auto-login
            const loginRes  = await fetch("/api/auth/login", {
                method:  "POST",
                headers: { "Content-Type": "application/json" },
                body:    JSON.stringify({ email: form.email.trim(), password: form.password }),
            });
            const loginData = await loginRes.json();

            if (!loginRes.ok) {
                toast.success("Account created! Please sign in to continue. 🎉", {
                    duration: 2600,
                    style: {
                        background: "#fff", color: "#1c1917",
                        border: "1.5px solid #fed7aa", borderRadius: "16px",
                        fontWeight: "700", fontSize: "13px",
                        boxShadow: "0 8px 32px rgba(249,115,22,0.18)",
                    },
                    iconTheme: { primary: "#f97316", secondary: "#fff" },
                });
                setForm(INITIAL);
                onSuccess();
                return;
            }

            // 3) Cache user info
            try {
                if (loginData?.user) {
                    localStorage.setItem("cafeapp_user", JSON.stringify({
                        name:    loginData.user.name    ?? form.name.trim(),
                        email:   loginData.user.email   ?? form.email.trim(),
                        phone:   loginData.user.phone   ?? form.phone.trim(),
                        address: loginData.user.address ?? form.addressLine1.trim(),
                    }));
                }
            } catch { /* storage unavailable */ }

            const hadReferral = !!form.referralCode.trim();
            toast.success(
                hadReferral
                    ? "🎉 Welcome to FoodKnock! Referral applied — bonus points arrive after your first delivery."
                    : "🎉 Welcome to FoodKnock! Your account is ready.",
                {
                    duration: 2600,
                    style: {
                        background: "#fff", color: "#1c1917",
                        border: "1.5px solid #fed7aa", borderRadius: "16px",
                        fontWeight: "700", fontSize: "13px",
                        boxShadow: "0 8px 32px rgba(249,115,22,0.18)",
                    },
                    iconTheme: { primary: "#f97316", secondary: "#fff" },
                }
            );

            setForm(INITIAL);
            setTimeout(() => { window.location.href = "/"; }, 150);
        } catch {
            toast.error("Something went wrong. Please check your connection and try again.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">

            {/* ── Personal Info ─────────────────────────────────────── */}
            <SectionHead emoji="👤" title="Personal Info" />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field
                    id="reg-name" label="Full Name" value={form.name} onChange={set("name")}
                    placeholder="Your full name" autoComplete="name"
                    icon={<User size={14} strokeWidth={2} />}
                    required colSpan error={fieldErrors.name}
                />
                <Field
                    id="reg-phone" label="Phone" type="tel" value={form.phone} onChange={set("phone")}
                    placeholder="+91 98765 43210" autoComplete="tel"
                    icon={<Phone size={14} strokeWidth={2} />}
                    required error={fieldErrors.phone}
                />
                <Field
                    id="reg-dob" label="Date of Birth" type="date" value={form.dob} onChange={set("dob")}
                    placeholder="" autoComplete="bday"
                    icon={<Calendar size={14} strokeWidth={2} />}
                    optional
                />
            </div>

            {/* ── Account ───────────────────────────────────────────── */}
            <SectionHead emoji="🔐" title="Account" />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field
                    id="reg-email" label="Email" type="email" value={form.email} onChange={set("email")}
                    placeholder="you@example.com" autoComplete="email"
                    icon={<Mail size={14} strokeWidth={2} />}
                    required colSpan error={fieldErrors.email}
                />

                {/* Password with strength meter */}
                <div className="flex flex-col gap-1.5 sm:col-span-2">
                    <label
                        htmlFor="reg-password"
                        className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-[0.18em] text-stone-500"
                    >
                        Password <span className="text-orange-500">*</span>
                    </label>
                    <div className="relative flex items-center">
                        <span className={`pointer-events-none absolute left-3.5 ${fieldErrors.password ? "text-red-400" : "text-stone-400"}`}>
                            <Lock size={14} strokeWidth={2} />
                        </span>
                        <input
                            id="reg-password"
                            type={showPass ? "text" : "password"}
                            value={form.password}
                            onChange={(e) => set("password")(e.target.value)}
                            placeholder="Create a strong password"
                            autoComplete="new-password"
                            aria-invalid={!!fieldErrors.password}
                            className={`w-full rounded-xl border ${
                                fieldErrors.password
                                    ? "border-red-300 bg-red-50/50 focus:border-red-400 focus:ring-red-100"
                                    : "border-amber-200 bg-amber-50/50 focus:border-orange-400 focus:ring-orange-100"
                            } py-2.5 pl-10 pr-10 text-sm font-medium text-stone-800 placeholder:text-stone-400 transition-all focus:bg-white focus:outline-none focus:ring-2`}
                        />
                        <button
                            type="button"
                            onClick={() => setShowPass(p => !p)}
                            aria-label={showPass ? "Hide password" : "Show password"}
                            className="absolute right-3.5 text-stone-400 transition-colors hover:text-orange-500 focus:outline-none"
                        >
                            {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                    </div>
                    {form.password.length > 0 && (
                        <div className="mt-0.5 flex items-center gap-2">
                            <div className="flex flex-1 gap-1">
                                {[1, 2, 3].map(i => (
                                    <div
                                        key={i}
                                        className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${i <= strength ? strengthColor : "bg-stone-100"}`}
                                    />
                                ))}
                            </div>
                            <span className={`text-[10px] font-black ${strength === 1 ? "text-red-500" : strength === 2 ? "text-amber-500" : "text-green-600"}`}>
                                {strengthLabel}
                            </span>
                        </div>
                    )}
                    {fieldErrors.password && (
                        <p className="flex items-center gap-1 text-[11px] font-bold text-red-500">
                            <XCircle size={11} className="shrink-0" /> {fieldErrors.password}
                        </p>
                    )}
                </div>

                {/* ── Referral code card ── */}
                <div className="sm:col-span-2">
                    <div className="rounded-xl border border-amber-100 bg-gradient-to-br from-amber-50/80 to-orange-50/50 p-4">
                        <div className="mb-2 flex items-center gap-2">
                            <Gift size={13} className="shrink-0 text-orange-500" />
                            <span className="text-[11px] font-black uppercase tracking-[0.16em] text-orange-600">
                                Have a referral code?
                            </span>
                            <span className="ml-auto rounded-full bg-gradient-to-r from-amber-100 to-orange-100 px-2.5 py-0.5 text-[10px] font-black text-amber-700 border border-amber-200">
                                +25 pts for you
                            </span>
                        </div>
                        <p className="mb-3 text-[11px] leading-relaxed text-stone-500">
                            A friend's code gives you both bonus loyalty points after your first delivered order.
                        </p>
                        <Field
                            id="reg-referral"
                            label="Referral Code"
                            value={form.referralCode}
                            onChange={(v) => set("referralCode")(v.toUpperCase().replace(/\s/g, ""))}
                            placeholder="e.g. RAM3KX2A"
                            autoComplete="off"
                            icon={<Gift size={14} strokeWidth={2} />}
                            optional
                            error={fieldErrors.referralCode}
                            hint="8-character code from your friend's Rewards page."
                        />
                    </div>
                </div>
            </div>

            {/* ── Delivery Address ──────────────────────────────────── */}
            <SectionHead emoji="📍" title="Delivery Address" />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field
                    id="reg-addr1" label="Address Line 1" value={form.addressLine1} onChange={set("addressLine1")}
                    placeholder="House / Flat / Building No." autoComplete="address-line1"
                    icon={<MapPin size={14} strokeWidth={2} />} required colSpan error={fieldErrors.addressLine1}
                />
                <Field
                    id="reg-addr2" label="Address Line 2" value={form.addressLine2} onChange={set("addressLine2")}
                    placeholder="Street / Colony / Area" autoComplete="address-line2"
                    icon={<MapPin size={14} strokeWidth={2} />} optional colSpan
                />
                <Field
                    id="reg-landmark" label="Landmark" value={form.landmark} onChange={set("landmark")}
                    placeholder="Near temple, school..." autoComplete="off"
                    icon={<Navigation size={14} strokeWidth={2} />} optional colSpan
                />
                <Field
                    id="reg-city" label="City" value={form.city} onChange={set("city")}
                    placeholder="City" autoComplete="address-level2"
                    icon={<Building2 size={14} strokeWidth={2} />} required error={fieldErrors.city}
                />
                <Field
                    id="reg-state" label="State" value={form.state} onChange={set("state")}
                    placeholder="State" autoComplete="address-level1"
                    icon={<Building2 size={14} strokeWidth={2} />} required error={fieldErrors.state}
                />
                <Field
                    id="reg-pincode" label="Pincode" value={form.pincode} onChange={set("pincode")}
                    placeholder="000000" autoComplete="postal-code"
                    icon={<Hash size={14} strokeWidth={2} />} required error={fieldErrors.pincode}
                />
            </div>

            {/* ── Submit ─────────────────────────────────────────────── */}
            <button
                type="submit"
                disabled={loading}
                className="group mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 py-3.5 text-sm font-black text-white shadow-lg shadow-orange-200/70 transition-all duration-300 hover:brightness-110 hover:shadow-orange-300 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
            >
                {loading
                    ? <><Loader2 size={16} className="animate-spin" /> Creating your account...</>
                    : <>Create My Account 🎉 <ArrowRight size={15} className="transition-transform duration-300 group-hover:translate-x-1" /></>
                }
            </button>

            <p className="text-center text-[11px] font-medium text-stone-400">
                Join <span className="font-black text-orange-500">2,450+</span> customers already ordering with FoodKnock.
            </p>
        </form>
    );
}