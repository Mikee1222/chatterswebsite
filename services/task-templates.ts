"use server";

import {
  createRecord,
  getRecord,
  listAllRecords,
  updateRecord,
  type AirtableRecord,
} from "@/lib/airtable-server";
import { linkedRecordIds, snapshotText } from "@/lib/airtable-linked";
import { createVaTask } from "@/services/va-tasks";
import { createPhase, createPhaseItem, getPhasesByTask, type TaskPhase } from "@/services/task-phases";
import { getUserByAirtableId } from "@/services/users";
import { listAllModelss } from "@/services/modelss";
import type { VaTaskRecord } from "@/types";

const TABLE_TEMPLATES = "task_templates";
const TABLE_PHASES = "task_template_phases";
const TABLE_ITEMS = "task_template_items";

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

export interface TaskTemplatePhaseRecord {
  id: string;
  phase_template_id: string;
  template_ids: string[];
  phase_number: number;
  title: string;
  description: string;
  items: TaskTemplateItemRecord[];
}

export interface TaskTemplateItemRecord {
  id: string;
  item_template_id: string;
  phase_template_ids: string[];
  title: string;
  description: string;
  requires_screenshot: boolean;
  sort_order: number;
}

export interface TaskTemplateDetail extends TaskTemplateRecord {
  phases: TaskTemplatePhaseRecord[];
}

type TemplateFields = {
  template_id?: string;
  name?: string;
  description?: string;
  category?: string;
  is_active?: boolean;
  created_at?: string;
};

type PhaseFields = {
  phase_template_id?: string;
  template?: string | string[];
  phase_number?: number;
  title?: string;
  description?: string;
};

type ItemFields = {
  item_template_id?: string;
  phase_template?: string | string[];
  title?: string;
  description?: string;
  requires_screenshot?: boolean;
  sort_order?: number;
};

