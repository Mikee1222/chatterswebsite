import {
  publicId,
  sbInsert,
  sbSelectAll,
  sbUpdateByPublicId,
  type SbRow,
} from "@/lib/supabase-data";

export const EARNINGS_CONFIG_TABLE = "earnings_config";

type Row = SbRow & {
  model_id?: string | null;
  agency_cut_percent?: number | null;
};

export async function listEarningsAgencyCutConfig(): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  try {
    const rows = await sbSelectAll<Row>(EARNINGS_CONFIG_TABLE);
    for (const r of rows) {
      const mid = String(r.model_id ?? "").trim();
      if (!mid) continue;
      const p = Number(r.agency_cut_percent ?? 0);
      out[mid] = Math.max(0, Math.min(100, Number.isFinite(p) ? p : 0));
    }
  } catch {
    return {};
  }
  return out;
}

export async function listEarningsConfigRecordsByModelId(): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  try {
    const rows = await sbSelectAll<Row>(EARNINGS_CONFIG_TABLE);
    for (const r of rows) {
      const mid = String(r.model_id ?? "").trim();
      if (mid) out[mid] = publicId(r);
    }
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
    const pct = Math.max(
      0,
      Math.min(100, Number.isFinite(r.agency_cut_percent) ? r.agency_cut_percent : 0)
    );
    const existingId = byModel[modelId];
    if (existingId) {
      await sbUpdateByPublicId(EARNINGS_CONFIG_TABLE, existingId, {
        model_id: modelId,
        agency_cut_percent: pct,
      });
    } else {
      await sbInsert(EARNINGS_CONFIG_TABLE, {
        model_id: modelId,
        agency_cut_percent: pct,
      });
    }
  }
}
