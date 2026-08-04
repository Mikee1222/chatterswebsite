/**
 * Supabase backend for services/task-templates.ts (DATA_BACKEND=supabase).
 * applyTemplateToTask stays in task-templates.ts (orchestration via dual-backend primitives).
 */

import { coerceTaskStepType, DEFAULT_TASK_STEP_TYPE, type TaskStepType } from "@/lib/task-step-types";
import {
  publicId,
  sbAirtableIdsForUuids,
  sbDeleteByPublicId,
  sbInsert,
  sbSelectAll,
  sbSelectByPublicId,
  sbSelectEq,
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

async function mapItem(row: ItemRow): Promise<TaskTemplateItemRecord> {
  return {
    id: publicId(row),
    item_template_id: row.item_template_id ?? publicId(row),
    phase_template_ids: await sbAirtableIdsForUuids(T_PHASES, row.phase_template),
    title: row.title?.trim() ? String(row.title) : "",
    description: row.description?.trim() ? String(row.description) : "",
    requires_screenshot: row.requires_screenshot === true,
    sort_order: typeof row.sort_order === "number" ? Number(row.sort_order) : Number(row.sort_order) || 0,
    step_type: coerceTaskStepType(row.step_type),
  };
}

async function mapPhase(row: PhaseRow, items: TaskTemplateItemRecord[] = []): Promise<TaskTemplatePhaseRecord> {
  return {
    id: publicId(row),
    phase_template_id: row.phase_template_id ?? publicId(row),
    template_ids: await sbAirtableIdsForUuids(T_TEMPLATES, row.template),
    phase_number: typeof row.phase_number === "number" ? Number(row.phase_number) : Number(row.phase_number) || 1,
    title: row.title?.trim() ? String(row.title) : "",
    description: row.description?.trim() ? String(row.description) : "",
    items,
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

  const tid = publicId(templateRow);
  const [phaseRows, itemRows] = await Promise.all([
    sbSelectAll<PhaseRow>(T_PHASES),
    sbSelectAll<ItemRow>(T_ITEMS),
  ]);

  const items = await Promise.all(itemRows.map(mapItem));
  const phasesForTemplate: PhaseRow[] = [];
  for (const prow of phaseRows) {
    const templateIds = await sbAirtableIdsForUuids(T_TEMPLATES, prow.template);
    if (templateIds.includes(tid)) phasesForTemplate.push(prow);
  }

  const phases = await Promise.all(
    phasesForTemplate
      .sort((a, b) => Number(a.phase_number ?? 0) - Number(b.phase_number ?? 0))
      .map(async (prow) => {
        const pid = publicId(prow);
        const phaseItems = items
          .filter((i) => i.phase_template_ids.includes(pid))
          .sort((a, b) => a.sort_order - b.sort_order);
        return mapPhase(prow, phaseItems);
      })
  );

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

async function replaceTemplatePhases(
  templatePublicId: string,
  phases: NonNullable<TaskTemplateCreateInput["phases"]>
): Promise<void> {
  const templateUuids = await sbUuidsForAirtableIds(T_TEMPLATES, [templatePublicId]);
  // Also allow uuid id
  const templateRow = await sbSelectByPublicId<TemplateRow>(T_TEMPLATES, templatePublicId);
  const templateUuid = templateUuids[0] || templateRow?.id;
  if (!templateUuid) throw new Error("Template not found");

  const allPhases = await sbSelectAll<PhaseRow>(T_PHASES);
  const existingPhases: PhaseRow[] = [];
  for (const prow of allPhases) {
    if ((prow.template ?? []).includes(templateUuid)) existingPhases.push(prow);
  }

  const allItems = await sbSelectAll<ItemRow>(T_ITEMS);
  for (const phaseRec of existingPhases) {
    const phasePublic = publicId(phaseRec);
    for (const itemRec of allItems) {
      const linked = await sbAirtableIdsForUuids(T_PHASES, itemRec.phase_template);
      if (linked.includes(phasePublic) || (itemRec.phase_template ?? []).includes(phaseRec.id)) {
        await sbDeleteByPublicId(T_ITEMS, publicId(itemRec));
      }
    }
    await sbDeleteByPublicId(T_PHASES, phasePublic);
  }

  for (const phase of phases) {
    const phaseRec = await sbInsert<PhaseRow>(T_PHASES, {
      phase_template_id: `phase_tpl_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      template: [templateUuid],
      phase_number: phase.phase_number,
      title: phase.title.trim(),
      description: (phase.description ?? "").trim(),
    });

    for (let i = 0; i < (phase.items ?? []).length; i++) {
      const item = phase.items![i];
      await sbInsert<ItemRow>(T_ITEMS, {
        item_template_id: `item_tpl_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        phase_template: [phaseRec.id],
        title: item.title.trim(),
        description: (item.description ?? "").trim(),
        requires_screenshot: item.requires_screenshot ?? false,
        sort_order: item.sort_order ?? i,
        step_type: item.step_type ?? DEFAULT_TASK_STEP_TYPE,
      });
    }
  }
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
