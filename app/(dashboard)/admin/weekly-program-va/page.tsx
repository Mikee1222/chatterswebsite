import { getSessionFromCookies } from "@/lib/auth";
import { ROUTES } from "@/lib/routes";
import { redirect } from "next/navigation";
import { normalizeWeekStart, getThisWeekMonday, formatWeekLabel } from "@/lib/weekly-program";
import { adminWeeklyProgramVaUrl } from "@/lib/routes";
import { getProgramsForWeekVa } from "@/services/weekly-program-va";
import { getRequestsForWeekVa } from "@/services/weekly-availability-requests-va";
import { listAllUsers } from "@/services/users";
import { listAllModelss } from "@/services/modelss";
import { getLastAssignmentBatch } from "@/services/shifts";
import { getWeeklyProgramConflicts, getModelCoverageBoard } from "@/lib/weekly-program-conflicts";
import { AdminWeeklyProgramVaClient } from "@/components/admin-weekly-program-va-client";
import type { WeeklyProgramRecord } from "@/types";
import type { ModelRecord } from "@/types";

export default async function AdminWeeklyProgramVaPage({
  searchParams,
}: {
  searchParams: Promise<{ week_start?: string }>;
}) {
  const user = await getSessionFromCookies();
  if (!user || (user.role !== "admin" && user.role !== "manager")) redirect(ROUTES.dashboard);

  const params = await searchParams;
  const rawWeek = params.week_start?.trim();
  const weekStart = normalizeWeekStart(rawWeek || getThisWeekMonday());
  if (rawWeek && rawWeek !== weekStart) redirect(adminWeeklyProgramVaUrl(weekStart));

  const [programs, availabilityRequests, users, modelss] = await Promise.all([
    getProgramsForWeekVa(weekStart).catch(() => []),
    getRequestsForWeekVa(weekStart).catch(() => []),
    listAllUsers().catch(() => []),
    listAllModelss().catch(() => []),
  ]);

  if (process.env.NODE_ENV !== "production") {
    console.log("[admin weekly-program-va page] loader", {
      selected_week_start: weekStart,
      displayed_week_label: formatWeekLabel(weekStart),
      fetched_programs_count: programs.length,
      fetched_program_ids: (programs as WeeklyProgramRecord[]).map((p) => p.id),
      fetched_program_week_starts: (programs as WeeklyProgramRecord[]).map((p) => p.week_start),
      fetched_program_days: (programs as WeeklyProgramRecord[]).map((p) => p.day),
      availability_requests_count: Array.isArray(availabilityRequests) ? availabilityRequests.length : 0,
    });
  }

  const vas = users.filter((u) => u.role === "virtual_assistant").map((u) => ({ id: u.id, full_name: u.full_name ?? u.email ?? "—" }));

  const modelIdToName: Record<string, string> = {};
  modelss.forEach((m) => {
    modelIdToName[m.id] = m.model_name ?? m.id;
  });
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
  const uniquePairs = Array.from(new Map(assignmentPairs.map((p) => [`${p.chatterId}:${p.modelId}`, p])).values());
  const lastAssignmentMap = await getLastAssignmentBatch(uniquePairs).catch(() => ({}));

  return (
    <AdminWeeklyProgramVaClient
      programs={programs as WeeklyProgramRecord[]}
      chatters={vas}
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
