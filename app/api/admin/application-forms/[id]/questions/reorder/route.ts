import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { reorderQuestions } from "@/services/application-forms";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

/** POST /api/admin/application-forms/[id]/questions/reorder */
export async function POST(request: Request, ctx: Ctx) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, PERMISSIONS.APPLICATIONS_MANAGE))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: formId } = await ctx.params;
  const body = (await request.json().catch(() => null)) as { ordered_ids?: string[] } | null;
  const orderedIds = body?.ordered_ids;
  if (!Array.isArray(orderedIds) || orderedIds.some((x) => typeof x !== "string")) {
    return NextResponse.json({ error: "ordered_ids required" }, { status: 400 });
  }

  try {
    const questions = await reorderQuestions(formId, orderedIds);
    return NextResponse.json({ questions });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Reorder failed";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