function airtableFormulaString(value: string): string {
  return String(value ?? "").replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function parseCategory(raw: unknown): TaskTemplateCategory {
  const c = typeof raw === "string" ? raw : "";
  if (c === "marketing" || c === "chatting" || c === "content" || c === "other") return c;
  return "other";
}

function mapTemplate(rec: AirtableRecord<TemplateFields>): TaskTemplateRecord {
  const f = rec.fields ?? {};
  return {
    id: rec.id,
    template_id: (f.template_id as string) ?? rec.id,
    name: snapshotText(f.name, ""),
    description: snapshotText(f.description, ""),
    category: parseCategory(f.category),
    is_active: f.is_active !== false,
    created_at: f.created_at?.trim() ? f.created_at.trim() : null,
  };
}

function mapItem(rec: AirtableRecord<ItemFields>): TaskTemplateItemRecord {
  const f = rec.fields ?? {};
  return {
    id: rec.id,
    item_template_id: (f.item_template_id as string) ?? rec.id,
    phase_template_ids: linkedRecordIds(f.phase_template),
    title: snapshotText(f.title, ""),
    description: snapshotText(f.description, ""),
    requires_screenshot: f.requires_screenshot === true,
    sort_order: typeof f.sort_order === "number" ? f.sort_order : Number(f.sort_order) || 0,
  };
}

function mapPhase(rec: AirtableRecord<PhaseFields>, items: TaskTemplateItemRecord[] = []): TaskTemplatePhaseRecord {
  const f = rec.fields ?? {};
  return {
    id: rec.id,
    phase_template_id: (f.phase_template_id as string) ?? rec.id,
    template_ids: linkedRecordIds(f.template),
    phase_number: typeof f.phase_number === "number" ? f.phase_number : Number(f.phase_number) || 1,
    title: snapshotText(f.title, ""),
    description: snapshotText(f.description, ""),
    items,
  };
}

export async function getTaskTemplates(category?: TaskTemplateCategory): Promise<TaskTemplateRecord[]> {
  const records = await listAllRecords<TemplateFields>(TABLE_TEMPLATES, {
    sort: [{ field: "name", direction: "asc" }],
  });
  let templates = records.map(mapTemplate).filter((t) => t.is_active);
  if (category) templates = templates.filter((t) => t.category === category);
  return templates;
}

export async function getAllTaskTemplatesAdmin(): Promise<TaskTemplateRecord[]> {
  const records = await listAllRecords<TemplateFields>(TABLE_TEMPLATES, {
    sort: [{ field: "name", direction: "asc" }],
  });
  return records.map(mapTemplate);
}

export async function getTaskTemplateDetail(templateId: string): Promise<TaskTemplateDetail | null> {
  let templateRec: AirtableRecord<TemplateFields>;
  try {
    templateRec = await getRecord<TemplateFields>(TABLE_TEMPLATES, templateId);
  } catch {
    const esc = airtableFormulaString(templateId);
    const byLogical = await listAllRecords<TemplateFields>(TABLE_TEMPLATES, {
      filterByFormula: `{template_id} = "${esc}"`,
      pageSize: 1,
    });
    if (!byLogical[0]) return null;
    templateRec = byLogical[0];
  }

  const tid = templateRec.id;
  const escTid = airtableFormulaString(tid);
  const [phaseRecords, itemRecords] = await Promise.all([
    listAllRecords<PhaseFields>(TABLE_PHASES, {
      filterByFormula: `FIND("${escTid}", ARRAYJOIN({template}))`,
      sort: [{ field: "phase_number", direction: "asc" }],
    }),
    listAllRecords<ItemFields>(TABLE_ITEMS, {}),
  ]);

  const items = itemRecords.map(mapItem);
  const phases = phaseRecords.map((rec) => {
    const phaseItems = items
      .filter((i) => i.phase_template_ids.includes(rec.id))
      .sort((a, b) => a.sort_order - b.sort_order);
    return mapPhase(rec, phaseItems);
  });

  return { ...mapTemplate(templateRec), phases };
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

async function replaceTemplatePhases(
  templateAirtableId: string,
  phases: NonNullable<TaskTemplateCreateInput["phases"]>,
): Promise<void> {
  const escTid = airtableFormulaString(templateAirtableId);
  const existingPhases = await listAllRecords<PhaseFields>(TABLE_PHASES, {
    filterByFormula: `FIND("${escTid}", ARRAYJOIN({template}))`,
  });

  for (const phaseRec of existingPhases) {
    const escPhase = airtableFormulaString(phaseRec.id);
    const existingItems = await listAllRecords<ItemFields>(TABLE_ITEMS, {
      filterByFormula: `FIND("${escPhase}", ARRAYJOIN({phase_template}))`,
    });
    for (const itemRec of existingItems) {
      const { deleteRecord } = await import("@/lib/airtable-server");
      await deleteRecord(TABLE_ITEMS, itemRec.id);
    }
    const { deleteRecord } = await import("@/lib/airtable-server");
    await deleteRecord(TABLE_PHASES, phaseRec.id);
  }

  for (const phase of phases) {
    const phaseRec = await createRecord<PhaseFields>(TABLE_PHASES, {
      phase_template_id: `phase_tpl_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      template: [templateAirtableId],
      phase_number: phase.phase_number,
      title: phase.title.trim(),
      description: (phase.description ?? "").trim(),
    });

    for (let i = 0; i < (phase.items ?? []).length; i++) {
      const item = phase.items![i];
      await createRecord<ItemFields>(TABLE_ITEMS, {
        item_template_id: `item_tpl_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        phase_template: [phaseRec.id],
        title: item.title.trim(),
        description: (item.description ?? "").trim(),
        requires_screenshot: item.requires_screenshot ?? false,
        sort_order: item.sort_order ?? i,
      });
    }
  }
}

export async function createTaskTemplate(data: TaskTemplateCreateInput): Promise<TaskTemplateDetail> {
  const rec = await createRecord<TemplateFields>(TABLE_TEMPLATES, {
    template_id: `tpl_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    name: data.name.trim(),
    description: (data.description ?? "").trim(),
    category: data.category ?? "other",
    is_active: true,
    created_at: new Date().toISOString(),
  });

  if (data.phases?.length) {
    await replaceTemplatePhases(rec.id, data.phases);
  }

  const detail = await getTaskTemplateDetail(rec.id);
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
    await updateRecord(TABLE_TEMPLATES, id, patch);
  }
  if (data.phases !== undefined) {
    await replaceTemplatePhases(id, data.phases);
  }
  const detail = await getTaskTemplateDetail(id);
  if (!detail) throw new Error("Template not found after update");
  return detail;
}

export async function deleteTaskTemplate(id: string): Promise<void> {
  await updateRecord(TABLE_TEMPLATES, id, { is_active: false });
}

export type ApplyTemplateInput = {
  assignedVaId: string;
  assignedModelIds: string[];
  dueDate?: string | null;
  region?: TaskPhase["region"];
  assignedById?: string;
  priority?: VaTaskRecord["priority"];
  reminderMinutesBefore?: number | null;
};

export type ApplyTemplateResult = {
  task: VaTaskRecord;
  phases: TaskPhase[];
};

export async function applyTemplateToTask(
  templateId: string,
  input: ApplyTemplateInput,
): Promise<ApplyTemplateResult> {
  const template = await getTaskTemplateDetail(templateId);
  if (!template || !template.is_active) throw new Error("Template not found or inactive");

  const vaId = input.assignedVaId.trim();
  const modelIds = [...new Set((input.assignedModelIds ?? []).map((id) => id.trim()).filter(Boolean))];
  if (!vaId) throw new Error("VA is required");
  if (modelIds.length === 0) throw new Error("At least one model is required");

  const [vaUser, modelss] = await Promise.all([
    getUserByAirtableId(vaId),
    listAllModelss().catch(() => []),
  ]);
  const vaName = (vaUser?.full_name || vaUser?.email || "").trim();
  const modelNames = modelIds
    .map((id) => (modelss.find((m) => m.id === id)?.model_name ?? "").trim())
    .filter(Boolean);
  const primaryModelId = modelIds[0];
  const primaryModelName = modelNames[0] ?? "";
  const region = input.region ?? "Global";

  const task = await createVaTask({
    title: template.name,
    description: template.description,
    assigned_to_ids: [vaId],
    assigned_by_ids: input.assignedById ? [input.assignedById] : [],
    assigned_model_ids: modelIds,
    assigned_model_names: modelNames,
    status: "pending",
    priority: input.priority ?? "normal",
    due_date: input.dueDate ?? undefined,
    reminder_minutes_before: input.reminderMinutesBefore ?? undefined,
  });

  for (const phaseTpl of template.phases) {
    const phase = await createPhase({
      task_id: task.id,
      task_title: task.title,
      phase_number: phaseTpl.phase_number,
      title: phaseTpl.title,
      description: phaseTpl.description,
      region,
      assigned_va_id: vaId,
      assigned_va_name: vaName,
      assigned_model_id: primaryModelId,
      assigned_model_name: primaryModelName,
    });

    const stablePhaseId = phase.phase_id || phase.id;
    for (const itemTpl of phaseTpl.items) {
      await createPhaseItem({
        phase_id: stablePhaseId,
        task_id: task.id,
        title: itemTpl.title,
        description: itemTpl.description,
        requires_screenshot: itemTpl.requires_screenshot,
        sort_order: itemTpl.sort_order,
      });
    }
  }

  const phases = await getPhasesByTask(task.id);
  return { task, phases };
}
