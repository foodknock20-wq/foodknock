// src/app/(main)/account/preferences/page.tsx
//
// Reuses the existing getNotificationPreferences()/NotificationSettings
// pair (already built, previously had zero UI callers — see Phase 9
// plan) instead of a second preferences implementation. Same backing
// data as /notifications/settings; this route just presents it inside
// the Account IA.

import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { getNotificationPreferences } from "@/lib/notifications/preferences";
import NotificationSettings from "@/components/notifications/NotificationSettings";

export default async function AccountPreferencesPage() {
    const cookieStore = await cookies();
    const token = cookieStore.get("token")!.value;
    const { userId } = verifyToken(token) as { userId: string };

    const preferences = await getNotificationPreferences(userId);

    return <NotificationSettings initialPreferences={preferences} />;
}
