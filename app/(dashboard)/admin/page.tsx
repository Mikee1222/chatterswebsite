import { Suspense } from "react";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission, requireAdminRoute } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { ROUTES } from "@/lib/routes";
import { redirect } from "next/navigation";
import { getActiveShifts, getShiftsForMonth } from "@/services/shifts";
import { getCachedModelss } from "@/lib/modelss-cache";
import { listAllCustomRequests } from "@/services/custom-requests";
import { listAllUsers } from "@/services/users";
import { listAllWhaleTransactions } from "@/services/whale-transactions";
import { listMonthlyTargets } from "@/services/monthly-targets";
import { listAllModelLiveStreamsInRange } from "@/services/model-live-streams";
import {
  listUsersWithInflowwEmployeeId,
  queryInflowwDailyStats,
} from "@/services/infloww-daily-stats";
import {
  listCreatorTransactions,
  listCreatorTransactionTypeCounts,
  listLinkedCreatorModels,
} from "@/services/infloww-creator-earnings";
import { addDaysAthensYmd, getTodayYmdAthens } from "@/lib/airtable-datetime";
import { AdminHomeClient } from "@/components/admin-home-client";
import {
  buildAdminRecentActivity,
  buildAdminSparklineWowFromDailyStats,
  buildDailyRevenueSeries,
  buildMonthlyTargetProgress,
  lastNAthensYmds,
  rankChattersBySales,
  rankModelsByTransactionGross,
  resolveMonthRangeAthens,
  latestSyncedAtForYmd,
  sumSalesForYmd,
  sumSalesInRange,
  sumShiftHoursForRole,
  toAdminHomeLiveShiftRows,
  type AdminHomeVaProgressSummary,
} from "@/lib/admin-home-dashboard";
import {
  filterActiveModelsForAssignment,
  filterActiveUsersForAssignment,
} from "@/lib/assignment-filters";
import { selectVaTasksForDateView } from "@/lib/va-task-date-filter";
import {
  buildAgencyProgressStats,
  buildVaProgressSummaries,
} from "@/lib/va-tasks-progress";
import { getAllVaTasks } from "@/services/va-tasks";
import { getPhasesForTasksDisplay } from "@/services/task-phases";
import { RouterRefreshInterval } from "@/components/router-refresh-interval";
import { SupabaseLiveShiftsRealtime } from "@/components/supabase-live-shifts-realtime";

/** Lookback so recurring series anchors still expand onto Athens today. */
const VA_HOME_PROGRESS_LOOKBACK_DAYS = 120;

