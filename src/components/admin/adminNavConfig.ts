// src/components/admin/adminNavConfig.ts
//
// Phase 15B — THE single source of truth for Admin 2.0 navigation.
// AdminSidebar renders the grouped nav from this; AdminTopbar derives its
// page title/breadcrumb from the same list. One route→label mapping,
// never two independently-maintained copies drifting apart.
//
// Only real, existing routes — no placeholder/invented pages. Analytics was
// added in Phase 15D once /admin/analytics actually existed; Categories was
// added in Phase 15E once /admin/categories actually existed.

import {
    LayoutDashboard, Package, ShoppingBag, Users, Star,
    Tag, Bell, MapPin, Ticket, Sparkles, BarChart3, TrendingUp, PawPrint, ShieldAlert, type LucideIcon,
} from "lucide-react";

export type AdminNavItem = {
    href: string;
    label: string;
    icon: LucideIcon;
    /** True = highlight only on an exact pathname match (e.g. the dashboard root, which would otherwise match every nested /admin/* route via startsWith). */
    exact?: boolean;
};

export type AdminNavGroup = {
    label: string;
    items: AdminNavItem[];
};

export const ADMIN_NAV_GROUPS: AdminNavGroup[] = [
    {
        label: "Overview",
        items: [
            { href: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
            { href: "/admin/analytics", label: "Analytics", icon: BarChart3 },
            { href: "/admin/growth", label: "Growth & Retention", icon: TrendingUp },
        ],
    },
    {
        label: "Operations",
        items: [
            { href: "/admin/orders", label: "Orders", icon: ShoppingBag },
            { href: "/admin/payment-reconciliation", label: "Payment Reconciliation", icon: ShieldAlert },
            { href: "/admin/users", label: "Customers", icon: Users },
            { href: "/admin/donations", label: "Street Animal Donations", icon: PawPrint },
            { href: "/admin/reviews", label: "Reviews", icon: Star },
            { href: "/admin/product-reviews", label: "Product Reviews", icon: Star },
            { href: "/admin/review-rewards", label: "Review Rewards", icon: Star },
        ],
    },
    {
        label: "Catalog",
        items: [
            { href: "/admin/products", label: "Products", icon: Package },
            { href: "/admin/categories", label: "Categories", icon: Tag },
        ],
    },
    {
        label: "Marketing",
        items: [
            { href: "/admin/coupons", label: "Coupons", icon: Ticket },
            { href: "/admin/campaigns", label: "Campaigns & Offers", icon: Sparkles },
            { href: "/admin/loyalty", label: "Loyalty & Spin", icon: Tag },
            { href: "/admin/loyalty/inconsistencies", label: "Loyalty Inconsistencies", icon: ShieldAlert },
            { href: "/admin/notifications", label: "Notifications", icon: Bell },
        ],
    },
    {
        label: "Shop",
        items: [
            { href: "/admin/delivery", label: "Delivery & Settings", icon: MapPin },
        ],
    },
];

/** Flat lookup — every nav item, in group order, for the topbar's title/breadcrumb derivation. */
export const ADMIN_NAV_FLAT: AdminNavItem[] = ADMIN_NAV_GROUPS.flatMap((g) => g.items);

/** Same "exact for dashboard-root, startsWith for everything else" rule the sidebar already used — the only pattern that correctly keeps a parent nav item highlighted on its own nested/dynamic routes (e.g. /admin/orders/[id]) without any route-specific special-casing. */
export function isAdminNavItemActive(pathname: string, item: AdminNavItem): boolean {
    return item.exact ? pathname === item.href : pathname.startsWith(item.href);
}

/** Resolves the current pathname to its nav item (for page title) — longest-href-match wins so a more specific route (e.g. /admin/review-rewards) never loses to a shorter unrelated prefix. */
export function resolveAdminNavItem(pathname: string): AdminNavItem | null {
    const matches = ADMIN_NAV_FLAT.filter((item) => isAdminNavItemActive(pathname, item));
    if (matches.length === 0) return null;
    return matches.reduce((best, cur) => (cur.href.length > best.href.length ? cur : best));
}

/** Which group a resolved nav item belongs to — drives the topbar breadcrumb's first segment. */
export function resolveAdminGroupLabel(pathname: string): string | null {
    for (const group of ADMIN_NAV_GROUPS) {
        if (group.items.some((item) => isAdminNavItemActive(pathname, item))) return group.label;
    }
    return null;
}
