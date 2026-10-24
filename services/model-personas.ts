/**
 * Model Personas CRUD — service-role only. Never log persona text content.
 */

import "server-only";

import { getSupabaseServiceClient } from "@/lib/supabase-server";
import {
  DEFAULT_AI_CONTEXT_FLAGS,
  EMPTY_PERSONA_SECTIONS,
  MAX_ACTIVE_LIVE_UPDATES,
  type ModelPersona,
  type ModelPersonaLiveUpdate,
  type ModelPersonaRevision,
  type PersonaAiContextFlags,
  type PersonaSectionData,
  type PersonaPersonalInfo,
  type PersonaChatting,
  type PersonaLifestyle,
  type PersonaPhysique,
  type PersonaContent,
  type PersonaIntimateDetails,
  type PersonaSocials,
} from "@/lib/persona-types";

const TABLE = "model_personas";
const REVISIONS = "model_persona_revisions";
const LIVE = "model_persona_live_updates";
const OPTIONS = "persona_option_lists";

function asObj<T extends object>(v: unknown, fallback: T): T {
  if (v && typeof v === "object" && !Array.isArray(v)) return v as T;
  return fallback;
}

function asString(v: unknown): string {
  return typeof v === "string" ? v : v != null ? String(v) : "";
}

function mapPersona(row: Record<string, unknown>): ModelPersona {
  return {
    id: asString(row.id),
    model_id: asString(row.model_id),
    bio: asString(row.bio),
    personal_info: asObj(row.personal_info, {} as PersonaPersonalInfo),
    chatting: asObj(row.chatting, {} as PersonaChatting),
    lifestyle: asObj(row.lifestyle, {} as PersonaLifestyle),
    physique: asObj(row.physique, {} as PersonaPhysique),
    content: asObj(row.content, {} as PersonaContent),
    intimate_details: asObj(row.intimate_details, {} as PersonaIntimateDetails),
    socials: asObj(row.socials, {} as PersonaSocials),
    ai_context_flags: {
      ...DEFAULT_AI_CONTEXT_FLAGS,
      ...asObj(row.ai_context_flags, {} as PersonaAiContextFlags),
    },
    draft: row.draft && typeof row.draft === "object" ? (row.draft as PersonaSectionData) : null,
    last_updated_by: asString(row.last_updated_by),
    last_updated_by_name: asString(row.last_updated_by_name),
    created_at: asString(row.created_at),
    updated_at: asString(row.updated_at),
  };
}

function mapLive(row: Record<string, unknown>): ModelPersonaLiveUpdate {
  return {
    id: asString(row.id),
    persona_id: asString(row.persona_id),
    content: asString(row.content),
    status: asString(row.status),
    starts_at: asString(row.starts_at),
    ends_at: asString(row.ends_at),
    is_live: row.is_live !== false,
    show_when_inactive: row.show_when_inactive === true,
    created_by: asString(row.created_by),
    created_by_name: asString(row.created_by_name),
    created_at: asString(row.created_at),
    updated_at: asString(row.updated_at),
  };
}

/** Strip sensitive sections for callers without personas:view_sensitive. */
export function stripSensitivePersona(persona: ModelPersona): ModelPersona {
  return {
    ...persona,
    physique: {},
    intimate_details: {},
    draft: persona.draft
      ? { ...persona.draft, physique: {}, intimate_details: {} }
      : null,
  };
}

export function sectionDataFromPersona(p: ModelPersona): PersonaSectionData {
  return {
    bio: p.bio,
    personal_info: p.personal_info,
    chatting: p.chatting,
    lifestyle: p.lifestyle,
    physique: p.physique,
    content: p.content,
    intimate_details: p.intimate_details,
    socials: p.socials,
  };
}

export async function getPersonaByModelId(modelId: string): Promise<ModelPersona | null> {
  const mid = modelId.trim();
  if (!mid) return null;
  const sb = getSupabaseServiceClient();
  const { data, error } = await sb.from(TABLE).select("*").eq("model_id", mid).maybeSingle();
  if (error) throw new Error(`getPersonaByModelId: ${error.message}`);
  if (!data) return null;
  return mapPersona(data as Record<string, unknown>);
}

export async function listPersonasSummary(): Promise<
  Array<{ id: string; model_id: string; updated_at: string; last_updated_by_name: string; has_birth_date: boolean }>
