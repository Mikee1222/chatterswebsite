/**
 * Session JWT: sign and verify. Used by both middleware (Edge) and server (Node)
 * so session validation is identical everywhere.
 * Use JWT subpaths to avoid pulling in Edge-incompatible jose code (e.g. JWE/deflate).
 */

import { SignJWT } from "jose/jwt/sign";
import { jwtVerify } from "jose/jwt/verify";
import {
  AUTH_COOKIE_NAME,
  SESSION_MAX_AGE_SEC,
  getSessionJwtSecret,
  type AuthUser,
} from "./auth-config";

export { AUTH_COOKIE_NAME, getSessionJwtSecret };

type SessionPayload = {
  id: string;
  email: string;
  role: AuthUser["role"];
  airtableUserId: string | null;
  fullName: string | null;
};

function encodeSecret(secret: string): Uint8Array {
  return new TextEncoder().encode(secret);
}

export async function signSessionToken(user: AuthUser): Promise<string> {
  const secret = getSessionJwtSecret();
  const key = encodeSecret(secret);
  const jwt = await new SignJWT({
    id: user.id,
    email: user.email,
    role: user.role,
    airtableUserId: user.airtableUserId,
    fullName: user.fullName,
  } as SessionPayload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_SEC}s`)
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
    return {
      id: p.id,
      email: p.email,
      role: p.role,
      airtableUserId: p.airtableUserId ?? null,
      fullName: p.fullName ?? null,
    };
  } catch {
    return null;
  }
}
