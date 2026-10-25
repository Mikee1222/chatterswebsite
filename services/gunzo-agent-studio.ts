/**
 * Gunzo Agent — Model Personas + AI Creative Studio tool backends.
 * Calls the SAME services as Studio / persona editor (no duplicated prompts).
 * Never logs persona text, captions, or descriptions — ids / keys / lengths only.
 */

import "server-only";

import { createHash } from "crypto";
import {
  buildPersonaAiContext,
  FORBIDDEN_AI_CONTEXT_KEYS,
} from "@/lib/persona-ai-context";
import {
  isSensitivePersonaSection,
  MAX_ACTIVE_LIVE_UPDATES,
  type ModelPersona,
} from "@/lib/persona-types";
import { ROUTES } from "@/lib/routes";
import { getSupabaseServiceClient } from "@/lib/supabase-server";
import {
  generateCaptions,
  generateTextOnScreen,
  listIdeas,
  saveIdea,
  updateIdea,
  type GenerateResult,
} from "@/services/creative-studio";
import { analyzeVideoFrames } from "@/services/creative-studio-video";
import { queryClarioSuiteTopPosts } from "@/services/clariosuite-sync";
import {
  getOrCreatePersona,
  getPersonaByModelId,
  isPersonaAdult,
  listLiveUpdates,
  listPersonasSummary,
  savePersona,
  createLiveUpdate,
  updateLiveUpdate,
  countActiveLiveUpdates,
  sectionDataFromPersona,
} from "@/services/model-personas";
import {
  createPostingBrief,
  getPostingBriefById,
  type PostingBrief,
  type PostingBriefPostInput,
} from "@/services/posting-briefs";
import { listWinnerSubmissions } from "@/services/winner-sourcing";
import { getModelWinnerThresholds } from "@/services/model-winner-thresholds";
import { tierFromViewCount } from "@/lib/winner-sourcing-helpers";

const FIELD_MAX_CHARS = 4000;
const PHASE_A_EXTERNAL_IG_API = false; // Official Meta Graph lookup not wired yet

function asString(v: unknown): string {
  return typeof v === "string" ? v : v != null ? String(v) : "";
}

function normalizeIgPermalink(link: string): string {
  try {
    const u = new URL(link.trim());
    u.search = "";
    u.hash = "";
    let path = u.pathname.replace(/\/+$/, "");
    return `${u.origin}${path}`.toLowerCase();
  } catch {
    return link.trim().toLowerCase().replace(/\/+$/, "");
  }
}

function emptySectionsFromScores(scores: Record<string, number>): string[] {
  return Object.entries(scores)
    .filter(([, v]) => v < 0.15)
    .map(([k]) => k);
}

function assertNoForbiddenKeys(context: Record<string, unknown>): boolean {
  return FORBIDDEN_AI_CONTEXT_KEYS.every((k) => {
    if (k.includes(".")) {
      const [a, b] = k.split(".");
      const nest = context[a!];
      return !(nest && typeof nest === "object" && b && b in (nest as object));
    }
    return !(k in context);
  });
}

function filterContextBySections(
  context: Record<string, unknown>,
  keys: string[],
  sections?: string[],
): { context: Record<string, unknown>; keys: string[] } {
  if (!sections?.length) return { context, keys };
  const want = new Set(sections.map((s) => s.trim().toLowerCase()).filter(Boolean));
  if (want.has("all")) return { context, keys };
  const filtered: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(context)) {
    if (want.has(k.toLowerCase())) filtered[k] = v;
  }
  const filteredKeys = keys.filter((k) => {
    const top = (k.split(".")[0] ?? k).toLowerCase();
    return want.has(k.toLowerCase()) || want.has(top);
  });
  return { context: filtered, keys: filteredKeys };
}

