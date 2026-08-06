import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import {
  getVideoBunch,
  listSlotsForBunch,
  submitResearcherSlot,
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
  const body = (await req.json()) as { status?: string };
  const status = coerceBunchStatus(body.status);
  try {
    const bunch = await updateVideoBunchStatus(id, status);
    return NextResponse.json({ bunch });
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
    const slot = await submitResearcherSlot({
      bunch_id: id,
      description: String(body.description ?? ""),
      video_link: String(body.video_link ?? ""),
      video_type,
      submitted_by_id: session.airtableUserId ?? session.id,
      submitted_by_name: (session.fullName || session.email || "").trim(),
    });
    return NextResponse.json({ slot });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed" },
      { status: 400 },
    );
  }
}
