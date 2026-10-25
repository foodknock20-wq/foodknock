// src/app/(main)/account/delete/page.tsx
//
// Account-deletion flow page. Lives inside the /account route group so it
// inherits the layout's hard server-side auth gate (a guest is redirected
// to /auth before this renders) and the shared AccountShell navigation.
// The actual multi-step, re-authenticated flow is the client component.

import type { Metadata } from "next";
import DeleteAccountFlow from "@/components/account/DeleteAccountFlow";

export const metadata: Metadata = {
    title: "Delete account",
    robots: { index: false, follow: false },
};

export default function DeleteAccountPage() {
    return <DeleteAccountFlow />;
}