/** Compact persona summary for agent (allowlisted only). */
export function compactPersonaSummary(
  persona: ModelPersona,
  liveUpdates: Awaited<ReturnType<typeof listLiveUpdates>>,
  sections?: string[],
): {
  allowlist_keys: string[];
  context: Record<string, unknown>;
  forbidden_absent: boolean;
  is_adult: boolean;
  has_birth_date: boolean;
  live_update_count: number;
  updated_at: string;
} {
  const bundle = buildPersonaAiContext(persona, liveUpdates);
  const filtered = filterContextBySections(bundle.context, bundle.allowlistKeysUsed, sections);
  for (const blocked of FORBIDDEN_AI_CONTEXT_KEYS) {
    if (blocked.includes(".")) {
      const [a, b] = blocked.split(".");
      const nest = filtered.context[a!];
      if (nest && typeof nest === "object" && b) {
        delete (nest as Record<string, unknown>)[b];
      }
    } else {
      delete filtered.context[blocked];
    }
  }
  return {
    allowlist_keys: filtered.keys,
    context: filtered.context,
    forbidden_absent: assertNoForbiddenKeys(filtered.context),
    is_adult: isPersonaAdult(persona.personal_info),
    has_birth_date: Boolean(persona.personal_info.birth_date?.trim()),
    live_update_count: liveUpdates.filter((u) => u.is_live).length,
    updated_at: persona.updated_at,
  };
}

export async function agentListPersonas(): Promise<{
  personas: Array<{
    model_id: string;
    completeness: number;
    empty_sections: string[];
    last_updated: string;
    live_update_count: number;
    has_birth_date: boolean;
    is_adult: boolean;
  }>;
}> {
  const rows = await listPersonasSummary();
  return {
    personas: rows.map((r) => ({
      model_id: r.model_id,
      completeness: Math.round(r.completeness * 100) / 100,
      empty_sections: emptySectionsFromScores(r.section_scores),
      last_updated: r.updated_at,
      live_update_count: r.live_update_count,
      has_birth_date: r.has_birth_date,
      is_adult: r.is_adult,
    })),
  };
}

export async function agentGetModelPersona(
  modelId: string,
  sections?: string[],
): Promise<{
  model_id: string;
  persona_id: string | null;
  summary: ReturnType<typeof compactPersonaSummary> | null;
}> {
  const persona = await getPersonaByModelId(modelId);
  if (!persona) {
    return { model_id: modelId, persona_id: null, summary: null };
  }
  const live = await listLiveUpdates(persona.id, { includeInactive: false });
  const summary = compactPersonaSummary(persona, live, sections);
  console.info("[gunzo-agent] get_model_persona", {
    modelId,
    personaId: persona.id,
    allowlistKeys: summary.allowlist_keys,
  });
  return { model_id: modelId, persona_id: persona.id, summary };
}

export async function agentGetPersonaLiveUpdates(modelId: string) {
  const persona = await getPersonaByModelId(modelId);
  if (!persona) {
    return { model_id: modelId, persona_id: null, updates: [], active_count: 0, max_active: MAX_ACTIVE_LIVE_UPDATES };
  }
  const updates = await listLiveUpdates(persona.id, { includeInactive: true });
  const active = updates.filter((u) => u.is_live);
  return {
    model_id: modelId,
    persona_id: persona.id,
    active_count: active.length,
    max_active: MAX_ACTIVE_LIVE_UPDATES,
    updates: updates.map((u) => ({
      id: u.id,
      content: u.content,
      status: u.status,
      is_live: u.is_live,
      starts_at: u.starts_at,
      ends_at: u.ends_at,
      updated_at: u.updated_at,
    })),
  };
}

export async function agentListSavedIdeas(
  modelId: string,
  filters?: { idea_type?: string; favourite_only?: boolean; thumbs?: number },
) {
  let ideas = await listIdeas(modelId);
  if (filters?.idea_type) {
    ideas = ideas.filter((i) => i.idea_type === filters.idea_type);
  }
  if (filters?.favourite_only) {
    ideas = ideas.filter((i) => i.is_favourite);
  }
  if (filters?.thumbs === 1 || filters?.thumbs === -1) {
    ideas = ideas.filter((i) => i.thumbs === filters.thumbs);
  }
  return {
    model_id: modelId,
    ideas: ideas.slice(0, 40).map((i) => ({
      id: i.id,
      idea_type: i.idea_type,
      platform: i.platform,
      title: i.title,
      content: i.content,
      is_favourite: i.is_favourite,
      thumbs: i.thumbs,
      created_at: i.created_at,
    })),
  };
}

