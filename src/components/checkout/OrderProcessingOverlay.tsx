"use client";

// src/components/checkout/OrderProcessingOverlay.tsx
//
// Full-screen blocking overlay shown while an order is being placed.
// • Prevents any user interaction (pointer-events: none on page, all on overlay)
// • Shows animated steps cycling through: validating → placing → confirming
// • Matches FoodKnock brand (orange/red gradient, stone backgrounds)
// • Zero external dependencies — pure Tailwind + inline CSS animations

import { useEffect, useState } from "react";
import { ShieldCheck, Loader2, ChefHat, CheckCircle2, Lock } from "lucide-react";

type OverlayVariant = "cod" | "razorpay";

interface OrderProcessingOverlayProps {
    visible:  boolean;
    variant?: OverlayVariant;
}

const STEPS_COD = [
    { icon: ShieldCheck, label: "Validating your order…",   sub: "Checking stock & details"          },
    { icon: ChefHat,     label: "Placing your order…",      sub: "Sending to our kitchen"            },
    { icon: CheckCircle2,label: "Almost there…",            sub: "Finalising your confirmation"      },
];

const STEPS_RAZORPAY = [
    { icon: Lock,         label: "Verifying payment…",       sub: "Confirming with Razorpay"          },
    { icon: ShieldCheck,  label: "Securing your order…",     sub: "Checking stock & details"          },
    { icon: ChefHat,      label: "Placing your order…",      sub: "Sending to our kitchen"            },
];

// ── Orbiting dots animation (CSS keyframes injected once) ─────────────────────
const KEYFRAMES = `
@keyframes fk-spin-ring {
    0%   { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
}
@keyframes fk-spin-ring-reverse {
    0%   { transform: rotate(0deg); }
    100% { transform: rotate(-360deg); }
}
@keyframes fk-pulse-logo {
    0%, 100% { transform: scale(1);    opacity: 1;    }
    50%       { transform: scale(1.08); opacity: 0.85; }
}
@keyframes fk-fade-up {
    0%   { opacity: 0; transform: translateY(8px); }
    100% { opacity: 1; transform: translateY(0);   }
}
@keyframes fk-overlay-in {
    0%   { opacity: 0; }
    100% { opacity: 1; }
}
@keyframes fk-dot-bounce {
    0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
    40%           { transform: scale(1);   opacity: 1;   }
}
`;

let keyframesInjected = false;

function injectKeyframes() {
    if (keyframesInjected || typeof document === "undefined") return;
    const style = document.createElement("style");
    style.textContent = KEYFRAMES;
    document.head.appendChild(style);
    keyframesInjected = true;
}