> {
  const sb = getSupabaseServiceClient();
  const { data, error } = await sb
    .from(TABLE)
    .select("id, model_id, updated_at, last_updated_by_name, personal_info")
    .order("updated_at", { ascending: false });
  if (error) throw new Error(`listPersonasSummary: ${error.message}`);
  return (data ?? []).map((row) => {
    const pi = asObj((row as { personal_info?: unknown }).personal_info, {} as PersonaPersonalInfo);
    return {
      id: asString((row as { id?: unknown }).id),
      model_id: asString((row as { model_id?: unknown }).model_id),
      updated_at: asString((row as { updated_at?: unknown }).updated_at),
      last_updated_by_name: asString((row as { last_updated_by_name?: unknown }).last_updated_by_name),
      has_birth_date: Boolean(pi.birth_date?.trim()),
    };
  });
}

export async function getOrCreatePersona(modelId: string): Promise<ModelPersona> {
  const existing = await getPersonaByModelId(modelId);
  if (existing) return existing;
  const sb = getSupabaseServiceClient();
  const { data, error } = await sb
    .from(TABLE)
    .insert({
      model_id: modelId.trim(),
      ...EMPTY_PERSONA_SECTIONS,
      ai_context_flags: DEFAULT_AI_CONTEXT_FLAGS,
    })
    .select("*")
    .single();
  if (error) {
    // Race: another request created it
    const again = await getPersonaByModelId(modelId);
    if (again) return again;
    throw new Error(`getOrCreatePersona: ${error.message}`);
  }
  return mapPersona(data as Record<string, unknown>);
}

export type SavePersonaInput = {
  model_id: string;
  sections: PersonaSectionData;
  ai_context_flags?: PersonaAiContextFlags;
  /** When true, write revision snapshot and clear draft. */
  explicitSave: boolean;
  /** When true, only persist draft jsonb (autosave). */
  draftOnly?: boolean;
  userId: string;
  userName: string;
  /** If false, ignore physique/intimate from input (keep existing). */
  canEditSensitive: boolean;
};

export async function savePersona(input: SavePersonaInput): Promise<ModelPersona> {
  const persona = await getOrCreatePersona(input.model_id);
  const sb = getSupabaseServiceClient();
  const now = new Date().toISOString();

  if (input.draftOnly) {
    const draft: PersonaSectionData = {
      ...input.sections,
      physique: input.canEditSensitive ? input.sections.physique : persona.physique,
      intimate_details: input.canEditSensitive
        ? input.sections.intimate_details
        : persona.intimate_details,
    };
    const { data, error } = await sb
      .from(TABLE)
      .update({ draft, updated_at: now })
      .eq("id", persona.id)
      .select("*")
      .single();
    if (error) throw new Error(`savePersona draft: ${error.message}`);
    return mapPersona(data as Record<string, unknown>);
  }

  const sections = input.sections;
  const patch: Record<string, unknown> = {
    bio: sections.bio ?? "",
    personal_info: sections.personal_info ?? {},
    chatting: sections.chatting ?? {},
    lifestyle: sections.lifestyle ?? {},
    content: sections.content ?? {},
    socials: sections.socials ?? {},
    ai_context_flags: input.ai_context_flags ?? persona.ai_context_flags,
    last_updated_by: input.userId,
    last_updated_by_name: input.userName,
    updated_at: now,
  };

  if (input.canEditSensitive) {
    patch.physique = sections.physique ?? {};
    patch.intimate_details = sections.intimate_details ?? {};
  }

  if (input.explicitSave) {
    patch.draft = null;
  }

  const { data, error } = await sb
    .from(TABLE)
    .update(patch)
    .eq("id", persona.id)
    .select("*")
    .single();
  if (error) throw new Error(`savePersona: ${error.message}`);

  const saved = mapPersona(data as Record<string, unknown>);

  if (input.explicitSave) {
    const snapshot = {
      ...sectionDataFromPersona(saved),
      ai_context_flags: saved.ai_context_flags,
    };
    const { error: revErr } = await sb.from(REVISIONS).insert({
      persona_id: saved.id,
      snapshot,
      saved_by: input.userId,
      saved_by_name: input.userName,
    });
    if (revErr) console.error("[model-personas] revision insert failed", revErr.message);
  }

  return saved;
}

