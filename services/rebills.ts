/**
 * Dual-backend rebills CRUD (chatter rebill submissions).
 */
import { isSupabaseBackend } from "@/lib/data-backend";
import { createRecord, listAllRecords, updateRecord } from "@/lib/airtable-server";
import { publicId, sbInsert, sbSelectAll, sbUpdateByPublicId, type SbRow } from "@/lib/supabase-data";

const TABLE = "rebills";

export type RebillRecord = {
  id: string;
  rebill_id: string;
  chatter_id: string;
  chatter_name: string;
  model_id: string;
  model_name: string;
  sub_username: string;
  sub_type: string;
  status: string;
  screenshot: string[];
  created_at: string | null;
};

type RebillWrite = {
  rebill_id: string;
  chatter_id: string;
  chatter_name: string;
  model_id: string;
  model_name: string;
  sub_username: string;
  sub_type?: string;
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

export async function createRebill(fields: RebillWrite): Promise<{ id: string }> {
  if (isSupabaseBackend()) {
    const urls = screenshotUrls(fields.screenshot);
    const row = await sbInsert<SbRow>(TABLE, {
      rebill_id: fields.rebill_id,
      chatter_id: fields.chatter_id,
      chatter_name: fields.chatter_name,
      model_id: fields.model_id,
      model_name: fields.model_name,
      sub_username: fields.sub_username,
      sub_name: fields.sub_username,
      sub_type: fields.sub_type ?? "paid",
      status: fields.status ?? "pending",
      screenshot: urls,
      date_time: fields.created_at ?? new Date().toISOString(),
      created_at: fields.created_at ?? new Date().toISOString(),
      checked: false,
    });
    return { id: publicId(row) };
  }
  const rec = await createRecord(TABLE, {
    ...fields,
    screenshot: fields.screenshot?.length ? fields.screenshot : undefined,
  });
  return { id: rec.id };
}

export async function listAllRebills(): Promise<RebillRecord[]> {
  if (isSupabaseBackend()) {
    const rows = await sbSelectAll<
      SbRow & {
        rebill_id?: string | null;
        chatter_id?: string | null;
        chatter_name?: string | null;
        model_id?: string | null;
        model_name?: string | null;
        sub_username?: string | null;
        sub_name?: string | null;
        sub_type?: string | null;
        status?: string | null;
        screenshot?: string[] | null;
        created_at?: string | null;
      }
    >(TABLE);
    return rows.map((r) => ({
      id: publicId(r),
      rebill_id: r.rebill_id ?? "",
      chatter_id: r.chatter_id ?? "",
      chatter_name: r.chatter_name ?? "",
      model_id: r.model_id ?? "",
      model_name: r.model_name ?? "",
      sub_username: r.sub_username ?? r.sub_name ?? "",
      sub_type: r.sub_type ?? "paid",
      status: r.status ?? "pending",
      screenshot: r.screenshot ?? [],
      created_at: r.created_at ?? null,
    }));
  }
  const records = await listAllRecords<Record<string, unknown>>(TABLE);
  return records.map((r) => ({
    id: r.id,
    rebill_id: String(r.fields.rebill_id ?? ""),
    chatter_id: String(r.fields.chatter_id ?? ""),
    chatter_name: String(r.fields.chatter_name ?? ""),
    model_id: String(r.fields.model_id ?? ""),
    model_name: String(r.fields.model_name ?? ""),
    sub_username: String(r.fields.sub_username ?? ""),
    sub_type: String(r.fields.sub_type ?? "paid"),
    status: String(r.fields.status ?? "pending"),
    screenshot: Array.isArray(r.fields.screenshot)
      ? (r.fields.screenshot as Array<{ url?: string } | string>)
          .map((a) => (typeof a === "string" ? a : String(a?.url ?? "")))
          .filter(Boolean)
      : [],
    created_at: typeof r.fields.created_at === "string" ? r.fields.created_at : null,
  }));
}

export async function updateRebill(
  id: string,
  fields: Partial<{ status: string; checked: boolean }>
): Promise<void> {
  if (isSupabaseBackend()) {
    await sbUpdateByPublicId(TABLE, id, fields);
    return;
  }
  await updateRecord(TABLE, id, fields);
}
