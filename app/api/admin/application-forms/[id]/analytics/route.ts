import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { getApplicationFormById } from "@/services/application-forms";
import { getApplicationLinkAnalyticsSummary } from "@/services/application-link-analytics";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/admin/application-forms/[id]/analytics */
export async function GET(request: Request, ctx: Ctx) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(session, PERMISSIONS.APPLICATIONS_VIEW)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await ctx.params;
  const form = await getApplicationFormById(id);
  if (!form) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const url = new URL(request.url);
  const presetRaw = url.searchParams.get("preset") ?? "30d";
  const preset =
    presetRaw === "7d" || presetRaw === "30d" || presetRaw === "90d" || presetRaw === "all"
      ? presetRaw
      : "30d";
  const granularity =
    url.searchParams.get("granularity") === "week" ? "week" : "day";

  try {
    const analytics = await getApplicationLinkAnalyticsSummary({
      formId: id,
      preset,
      granularity,
      pipelineConfig: form.pipeline_config,
    });
    return NextResponse.json({ analytics });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to load analytics";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
