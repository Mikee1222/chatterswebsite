import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { duplicateApplicationForm } from "@/services/application-forms";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

/** POST /api/admin/application-forms/[id]/duplicate */
export async function POST(_request: Request, ctx: Ctx) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, PERMISSIONS.APPLICATIONS_MANAGE))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await ctx.params;
  try {
    const form = await duplicateApplicationForm(id, session.airtableUserId ?? session.id);
    return NextResponse.json({ form }, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Duplicate failed";
    const status = msg === "Form not found" ? 404 : 400;
    return NextResponse.json({ error: msg }, { status });
  }
}
