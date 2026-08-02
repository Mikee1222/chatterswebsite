"use server";

import { publicId, sbInsert, sbSelectEq, sbUpdateByPublicId } from "@/lib/supabase-data";

const TABLE = "system_settings";

type Row = {
  id: string;
  airtable_id?: string | null;
  setting_key?: string | null;
  setting_value?: string | null;
  description?: string | null;
};

/** Return `setting_value` for the first record with this key, or null. */
export async function getSystemSetting(key: string): Promise<string | null> {
  const rows = await sbSelectEq<Row>(TABLE, "setting_key", key, "*", 1);
  const v = rows[0]?.setting_value;
  if (v == null) return null;
  const s = typeof v === "string" ? v.trim() : "";
  return s === "" ? null : s;
}

/** Create or update the row for this key. */
export async function setSystemSetting(
  key: string,
  value: string,
  description?: string
): Promise<void> {
  const rows = await sbSelectEq<Row>(TABLE, "setting_key", key, "*", 1);
  const payload: Record<string, unknown> = { setting_value: value };
  if (description !== undefined) payload.description = description;

  if (rows[0]) {
    await sbUpdateByPublicId(TABLE, publicId(rows[0]), payload);
    return;
  }

  await sbInsert(TABLE, {
    setting_key: key,
    setting_value: value,
    ...(description !== undefined ? { description } : {}),
  });
}
