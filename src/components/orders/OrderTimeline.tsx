// src/components/orders/OrderTimeline.tsx
// Updated to use light warm theme colours matching the rest of the site.
// All logic preserved exactly — only colour tokens changed from dark to light.

import {
    CheckCircle2, Circle, Clock,
    ChefHat, Truck, PartyPopper, XCircle,
} from "lucide-react";

type OrderStatus = "received" | "preparing" | "out_for_delivery" | "delivered";

type Step = {
    status: OrderStatus;
    label: string;
    description: string;
    icon: React.ElementType;
};

const ALL_STEPS: Step[] = [
    {
        status: "received",
        label: "Order Received",
        description: "Your order has been placed successfully",
        icon: Clock,
    },
    {
        status: "preparing",
        label: "Preparing",
        description: "Our chef is preparing your order fresh",
        icon: ChefHat,
    },
    {
        status: "out_for_delivery",
        label: "Out for Delivery",
        description: "Your order is on the way!",
        icon: Truck,
    },
    {
        status: "delivered",
        label: "Delivered",
        description: "Enjoy your meal! 🎉",
        icon: PartyPopper,
    },
];

const STATUS_INDEX: Record<OrderStatus, number> = {
    received: 0,
    preparing: 1,
    out_for_delivery: 2,
    delivered: 3,
};

type Props = {
    status: string;
    orderType?: string;
    createdAt?: string;
};

export default function OrderTimeline({ status, orderType, createdAt }: Props) {
    if (status === "cancelled") {
        return (
            <div className="flex flex-col items-center rounded-fk-lg border border-fk-danger/25 bg-fk-danger/5 p-8 text-center">
                <XCircle size={44} className="text-fk-danger" strokeWidth={1.5} />
                <p className="mt-4 text-xl font-black text-fk-text">Order Cancelled</p>
                <p className="mt-2 text-sm text-fk-text-secondary">
                    This order has been cancelled. Contact us if you need help.
                </p>
            </div>
        );
    }

    const steps = orderType === "pickup"
        ? ALL_STEPS.filter((s) => s.status !== "out_for_delivery")
        : ALL_STEPS;

    const currentIndex = STATUS_INDEX[status as OrderStatus] ?? 0;

    return (
        <div className="space-y-0">
            {steps.map((step, i) => {
                const stepIndex = STATUS_INDEX[step.status];
                const isCompleted = currentIndex > stepIndex;
                const isActive    = currentIndex === stepIndex;
                const isLast      = i === steps.length - 1;

                return (
                    <div key={step.status} className="flex gap-4">
                        {/* Icon + connector */}
                        <div className="flex flex-col items-center">
                            <div
                                className={`relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 transition-all ${
                                    isCompleted
                                        ? "border-fk-success/40 bg-fk-success/10"
                                        : isActive
                                        ? "border-[var(--fk-accent)]/50 bg-fk-surface-selected"
                                        : "border-fk-border bg-fk-surface-interactive"
                                }`}
                            >
                                {isCompleted ? (
                                    <CheckCircle2 size={16} className="text-fk-success" strokeWidth={2.5} />
                                ) : isActive ? (
                                    <step.icon size={16} className="text-[var(--fk-accent)]" strokeWidth={2} />
                                ) : (
                                    <Circle size={16} className="text-fk-text-tertiary" strokeWidth={2} />
                                )}

                                {/* Pulse ring on active step */}
                                {isActive && (
                                    <span className="absolute -inset-1 animate-ping rounded-full border-2 border-[var(--fk-accent)]/30 motion-reduce:animate-none" />
                                )}
                            </div>

                            {!isLast && (
                                <div
                                    className={`mt-1 w-0.5 min-h-[28px] flex-1 rounded-full transition-colors ${
                                        isCompleted ? "bg-fk-success/40" : "bg-fk-border"
                                    }`}
                                />
                            )}
                        </div>

                        {/* Text */}
                        <div className={`pb-7 pt-1 ${isLast ? "pb-0" : ""}`}>
                            <p
                                className={`text-sm font-bold leading-none ${
                                    isCompleted
                                        ? "text-fk-text-tertiary"
                                        : isActive
                                        ? "text-fk-text"
                                        : "text-fk-text-tertiary"
                                }`}
                            >
                                {step.label}
                            </p>
                            <p
                                className={`mt-1.5 text-xs leading-relaxed ${
                                    isActive ? "text-fk-text-secondary" : "text-fk-text-tertiary"
                                }`}
                            >
                                {step.description}
                            </p>
                            {isActive && step.status === "received" && createdAt && (
                                <p className="mt-1 text-[10px] text-fk-text-tertiary">
                                    {new Date(createdAt).toLocaleString("en-IN")}
                                </p>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}