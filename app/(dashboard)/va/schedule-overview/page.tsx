import { getSessionFromCookies } from "@/lib/auth";
import { getEffectiveStaffRole } from "@/lib/staff-session-role";
import { ROUTES } from "@/lib/routes";
import { assertVaTypeCanAccessNavHref } from "@/lib/va-type-access";
import { loadScheduleOverviewPageData } from "@/lib/schedule-overview-page-data";
import { redirect } from "next/navigation";
import { AdminModelSchedulesClient } from "@/components/admin-model-schedules-client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function VaScheduleOverviewPage({
  searchParams,
}: {
  searchParams?: { week?: string };
}) {
  const user = await getSessionFromCookies();
  if (!user || getEffectiveStaffRole(user) !== "virtual_assistant") redirect(ROUTES.dashboard);
  await assertVaTypeCanAccessNavHref(user, ROUTES.va.scheduleOverview);

  const vaId = (user.airtableUserId ?? user.id)?.trim();
  if (!vaId) redirect(ROUTES.dashboard);

  const weekParam = typeof searchParams?.week === "string" ? searchParams.week : "";
  const data = await loadScheduleOverviewPageData({
    weekParam,
    allowedModelIds: null,
  });

  return (
    <div className="container mx-auto max-w-[1600px] p-4 md:p-6">
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
        periodByModelId={data.periodByModelId}
      />
    </div>
  );
}
