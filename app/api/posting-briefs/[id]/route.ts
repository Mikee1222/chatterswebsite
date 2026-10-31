import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import {
  getAssignedModelIdsForUser,
  getPostingBriefById,
  setPostingBriefStatus,
  updatePostingBrief,
  type PostingBriefInput,
  type PostingBriefStatus,
} from "@/services/posting-briefs";

type Ctx = { params: Promise<{ id: string }> };

async function canAccessBrief(
  session: { id: string; airtableUserId?: string | null },
  briefModelId: string,
  canManage: boolean,
): Promise<boolean> {
  if (canManage) return true;
  const idsA = await getAssignedModelIdsForUser(session.airtableUserId ?? session.id);
  const idsB =
    session.airtableUserId && session.airtableUserId !== session.id
      ? await getAssignedModelIdsForUser(session.id)
      : [];
  const allowed = new Set([...idsA, ...idsB]);
  return allowed.has(briefModelId.trim());
}

export async function GET(_req: Request, ctx: Ctx) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const canManage = await hasPermission(session, PERMISSIONS.POSTING_BRIEFS_MANAGE);
  const canView = await hasPermission(session, PERMISSIONS.POSTING_BRIEFS_VIEW);
  if (!canManage && !canView) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await ctx.params;
  try {
    const brief = await getPostingBriefById(id);
    if (!brief) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (!(await canAccessBrief(session, brief.model_id, canManage))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (!canManage && brief.status === "draft") {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ brief, canManage });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed" },
      { status: 500 },
    );
  }
}

export async function PATCH(req: Request, ctx: Ctx) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, PERMISSIONS.POSTING_BRIEFS_MANAGE))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await ctx.params;
  const body = (await req.json()) as Partial<PostingBriefInput> & {
    status?: PostingBriefStatus;
  };

  try {
    if (
      body.status &&
      Object.keys(body).length === 1
    ) {
      // Draft → Active is a publish: notify assigned VAs. Archive / restore stay silent.
      if (body.status === "active") {
        const existing = await getPostingBriefById(id);
        if (existing?.status === "draft") {
          const brief = await updatePostingBrief(
            id,
            { status: "active" },
            { notify: true, actorUserId: session.airtableUserId ?? session.id },
          );
          return NextResponse.json({ brief });
        }
      }
      const brief = await setPostingBriefStatus(id, body.status);
      return NextResponse.json({ brief });
    }
    const brief = await updatePostingBrief(id, body, {
      notify: true,
      actorUserId: session.airtableUserId ?? session.id,
    });
    return NextResponse.json({ brief });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed";
    const status = msg === "Brief not found" ? 404 : 400;
    return NextResponse.json({ error: msg }, { status });
  }
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, PERMISSIONS.POSTING_BRIEFS_MANAGE))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await ctx.params;
  try {
    const brief = await setPostingBriefStatus(id, "archived");
    return NextResponse.json({ brief });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed";
    return NextResponse.json({ error: msg }, { status: msg === "Brief not found" ? 404 : 400 });
  }
}
