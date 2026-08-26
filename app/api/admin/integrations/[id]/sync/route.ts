import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import {
  triggerIntegrationSync,
  type IntegrationId,
} from "@/services/integration-health";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

const IDS = new Set<IntegrationId>([
  "infloww",
  "clariosuite",
  "getmysocial",
  "anthropic",
  "supabase",
]);

export async function POST(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, PERMISSIONS.INTEGRATIONS_MANAGE))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const id = params.id as IntegrationId;
  if (!IDS.has(id)) return NextResponse.json({ error: "Unknown integration" }, { status: 404 });
  const result = await triggerIntegrationSync(id);
  return NextResponse.json(result, { status: result.ok ? 200 : 502 });
}
