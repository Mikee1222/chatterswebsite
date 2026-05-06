import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { assignWhaleToChatter } from "@/app/actions/whales";
import { getUserByAirtableId } from "@/services/users";

/**
 * Assign or reassign a whale to a chatter (admin/manager).
 * Body: { whale_id: string, chatter_id: string } — both Airtable `users` record ids.
 */
export async function POST(req: Request) {
  const session = await getSessionFromCookies();
  if (!session || (session.role !== "admin" && session.role !== "manager")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const b = body as { whale_id?: string; chatter_id?: string };
  const whaleId = b.whale_id?.trim();
  const chatterId = b.chatter_id?.trim();
  if (!whaleId || !chatterId) {
    return NextResponse.json({ error: "whale_id and chatter_id are required" }, { status: 400 });
  }

  const chatterUser = await getUserByAirtableId(chatterId).catch(() => null);
  const name = chatterUser?.full_name?.trim() || chatterUser?.email?.trim() || "Chatter";

  const result = await assignWhaleToChatter(whaleId, chatterId, name);
  if (!result.success) {
    return NextResponse.json({ error: result.error ?? "Failed to assign" }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
