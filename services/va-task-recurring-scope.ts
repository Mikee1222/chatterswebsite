import type { RecurringOccurrenceScope } from "@/lib/recurring-occurrence-scope";
import { addDaysAthensYmd, ymdInAthens } from "@/lib/airtable-datetime";
import { isVirtualVaTaskId, shouldSpawnRecurring, vaTaskSeriesKey } from "@/lib/recurrence";
import { recurrenceSkipsAthensYmd } from "@/lib/va-task-date-filter";
import {
  createVaTask,
  deleteVaTask,
  getAllVaTasks,
  getVaTaskById,
  updateVaTask,
  type VaTaskCreateInput,
  type VaTaskUpdateInput,
} from "@/services/va-tasks";
import type { VaTaskRecord } from "@/types";

export type { RecurringOccurrenceScope };

function mergeSkippedDates(existing: string[] | null | undefined, ymd: string): string[] {
  const target = ymd.trim().slice(0, 10);
  const out = [...(existing ?? [])].map((d) => d.trim().slice(0, 10)).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d));
  if (/^\d{4}-\d{2}-\d{2}$/.test(target) && !out.includes(target)) out.push(target);
  return out.sort();
}

/** Earliest-due active recurring row for the series (projection / spawn anchor). */
export function pickSeriesAnchorFromTasks(
  tasks: VaTaskRecord[],
  seriesKey: string,
): VaTaskRecord | null {
  let best: VaTaskRecord | null = null;
  let bestMs = Number.POSITIVE_INFINITY;
  for (const task of tasks) {
    if (!task.is_recurring || task.is_virtual_occurrence) continue;
    if (!task.due_date?.trim() || !task.recurrence_type?.trim()) continue;
    if (!shouldSpawnRecurring(task)) continue;
    if (vaTaskSeriesKey(task) !== seriesKey) continue;
    const ms = new Date(task.due_date).getTime();
    if (!Number.isFinite(ms)) continue;
    if (ms < bestMs) {
      best = task;
      bestMs = ms;
    }
  }
  return best;
}

export async function resolveSeriesAnchor(task: VaTaskRecord): Promise<VaTaskRecord | null> {
  if (task.is_virtual_occurrence || isVirtualVaTaskId(task.id)) {
    const sourceId = task.virtual_source_task_id?.trim();
    if (!sourceId) return null;
    return getVaTaskById(sourceId);
  }
  if (!task.is_recurring) return null;
  const all = await getAllVaTasks();
  return pickSeriesAnchorFromTasks(all, vaTaskSeriesKey(task)) ?? task;
}

async function addSkippedDateToSeries(seriesKey: string, ymd: string): Promise<void> {
  const all = await getAllVaTasks();
  const inSeries = all.filter(
    (t) => !t.is_virtual_occurrence && t.is_recurring && vaTaskSeriesKey(t) === seriesKey,
  );
  await Promise.all(
    inSeries.map((t) =>
      updateVaTask(t.id, {
        recurrence_skipped_dates: mergeSkippedDates(t.recurrence_skipped_dates, ymd),
      }),
    ),
  );
}

function occurrenceYmd(task: VaTaskRecord): string | null {
  return ymdInAthens(task.due_date);
}

/**
 * Persist template-field edits for a recurring occurrence.
 * Returns the real task id that should receive phase checklist writes.
 */
