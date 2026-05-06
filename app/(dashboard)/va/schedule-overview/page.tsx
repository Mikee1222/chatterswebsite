import { getSessionFromCookies } from "@/lib/auth";
import { ROUTES } from "@/lib/routes";
import { loadScheduleOverviewPageData } from "@/lib/schedule-overview-page-data";
import { addDays } from "@/lib/weekly-program";
import { redirect } from "next/navigation";
import { AdminModelSchedulesClient } from "@/components/admin-model-schedules-client";

export const dynamic = "force-dynamic";

const WEEKS_PAD = 8;

export default async function VaScheduleOverviewPage({
  searchParams,
}: {
  searchParams?: { week?: string };
}) {
  const user = await getSessionFromCookies();
  if (!user || user.role !== "virtual_assistant") redirect(ROUTES.dashboard);

  const vaId = (user.airtableUserId ?? user.id)?.trim();
  if (!vaId) redirect(ROUTES.dashboard);

  const weekParam = typeof searchParams?.week === "string" ? searchParams.week : "";
  const data = await loadScheduleOverviewPageData({
    weekParam,
    allowedModelIds: null,
  });

  const weekEnd = addDays(data.weekStart, 6);
  const rowsThisWeek = data.rows.filter((r) => r.date >= data.weekStart && r.date <= weekEnd);
  const weekStats = {
    total: rowsThisWeek.length,
    pending: rowsThisWeek.filter((r) => r.normStatus === "pending").length,
    scheduled: rowsThisWeek.filter((r) => r.normStatus === "scheduled").length,
    completed: rowsThisWeek.filter((r) => r.normStatus === "completed").length,
  };

  return (
    <div className="container mx-auto max-w-[1600px] p-4 md:p-6">
      <section className="mb-6 rounded-3xl border border-sky-400/25 bg-gradient-to-br from-zinc-950 via-zinc-950 to-sky-950/25 p-6 shadow-[0_10px_40px_rgba(56,189,248,0.1)]">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/40">Virtual assistant</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-white md:text-3xl">Schedule overview</h1>
        <p className="mt-2 max-w-3xl text-sm text-white/60">
          Read-only agency calendar: model shifts, accepted customs, VA content rows, and live streams. Window loads{" "}
          <span className="text-white/85">{WEEKS_PAD} weeks</span> before and after the selected Monday (
          <span className="font-mono text-white/80">{data.windowStart}</span> –{" "}
          <span className="font-mono text-white/80">{data.windowEnd}</span>
          ).
        </p>
        <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {(
            [
              ["This week · total", weekStats.total],
              ["Pending", weekStats.pending],
              ["Scheduled", weekStats.scheduled],
              ["Completed", weekStats.completed],
            ] as const
          ).map(([label, value]) => (
            <div
              key={label}
              className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 transition hover:border-sky-400/35"
            >
              <p className="text-[11px] font-medium uppercase tracking-wide text-white/45">{label}</p>
              <p className="mt-2 text-2xl font-semibold tabular-nums text-white">{value}</p>
            </div>
          ))}
        </div>
      </section>

      <AdminModelSchedulesClient
        audience="va"
        readOnly
        vaUserId={vaId}
        initialViewMode="timeline"
        initialWeek={data.weekStart}
        windowStart={data.windowStart}
        windowEnd={data.windowEnd}
        models={data.modelOptions}
        rows={data.rows}
      />
    </div>
  );
}