export async function agentGetVideoAnalyses(modelId: string, limit = 20) {
  const sb = getSupabaseServiceClient();
  const { data, error } = await sb
    .from("creative_studio_video_analyses")
    .select("id, model_id, status, analysis, created_at, created_by")
    .eq("model_id", modelId)
    .order("created_at", { ascending: false })
    .limit(Math.min(50, Math.max(1, limit)));
  if (error) throw new Error(`get_video_analyses: ${error.message}`);

  return {
    model_id: modelId,
    video_analyzer_url: `${ROUTES.creativeStudio}?model=${encodeURIComponent(modelId)}&tab=analyzer`,
    analyses: (data ?? []).map((raw) => {
      const row = raw as Record<string, unknown>;
      const analysis =
        row.analysis && typeof row.analysis === "object"
          ? (row.analysis as Record<string, unknown>)
          : {};
      return {
        id: asString(row.id),
        status: asString(row.status),
        created_at: asString(row.created_at),
        platform_risk: analysis.platform_risk ?? null,
        attire: analysis.attire ?? null,
        shot_types: analysis.shot_types ?? null,
        framing_variety: analysis.framing_variety ?? null,
        setting: analysis.setting ?? null,
        activity: analysis.activity ?? null,
        mood_vibe: analysis.mood_vibe ?? null,
        suggested_hooks: analysis.suggested_hooks ?? null,
        suggested_caption_angles: analysis.suggested_caption_angles ?? null,
        refusal: analysis.refusal === true,
        // never frames / raw
      };
    }),
  };
}

export async function agentLookupInstagramPost(link: string, modelId?: string) {
  const normalized = normalizeIgPermalink(link);
  if (!normalized) {
    return { ok: false as const, error: "link required" };
  }

  const sb = getSupabaseServiceClient();
  let q = sb
    .from("clariosuite_top_posts")
    .select(
      "media_id,permalink,caption,image_url,engagement_score,reach,likes,comments,shares,saved,views,video_views,posted_at,model_record_id,model_name",
    )
    .limit(40);
  if (modelId) q = q.eq("model_record_id", modelId);
  const { data, error } = await q;
  if (error) throw new Error(`lookup_instagram_post: ${error.message}`);

  const match = (data ?? []).find((row) => {
    const p = asString((row as { permalink?: unknown }).permalink);
    if (!p) return false;
    return normalizeIgPermalink(p) === normalized || p.toLowerCase().includes(normalized);
  }) as Record<string, unknown> | undefined;

  if (match) {
    const views =
      Number(match.views ?? 0) > 0 ? Number(match.views) : Number(match.video_views ?? 0);
    let winner_tier: string | null = null;
    const mid = asString(match.model_record_id);
    if (mid && views > 0) {
      try {
        const thresholds = await getModelWinnerThresholds(mid);
        winner_tier = tierFromViewCount(views, thresholds) ?? null;
      } catch {
        winner_tier = null;
      }
    }
    return {
      ok: true as const,
      source: "synced" as const,
      media_id: asString(match.media_id),
      permalink: asString(match.permalink),
      caption: asString(match.caption),
      cover_ref: asString(match.image_url) ? "synced_cover" : null,
      has_cover: Boolean(asString(match.image_url)),
      metrics: {
        views,
        reach: Number(match.reach ?? 0),
        likes: Number(match.likes ?? 0),
        comments: Number(match.comments ?? 0),
        engagement_score: match.engagement_score != null ? Number(match.engagement_score) : null,
      },
      winner_tier,
      model_record_id: mid || null,
      model_name: asString(match.model_name) || null,
      posted_at: asString(match.posted_at) || null,
    };
  }

  if (!PHASE_A_EXTERNAL_IG_API) {
    return {
      ok: false as const,
      source: "unavailable" as const,
      error:
        "Post not in synced ClarioSuite data. Official Instagram Graph lookup (Phase A) is not available yet — paste the caption/description manually or open Creative Studio Video Analyzer.",
      phase_a_available: false,
      manual_path: "captions_from_description or Creative Studio",
    };
  }

  return {
    ok: false as const,
    source: "external" as const,
    error: "External lookup failed",
    phase_a_available: true,
  };
}

