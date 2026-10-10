export const dynamic = "force-dynamic";

// src/app/notifications/settings/page.tsx
//
// Server component — same auth-gating pattern as src/app/notifications/page.tsx.

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifyToken } from "@/lib/auth";
import { getNotificationPreferences } from "@/lib/notifications/preferences";
import NotificationSettings from "@/components/notifications/NotificationSettings";

async function getAuthedUserId(): Promise<string | null> {
    const cookieStore = await cookies();
    const token = cookieStore.get("token")?.value;
    if (!token) return null;
    try {
        const decoded = verifyToken(token) as { userId?: string };
        return decoded?.userId ?? null;
    } catch {
        return null;
    }
}

export default async function NotificationSettingsPage() {
    const userId = await getAuthedUserId();

    if (!userId) {
        redirect("/auth?mode=login&redirect=/notifications/settings");
    }

    const preferences = await getNotificationPreferences(userId);

    return <NotificationSettings initialPreferences={preferences} />;
}