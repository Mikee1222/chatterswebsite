import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { listAllModelss } from "@/services/modelss";

type ModelOption = { id: string; name: string };

/**
 * GET /api/chatter/active-models — active modelss rows for rebill/tip modals (chatter only).
 *
 * Gated on `shifts:view` to match the rebill/tip POST endpoints this list feeds
 * (`/api/chatter/rebills`, `/api/chatter/tips`). It must NOT require the admin-only
 * `shifts:active-view` (that's the /admin/live-shifts real-time board permission),
 * or chatters get 403 here, the fetch fails silently, and the model dropdown renders
 * "No active models" even though active models exist.
 */
export async function GET() {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, "shifts:view"))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

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
