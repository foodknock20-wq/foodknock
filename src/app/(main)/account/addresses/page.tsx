// src/app/(main)/account/addresses/page.tsx
//
// Server-fetches the caller's addresses directly (same helper the API
// route uses — src/lib/addresses.ts) and hands them to a client component
// for add/edit/delete/set-default. Auth already enforced by
// account/layout.tsx; AccountContext gives us the user id without another
// token/DB round trip here.

import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { listAddresses } from "@/lib/addresses";
import AddressManager from "@/components/account/AddressManager";

export default async function AccountAddressesPage() {
    // account/layout.tsx already validated this token; re-decoding here
    // (not re-hitting the DB) just gets us the id to scope the address
    // query to — cheap, no extra Mongo round trip.
    const cookieStore = await cookies();
    const token = cookieStore.get("token")!.value;
    const { userId } = verifyToken(token) as { userId: string };

    const addresses = await listAddresses(userId);

    return <AddressManager initialAddresses={addresses} />;
}
