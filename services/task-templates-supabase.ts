/**
 * Supabase backend for services/task-templates.ts (DATA_BACKEND=supabase).
 * applyTemplateToTask stays in task-templates.ts (orchestration via dual-backend primitives).
 */

import { coerceTaskStepType, DEFAULT_TASK_STEP_TYPE, type TaskStepType } from "@/lib/task-step-types";
import {
  publicId,
  mapLinkedIds,
  sbDeleteByIds,
  sbInsert,
  sbInsertMany,
  sbResolveUuidToAirtableMap,
  sbSelectAll,
  sbSelectByPublicId,
  sbSelectEq,
  sbSelectWhere,
  sbUpdateByPublicId,
  sbUuidsForAirtableIds,
  type SbRow,
} from "@/lib/supabase-data";
import { getSupabaseServiceClient } from "@/lib/supabase-server";

export type TaskTemplateCategory = "marketing" | "chatting" | "content" | "other";

export interface TaskTemplateRecord {
  id: string;
  template_id: string;
  name: string;
  description: string;
  category: TaskTemplateCategory;
  is_active: boolean;
  created_at: string | null;
}

export interface TaskTemplateItemRecord {
  id: string;
  item_template_id: string;
  phase_template_ids: string[];
  title: string;
  description: string;
  requires_screenshot: boolean;
  sort_order: number;
  step_type: TaskStepType;
}

export interface TaskTemplatePhaseRecord {
  id: string;
  phase_template_id: string;
  template_ids: string[];
  phase_number: number;
  title: string;
  description: string;
  items: TaskTemplateItemRecord[];
}

export interface TaskTemplateDetail extends TaskTemplateRecord {
  phases: TaskTemplatePhaseRecord[];
}

const T_TEMPLATES = "task_templates";
const T_PHASES = "task_template_phases";
const T_ITEMS = "task_template_items";

type TemplateRow = SbRow & {
  template_id?: string | null;
  name?: string | null;
  description?: string | null;
  category?: string | null;
  is_active?: boolean | null;
  created_at?: string | null;
};

type PhaseRow = SbRow & {
  phase_template_id?: string | null;
  template?: string[] | null;
  phase_number?: number | null;
  title?: string | null;
  description?: string | null;
};

type ItemRow = SbRow & {
  item_template_id?: string | null;
  phase_template?: string[] | null;
  title?: string | null;
  description?: string | null;
  requires_screenshot?: boolean | null;
  sort_order?: number | null;
  step_type?: string | null;
};

function parseCategory(raw: unknown): TaskTemplateCategory {
  const c = typeof raw === "string" ? raw : "";
  if (c === "marketing" || c === "chatting" || c === "content" || c === "other") return c;
  return "other";
}

function mapTemplate(row: TemplateRow): TaskTemplateRecord {
  return {
    id: publicId(row),
    template_id: row.template_id ?? publicId(row),
    name: row.name?.trim() ? String(row.name) : "",
    description: row.description?.trim() ? String(row.description) : "",
    category: parseCategory(row.category),
    is_active: row.is_active !== false,
    created_at: row.created_at?.trim() ? String(row.created_at) : null,
  };
}

function mapItemRow(
  row: ItemRow,
  phaseAtByUuid: Map<string, string>
): TaskTemplateItemRecord {
  return {
    id: publicId(row),
    item_template_id: row.item_template_id ?? publicId(row),
    phase_template_ids: mapLinkedIds(row.phase_template, phaseAtByUuid),
    title: row.title?.trim() ? String(row.title) : "",
    description: row.description?.trim() ? String(row.description) : "",
    requires_screenshot: row.requires_screenshot === true,
    sort_order: typeof row.sort_order === "number" ? Number(row.sort_order) : Number(row.sort_order) || 0,
    step_type: coerceTaskStepType(row.step_type),
  };
}

export async function getTaskTemplates(category?: TaskTemplateCategory): Promise<TaskTemplateRecord[]> {
  const rows = await sbSelectAll<TemplateRow>(T_TEMPLATES);
  let templates = rows.map(mapTemplate).filter((t) => t.is_active);
  if (category) templates = templates.filter((t) => t.category === category);
  return templates.sort((a, b) => a.name.localeCompare(b.name));
}

