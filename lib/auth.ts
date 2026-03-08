/**
 * Auth: sessions and password verification.
 * Session is a signed JWT in the cookie so middleware (Edge) and server (Node) validate the same way.
 */

import { cookies } from "next/headers";
import { AUTH_COOKIE_NAME, type AuthUser } from "./auth-config";
import { signSessionToken, verifySessionToken } from "./session-token";

/** Create a session token (JWT) for the user. Stored in cookie; no server-side store. */
export async function setSession(user: AuthUser): Promise<string> {
  return signSessionToken(user);
}

/** No-op for JWT sessions; logout just clears the cookie. */
export async function deleteSession(_sessionId: string): Promise<void> {
  // JWT is stateless; nothing to delete
}

/**
 * Read session cookie and validate JWT. Same validation as middleware.
 * Use this in server components, actions, and API routes.
 */
export async function getSessionFromCookies(): Promise<AuthUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  return verifySessionToken(token ?? undefined);
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