export async function agentGetTopPerformingPosts(modelId: string, limit = 10) {
  const posts = await queryClarioSuiteTopPosts({ modelRecordId: modelId, limit: Math.min(20, limit) });
  let thresholds = null;
  try {
    thresholds = await getModelWinnerThresholds(modelId);
  } catch {
    thresholds = null;
  }
  const allWinners = await listWinnerSubmissions().catch(() => []);
  const winners = allWinners.filter((w) => w.model_id === modelId);

  return {
    model_id: modelId,
    top_posts: posts.map((p) => {
      const views = p.views > 0 ? p.views : p.video_views;
      const tier = thresholds ? tierFromViewCount(views, thresholds) : null;
      return {
        media_id: p.media_id,
        permalink: p.permalink,
        caption_preview: (p.caption ?? "").slice(0, 180),
        views,
        reach: p.reach,
        likes: p.likes,
        engagement_score: p.engagement_score,
        winner_tier: tier,
        posted_at: p.posted_at,
        has_cover: Boolean(p.image_url),
      };
    }),
    winners: winners.slice(0, 15).map((w) => ({
      id: w.id,
      tier: w.tier,
      view_count: w.view_count ?? null,
      video_link: w.video_link ?? null,
      status: w.status,
    })),
  };
}

export async function agentGenerateCaptions(input: {
  modelId: string;
  userId: string;
  platform?: string;
  format?: string;
  ideaContext?: string;
  toneTweak?: string;
  variations?: number;
  hashtagCount?: number;
  outputLanguage?: string;
}): Promise<GenerateResult & { kind: "caption"; model_id: string; platform: string }> {
  const result = await generateCaptions({
    modelId: input.modelId,
    platform: input.platform?.trim() || "Instagram",
    format: input.format,
    ideaContext: input.ideaContext,
    toneTweak: input.toneTweak,
    variations: input.variations,
    hashtagCount: input.hashtagCount,
    outputLanguage: input.outputLanguage,
    userId: input.userId,
  });
  console.info("[gunzo-agent] generate_captions", {
    modelId: input.modelId,
    variationCount: result.variations.length,
    cached: result.cached,
    keys: result.allowlistKeysUsed,
  });
  return {
    ...result,
    kind: "caption",
    model_id: input.modelId,
    platform: input.platform?.trim() || "Instagram",
  };
}

export async function agentGenerateTextOnScreen(input: {
  modelId: string;
  userId: string;
  ideaContext?: string;
  toneTweak?: string;
  maxChars?: number;
  variations?: number;
  outputLanguage?: string;
}): Promise<GenerateResult & { kind: "text_on_screen"; model_id: string }> {
  const result = await generateTextOnScreen({
    modelId: input.modelId,
    ideaContext: input.ideaContext,
    toneTweak: input.toneTweak,
    maxChars: input.maxChars,
    variations: input.variations,
    outputLanguage: input.outputLanguage,
    userId: input.userId,
  });
  console.info("[gunzo-agent] generate_text_on_screen", {
    modelId: input.modelId,
    variationCount: result.variations.length,
    cached: result.cached,
    keys: result.allowlistKeysUsed,
  });
  return { ...result, kind: "text_on_screen", model_id: input.modelId };
}

