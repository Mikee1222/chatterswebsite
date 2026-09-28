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

/** PostgREST silently caps uncapped selects at 1000 rows — always page large IN queries. */
const PHASE_FETCH_PAGE = 1000;
/** Keep `.in()` URL/body size safe when progress view batches many task ids. */
const PHASE_FETCH_ID_CHUNK = 80;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function selectAllEq<T extends SbRow>(table: string, column: string, value: string): Promise<T[]> {
  const sb = getSupabaseServiceClient();
  const out: T[] = [];
  let from = 0;
  for (;;) {
    const { data, error } = await sb
      .from(table)
      .select("*")
      .eq(column, value)
      .range(from, from + PHASE_FETCH_PAGE - 1);
    if (error) throw new Error(`selectAllEq ${table}.${column}: ${error.message}`);
    if (!data?.length) break;
    out.push(...(data as unknown as T[]));
    if (data.length < PHASE_FETCH_PAGE) break;
    from += PHASE_FETCH_PAGE;
  }
  return out;
}

/**
 * `va_tasks.id` (uuid) and `airtable_id` are both stored on phases/items as text `task_id`.
 * Fetching with only the public id can miss the other key (hydration looks empty after a
 * successful complete write). Expand to both identities and index results under every alias.
 */
async function expandTaskIdAliases(taskIds: string[]): Promise<{
  queryIds: string[];
  aliasesFor: (storedTaskId: string) => string[];
}> {
  const requested = [...new Set(taskIds.map((t) => t.trim()).filter(Boolean))];
  if (!requested.length) return { queryIds: [], aliasesFor: (id) => [id] };

  const sb = getSupabaseServiceClient();
  const rows: Array<{ id: string; airtable_id?: string | null }> = [];
  const uuids = requested.filter((id) => UUID_RE.test(id));
  const others = requested.filter((id) => !UUID_RE.test(id));

  for (let i = 0; i < uuids.length; i += PHASE_FETCH_ID_CHUNK) {
    const chunk = uuids.slice(i, i + PHASE_FETCH_ID_CHUNK);
    const { data, error } = await sb.from("va_tasks").select("id, airtable_id").in("id", chunk);
    if (error) throw new Error(`expandTaskIdAliases by id: ${error.message}`);
    if (data?.length) rows.push(...(data as Array<{ id: string; airtable_id?: string | null }>));
  }
  for (let i = 0; i < others.length; i += PHASE_FETCH_ID_CHUNK) {
    const chunk = others.slice(i, i + PHASE_FETCH_ID_CHUNK);
    const { data, error } = await sb.from("va_tasks").select("id, airtable_id").in("airtable_id", chunk);
    if (error) throw new Error(`expandTaskIdAliases by airtable_id: ${error.message}`);
    if (data?.length) rows.push(...(data as Array<{ id: string; airtable_id?: string | null }>));
  }

  const storedToAliases = new Map<string, Set<string>>();
  const addAlias = (stored: string, alias: string) => {
    if (!stored || !alias) return;
    let set = storedToAliases.get(stored);
    if (!set) {
      set = new Set();
      storedToAliases.set(stored, set);
    }
    set.add(alias);
  };

  for (const row of rows) {
    const uuid = String(row.id ?? "").trim();
    const airtable = String(row.airtable_id ?? "").trim();
    const aliases = [uuid, airtable, publicId(row), ...requested.filter((r) => r === uuid || r === airtable)].filter(
      Boolean,
    );
    const uniq = [...new Set(aliases)];
    for (const stored of uniq) {
      for (const alias of uniq) addAlias(stored, alias);
    }
  }

  const queryIds = [...new Set([...requested, ...storedToAliases.keys()])];
  return {
    queryIds,
    aliasesFor: (storedTaskId: string) => {
      const aliases = storedToAliases.get(storedTaskId.trim());
      if (aliases?.size) return [...aliases];
      return [storedTaskId.trim()].filter(Boolean);
    },
  };
}

