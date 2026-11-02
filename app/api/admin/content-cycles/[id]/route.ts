import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import {
  deleteCycle,
  getCycle,
  getCycleDeleteImpact,
  getCycleWithStats,
  updateCycle,
  type ContentCycleDeleteMode,
  type CycleStatus,
} from "@/services/content-cycles";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: Request, ctx: Ctx) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, PERMISSIONS.CONTENT_CYCLES_MANAGE))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await ctx.params;
  const wantImpact = new URL(req.url).searchParams.get("delete_impact") === "1";
  if (wantImpact) {
    const impact = await getCycleDeleteImpact(id);
    if (!impact) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ impact });
  }
  const existing = await getCycle(id);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ cycle: await getCycleWithStats(existing) });
}

export async function PATCH(req: Request, ctx: Ctx) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, PERMISSIONS.CONTENT_CYCLES_MANAGE))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as { status?: CycleStatus; notes?: string };
  try {
    const existing = await getCycle(id);
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const cycle = await updateCycle(id, body);
    return NextResponse.json({ cycle: await getCycleWithStats(cycle) });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed" }, { status: 400 });
  }
}

/** DELETE { mode?: "keep_bunches" | "delete_bunches" } — default keep_bunches. */
export async function DELETE(req: Request, ctx: Ctx) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, PERMISSIONS.CONTENT_CYCLES_MANAGE))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as { mode?: string };
  const mode: ContentCycleDeleteMode =
    body.mode === "delete_bunches" ? "delete_bunches" : "keep_bunches";
  try {
    const result = await deleteCycle({
      cycle_id: id,
      mode,
      actor: {
        user_id: session.airtableUserId ?? session.id,
        user_name: (session.fullName || session.email || "").trim(),
      },
    });
    return NextResponse.json({ ok: true, impact: result.impact, mode: result.mode });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed";
    const status = message === "Cycle not found" ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
