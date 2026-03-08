"use server";

import { listAllRecords, type AirtableRecord } from "@/lib/airtable-server";
import type { StaffTaskType } from "@/types";

const TABLE = "staff_task_types";

type Fields = {
  task_type_id?: string;
  task_key?: string;
  task_label?: string;
  applies_to_role?: string;
  is_active?: boolean;
  sort_order?: number;
  description?: string;
  created_at?: string;
};

function mapRecord(rec: AirtableRecord<Fields>): StaffTaskType {
  const f = rec.fields;
  return {
    id: rec.id,
    task_type_id: f.task_type_id ?? "",
    task_key: f.task_key ?? "",
    task_label: f.task_label ?? "",
    applies_to_role: f.applies_to_role ?? "",
    is_active: f.is_active ?? true,
    sort_order: f.sort_order ?? 0,
    description: f.description ?? "",
    created_at: f.created_at ?? "",
  };
}

export async function listStaffTaskTypes(role?: "chatter" | "virtual_assistant" | "all") {
  const records = await listAllRecords<Fields>(TABLE, {});
  let list = records.map(mapRecord).filter((t) => t.is_active);
  if (role && role !== "all") {
    list = list.filter((t) => t.applies_to_role === role || t.applies_to_role === "all");
  }
  list.sort((a, b) => a.sort_order - b.sort_order);
  return list;
}

export async function getTaskTypesForVirtualAssistant() {
  return listStaffTaskTypes("virtual_assistant");
}
