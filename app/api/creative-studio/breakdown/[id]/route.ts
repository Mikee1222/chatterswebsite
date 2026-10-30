import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import {
  deleteWinnerBreakdown,
  getWinnerBreakdown,
  updateWinnerBreakdownMeta,
} from "@/services/winner-breakdowns";

type Ctx = { params: Promise<{ id: string }> };

async function guard() {
  const session = await getSessionFromCookies();
  if (!session) return { error: Response.json({ error: "Unauthorized" }, { status: 401 }) };
  if (!(await hasPermission(session, PERMISSIONS.CREATIVE_STUDIO_USE))) {
    return { error: Response.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { session };
}

export async function GET(_req: Request, ctx: Ctx) {
  const g = await guard();
  if (g.error) return g.error;
  const { id } = await ctx.params;
  try {
    const row = await getWinnerBreakdown(id);
    if (!row) return Response.json({ error: "Not found" }, { status: 404 });
    return Response.json({ item: row });
  } catch (err) {
    console.error("[creative-studio] get breakdown failed", err);
    return Response.json({ error: "Could not load breakdown" }, { status: 500 });
  }
}

export async function PATCH(req: Request, ctx: Ctx) {
  const g = await guard();
  if (g.error) return g.error;
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as {
    title?: string;
    sourceUrl?: string;
    notes?: string;
    modelId?: string | null;
  };
  try {
    await updateWinnerBreakdownMeta(id, body);
    return Response.json({ ok: true });
  } catch (err) {
    console.error("[creative-studio] update breakdown failed", err);
    return Response.json({ error: "Could not update breakdown" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const g = await guard();
  if (g.error) return g.error;
  const { id } = await ctx.params;
  try {
    const row = await getWinnerBreakdown(id);
    if (!row) return Response.json({ error: "Not found" }, { status: 404 });
    const me = g.session.airtableUserId ?? g.session.id;
    const isAdmin = await hasPermission(g.session, PERMISSIONS.POSTING_BRIEFS_MANAGE);
    if (row.created_by !== me && !isAdmin) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }
    await deleteWinnerBreakdown(id);
    return Response.json({ ok: true });
  } catch (err) {
    console.error("[creative-studio] delete breakdown failed", err);
    return Response.json({ error: "Could not delete breakdown" }, { status: 500 });
  }
}
