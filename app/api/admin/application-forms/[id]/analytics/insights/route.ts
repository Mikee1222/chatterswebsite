import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { generateApplicationFunnelInsight } from "@/lib/application-funnel-insight";
import { getApplicationFormById } from "@/services/application-forms";
import {
  buildAnalyticsInsightSnapshot,
  getApplicationLinkAnalyticsSummary,
  upsertApplicationAnalyticsInsight,
} from "@/services/application-link-analytics";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

/**
 * POST /api/admin/application-forms/[id]/analytics/insights
 * On-demand refresh of cached Anthropic funnel insight (applications:manage).
 */
export async function POST(request: Request, ctx: Ctx) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(session, PERMISSIONS.APPLICATIONS_MANAGE)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await ctx.params;
  const form = await getApplicationFormById(id);
  if (!form) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = (await request.json().catch(() => ({}))) as { preset?: string };
  const presetRaw = body.preset ?? "30d";
  const preset =
    presetRaw === "7d" || presetRaw === "30d" || presetRaw === "90d" || presetRaw === "all"
      ? presetRaw
      : "30d";

  try {
    const analytics = await getApplicationLinkAnalyticsSummary({
      formId: id,
      preset,
      granularity: "day",
      pipelineConfig: form.pipeline_config,
    });
    const snapshot = buildAnalyticsInsightSnapshot(analytics);
    const generated = await generateApplicationFunnelInsight({
      formTitle: form.title,
      snapshot,
    });

    if (!generated) {
      return NextResponse.json(
        {
          error:
            "Could not generate insight. Check ANTHROPIC_API_KEY or try again shortly.",
        },
        { status: 502 },
      );
    }

    const insight = await upsertApplicationAnalyticsInsight({
      formId: id,
      insightText: generated.text,
      funnelSnapshot: snapshot,
      model: generated.model,
    });

    return NextResponse.json({
      insight: {
        text: insight.insight_text,
        generated_at: insight.generated_at,
        model: insight.model,
        stale: false,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to refresh insight";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