async function selectAllByTaskIds<T extends SbRow>(
  table: string,
  taskIds: string[],
  orderCol: string,
  columns = "*",
): Promise<T[]> {
  if (!taskIds.length) return [];
  const sb = getSupabaseServiceClient();
  const out: T[] = [];

  for (let i = 0; i < taskIds.length; i += PHASE_FETCH_ID_CHUNK) {
    const chunk = taskIds.slice(i, i + PHASE_FETCH_ID_CHUNK);
    let from = 0;
    for (;;) {
      const { data, error } = await sb
        .from(table)
        .select(columns)
        .in("task_id", chunk)
        .order(orderCol, { ascending: true })
        .range(from, from + PHASE_FETCH_PAGE - 1);
      if (error) throw new Error(`fetchPhasesGroupedByTaskId ${table}: ${error.message}`);
      if (!data?.length) break;
      out.push(...(data as unknown as T[]));
      if (data.length < PHASE_FETCH_PAGE) break;
      from += PHASE_FETCH_PAGE;
    }
  }
  return out;
}

export async function fetchPhasesGroupedByTaskId(taskIds: string[]): Promise<Record<string, TaskPhase[]>> {
  const ids = [...new Set(taskIds.map((t) => t.trim()).filter(Boolean))];
  if (!ids.length) return {};

  const { queryIds, aliasesFor } = await expandTaskIdAliases(ids);

  const [phaseData, itemData] = await Promise.all([
    selectAllByTaskIds<PhaseRow>(T_PHASES, queryIds, "phase_number"),
    selectAllByTaskIds<ItemRow>(T_ITEMS, queryIds, "sort_order"),
  ]);

  const rawItems = itemData;
  const allScreenshotUrls = rawItems.flatMap((row) =>
    Array.isArray(row.screenshot)
      ? row.screenshot.filter((u): u is string => typeof u === "string" && u.length > 0)
      : [],
  );
  const signedMap = await batchSignUrlMap(allScreenshotUrls);
  const items = rawItems.map((row) => mapItemFromSigned(row, signedMap));

  // O(items) index — avoid O(phases × items) filter (Warm-Up ≈ 76 items/task; progress batches hundreds).
  const itemsByPhaseKey = new Map<string, PhaseItem[]>();
  for (const item of items) {
    const key = (item.phase_id ?? "").trim();
    if (!key) continue;
    const list = itemsByPhaseKey.get(key);
    if (list) list.push(item);
    else itemsByPhaseKey.set(key, [item]);
  }

  const byTaskId: Record<string, TaskPhase[]> = {};
  const attachedItemIds = new Set<string>();

  const pushPhase = (alias: string, phase: TaskPhase) => {
    if (!alias) return;
    if (!byTaskId[alias]) byTaskId[alias] = [];
    if (byTaskId[alias].some((p) => p.id === phase.id)) return;
    byTaskId[alias].push(phase);
  };

  for (const row of phaseData) {
    const taskId = (row.task_id ?? "").trim();
    if (!taskId) continue;
    const pub = publicId(row);
    const stablePhaseId = (row.phase_id ?? pub).trim();
    const phaseItems = [
      ...(itemsByPhaseKey.get(stablePhaseId) ?? []),
      ...(stablePhaseId !== pub ? (itemsByPhaseKey.get(pub) ?? []) : []),
    ];
    // Dedupe if phase_id === public id matched twice
    const seen = new Set<string>();
    const deduped = phaseItems.filter((it) => {
      if (seen.has(it.id)) return false;
      seen.add(it.id);
      attachedItemIds.add(it.id);
      return true;
    });
    const phase = mapPhase(row, deduped);
    for (const alias of aliasesFor(taskId)) {
      pushPhase(alias, phase);
    }
  }

  // Orphans: items whose phase_id no longer matches a live phase (phase deleted without
  // cascading items, then spawn re-cloned a fresh checklist). Pending orphans duplicate the
  // live card — never attach them. Completed orphans: merge onto a matching live item for
  // display, or append to the last phase if no match exists.
  const orphanByTask = new Map<string, PhaseItem[]>();
  for (const item of items) {
    if (attachedItemIds.has(item.id)) continue;
    const taskId = (item.task_id ?? "").trim();
    if (!taskId) continue;
    const list = orphanByTask.get(taskId);
    if (list) list.push(item);
    else orphanByTask.set(taskId, [item]);
  }
  for (const [storedTaskId, orphans] of orphanByTask) {
    const aliases = aliasesFor(storedTaskId);
    const targetAlias = aliases.find((a) => (byTaskId[a]?.length ?? 0) > 0) ?? aliases[0];
    if (!targetAlias) continue;
    const phases = byTaskId[targetAlias];
    if (!phases?.length) continue;

    const liveByKey = new Map<string, PhaseItem>();
    for (const phase of phases) {
      for (const it of phase.items) {
        liveByKey.set(`${(it.title ?? "").trim()}\0${it.sort_order ?? 0}`, it);
      }
    }

    const leftoverCompleted: PhaseItem[] = [];
    for (const orphan of orphans) {
      const completed = (orphan.status ?? "").toLowerCase() === "completed";
      if (!completed) continue;
      const key = `${(orphan.title ?? "").trim()}\0${orphan.sort_order ?? 0}`;
      const live = liveByKey.get(key);
      if (live && (live.status ?? "").toLowerCase() !== "completed") {
        live.status = orphan.status;
        live.completed_at = orphan.completed_at;
        live.completed_by_va_id = orphan.completed_by_va_id;
        live.completed_by_va_name = orphan.completed_by_va_name;
        if (orphan.screenshot?.length && !(live.screenshot?.length)) {
          live.screenshot = orphan.screenshot;
        }
      } else if (!live) {
        leftoverCompleted.push(orphan);
      }
    }
    if (leftoverCompleted.length) {
      const last = phases[phases.length - 1]!;
      last.items = [...last.items, ...leftoverCompleted];
    }
  }

  return byTaskId;
}

