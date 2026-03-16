// "use client";


import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { connectDB } from "@/lib/db";
import User from "@/models/User";
import { verifyToken } from "@/lib/auth";
import AdminShell from "@/components/admin/AdminShell";

// ─── Server-side auth guard ───────────────────────────────────────────────
async function validateAdminAccess(): Promise<void> {
    const cookieStore = await cookies();
    const token = cookieStore.get("token")?.value;

    // 1. No token → redirect to /auth (middleware should catch this first,
    //    but we double-check here for reliability)
    if (!token) {
        redirect("/auth?redirect=/admin");
    }

    // 2. Verify JWT
    let decoded: { userId: string } & Record<string, unknown>;
    try {
        const { verifyToken: vt } = await import("@/lib/auth");
        decoded = vt(token) as typeof decoded;
    } catch {
        // Invalid/expired token → clear it and redirect
        redirect("/auth?redirect=/admin");
    }

    if (!decoded?.userId) {
        redirect("/auth?redirect=/admin");
    }

    // 3. DB-backed check: role + isActive
    await connectDB();
    const user = await User.findById(decoded.userId)
        .select("role isActive")
        .lean() as { role: string; isActive: boolean } | null;

    if (!user) {
        redirect("/auth?redirect=/admin");
    }

    // 4. Blocked/inactive user
    if (user.isActive === false) {
        // They're blocked — send them away (token stays, they just can't access)
        redirect("/auth?error=blocked");
    }

    // 5. Not admin
    if (user.role !== "admin") {
        redirect("/");
    }

    // All checks passed ✓
}

// ─── Layout (Server Component) ────────────────────────────────────────────
export default async function AdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    // Guard runs on every /admin page request — DB-backed, can't be bypassed
    await validateAdminAccess();

    // Render the UI shell (client component handles sidebar toggle state)
    return <AdminShell>{children}</AdminShell>;
}