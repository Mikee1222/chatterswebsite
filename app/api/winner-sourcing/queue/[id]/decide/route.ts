import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { decideQueueItem } from "@/services/winner-sourcing";

/**
 * Content Flow v1.1 — CD / HoM decision on a recreation-queue item:
 *   grid   → trial outlier: the same file goes to the grid first (then recreation)
 *   urgent → recreate now (uses one of the model's urgent slots this month)
 *   no     → drop it
 * "next_bunch" is implicit: assign it to a bunch with /assign.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const canWinner = await hasPermission(session, PERMISSIONS.WINNER_SOURCING_MANAGE);
  const canExperimental = await hasPermission(session, PERMISSIONS.EXPERIMENTAL_BUNCH_MANAGE);
  if (!canWinner && !canExperimental) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as {
    decision?: string;
    grid_posting_brief_id?: string | null;
  };
  const decision = body.decision;
  if (decision !== "grid" && decision !== "urgent" && decision !== "no") {
    return NextResponse.json({ error: "decision must be grid | urgent | no" }, { status: 400 });
  }
  try {
    const item = await decideQueueItem({
      queue_item_id: id,
      decision,
      actor_id: session.airtableUserId ?? session.id,
      grid_posting_brief_id: body.grid_posting_brief_id ?? null,
    });
    return NextResponse.json({ item });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed" },
      { status: 400 },
    );
  }
}
