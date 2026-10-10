// src/app/(main)/account/profile/page.tsx
//
// Auth already enforced by account/layout.tsx; user data comes from
// AccountContext (no extra fetch here).

import ProfileForm from "@/components/account/ProfileForm";

export default function AccountProfilePage() {
    return <ProfileForm />;
}
