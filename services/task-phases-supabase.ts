/**
 * Supabase backend for services/task-phases.ts (DATA_BACKEND=supabase).
 * Virtual projection helpers stay in task-phases.ts — only persistence/fetch here.
 */

import { coerceTaskStepType, DEFAULT_TASK_STEP_TYPE, type TaskStepType } from "@/lib/task-step-types";
import {
  publicId,
  sbDeleteByPublicId,
  sbInsert,
  sbSelectByPublicId,
  sbSelectEq,
  sbUpdateByPublicId,
  type SbRow,
} from "@/lib/supabase-data";
import { getSupabaseServiceClient } from "@/lib/supabase-server";
import {
  attachmentsFromSignedMap,
  batchSignUrlMap,
  urlsToAttachments,
} from "@/lib/supabase-signed-url";

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

const T_PHASES = "va_task_phases";
const T_ITEMS = "va_task_phase_items";

type PhaseRow = SbRow & {
  phase_id?: string | null;
  task_id?: string | null;
  task_title?: string | null;
  phase_number?: number | null;
  title?: string | null;
  description?: string | null;
  scheduled_time?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  status?: string | null;
  assigned_va_id?: string | null;
  assigned_va_name?: string | null;
  assigned_model_id?: string | null;
  assigned_model_name?: string | null;
  region?: string | null;
  completed_at?: string | null;
  created_at?: string | null;
};

type ItemRow = SbRow & {
  item_id?: string | null;
  phase_id?: string | null;
  task_id?: string | null;
  title?: string | null;
  description?: string | null;
  requires_screenshot?: boolean | null;
  screenshot?: string[] | null;
  status?: string | null;
  completed_by_va_id?: string | null;
  completed_by_va_name?: string | null;
  completed_at?: string | null;
  sort_order?: number | null;
  step_type?: string | null;
  created_at?: string | null;
};

function asRegion(v: unknown): "USA" | "Greek" | "Global" {
  return v === "USA" || v === "Greek" ? v : "Global";
}

function asPhaseStatus(v: unknown): TaskPhase["status"] {
  if (v === "in_progress" || v === "completed" || v === "overdue") return v;
  return "pending";
}

function mapItemFromSigned(
  row: ItemRow,
  signedMap: Map<string, string>,
): PhaseItem {
  return {
    id: publicId(row),
    item_id: row.item_id ?? publicId(row),
    phase_id: row.phase_id ?? "",
    task_id: row.task_id ?? "",
    title: row.title ?? "",
    description: row.description ?? "",
    requires_screenshot: row.requires_screenshot === true,
    screenshot: attachmentsFromSignedMap(row.screenshot, signedMap),
    status: row.status === "completed" ? "completed" : "pending",
    completed_by_va_id: row.completed_by_va_id ?? "",
    completed_by_va_name: row.completed_by_va_name ?? "",
    completed_at: row.completed_at ?? null,
    sort_order: typeof row.sort_order === "number" ? Number(row.sort_order) : Number(row.sort_order) || 0,
    step_type: coerceTaskStepType(row.step_type),
  };
}

async function mapItem(row: ItemRow): Promise<PhaseItem> {
  const screenshot = await urlsToAttachments(row.screenshot);
  return {
    ...mapItemFromSigned(row, new Map()),
    screenshot,
  };
}

function mapPhase(row: PhaseRow, items: PhaseItem[] = []): TaskPhase {
  return {
    id: publicId(row),
    phase_id: row.phase_id ?? publicId(row),
    task_id: row.task_id ?? "",
    task_title: row.task_title ?? "",
    phase_number: typeof row.phase_number === "number" ? Number(row.phase_number) : Number(row.phase_number) || 1,
    title: row.title ?? "",
    description: row.description ?? "",
    scheduled_time: row.scheduled_time ?? null,
    start_time: row.start_time ?? null,
    end_time: row.end_time ?? null,
    status: asPhaseStatus(row.status),
    assigned_va_id: row.assigned_va_id ?? "",
    assigned_va_name: row.assigned_va_name ?? "",
    assigned_model_id: row.assigned_model_id ?? "",
    assigned_model_name: row.assigned_model_name ?? "",
    region: asRegion(row.region),
    completed_at: row.completed_at ?? null,
    created_at: row.created_at ?? "",
    items,
  };
}

export async function fetchPhasesGroupedByTaskId(taskIds: string[]): Promise<Record<string, TaskPhase[]>> {
  const ids = [...new Set(taskIds.map((t) => t.trim()).filter(Boolean))];
  if (!ids.length) return {};

  const sb = getSupabaseServiceClient();
  const [{ data: phaseData, error: pe }, { data: itemData, error: ie }] = await Promise.all([
    sb.from(T_PHASES).select("*").in("task_id", ids).order("phase_number", { ascending: true }),
    sb.from(T_ITEMS).select("*").in("task_id", ids).order("sort_order", { ascending: true }),
  ]);
  if (pe) throw new Error(`fetchPhasesGroupedByTaskId phases: ${pe.message}`);
  if (ie) throw new Error(`fetchPhasesGroupedByTaskId items: ${ie.message}`);

  const rawItems = (itemData as ItemRow[]) ?? [];
  const allScreenshotUrls = rawItems.flatMap((row) =>
    Array.isArray(row.screenshot)
      ? row.screenshot.filter((u): u is string => typeof u === "string" && u.length > 0)
      : [],
  );
  const signedMap = await batchSignUrlMap(allScreenshotUrls);
  const items = rawItems.map((row) => mapItemFromSigned(row, signedMap));
  const byTaskId: Record<string, TaskPhase[]> = {};

  for (const row of (phaseData as PhaseRow[]) ?? []) {
    const taskId = (row.task_id ?? "").trim();
    if (!taskId) continue;
    const stablePhaseId = row.phase_id ?? publicId(row);
    const phaseItems = items.filter((i) => i.phase_id === stablePhaseId || i.phase_id === publicId(row));
    const phase = mapPhase(row, phaseItems);
    if (!byTaskId[taskId]) byTaskId[taskId] = [];
    byTaskId[taskId].push(phase);
  }
  return byTaskId;
}

