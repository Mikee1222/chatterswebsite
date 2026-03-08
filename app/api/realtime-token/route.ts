import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { signRealtimeToken } from "@/lib/realtime-jwt";

export async function GET() {
  const user = await getSessionFromCookies();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const secret = process.env.REALTIME_JWT_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "Realtime not configured" }, { status: 503 });
  }
  const token = await signRealtimeToken({
    sub: user.id,
    userId: user.id,
    airtableUserId: user.airtableUserId ?? user.id,
    role: user.role,
  }, secret);
  return NextResponse.json({ token });
}
