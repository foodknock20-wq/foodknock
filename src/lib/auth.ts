// src/lib/auth.ts
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET!;

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export async function comparePassword(
  password: string,
  hashedPassword: string
) {
  return bcrypt.compare(password, hashedPassword);
}

export function signToken(payload: {
  userId: string;
  email: string;
  role: string;
}) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
}

export function verifyToken(token: string) {
  return jwt.verify(token, JWT_SECRET);
}

// ── Password-reset token (separate from session JWT) ───────────────────────
// Uses a distinct secret (RESET_TOKEN_SECRET) and a "purpose" claim so a
// leaked/expired reset token can never be replayed as a session token, and
// an existing session token can never be replayed as a reset token. Kept in
// this file alongside signToken/verifyToken since both are JWT helpers, but
// added as new exports only — nothing above this line is modified.
const RESET_TOKEN_SECRET = process.env.RESET_TOKEN_SECRET!;

export function signResetToken(payload: { userId: string; purpose: "password-reset" }) {
  return jwt.sign(payload, RESET_TOKEN_SECRET, { expiresIn: "10m" });
}

export function verifyResetToken(token: string) {
  const decoded = jwt.verify(token, RESET_TOKEN_SECRET) as {
    userId: string;
    purpose: string;
  };
  if (decoded.purpose !== "password-reset") {
    throw new Error("Invalid token purpose");
  }
  return decoded;
}

// ── Account-deletion intent token (separate from session + reset tokens) ───
// Issued only AFTER a fresh re-authentication (password re-entry) in the
// deletion flow's initiate step, and required again at the final confirm
// step. A distinct secret + "purpose" claim means it can never be replayed
// as a session or reset token, nor can either of those be replayed here.
// Short expiry (10 min) scopes it to the single deletion attempt. The `sid`
// claim binds it to the exact session token hash it was minted for, so a
// token leaked to a different session/device cannot be used. Falls back to
// JWT_SECRET when ACCOUNT_DELETION_SECRET is unset (see promotionEligibility
// for the same documented fallback rationale).
const DELETION_TOKEN_SECRET =
  process.env.ACCOUNT_DELETION_SECRET || process.env.JWT_SECRET!;

// The token carries the RAW nonce (`n`) so the confirm step can match it
// against the hash persisted on the User document (stored hashed, never
// raw). Combined with the per-user stored nonce this makes the token
// single-use: consuming the stored nonce invalidates every copy of the
// token. The raw nonce lives only inside this signed, httpOnly-delivered
// token and is never logged.
export function signDeletionToken(payload: { userId: string; sid: string; nonce: string }) {
  return jwt.sign(
    { ...payload, purpose: "account-deletion" },
    DELETION_TOKEN_SECRET,
    { expiresIn: "10m" }
  );
}

export function verifyDeletionToken(token: string) {
  const decoded = jwt.verify(token, DELETION_TOKEN_SECRET) as {
    userId: string;
    sid: string;
    nonce: string;
    purpose: string;
  };
  if (decoded.purpose !== "account-deletion") {
    throw new Error("Invalid token purpose");
  }
  return decoded;
}