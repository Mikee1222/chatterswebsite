import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import {
  createEditingBrief,
  listEditingBriefs,
  type EditingBriefInput,
  type EditingBriefPriority,
  type EditingBriefStatus,
} from "@/services/editing-briefs";
import { sessionUserIds } from "@/lib/editing-briefs-access";

export async function GET(req: Request) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const canManage = await hasPermission(session, PERMISSIONS.EDITING_BRIEFS_MANAGE);
  const canViewAssigned = await hasPermission(
    session,
    PERMISSIONS.EDITING_BRIEFS_VIEW_ASSIGNED,
  );
  const canReview = await hasPermission(session, PERMISSIONS.EDITING_BRIEFS_REVIEW);
  const canViewAll = await hasPermission(session, PERMISSIONS.EDITING_BRIEFS_VIEW_ALL);
  if (!canManage && !canViewAssigned && !canReview && !canViewAll) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const statusParam =
    url.searchParams.get("status") ?? (canManage || canReview || canViewAll ? "all" : "active");
  const modelId = url.searchParams.get("model_id") ?? undefined;
  const priority = (url.searchParams.get("priority") ?? "all") as EditingBriefPriority | "all";

  try {
    let briefs = await listEditingBriefs({
      status: statusParam as EditingBriefStatus | "all" | "active",
      model_id: modelId,
      priority,
    });

    if (!canManage && !canViewAll && !canReview) {
      const ids = new Set(sessionUserIds(session));
      briefs = briefs.filter(
        (b) =>
          ids.has(b.assigned_editor_id.trim()) &&
          b.status !== "draft" &&
          b.status !== "archived",
      );
    }

    return NextResponse.json({
      briefs,
      canManage,
      canViewAssigned,
      canReview,
      canViewAll,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to list briefs" },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, PERMISSIONS.EDITING_BRIEFS_MANAGE))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json()) as EditingBriefInput;
  try {
    const brief = await createEditingBrief(
      {
        ...body,
        created_by: session.airtableUserId ?? session.id,
      },
      { notify: true, actorUserId: session.airtableUserId ?? session.id },
    );
    return NextResponse.json({ brief }, { status: 201 });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to create brief" },
      { status: 400 },
    );
  }
}
