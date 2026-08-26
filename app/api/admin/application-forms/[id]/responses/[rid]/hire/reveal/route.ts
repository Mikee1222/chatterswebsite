import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { revealHirePassword } from "@/services/application-hire";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string; rid: string }> };

/**
 * POST /api/admin/application-forms/[id]/responses/[rid]/hire/reveal
 * Reveal or copy hire credentials (audit-logged).
 */
export async function POST(request: Request, ctx: Ctx) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, PERMISSIONS.APPLICATIONS_MANAGE))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: formId, rid } = await ctx.params;
  const body = (await request.json().catch(() => null)) as {
    action?: "revealed" | "copied";
    field?: "username" | "password";
  } | null;

  const action = body?.action === "copied" ? "copied" : "revealed";
  const field = body?.field === "username" ? "username" : "password";

  try {
    const result = await revealHirePassword({
      responseId: rid,
      formId,
      action,
      field,
      actor: {
        userId: session.airtableUserId ?? session.id,
        userName: session.fullName ?? session.email ?? "Admin",
      },
    });
    return NextResponse.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Reveal failed";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
