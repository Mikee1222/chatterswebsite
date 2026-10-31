import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { listCyclesWithStats, startNextCycle } from "@/services/content-cycles";

async function guard() {
  const session = await getSessionFromCookies();
  if (!session) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  if (!(await hasPermission(session, PERMISSIONS.CONTENT_CYCLES_MANAGE))) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { session };
}

/** GET ?model_id= → cycles with stats (newest first). */
export async function GET(req: Request) {
  const g = await guard();
  if (g.error) return g.error;
  const modelId = new URL(req.url).searchParams.get("model_id")?.trim() || null;
  try {
    return NextResponse.json({ cycles: await listCyclesWithStats(modelId) });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed" }, { status: 500 });
  }
}

/** POST { model_id, start_date? } → starts the next cycle (+ Proven & Experimental bunches). */
export async function POST(req: Request) {
  const g = await guard();
  if (g.error) return g.error;
  const body = (await req.json().catch(() => ({}))) as { model_id?: string; start_date?: string };
  const modelId = body.model_id?.trim();
  if (!modelId) return NextResponse.json({ error: "model_id required" }, { status: 400 });
  try {
    const cycle = await startNextCycle({
      model_id: modelId,
      actor_id: g.session.airtableUserId ?? g.session.id,
      actor_name: (g.session.fullName || g.session.email || "").trim(),
      start_date: body.start_date?.trim() || undefined,
    });
    return NextResponse.json({ cycle });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed" }, { status: 400 });
  }
}