export async function applyRecurringEditScope(params: {
  task: VaTaskRecord;
  scope: RecurringOccurrenceScope;
  data: VaTaskUpdateInput;
}): Promise<{ targetTaskId: string; materialized: boolean }> {
  const { task, scope, data } = params;
  const ymd = occurrenceYmd(task);
  if (!ymd) throw new Error("Task is missing a due date.");

  const isVirtual = Boolean(task.is_virtual_occurrence || isVirtualVaTaskId(task.id));
  const seriesKey = vaTaskSeriesKey(task);
  const anchor = await resolveSeriesAnchor(task);
  if (!anchor) throw new Error("Could not resolve the recurring series anchor.");

  if (scope === "this_only") {
    await addSkippedDateToSeries(seriesKey, ymd);

    if (isVirtual) {
      const createInput: VaTaskCreateInput = {
        title: (data.title ?? task.title).trim(),
        description: data.description !== undefined ? data.description : task.description,
        assigned_to_ids: data.assigned_to_ids ?? [...task.assigned_to_ids],
        assigned_by_ids: data.assigned_by_ids ?? [...(task.assigned_by_ids ?? [])],
        assigned_model_ids: data.assigned_model_ids ?? [...(task.assigned_model_ids ?? [])],
        assigned_model_names: data.assigned_model_names ?? [...(task.assigned_model_names ?? [])],
        status: data.status ?? "pending",
        priority: data.priority ?? task.priority,
        due_date: data.due_date !== undefined ? data.due_date : task.due_date,
        // Detached exception — keeps series key stable on the anchor; this day is skipped.
        is_recurring: false,
        reminder_minutes_before:
          data.reminder_minutes_before !== undefined
            ? data.reminder_minutes_before
            : task.reminder_minutes_before,
      };
      const created = await createVaTask(createInput);
      return { targetTaskId: created.id, materialized: true };
    }

    await updateVaTask(task.id, {
      ...data,
      // Detach from series so title/assignee edits do not spawn a new series.
      is_recurring: false,
      recurrence_type: null,
      recurrence_days: [],
      recurrence_interval: null,
      recurrence_end_date: null,
    });
    return { targetTaskId: task.id, materialized: false };
  }

  // this_and_future — update anchor template; also update today's real row if editing one.
  const templatePatch: VaTaskUpdateInput = { ...data };
  // Keep recurrence schedule on the anchor unless the form explicitly clears it.
  if (templatePatch.is_recurring === false) {
    // Ending recurrence via form is allowed; otherwise force keep recurring.
  } else {
    templatePatch.is_recurring = true;
    if (templatePatch.recurrence_type === undefined) {
      templatePatch.recurrence_type = anchor.recurrence_type || task.recurrence_type || null;
    }
    if (templatePatch.recurrence_days === undefined) {
      templatePatch.recurrence_days = [...(anchor.recurrence_days ?? task.recurrence_days ?? [])];
    }
    if (templatePatch.recurrence_interval === undefined) {
      templatePatch.recurrence_interval = anchor.recurrence_interval ?? task.recurrence_interval;
    }
  }

  await updateVaTask(anchor.id, templatePatch);

  if (!isVirtual && task.id !== anchor.id) {
    await updateVaTask(task.id, data);
    return { targetTaskId: task.id, materialized: false };
  }

  return { targetTaskId: anchor.id, materialized: false };
}

/** Delete or stop a recurring occurrence for the chosen scope. */
export async function applyRecurringDeleteScope(params: {
  task: VaTaskRecord;
  scope: RecurringOccurrenceScope;
}): Promise<void> {
  const { task, scope } = params;
  const ymd = occurrenceYmd(task);
  if (!ymd) throw new Error("Task is missing a due date.");

  const isVirtual = Boolean(task.is_virtual_occurrence || isVirtualVaTaskId(task.id));
  const seriesKey = vaTaskSeriesKey(task);
  const anchor = await resolveSeriesAnchor(task);
  if (!anchor) throw new Error("Could not resolve the recurring series anchor.");

  if (scope === "this_only") {
    await addSkippedDateToSeries(seriesKey, ymd);
    if (!isVirtual) {
      await deleteVaTask(task.id);
    }
    return;
  }

  // this_and_future — end series the day before this occurrence.
  const endYmd = addDaysAthensYmd(ymd, -1);
  const all = await getAllVaTasks();
  const inSeries = all.filter(
    (t) => !t.is_virtual_occurrence && t.is_recurring && vaTaskSeriesKey(t) === seriesKey,
  );

  await Promise.all(
    inSeries.map(async (t) => {
      // Do not retroactively change past historical end dates that already ended earlier.
      const existingEnd = t.recurrence_end_date?.trim().slice(0, 10);
      if (existingEnd && /^\d{4}-\d{2}-\d{2}$/.test(existingEnd) && existingEnd < endYmd) {
        return;
      }
      await updateVaTask(t.id, { recurrence_end_date: endYmd });
    }),
  );

  // Also ensure the resolved anchor is updated even if series key drifted.
  if (!inSeries.some((t) => t.id === anchor.id)) {
    await updateVaTask(anchor.id, { recurrence_end_date: endYmd });
  }

  if (!isVirtual) {
    await deleteVaTask(task.id);
  } else if (recurrenceSkipsAthensYmd(anchor, ymd)) {
    // already ended; nothing else
  }
}
