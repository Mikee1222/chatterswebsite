import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { getCycle, getCycleWithStats, updateCycle, type CycleStatus } from "@/services/content-cycles";

type Ctx = { params: Promise<{ id: string }> };

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