export async function getAllTaskTemplatesAdmin(): Promise<TaskTemplateRecord[]> {
  const rows = await sbSelectAll<TemplateRow>(T_TEMPLATES);
  return rows.map(mapTemplate).sort((a, b) => a.name.localeCompare(b.name));
}

export async function getTaskTemplateDetail(templateId: string): Promise<TaskTemplateDetail | null> {
  let templateRow = await sbSelectByPublicId<TemplateRow>(T_TEMPLATES, templateId);
  if (!templateRow) {
    const byLogical = await sbSelectEq<TemplateRow>(T_TEMPLATES, "template_id", templateId, "*", 1);
    templateRow = byLogical[0] ?? null;
  }
  if (!templateRow) return null;

  const templateUuid = templateRow.id;
  const phaseRows = (
    await sbSelectWhere<PhaseRow>(T_PHASES, (q) => q.contains("template", [templateUuid]))
  ).sort((a, b) => Number(a.phase_number ?? 0) - Number(b.phase_number ?? 0));

  const phaseUuids = phaseRows.map((p) => p.id);
  const itemRows = phaseUuids.length
    ? await sbSelectWhere<ItemRow>(T_ITEMS, (q) => q.overlaps("phase_template", phaseUuids))
    : [];

  const phaseAtByUuid = await sbResolveUuidToAirtableMap(
    T_PHASES,
    [...phaseRows.map((p) => p.template), ...itemRows.map((i) => i.phase_template)]
  );
  const templateAtByUuid = await sbResolveUuidToAirtableMap(T_TEMPLATES, phaseRows.map((p) => p.template));

  const items = itemRows.map((row) => mapItemRow(row, phaseAtByUuid));
  const itemsByPhase = new Map<string, TaskTemplateItemRecord[]>();
  for (const item of items) {
    const phasePublicId = item.phase_template_ids[0];
    if (!phasePublicId) continue;
    const list = itemsByPhase.get(phasePublicId) ?? [];
    list.push(item);
    itemsByPhase.set(phasePublicId, list);
  }

  const phases = phaseRows.map((prow) => {
    const pid = publicId(prow);
    const phaseItems = (itemsByPhase.get(pid) ?? []).sort((a, b) => a.sort_order - b.sort_order);
    return {
      id: pid,
      phase_template_id: prow.phase_template_id ?? pid,
      template_ids: mapLinkedIds(prow.template, templateAtByUuid),
      phase_number:
        typeof prow.phase_number === "number" ? Number(prow.phase_number) : Number(prow.phase_number) || 1,
      title: prow.title?.trim() ? String(prow.title) : "",
      description: prow.description?.trim() ? String(prow.description) : "",
      items: phaseItems,
    } satisfies TaskTemplatePhaseRecord;
  });

  return { ...mapTemplate(templateRow), phases };
}

export type TaskTemplateCreateInput = {
  name: string;
  description?: string;
  category?: TaskTemplateCategory;
  phases?: Array<{
    phase_number: number;
    title: string;
    description?: string;
    items?: Array<{
      title: string;
      description?: string;
      requires_screenshot?: boolean;
      sort_order?: number;
      step_type?: TaskStepType;
    }>;
  }>;
};

export type TaskTemplateUpdateInput = Partial<{
  name: string;
  description: string;
  category: TaskTemplateCategory;
  is_active: boolean;
  phases: TaskTemplateCreateInput["phases"];
}>;

type PhaseInput = NonNullable<TaskTemplateCreateInput["phases"]>[number];
type ItemInput = NonNullable<PhaseInput["items"]>[number];

