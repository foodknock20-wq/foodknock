"use client";

// src/components/auth/VerifyOtpForm.tsx
// Forgot Password — Step 2: enter + verify the 6-digit OTP — FoodKnock
// - Resend OTP with a 60s countdown (matches backend's resend cooldown)
// - Auto-submits once all 6 digits are entered
// - Clear, friendly error states (wrong code, expired, locked out)
//
// UI-ONLY ADDITION: a small amber "check your inbox / spam" info card
// shown right below the "code sent to email" text — purely presentational,
// no change to any API call, timer, or verification logic.

import { useState, useEffect, useCallback, useRef } from "react";
import { toast } from "react-hot-toast";
import { ArrowLeft, Loader2, XCircle, ShieldCheck, RefreshCw, Mail } from "lucide-react";
import OtpInput from "./OtpInput";

const RESEND_COOLDOWN_SECONDS = 60;

type VerifyOtpFormProps = {
    email: string;
    onVerified: (resetToken: string) => void;
    onBackToLogin: () => void;
};

export default function VerifyOtpForm({ email, onVerified, onBackToLogin }: VerifyOtpFormProps) {
    const [otp, setOtp] = useState("");
    const [error, setError] = useState<string | undefined>(undefined);
    const [verifying, setVerifying] = useState(false);
    const [resending, setResending] = useState(false);
    const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_SECONDS);

    // Tracks whether the current 6-digit value has already been
    // auto-submitted, so we don't re-trigger verification on every
    // re-render once a verify attempt is in flight or has failed.
    const autoSubmittedRef = useRef<string | null>(null);

    useEffect(() => {
        if (cooldown <= 0) return;
        const timer = setInterval(() => {
            setCooldown((c) => (c > 0 ? c - 1 : 0));
        }, 1000);
        return () => clearInterval(timer);
    }, [cooldown]);

    const verifyOtp = useCallback(
        async (code: string) => {
            setVerifying(true);
            setError(undefined);

            try {
                const res = await fetch("/api/auth/verify-otp", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ email, otp: code }),
                });
                const data = await res.json();

                if (!res.ok) {
                    setError(data.message || "Incorrect code. Please try again.");
                    setOtp("");
                    autoSubmittedRef.current = null;
                    return;
                }

                toast.success("Code verified! ✅", {
                    duration: 1800,
                    style: {
                        background: "#fff", color: "#1c1917",
                        border: "1.5px solid #fed7aa", borderRadius: "16px",
                        fontWeight: "700", fontSize: "13px",
                    },
                    iconTheme: { primary: "#f97316", secondary: "#fff" },
                });

                onVerified(data.resetToken);
            } catch {
                setError("Something went wrong. Please check your connection and try again.");
                autoSubmittedRef.current = null;
            } finally {
                setVerifying(false);
            }
        },
        [email, onVerified]
    );

    // Auto-submit once all 6 digits are present.
    useEffect(() => {
        if (otp.length === 6 && autoSubmittedRef.current !== otp && !verifying) {
            autoSubmittedRef.current = otp;
            verifyOtp(otp);
        }
    }, [otp, verifying, verifyOtp]);

    const handleResend = async () => {
        if (cooldown > 0 || resending) return;

        setResending(true);
        setError(undefined);

        try {
            const res = await fetch("/api/auth/forgot-password", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email }),
            });
            const data = await res.json();

            if (!res.ok) {
                toast.error(data.message || "Couldn't resend the code. Please try again.", {
                    style: { border: "1.5px solid #fca5a5", borderRadius: "14px", fontWeight: "700", fontSize: "13px" },
                });
                return;
            }

            toast.success("A new code is on its way! 📩", {
                duration: 2200,
                style: {
                    background: "#fff", color: "#1c1917",
                    border: "1.5px solid #fed7aa", borderRadius: "16px",
                    fontWeight: "700", fontSize: "13px",
                },
                iconTheme: { primary: "#f97316", secondary: "#fff" },
            });

            setOtp("");
            autoSubmittedRef.current = null;
            setCooldown(RESEND_COOLDOWN_SECONDS);
        } catch {
            toast.error("Something went wrong. Please check your connection and try again.");
        } finally {
            setResending(false);
        }
    };

    return (
        <div className="flex flex-col gap-4">
            <button
                type="button"
                onClick={onBackToLogin}
                className="group inline-flex w-fit items-center gap-1.5 text-xs font-bold text-stone-500 transition-colors hover:text-orange-600"
            >
                <ArrowLeft size={13} className="transition-transform group-hover:-translate-x-0.5" />
                Back to Sign In
            </button>

            <div className="flex flex-col items-center gap-2 pb-1 pt-2 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-100 to-amber-100 shadow-inner">
                    <ShieldCheck size={24} className="text-orange-500" strokeWidth={2} />
                </div>
                <h3 className="text-lg font-black text-stone-900">Enter verification code</h3>
                <p className="max-w-[320px] text-[13px] leading-relaxed text-stone-500">
                    We sent a 6-digit code to <span className="font-bold text-stone-700">{email}</span>
                </p>
            </div>

            {/* ── UI-ONLY: friendly "check inbox / spam" info card ── */}
            <div className="flex items-start gap-2.5 rounded-2xl border border-amber-200 bg-amber-50/80 px-3.5 py-3 sm:px-4">
                <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-amber-100">
                    <Mail size={13} className="text-amber-600" strokeWidth={2.2} />
                </div>
                <p className="text-[11.5px] font-medium leading-relaxed text-amber-800">
                    📩 Please wait up to 1 minute for the email to arrive.
                    If you don&apos;t see it, please check your{" "}
                    <span className="font-bold">Spam, Promotions, or Updates</span> folder
                    before requesting another email.
                </p>
            </div>

            <div className="flex flex-col items-center gap-3">
                <OtpInput
                    value={otp}
                    onChange={(v) => { setOtp(v); setError(undefined); }}
                    disabled={verifying}
                    error={!!error}
                />

                {error && (
                    <p className="flex items-center gap-1 text-[12px] font-bold text-red-500" role="alert">
                        <XCircle size={12} className="shrink-0" />
                        {error}
                    </p>
                )}

                {verifying && (
                    <p className="flex items-center gap-1.5 text-[12px] font-bold text-stone-400">
                        <Loader2 size={13} className="animate-spin" />
                        Verifying...
                    </p>
                )}
            </div>

            <div className="flex flex-col items-center gap-1 pt-1">
                <button
                    type="button"
                    onClick={handleResend}
                    disabled={cooldown > 0 || resending}
                    className="inline-flex items-center gap-1.5 text-[12.5px] font-bold text-orange-600 transition-colors hover:text-orange-700 disabled:cursor-not-allowed disabled:text-stone-400"
                >
                    {resending ? (
                        <><Loader2 size={13} className="animate-spin" /> Resending...</>
                    ) : (
                        <><RefreshCw size={13} /> Resend code</>
                    )}
                </button>
                {cooldown > 0 && (
                    <p className="text-[11px] text-stone-400">
                        You can request a new code in{" "}
                        <span className="font-bold text-stone-500">{cooldown}s</span>
                    </p>
                )}
            </div>
        </div>
    );
}