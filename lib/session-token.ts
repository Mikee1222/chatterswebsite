/**
 * Session JWT: sign and verify. Used by both middleware (Edge) and server (Node)
 * so session validation is identical everywhere.
 * Use JWT subpaths to avoid pulling in Edge-incompatible jose code (e.g. JWE/deflate).
 */

import { SignJWT } from "jose/jwt/sign";
import { jwtVerify } from "jose/jwt/verify";
import { AUTH_COOKIE_NAME, getSessionJwtSecret, type AuthUser } from "./auth-config";

export { AUTH_COOKIE_NAME, getSessionJwtSecret };

type SessionPayload = {
  id: string;
  email: string;
  role: AuthUser["role"];
  airtableUserId: string | null;
  fullName: string | null;
  secondary_role?: AuthUser["secondary_role"];
  active_role?: AuthUser["active_role"];
  va_type?: AuthUser["va_type"];
};

function encodeSecret(secret: string): Uint8Array {
  return new TextEncoder().encode(secret);
}

export async function signSessionToken(user: AuthUser, maxAgeSeconds: number): Promise<string> {
  const secret = getSessionJwtSecret();
  const key = encodeSecret(secret);
  const ttl = Math.max(60, Math.floor(maxAgeSeconds));
  const jwt = await new SignJWT({
    id: user.id,
    email: user.email,
    role: user.role,
    airtableUserId: user.airtableUserId,
    fullName: user.fullName,
    ...(user.secondary_role !== undefined && user.secondary_role !== null
      ? { secondary_role: user.secondary_role }
      : {}),
    ...(user.active_role !== undefined && user.active_role !== null ? { active_role: user.active_role } : {}),
    ...(user.va_type !== undefined && user.va_type !== null ? { va_type: user.va_type } : {}),
  } as SessionPayload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${ttl}s`)
    .sign(key);
  return jwt;
}

/**
 * Verify session token and return user. Use in middleware and getSessionFromCookies.
 * Returns null if token missing, invalid, or expired.
 */
export async function verifySessionToken(token: string | undefined): Promise<AuthUser | null> {
  if (!token || !token.trim()) return null;
  try {
    const secret = getSessionJwtSecret();
    const key = encodeSecret(secret);
    const { payload } = await jwtVerify(token, key);
    const p = payload as unknown as SessionPayload;
    if (!p.id || !p.email || !p.role) return null;
    const out: AuthUser = {
      id: p.id,
      email: p.email,
      role: p.role,
      airtableUserId: p.airtableUserId ?? null,
      fullName: p.fullName ?? null,
    };
    if (p.secondary_role === "chatter" || p.secondary_role === "virtual_assistant") {
      out.secondary_role = p.secondary_role;
    } else if (p.secondary_role === null) {
      out.secondary_role = null;
    }
    if (p.active_role === "chatter" || p.active_role === "virtual_assistant") {
      out.active_role = p.active_role;
    } else if (p.active_role === null) {
      out.active_role = null;
    }
    if (p.va_type === "chatting" || p.va_type === "marketing" || p.va_type === "both") {
      out.va_type = p.va_type;
    } else if (p.va_type === null) {
      out.va_type = null;
    }
    return out;
  } catch {
    return null;
  }
}
