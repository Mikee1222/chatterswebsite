import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { isApplicationFormStatus, parsePipelineConfig } from "@/lib/application-forms-types";
import {
  deleteApplicationForm,
  getApplicationFormById,
  updateApplicationForm,
} from "@/services/application-forms";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/admin/application-forms/[id] */
export async function GET(_request: Request, ctx: Ctx) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, PERMISSIONS.APPLICATIONS_VIEW))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await ctx.params;
  try {
    const form = await getApplicationFormById(id);
    if (!form) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ form });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to load form";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/** PATCH /api/admin/application-forms/[id] */
export async function PATCH(request: Request, ctx: Ctx) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, PERMISSIONS.APPLICATIONS_MANAGE))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await ctx.params;
  const body = (await request.json().catch(() => null)) as {
    title?: string;
    description?: string;
    slug?: string;
    status?: string;
    pipeline_config?: unknown;
  } | null;

  try {
    const form = await updateApplicationForm(id, {
      title: body?.title,
      description: body?.description,
      slug: body?.slug,
      status: body?.status && isApplicationFormStatus(body.status) ? body.status : undefined,
      pipeline_config: Array.isArray(body?.pipeline_config)
        ? parsePipelineConfig(body!.pipeline_config)
        : undefined,
    });
    return NextResponse.json({ form });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Update failed";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

/** DELETE /api/admin/application-forms/[id] */
export async function DELETE(_request: Request, ctx: Ctx) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, PERMISSIONS.APPLICATIONS_MANAGE))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await ctx.params;
  try {
    await deleteApplicationForm(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Delete failed";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
