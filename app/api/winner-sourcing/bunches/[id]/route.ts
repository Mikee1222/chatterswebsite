import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import {
  assignCreativeToBunch,
  deleteVideoBunch,
  getVideoBunch,
  getVideoBunchDeleteImpact,
  listSlotsForBunch,
  submitResearcherBunchFind,
  updateVideoBunchStatus,
} from "@/services/winner-sourcing";
import { assignFilmerToBunch } from "@/services/filming";
import { listUsersWithPermission } from "@/services/users";
import { coerceBunchStatus, coerceSlotVideoType } from "@/lib/winner-sourcing-helpers";
import { listFoldersForBunch } from "@/services/icloud";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const canManage = await hasPermission(session, PERMISSIONS.WINNER_SOURCING_MANAGE);
  const canSubmit = await hasPermission(session, PERMISSIONS.WINNER_SOURCING_SUBMIT);
  if (!canManage && !canSubmit) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await params;
  const wantImpact = new URL(req.url).searchParams.get("delete_impact") === "1";
  if (wantImpact) {
    if (!canManage) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const impact = await getVideoBunchDeleteImpact(id);
    if (!impact) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ impact });
  }
  const [bunch, slots, folders] = await Promise.all([
    getVideoBunch(id),
    listSlotsForBunch(id),
    canManage ? listFoldersForBunch(id).catch(() => []) : Promise.resolve([]),
  ]);
  if (!bunch) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ bunch, slots, folders });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, PERMISSIONS.WINNER_SOURCING_MANAGE))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await params;
  try {
    const impact = await deleteVideoBunch(id);
    return NextResponse.json({ ok: true, impact });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed";
    const status = message === "Bunch not found" ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = (await req.json()) as Record<string, unknown>;
  try {
    if (body.assigned_filmer_id !== undefined || body.action === "assign_filmer") {
      if (!(await hasPermission(session, PERMISSIONS.FILMING_MANAGE))) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      let filmerId = String(body.assigned_filmer_id ?? "").trim();
      let filmerName = String(body.assigned_filmer_name ?? "").trim();
      if (filmerId && !filmerName) {
        const filmers = await listUsersWithPermission(PERMISSIONS.FILMING_VIEW_ASSIGNMENTS);
        const match = filmers.find((u) => u.id === filmerId);
        filmerName = (match?.full_name || match?.email || "").trim();
      }
      const bunch = await assignFilmerToBunch({
        bunch_id: id,
        assigned_filmer_id: filmerId,
        assigned_filmer_name: filmerName,
        actor_user_id: session.airtableUserId ?? session.id,
        actor_user_name: (session.fullName || session.email || "").trim(),
      });
      return NextResponse.json({ bunch });
    }

    if (body.assigned_editor_id !== undefined || body.action === "assign_editor") {
      if (!(await hasPermission(session, PERMISSIONS.EDITING_MANAGE))) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      let editorId = String(body.assigned_editor_id ?? "").trim();
      let editorName = String(body.assigned_editor_name ?? "").trim();
      if (editorId && !editorName) {
        const editors = await listUsersWithPermission(PERMISSIONS.EDITING_VIEW_ASSIGNMENTS);
        const match = editors.find((u) => u.id === editorId);
        editorName = (match?.full_name || match?.email || "").trim();
      }
      const { assignEditorToBunch } = await import("@/services/editing");
      const bunch = await assignEditorToBunch({
        bunch_id: id,
        assigned_editor_id: editorId,
        assigned_editor_name: editorName,
        actor_user_id: session.airtableUserId ?? session.id,
        actor_user_name: (session.fullName || session.email || "").trim(),
      });
      return NextResponse.json({ bunch });
    }

    if (!(await hasPermission(session, PERMISSIONS.WINNER_SOURCING_MANAGE))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (body.assigned_creative_id !== undefined || body.action === "assign_creative") {
      const result = await assignCreativeToBunch({
        bunch_id: id,
        assigned_creative_id: String(body.assigned_creative_id ?? ""),
        assigned_creative_name: String(body.assigned_creative_name ?? ""),
        actor_user_id: session.airtableUserId ?? session.id,
        actor_user_name: (session.fullName || session.email || "").trim(),
      });
      return NextResponse.json(result);
    }
    if (body.status !== undefined) {
      const status = coerceBunchStatus(body.status);
      const bunch = await updateVideoBunchStatus(id, status);
      return NextResponse.json({ bunch });
    }
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed" },
      { status: 400 },
    );
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, PERMISSIONS.WINNER_SOURCING_SUBMIT))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await params;
  const body = (await req.json()) as Record<string, unknown>;
  const video_type = coerceSlotVideoType(body.video_type);
  if (!video_type) {
    return NextResponse.json(
      { error: "video_type required (skit/ugc/text_on_screen/interview/clips/other)" },
      { status: 400 },
    );
  }
  if (video_type === "other" && !String(body.video_type_other ?? "").trim()) {
    return NextResponse.json(
      { error: "video_type_other required when type is Other" },
      { status: 400 },
    );
  }
  try {
    const video = await submitResearcherBunchFind({
      bunch_id: id,
      description: String(body.description ?? ""),
      video_link: String(body.video_link ?? ""),
      video_type,
      video_type_other: String(body.video_type_other ?? ""),
      submitted_by_id: session.airtableUserId ?? session.id,
      submitted_by_name: (session.fullName || session.email || "").trim(),
      force_duplicate: Boolean(body.force_duplicate),
    });
    return NextResponse.json({ video });
  } catch (e) {
    const err = e as Error & { code?: string; duplicate_id?: string };
    if (err.code === "DUPLICATE_LINK") {
      return NextResponse.json(
        { error: err.message, duplicate: true, duplicate_id: err.duplicate_id },
        { status: 409 },
      );
    }
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed" },
      { status: 400 },
    );
  }
}
