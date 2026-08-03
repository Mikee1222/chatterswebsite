/**
 * Short-lived Supabase JWT for postgres_changes (role=authenticated).
 * Requires SUPABASE_JWT_SECRET from Project Settings → API → JWT Secret.
 * Broadcast invalidate path works without this.
 */

import * as jose from "jose";

const DEFAULT_TTL_SEC = 60 * 60; // 1h

export async function signSupabaseRealtimeJwt(opts: {
  userId: string;
  role?: string;
  secret: string;
  ttlSec?: number;
}): Promise<string> {
  const key = new TextEncoder().encode(opts.secret);
  return new jose.SignJWT({
    role: "authenticated",
    app_role: opts.role ?? "user",
    app_user_id: opts.userId,
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(opts.userId)
    .setAudience("authenticated")
    .setIssuedAt()
    .setExpirationTime(`${opts.ttlSec ?? DEFAULT_TTL_SEC}s`)
    .sign(key);
}
