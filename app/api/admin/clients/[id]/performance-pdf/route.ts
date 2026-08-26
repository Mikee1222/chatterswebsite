import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import {
  getClientPartnershipInflowwStats,
  resolveClientPartnershipModelIds,
} from "@/services/client-partnership-infloww";
import { getInstagramWeeklyProgressReport } from "@/services/instagram-weekly-progress";
import { generateClientMonthlyReport } from "@/services/ai-powered-features";
import { getUserByAirtableId } from "@/services/users";
import { buildClientPerformancePdfBytes } from "@/lib/client-performance-pdf";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

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

/**
 * GET /api/admin/clients/[id]/performance-pdf?yearMonth=YYYY-MM
 * Admin-only branded PDF for Client Gunzo Partnership monthly report.
 */
export async function GET(
  request: Request,
  { params }: { params: { id: string } },
) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, PERMISSIONS.CLIENTS_VIEW))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const clientId = decodeURIComponent(params.id ?? "").trim();
  if (!clientId) return NextResponse.json({ error: "Client id required" }, { status: 400 });

  const url = new URL(request.url);
  const yearMonth = url.searchParams.get("yearMonth")?.trim() || defaultYearMonth();
  const bounds = yearMonthBounds(yearMonth);
  if (!bounds) {
    return NextResponse.json({ error: "Invalid yearMonth" }, { status: 400 });
  }

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
          })),
        };
      }
    } catch {
      igSnapshot = null;
    }

    const clientName = user?.full_name?.trim() || "Partner";
    const modelNames = infloww.modelNames.length ? infloww.modelNames : models.modelNames;

    let narrative = "";
    try {
      const ai = await generateClientMonthlyReport({
        clientId,
        yearMonth,
        clientName,
        modelNames,
        inflowwSnapshot: {
          linked: infloww.linked,
          revenue: infloww.revenue,
          fans: infloww.fans,
          ranking: infloww.ranking,
        },
        igSnapshot,
      });
      narrative = ai.text;
    } catch (e) {
      narrative =
        e instanceof Error
          ? `Narrative unavailable: ${e.message}`
          : "Narrative unavailable for this period.";
    }

    const bytes = await buildClientPerformancePdfBytes({
      clientName,
      yearMonth,
      modelNames,
      narrative,
      stats: {
        grossRevenue: infloww.revenue?.gross ?? null,
        netRevenue: infloww.revenue?.net ?? null,
        activeFans: infloww.fans?.active ?? null,
        newFans: infloww.fans?.new_subscribers ?? null,
        renewals: infloww.fans?.renewals ?? null,
        autoRenewPct:
          infloww.fans?.renew_on_share != null
            ? infloww.fans.renew_on_share * 100
            : null,
      },
      dailyRevenue: (infloww.revenue?.dailyTrend ?? []).map((d) => ({
        date: d.date,
        gross: d.gross,
      })),
    });

    const filename = `gunzo-partnership-${yearMonth}-${clientId.slice(0, 8)}.pdf`;
    return new NextResponse(Buffer.from(bytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "PDF failed";
    console.error("[performance-pdf]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
