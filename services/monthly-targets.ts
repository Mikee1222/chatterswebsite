import {
  listRecords,
  listAllRecords,
  createRecord,
  updateRecord,
  type AirtableRecord,
  type ListParams,
} from "@/lib/airtable-server";
import { firstLinkedId, snapshotText } from "@/lib/airtable-linked";
import type { MonthlyTarget } from "@/types";

const TABLE = "monthly_targets";

type Fields = {
  target_id?: string;
  month_key?: string;
  team_member?: string | string[];
  team_member_name?: string;
  role?: string;
  target_amount_usd?: number;
  is_active?: boolean;
  notes?: string;
  created_at?: string;
  updated_at?: string;
};

function mapRecord(rec: AirtableRecord<Fields>): MonthlyTarget {
  const f = rec.fields;
  return {
    id: rec.id,
    target_id: f.target_id ?? "",
    month_key: f.month_key ?? "",
    team_member_id: firstLinkedId(f.team_member) ?? "",
    team_member_name: snapshotText(f.team_member_name),
    role: f.role ?? "chatter",
    target_amount_usd: f.target_amount_usd ?? 0,
    is_active: f.is_active ?? true,
    notes: f.notes ?? "",
    created_at: f.created_at ?? "",
    updated_at: f.updated_at ?? "",
  };
}

export type MonthlyTargetWriteFields = Partial<{
  target_id: string;
  month_key: string;
  team_member: string[];
  team_member_name: string;
  role: string;
  target_amount_usd: number;
  is_active: boolean;
  notes: string;
}>;

export async function listMonthlyTargets(params: ListParams & { filterByFormula?: string } = {}) {
  const records = await listAllRecords<Fields>(TABLE, params.filterByFormula ? { filterByFormula: params.filterByFormula } : {});
  return records.map((r) => mapRecord(r as AirtableRecord<Fields>));
}

/** Get the active target for a team member (chatter) and month. Prefers is_active = true if multiple exist. */
export async function getMonthlyTargetByTeamMemberAndMonth(
  teamMemberRecordId: string,
  monthKey: string
): Promise<MonthlyTarget | null> {
  if (!monthKey || !/^\d{4}-\d{2}$/.test(monthKey)) return null;
  const escaped = monthKey.replace(/"/g, '""');
  const formula = `{month_key} = "${escaped}"`;
  const records = await listAllRecords<Fields>(TABLE, { filterByFormula: formula });
  const matched = records.filter((r) => firstLinkedId((r.fields as Fields).team_member) === teamMemberRecordId);
  if (matched.length === 0) return null;
  const byActive = matched.filter((r) => (r.fields as Fields).is_active !== false);
  const rec = (byActive[0] ?? matched[0]) as AirtableRecord<Fields>;
  return mapRecord(rec);
}

export async function createMonthlyTarget(fields: MonthlyTargetWriteFields): Promise<MonthlyTarget> {
  const rec = await createRecord(TABLE, fields as Record<string, unknown>);
  return mapRecord(rec as AirtableRecord<Fields>);
}

export async function updateMonthlyTarget(recordId: string, fields: Partial<MonthlyTargetWriteFields>): Promise<MonthlyTarget> {
  const rec = await updateRecord(TABLE, recordId, fields as Partial<Fields>);
  return mapRecord(rec as AirtableRecord<Fields>);
}

/** Upsert: update existing target for same team_member + month_key, or create. Returns the saved target. */
export async function upsertMonthlyTarget(
  teamMemberRecordId: string,
  teamMemberName: string,
  monthKey: string,
  targetAmountUsd: number,
  options: { notes?: string; is_active?: boolean } = {}
): Promise<MonthlyTarget> {
  const existing = await getMonthlyTargetByTeamMemberAndMonth(teamMemberRecordId, monthKey);
  const payload: MonthlyTargetWriteFields = {
    month_key: monthKey,
    team_member: [teamMemberRecordId],
    team_member_name: teamMemberName,
    role: "chatter",
    target_amount_usd: targetAmountUsd,
    is_active: options.is_active ?? true,
    notes: options.notes ?? "",
  };
  if (existing) {
    return updateMonthlyTarget(existing.id, payload);
  }
  const targetId = `target_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  return createMonthlyTarget({ ...payload, target_id: targetId });
}
