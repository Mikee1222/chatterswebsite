import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import {
  assignCreativeToBunch,
  getVideoBunch,
  listSlotsForBunch,
  submitResearcherBunchFind,
  updateVideoBunchStatus,
} from "@/services/winner-sourcing";
import { coerceBunchStatus, coerceSlotVideoType } from "@/lib/winner-sourcing-helpers";

export async function GET(
  _req: Request,
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
  const [bunch, slots] = await Promise.all([getVideoBunch(id), listSlotsForBunch(id)]);
  if (!bunch) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ bunch, slots });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, PERMISSIONS.WINNER_SOURCING_MANAGE))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await params;
  const body = (await req.json()) as Record<string, unknown>;
  try {
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
    return NextResponse.json({ error: "video_type required (skit/ugc/other)" }, { status: 400 });
  }
  try {
    const video = await submitResearcherBunchFind({
      bunch_id: id,
      description: String(body.description ?? ""),
      video_link: String(body.video_link ?? ""),
      video_type,
      submitted_by_id: session.airtableUserId ?? session.id,
      submitted_by_name: (session.fullName || session.email || "").trim(),
    });
    return NextResponse.json({ video });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed" },
      { status: 400 },
    );
  }
}