// ── Orbital ring ──────────────────────────────────────────────────────────────
function OrbitalRing({
    radius,
    duration,
    reverse = false,
    dotColor,
    dotSize = 8,
    opacity = 1,
}: {
    radius:   number;
    duration: number;
    reverse?: boolean;
    dotColor: string;
    dotSize?: number;
    opacity?: number;
}) {
    const size = radius * 2 + dotSize;
    return (
        <div
            style={{
                position:  "absolute",
                width:     size,
                height:    size,
                top:       "50%",
                left:      "50%",
                marginTop: -size / 2,
                marginLeft:-size / 2,
                animation: `${reverse ? "fk-spin-ring-reverse" : "fk-spin-ring"} ${duration}s linear infinite`,
                opacity,
            }}
        >
            {/* single dot at top */}
            <div
                style={{
                    position:     "absolute",
                    width:        dotSize,
                    height:       dotSize,
                    borderRadius: "50%",
                    background:   dotColor,
                    top:          0,
                    left:         "50%",
                    marginLeft:   -dotSize / 2,
                    boxShadow:    `0 0 ${dotSize * 1.5}px ${dotColor}`,
                }}
            />
        </div>
    );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function OrderProcessingOverlay({
    visible,
    variant = "cod",
}: OrderProcessingOverlayProps) {
    const [mounted,   setMounted]   = useState(false);
    const [stepIndex, setStepIndex] = useState(0);
    const [stepAnim,  setStepAnim]  = useState(true);

    const steps = variant === "razorpay" ? STEPS_RAZORPAY : STEPS_COD;

    useEffect(() => { injectKeyframes(); }, []);

    // Fade-in after mount (avoids SSR flash)
    useEffect(() => {
        if (visible) {
            const t = setTimeout(() => setMounted(true), 10);
            return () => clearTimeout(t);
        } else {
            setMounted(false);
            setStepIndex(0);
        }
    }, [visible]);

    // Cycle through steps
    useEffect(() => {
        if (!visible) return;
        setStepIndex(0);
        setStepAnim(true);

        const interval = setInterval(() => {
            setStepAnim(false);
            setTimeout(() => {
                setStepIndex((i) => (i + 1) % steps.length);
                setStepAnim(true);
            }, 200);
        }, 2200);

        return () => clearInterval(interval);
    }, [visible, steps.length]);

    if (!visible) return null;

    const currentStep = steps[stepIndex];
    const StepIcon    = currentStep.icon;

    const isCod = variant === "cod";

    return (
        <div
            aria-modal="true"
            aria-label="Processing your order"
            role="dialog"
            style={{
                position:        "fixed",
                inset:           0,
                zIndex:          9999,
                display:         "flex",
                alignItems:      "center",
                justifyContent:  "center",
                background:      "rgba(12, 10, 9, 0.82)",
                backdropFilter:  "blur(12px)",
                WebkitBackdropFilter: "blur(12px)",
                animation:       mounted ? "fk-overlay-in 0.25s ease forwards" : "none",
                opacity:         mounted ? 1 : 0,
            }}
        >
            {/* Card */}
            <div
                style={{
                    background:   "linear-gradient(145deg, #ffffff 0%, #fafaf9 100%)",
                    borderRadius: 28,
                    padding:      "40px 36px 36px",
                    maxWidth:     340,
                    width:        "90%",
                    textAlign:    "center",
                    boxShadow:    "0 32px 80px rgba(0,0,0,0.3), 0 0 0 1px rgba(255,255,255,0.08)",
                    position:     "relative",
                    overflow:     "hidden",
                }}
            >
                {/* Subtle top gradient stripe */}
                <div style={{
                    position:   "absolute",
                    top:        0,
                    left:       0,
                    right:      0,
                    height:     3,
                    background: isCod
                        ? "linear-gradient(90deg, #10b981, #059669)"
                        : "linear-gradient(90deg, #f97316, #ef4444)",
                    borderRadius: "28px 28px 0 0",
                }} />

                {/* Orbital animation hub */}
                <div style={{ position: "relative", width: 100, height: 100, margin: "0 auto 28px" }}>
                    {/* Rings */}
                    <OrbitalRing
                        radius={46}
                        duration={3.2}
                        dotColor={isCod ? "#10b981" : "#f97316"}
                        dotSize={9}
                    />
                    <OrbitalRing
                        radius={36}
                        duration={2.4}
                        reverse
                        dotColor={isCod ? "#059669" : "#ef4444"}
                        dotSize={7}
                        opacity={0.7}
                    />
                    <OrbitalRing
                        radius={26}
                        duration={1.8}
                        dotColor={isCod ? "#34d399" : "#fb923c"}
                        dotSize={5}
                        opacity={0.5}
                    />

                    {/* Centre logo disc */}
                    <div style={{
                        position:        "absolute",
                        top:             "50%",
                        left:            "50%",
                        transform:       "translate(-50%, -50%)",
                        width:           48,
                        height:          48,
                        borderRadius:    "50%",
                        background:      isCod
                            ? "linear-gradient(135deg, #10b981, #059669)"
                            : "linear-gradient(135deg, #f97316, #ef4444)",
                        display:         "flex",
                        alignItems:      "center",
                        justifyContent:  "center",
                        boxShadow:       isCod
                            ? "0 0 0 8px rgba(16,185,129,0.12), 0 4px 16px rgba(16,185,129,0.35)"
                            : "0 0 0 8px rgba(249,115,22,0.12), 0 4px 16px rgba(249,115,22,0.35)",
                        animation:       "fk-pulse-logo 2s ease-in-out infinite",
                    }}>
                        <span style={{ fontSize: 22, lineHeight: 1 }}>🍽️</span>
                    </div>
                </div>

                {/* Step label (animated) */}
                <div style={{
                    minHeight:  64,
                    display:    "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap:        6,
                }}>
                    <div style={{
                        display:    "flex",
                        alignItems: "center",
                        gap:        8,
                        animation:  stepAnim ? "fk-fade-up 0.25s ease forwards" : "none",
                        opacity:    stepAnim ? 1 : 0,
                    }}>
                        <StepIcon
                            size={16}
                            strokeWidth={2.5}
                            style={{ color: isCod ? "#059669" : "#f97316", flexShrink: 0 }}
                        />
                        <p style={{
                            fontSize:   15,
                            fontWeight: 900,
                            color:      "#1c1917",
                            margin:     0,
                            letterSpacing: "-0.01em",
                        }}>
                            {currentStep.label}
                        </p>
                    </div>
                    <p style={{
                        fontSize:   12,
                        color:      "#78716c",
                        margin:     0,
                        fontWeight: 500,
                        animation:  stepAnim ? "fk-fade-up 0.3s ease 0.05s forwards" : "none",
                        opacity:    stepAnim ? 1 : 0,
                    }}>
                        {currentStep.sub}
                    </p>
                </div>

                {/* Step dots */}
                <div style={{
                    display:        "flex",
                    justifyContent: "center",
                    gap:            6,
                    marginTop:      20,
                    marginBottom:   22,
                }}>
                    {steps.map((_, i) => (
                        <div
                            key={i}
                            style={{
                                width:        i === stepIndex ? 20 : 6,
                                height:       6,
                                borderRadius: 3,
                                background:   i === stepIndex
                                    ? (isCod ? "#10b981" : "#f97316")
                                    : "#e7e5e4",
                                transition:   "all 0.3s ease",
                            }}
                        />
                    ))}
                </div>

                {/* Warning strip */}
                <div style={{
                    background:   isCod ? "#f0fdf4" : "#fff7ed",
                    border:       `1px solid ${isCod ? "#bbf7d0" : "#fed7aa"}`,
                    borderRadius: 14,
                    padding:      "10px 14px",
                    display:      "flex",
                    alignItems:   "flex-start",
                    gap:          8,
                    textAlign:    "left",
                }}>
                    <span style={{ fontSize: 14, flexShrink: 0, marginTop: 1 }}>⚠️</span>
                    <div>
                        <p style={{
                            fontSize:   12,
                            fontWeight: 800,
                            color:      isCod ? "#065f46" : "#9a3412",
                            margin:     "0 0 2px",
                        }}>
                            Please don't go back or close the app
                        </p>
                        <p style={{
                            fontSize:   11,
                            color:      isCod ? "#047857" : "#c2410c",
                            margin:     0,
                            fontWeight: 500,
                            lineHeight: 1.4,
                        }}>
                            Your order is being placed. Leaving now may cause a failed order.
                        </p>
                    </div>
                </div>

                {/* FoodKnock brand footer */}
                <p style={{
                    marginTop:  18,
                    fontSize:   11,
                    color:      "#a8a29e",
                    fontWeight: 700,
                }}>
                    Powered by <span style={{ color: "#f97316" }}>FoodKnock</span> 🧡
                </p>
            </div>
        </div>
    );
}