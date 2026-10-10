"use client";

// src/components/auth/LoginForm.tsx
// Premium login form — FoodKnock
// - Inline field-level error states
// - Friendly error messages
// - No phone numbers
// - Shows remaining attempts and lock/block countdowns from the new
//   login brute-force protection, reusing the existing visual style.

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "react-hot-toast";
import { Mail, Lock, Eye, EyeOff, ArrowRight, Loader2, XCircle } from "lucide-react";
import { markAuthenticatedOnThisDevice } from "@/lib/authDeviceMemory";

type LoginFormProps = {
    redirectTo?: string;
    onForgotPassword?: () => void;
    onSwitchToRegister: () => void;
};

// Only ever treat a same-origin, relative path as a valid post-login
// destination. `redirect` is a client-controllable query param — without
// this guard, a crafted link like /auth?redirect=https://evil.example
// would make a successful login hand the browser straight to
// `window.location.href = dest` pointed at an external site (open
// redirect / phishing vector). "//evil.example" is also rejected since
// browsers treat a protocol-relative URL as external too.
function isSafeInternalPath(path: string | null | undefined): path is string {
    return (
        typeof path === "string" &&
        path.startsWith("/") &&
        !path.startsWith("//") &&
        !path.includes("://")
    );
}
type FieldErrors = { email?: string; password?: string };

// ── Field component ──────────────────────────────────────────────────────
type FieldProps = {
    id: string;
    label: string;
    type: string;
    value: string;
    onChange: (v: string) => void;
    placeholder: string;
    autoComplete?: string;
    icon: React.ReactNode;
    rightEl?: React.ReactNode;
    required?: boolean;
    error?: string;
};

function Field({
    id, label, type, value, onChange, placeholder,
    autoComplete, icon, rightEl, required, error,
}: FieldProps) {
    return (
        <div className="flex flex-col gap-1.5">
            <label htmlFor={id} className="flex items-center gap-1 text-[11px] font-black uppercase tracking-[0.18em] text-stone-500">
                {label}
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
                    aria-describedby={error ? `${id}-error` : undefined}
                    className={`w-full rounded-xl border ${error
                            ? "border-red-300 bg-red-50/50 focus:border-red-400 focus:ring-red-100"
                            : "border-amber-200 bg-amber-50/50 focus:border-orange-400 focus:ring-orange-100"
                        } py-3 pl-10 pr-10 text-sm font-medium text-stone-800 placeholder:text-stone-400 transition-all duration-200 hover:border-amber-300 focus:bg-white focus:outline-none focus:ring-2`}
                />
                {rightEl && <span className="absolute right-3.5">{rightEl}</span>}
            </div>
            {error && (
                <p id={`${id}-error`} className="flex items-center gap-1 text-[11px] font-bold text-red-500">
                    <XCircle size={11} className="shrink-0" />
                    {error}
                </p>
            )}
        </div>
    );
}

