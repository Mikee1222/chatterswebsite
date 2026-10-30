/**
 * Model Wardrobe — outfits / locations / props per creator.
 * One photo each, tags, and last-used tracking so Draft briefs can rotate
 * ONE outfit + ONE location per recording brief (one bunch = one setup).
 */

import "server-only";

import { getSupabaseServiceClient } from "@/lib/supabase-server";
import { resolveStorageUrls } from "@/lib/supabase-signed-url";

const ITEMS = "model_wardrobe_items";
const SETTINGS = "model_wardrobe_settings";

export const WARDROBE_KINDS = ["outfit", "location", "prop"] as const;
export type WardrobeKind = (typeof WARDROBE_KINDS)[number];

export const OUTFIT_TAG_SUGGESTIONS = [
  "cozy",
  "casual",
  "going out",
  "sporty",
  "dress",
  "lingerie-ish",
  "pyjamas",
  "office",
  "swim",
  "winter",
  "summer",
];
export const LOCATION_TAG_SUGGESTIONS = [
  "bed",
  "couch",
  "kitchen",
  "mirror",
  "balcony",
  "bathroom",
  "desk",
  "outdoor",
  "good morning light",
  "good evening light",
];

export type WardrobeItem = {
  id: string;
  model_id: string;
  kind: WardrobeKind;
  number: number;
  name: string;
  tags: string[];
  color: string;
  notes: string;
  /** sb:// token (private). */
  photo_url: string;
  /** Signed https URL for display (short-lived). */
  photo_signed_url: string;
  is_active: boolean;
  last_used_at: string | null;
  last_used_brief_id: string | null;
  use_count: number;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type WardrobeItemInput = {
  kind: WardrobeKind;
  name?: string;
  tags?: string[];
  color?: string;
  notes?: string;
  photo_url?: string;
  is_active?: boolean;
};

export type WardrobeBundle = {
  items: WardrobeItem[];
  rules: string;
};

function str(v: unknown): string {
  return typeof v === "string" ? v : v == null ? "" : String(v);
}
function kindOf(v: unknown): WardrobeKind {
  return v === "location" || v === "prop" ? v : "outfit";
}
function cleanTags(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  const out: string[] = [];
  for (const t of v) {
    const s = str(t).trim().toLowerCase().slice(0, 30);
    if (s && !out.includes(s)) out.push(s);
  }
  return out.slice(0, 10);
}

function mapItem(row: Record<string, unknown>, signed = ""): WardrobeItem {
  return {
    id: str(row.id),
    model_id: str(row.model_id),
    kind: kindOf(row.kind),
    number: Number(row.number) || 0,
    name: str(row.name),
    tags: cleanTags(row.tags),
    color: str(row.color),
    notes: str(row.notes),
    photo_url: str(row.photo_url),
    photo_signed_url: signed,
    is_active: row.is_active !== false,
    last_used_at: typeof row.last_used_at === "string" ? row.last_used_at : null,
    last_used_brief_id: typeof row.last_used_brief_id === "string" ? row.last_used_brief_id : null,
    use_count: Number(row.use_count) || 0,
    created_by: str(row.created_by),
    created_at: str(row.created_at),
    updated_at: str(row.updated_at),
  };
}

async function withSignedUrls(rows: Record<string, unknown>[]): Promise<WardrobeItem[]> {
  const signed = await resolveStorageUrls(rows.map((r) => str(r.photo_url)), 60 * 60).catch(() =>
    rows.map(() => ""),
  );
  return rows.map((r, i) => mapItem(r, signed[i] ?? ""));
}

export async function listWardrobe(modelId: string, opts?: { includeInactive?: boolean }): Promise<WardrobeBundle> {
  const sb = getSupabaseServiceClient();
  let q = sb.from(ITEMS).select("*").eq("model_id", modelId).order("kind").order("number");
  if (!opts?.includeInactive) q = q.eq("is_active", true);
  const [{ data, error }, settings] = await Promise.all([
    q,
    sb.from(SETTINGS).select("rules").eq("model_id", modelId).maybeSingle(),
  ]);
  if (error) throw new Error(`listWardrobe: ${error.message}`);
  const items = await withSignedUrls((data ?? []) as Record<string, unknown>[]);
  return { items, rules: str((settings.data as { rules?: unknown } | null)?.rules) };
}

export async function getWardrobeItem(id: string): Promise<WardrobeItem | null> {
  const sb = getSupabaseServiceClient();
  const { data, error } = await sb.from(ITEMS).select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(`getWardrobeItem: ${error.message}`);
  if (!data) return null;
  const [item] = await withSignedUrls([data as Record<string, unknown>]);
  return item ?? null;
}

export async function getWardrobeItemsByIds(ids: string[]): Promise<Map<string, WardrobeItem>> {
  const clean = ids.filter(Boolean);
  const map = new Map<string, WardrobeItem>();
  if (!clean.length) return map;
  const sb = getSupabaseServiceClient();
  const { data, error } = await sb.from(ITEMS).select("*").in("id", clean);
  if (error) throw new Error(`getWardrobeItemsByIds: ${error.message}`);
  const items = await withSignedUrls((data ?? []) as Record<string, unknown>[]);
  for (const it of items) map.set(it.id, it);
  return map;
}

export async function createWardrobeItem(
  modelId: string,
  input: WardrobeItemInput,
  userId: string,
): Promise<WardrobeItem> {
  const sb = getSupabaseServiceClient();
  const kind = kindOf(input.kind);
  const { data: maxRow } = await sb
    .from(ITEMS)
    .select("number")
    .eq("model_id", modelId)
    .eq("kind", kind)
    .order("number", { ascending: false })
    .limit(1)
    .maybeSingle();
  const number = (Number((maxRow as { number?: unknown } | null)?.number) || 0) + 1;
  const { data, error } = await sb
    .from(ITEMS)
    .insert({
      model_id: modelId,
      kind,
      number,
      name: (input.name ?? "").trim().slice(0, 120),
      tags: cleanTags(input.tags),
      color: (input.color ?? "").trim().slice(0, 40),
      notes: (input.notes ?? "").trim().slice(0, 1000),
      photo_url: (input.photo_url ?? "").trim(),
      is_active: input.is_active !== false,
      created_by: userId,
    })
    .select("*")
    .single();
  if (error) throw new Error(`createWardrobeItem: ${error.message}`);
  const [item] = await withSignedUrls([data as Record<string, unknown>]);
  return item!;
}

export async function updateWardrobeItem(
  id: string,
  patch: Partial<WardrobeItemInput>,
): Promise<WardrobeItem> {
  const sb = getSupabaseServiceClient();
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.name !== undefined) update.name = patch.name.trim().slice(0, 120);
  if (patch.tags !== undefined) update.tags = cleanTags(patch.tags);
  if (patch.color !== undefined) update.color = patch.color.trim().slice(0, 40);
  if (patch.notes !== undefined) update.notes = patch.notes.trim().slice(0, 1000);
  if (patch.photo_url !== undefined) update.photo_url = patch.photo_url.trim();
  if (patch.is_active !== undefined) update.is_active = patch.is_active;
  const { data, error } = await sb.from(ITEMS).update(update).eq("id", id).select("*").single();
  if (error) throw new Error(`updateWardrobeItem: ${error.message}`);
  const [item] = await withSignedUrls([data as Record<string, unknown>]);
  return item!;
}

