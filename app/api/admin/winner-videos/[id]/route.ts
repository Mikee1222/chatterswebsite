import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import {
  approveWinnerVideo,
  getWinnerVideoById,
  rejectWinnerVideo,
  updateWinnerVideoAdminInstructions,
  updateWinnerVideoSourcingType,
  updateWinnerVideoStatus,
} from "@/services/winner-videos";
import { coerceWinnerVideoQualityRating, coerceWinnerVideoStatus } from "@/lib/winner-videos-helpers";

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, PERMISSIONS.WINNER_VIDEOS_MANAGE))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await ctx.params;
  const body = (await req.json()) as Record<string, unknown>;
  const action = String(body.action ?? "").trim();
  const reviewerName = (session.fullName || session.email || "").trim();

  if (action === "approve" || action === "approve_and_move") {
    const existing = await getWinnerVideoById(id);
    const isBunchFind = Boolean(existing?.bunch_id?.trim());
    const assigned_creator_name = String(body.assigned_creator_name ?? "").trim();
    if (!isBunchFind && !assigned_creator_name) {
      return NextResponse.json({ error: "Creator name is required" }, { status: 400 });
    }
    const target_bunch_id = action === "approve_and_move" ? String(body.target_bunch_id ?? "").trim() : "";
    if (action === "approve_and_move" && !target_bunch_id) {
      return NextResponse.json({ error: "Target bunch is required" }, { status: 400 });
    }
    try {
      const video = await approveWinnerVideo(id, {
        assigned_creator_name,
        recreation_deadline: null,
        assigned_creative_id: String(body.assigned_creative_id ?? "").trim() || undefined,
        assigned_creative_name: String(body.assigned_creative_name ?? "").trim() || undefined,
        reviewed_by_name: reviewerName,
        reviewed_by_id: session.airtableUserId ?? session.id,
        quality_rating: coerceWinnerVideoQualityRating(body.quality_rating),
        admin_instructions: body.admin_instructions !== undefined ? String(body.admin_instructions ?? "") : undefined,
        target_bunch_id: target_bunch_id || undefined,
      });
      return NextResponse.json({ video });
    } catch (err) {
      return NextResponse.json({ error: err instanceof Error ? err.message : "Could not approve" }, { status: 400 });
    }
  }
  if (action === "reject") {
    const rejection_reason = String(body.rejection_reason ?? "").trim();
    if (!rejection_reason) return NextResponse.json({ error: "Rejection reason is required" }, { status: 400 });
    const video = await rejectWinnerVideo(id, {
      rejection_reason,
      reviewed_by_name: reviewerName,
      reviewed_by_id: session.airtableUserId ?? session.id,
    });
    return NextResponse.json({ video });
  }
  if (action === "status") {
    const video = await updateWinnerVideoStatus(id, {
      status: coerceWinnerVideoStatus(body.status),
      recreation_link: body.recreation_link != null ? String(body.recreation_link) : undefined,
      reviewed_by_name: reviewerName,
      reviewed_by_id: session.airtableUserId ?? session.id,
    });
    return NextResponse.json({ video });
  }
  if (action === "update_video_type") {
    try {
      const video = await updateWinnerVideoSourcingType(id, {
        sourcing_video_type: String(body.sourcing_video_type ?? body.video_type ?? ""),
        video_type_other: String(body.video_type_other ?? ""),
      });
      return NextResponse.json({ video });
    } catch (err) {
      return NextResponse.json({ error: err instanceof Error ? err.message : "Could not update video type" }, { status: 400 });
    }
  }
  if (action === "update_admin_instructions") {
    try {
      const video = await updateWinnerVideoAdminInstructions(id, String(body.admin_instructions ?? ""));
      return NextResponse.json({ video });
    } catch (err) {
      return NextResponse.json({ error: err instanceof Error ? err.message : "Could not update" }, { status: 400 });
    }
  }
  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
