/**
 * One-shot / documented: backfill today's va_task_phases (and parent va_tasks)
 * that have blank assigned_model_id/name from the latest prior same-series
 * occurrence that still has model assignment.
 *
 * Supabase-only (Production Gunzo `wagfkuxkrgsencartqtx`). Does not touch Airtable.
 *
 * Prefer running the SQL below via Supabase SQL editor / MCP `execute_sql`.
 * Optional Node runner (same logic, Athens-today window must be edited if re-used):
 *   set -a && source .env.local && set +a && npx tsx scripts/backfill-today-phase-assigned-models.ts
 *
 * --- SQL (production, 2026-08-04) ---
 *
 * -- 1) Map each blank today-task → source model from latest prior occurrence
 * WITH model_by_task AS (
 *   SELECT DISTINCT ON (t.id)
 *     t.id AS task_uuid,
 *     coalesce(t.airtable_id, t.id::text) AS task_public_id,
 *     p2.assigned_model_id AS source_model_id,
 *     coalesce(p2.assigned_model_name, '') AS source_model_name
 *   FROM va_tasks t
 *   JOIN va_tasks t2
 *     ON t2.title = t.title
 *    AND t2.assigned_to = t.assigned_to
 *    AND t2.due_date < t.due_date
 *   JOIN va_task_phases p2
 *     ON p2.task_id = coalesce(t2.airtable_id, t2.id::text)
 *    AND coalesce(p2.assigned_model_id, '') <> ''
 *   WHERE t.is_recurring = true
 *     AND t.due_date >= TIMESTAMPTZ '2026-08-04 00:00:00+00'
 *     AND t.due_date <  TIMESTAMPTZ '2026-08-05 00:00:00+00'
 *   ORDER BY t.id, t2.due_date DESC, p2.phase_number ASC
 * ),
 * upd_phases AS (
 *   UPDATE va_task_phases p
 *   SET assigned_model_id = m.source_model_id,
 *       assigned_model_name = m.source_model_name,
 *       updated_at = now()
 *   FROM model_by_task m
 *   WHERE p.task_id = m.task_public_id
 *     AND coalesce(p.assigned_model_id, '') = ''
 *   RETURNING p.id
 * ),
 * upd_tasks AS (
 *   UPDATE va_tasks t
 *   SET assigned_model_ids = m.source_model_id,
 *       assigned_model_names = m.source_model_name,
 *       updated_at = now()
 *   FROM model_by_task m
 *   WHERE t.id = m.task_uuid
 *     AND coalesce(nullif(trim(t.assigned_model_ids), ''), '') = ''
 *   RETURNING t.id
 * )
 * SELECT
 *   (SELECT count(*) FROM upd_phases) AS phases_updated,
 *   (SELECT count(*) FROM upd_tasks) AS tasks_updated;
 */
import "./_polyfill-websocket";
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import { getSupabaseServiceClient } from "@/lib/supabase-server";

/** Edit these when re-running for another Athens calendar day. */
const DAY_START = "2026-08-04T00:00:00.000Z";
const DAY_END = "2026-08-05T00:00:00.000Z";

async function main() {
  const sb = getSupabaseServiceClient();

  const { data: tasks, error: tErr } = await sb
    .from("va_tasks")
    .select("id, airtable_id, title, assigned_to, assigned_model_ids, assigned_model_names, due_date")
    .eq("is_recurring", true)
    .gte("due_date", DAY_START)
    .lt("due_date", DAY_END);
  if (tErr) throw new Error(tErr.message);

  const { data: users, error: uErr } = await sb.from("users").select("id, airtable_id, full_name");
  if (uErr) throw new Error(uErr.message);
  const usersByUuid = new Map((users ?? []).map((u) => [u.id as string, u]));

  let phasesUpdated = 0;
  let tasksUpdated = 0;
  const vaSet = new Set<string>();
  const details: Array<Record<string, string>> = [];

  for (const task of tasks ?? []) {
    const taskPublicId = (task.airtable_id as string | null) || (task.id as string);
    const { data: phases, error: pErr } = await sb
      .from("va_task_phases")
      .select("id, assigned_model_id, assigned_model_name, phase_number")
      .eq("task_id", taskPublicId);
    if (pErr) throw new Error(pErr.message);
    const blank = (phases ?? []).filter((p) => !(String(p.assigned_model_id ?? "").trim()));
    if (!blank.length) continue;

    const assignedTo = (task.assigned_to as string[]) ?? [];
    const { data: priors, error: priorErr } = await sb
      .from("va_tasks")
      .select("id, airtable_id, due_date, assigned_to")
      .eq("title", task.title as string)
      .lt("due_date", task.due_date as string)
      .order("due_date", { ascending: false })
      .limit(40);
    if (priorErr) throw new Error(priorErr.message);

    const sameAssignee = (priors ?? []).filter((p) => {
      const a = (p.assigned_to as string[]) ?? [];
      if (a.length !== assignedTo.length) return false;
      const sortedA = [...a].sort().join(",");
      const sortedB = [...assignedTo].sort().join(",");
      return sortedA === sortedB;
    });

    let sourceModelId = "";
    let sourceModelName = "";
    let sourceTask = "";
    for (const prior of sameAssignee) {
      const priorPublic = (prior.airtable_id as string | null) || (prior.id as string);
      const { data: priorPhases, error: ppErr } = await sb
        .from("va_task_phases")
        .select("assigned_model_id, assigned_model_name")
        .eq("task_id", priorPublic)
        .limit(20);
      if (ppErr) throw new Error(ppErr.message);
      const hit = (priorPhases ?? []).find((p) => String(p.assigned_model_id ?? "").trim());
      if (hit) {
        sourceModelId = String(hit.assigned_model_id).trim();
        sourceModelName = String(hit.assigned_model_name ?? "").trim();
        sourceTask = priorPublic;
        break;
      }
    }

    if (!sourceModelId) {
      console.warn(`SKIP ${taskPublicId} (${task.title}): no source model found`);
      continue;
    }

    const vaUuid = assignedTo[0] ?? "";
    const va = usersByUuid.get(vaUuid) as { full_name?: string; airtable_id?: string } | undefined;
    vaSet.add(va?.full_name || vaUuid || "?");

    for (const phase of blank) {
      const { error: upErr } = await sb
        .from("va_task_phases")
        .update({
          assigned_model_id: sourceModelId,
          assigned_model_name: sourceModelName,
        })
        .eq("id", phase.id as string);
      if (upErr) throw new Error(upErr.message);
      phasesUpdated += 1;
      details.push({
        task: taskPublicId,
        phase: String(phase.phase_number),
        va: va?.full_name ?? "",
        model_id: sourceModelId,
        model_name: sourceModelName,
        source_task: sourceTask,
      });
    }

    if (!String(task.assigned_model_ids ?? "").trim()) {
      const { error: tmErr } = await sb
        .from("va_tasks")
        .update({
          assigned_model_ids: sourceModelId,
          assigned_model_names: sourceModelName,
        })
        .eq("id", task.id as string);
      if (tmErr) throw new Error(tmErr.message);
      tasksUpdated += 1;
    }
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        day: DAY_START.slice(0, 10),
        tasks_scanned: (tasks ?? []).length,
        tasks_updated: tasksUpdated,
        phases_updated: phasesUpdated,
        vas: [...vaSet].sort(),
        details,
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