export default async function AdminHomePage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const user = await requireAdminRoute(await getSessionFromCookies());

  const SYSTEM_ROLES = ["admin", "manager", "chatter", "virtual_assistant", "model", "client"];
  if (!SYSTEM_ROLES.includes(user.role)) redirect(ROUTES.admin.customRoleHome);

  const canViewVaProgress = await hasPermission(user, PERMISSIONS.TASK_PROGRESS_VIEW);

  const params = await searchParams;
  const monthParam = params.month?.trim() || "";
  const todayYmd = getTodayYmdAthens();
  const currentYearMonth = todayYmd.slice(0, 7);
  const yearMonth = /^\d{4}-\d{2}$/.test(monthParam) ? monthParam : currentYearMonth;
  const { startYmd: monthStart, endYmd: monthEnd } = resolveMonthRangeAthens(yearMonth);

  const wowStart = addDaysAthensYmd(todayYmd, -27);
  const activityStart = addDaysAthensYmd(todayYmd, -13);
  const fetchStart = [monthStart, wowStart].sort()[0]!;
  const fetchEnd = [monthEnd, todayYmd].sort().at(-1)!;

  const [
    linkedUsers,
    modelss,
    customs,
    users,
    monthlyTargets,
    linkedCreators,
    liveStreams,
    whaleTxs,
  ] = await Promise.all([
    listUsersWithInflowwEmployeeId().catch(() => []),
    getCachedModelss().catch(() => []),
    listAllCustomRequests().catch(() => []),
    listAllUsers().catch(() => []),
    listMonthlyTargets().catch(() => []),
    listLinkedCreatorModels().catch(() => ({ linked: [], unmatchedCount: 0 })),
    listAllModelLiveStreamsInRange({ fromDate: activityStart }).catch(() => []),
    listAllWhaleTransactions().catch(() => []),
  ]);

  const uuids = linkedUsers.map((u) => u.uuid);
  const nameByUuid = new Map(linkedUsers.map((u) => [u.uuid, u.full_name || "—"]));

  const [dailyRows, monthTxs, txTypeCounts, chatterShifts, vaShifts, shiftsThisMonth] =
    await Promise.all([
      uuids.length
        ? queryInflowwDailyStats({
            userUuids: uuids,
            startYmd: fetchStart,
            endYmd: fetchEnd,
          }).catch(() => [])
        : Promise.resolve([]),
      listCreatorTransactions({
        startYmd: monthStart,
        endYmd: monthEnd,
        fetchAll: true,
        revenueOnly: true,
      }).catch(() => []),
      listCreatorTransactionTypeCounts({
        startYmd: monthStart,
        endYmd: monthEnd,
      }).catch(() => []),
      getActiveShifts("chatter").catch(() => []),
      getActiveShifts("virtual_assistant").catch(() => []),
      getShiftsForMonth(yearMonth).catch(() => []),
    ]);

  const activityTxs = await listCreatorTransactions({
    startYmd: activityStart,
    endYmd: todayYmd,
    limit: 500,
  }).catch(() => []);

  const chatters = users
    .filter((u) => u.role === "chatter")
    .map((u) => ({ id: u.id, full_name: u.full_name ?? "" }));

  const todaySalesUsd = sumSalesForYmd(dailyRows, todayYmd);
  const inflowwLastSyncedAt = latestSyncedAtForYmd(dailyRows, todayYmd);
  const totalRevenue = sumSalesInRange(dailyRows, monthStart, monthEnd);
  const sparklineWow = buildAdminSparklineWowFromDailyStats(dailyRows, todayYmd);
  const daily14 = buildDailyRevenueSeries(dailyRows, lastNAthensYmds(14, todayYmd));

  const byChatter = rankChattersBySales(dailyRows, monthStart, monthEnd, nameByUuid);
  const nameByModelRecord = new Map(
    linkedCreators.linked.map((l) => [l.modelRecordId, l.modelName] as const)
  );
  const byModel = rankModelsByTransactionGross(monthTxs, nameByModelRecord);

  const transactionCount = txTypeCounts.reduce((s, r) => s + r.count, 0);
  const transactionGross = txTypeCounts.reduce((s, r) => s + r.gross, 0);
  const avgPerTransaction = transactionCount > 0 ? transactionGross / transactionCount : 0;

  const topChatter = byChatter[0];
  const topModel = byModel[0];

  // Free/Taken — active models only (same filter as Weekly Program / Rebills / Tips).
  const activeModels = filterActiveModelsForAssignment(modelss);
  const freeCount = activeModels.filter((m) => m.current_status === "free").length;
  const takenCount = activeModels.length - freeCount;
  const pendingCustoms = customs.filter((c) => c.status === "pending").length;

  // Hours — compute from start/end − break (Shift Activity), not null total_hours_decimal.
  const chatterHoursThisMonth = sumShiftHoursForRole(shiftsThisMonth, "chatter");
  const vaHoursThisMonth = sumShiftHoursForRole(shiftsThisMonth, "virtual_assistant");

  const liveShiftRows = toAdminHomeLiveShiftRows([...chatterShifts, ...vaShifts]);

  let vaTaskProgress: AdminHomeVaProgressSummary | null = null;
  if (canViewVaProgress) {
    try {
      const athensStartYmd = addDaysAthensYmd(todayYmd, -VA_HOME_PROGRESS_LOOKBACK_DAYS);
      const allTasks = await getAllVaTasks({
        athensStartYmd,
        athensEndYmd: todayYmd,
      });
      const { flattenedTasks } = selectVaTasksForDateView(allTasks, todayYmd);
      const activeUsers = filterActiveUsersForAssignment(users);
      const vaUsers = activeUsers
        .filter((u) => u.role === "virtual_assistant" || u.secondary_role === "virtual_assistant")
        .map((u) => ({ id: u.id, full_name: u.full_name ?? "", email: u.email ?? "" }));
      const staffUsers = activeUsers.map((u) => ({
        id: u.id,
        full_name: u.full_name ?? "",
        email: u.email ?? "",
      }));
      const nameById = Object.fromEntries(
        activeUsers.map((u) => [u.id, (u.full_name || u.email || u.id).trim()])
      );

      const phasesByTask =
        flattenedTasks.length > 0
          ? await getPhasesForTasksDisplay(
              flattenedTasks.map((t) => ({
                taskId: t.id,
                sourceTaskId: t.virtual_source_task_id ?? null,
              }))
            )
          : {};

      const tasksWithPhases = flattenedTasks.map((task) => ({
        task,
        phases: phasesByTask[task.id] ?? [],
      }));
      const summaries = buildVaProgressSummaries(
        tasksWithPhases,
        vaUsers,
        nameById,
        staffUsers
      );
      const agency = buildAgencyProgressStats(summaries);
      vaTaskProgress = {
        overallPct: agency.overallPct,
        vasWithTasks: agency.vasWithTasks,
        fullyComplete: agency.fullyComplete,
        partial: agency.partial,
        notStarted: agency.notStarted,
        completedItems: agency.completedItems,
        totalItems: agency.totalItems,
        rows: summaries.slice(0, 8).map((s) => ({
          vaId: s.vaId,
          vaName: s.vaName,
          completedItems: s.completedItems,
          totalItems: s.totalItems,
          pct:
            s.totalItems > 0
              ? Math.round((s.completedItems / s.totalItems) * 100)
              : s.status === "complete"
                ? 100
                : 0,
          status: s.status,
        })),
      };
    } catch {
      vaTaskProgress = null;
    }
  }

  const activeTargets = monthlyTargets.filter(
    (t) => t.is_active && t.month_key === yearMonth
  );
  const monthlyTarget = buildMonthlyTargetProgress({
    targetUsd: activeTargets.reduce((s, t) => s + (t.target_amount_usd ?? 0), 0),
    achievedUsd: totalRevenue,
    targetCount: activeTargets.length,
  });

  const modelNameById = new Map(modelss.map((m) => [m.id, m.model_name || "Model"]));
  const recentActivity = buildAdminRecentActivity({
    transactions: activityTxs,
    modelNamesByRecordId: nameByModelRecord,
    liveStreams,
    modelNamesByLiveModelId: modelNameById,
    customs,
    whaleTransactions: whaleTxs,
    limit: 14,
  });

  return (
    <RouterRefreshInterval intervalMs={60_000}>
      <SupabaseLiveShiftsRealtime />
      <Suspense fallback={<div className="text-white/60">Loading…</div>}>
        <AdminHomeClient
          chatters={chatters}
          yearMonth={yearMonth}
          todaySalesUsd={todaySalesUsd}
          todayYmd={todayYmd}
          inflowwLastSyncedAt={inflowwLastSyncedAt}
          totalRevenue={totalRevenue}
          transactionCount={transactionCount}
          avgPerTransaction={avgPerTransaction}
          topModelName={topModel?.name ?? "—"}
          topModelRevenue={topModel?.usd ?? 0}
          topChatterName={topChatter?.name ?? "—"}
          topChatterRevenue={topChatter?.usd ?? 0}
          byModel={byModel.map((r) => [r.name, r.usd] as [string, number])}
          byChatter={byChatter.map((r) => [r.name, r.usd] as [string, number])}
          daily14={daily14}
          activeChatterShifts={chatterShifts.length}
          activeVaShifts={vaShifts.length}
          chatterHoursThisMonth={chatterHoursThisMonth}
          vaHoursThisMonth={vaHoursThisMonth}
          freeModelsCount={freeCount}
          takenModelsCount={takenCount}
          pendingCustomsCount={pendingCustoms}
          totalModelsCount={activeModels.length}
          recentActivity={recentActivity}
          sparklineWow={sparklineWow}
          monthlyTarget={monthlyTarget}
          liveShifts={liveShiftRows}
          vaTaskProgress={vaTaskProgress}
        />
      </Suspense>
    </RouterRefreshInterval>
  );
}
