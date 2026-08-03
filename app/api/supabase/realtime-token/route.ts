import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { isSupabaseBackend } from "@/lib/data-backend";
import { signSupabaseRealtimeJwt } from "@/lib/supabase-realtime-jwt";

/**
 * Mints a short-lived Supabase JWT (role=authenticated) so the browser can
 * subscribe to postgres_changes under RLS SELECT policies.
 * Only available when DATA_BACKEND=supabase and SUPABASE_JWT_SECRET is set.
 */
export async function GET() {
  if (!isSupabaseBackend()) {
    return NextResponse.json({ error: "Supabase backend not active" }, { status: 404 });
  }
  const user = await getSessionFromCookies();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const secret = process.env.SUPABASE_JWT_SECRET?.trim();
  if (!secret) {
    return NextResponse.json({ token: null, reason: "jwt_secret_not_configured" });
  }

  const token = await signSupabaseRealtimeJwt({
    userId: user.airtableUserId ?? user.id,
    role: user.role,
    secret,
  });
  return NextResponse.json({ token, expiresIn: 3600 });
}
