/**
 * GetMySocial model ↔ link linking (Supabase getmysocial_links).
 */

import { getSupabaseServiceClient } from "@/lib/supabase-server";

export type GetMySocialLinkRole = "A" | "B";

export type GetMySocialModelLink = {
  id: string;
  model_id: string;
  getmysocial_link_id: string;
  link_role: GetMySocialLinkRole;
  link_label: string;
  shortcode: string | null;
  of_destination_hint: string | null;
  is_primary: boolean;
  created_at: string;
  updated_at?: string;
};

export type GetMySocialModelLinkInput = {
  getmysocial_link_id: string;
  link_role: GetMySocialLinkRole;
  link_label: string;
  shortcode?: string | null;
  of_destination_hint?: string | null;
  is_primary?: boolean;
};

type LinkRow = {
  id: string;
  model_id: string;
  getmysocial_link_id: string;
  link_role: string;
  link_label: string;
  shortcode: string | null;
  of_destination_hint: string | null;
  is_primary: boolean;
  created_at: string;
  updated_at?: string;
};

function asRole(v: unknown): GetMySocialLinkRole {
  return v === "B" ? "B" : "A";
}

function mapRow(row: LinkRow): GetMySocialModelLink {
  return {
    id: row.id,
    model_id: row.model_id,
    getmysocial_link_id: row.getmysocial_link_id.trim(),
    link_role: asRole(row.link_role),
    link_label: row.link_label.trim() || `Link ${asRole(row.link_role)}`,
    shortcode: row.shortcode?.trim() || null,
    of_destination_hint: row.of_destination_hint?.trim() || null,
    is_primary: row.is_primary === true || asRole(row.link_role) === "A",
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

const SELECT_COLS =
  "id,model_id,getmysocial_link_id,link_role,link_label,shortcode,of_destination_hint,is_primary,created_at,updated_at";

export async function listGetMySocialModelLinks(
  modelId: string
): Promise<GetMySocialModelLink[]> {
  const sb = getSupabaseServiceClient();
  const { data, error } = await sb
    .from("getmysocial_links")
    .select(SELECT_COLS)
    .eq("model_id", modelId.trim())
    .order("link_role", { ascending: true });
  if (error) throw new Error(`list getmysocial_links: ${error.message}`);
  return (data ?? []).map((r) => mapRow(r as LinkRow));
}

export async function listAllGetMySocialModelLinks(): Promise<GetMySocialModelLink[]> {
  const sb = getSupabaseServiceClient();
  const { data, error } = await sb
    .from("getmysocial_links")
    .select(SELECT_COLS)
    .order("model_id")
    .order("link_role", { ascending: true });
  if (error) throw new Error(`list all getmysocial_links: ${error.message}`);
  return (data ?? []).map((r) => mapRow(r as LinkRow));
}

/**
 * Replace linked GetMySocial links for a model. At most one A and one B.
 */
export async function saveGetMySocialModelLinks(
  modelId: string,
  inputs: GetMySocialModelLinkInput[]
): Promise<GetMySocialModelLink[]> {
  const mid = modelId.trim();
  const cleaned: GetMySocialModelLinkInput[] = [];
  const seenRoles = new Set<GetMySocialLinkRole>();
  for (const a of inputs) {
    const id = a.getmysocial_link_id.trim();
    if (!id) continue;
    const role = asRole(a.link_role);
    if (seenRoles.has(role)) continue;
    seenRoles.add(role);
    cleaned.push({
      getmysocial_link_id: id,
      link_role: role,
      link_label: (a.link_label.trim() || `Link ${role}`).slice(0, 120),
      shortcode: a.shortcode?.trim() || null,
      of_destination_hint: a.of_destination_hint?.trim() || null,
      is_primary: role === "A" || a.is_primary === true,
    });
  }

  const sb = getSupabaseServiceClient();
  const { error: delErr } = await sb.from("getmysocial_links").delete().eq("model_id", mid);
  if (delErr) throw new Error(`delete getmysocial_links: ${delErr.message}`);
  if (!cleaned.length) return [];

  const now = new Date().toISOString();
  const { data, error } = await sb
    .from("getmysocial_links")
    .insert(
      cleaned.map((a) => ({
        model_id: mid,
        getmysocial_link_id: a.getmysocial_link_id,
        link_role: a.link_role,
        link_label: a.link_label,
        shortcode: a.shortcode,
        of_destination_hint: a.of_destination_hint ?? null,
        is_primary: a.link_role === "A",
        updated_at: now,
      }))
    )
    .select(SELECT_COLS);
  if (error) throw new Error(`insert getmysocial_links: ${error.message}`);
  return (data ?? []).map((r) => mapRow(r as LinkRow));
}
