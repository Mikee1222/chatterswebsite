import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { activateBriefsForSlot, isSlotRecordingBriefApproved } from "@/services/brief-slot-links";

/**
 * "Publish now" retry. When a recording brief is approved, the idea's draft editing / posting
 * briefs go live automatically; one that could not (e.g. an editing brief with no editor)
 * stays a draft. After fixing it, a manager runs the same activation again from the brief.
 *
 * [id] = winner video id of the slot. Each caller only publishes the kinds they manage.
 */
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [canEditing, canPosting] = await Promise.all([
    hasPermission(session, PERMISSIONS.EDITING_BRIEFS_MANAGE),
    hasPermission(session, PERMISSIONS.POSTING_BRIEFS_MANAGE),
  ]);
  const kinds: ("editing" | "posting")[] = [];
  if (canEditing) kinds.push("editing");
  if (canPosting) kinds.push("posting");
  if (!kinds.length) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await ctx.params;
  if (!(await isSlotRecordingBriefApproved(id))) {
    return NextResponse.json(
      { error: "The recording brief of this idea is not approved yet" },
      { status: 409 },
    );
  }
  const briefs = await activateBriefsForSlot(id, session.airtableUserId ?? session.id, kinds);
  return NextResponse.json({ briefs });
}