export async function getPhasesByTask(taskId: string): Promise<TaskPhase[]> {
  const grouped = await fetchPhasesGroupedByTaskId([taskId]);
  return grouped[taskId] ?? [];
}

/**
 * Cheap existence check used by recurring spawn on every /va-tasks load.
 * Avoids fetchPhasesGroupedByTaskId (Warm-Up ≈ 76 items) just to test phases.length > 0.
 *
 * Also treats leftover checklist items (no live phase row) as "has structure" so spawn
 * does not re-clone a second Warm-Up set after phases were deleted without cascading items.
 */
export async function taskHasAnyPhases(taskId: string): Promise<boolean> {
  const id = taskId.trim();
  if (!id) return false;
  const { queryIds } = await expandTaskIdAliases([id]);
  if (!queryIds.length) return false;
  const sb = getSupabaseServiceClient();
  for (let i = 0; i < queryIds.length; i += PHASE_FETCH_ID_CHUNK) {
    const chunk = queryIds.slice(i, i + PHASE_FETCH_ID_CHUNK);
    const { data, error } = await sb.from(T_PHASES).select("id").in("task_id", chunk).limit(1);
    if (error) throw new Error(`taskHasAnyPhases: ${error.message}`);
    if (data?.length) return true;
  }
  for (let i = 0; i < queryIds.length; i += PHASE_FETCH_ID_CHUNK) {
    const chunk = queryIds.slice(i, i + PHASE_FETCH_ID_CHUNK);
    const { data, error } = await sb.from(T_ITEMS).select("id").in("task_id", chunk).limit(1);
    if (error) throw new Error(`taskHasAnyPhases items: ${error.message}`);
    if (data?.length) return true;
  }
  return false;
}

export type PhaseCloneSourceScore = {
  taskId: string;
  itemCount: number;
  withModel: boolean;
};

/**
 * One batched score pass for pickPhaseCloneSourceId — replaces N× getPhasesByTask
 * (Daily Marketing history alone was 50+ full checklist fetches per spawn).
 */
