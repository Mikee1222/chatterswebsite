import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { listMistakesForAdmin, type MistakeAdminListFilters } from "@/services/chatter-mistakes";

export async function GET(req: Request) {
  const session = await getSessionFromCookies();
  if (!(await hasPermission(session, "mistakes:manage"))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const filters: MistakeAdminListFilters = {
    status: searchParams.get("status") ?? undefined,
    chatter_id: searchParams.get("chatter_id") ?? undefined,
    model_id: searchParams.get("model_id") ?? undefined,
    reason_category: searchParams.get("reason_category") ?? undefined,
    date_from: searchParams.get("date_from") ?? undefined,
    date_to: searchParams.get("date_to") ?? undefined,
  };

  try {
    const mistakes = await listMistakesForAdmin(filters);
    return NextResponse.json({ mistakes });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
