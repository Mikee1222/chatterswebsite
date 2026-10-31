import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { getAssignedModelIdsForUser, getPostingBriefById } from "@/services/posting-briefs";
import { saveTrialViews } from "@/services/trial-check";

type Ctx = { params: Promise<{ id: string; postId: string }> };

/**
 * Trial check for ONE post from the posting brief page (Content Flow v1.1).
 * Grid posts are checked automatically by the ClarioSuite auto-detect.
 * Same access as marking a post as posted.
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

  const post = brief.posts.find((p) => p.id === postId);
  if (!post) return NextResponse.json({ error: "Post not found" }, { status: 404 });
  if (post.placement !== "trial") {
    return NextResponse.json(
      { error: "Grid posts are checked automatically from Instagram — only trial posts are typed by hand." },
      { status: 400 },
    );
  }
  if (!post.posted_at) return NextResponse.json({ error: "Mark the post as posted first" }, { status: 400 });

  try {
    const result = await saveTrialViews({
      entries: [{ post_id: postId, views }],
      actorUserId,
      actorName: session.fullName || session.email || undefined,
    });
    const updated = await getPostingBriefById(id);
    const updatedPost = updated?.posts.find((p) => p.id === postId);
    const acct = result.accounts[0];
    return NextResponse.json({
      brief: updated,
      status: updatedPost?.outlier_status ?? "",
      multiple: updatedPost?.outlier_multiple ?? null,
      baseline_count: acct?.baseline_count ?? 0,
      queued: result.newOutliers.some((o) => o.post_id === postId),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed";
    const status = msg === "Brief not found" || msg === "Post not found" ? 404 : 400;
    return NextResponse.json({ error: msg }, { status });
  }
}
