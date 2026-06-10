import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { clearWhaleChatter } from "@/app/actions/whales";

/** Remove chatter assignment from a whale. Body: { whale_id: string }. */
export async function POST(req: Request) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, "whales:manage"))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const whaleId = (body as { whale_id?: string }).whale_id?.trim();
  if (!whaleId) {
    return NextResponse.json({ error: "whale_id is required" }, { status: 400 });
  }

  const result = await clearWhaleChatter(whaleId);
  if (!result.success) {
    return NextResponse.json({ error: result.error ?? "Failed to unassign" }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
