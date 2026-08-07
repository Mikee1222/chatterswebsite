import { getSessionFromCookies } from "@/lib/auth";
import { getEffectiveStaffRole } from "@/lib/staff-session-role";
import { ROUTES } from "@/lib/routes";
import { redirect } from "next/navigation";
import { loadScheduleOverviewPageData } from "@/lib/schedule-overview-page-data";
import { AdminModelSchedulesClient } from "@/components/admin-model-schedules-client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const WEEKS_PAD = 8;

export default async function AdminModelSchedulesOverviewPage({
  searchParams,
}: {
  searchParams?: { week?: string };
}) {
  const user = await getSessionFromCookies();
  if (!user) redirect(ROUTES.login);

  const isStaff = user.role === "admin" || user.role === "manager";
  const isVa = getEffectiveStaffRole(user) === "virtual_assistant";
  if (!isStaff && !isVa) redirect(ROUTES.dashboard);

  let vaId = "";
  if (isVa) {
    vaId = (user.airtableUserId ?? user.id)?.trim() ?? "";
    if (!vaId) redirect(ROUTES.dashboard);
  }

  const weekParam = typeof searchParams?.week === "string" ? searchParams.week : "";

  const data = await loadScheduleOverviewPageData({
    weekParam,
    allowedModelIds: null,
  });

  return (
    <div className="container mx-auto max-w-[1600px] p-4 md:p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-white md:text-3xl">Schedule overview</h1>
        <p className="mt-1 max-w-3xl text-sm text-white/60">
          {isVa ? (
            <>
              Read-only view of model schedules, accepted customs (
              <span className="font-mono text-white/80">admin_status = accepted</span>), Chatting Assignments, and live streams. Loads{""}
              <span className="text-white/80">{WEEKS_PAD} weeks before and after</span> the selected week (
              <span className="font-mono text-white/80">{data.windowStart}</span> –{""}
              <span className="font-mono text-white/80">{data.windowEnd}</span>
              ).
            </>
          ) : (
            <>
              Read-only view of model schedule rows, agency-approved customs (Airtable{""}
              <span className="font-mono text-white/80">admin_status = accepted</span>
              ), Chatting Content, and live streams. Data loads{""}
              <span className="text-white/80">{WEEKS_PAD} weeks before and after</span> the week in the URL (
              <span className="font-mono text-white/80">{data.windowStart}</span> –{""}
              <span className="font-mono text-white/80">{data.windowEnd}</span>
              ).
            </>
          )}
        </p>
      </div>

      <AdminModelSchedulesClient
        audience={isVa ? "va" : "admin"}
        vaUserId={isVa ? vaId : undefined}
        initialWeek={data.weekStart}
        windowStart={data.windowStart}
        windowEnd={data.windowEnd}
        models={data.modelOptions}
        rows={data.rows}
        periodByModelId={data.periodByModelId}
      />
    </div>
  );
}
