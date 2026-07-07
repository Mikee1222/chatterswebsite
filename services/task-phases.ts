"use server";

import { createRecord, deleteRecord, getRecord, listAllRecords, updateRecord, type AirtableRecord } from "@/lib/airtable-server";
import { getUserByAirtableId } from "@/services/users";
import { coerceTaskStepType, DEFAULT_TASK_STEP_TYPE, type TaskStepType } from "@/lib/task-step-types";
import { getVaTaskById } from "@/services/va-tasks";

export type { TaskStepType } from "@/lib/task-step-types";

const TABLE_PHASES = "va_task_phases";
const TABLE_ITEMS = "va_task_phase_items";

export interface TaskPhase {
  id: string;
  phase_id: string;
  task_id: string;
  task_title: string;
  phase_number: number;
  title: string;
  description: string;
  scheduled_time: string | null;
  start_time: string | null;
  end_time: string | null;
  status: "pending" | "in_progress" | "completed" | "overdue";
  assigned_va_id: string;
  assigned_va_name: string;
  assigned_model_id: string;
  assigned_model_name: string;
  region: "USA" | "Greek" | "Global";
  completed_at: string | null;
  created_at: string;
  items: PhaseItem[];
}

export type PhaseScreenshot = { url: string; filename?: string };

export interface PhaseItem {
  id: string;
  item_id: string;
  phase_id: string;
  task_id: string;
  title: string;
  description: string;
  requires_screenshot: boolean;
  screenshot: PhaseScreenshot[];
  status: "pending" | "completed";
  completed_by_va_id: string;
  completed_by_va_name: string;
  completed_at: string | null;
  sort_order: number;
  step_type: TaskStepType;
}

type PhaseFields = {
  phase_id?: string;
  task_id?: string;
  task_title?: string;
  phase_number?: number;
  title?: string;
  description?: string;
  scheduled_time?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  status?: string;
  assigned_va_id?: string;
  assigned_va_name?: string;
  assigned_model_id?: string;
  assigned_model_name?: string;
  region?: string;
  completed_at?: string | null;
  created_at?: string;
};

type ItemFields = {
  item_id?: string;
  phase_id?: string;
  task_id?: string;
  title?: string;
  description?: string;
  requires_screenshot?: boolean;
  screenshot?: unknown;
  status?: string;
  completed_by_va_id?: string;
  completed_by_va_name?: string;
  completed_at?: string | null;
  sort_order?: number;
  step_type?: string;
  created_at?: string;
};