function newPhaseTemplateId(): string {
  return `phase_tpl_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

function newItemTemplateId(): string {
  return `item_tpl_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

function phaseFieldsEqual(existing: PhaseRow, incoming: PhaseInput, phaseNumber: number): boolean {
  return (
    Number(existing.phase_number ?? 0) === phaseNumber &&
    (existing.title ?? "").trim() === incoming.title.trim() &&
    (existing.description ?? "").trim() === (incoming.description ?? "").trim()
  );
}

function itemFieldsEqual(existing: ItemRow, incoming: ItemInput, sortOrder: number): boolean {
  return (
    (existing.title ?? "").trim() === incoming.title.trim() &&
    (existing.description ?? "").trim() === (incoming.description ?? "").trim() &&
    existing.requires_screenshot === (incoming.requires_screenshot ?? false) &&
    Number(existing.sort_order ?? 0) === sortOrder &&
    coerceTaskStepType(existing.step_type) === (incoming.step_type ?? DEFAULT_TASK_STEP_TYPE)
  );
}

function itemInsertRow(phaseUuid: string, incoming: ItemInput, sortOrder: number): Record<string, unknown> {
  return {
    item_template_id: newItemTemplateId(),
    phase_template: [phaseUuid],
    title: incoming.title.trim(),
    description: (incoming.description ?? "").trim(),
    requires_screenshot: incoming.requires_screenshot ?? false,
    sort_order: sortOrder,
    step_type: incoming.step_type ?? DEFAULT_TASK_STEP_TYPE,
  };
}

function syncItemsForPhase(
  phaseUuid: string,
  incomingItems: ItemInput[],
  existingItems: ItemRow[],
  itemIdsToDelete: string[],
  itemRowsToInsert: Record<string, unknown>[],
  itemUpdates: Promise<unknown>[]
): void {
  const sortedExisting = [...existingItems].sort(
    (a, b) => Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0)
  );

  for (let i = 0; i < incomingItems.length; i++) {
    const incoming = incomingItems[i]!;
    const sortOrder = incoming.sort_order ?? i;
    const existing = sortedExisting[i];
    if (existing) {
      if (!itemFieldsEqual(existing, incoming, sortOrder)) {
        itemUpdates.push(
          sbUpdateByPublicId(T_ITEMS, publicId(existing), {
            title: incoming.title.trim(),
            description: (incoming.description ?? "").trim(),
            requires_screenshot: incoming.requires_screenshot ?? false,
            sort_order: sortOrder,
            step_type: incoming.step_type ?? DEFAULT_TASK_STEP_TYPE,
          })
        );
      }
    } else {
      itemRowsToInsert.push(itemInsertRow(phaseUuid, incoming, sortOrder));
    }
  }

  for (let i = incomingItems.length; i < sortedExisting.length; i++) {
    itemIdsToDelete.push(sortedExisting[i]!.id);
  }
}

async function replaceTemplatePhases(
  templatePublicId: string,
  phases: NonNullable<TaskTemplateCreateInput["phases"]>
): Promise<void> {
  const templateRow = await sbSelectByPublicId<TemplateRow>(T_TEMPLATES, templatePublicId);
  const templateUuids = await sbUuidsForAirtableIds(T_TEMPLATES, [templatePublicId]);
  const templateUuid = templateUuids[0] || templateRow?.id;
  if (!templateUuid) throw new Error("Template not found");

  const existingPhases = (
    await sbSelectWhere<PhaseRow>(T_PHASES, (q) => q.contains("template", [templateUuid]))
  ).sort((a, b) => Number(a.phase_number ?? 0) - Number(b.phase_number ?? 0));

  const phaseUuids = existingPhases.map((p) => p.id);
  const existingItems = phaseUuids.length
    ? await sbSelectWhere<ItemRow>(T_ITEMS, (q) => q.overlaps("phase_template", phaseUuids))
    : [];

  const itemsByPhaseUuid = new Map<string, ItemRow[]>();
  for (const item of existingItems) {
    const phaseUuid = (item.phase_template ?? [])[0];
    if (!phaseUuid) continue;
    const list = itemsByPhaseUuid.get(phaseUuid) ?? [];
    list.push(item);
    itemsByPhaseUuid.set(phaseUuid, list);
  }

  const phaseIdsToDelete: string[] = [];
  const itemIdsToDelete: string[] = [];
  const phaseRowsToInsert: Record<string, unknown>[] = [];
  const pendingPhaseItems: ItemInput[][] = [];
  const phaseUpdates: Promise<unknown>[] = [];
  const itemUpdates: Promise<unknown>[] = [];
  const itemRowsToInsert: Record<string, unknown>[] = [];

  for (let pi = 0; pi < phases.length; pi++) {
    const phaseInput = phases[pi]!;
    const phaseNumber = phaseInput.phase_number ?? pi + 1;
    const existingPhase = existingPhases[pi];

    if (existingPhase) {
      if (!phaseFieldsEqual(existingPhase, phaseInput, phaseNumber)) {
        phaseUpdates.push(
          sbUpdateByPublicId(T_PHASES, publicId(existingPhase), {
            phase_number: phaseNumber,
            title: phaseInput.title.trim(),
            description: (phaseInput.description ?? "").trim(),
          })
        );
      }
      syncItemsForPhase(
        existingPhase.id,
        phaseInput.items ?? [],
        itemsByPhaseUuid.get(existingPhase.id) ?? [],
        itemIdsToDelete,
        itemRowsToInsert,
        itemUpdates
      );
    } else {
      phaseRowsToInsert.push({
        phase_template_id: newPhaseTemplateId(),
        template: [templateUuid],
        phase_number: phaseNumber,
        title: phaseInput.title.trim(),
        description: (phaseInput.description ?? "").trim(),
      });
      pendingPhaseItems.push(phaseInput.items ?? []);
    }
  }

  for (let i = phases.length; i < existingPhases.length; i++) {
    const phase = existingPhases[i]!;
    phaseIdsToDelete.push(phase.id);
    for (const item of itemsByPhaseUuid.get(phase.id) ?? []) {
      itemIdsToDelete.push(item.id);
    }
  }

  const allItemIdsToDelete = [...new Set(itemIdsToDelete)];
  await sbDeleteByIds(T_ITEMS, allItemIdsToDelete);
  await Promise.all([...phaseUpdates, ...itemUpdates]);

  if (phaseRowsToInsert.length) {
    const insertedPhases = await sbInsertMany<PhaseRow>(T_PHASES, phaseRowsToInsert);
    for (let i = 0; i < insertedPhases.length; i++) {
      const phaseRec = insertedPhases[i]!;
      const items = pendingPhaseItems[i] ?? [];
      for (let j = 0; j < items.length; j++) {
        itemRowsToInsert.push(itemInsertRow(phaseRec.id, items[j]!, items[j]!.sort_order ?? j));
      }
    }
  }

  if (itemRowsToInsert.length) {
    await sbInsertMany<ItemRow>(T_ITEMS, itemRowsToInsert);
  }

  await sbDeleteByIds(T_PHASES, phaseIdsToDelete);
}

