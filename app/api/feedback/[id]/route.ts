import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { updateFeedback } from "@/services/feedback";

const ALLOWED_STATUS = new Set(["new", "in_review", "resolved", "wont_fix"]);

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, "feedback:manage"))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as { status?: unknown; admin_notes?: unknown };
  const allowed: { status?: string; admin_notes?: string } = {};
  if (typeof body.status === "string" && ALLOWED_STATUS.has(body.status)) {
    allowed.status = body.status;
  }
  if (body.admin_notes !== undefined) {
    allowed.admin_notes = typeof body.admin_notes === "string" ? body.admin_notes : String(body.admin_notes ?? "");
  }
  await updateFeedback(id, allowed);
  return NextResponse.json({ success: true });
}
