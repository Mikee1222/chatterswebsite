import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { isApplicationResponseStatus } from "@/lib/application-forms-types";
import { getResponseDetail, updateResponse } from "@/services/application-forms";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string; rid: string }> };

/** GET /api/admin/application-forms/[id]/responses/[rid] */
export async function GET(_request: Request, ctx: Ctx) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, PERMISSIONS.APPLICATIONS_VIEW))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { rid } = await ctx.params;
  try {
    const response = await getResponseDetail(rid);
    if (!response) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ response });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to load response";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/** PATCH /api/admin/application-forms/[id]/responses/[rid] */
export async function PATCH(request: Request, ctx: Ctx) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, PERMISSIONS.APPLICATIONS_MANAGE))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { rid } = await ctx.params;
  const body = (await request.json().catch(() => null)) as {
    status?: string;
    internal_notes?: string | null;
  } | null;

  try {
    const response = await updateResponse(rid, {
      status:
        body?.status && isApplicationResponseStatus(body.status) ? body.status : undefined,
      internal_notes: body?.internal_notes,
    });
    return NextResponse.json({ response });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Update failed";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
