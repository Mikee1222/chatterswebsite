/**
 * Auth configuration. In production use Cloudflare D1 for users and sessions.
 * This module supports a simple file-based or in-memory fallback for local dev
 * when D1 is not bound.
 */

export const AUTH_COOKIE_NAME = "chatter_session";
export const SESSION_MAX_AGE_SEC = 60 * 60 * 24 * 7; // 7 days

const DEV_FALLBACK_SECRET = "chatter-dev-session-secret-min-32-chars";

/** Secret for signing session JWT. Must be 32+ chars for HS256. Set in production. */
export function getSessionJwtSecret(): string {
  const secret = process.env.SESSION_JWT_SECRET;
  if (secret && secret.length >= 32) return secret;
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "SESSION_JWT_SECRET must be set in production (min 32 characters). Set it in your environment or Cloudflare Pages vars."
    );
  }
  return DEV_FALLBACK_SECRET;
}

export type AuthUser = {
  id: string;
  email: string;
  role: "admin" | "manager" | "chatter" | "virtual_assistant";
  airtableUserId: string | null;
  fullName: string | null;
};
