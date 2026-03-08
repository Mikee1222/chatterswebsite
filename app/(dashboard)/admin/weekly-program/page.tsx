import { getSessionFromCookies } from "@/lib/auth";
import { ROUTES } from "@/lib/routes";
import { redirect } from "next/navigation";
import { normalizeWeekStart, getThisWeekMonday, formatWeekLabel } from "@/lib/weekly-program";
import { adminWeeklyProgramUrl } from "@/lib/routes";
import { getProgramsForWeek } from "@/services/weekly-program";
import { getRequestsForWeek } from "@/services/weekly-availability-requests";
import { listAllUsers } from "@/services/users";
import { listAllModelss } from "@/services/modelss";
import { getLastAssignmentBatch } from "@/services/shifts";
import { getWeeklyProgramConflicts, getModelCoverageBoard } from "@/lib/weekly-program-conflicts";
import { AdminWeeklyProgramClient } from "@/components/admin-weekly-program-client";
import type { WeeklyProgramRecord } from "@/types";
import type { ModelRecord } from "@/types";

export default async function AdminWeeklyProgramPage({
  searchParams,
}: {
  searchParams: Promise<{ week_start?: string }>;
}) {
  const user = await getSessionFromCookies();
  if (!user || (user.role !== "admin" && user.role !== "manager")) redirect(ROUTES.dashboard);

  const params = await searchParams;
  const rawWeek = params.week_start?.trim();
  const weekStart = normalizeWeekStart(rawWeek || getThisWeekMonday());
  if (rawWeek && rawWeek !== weekStart) redirect(adminWeeklyProgramUrl(weekStart));

  const [programs, availabilityRequests, users, modelss] = await Promise.all([
    getProgramsForWeek(weekStart).catch(() => []),
    getRequestsForWeek(weekStart).catch(() => []),
    listAllUsers().catch(() => []),
    listAllModelss().catch(() => []),
  ]);

  if (process.env.NODE_ENV !== "production") {
    console.log("[admin weekly-program page] loader", {
      selected_week_start: weekStart,
      displayed_week_label: formatWeekLabel(weekStart),
      source: params.week_start?.trim() ? "url" : "default_current_week",
      fetched_records_count: programs.length,
      weekly_availability_requests_count: availabilityRequests.length,
      fetched_record_ids: programs.map((p) => p.id),
    });
  }

  const chatters = users.filter((u) => u.role === "chatter");

  const modelIdToName: Record<string, string> = {};
  modelss.forEach((m) => { modelIdToName[m.id] = m.model_name ?? m.id; });
  const { conflicts, summary } = getWeeklyProgramConflicts(
    programs as WeeklyProgramRecord[],
    modelss.map((m) => m.id),
    modelIdToName
  );
  const conflictRecordIds = new Set<string>();
  for (const c of conflicts) for (const id of c.recordIds) conflictRecordIds.add(id);
  const coverageBoard = getModelCoverageBoard(programs as WeeklyProgramRecord[], modelss, weekStart);

  const assignmentPairs = (programs as WeeklyProgramRecord[]).flatMap((p) =>
    (p.model_ids ?? []).filter(Boolean).map((modelId) => ({ chatterId: p.chatter_id, modelId }))
  );
  const uniquePairs = Array.from(
    new Map(assignmentPairs.map((p) => [`${p.chatterId}:${p.modelId}`, p])).values()
  );
  const lastAssignmentMap = await getLastAssignmentBatch(uniquePairs).catch(() => ({}));

  return (
    <AdminWeeklyProgramClient
      programs={programs as WeeklyProgramRecord[]}
      chatters={chatters.map((u) => ({ id: u.id, full_name: u.full_name }))}
      modelss={modelss as ModelRecord[]}
      currentWeekStart={weekStart}
      conflicts={conflicts}
      conflictSummary={summary}
      conflictRecordIds={Array.from(conflictRecordIds)}
      coverageBoard={coverageBoard}
      lastAssignmentMap={lastAssignmentMap ?? {}}
      suggestionsByKey={{}}
      availabilityRequests={Array.isArray(availabilityRequests) ? availabilityRequests : []}
    />
  );
}
