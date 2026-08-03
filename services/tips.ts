/**
 * Dual-backend tips CRUD (chatter tip submissions).
 */
import { isSupabaseBackend } from "@/lib/data-backend";
import { createRecord, listAllRecords, updateRecord, getRecord } from "@/lib/airtable-server";
import { publicId, sbInsert, sbSelectAll, sbSelectByPublicId, sbUpdateByPublicId, type SbRow } from "@/lib/supabase-data";

const TABLE = "tips";

export type TipRecord = {
  id: string;
  tip_id: string;
  chatter_id: string;
  chatter_name: string;
  model_id: string;
  model_name: string;
  sub_username: string;
  amount_usd: number;
  status: string;
  screenshot: string[];
  created_at: string | null;
};

type TipWrite = {
  tip_id: string;
  chatter_id: string;
  chatter_name: string;
  model_id: string;
  model_name: string;
  sub_username: string;
  amount_usd: number;
  status?: string;
  screenshot?: Array<{ url: string; filename?: string }> | string[];
  created_at?: string;
};

function screenshotUrls(
  shot: Array<{ url: string; filename?: string }> | string[] | undefined
): string[] {
  if (!shot?.length) return [];
  if (typeof shot[0] === "string") return (shot as string[]).filter(Boolean);
  return (shot as Array<{ url: string }>).map((a) => a.url).filter(Boolean);
}

export async function createTip(fields: TipWrite): Promise<{ id: string }> {
  if (isSupabaseBackend()) {
    const urls = screenshotUrls(fields.screenshot);
    const row = await sbInsert<SbRow>(TABLE, {
      tip_id: fields.tip_id,
      chatter_id: fields.chatter_id,
      chatter_name: fields.chatter_name,
      model_id: fields.model_id,
      model_name: fields.model_name,
      sub_username: fields.sub_username,
      amount_usd: fields.amount_usd,
      amount: fields.amount_usd,
      status: fields.status ?? "pending",
      screenshot: urls,
      created_at: fields.created_at ?? new Date().toISOString(),
    });
    return { id: publicId(row) };
  }
  const rec = await createRecord(TABLE, {
    ...fields,
    screenshot: fields.screenshot?.length ? fields.screenshot : undefined,
  });
  return { id: rec.id };
}

export async function listAllTips(): Promise<TipRecord[]> {
  if (isSupabaseBackend()) {
    const rows = await sbSelectAll<
      SbRow & {
        tip_id?: string | null;
        chatter_id?: string | null;
        chatter_name?: string | null;
        model_id?: string | null;
        model_name?: string | null;
        sub_username?: string | null;
        amount_usd?: number | null;
        amount?: number | null;
        status?: string | null;
        screenshot?: string[] | null;
        created_at?: string | null;
      }
    >(TABLE);
    return rows.map((r) => ({
      id: publicId(r),
      tip_id: r.tip_id ?? "",
      chatter_id: r.chatter_id ?? "",
      chatter_name: r.chatter_name ?? "",
      model_id: r.model_id ?? "",
      model_name: r.model_name ?? "",
      sub_username: r.sub_username ?? "",
      amount_usd: Number(r.amount_usd ?? r.amount ?? 0),
      status: r.status ?? "pending",
      screenshot: r.screenshot ?? [],
      created_at: r.created_at ?? null,
    }));
  }
  const records = await listAllRecords<Record<string, unknown>>(TABLE);
  return records.map((r) => ({
    id: r.id,
    tip_id: String(r.fields.tip_id ?? ""),
    chatter_id: String(r.fields.chatter_id ?? ""),
    chatter_name: String(r.fields.chatter_name ?? ""),
    model_id: String(r.fields.model_id ?? ""),
    model_name: String(r.fields.model_name ?? ""),
    sub_username: String(r.fields.sub_username ?? ""),
    amount_usd: Number(r.fields.amount_usd ?? 0),
    status: String(r.fields.status ?? "pending"),
    screenshot: Array.isArray(r.fields.screenshot)
      ? (r.fields.screenshot as Array<{ url?: string } | string>)
          .map((a) => (typeof a === "string" ? a : String(a?.url ?? "")))
          .filter(Boolean)
      : [],
    created_at: typeof r.fields.created_at === "string" ? r.fields.created_at : null,
  }));
}

export async function updateTip(
  id: string,
  fields: Partial<{ status: string; checked: boolean; admin_notes: string }>
): Promise<void> {
  if (isSupabaseBackend()) {
    await sbUpdateByPublicId(TABLE, id, fields);
    return;
  }
  await updateRecord(TABLE, id, fields);
}

export async function getTipById(id: string): Promise<TipRecord | null> {
  if (isSupabaseBackend()) {
    const r = await sbSelectByPublicId<
      SbRow & {
        tip_id?: string | null;
        chatter_id?: string | null;
        chatter_name?: string | null;
        model_id?: string | null;
        model_name?: string | null;
        sub_username?: string | null;
        amount_usd?: number | null;
        amount?: number | null;
        status?: string | null;
        screenshot?: string[] | null;
        created_at?: string | null;
      }
    >(TABLE, id);
    if (!r) return null;
    return {
      id: publicId(r),
      tip_id: r.tip_id ?? "",
      chatter_id: r.chatter_id ?? "",
      chatter_name: r.chatter_name ?? "",
      model_id: r.model_id ?? "",
      model_name: r.model_name ?? "",
      sub_username: r.sub_username ?? "",
      amount_usd: Number(r.amount_usd ?? r.amount ?? 0),
      status: r.status ?? "pending",
      screenshot: r.screenshot ?? [],
      created_at: r.created_at ?? null,
    };
  }
  try {
    const rec = await getRecord<Record<string, unknown>>(TABLE, id);
    return {
      id: rec.id,
      tip_id: String(rec.fields.tip_id ?? ""),
      chatter_id: String(rec.fields.chatter_id ?? ""),
      chatter_name: String(rec.fields.chatter_name ?? ""),
      model_id: String(rec.fields.model_id ?? ""),
      model_name: String(rec.fields.model_name ?? ""),
      sub_username: String(rec.fields.sub_username ?? ""),
      amount_usd: Number(rec.fields.amount_usd ?? 0),
      status: String(rec.fields.status ?? "pending"),
      screenshot: [],
      created_at: typeof rec.fields.created_at === "string" ? rec.fields.created_at : null,
    };
  } catch {
    return null;
  }
}
