/**
 * Auth configuration. In production use Cloudflare D1 for users and sessions.
 * This module supports a simple file-based or in-memory fallback for local dev
 * when D1 is not bound.
 */

import type { VaType } from "@/types";

export const AUTH_COOKIE_NAME = "chatter_session";

/** "Remember me" checked: JWT and optional cookie max-age (30 days). */
export const SESSION_REMEMBER_MAX_AGE_SEC = 60 * 60 * 24 * 30;

/**
 * "Remember me" unchecked: JWT lifetime for an open browser session.
 * Cookie is set **without** `maxAge` so it is a browser session cookie (cleared when the browser app closes).
 */
export const SESSION_EPHEMERAL_JWT_MAX_AGE_SEC = 60 * 60 * 24; // 24 hours

/** @deprecated Prefer SESSION_REMEMBER_MAX_AGE_SEC or SESSION_EPHEMERAL_JWT_MAX_AGE_SEC */
export const SESSION_MAX_AGE_SEC = SESSION_REMEMBER_MAX_AGE_SEC;

const DEV_FALLBACK_SECRET = "chatter-dev-session-secret-min-32-chars";

/** Secret for signing session JWT. Must be 32+ chars for HS256. Set in production. */
export function getSessionJwtSecret(): string {
  const secret = process.env.SESSION_JWT_SECRET;
  if (secret && secret.length >= 32) return secret;
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "SESSION_JWT_SECRET must be set in production (min 32 characters). Set it in your environment or Cloudflare Pages vars.");
  }
  return DEV_FALLBACK_SECRET;
}

export type AuthUser = {
  id: string;
  email: string;
  role: "admin" | "manager" | "chatter" | "virtual_assistant" | "model" | "client";
  airtableUserId: string | null;
  fullName: string | null;
  /** Set when user is chatter+VA pair (Airtable `secondary_role`). */
  secondary_role?: "chatter" | "virtual_assistant" | null;
  /** Which staff hat is active when `secondary_role` is set. */
  active_role?: "chatter" | "virtual_assistant" | null;
  /** VA specialization from Airtable `users.va_type`. */
  va_type?: VaType | null;
};
