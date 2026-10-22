import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import {
  getRecordingBriefById,
  transitionRecordingBriefStatus,
  updateRecordingBrief,
  type RecordingBriefInput,
  type RecordingBriefStatus,
} from "@/services/recording-briefs";
import {
  canAccessRecordingBrief,
  getRecordingBriefCapabilities,
} from "@/lib/recording-briefs-access";
import { getUserByAirtableId } from "@/services/users";
import { BriefTransitionError } from "@/lib/brief-status-transitions";

type Ctx = { params: Promise<{ id: string }> };

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

export async function GET(_req: Request, ctx: Ctx) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const caps = await getRecordingBriefCapabilities(session);
  if (!caps.length) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await ctx.params;
  try {
    const brief = await getRecordingBriefById(id);
    if (!brief) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const linked = await linkedModelIdsForSession(session);
    if (!canAccessRecordingBrief(caps, brief.model_id, linked)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (
      !caps.includes("manage") &&
      !caps.includes("view_all") &&
      brief.status !== "published" &&
      brief.status !== "uploaded"
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({
      brief,
      canManage: caps.includes("manage"),
      canViewOwn: caps.includes("view_own"),
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

  const caps = await getRecordingBriefCapabilities(session);
  if (!caps.length) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await ctx.params;
  const body = (await req.json()) as Partial<RecordingBriefInput> & {
    status?: RecordingBriefStatus;
  };
  const actorUserId = session.airtableUserId ?? session.id;

  try {
    if (body.status && Object.keys(body).length === 1) {
      const existing = await getRecordingBriefById(id);
      if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
      const linked = await linkedModelIdsForSession(session);
      const ownsModel = linked.includes(existing.model_id.trim());
      const brief = await transitionRecordingBriefStatus({
        id,
        to: body.status,
        capabilities: caps,
        ownsModel,
        actorUserId,
      });
      return NextResponse.json({ brief });
    }

    if (!(await hasPermission(session, PERMISSIONS.RECORDING_BRIEFS_MANAGE))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const brief = await updateRecordingBrief(id, body, {
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
  if (!(await hasPermission(session, PERMISSIONS.RECORDING_BRIEFS_MANAGE))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await ctx.params;
  try {
    const brief = await transitionRecordingBriefStatus({
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
