import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { getVaReviewHistory } from "@/services/marketing-reviews";

export async function GET(_req: Request, ctx: { params: Promise<{ vaId: string }> }) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, PERMISSIONS.MARKETING_VIEW))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { vaId } = await ctx.params;
  const history = await getVaReviewHistory(vaId);
  return NextResponse.json({ history });
}