export async function listRevisions(personaId: string, limit = 20): Promise<ModelPersonaRevision[]> {
  const sb = getSupabaseServiceClient();
  const { data, error } = await sb
    .from(REVISIONS)
    .select("id, persona_id, snapshot, saved_by, saved_by_name, created_at")
    .eq("persona_id", personaId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`listRevisions: ${error.message}`);
  return (data ?? []).map((row) => ({
    id: asString((row as { id?: unknown }).id),
    persona_id: asString((row as { persona_id?: unknown }).persona_id),
    snapshot: asObj((row as { snapshot?: unknown }).snapshot, {}),
    saved_by: asString((row as { saved_by?: unknown }).saved_by),
    saved_by_name: asString((row as { saved_by_name?: unknown }).saved_by_name),
    created_at: asString((row as { created_at?: unknown }).created_at),
  }));
}

/** Expire live updates past ends_at. */
export async function expireStaleLiveUpdates(personaId: string): Promise<void> {
  const sb = getSupabaseServiceClient();
  const now = new Date().toISOString();
  await sb
    .from(LIVE)
    .update({ is_live: false, updated_at: now })
    .eq("persona_id", personaId)
    .eq("is_live", true)
    .lt("ends_at", now);
}

export async function listLiveUpdates(
  personaId: string,
  opts?: { includeInactive?: boolean },
): Promise<ModelPersonaLiveUpdate[]> {
  await expireStaleLiveUpdates(personaId);
  const sb = getSupabaseServiceClient();
  let q = sb.from(LIVE).select("*").eq("persona_id", personaId).order("starts_at", { ascending: false });
  if (!opts?.includeInactive) {
    q = q.eq("is_live", true);
  }
  const { data, error } = await q;
  if (error) throw new Error(`listLiveUpdates: ${error.message}`);
  return (data ?? []).map((r) => mapLive(r as Record<string, unknown>));
}

export async function countActiveLiveUpdates(personaId: string): Promise<number> {
  await expireStaleLiveUpdates(personaId);
  const sb = getSupabaseServiceClient();
  const { count, error } = await sb
    .from(LIVE)
    .select("id", { count: "exact", head: true })
    .eq("persona_id", personaId)
    .eq("is_live", true);
  if (error) throw new Error(`countActiveLiveUpdates: ${error.message}`);
  return count ?? 0;
}

export async function createLiveUpdate(input: {
  persona_id: string;
  content: string;
  status: string;
  starts_at: string;
  ends_at: string;
  userId: string;
  userName: string;
}): Promise<ModelPersonaLiveUpdate> {
  const active = await countActiveLiveUpdates(input.persona_id);
  if (active >= MAX_ACTIVE_LIVE_UPDATES) {
    throw new Error(`Maximum ${MAX_ACTIVE_LIVE_UPDATES} active live updates`);
  }
  const sb = getSupabaseServiceClient();
  const { data, error } = await sb
    .from(LIVE)
    .insert({
      persona_id: input.persona_id,
      content: input.content,
      status: input.status,
      starts_at: input.starts_at,
      ends_at: input.ends_at,
      is_live: true,
      created_by: input.userId,
      created_by_name: input.userName,
    })
    .select("*")
    .single();
  if (error) throw new Error(`createLiveUpdate: ${error.message}`);
  return mapLive(data as Record<string, unknown>);
}

export async function updateLiveUpdate(
  id: string,
  patch: Partial<{
    content: string;
    status: string;
    starts_at: string;
    ends_at: string;
    is_live: boolean;
    show_when_inactive: boolean;
  }>,
): Promise<ModelPersonaLiveUpdate> {
  const sb = getSupabaseServiceClient();
  const { data, error } = await sb
    .from(LIVE)
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw new Error(`updateLiveUpdate: ${error.message}`);
  return mapLive(data as Record<string, unknown>);
}

export async function deleteLiveUpdate(id: string): Promise<void> {
  const sb = getSupabaseServiceClient();
  const { error } = await sb.from(LIVE).delete().eq("id", id);
  if (error) throw new Error(`deleteLiveUpdate: ${error.message}`);
}

export async function getOptionList(listKey: string): Promise<string[]> {
  const sb = getSupabaseServiceClient();
  const { data, error } = await sb.from(OPTIONS).select("options").eq("list_key", listKey).maybeSingle();
  if (error) throw new Error(`getOptionList: ${error.message}`);
  const opts = (data as { options?: unknown } | null)?.options;
  if (!Array.isArray(opts)) return [];
  return opts.map((o) => String(o)).filter(Boolean);
}

