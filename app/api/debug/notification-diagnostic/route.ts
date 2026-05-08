import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";

/**
 * Smoke test: admin session only (no ENABLE_NOTIFICATION_TESTING gate).
 * Restore full pipeline GET here when you are ready to run heavy checks again.
 */
export async function GET() {
  const session = await getSessionFromCookies();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ status: "ok", message: "Diagnostic API working" });
}