export async function scorePhaseCloneSources(taskIds: string[]): Promise<PhaseCloneSourceScore[]> {
  const ids = [...new Set(taskIds.map((t) => t.trim()).filter(Boolean))];
  if (!ids.length) return [];

  const { queryIds, aliasesFor } = await expandTaskIdAliases(ids);
  if (!queryIds.length) return ids.map((taskId) => ({ taskId, itemCount: 0, withModel: false }));

  const [phaseData, itemData] = await Promise.all([
    selectAllByTaskIds<{ id: string; task_id?: string | null; assigned_model_id?: string | null } & SbRow>(
      T_PHASES,
      queryIds,
      "phase_number",
      "id, task_id, assigned_model_id",
    ),
    selectAllByTaskIds<{ id: string; task_id?: string | null } & SbRow>(
      T_ITEMS,
      queryIds,
      "sort_order",
      "id, task_id",
    ),
  ]);

  const itemCountByStored = new Map<string, number>();
  for (const row of itemData) {
    const tid = String(row.task_id ?? "").trim();
    if (!tid) continue;
    itemCountByStored.set(tid, (itemCountByStored.get(tid) ?? 0) + 1);
  }
  const modelByStored = new Map<string, boolean>();
  for (const row of phaseData) {
    const tid = String(row.task_id ?? "").trim();
    if (!tid) continue;
    if (String(row.assigned_model_id ?? "").trim()) modelByStored.set(tid, true);
  }

  return ids.map((taskId) => {
    let itemCount = 0;
    let withModel = false;
    for (const [stored, count] of itemCountByStored) {
      if (stored === taskId || aliasesFor(stored).includes(taskId)) itemCount += count;
    }
    for (const [stored, has] of modelByStored) {
      if (has && (stored === taskId || aliasesFor(stored).includes(taskId))) withModel = true;
    }
    if (itemCount === 0) itemCount = itemCountByStored.get(taskId) ?? 0;
    if (!withModel) withModel = modelByStored.get(taskId) === true;
    return { taskId, itemCount, withModel };
  });
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
  const row = await sbSelectByPublicId<PhaseRow>(T_PHASES, id);
  if (!row) return;
  const stablePhaseId = String(row.phase_id ?? publicId(row)).trim();
  const sb = getSupabaseServiceClient();
  if (stablePhaseId) {
    const { error: itemsError } = await sb.from(T_ITEMS).delete().eq("phase_id", stablePhaseId);
    if (itemsError) throw new Error(`deletePhase items: ${itemsError.message}`);
  }
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

/** Cascade cleanup when a va_tasks row is deleted (task_id is text, not a FK). */
export async function deletePhasesAndItemsForTaskIds(taskIds: string[]): Promise<void> {
  const ids = [...new Set(taskIds.map((t) => t.trim()).filter(Boolean))];
  if (!ids.length) return;
  const sb = getSupabaseServiceClient();
  const { error: itemsError } = await sb.from(T_ITEMS).delete().in("task_id", ids);
  if (itemsError) throw new Error(`deletePhasesAndItemsForTaskIds items: ${itemsError.message}`);
  const { error: phasesError } = await sb.from(T_PHASES).delete().in("task_id", ids);
  if (phasesError) throw new Error(`deletePhasesAndItemsForTaskIds phases: ${phasesError.message}`);
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

  const allItems = phaseStableId ? await selectAllEq<ItemRow>(T_ITEMS, "phase_id", phaseStableId) : [];
  // Count this item as completed even if the eq read is momentarily stale.
  const completedCount = allItems.filter(
    (r) => r.status === "completed" || publicId(r) === publicId(row),
  ).length;
  const allItemsDone = allItems.length > 0 && completedCount >= allItems.length;

  let phaseCompleted = false;
  let allPhasesCompleted = false;
  let phaseAirtableId = "";

  const phaseRows = taskId ? await selectAllEq<PhaseRow>(T_PHASES, "task_id", taskId) : [];
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
    const allPhasesRefetched = await selectAllEq<PhaseRow>(T_PHASES, "task_id", taskId);
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