function airtableFormulaString(value: string): string {
  return String(value ?? "").replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function asRegion(v: unknown): "USA" | "Greek" | "Global" {
  return v === "USA" || v === "Greek" ? v : "Global";
}

function asPhaseStatus(v: unknown): TaskPhase["status"] {
  if (v === "in_progress" || v === "completed" || v === "overdue") return v;
  return "pending";
}

function normalizeScreenshots(raw: unknown): PhaseScreenshot[] {
  if (!Array.isArray(raw)) return [];
  const out: PhaseScreenshot[] = [];
  for (const row of raw) {
    if (row && typeof row === "object" && "url" in row && typeof (row as { url: unknown }).url === "string") {
      const u = (row as { url: string }).url;
      const fn = "filename" in row && typeof (row as { filename?: unknown }).filename === "string" ? (row as { filename: string }).filename : undefined;
      out.push({ url: u, ...(fn ? { filename: fn } : {}) });
    }
  }
  return out;
}

function mapPhase(rec: AirtableRecord<PhaseFields>, items: PhaseItem[] = []): TaskPhase {
  const f = rec.fields ?? {};
  return {
    id: rec.id,
    phase_id: (f.phase_id as string) ?? rec.id,
    task_id: (f.task_id as string) ?? "",
    task_title: (f.task_title as string) ?? "",
    phase_number: typeof f.phase_number === "number" ? f.phase_number : Number(f.phase_number) || 1,
    title: (f.title as string) ?? "",
    description: (f.description as string) ?? "",
    scheduled_time: (f.scheduled_time as string | null) ?? null,
    start_time: (f.start_time as string | null) ?? null,
    end_time: (f.end_time as string | null) ?? null,
    status: asPhaseStatus(f.status),
    assigned_va_id: (f.assigned_va_id as string) ?? "",
    assigned_va_name: (f.assigned_va_name as string) ?? "",
    assigned_model_id: (f.assigned_model_id as string) ?? "",
    assigned_model_name: (f.assigned_model_name as string) ?? "",
    region: asRegion(f.region),
    completed_at: (f.completed_at as string | null) ?? null,
    created_at: (f.created_at as string) ?? "",
    items,
  };
}

function mapItem(rec: AirtableRecord<ItemFields>): PhaseItem {
  const f = rec.fields ?? {};
  const st = f.status === "completed" ? "completed" : "pending";
  return {
    id: rec.id,
    item_id: (f.item_id as string) ?? rec.id,
    phase_id: (f.phase_id as string) ?? "",
    task_id: (f.task_id as string) ?? "",
    title: (f.title as string) ?? "",
    description: (f.description as string) ?? "",
    requires_screenshot: f.requires_screenshot === true,
    screenshot: normalizeScreenshots(f.screenshot),
    status: st,
    completed_by_va_id: (f.completed_by_va_id as string) ?? "",
    completed_by_va_name: (f.completed_by_va_name as string) ?? "",
    completed_at: (f.completed_at as string | null) ?? null,
    sort_order: typeof f.sort_order === "number" ? f.sort_order : Number(f.sort_order) || 0,
    step_type: coerceTaskStepType(f.step_type),
  };
}

/** Resolve URL param (Airtable `rec…` id or logical `item_…`) to the phase item row id. */
export async function resolvePhaseItemRowId(paramId: string): Promise<string | null> {
  const id = paramId?.trim();
  if (!id) return null;
  if (id.startsWith("rec")) {
    try {
      await getRecord<ItemFields>(TABLE_ITEMS, id);
      return id;
    } catch {
      return null;
    }
  }
  const esc = airtableFormulaString(id);
  const rows = await listAllRecords<ItemFields>(TABLE_ITEMS, {
    filterByFormula: `{item_id} = "${esc}"`,
    pageSize: 5,
  });
  return rows[0]?.id ?? null;
}

async function resolvePhaseAssignees(
  taskId: string,
  data: Partial<TaskPhase>,
): Promise<{
  assigned_va_id: string;
  assigned_va_name: string;
  assigned_model_id: string;
  assigned_model_name: string;
}> {
  const task = taskId ? await getVaTaskById(taskId) : null;

  let assigned_va_id = data.assigned_va_id?.trim() ?? "";
  let assigned_va_name = data.assigned_va_name?.trim() ?? "";
  let assigned_model_id = data.assigned_model_id?.trim() ?? "";
  let assigned_model_name = data.assigned_model_name?.trim() ?? "";

  if (!assigned_va_id && task?.assigned_to_ids.length) {
    assigned_va_id = task.assigned_to_ids[0];
    if (!assigned_va_name) {
      const user = await getUserByAirtableId(assigned_va_id);
      assigned_va_name = (user?.full_name || user?.email || "").trim();
    }
  }

  if (!assigned_model_id && task?.assigned_model_ids.length) {
    assigned_model_id = task.assigned_model_ids[0];
    if (!assigned_model_name) {
      assigned_model_name = task.assigned_model_names[0] ?? "";
    }
  }

  return { assigned_va_id, assigned_va_name, assigned_model_id, assigned_model_name };
}

export async function getPhasesByTask(taskId: string): Promise<TaskPhase[]> {
  const tid = airtableFormulaString(taskId);
  const [phaseRecords, itemRecords] = await Promise.all([
    listAllRecords<PhaseFields>(TABLE_PHASES, {
      filterByFormula: `{task_id} = "${tid}"`,
      sort: [{ field: "phase_number", direction: "asc" }],
    }),
    listAllRecords<ItemFields>(TABLE_ITEMS, {
      filterByFormula: `{task_id} = "${tid}"`,
      sort: [{ field: "sort_order", direction: "asc" }],
    }),
  ]);

  const items = itemRecords.map(mapItem);
  return phaseRecords.map((rec) => {
    const stablePhaseId = (rec.fields.phase_id as string) ?? rec.id;
    const phaseItems = items.filter((i) => i.phase_id === stablePhaseId || i.phase_id === rec.id);
    return mapPhase(rec, phaseItems);
  });
}

export async function createPhase(data: Partial<TaskPhase>): Promise<TaskPhase> {
  const taskId = data.task_id?.trim() ?? "";
  const assignees = await resolvePhaseAssignees(taskId, data);
  const rec = await createRecord<PhaseFields>(TABLE_PHASES, {
    phase_id: `phase_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    task_id: data.task_id,
    task_title: data.task_title ?? "",
    phase_number: data.phase_number ?? 1,
    title: data.title ?? `Phase ${data.phase_number ?? 1}`,
    description: data.description ?? "",
    status: "pending",
    ...(data.scheduled_time !== undefined ? { scheduled_time: data.scheduled_time } : {}),
    assigned_va_id: assignees.assigned_va_id,
    assigned_va_name: assignees.assigned_va_name,
    assigned_model_id: assignees.assigned_model_id,
    assigned_model_name: assignees.assigned_model_name,
    region: data.region ?? "Global",
    created_at: new Date().toISOString(),
  });
  return mapPhase(rec);
}

export async function updatePhase(id: string, data: Partial<TaskPhase>): Promise<void> {
  const patch: Record<string, unknown> = {};
  if (data.title !== undefined) patch.title = data.title;
  if (data.description !== undefined) patch.description = data.description;
  if (data.status !== undefined) patch.status = data.status;
  if (data.scheduled_time !== undefined) patch.scheduled_time = data.scheduled_time;
  if (data.start_time !== undefined) patch.start_time = data.start_time;
  if (data.end_time !== undefined) patch.end_time = data.end_time;
  if (data.region !== undefined) patch.region = data.region;
  if (data.completed_at !== undefined) patch.completed_at = data.completed_at;

  if (
    data.assigned_va_id !== undefined ||
    data.assigned_va_name !== undefined ||
    data.assigned_model_id !== undefined ||
    data.assigned_model_name !== undefined
  ) {
    let taskId = data.task_id?.trim() ?? "";
    if (!taskId) {
      const phaseRec = await getRecord<PhaseFields>(TABLE_PHASES, id);
      taskId = (phaseRec.fields.task_id as string)?.trim() ?? "";
    }
    const assignees = await resolvePhaseAssignees(taskId, data);
    if (data.assigned_va_id !== undefined || data.assigned_va_name !== undefined) {
      patch.assigned_va_id = assignees.assigned_va_id;
      patch.assigned_va_name = assignees.assigned_va_name;
    }
    if (data.assigned_model_id !== undefined || data.assigned_model_name !== undefined) {
      patch.assigned_model_id = assignees.assigned_model_id;
      patch.assigned_model_name = assignees.assigned_model_name;
    }
  }

  if (Object.keys(patch).length === 0) return;
  await updateRecord(TABLE_PHASES, id, patch);
}

export async function deletePhase(id: string): Promise<void> {
  await deleteRecord(TABLE_PHASES, id);
}

export async function createPhaseItem(data: Partial<PhaseItem>): Promise<PhaseItem> {
  const rec = await createRecord<ItemFields>(TABLE_ITEMS, {
    item_id: `item_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    phase_id: data.phase_id,
    task_id: data.task_id,
    title: data.title ?? "",
    description: data.description ?? "",
    requires_screenshot: data.requires_screenshot ?? false,
    status: "pending",
    sort_order: data.sort_order ?? 0,
    step_type: data.step_type ?? DEFAULT_TASK_STEP_TYPE,
    created_at: new Date().toISOString(),
  });
  return mapItem(rec);
}

export async function updatePhaseItem(id: string, data: Partial<PhaseItem>): Promise<void> {
  const patch: Record<string, unknown> = {};
  if (data.title !== undefined) patch.title = data.title;
  if (data.description !== undefined) patch.description = data.description;
  if (data.requires_screenshot !== undefined) patch.requires_screenshot = data.requires_screenshot;
  if (data.status !== undefined) patch.status = data.status;
  if (data.sort_order !== undefined) patch.sort_order = data.sort_order;
  if (data.step_type !== undefined) patch.step_type = data.step_type;
  if (data.screenshot !== undefined) patch.screenshot = data.screenshot;
  if (data.completed_by_va_id !== undefined) patch.completed_by_va_id = data.completed_by_va_id;
  if (data.completed_by_va_name !== undefined) patch.completed_by_va_name = data.completed_by_va_name;
  if (data.completed_at !== undefined) patch.completed_at = data.completed_at;
  if (Object.keys(patch).length === 0) return;
  await updateRecord(TABLE_ITEMS, id, patch);
}

export async function deletePhaseItem(id: string): Promise<void> {
  await deleteRecord(TABLE_ITEMS, id);
}

/**
 * Clone all phases + checklist items from one task onto another (fresh `pending` copies).
 * Shared by the recurring-task spawn paths (updateVaTaskStatusAction + cron backfill) so the
 * next occurrence keeps its phase/checklist structure instead of spawning an empty shell.
 */
export async function clonePhasesToTask(
  sourceTaskId: string,
  targetTask: { id: string; title: string },
): Promise<number> {
  const phases = await getPhasesByTask(sourceTaskId);
  let cloned = 0;
  for (const phase of phases) {
    const created = await createPhase({
      task_id: targetTask.id,
      task_title: targetTask.title,
      phase_number: phase.phase_number,
      title: phase.title,
      description: phase.description,
      region: phase.region,
      assigned_model_id: phase.assigned_model_id,
      assigned_model_name: phase.assigned_model_name,
    });
    const stablePhaseId = created.phase_id || created.id;
    for (const item of phase.items) {
      await createPhaseItem({
        phase_id: stablePhaseId,
        task_id: targetTask.id,
        title: item.title,
        description: item.description,
        requires_screenshot: item.requires_screenshot,
        sort_order: item.sort_order,
        step_type: item.step_type,
      });
    }
    cloned += 1;
  }
  return cloned;
}

export async function completePhaseItem(
  itemAirtableId: string,
  vaId: string,
  vaName: string,
  options?: { screenshotAttachments?: { url: string }[] },
): Promise<{
  phaseCompleted: boolean;
  allPhasesCompleted: boolean;
  itemTitle: string;
  taskId: string;
  phaseStableId: string;
  phaseAirtableId: string;
}> {
  const now = new Date().toISOString();
  const itemRec = await getRecord<ItemFields>(TABLE_ITEMS, itemAirtableId);
  const f = itemRec.fields ?? {};
  const phaseStableId = (f.phase_id as string) ?? "";
  const taskId = (f.task_id as string) ?? "";
  const itemTitle = (f.title as string) ?? "Task";
  const priorShots = normalizeScreenshots(f.screenshot);
  const merged =
    options?.screenshotAttachments?.length ?
      [...priorShots.map((s) => ({ url: s.url })), ...options.screenshotAttachments]
    : priorShots.map((s) => ({ url: s.url }));

  await updateRecord(TABLE_ITEMS, itemAirtableId, {
    status: "completed",
    completed_by_va_id: vaId,
    completed_by_va_name: vaName,
    completed_at: now,
    ...(merged.length > 0 ? { screenshot: merged } : {}),
  });

  const escPhase = airtableFormulaString(phaseStableId);
  const allItems = await listAllRecords<ItemFields>(TABLE_ITEMS, {
    filterByFormula: `{phase_id} = "${escPhase}"`,
  });
  const completedCount = allItems.filter((r) => r.fields.status === "completed").length;
  const allItemsDone = allItems.length > 0 && completedCount === allItems.length;

  let phaseCompleted = false;
  let allPhasesCompleted = false;
  let phaseAirtableId = "";

  const escTask = taskId ? airtableFormulaString(taskId) : "";
  const phaseRows =
    taskId && escTask
      ? await listAllRecords<PhaseFields>(TABLE_PHASES, {
          filterByFormula: `{task_id} = "${escTask}"`,
        })
      : [];
  const phaseRow = phaseRows.find(
    (p) => p.id === phaseStableId || ((p.fields.phase_id as string) ?? p.id) === phaseStableId,
  );
  phaseAirtableId = phaseRow?.id ?? "";

  if (phaseAirtableId && completedCount === 1 && phaseRow?.fields.status === "pending") {
    await updateRecord(TABLE_PHASES, phaseAirtableId, {
      status: "in_progress",
      start_time: now,
    });
  }

  if (allItemsDone && taskId && phaseStableId) {
    phaseCompleted = true;
    if (phaseAirtableId) {
      await updateRecord(TABLE_PHASES, phaseAirtableId, {
        status: "completed",
        completed_at: now,
        end_time: now,
      });
    }

    const allPhasesRefetched = await listAllRecords<PhaseFields>(TABLE_PHASES, {
      filterByFormula: `{task_id} = "${escTask}"`,
    });
    allPhasesCompleted =
      allPhasesRefetched.length > 0 &&
      allPhasesRefetched.every((r) => r.fields.status === "completed");
  }

  return { phaseCompleted, allPhasesCompleted, itemTitle, taskId, phaseStableId, phaseAirtableId };
}
