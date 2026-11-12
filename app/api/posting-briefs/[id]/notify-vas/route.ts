import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { notifyVasToPostNow } from "@/services/posting-briefs";

/** The Marketing Manager tells the VAs assigned to the brief's model to post now. */
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const [canPosting, canMarketing] = await Promise.all([
    hasPermission(session, PERMISSIONS.POSTING_BRIEFS_MANAGE),
    hasPermission(session, PERMISSIONS.MARKETING_MANAGE),
  ]);
  if (!canPosting && !canMarketing) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await ctx.params;
  try {
    const result = await notifyVasToPostNow({ id, actorUserId: session.airtableUserId ?? session.id });
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed" }, { status: 400 });
  }
}
