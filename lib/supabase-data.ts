/**
 * Thin Supabase data helpers for dual-backend services.
 * Uses service-role client. Prefer airtable_id for dual-run identity
 * so return shapes keep Airtable-shaped `id` fields until cutover.
 */

import { getSupabaseServiceClient } from "@/lib/supabase-server";

export type SbRow = Record<string, unknown> & {
  id: string;
  airtable_id?: string | null;
};

/** Prefer airtable_id as the public `id` during dual-run. */
export function publicId(row: { id: string; airtable_id?: string | null }): string {
  return row.airtable_id || row.id;
}

export async function sbSelectAll<T extends SbRow>(
  table: string,
  columns = "*"
): Promise<T[]> {
  const sb = getSupabaseServiceClient();
  const pageSize = 1000;
  const out: T[] = [];
  let from = 0;
  for (;;) {
    const { data, error } = await sb.from(table).select(columns).range(from, from + pageSize - 1);
    if (error) throw new Error(`sbSelectAll ${table}: ${error.message}`);
    if (!data?.length) break;
    out.push(...(data as unknown as T[]));
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return out;
}

export async function sbSelectEq<T extends SbRow>(
  table: string,
  column: string,
  value: string | number | boolean,
  columns = "*",
  limit?: number
): Promise<T[]> {
  const sb = getSupabaseServiceClient();
  let q = sb.from(table).select(columns).eq(column, value);
  if (limit != null) q = q.limit(limit);
  const { data, error } = await q;
  if (error) throw new Error(`sbSelectEq ${table}.${column}: ${error.message}`);
  return (data as unknown as T[]) ?? [];
}

export async function sbSelectByPublicId<T extends SbRow>(
  table: string,
  publicOrUuid: string,
  columns = "*"
): Promise<T | null> {
  const sb = getSupabaseServiceClient();
  // Try airtable_id first (rec…), then uuid
  if (publicOrUuid.startsWith("rec")) {
    const { data, error } = await sb
      .from(table)
      .select(columns)
      .eq("airtable_id", publicOrUuid)
      .maybeSingle();
    if (error) throw new Error(`sbSelectByPublicId: ${error.message}`);
    return (data as unknown as T) ?? null;
  }
  const { data, error } = await sb
    .from(table)
    .select(columns)
    .eq("id", publicOrUuid)
    .maybeSingle();
  if (error) throw new Error(`sbSelectByPublicId: ${error.message}`);
  return (data as unknown as T) ?? null;
}

export async function sbInsert<T extends SbRow>(
  table: string,
  row: Record<string, unknown>
): Promise<T> {
  const sb = getSupabaseServiceClient();
  const { data, error } = await sb.from(table).insert(row).select("*").single();
  if (error) throw new Error(`sbInsert ${table}: ${error.message}`);
  return data as T;
}

export async function sbUpdateByPublicId<T extends SbRow>(
  table: string,
  publicOrUuid: string,
  patch: Record<string, unknown>
): Promise<T> {
  const sb = getSupabaseServiceClient();
  const col = publicOrUuid.startsWith("rec") ? "airtable_id" : "id";
  const { data, error } = await sb
    .from(table)
    .update(patch)
    .eq(col, publicOrUuid)
    .select("*")
    .single();
  if (error) throw new Error(`sbUpdate ${table}: ${error.message}`);
  return data as T;
}

export async function sbDeleteByPublicId(table: string, publicOrUuid: string): Promise<void> {
  const sb = getSupabaseServiceClient();
  const col = publicOrUuid.startsWith("rec") ? "airtable_id" : "id";
  const { error } = await sb.from(table).delete().eq(col, publicOrUuid);
  if (error) throw new Error(`sbDelete ${table}: ${error.message}`);
}

export async function sbUpsertByAirtableId<T extends SbRow>(
  table: string,
  row: Record<string, unknown> & { airtable_id?: string }
): Promise<T> {
  const sb = getSupabaseServiceClient();
  const { data, error } = await sb
    .from(table)
    .upsert(row, { onConflict: "airtable_id" })
    .select("*")
    .single();
  if (error) throw new Error(`sbUpsert ${table}: ${error.message}`);
  return data as T;
}