export async function deleteWardrobeItem(id: string): Promise<void> {
  const sb = getSupabaseServiceClient();
  const { error } = await sb.from(ITEMS).delete().eq("id", id);
  if (error) throw new Error(`deleteWardrobeItem: ${error.message}`);
}

export async function setWardrobeRules(modelId: string, rules: string, userId: string): Promise<void> {
  const sb = getSupabaseServiceClient();
  const { error } = await sb.from(SETTINGS).upsert(
    {
      model_id: modelId,
      rules: rules.trim().slice(0, 4000),
      updated_by: userId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "model_id" },
  );
  if (error) throw new Error(`setWardrobeRules: ${error.message}`);
}

/** Called when a recording brief is published: stamps last-used on the items it uses. */
export async function markWardrobeItemsUsed(itemIds: Array<string | null | undefined>, briefId: string): Promise<void> {
  const ids = itemIds.filter((x): x is string => Boolean(x));
  if (!ids.length) return;
  const sb = getSupabaseServiceClient();
  const now = new Date().toISOString();
  const { data } = await sb.from(ITEMS).select("id, use_count").in("id", ids);
  await Promise.all(
    ((data ?? []) as Array<{ id: string; use_count?: number }>).map((r) =>
      sb
        .from(ITEMS)
        .update({
          last_used_at: now,
          last_used_brief_id: briefId,
          use_count: (Number(r.use_count) || 0) + 1,
          updated_at: now,
        })
        .eq("id", r.id),
    ),
  );
}

/* ------------------------------------------------------------------ */
/* Text for the AI (Draft briefs)                                       */
/* ------------------------------------------------------------------ */

function daysAgo(iso: string | null): string {
  if (!iso) return "never used";
  const d = Math.round((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (d <= 0) return "used today";
  return `used ${d} day${d === 1 ? "" : "s"} ago`;
}

/** Compact wardrobe listing the model can choose from, with rotation hints. */
export function wardrobeToPromptText(bundle: WardrobeBundle): string {
  const by = (kind: WardrobeKind) => bundle.items.filter((i) => i.kind === kind && i.is_active);
  const line = (i: WardrobeItem) =>
    `#${i.number} ${i.name || "(unnamed)"}${i.tags.length ? ` [${i.tags.join(", ")}]` : ""}${
      i.color ? ` · ${i.color}` : ""
    } · ${daysAgo(i.last_used_at)}${i.notes ? ` · ${i.notes}` : ""}`;
  const outfits = by("outfit");
  const locations = by("location");
  const props = by("prop");
  if (!outfits.length && !locations.length && !props.length) return "";
  const parts: string[] = ["WARDROBE (pick by number; one outfit + one location for the WHOLE brief):"];
  if (outfits.length) parts.push("Outfits:\n" + outfits.map(line).join("\n"));
  if (locations.length) parts.push("Locations:\n" + locations.map(line).join("\n"));
  if (props.length) parts.push("Props available: " + props.map((p) => `#${p.number} ${p.name}`).join(", "));
  if (bundle.rules.trim()) parts.push("WARDROBE RULES FROM THE AGENCY:\n" + bundle.rules.trim());
  parts.push(
    "Rotation: prefer the outfit and location used longest ago (or never) that fits the concept; never pick one used in the last 14 days if an alternative exists.",
  );
  return parts.join("\n\n");
}
