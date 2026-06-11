import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { listAllModelss } from "@/services/modelss";

type ModelOption = { id: string; name: string };

/**
 * GET /api/chatter/active-models — active modelss rows for rebill/tip modals (chatter only).
 */
export async function GET() {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, "shifts:active-view"))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const modelss = await listAllModelss('{status} = "active"');
    const models: ModelOption[] = modelss
      .map((m) => ({
        id: m.id,
        name: m.model_name.trim(),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
    return NextResponse.json({ models });
  } catch {
    return NextResponse.json({ models: [] as ModelOption[] });
  }
}
