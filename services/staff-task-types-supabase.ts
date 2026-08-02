"use server";

import { publicId, sbSelectAll, type SbRow } from "@/lib/supabase-data";
import type { StaffTaskType } from "@/types";

const TABLE = "staff_task_types";

type Row = SbRow & {
  task_type_id?: string | null;
  task_key?: string | null;
  task_label?: string | null;
  applies_to_role?: string | null;
  is_active?: boolean | null;
  sort_order?: number | null;
  description?: string | null;
  created_at?: string | null;
};

function mapRow(row: Row): StaffTaskType {
  return {
    id: publicId(row),
    task_type_id: row.task_type_id ?? "",
    task_key: row.task_key ?? "",
    task_label: row.task_label ?? "",
    applies_to_role: row.applies_to_role ?? "",
    is_active: row.is_active ?? true,
    sort_order: Number(row.sort_order ?? 0),
    description: row.description ?? "",
    created_at: row.created_at ?? "",
  };
}

export async function listStaffTaskTypes(role?: "chatter" | "virtual_assistant" | "all") {
  const rows = await sbSelectAll<Row>(TABLE);
  let list = rows.map(mapRow).filter((t) => t.is_active);
  if (role && role !== "all") {
    list = list.filter((t) => t.applies_to_role === role || t.applies_to_role === "all");
  }
  list.sort((a, b) => a.sort_order - b.sort_order);
  return list;
}

export async function getTaskTypesForVirtualAssistant() {
  return listStaffTaskTypes("virtual_assistant");
}
