import { createRecord, listRecords, updateRecord } from "@/lib/airtable-server";

export const EARNINGS_CONFIG_TABLE = "earnings_config";

export type EarningsConfigRow = {
  model_id: string;
  agency_cut_percent: number;
  airtable_record_id?: string;
};

/**
 * Map Infloww `model_id` → agency cut percent (0–100) of **net** (after OF 20%).
 * Table may not exist yet — returns {}.
 */
export async function listEarningsAgencyCutConfig(): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  let offset: string | undefined;
  try {
    do {
      const { records, offset: next } = await listRecords<Record<string, unknown>>(EARNINGS_CONFIG_TABLE, {
        pageSize: 100,
        offset,
      });
      for (const r of records) {
        const f = r.fields ?? {};
        const mid = String(f.model_id ?? f.model ?? "").trim();
        if (!mid) continue;
        const p = Number(f.agency_cut_percent ?? f.agency_cut ?? 0);
        out[mid] = Math.max(0, Math.min(100, Number.isFinite(p) ? p : 0));
      }
      offset = next;
    } while (offset);
  } catch {
    return {};
  }
  return out;
}

/** model_id → Airtable record id (for updates). */
export async function listEarningsConfigRecordsByModelId(): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  let offset: string | undefined;
  try {
    do {
      const { records, offset: next } = await listRecords<Record<string, unknown>>(EARNINGS_CONFIG_TABLE, {
        pageSize: 100,
        offset,
      });
      for (const r of records) {
        const f = r.fields ?? {};
        const mid = String(f.model_id ?? "").trim();
        if (mid) out[mid] = r.id;
      }
      offset = next;
    } while (offset);
  } catch {
    return {};
  }
  return out;
}

export async function upsertManyEarningsConfigRows(
  rows: { model_id: string; agency_cut_percent: number }[],
  existingByModelId?: Record<string, string>
): Promise<void> {
  const byModel = existingByModelId ?? (await listEarningsConfigRecordsByModelId());
  for (const r of rows) {
    const modelId = String(r.model_id ?? "").trim();
    if (!modelId) continue;
    const pct = Math.max(0, Math.min(100, Number.isFinite(r.agency_cut_percent) ? r.agency_cut_percent : 0));
    const existingId = byModel[modelId];
    if (existingId) {
      await updateRecord(EARNINGS_CONFIG_TABLE, existingId, {
        model_id: modelId,
        agency_cut_percent: pct,
      } as Record<string, unknown>);
    } else {
      await createRecord(EARNINGS_CONFIG_TABLE, {
        model_id: modelId,
        agency_cut_percent: pct,
      } as Record<string, unknown>);
    }
  }
}
