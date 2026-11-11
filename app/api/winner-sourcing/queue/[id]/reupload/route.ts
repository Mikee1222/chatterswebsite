import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { updateReuploadQueueItem } from "@/services/winner-sourcing";
import { notifyReuploadToAssignedVas } from "@/services/reupload-queue";

/**
 * Reupload queue (trial-grid outlier → same file to the main grid):
 *   mark_reuploaded → the file is live on the main grid
 *   unmark          → undo
 *   to_recreation   → move the item to the recreation queue
 *   notify_vas      → Marketing Manager pings the VAs assigned to the model to reupload it
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const canWinner = await hasPermission(session, PERMISSIONS.WINNER_SOURCING_MANAGE);
  const canPosting = await hasPermission(session, PERMISSIONS.POSTING_BRIEFS_MANAGE);
  if (!canWinner && !canPosting) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as { action?: string };
  const action = body.action;
  const actorId = session.airtableUserId ?? session.id;
  if (action === "notify_vas") {
    try {
      const result = await notifyReuploadToAssignedVas({ queue_item_id: id, actor_id: actorId });
      return NextResponse.json(result);
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "Failed" },
        { status: 400 },
      );
    }
  }
  if (action !== "mark_reuploaded" && action !== "unmark" && action !== "to_recreation") {
    return NextResponse.json(
      { error: "action must be mark_reuploaded | unmark | to_recreation | notify_vas" },
      { status: 400 },
    );
  }
  try {
    const item = await updateReuploadQueueItem({
      queue_item_id: id,
      action,
      actor_id: actorId,
    });
    return NextResponse.json({ item });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed" },
      { status: 400 },
    );
  }
}