export async function createTaskTemplate(data: TaskTemplateCreateInput): Promise<TaskTemplateDetail> {
  const row = await sbInsert<TemplateRow>(T_TEMPLATES, {
    template_id: `tpl_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    name: data.name.trim(),
    description: (data.description ?? "").trim(),
    category: data.category ?? "other",
    is_active: true,
    created_at: new Date().toISOString(),
  });

  if (data.phases?.length) {
    await replaceTemplatePhases(publicId(row), data.phases);
  }

  const detail = await getTaskTemplateDetail(publicId(row));
  if (!detail) throw new Error("Failed to load created template");
  return detail;
}

export async function updateTaskTemplate(id: string, data: TaskTemplateUpdateInput): Promise<TaskTemplateDetail> {
  const patch: Record<string, unknown> = {};
  if (data.name !== undefined) patch.name = data.name.trim();
  if (data.description !== undefined) patch.description = data.description.trim();
  if (data.category !== undefined) patch.category = data.category;
  if (data.is_active !== undefined) patch.is_active = data.is_active;
  if (Object.keys(patch).length > 0) {
    await sbUpdateByPublicId(T_TEMPLATES, id, patch);
  }
  if (data.phases !== undefined) {
    await replaceTemplatePhases(id, data.phases);
  }
  const detail = await getTaskTemplateDetail(id);
  if (!detail) throw new Error("Template not found after update");
  return detail;
}

export async function deleteTaskTemplate(id: string): Promise<void> {
  await sbUpdateByPublicId(T_TEMPLATES, id, { is_active: false });
}

/** Full independent copy of a template (phases + items). Does not link to the original. */
export async function duplicateTaskTemplate(id: string): Promise<TaskTemplateDetail> {
  const detail = await getTaskTemplateDetail(id);
  if (!detail) throw new Error("Template not found");
  return createTaskTemplate({
    name: `${detail.name.trim() || "Template"} (Copy)`,
    description: detail.description,
    category: detail.category,
    phases: detail.phases.map((p) => ({
      phase_number: p.phase_number,
      title: p.title,
      description: p.description,
      items: p.items.map((i) => ({
        title: i.title,
        description: i.description,
        requires_screenshot: i.requires_screenshot,
        sort_order: i.sort_order,
        step_type: i.step_type,
      })),
    })),
  });
}

// Keep client import happy if needed
void getSupabaseServiceClient;
