import * as jose from "jose";

const DEFAULT_TTL_SEC = 60 * 60 * 24; // 24h

export type RealtimeTokenPayload = {
  sub: string;
  userId: string;
  airtableUserId: string;
  role: string;
  exp?: number;
};

export async function signRealtimeToken(
  payload: Omit<RealtimeTokenPayload, "exp">,
  secret: string,
  ttlSec = DEFAULT_TTL_SEC
): Promise<string> {
  const key = new TextEncoder().encode(secret);
  const jwt = await new jose.SignJWT({
    userId: payload.userId,
    airtableUserId: payload.airtableUserId,
    role: payload.role,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.userId)
    .setIssuedAt()
    .setExpirationTime(`${ttlSec}s`)
    .sign(key);
  return jwt;
}
