/**
 * Supabase backend for services/monthly-targets.ts
 */
import {
  firstMappedLinkedId,
  publicId,
  sbInsert,
  sbResolveUuidToAirtableMap,
  sbSelectAll,
  sbUpdateByPublicId,
  sbUuidsForAirtableIds,
  type SbRow,
} from "@/lib/supabase-data";
import type { MonthlyTarget } from "@/types";
import type { ListParams } from "@/lib/airtable-server";
import type { MonthlyTargetWriteFields } from "./monthly-targets";

const TABLE = "monthly_targets";

type Row = SbRow & {
  target_id?: string | null;
  month_key?: string | null;
  team_member?: string[] | null;
  team_member_name?: string | null;
  role?: string | null;
  target_amount_usd?: number | null;
  is_active?: boolean | null;
  notes?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

function mapRowSync(row: Row, userAt: Map<string, string>): MonthlyTarget {
  return {
    id: publicId(row),
    target_id: row.target_id ?? "",
    month_key: row.month_key ?? "",
    team_member_id: firstMappedLinkedId(row.team_member, userAt),
    team_member_name: String(row.team_member_name ?? ""),
    role: row.role ?? "chatter",
    target_amount_usd: Number(row.target_amount_usd ?? 0),
    is_active: row.is_active ?? true,
    notes: row.notes ?? "",
    created_at: String(row.created_at ?? ""),
    updated_at: String(row.updated_at ?? ""),
  };
}

async function mapRows(rows: Row[]): Promise<MonthlyTarget[]> {
  if (!rows.length) return [];
  const userAt = await sbResolveUuidToAirtableMap("users", rows.map((r) => r.team_member));
  return rows.map((r) => mapRowSync(r, userAt));
}

async function mapRow(row: Row): Promise<MonthlyTarget> {
  const [mapped] = await mapRows([row]);
  return mapped!;
}

export async function listMonthlyTargets(
  _params: ListParams & { filterByFormula?: string } = {}
): Promise<MonthlyTarget[]> {
  void _params;
  const rows = await sbSelectAll<Row>(TABLE);
  return mapRows(rows);
}

export async function getMonthlyTargetByTeamMemberAndMonth(
  teamMemberRecordId: string,
  monthKey: string
): Promise<MonthlyTarget | null> {
  if (!monthKey || !/^\d{4}-\d{2}$/.test(monthKey)) return null;
  const all = await listMonthlyTargets();
  const matched = all.filter((t) => t.team_member_id === teamMemberRecordId && t.month_key === monthKey);
  if (!matched.length) return null;
  const byActive = matched.filter((t) => t.is_active !== false);
  return byActive[0] ?? matched[0];
}

export async function createMonthlyTarget(fields: MonthlyTargetWriteFields): Promise<MonthlyTarget> {
  const patch: Record<string, unknown> = { ...fields };
  if (Array.isArray(fields.team_member)) {
    patch.team_member = await sbUuidsForAirtableIds("users", fields.team_member);
  }
  const row = await sbInsert<Row>(TABLE, patch);
  return mapRow(row);
}

export async function updateMonthlyTarget(
  recordId: string,
  fields: Partial<MonthlyTargetWriteFields>
): Promise<MonthlyTarget> {
  const patch: Record<string, unknown> = { ...fields, updated_at: new Date().toISOString() };
  if (Array.isArray(fields.team_member)) {
    patch.team_member = await sbUuidsForAirtableIds("users", fields.team_member);
  }
  const row = await sbUpdateByPublicId<Row>(TABLE, recordId, patch);
  return mapRow(row);
}

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
  if (existing) return updateMonthlyTarget(existing.id, payload);
  const targetId = `target_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  return createMonthlyTarget({ ...payload, target_id: targetId });
}
