// src/lib/__tests__/integration/testDb.ts
//
// Phase 17.3 — shared fixture helper for REAL integration tests. These
// tests import and execute the actual application service functions
// (loyaltyService.ts, paymentReconciliation.ts, apiAuth.ts, etc.) against
// a real MongoDB connection — not a raw-driver simulation of their logic.
//
// Run via: npx tsx --test src/lib/__tests__/integration/*.test.ts
//
// ── SAFETY: how "isolated and disposable" is actually verified here ───────
// `src/lib/db.ts`'s connectDB() hardcodes `dbName: "cafe_app"` — the
// application itself ignores whatever database name appears in
// MONGODB_URI's path. That means these tests' database is ALSO literally
// named "cafe_app" (unavoidable without editing production code, which
// this phase explicitly must not do just to accommodate a test harness).
//
// Per the task's own instruction — "never infer safety from a database
// name alone" — safety here comes from the HOST, not the name:
// MONGODB_URI is HARD-CODED below to 127.0.0.1 (loopback-only), and
// verifyIsolatedTestTarget() independently re-confirms, every time these
// tests run, that the connected instance is NOT any Atlas/production host
// and does not already contain unexpected data, before any test fixture
// is written. This exact local instance was independently verified
// isolated (hosts unrelated side-project databases, no prior "cafe_app")
// in every database-touching phase so far this engagement.
//
// This file NEVER reads process.env.MONGODB_URI (which would resolve to
// production per .env.local) — it defines its own, separate, hardcoded
// local connection string.

import mongoose from "mongoose";

export const TEST_MONGODB_URI = "mongodb://127.0.0.1:27017/cafe_app";

let verified = false;

/** Must be called before any fixture is written. Throws loudly rather than silently proceeding if the target doesn't check out. */
export async function verifyIsolatedTestTarget(): Promise<void> {
    if (verified) return;

    const uri = TEST_MONGODB_URI;
    const url = new URL(uri.replace("mongodb://", "http://")); // cheap host/port parse
    if (url.hostname !== "127.0.0.1" && url.hostname !== "localhost") {
        throw new Error(`REFUSING TO RUN: test URI host "${url.hostname}" is not a verified local address.`);
    }

    // Connect using the SAME hardcoded dbName the real app uses, so these
    // tests exercise the real connectDB()/model behavior unmodified.
    await mongoose.connect(uri, { dbName: "cafe_app" });

    const admin = mongoose.connection.db!.admin();
    const dbs = await admin.listDatabases();
    const names = dbs.databases.map((d) => d.name);

    // The connected instance must only ever contain this exact, previously
    // verified set of local databases (confirmed in every database-
    // touching phase this engagement) plus our own test db — anything
    // else is a signal this might not be the isolated local instance we
    // think it is, and we refuse rather than guess.
    const KNOWN_LOCAL_DBS = new Set(["admin", "local", "config", "cafe_app", "ecommerce", "knockmarket", "next-todo", "ridefair"]);
    const unexpected = names.filter((n) => !KNOWN_LOCAL_DBS.has(n));
    if (unexpected.length > 0) {
        throw new Error(`REFUSING TO RUN: unexpected database(s) found on the test host: ${unexpected.join(", ")} — re-verify this is the correct isolated instance before proceeding.`);
    }

    verified = true;
}

/** Drops ONLY the cafe_app database on the verified local instance — never called against anything else. */
export async function dropTestDatabase(): Promise<void> {
    await verifyIsolatedTestTarget();
    await mongoose.connection.db!.dropDatabase();
}

export async function closeTestConnection(): Promise<void> {
    await mongoose.disconnect();
}

export { mongoose };