export async function agentAnalyseFromInstagramLink(input: {
  link: string;
  modelId: string;
  userId: string;
}) {
  const looked = await agentLookupInstagramPost(input.link, input.modelId);
  if (!looked.ok || looked.source !== "synced") {
    return {
      ok: false as const,
      error:
        !looked.ok && "error" in looked
          ? looked.error
          : "Synced cover not available for analysis",
      video_analyzer_url: `${ROUTES.creativeStudio}?model=${encodeURIComponent(input.modelId)}&tab=analyzer`,
      manual_path: "captions_from_description",
    };
  }

  const sb = getSupabaseServiceClient();
  const { data: rows } = await sb
    .from("clariosuite_top_posts")
    .select("image_url,permalink")
    .eq("media_id", looked.media_id)
    .limit(1);
  const imageUrl = asString((rows?.[0] as { image_url?: unknown } | undefined)?.image_url);
  if (!imageUrl) {
    return {
      ok: false as const,
      error: "Synced post has no cover image — use Creative Studio Video Analyzer or captions_from_description",
      video_analyzer_url: `${ROUTES.creativeStudio}?model=${encodeURIComponent(input.modelId)}&tab=analyzer`,
    };
  }

  let bytes: Buffer;
  try {
    const res = await fetch(imageUrl, { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) throw new Error(`cover fetch ${res.status}`);
    bytes = Buffer.from(await res.arrayBuffer());
  } catch (err) {
    return {
      ok: false as const,
      error: `Could not fetch cover: ${err instanceof Error ? err.message : String(err)}`,
      video_analyzer_url: `${ROUTES.creativeStudio}?model=${encodeURIComponent(input.modelId)}&tab=analyzer`,
    };
  }

  const b64 = bytes.toString("base64");
  const hash = createHash("sha256").update(bytes).digest("hex").slice(0, 16);

  const result = await analyzeVideoFrames({
    modelId: input.modelId,
    userId: input.userId,
    frames: [b64],
    frameHashes: [hash],
    samplingMeta: { frames_requested: 1, frames_analysed: 1, vision_model: "cover" },
  });

  const a = result.analysis;
  console.info("[gunzo-agent] analyse_from_instagram_link", {
    modelId: input.modelId,
    mediaId: looked.media_id,
    refused: result.refused,
    keys: result.allowlistKeysUsed,
  });

  return {
    ok: true as const,
    media_id: looked.media_id,
    permalink: looked.permalink,
    analysis_id: result.analysisId,
    refused: result.refused,
    generationDisabledReason: result.generationDisabledReason,
    allowlist_keys: result.allowlistKeysUsed,
    graded: {
      platform_risk: a.platform_risk ?? null,
      attire: a.attire ?? null,
      shot_types: a.shot_types ?? null,
      framing_variety: a.framing_variety ?? null,
      setting: a.setting ?? null,
      activity: a.activity ?? null,
      mood_vibe: a.mood_vibe ?? null,
      suggested_hooks: a.suggested_hooks ?? null,
      suggested_caption_angles: a.suggested_caption_angles ?? null,
      refusal: a.refusal === true,
    },
  };
}

function validateFieldLengths(fields: Record<string, unknown>): string | null {
  for (const [k, v] of Object.entries(fields)) {
    if (typeof v === "string" && v.length > FIELD_MAX_CHARS) {
      return `Field ${k} exceeds ${FIELD_MAX_CHARS} characters`;
    }
    if (Array.isArray(v)) {
      for (const item of v) {
        if (typeof item === "string" && item.length > FIELD_MAX_CHARS) {
          return `Field ${k} item exceeds ${FIELD_MAX_CHARS} characters`;
        }
      }
    }
  }
  return null;
}

const ALLOWED_UPDATE_SECTIONS = [
  "bio",
  "personal_info",
  "chatting",
  "lifestyle",
  "content",
  "socials",
] as const;

export async function agentCreatePersona(
  modelId: string,
  userId: string,
  userName: string,
): Promise<{ persona_id: string; model_id: string; created: boolean }> {
  const existing = await getPersonaByModelId(modelId);
  if (existing) {
    return { persona_id: existing.id, model_id: modelId, created: false };
  }
  const persona = await getOrCreatePersona(modelId);
  console.info("[gunzo-agent] create_persona", { modelId, personaId: persona.id, userId });
  void userName;
  return { persona_id: persona.id, model_id: modelId, created: true };
}

export async function agentUpdatePersonaFields(input: {
  modelId: string;
  section: string;
  fields: Record<string, unknown>;
  userId: string;
  userName: string;
}): Promise<{
  ok: boolean;
  error?: string;
  persona_id?: string;
  field_keys?: string[];
  before_keys?: string[];
  after_keys?: string[];
}> {
  const sectionRaw = input.section.trim();
  if (isSensitivePersonaSection(sectionRaw) || sectionRaw === "live_updates") {
    return {
      ok: false,
      error:
        sectionRaw === "live_updates"
          ? "Use add/update/deactivate_live_update tools for live updates"
          : "Cannot read or write Physique / Intimate Details via the agent (content would pass through AI). Use the persona editor.",
    };
  }
  if (!(ALLOWED_UPDATE_SECTIONS as readonly string[]).includes(sectionRaw)) {
    return { ok: false, error: `Section not editable via agent: ${sectionRaw}` };
  }
  const section = sectionRaw as (typeof ALLOWED_UPDATE_SECTIONS)[number];
  const lenErr = validateFieldLengths(input.fields);
  if (lenErr) return { ok: false, error: lenErr };

  const persona = await getOrCreatePersona(input.modelId);
  const sections = sectionDataFromPersona(persona);

  if (section === "bio") {
    let bio = asString(input.fields.bio ?? input.fields.value ?? "");
    if (input.fields.bio === undefined && Object.keys(input.fields).length === 1) {
      const only = Object.values(input.fields)[0];
      if (typeof only === "string") bio = only;
    }
    if (bio.length > FIELD_MAX_CHARS) return { ok: false, error: `bio exceeds ${FIELD_MAX_CHARS}` };
    sections.bio = bio;
  } else {
    const current = {
      ...(sections[section] as unknown as Record<string, unknown>),
    };
    for (const [k, v] of Object.entries(input.fields)) {
      if (k === "physique" || k === "intimate_details") continue;
      current[k] = v;
    }
    if (section === "personal_info" && typeof current.birth_date === "string") {
      const pi = { ...persona.personal_info, ...current };
      if (current.birth_date.trim() && !isPersonaAdult(pi as ModelPersona["personal_info"])) {
        return { ok: false, error: "Birth date must be valid and 18+" };
      }
    }
    (sections as Record<string, unknown>)[section] = current;
  }

  const fieldKeys = Object.keys(input.fields);
  await savePersona({
    model_id: input.modelId,
    sections,
    explicitSave: true,
    userId: input.userId,
    userName: input.userName,
    canEditSensitive: false,
  });

  console.info("[gunzo-agent] update_persona_fields", {
    modelId: input.modelId,
    personaId: persona.id,
    section,
    fieldKeys,
  });

  return {
    ok: true,
    persona_id: persona.id,
    field_keys: fieldKeys,
    before_keys: fieldKeys,
    after_keys: fieldKeys,
  };
}

export async function agentAddLiveUpdate(input: {
  modelId: string;
  content: string;
  status?: string;
  starts_at: string;
  ends_at: string;
  userId: string;
  userName: string;
}) {
  const persona = await getOrCreatePersona(input.modelId);
  const active = await countActiveLiveUpdates(persona.id);
  if (active >= MAX_ACTIVE_LIVE_UPDATES) {
    return {
      ok: false as const,
      error: `Maximum ${MAX_ACTIVE_LIVE_UPDATES} active live updates — deactivate one first`,
      active_count: active,
    };
  }
  const content = input.content.trim();
  if (!content) return { ok: false as const, error: "content required" };
  if (content.length > FIELD_MAX_CHARS) {
    return { ok: false as const, error: `content exceeds ${FIELD_MAX_CHARS}` };
  }
  const row = await createLiveUpdate({
    persona_id: persona.id,
    content,
    status: input.status?.trim() || "active",
    starts_at: input.starts_at,
    ends_at: input.ends_at,
    userId: input.userId,
    userName: input.userName,
  });
  console.info("[gunzo-agent] add_live_update", {
    modelId: input.modelId,
    liveUpdateId: row.id,
    contentLength: content.length,
  });
  return { ok: true as const, id: row.id, active_count: active + 1 };
}

export async function agentUpdateLiveUpdate(input: {
  liveUpdateId: string;
  content?: string;
  status?: string;
  starts_at?: string;
  ends_at?: string;
}) {
  const patch: Parameters<typeof updateLiveUpdate>[1] = {};
  if (input.content != null) {
    if (input.content.length > FIELD_MAX_CHARS) {
      return { ok: false as const, error: `content exceeds ${FIELD_MAX_CHARS}` };
    }
    patch.content = input.content;
  }
  if (input.status != null) patch.status = input.status;
  if (input.starts_at != null) patch.starts_at = input.starts_at;
  if (input.ends_at != null) patch.ends_at = input.ends_at;
  const row = await updateLiveUpdate(input.liveUpdateId, patch);
  console.info("[gunzo-agent] update_live_update", {
    liveUpdateId: row.id,
    keys: Object.keys(patch),
  });
  return { ok: true as const, id: row.id };
}

export async function agentDeactivateLiveUpdate(liveUpdateId: string) {
  const row = await updateLiveUpdate(liveUpdateId, { is_live: false });
  console.info("[gunzo-agent] deactivate_live_update", { liveUpdateId: row.id });
  return { ok: true as const, id: row.id, is_live: false };
}

export async function agentSaveIdeas(input: {
  modelId: string;
  userId: string;
  ideas: Array<{
    content: string;
    idea_type?: string;
    platform?: string;
    title?: string;
  }>;
}) {
  const saved: string[] = [];
  for (const idea of input.ideas.slice(0, 20)) {
    const content = idea.content?.trim();
    if (!content) continue;
    const row = await saveIdea({
      model_id: input.modelId,
      idea_type: (idea.idea_type === "text_on_screen" ? "text_on_screen" : "caption") as
        | "caption"
        | "text_on_screen",
      platform: idea.platform,
      title: idea.title,
      content,
      userId: input.userId,
    });
    saved.push(row.id);
  }
  console.info("[gunzo-agent] save_ideas", {
    modelId: input.modelId,
    count: saved.length,
    ids: saved,
  });
  return { ok: true as const, idea_ids: saved };
}

export async function agentRateIdea(input: {
  idea_id?: string;
  idea_ids?: string[];
  thumbs?: -1 | 0 | 1;
  is_favourite?: boolean;
}) {
  const ids = [
    ...(input.idea_id ? [input.idea_id] : []),
    ...(Array.isArray(input.idea_ids) ? input.idea_ids : []),
  ].filter(Boolean);
  if (!ids.length) return { ok: false as const, error: "idea_id or idea_ids required" };
  const updated: string[] = [];
  for (const id of ids.slice(0, 40)) {
    const patch: Parameters<typeof updateIdea>[1] = {};
    if (input.thumbs === -1 || input.thumbs === 0 || input.thumbs === 1) {
      patch.thumbs = input.thumbs;
    }
    if (typeof input.is_favourite === "boolean") patch.is_favourite = input.is_favourite;
    if (!Object.keys(patch).length) continue;
    await updateIdea(id, patch);
    updated.push(id);
  }
  console.info("[gunzo-agent] rate_idea", { ids: updated, thumbs: input.thumbs });
  return { ok: true as const, idea_ids: updated };
}

export async function agentCreatePostingBriefDraft(input: {
  modelId: string;
  userId: string;
  title: string;
  caption?: string;
  text_on_screen?: string;
  account_handle?: string;
  content_type?: string;
  instructions_notes?: string;
}): Promise<{ ok: true; brief_id: string; notified: false } | { ok: false; error: string }> {
  const title = input.title.trim();
  if (!title) return { ok: false, error: "title required" };
  const posts: PostingBriefPostInput[] = [];
  if (input.caption || input.text_on_screen) {
    posts.push({
      caption: input.caption ?? "",
      text_on_screen: input.text_on_screen ?? null,
      video_name: "",
    });
  }
  const brief = await createPostingBrief(
    {
      title,
      model_id: input.modelId,
      account_handle: input.account_handle,
      content_type: (input.content_type as PostingBrief["content_type"]) || "Trial Reels",
      instructions_notes:
        input.instructions_notes ??
        "Draft created via Gunzo Agent — review before assigning.",
      status: "active",
      posts,
      created_by: input.userId,
    },
    { notify: false, actorUserId: input.userId },
  );
  console.info("[gunzo-agent] create_posting_brief_draft", {
    briefId: brief.id,
    modelId: input.modelId,
    postCount: posts.length,
  });
  return { ok: true, brief_id: brief.id, notified: false };
}

export async function agentAddPostToPostingBriefDraft(input: {
  briefId: string;
  caption?: string;
  text_on_screen?: string;
  video_name?: string;
}): Promise<{ ok: true; brief_id: string; post_id?: string } | { ok: false; error: string }> {
  const brief = await getPostingBriefById(input.briefId);
  if (!brief) return { ok: false, error: "Brief not found" };
  if (brief.status === "archived") {
    return { ok: false, error: "Cannot add posts to an archived brief" };
  }
  const { pushToPostingBrief } = await import("@/services/creative-studio");
  const result = await pushToPostingBrief({
    briefId: input.briefId,
    caption: input.caption,
    text_on_screen: input.text_on_screen,
  });
  if (!result.ok) return { ok: false, error: result.error ?? "Failed to add post" };
  console.info("[gunzo-agent] add_post_to_posting_brief_draft", {
    briefId: input.briefId,
    hasCaption: Boolean(input.caption),
    hasTos: Boolean(input.text_on_screen),
  });
  return { ok: true, brief_id: input.briefId };
}

export { PHASE_A_EXTERNAL_IG_API, MAX_ACTIVE_LIVE_UPDATES, FORBIDDEN_AI_CONTEXT_KEYS };
