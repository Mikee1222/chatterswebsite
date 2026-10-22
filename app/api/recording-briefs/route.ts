import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import {
  createRecordingBrief,
  listRecordingBriefs,
  type RecordingBriefInput,
  type RecordingBriefPriority,
  type RecordingBriefStatus,
} from "@/services/recording-briefs";
import { getUserByAirtableId } from "@/services/users";

async function linkedModelIdsForSession(session: {
  id: string;
  airtableUserId?: string | null;
}): Promise<string[]> {
  const recordId = (session.airtableUserId ?? session.id)?.trim();
  if (!recordId) return [];
  const row = await getUserByAirtableId(recordId).catch(() => null);
  const ids =
    row?.linked_model_ids?.length
      ? row.linked_model_ids
      : row?.linked_model_id
        ? [row.linked_model_id]
        : [];
  return ids.map((id) => id.trim()).filter(Boolean);
}

export async function GET(req: Request) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const canManage = await hasPermission(session, PERMISSIONS.RECORDING_BRIEFS_MANAGE);
  const canViewOwn = await hasPermission(session, PERMISSIONS.RECORDING_BRIEFS_VIEW_OWN);
  const canViewAll = await hasPermission(session, PERMISSIONS.RECORDING_BRIEFS_VIEW_ALL);
  if (!canManage && !canViewOwn && !canViewAll) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const statusParam = url.searchParams.get("status") ?? (canManage || canViewAll ? "all" : "active");
  const modelId = url.searchParams.get("model_id") ?? undefined;
  const priority = (url.searchParams.get("priority") ?? "all") as RecordingBriefPriority | "all";

  let modelIds: string[] | undefined;
  if (!canManage && !canViewAll) {
    modelIds = await linkedModelIdsForSession(session);
    if (!modelIds.length) return NextResponse.json({ briefs: [], canManage, canViewOwn });
  }

  try {
    let briefs = await listRecordingBriefs({
      status: statusParam as RecordingBriefStatus | "all" | "active",
      model_id: modelId,
      priority,
      model_ids: modelIds,
    });
    // Creators never see draft/archived
    if (!canManage && !canViewAll) {
      briefs = briefs.filter((b) => b.status === "published" || b.status === "uploaded");
    }
    return NextResponse.json({ briefs, canManage, canViewOwn, canViewAll });
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
  if (!(await hasPermission(session, PERMISSIONS.RECORDING_BRIEFS_MANAGE))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json()) as RecordingBriefInput;
  try {
    const brief = await createRecordingBrief(
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
