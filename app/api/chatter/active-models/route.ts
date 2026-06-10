import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { listAllRecords } from "@/lib/airtable-server";

type ModelOption = { id: string; name: string };

/**
 * GET /api/chatter/active-models — active modelss rows for rebill/tip modals (chatter only).
 */
export async function GET() {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, "shifts:active-view"))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const records = await listAllRecords<{ model_name?: string; model_id?: string }>("modelss", {
      filterByFormula: `{status} = "active"`,
      _caller: "api.chatter.active-models",
    });
    const models: ModelOption[] = [...records]
      .map((r) => ({
        id: r.id,
        name: (r.fields.model_name || r.fields.model_id || r.id).trim() || r.id,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
    return NextResponse.json({ models });
  } catch {
    return NextResponse.json({ models: [] as ModelOption[] });
  }
}