export async function setOptionList(listKey: string, options: string[]): Promise<string[]> {
  const sb = getSupabaseServiceClient();
  const cleaned = options.map((o) => o.trim()).filter(Boolean);
  const { data, error } = await sb
    .from(OPTIONS)
    .upsert(
      { list_key: listKey, options: cleaned, updated_at: new Date().toISOString() },
      { onConflict: "list_key" },
    )
    .select("options")
    .single();
  if (error) throw new Error(`setOptionList: ${error.message}`);
  const opts = (data as { options?: unknown }).options;
  return Array.isArray(opts) ? opts.map((o) => String(o)) : cleaned;
}

/** Prefill hints from modelss / socials — only fill empty persona fields. */
export type PersonaPrefillHints = {
  name?: string;
  timezone?: string;
  languages?: PersonaPersonalInfo["languages"];
  handles?: PersonaSocials["handles"];
};

export async function buildPrefillHints(modelId: string): Promise<PersonaPrefillHints> {
  const sb = getSupabaseServiceClient();
  const hints: PersonaPrefillHints = {};

  // modelss: try uuid or airtable_id
  const { data: models } = await sb
    .from("modelss")
    .select("id, airtable_id, model_name, timezone, language_default")
    .or(`id.eq.${modelId},airtable_id.eq.${modelId}`)
    .limit(1);
  const model = (models ?? [])[0] as
    | {
        id?: string;
        airtable_id?: string;
        model_name?: string;
        timezone?: string;
        language_default?: string;
      }
    | undefined;

  if (model?.model_name?.trim()) hints.name = model.model_name.trim();
  if (model?.timezone?.trim()) hints.timezone = model.timezone.trim();
  if (model?.language_default?.trim()) {
    hints.languages = [{ language: model.language_default.trim(), level: "", dialect: "" }];
  }

  const mid = modelId;
  const { data: accounts } = await sb
    .from("model_social_accounts")
    .select("platform, username, model_id")
    .eq("model_id", mid)
    .eq("active", true)
    .limit(40);

  const handles: NonNullable<PersonaSocials["handles"]> = [];
  for (const a of accounts ?? []) {
    const platform = asString((a as { platform?: unknown }).platform);
    const username = asString((a as { username?: unknown }).username);
    if (platform && username) handles.push({ platform, handle: username });
  }

  // Link A/B from story config if present
  const { data: storyCfg } = await sb
    .from("model_story_link_config")
    .select("*")
    .eq("model_id", mid)
    .maybeSingle();
  if (storyCfg) {
    const row = storyCfg as Record<string, unknown>;
    for (const key of ["link_a", "link_b", "link_a_url", "link_b_url", "link_a_label", "link_b_label"]) {
      const v = asString(row[key]);
      if (v && (key.includes("url") || key === "link_a" || key === "link_b")) {
        handles.push({ platform: key.includes("a") ? "Link A" : "Link B", handle: v });
      }
    }
  }

  if (handles.length) hints.handles = handles;
  return hints;
}

/**
 * Merge prefill into sections without overwriting user-entered values.
 */
export function applyPrefillWithoutOverwrite(
  sections: PersonaSectionData,
  hints: PersonaPrefillHints,
): PersonaSectionData {
  const pi = { ...sections.personal_info };
  const socials = { ...sections.socials };

  if (!pi.name?.trim() && hints.name) pi.name = hints.name;
  if (!pi.timezone?.trim() && hints.timezone) pi.timezone = hints.timezone;
  if ((!pi.languages || pi.languages.length === 0) && hints.languages?.length) {
    pi.languages = hints.languages;
  }
  if ((!socials.handles || socials.handles.length === 0) && hints.handles?.length) {
    socials.handles = hints.handles;
  }

  return { ...sections, personal_info: pi, socials };
}

/** True when birth_date is present and age >= 18. */
export function isPersonaAdult(personalInfo: PersonaPersonalInfo): boolean {
  const bd = personalInfo.birth_date?.trim();
  if (!bd) return false;
  const d = new Date(bd + (bd.length === 10 ? "T00:00:00Z" : ""));
  if (!Number.isFinite(d.getTime())) return false;
  const now = new Date();
  let age = now.getUTCFullYear() - d.getUTCFullYear();
  const m = now.getUTCMonth() - d.getUTCMonth();
  if (m < 0 || (m === 0 && now.getUTCDate() < d.getUTCDate())) age -= 1;
  return age >= 18;
}
