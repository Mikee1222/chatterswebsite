import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import {
  getRecreateVideoSlotByWinnerVideoId,
  getRecreateVideoSlotDeleteImpact,
} from "@/services/winner-sourcing";

/** Resolve recreate slot + delete impact preview from a winner_videos id (Research Manage). */
export async function GET(req: Request) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, PERMISSIONS.WINNER_SOURCING_MANAGE))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const winnerVideoId = new URL(req.url).searchParams.get("winner_video_id")?.trim() || "";
  if (!winnerVideoId) {
    return NextResponse.json({ error: "winner_video_id required" }, { status: 400 });
  }

  const slot = await getRecreateVideoSlotByWinnerVideoId(winnerVideoId);
  if (!slot) {
    return NextResponse.json({ slot: null, impact: null });
  }

  const impact = await getRecreateVideoSlotDeleteImpact(slot.id);
  return NextResponse.json({ slot, impact });
}