export async function getPhasesByTask(taskId: string): Promise<TaskPhase[]> {
  const grouped = await fetchPhasesGroupedByTaskId([taskId]);
  return grouped[taskId] ?? [];
}

export async function resolvePhaseItemRowId(paramId: string): Promise<string | null> {
  const id = paramId?.trim();
  if (!id) return null;
  if (id.startsWith("rec") || id.includes("-")) {
    const row = await sbSelectByPublicId<ItemRow>(T_ITEMS, id);
    return row ? publicId(row) : null;
  }
  const rows = await sbSelectEq<ItemRow>(T_ITEMS, "item_id", id, "*", 5);
  return rows[0] ? publicId(rows[0]) : null;
}

export async function createPhase(fields: Record<string, unknown>): Promise<TaskPhase> {
  const row = await sbInsert<PhaseRow>(T_PHASES, fields);
  return mapPhase(row);
}

export async function updatePhase(id: string, patch: Record<string, unknown>): Promise<void> {
  if (Object.keys(patch).length === 0) return;
  await sbUpdateByPublicId(T_PHASES, id, patch);
}

export async function deletePhase(id: string): Promise<void> {
  await sbDeleteByPublicId(T_PHASES, id);
}

export async function createPhaseItem(fields: Record<string, unknown>): Promise<PhaseItem> {
  const row = await sbInsert<ItemRow>(T_ITEMS, fields);
  return mapItem(row);
}

export async function updatePhaseItem(id: string, patch: Record<string, unknown>): Promise<void> {
  if (Object.keys(patch).length === 0) return;
  // screenshot may arrive as {url}[] from Airtable path — normalize to text[]
  if (Array.isArray(patch.screenshot)) {
    patch.screenshot = (patch.screenshot as Array<{ url?: string } | string>)
      .map((a) => (typeof a === "string" ? a : a?.url))
      .filter(Boolean);
  }
  await sbUpdateByPublicId(T_ITEMS, id, patch);
}

export async function deletePhaseItem(id: string): Promise<void> {
  await sbDeleteByPublicId(T_ITEMS, id);
}

export async function getPhaseRow(id: string): Promise<PhaseRow | null> {
  return sbSelectByPublicId<PhaseRow>(T_PHASES, id);
}

export async function completePhaseItem(
  itemPublicId: string,
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
  const row = await sbSelectByPublicId<ItemRow>(T_ITEMS, itemPublicId);
  if (!row) throw new Error("Item not found");

  const now = new Date().toISOString();
  const phaseStableId = String(row.phase_id ?? "").trim();
  const taskId = String(row.task_id ?? "").trim();
  const itemTitle = String(row.title ?? "Task").trim() || "Task";
  const prior = Array.isArray(row.screenshot)
    ? row.screenshot.map((u) => String(u ?? "").trim()).filter(Boolean)
    : [];
  const incoming = (options?.screenshotAttachments ?? [])
    .map((a) => String(a.url ?? "").trim())
    .filter(Boolean);
  const merged = [...prior, ...incoming];

  if (row.requires_screenshot === true && merged.length === 0) {
    throw new Error("Screenshot is required to complete this checklist item.");
  }

  await updatePhaseItem(publicId(row), {
    status: "completed",
    completed_by_va_id: vaId,
    completed_by_va_name: vaName,
    completed_at: now,
    ...(merged.length > 0 ? { screenshot: merged.map((url) => ({ url })) } : {}),
  });

  const allItems = phaseStableId
    ? await sbSelectEq<ItemRow>(T_ITEMS, "phase_id", phaseStableId)
    : [];
  // Count this item as completed even if the eq read is momentarily stale.
  const completedCount = allItems.filter(
    (r) => r.status === "completed" || publicId(r) === publicId(row),
  ).length;
  const allItemsDone = allItems.length > 0 && completedCount >= allItems.length;

  let phaseCompleted = false;
  let allPhasesCompleted = false;
  let phaseAirtableId = "";

  const phaseRows = taskId ? await sbSelectEq<PhaseRow>(T_PHASES, "task_id", taskId) : [];
  const phaseRow = phaseRows.find(
    (p) => publicId(p) === phaseStableId || String(p.phase_id ?? "").trim() === phaseStableId,
  );
  phaseAirtableId = phaseRow ? publicId(phaseRow) : "";

  if (phaseAirtableId && completedCount === 1 && (phaseRow?.status ?? "pending") === "pending") {
    await updatePhase(phaseAirtableId, {
      status: "in_progress",
      start_time: now,
    });
  }

  if (allItemsDone && taskId && phaseStableId) {
    phaseCompleted = true;
    if (phaseAirtableId) {
      await updatePhase(phaseAirtableId, {
        status: "completed",
        completed_at: now,
        end_time: now,
      });
    }
    const allPhasesRefetched = await sbSelectEq<PhaseRow>(T_PHASES, "task_id", taskId);
    allPhasesCompleted =
      allPhasesRefetched.length > 0 &&
      allPhasesRefetched.every(
        (r) =>
          r.status === "completed" ||
          publicId(r) === phaseAirtableId ||
          String(r.phase_id ?? "").trim() === phaseStableId,
      );
  }

  return { phaseCompleted, allPhasesCompleted, itemTitle, taskId, phaseStableId, phaseAirtableId };
}

export { DEFAULT_TASK_STEP_TYPE };
