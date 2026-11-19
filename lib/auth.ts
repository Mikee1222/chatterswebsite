/**
 * Auth: sessions and password verification.
 * Session is a signed JWT in the cookie so middleware (Edge) and server (Node) validate the same way.
 * Hermes agent tokens: when no valid cookie, Authorization Bearer gz_agent_… may authenticate
 * only for allowlisted /api/* routes (DEFAULT DENY). Pages never accept agent tokens.
 */

import { cookies, headers } from "next/headers";
import {
  AUTH_COOKIE_NAME,
  SESSION_REMEMBER_MAX_AGE_SEC,
  type AuthUser,
} from "./auth-config";
import { isAgentAllowlisted } from "./agent-allowlist";
import { AGENT_TOKEN_PREFIX, isAgentTokenFormat } from "./agent-token-crypto";
import { signSessionToken, verifySessionToken } from "./session-token";

/**
 * Create a session JWT for the user.
 * @param maxAgeSeconds — JWT `exp` (and should match cookie `maxAge` when using "Remember me").
 */
export async function setSession(user: AuthUser, maxAgeSeconds: number): Promise<string> {
  return signSessionToken(user, maxAgeSeconds);
}

/** No-op for JWT sessions; logout just clears the cookie. */
export async function deleteSession(_sessionId: string): Promise<void> {
  // JWT is stateless; nothing to delete
}

/**
 * Read session cookie and validate JWT. Same validation as middleware for cookies.
 * When no valid cookie: try Authorization Bearer gz_agent_… (API allowlist only).
 * Returns null only for missing/invalid/expired tokens / denied agent paths.
 * Infrastructure/config failures from verifySessionToken propagate (do not
 * treat as logged out — callers must not redirect to /login on those).
 */
export async function getSessionFromCookies(): Promise<AuthUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  const cookieUser = await verifySessionToken(token ?? undefined);
  if (cookieUser) {
    // Agent users never use cookies — reject even if a JWT somehow exists.
    try {
      const { userIsAgent } = await import("@/services/agent-tokens");
      if (await userIsAgent(cookieUser.id)) return null;
      if (cookieUser.airtableUserId && cookieUser.airtableUserId !== cookieUser.id) {
        if (await userIsAgent(cookieUser.airtableUserId)) return null;
      }
    } catch {
      // If is_agent column / DB unavailable, do not break human cookie sessions.
    }
    return { ...cookieUser, via: "cookie" };
  }

  return resolveAgentBearerSession();
}

/**
 * Bearer gz_agent_ path. DEFAULT DENY unless (method, pathname) is allowlisted
 * and path is under /api/. Uses x-method / x-pathname from middleware when present.
 */
async function resolveAgentBearerSession(): Promise<AuthUser | null> {
  let h: Headers;
  try {
    h = await headers();
  } catch {
    return null;
  }

  const authHeader = h.get("authorization") ?? h.get("Authorization");
  if (!authHeader) return null;
  const match = /^Bearer\s+(\S+)\s*$/i.exec(authHeader.trim());
  if (!match) return null;
  const plaintext = match[1]!;
  if (!plaintext.startsWith(AGENT_TOKEN_PREFIX)) return null;
  if (!isAgentTokenFormat(plaintext)) return null;

  const method = (h.get("x-method") ?? "GET").trim().toUpperCase();
  const pathname = (h.get("x-pathname") ?? "").trim();
  if (!pathname || !pathname.startsWith("/api/")) return null;
  if (!isAgentAllowlisted(method, pathname)) return null;

  try {
    const { resolveAgentTokenSession } = await import("@/services/agent-tokens");
    return await resolveAgentTokenSession(plaintext);
  } catch (err) {
    console.error("[auth] agent token resolve failed", err);
    return null;
  }
}

/** Re-issue session JWT after role switch (or similar); uses 30-day cookie max-age for stability. */
export async function updateSessionCookie(user: AuthUser): Promise<void> {
  const token = await setSession(user, SESSION_REMEMBER_MAX_AGE_SEC);
  const cookieStore = await cookies();
  cookieStore.set(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_REMEMBER_MAX_AGE_SEC,
  });
}

/** @deprecated Use getSessionFromCookies. Kept for any code that looked up by session id. */
export async function getSession(_sessionId: string | undefined): Promise<AuthUser | null> {
  return null;
}

/** Hash password (Node crypto). Use same in D1 when storing. */
export async function hashPassword(password: string): Promise<string> {
  const { scrypt, randomBytes } = await import("crypto");
  return new Promise((resolve, reject) => {
    const salt = randomBytes(16).toString("hex");
    scrypt(password, salt, 64, (err, derived) => {
      if (err) reject(err);
      else resolve(`${salt}:${derived.toString("hex")}`);
    });
  });
}

/** Verify password against stored hash. */
export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  // Backward compatibility: older deployments may have bcrypt hashes in Airtable.
  // Vercel Node runtime supports bcryptjs reliably.
  if (storedHash.startsWith("$2a$") || storedHash.startsWith("$2b$") || storedHash.startsWith("$2y$")) {
    try {
      const bcryptjs = await import("bcryptjs");
      return await bcryptjs.compare(password, storedHash);
    } catch {
      return false;
    }
  }

  const { scrypt } = await import("crypto");
  const [salt, key] = storedHash.split(":");
  if (!salt || !key) return false;
  return new Promise((resolve) => {
    scrypt(password, salt, 64, (err, derived) => {
      if (err) resolve(false);
      else resolve(derived.toString("hex") === key);
    });
  });
}