// ── LoginForm ────────────────────────────────────────────────────────────
export default function LoginForm({ redirectTo = "/", onForgotPassword, onSwitchToRegister }: LoginFormProps) {
    const searchParams = useSearchParams();

    const [email,       setEmail]       = useState("");
    const [password,    setPassword]    = useState("");
    const [showPass,    setShowPass]    = useState(false);
    const [loading,     setLoading]     = useState(false);
    const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
    const [lockedUntilMs, setLockedUntilMs] = useState<number | null>(null);
    const [lockSecondsLeft, setLockSecondsLeft] = useState(0);

    useEffect(() => {
        if (!lockedUntilMs) {
            setLockSecondsLeft(0);
            return;
        }
        const tick = () => {
            const secondsLeft = Math.max(0, Math.ceil((lockedUntilMs - Date.now()) / 1000));
            setLockSecondsLeft(secondsLeft);
            if (secondsLeft <= 0) setLockedUntilMs(null);
        };
        tick();
        const timer = setInterval(tick, 1000);
        return () => clearInterval(timer);
    }, [lockedUntilMs]);

    const clearError = (key: keyof FieldErrors) =>
        setFieldErrors((prev) => { const n = { ...prev }; delete n[key]; return n; });

    const validate = (): boolean => {
        const errs: FieldErrors = {};
        if (!email.trim()) {
            errs.email = "Email address is required.";
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
            errs.email = "Please enter a valid email address.";
        }
        if (!password) {
            errs.password = "Password is required.";
        }
        setFieldErrors(errs);
        return Object.keys(errs).length === 0;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!validate()) return;

        setLoading(true);

        try {
            const res = await fetch("/api/auth/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: email.trim(), password }),
            });
            const data = await res.json();

            if (!res.ok) {
                if (res.status === 401) {
                    const attemptsRemaining: number | undefined = data.attemptsRemaining;
                    const passwordMessage =
                        typeof attemptsRemaining === "number"
                            ? `Incorrect email or password. ${attemptsRemaining} attempt(s) remaining.`
                            : data.message || "Incorrect email or password. Please try again.";

                    setFieldErrors({
                        email:    " ",
                        password: passwordMessage,
                    });
                } else if (res.status === 429) {
                    // Email-locked or IP-blocked — never compare/leak password
                    // state here; show the server's lock/block message inline
                    // on the password field, exactly like the 401 case.
                    setFieldErrors({
                        email:    " ",
                        password: data.message || "Too many attempts. Please try again later.",
                    });
                    if (typeof data.lockedMinutesRemaining === "number") {
                        setLockedUntilMs(Date.now() + data.lockedMinutesRemaining * 60 * 1000);
                    }
                    toast.error(data.message || "Too many attempts. Please try again later.", {
                        duration: 6000,
                        style: { border: "1.5px solid #fca5a5", borderRadius: "14px", fontWeight: "700", fontSize: "13px" },
                    });
                } else if (res.status === 403) {
                    toast.error(data.message || "Your account has been suspended. Contact support.", {
                        duration: 5000,
                        style: { border: "1.5px solid #fca5a5", borderRadius: "14px", fontWeight: "700", fontSize: "13px" },
                    });
                } else {
                    toast.error(data.message || "Login failed. Please try again.");
                }
                return;
            }

            try {
                if (data?.user) {
                    localStorage.setItem("cafeapp_user", JSON.stringify({
                        name: data.user.name ?? "",
                        email: data.user.email ?? "",
                        phone: data.user.phone ?? "",
                        address: data.user.address ?? "",
                    }));
                }
            } catch { /* storage might be unavailable */ }

            // AUTH 2.0 — UX-only device marker, set ONLY here (the server
            // has already confirmed a successful login) — never bypasses
            // or substitutes for this real auth check. See
            // src/lib/authDeviceMemory.ts for the full security boundary.
            markAuthenticatedOnThisDevice();

            toast.success("Welcome back! 🍔 Redirecting...", {
                duration: 2200,
                style: {
                    background: "#fff", color: "#1c1917",
                    border: "1.5px solid #fed7aa", borderRadius: "16px",
                    fontWeight: "700", fontSize: "13px",
                    boxShadow: "0 8px 24px rgba(249,115,22,0.15)",
                },
                iconTheme: { primary: "#f97316", secondary: "#fff" },
            });

            const role = data.user?.role ?? "user";
            const qParam = searchParams.get("redirect");
            const rawIntended = qParam || redirectTo;
            const intended = isSafeInternalPath(rawIntended) ? rawIntended : "/";

            let dest = "/";
            if (role === "admin") {
                dest = intended.startsWith("/admin") ? intended : "/admin";
            } else {
                dest = intended !== "/" && !intended.startsWith("/admin") && !intended.startsWith("/auth")
                    ? intended : "/";
            }

            setTimeout(() => { window.location.href = dest; }, 150);
        } catch {
            toast.error("Something went wrong. Please check your connection and try again.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">

            <Field
                id="login-email"
                label="Email Address"
                type="email"
                value={email}
                onChange={(v) => { setEmail(v); clearError("email"); }}
                placeholder="you@example.com"
                autoComplete="email"
                icon={<Mail size={15} strokeWidth={2} />}
                required
                error={fieldErrors.email === " " ? undefined : fieldErrors.email}
            />

            <Field
                id="login-password"
                label="Password"
                type={showPass ? "text" : "password"}
                value={password}
                onChange={(v) => { setPassword(v); clearError("password"); }}
                placeholder="Enter your password"
                autoComplete="current-password"
                icon={<Lock size={15} strokeWidth={2} />}
                rightEl={
                    <button
                        type="button"
                        onClick={() => setShowPass((p) => !p)}
                        aria-label={showPass ? "Hide password" : "Show password"}
                        className="text-stone-400 transition-colors hover:text-orange-500 focus:outline-none"
                    >
                        {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                }
                required
                error={fieldErrors.password}
            />

            {onForgotPassword && (
                <button
                    type="button"
                    onClick={onForgotPassword}
                    className="-mt-1 self-end text-[12px] font-bold text-orange-600 transition-colors hover:text-orange-700"
                >
                    Forgot password?
                </button>
            )}

            <button
                type="submit"
                disabled={loading || lockSecondsLeft > 0}
                className="group mt-1 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 py-3.5 text-sm font-black text-white shadow-lg shadow-orange-200/70 transition-all duration-300 hover:brightness-110 hover:shadow-orange-300 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
            >
                {loading ? (
                    <><Loader2 size={16} className="animate-spin" /> Signing you in...</>
                ) : lockSecondsLeft > 0 ? (
                    <>Try again in {Math.floor(lockSecondsLeft / 60)}m {lockSecondsLeft % 60}s</>
                ) : (
                    <>Sign In to Your Account <ArrowRight size={15} className="transition-transform duration-300 group-hover:translate-x-1" /></>
                )}
            </button>

            <p className="text-center text-[12.5px] font-medium text-stone-500">
                Don&apos;t have an account?{" "}
                <button
                    type="button"
                    onClick={onSwitchToRegister}
                    className="font-black text-orange-600 transition-colors hover:text-orange-700"
                >
                    Create Account
                </button>
            </p>
        </form>
    );
}