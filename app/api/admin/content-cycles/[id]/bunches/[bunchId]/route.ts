import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { hasAnyPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { deleteBunchFromCycle, getCycle } from "@/services/content-cycles";
import { getVideoBunchDeleteImpact } from "@/services/winner-sourcing";

type Ctx = { params: Promise<{ id: string; bunchId: string }> };

/** Bunches-delete (`winner_sourcing:manage`) or Content Cycles manage — same as page trash gate. */
async function canDeleteCycleBunch(session: Parameters<typeof hasAnyPermission>[0]) {
  return hasAnyPermission(session, [
    PERMISSIONS.WINNER_SOURCING_MANAGE,
    PERMISSIONS.CONTENT_CYCLES_MANAGE,
  ]);
}

/** Impact preview for deleting a cycle-linked bunch (same shape as Bunches delete). */
export async function GET(req: Request, ctx: Ctx) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await canDeleteCycleBunch(session))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id, bunchId } = await ctx.params;
  const wantImpact = new URL(req.url).searchParams.get("delete_impact") === "1";
  if (!wantImpact) {
    return NextResponse.json({ error: "Use ?delete_impact=1" }, { status: 400 });
  }
  const cycle = await getCycle(id);
  if (!cycle) return NextResponse.json({ error: "Cycle not found" }, { status: 404 });
  if (cycle.proven_bunch_id !== bunchId && cycle.experimental_bunch_id !== bunchId) {
    return NextResponse.json({ error: "Bunch does not belong to this cycle" }, { status: 400 });
  }
  const impact = await getVideoBunchDeleteImpact(bunchId);
  if (!impact) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ impact });
}

/** Delete Proven/Experimental bunch from a cycle — reuses deleteVideoBunch. */
export async function DELETE(_req: Request, ctx: Ctx) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await canDeleteCycleBunch(session))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id, bunchId } = await ctx.params;
  try {
    const result = await deleteBunchFromCycle({
      cycle_id: id,
      bunch_id: bunchId,
      actor: {
        user_id: session.airtableUserId ?? session.id,
        user_name: (session.fullName || session.email || "").trim(),
      },
    });
    return NextResponse.json({ ok: true, impact: result.impact, cycle: result.cycle });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed";
    let status = 400;
    if (message === "Bunch not found" || message === "Cycle not found") status = 404;
    if (message === "Bunch does not belong to this cycle") status = 400;
    return NextResponse.json({ error: message }, { status });
  }
}
