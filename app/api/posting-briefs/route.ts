import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import {
  createPostingBrief,
  getAssignedModelIdsForUser,
  listPostingBriefs,
  type PostingBriefInput,
  type PostingBriefPriority,
  type PostingBriefStatus,
} from "@/services/posting-briefs";

export async function GET(req: Request) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const canManage = await hasPermission(session, PERMISSIONS.POSTING_BRIEFS_MANAGE);
  const canView = await hasPermission(session, PERMISSIONS.POSTING_BRIEFS_VIEW);
  if (!canManage && !canView) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const requestedStatus = (url.searchParams.get("status") ?? "active") as PostingBriefStatus | "all";
  // Drafts are a manage-only stage: view-only users (VAs) never see them.
  const status: PostingBriefStatus | "all" = canManage ? requestedStatus : "active";
  const modelId = url.searchParams.get("model_id") ?? undefined;
  const account = url.searchParams.get("account") ?? undefined;
  const priority = (url.searchParams.get("priority") ?? "all") as PostingBriefPriority | "all";

  let modelIds: string[] | undefined;
  if (!canManage) {
    const userId = session.airtableUserId ?? session.id;
    modelIds = await getAssignedModelIdsForUser(userId);
    if (session.id !== userId) {
      const also = await getAssignedModelIdsForUser(session.id);
      modelIds = [...new Set([...modelIds, ...also])];
    }
  }

  try {
    const briefs = await listPostingBriefs({
      status,
      model_id: modelId,
      account_handle: account,
      priority,
      model_ids: modelIds,
    });
    return NextResponse.json({ briefs, canManage });
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
  if (!(await hasPermission(session, PERMISSIONS.POSTING_BRIEFS_MANAGE))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json()) as PostingBriefInput;
  try {
    const brief = await createPostingBrief(
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
