import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import {
  getEditingBriefById,
  transitionEditingBriefStatus,
  updateEditingBrief,
  type EditingBriefInput,
  type EditingBriefStatus,
} from "@/services/editing-briefs";
import {
  canAccessEditingBrief,
  getEditingBriefCapabilities,
  sessionUserIds,
} from "@/lib/editing-briefs-access";
import { BriefTransitionError } from "@/lib/brief-status-transitions";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const caps = await getEditingBriefCapabilities(session);
  if (!caps.length) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await ctx.params;
  try {
    const brief = await getEditingBriefById(id);
    if (!brief) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const userIds = sessionUserIds(session);
    const assignedOk = userIds.some((uid) =>
      canAccessEditingBrief(caps, brief.assigned_editor_id, uid),
    );
    if (!assignedOk) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (
      !caps.includes("manage") &&
      !caps.includes("view_all") &&
      !caps.includes("review") &&
      (brief.status === "draft" || brief.status === "archived")
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json({
      brief,
      canManage: caps.includes("manage"),
      canViewAssigned: caps.includes("view_assigned"),
      canReview: caps.includes("review"),
      canViewAll: caps.includes("view_all"),
    });
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

  const caps = await getEditingBriefCapabilities(session);
  if (!caps.length) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await ctx.params;
  const body = (await req.json()) as Partial<EditingBriefInput> & {
    status?: EditingBriefStatus;
    reviewer_comment?: string;
  };
  const actorUserId = session.airtableUserId ?? session.id;

  try {
    if (body.status && (Object.keys(body).length === 1 || (Object.keys(body).length === 2 && body.reviewer_comment !== undefined))) {
      const existing = await getEditingBriefById(id);
      if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
      const userIds = sessionUserIds(session);
      const isAssignedEditor = userIds.includes(existing.assigned_editor_id.trim());
      const brief = await transitionEditingBriefStatus({
        id,
        to: body.status,
        capabilities: caps,
        isAssignedEditor,
        reviewerComment: body.reviewer_comment,
        actorUserId,
      });
      return NextResponse.json({ brief });
    }

    if (!(await hasPermission(session, PERMISSIONS.EDITING_BRIEFS_MANAGE))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const brief = await updateEditingBrief(id, body, {
      notify: true,
      actorUserId,
    });
    return NextResponse.json({ brief });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed";
    const status =
      e instanceof BriefTransitionError ? 403 : msg === "Brief not found" ? 404 : 400;
    return NextResponse.json({ error: msg }, { status });
  }
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, PERMISSIONS.EDITING_BRIEFS_MANAGE))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await ctx.params;
  try {
    const brief = await transitionEditingBriefStatus({
      id,
      to: "archived",
      capabilities: ["manage"],
      actorUserId: session.airtableUserId ?? session.id,
    });
    return NextResponse.json({ brief });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed";
    return NextResponse.json({ error: msg }, { status: msg === "Brief not found" ? 404 : 400 });
  }
}
