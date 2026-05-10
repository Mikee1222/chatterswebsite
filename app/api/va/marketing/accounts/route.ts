import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { getEffectiveStaffRole } from "@/lib/staff-session-role";
import { getAccountsByVA } from "@/services/marketing";

export async function GET(req: Request) {
  const session = await getSessionFromCookies();
  if (!session || getEffectiveStaffRole(session) !== "virtual_assistant") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const vaId = session.airtableUserId ?? session.id;
  const { searchParams } = new URL(req.url);
  const modelId = searchParams.get("model_id")?.trim();
  let accounts = await getAccountsByVA(vaId);
  if (modelId) accounts = accounts.filter((a) => a.model_id === modelId);
  return NextResponse.json({ accounts });
}

