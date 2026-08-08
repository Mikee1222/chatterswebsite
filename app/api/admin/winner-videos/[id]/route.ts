import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import {
  approveWinnerVideo,
  getWinnerVideoById,
  rejectWinnerVideo,
  updateWinnerVideoSourcingType,
  updateWinnerVideoStatus,
} from "@/services/winner-videos";
import {
  coerceWinnerVideoQualityRating,
  coerceWinnerVideoStatus,
} from "@/lib/winner-videos-helpers";

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

  if (action === "approve") {
    // Bunch finds inherit target model + creative from the bunch; ungrouped still need a creator.
    const existing = await getWinnerVideoById(id);
    const isBunchFind = Boolean(existing?.bunch_id?.trim());
    const assigned_creator_name = String(body.assigned_creator_name ?? "").trim();
    if (!isBunchFind && !assigned_creator_name) {
      return NextResponse.json({ error: "Creator name is required" }, { status: 400 });
    }
    const assigned_creative_id = String(body.assigned_creative_id ?? "").trim();
    const assigned_creative_name = String(body.assigned_creative_name ?? "").trim();
    const quality_rating = coerceWinnerVideoQualityRating(body.quality_rating);
    const video = await approveWinnerVideo(id, {
      assigned_creator_name,
      recreation_deadline: null,
      assigned_creative_id: assigned_creative_id || undefined,
      assigned_creative_name: assigned_creative_name || undefined,
      reviewed_by_name: reviewerName,
      reviewed_by_id: session.airtableUserId ?? session.id,
      quality_rating,
    });
    return NextResponse.json({ video });
  }

  if (action === "reject") {
    const rejection_reason = String(body.rejection_reason ?? "").trim();
    if (!rejection_reason) {
      return NextResponse.json({ error: "Rejection reason is required" }, { status: 400 });
    }
    const video = await rejectWinnerVideo(id, {
      rejection_reason,
      reviewed_by_name: reviewerName,
      reviewed_by_id: session.airtableUserId ?? session.id,
    });
    return NextResponse.json({ video });
  }

  if (action === "status") {
    const status = coerceWinnerVideoStatus(body.status);
    const video = await updateWinnerVideoStatus(id, {
      status,
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
      const message = err instanceof Error ? err.message : "Could not update video type";
      return NextResponse.json({ error: message }, { status: 400 });
    }
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
