// src/components/shell/types.ts — shared types for the FoodKnock UI 2.0
// customer shell (CustomerShell/AccountDialog/CustomerHeader), moved out of
// the old src/components/shared/Navbar.tsx so they aren't locked inside a
// single component file.

export type AuthUser = {
    id: string;
    name: string;
    email: string;
    role: string;
    phone?: string;
    address?: string;
};

export type { ShellAuthState as AuthState } from "./BottomNavigation";

export interface BeforeInstallPromptEvent extends Event {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}
