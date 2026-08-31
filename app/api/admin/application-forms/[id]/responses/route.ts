import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { isApplicationResponseStatus } from "@/lib/application-forms-types";
import type { ApplicationResponseStatus } from "@/lib/application-forms-types";
import { isPipelineLanguage, type PipelineLanguage } from "@/lib/application-pipeline-i18n";
import {
  getResponsesListAnalytics,
  listResponses,
} from "@/services/application-forms";
import { scheduleResponsesEnrichment } from "@/services/application-response-enrichment";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

function parseOptionalNumber(raw: string | null): number | null {
  if (raw == null || raw.trim() === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

/** GET /api/admin/application-forms/[id]/responses — list with richer filters */
export async function GET(request: Request, ctx: Ctx) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, PERMISSIONS.APPLICATIONS_VIEW))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: formId } = await ctx.params;
  const url = new URL(request.url);
  const statusParam = url.searchParams.get("status") ?? "all";
  const sortParam = url.searchParams.get("sort") ?? "newest";
  type ResponseSort =
    | "newest"
    | "oldest"
    | "cognitive_desc"
    | "cognitive_asc"
    | "eq_desc"
    | "eq_asc"
    | "typing_desc"
    | "typing_asc";
  const sort: ResponseSort =
    sortParam === "oldest" ||
    sortParam === "cognitive_desc" ||
    sortParam === "cognitive_asc" ||
    sortParam === "eq_desc" ||
    sortParam === "eq_asc" ||
    sortParam === "typing_desc" ||
    sortParam === "typing_asc"
      ? sortParam
      : "newest";
  const search = url.searchParams.get("search") ?? undefined;
  const includeAnalytics = url.searchParams.get("analytics") === "1";
  const analyticsOnly = url.searchParams.get("analyticsOnly") === "1";
  const flag = url.searchParams.get("flag")?.trim() || null;
  const langParam = url.searchParams.get("lang") ?? "all";
  const preferredLanguage: PipelineLanguage | "all" =
    langParam === "all" ? "all" : isPipelineLanguage(langParam) ? langParam : "all";

  const status: ApplicationResponseStatus | "all" =
    statusParam === "all"
      ? "all"
      : isApplicationResponseStatus(statusParam)
        ? statusParam
        : "all";

  try {
    if (analyticsOnly) {
      const analytics = await getResponsesListAnalytics(formId);
      return NextResponse.json({ analytics });
    }

    const listOpts = {
      status,
      sort,
      search,
      flag,
      preferredLanguage,
      cognitiveMin: parseOptionalNumber(url.searchParams.get("cognitiveMin")),
      cognitiveMax: parseOptionalNumber(url.searchParams.get("cognitiveMax")),
      eqMin: parseOptionalNumber(url.searchParams.get("eqMin")),
      eqMax: parseOptionalNumber(url.searchParams.get("eqMax")),
      wpmMin: parseOptionalNumber(url.searchParams.get("wpmMin")),
      wpmMax: parseOptionalNumber(url.searchParams.get("wpmMax")),
      submittedFrom: url.searchParams.get("from")?.trim() || null,
      submittedTo: url.searchParams.get("to")?.trim() || null,
    };

    if (!includeAnalytics) {
      const responses = await listResponses(formId, listOpts);
      const needsEnrichment = responses
        .filter((r) => !r.ai_summary)
        .map((r) => r.id);
      if (needsEnrichment.length > 0) {
        scheduleResponsesEnrichment(needsEnrichment);
      }
      return NextResponse.json({ responses });
    }

    const [responses, analytics] = await Promise.all([
      listResponses(formId, listOpts),
      getResponsesListAnalytics(formId),
    ]);
    const needsEnrichment = responses.filter((r) => !r.ai_summary).map((r) => r.id);
    if (needsEnrichment.length > 0) {
      scheduleResponsesEnrichment(needsEnrichment);
    }
    return NextResponse.json({ responses, analytics });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to load responses";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
