import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { getCycleSettings, upsertCycleSettings } from "@/services/content-cycles";

export async function GET(req: Request) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, PERMISSIONS.CONTENT_CYCLES_MANAGE))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const modelId = new URL(req.url).searchParams.get("model_id")?.trim();
  if (!modelId) return NextResponse.json({ error: "model_id required" }, { status: 400 });
  return NextResponse.json({ settings: await getCycleSettings(modelId) });
}

export async function PATCH(req: Request) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, PERMISSIONS.CONTENT_CYCLES_MANAGE))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const body = (await req.json().catch(() => ({}))) as {
    model_id?: string;
    proven_cap?: number;
    experimental_cap?: number;
    grid_per_day?: number;
    trials_per_day?: number;
    urgent_slots_per_month?: number;
    outlier_multiple?: number;
    hot_multiple?: number;
    baseline_posts?: number;
  };
  const modelId = body.model_id?.trim();
  if (!modelId) return NextResponse.json({ error: "model_id required" }, { status: 400 });
  const { model_id: _m, ...patch } = body;
  void _m;
  const clean: Record<string, number> = {};
  for (const [k, v] of Object.entries(patch)) {
    if (typeof v === "number" && Number.isFinite(v)) clean[k] = v;
  }
  try {
    const settings = await upsertCycleSettings(modelId, clean, session.airtableUserId ?? session.id);
    return NextResponse.json({ settings });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed" }, { status: 400 });
  }
}
