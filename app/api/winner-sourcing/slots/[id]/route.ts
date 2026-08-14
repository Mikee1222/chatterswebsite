import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import {
  assignCreativeToSlot,
  deleteRecreateVideoSlot,
  getRecreateVideoSlotDeleteImpact,
  updateSlotContent,
} from "@/services/winner-sourcing";
import { coerceSlotVideoType } from "@/lib/winner-sourcing-helpers";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, PERMISSIONS.WINNER_SOURCING_MANAGE))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await params;
  const wantImpact = new URL(req.url).searchParams.get("delete_impact") === "1";
  if (!wantImpact) {
    return NextResponse.json({ error: "Unsupported request" }, { status: 400 });
  }
  const impact = await getRecreateVideoSlotDeleteImpact(id);
  if (!impact) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ impact });
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
    const impact = await deleteRecreateVideoSlot({
      slot_id: id,
      actor_user_id: session.airtableUserId ?? session.id,
      actor_user_name: (session.fullName || session.email || "").trim(),
    });
    return NextResponse.json({ ok: true, impact });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed";
    const status = message === "Slot not found" ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
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
    const slot = await updateSlotContent(id, {
      description: body.description !== undefined ? String(body.description) : undefined,
      video_link: body.video_link !== undefined ? String(body.video_link) : undefined,
      video_type:
        body.video_type !== undefined ? coerceSlotVideoType(body.video_type) : undefined,
      video_type_other:
        body.video_type_other !== undefined ? String(body.video_type_other) : undefined,
    });
    return NextResponse.json({ slot });
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
  if (!(await hasPermission(session, PERMISSIONS.WINNER_SOURCING_MANAGE))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await params;
  const body = (await req.json()) as Record<string, unknown>;
  const action = String(body.action ?? "assign_creative");
  if (action !== "assign_creative") {
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }
  try {
    const slot = await assignCreativeToSlot({
      slot_id: id,
      assigned_creative_id: String(body.assigned_creative_id ?? ""),
      assigned_creative_name: String(body.assigned_creative_name ?? ""),
      assigned_creator_name: String(body.assigned_creator_name ?? ""),
      actor_user_id: session.airtableUserId ?? session.id,
      actor_user_name: (session.fullName || session.email || "").trim(),
    });
    return NextResponse.json({ slot });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed" },
      { status: 400 },
    );
  }
}
