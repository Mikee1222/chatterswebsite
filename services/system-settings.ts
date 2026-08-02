"use server";

import { isSupabaseBackend } from "@/lib/data-backend";
import { listRecords, createRecord, updateRecord } from "@/lib/airtable-server";
import { escapeAirtableString } from "@/lib/airtable-linked";

const TABLE = "system_settings";

type Fields = {
  setting_key?: string;
  setting_value?: string;
  description?: string;
};

/** Return `setting_value` for the first record with this key, or null. */
export async function getSystemSetting(key: string): Promise<string | null> {
  if (isSupabaseBackend()) {
    return (await import("./system-settings-supabase")).getSystemSetting(key);
  }
  const escaped = escapeAirtableString(key);
  const { records } = await listRecords<Fields>(TABLE, {
    filterByFormula: `{setting_key} = "${escaped}"`,
    pageSize: 1,
    _caller: "getSystemSetting",
  });
  const v = records[0]?.fields?.setting_value;
  if (v == null) return null;
  const s = typeof v === "string" ? v.trim() : "";
  return s === "" ? null : s;
}

/** Create or update the row for this key. */
export async function setSystemSetting(key: string, value: string, description?: string): Promise<void> {
  if (isSupabaseBackend()) {
    return (await import("./system-settings-supabase")).setSystemSetting(key, value, description);
  }
  const escaped = escapeAirtableString(key);
  const { records } = await listRecords<Fields>(TABLE, {
    filterByFormula: `{setting_key} = "${escaped}"`,
    pageSize: 1,
    _caller: "setSystemSetting",
  });
  const payload: Record<string, unknown> = { setting_value: value };
  if (description !== undefined) payload.description = description;

  if (records[0]?.id) {
    await updateRecord<Fields>(TABLE, records[0].id, payload);
    return;
  }

  const createPayload: Record<string, unknown> = {
    setting_key: key,
    setting_value: value,
  };
  if (description !== undefined) createPayload.description = description;
  await createRecord<Fields>(TABLE, createPayload as Fields);
}
