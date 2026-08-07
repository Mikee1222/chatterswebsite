import { getSessionFromCookies } from "@/lib/auth";
import { getEffectiveStaffRole } from "@/lib/staff-session-role";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { ROUTES } from "@/lib/routes";
import { redirect } from "next/navigation";
import { loadScheduleOverviewPageData } from "@/lib/schedule-overview-page-data";
import { AdminModelSchedulesClient } from "@/components/admin-model-schedules-client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminModelSchedulesOverviewPage({
  searchParams,
}: {
  searchParams?: { week?: string };
}) {
  const user = await getSessionFromCookies();
  if (!user) redirect(ROUTES.login);

  const canSchedules = await hasPermission(user, PERMISSIONS.MODELS_SCHEDULES);
  const isVa = getEffectiveStaffRole(user) === "virtual_assistant";
  if (!canSchedules && !isVa) redirect(ROUTES.dashboard);

  let vaId = "";
  if (isVa && !canSchedules) {
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
      <AdminModelSchedulesClient
        audience={isVa && !canSchedules ? "va" : "admin"}
        vaUserId={isVa && !canSchedules ? vaId : undefined}
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
