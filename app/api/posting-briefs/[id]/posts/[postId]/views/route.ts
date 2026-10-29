import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import {
  getAssignedModelIdsForUser,
  getPostingBriefById,
  recordPost24hViews,
} from "@/services/posting-briefs";

type Ctx = { params: Promise<{ id: string; postId: string }> };

/**
 * 24h check (Content Flow v1.1). Same access as marking a post as posted:
 * posting_briefs:manage, or posting_briefs:view for an assigned model.
 */
export async function POST(req: Request, ctx: Ctx) {
  const { id, postId } = await ctx.params;
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const canManage = await hasPermission(session, PERMISSIONS.POSTING_BRIEFS_MANAGE);
  const canView = await hasPermission(session, PERMISSIONS.POSTING_BRIEFS_VIEW);
  if (!canManage && !canView) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const brief = await getPostingBriefById(id);
  if (!brief) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const actorUserId = session.airtableUserId ?? session.id;
  if (!canManage) {
    const a = await getAssignedModelIdsForUser(actorUserId);
    const b = actorUserId !== session.id ? await getAssignedModelIdsForUser(session.id) : [];
    if (!new Set([...a, ...b]).has(brief.model_id.trim())) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  let views: number = NaN;
  try {
    const body = (await req.json()) as { views?: unknown };
    views = Number(body.views);
  } catch {
    views = NaN;
  }
  if (!Number.isFinite(views) || views < 0) {
    return NextResponse.json({ error: "views must be a number ≥ 0" }, { status: 400 });
  }

  try {
    const result = await recordPost24hViews({
      briefId: id,
      postId,
      views,
      actorUserId,
      actorName: session.fullName || session.email || undefined,
    });
    return NextResponse.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed";
    const status = msg === "Brief not found" || msg === "Post not found" ? 404 : 400;
    return NextResponse.json({ error: msg }, { status });
  }
}
