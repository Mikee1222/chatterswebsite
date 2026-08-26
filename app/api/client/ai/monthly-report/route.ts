import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import {
  getClientPartnershipInflowwStats,
  resolveClientPartnershipModelIds,
} from "@/services/client-partnership-infloww";
import { getInstagramWeeklyProgressReport } from "@/services/instagram-weekly-progress";
import {
  AI_FEATURE_KEYS,
  generateClientMonthlyReport,
} from "@/services/ai-powered-features";
import { getAiFeatureCache, isAiCacheStale } from "@/services/ai-feature-cache";
import { getUserByAirtableId } from "@/services/users";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MONTH_MS = 32 * 24 * 60 * 60 * 1000;

function yearMonthBounds(yearMonth: string): { start: string; end: string } | null {
  const m = /^(\d{4})-(\d{2})$/.exec(yearMonth.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  if (!Number.isFinite(y) || mo < 1 || mo > 12) return null;
  const lastDay = new Date(Date.UTC(y, mo, 0)).getUTCDate();
  const start = `${m[1]}-${m[2]}-01`;
  const end = `${m[1]}-${m[2]}-${String(lastDay).padStart(2, "0")}`;
  return { start, end };
}

function defaultYearMonth(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

async function resolveClientId(session: { id: string; airtableUserId?: string | null; role: string }) {
  return session.airtableUserId?.trim() || session.id;
}

/**
 * GET/POST /api/client/ai/monthly-report — client-facing monthly narrative.
 */
export async function GET(request: Request) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "client") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(request.url);
  const yearMonth = url.searchParams.get("yearMonth")?.trim() || defaultYearMonth();
  const clientId = await resolveClientId(session);
  const cacheKey = `${clientId}:${yearMonth}`;
  const cached = await getAiFeatureCache(AI_FEATURE_KEYS.CLIENT_MONTHLY_REPORT, cacheKey);
  if (!cached || isAiCacheStale(cached, MONTH_MS)) {
    return NextResponse.json({ text: null, generated_at: null, cached: false, yearMonth });
  }
  return NextResponse.json({
    text: cached.content_text,
    generated_at: cached.generated_at,
    cached: true,
    yearMonth,
  });
}

export async function POST(request: Request) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "client") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    yearMonth?: string;
    force?: boolean;
  };
  const yearMonth = String(body.yearMonth ?? "").trim() || defaultYearMonth();
  const bounds = yearMonthBounds(yearMonth);
  if (!bounds) {
    return NextResponse.json({ error: "Invalid yearMonth (YYYY-MM)" }, { status: 400 });
  }

  const clientId = await resolveClientId(session);

  try {
    const [user, infloww, models] = await Promise.all([
      getUserByAirtableId(clientId).catch(() => null),
      getClientPartnershipInflowwStats(clientId, "custom", bounds.start, bounds.end),
      resolveClientPartnershipModelIds(clientId),
    ]);

    let igSnapshot: Record<string, unknown> | null = null;
    const [y, mo] = yearMonth.split("-").map(Number) as [number, number];
    try {
      const report = await getInstagramWeeklyProgressReport(y, mo);
      const scoped = report.models.filter((m) => models.modelRecordIds.includes(m.modelId));
      if (scoped.length > 0) {
        igSnapshot = {
          month: yearMonth,
          models: scoped.map((m) => ({
            name: m.modelName,
            month_totals: m.month_totals,
            weeks: m.weeks.map((w) => ({
              label: w.displayLabel,
              reach: w.totals.reach,
              reach_wow: w.wow.reach.pct_change,
              insights: w.insights.map((i) => i.label),
            })),
          })),
        };
      }
    } catch {
      igSnapshot = null;
    }

    const result = await generateClientMonthlyReport({
      clientId,
      yearMonth,
      clientName: user?.full_name?.trim() || "Partner",
      modelNames: infloww.modelNames.length ? infloww.modelNames : models.modelNames,
      inflowwSnapshot: {
        linked: infloww.linked,
        revenue: infloww.revenue,
        fans: infloww.fans,
        ranking: infloww.ranking,
        marketing: infloww.marketing.slice(0, 20),
      } as unknown as Record<string, unknown>,
      igSnapshot,
      force: Boolean(body.force),
    });
    return NextResponse.json({ ...result, yearMonth });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to generate report";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
