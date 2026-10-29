import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import {
  clearPostingBriefPostPosted,
  getAssignedModelIdsForUser,
  getPostingBriefById,
  markPostingBriefPostPosted,
} from "@/services/posting-briefs";

type Ctx = { params: Promise<{ id: string; postId: string }> };

/**
 * Who may mark a post as posted: anyone who can see the brief
 * (posting_briefs:manage, or posting_briefs:view for an assigned model).
 */
async function resolveAccess(
  id: string,
): Promise<
  | { ok: true; actorUserId: string }
  | { ok: false; status: 401 | 403 | 404; error: string }
> {
  const session = await getSessionFromCookies();
  if (!session) return { ok: false, status: 401, error: "Unauthorized" };

  const canManage = await hasPermission(session, PERMISSIONS.POSTING_BRIEFS_MANAGE);
  const canView = await hasPermission(session, PERMISSIONS.POSTING_BRIEFS_VIEW);
  if (!canManage && !canView) return { ok: false, status: 403, error: "Forbidden" };

  const brief = await getPostingBriefById(id);
  if (!brief) return { ok: false, status: 404, error: "Not found" };

  const actorUserId = session.airtableUserId ?? session.id;
  if (!canManage) {
    const a = await getAssignedModelIdsForUser(actorUserId);
    const b = actorUserId !== session.id ? await getAssignedModelIdsForUser(session.id) : [];
    if (!new Set([...a, ...b]).has(brief.model_id.trim())) {
      return { ok: false, status: 403, error: "Forbidden" };
    }
  }
  return { ok: true, actorUserId };
}

export async function POST(req: Request, ctx: Ctx) {
  const { id, postId } = await ctx.params;
  const access = await resolveAccess(id);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  let url = "";
  try {
    const body = (await req.json()) as { url?: unknown };
    url = typeof body.url === "string" ? body.url : "";
  } catch {
    url = "";
  }

  try {
    const brief = await markPostingBriefPostPosted({
      briefId: id,
      postId,
      url,
      actorUserId: access.actorUserId,
    });
    return NextResponse.json({ brief });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed";
    const status = msg === "Brief not found" || msg === "Post not found" ? 404 : 400;
    return NextResponse.json({ error: msg }, { status });
  }
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const { id, postId } = await ctx.params;
  const access = await resolveAccess(id);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  try {
    const brief = await clearPostingBriefPostPosted({ briefId: id, postId });
    return NextResponse.json({ brief });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed";
    const status = msg === "Brief not found" || msg === "Post not found" ? 404 : 400;
    return NextResponse.json({ error: msg }, { status });
  }
}
