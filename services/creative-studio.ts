/**
 * AI Creative Studio — captions, text-on-screen, ideas library.
 * Logs feature keys / token proxies only — never persona text or captions to agent_action_log.
 */

import "server-only";

import { createHash } from "crypto";
import {
  AI_FAST_MODEL,
  callAnthropic,
  extractJsonArray,
  extractJsonObject,
} from "@/lib/ai-assistant";
import {
  buildPersonaAiContext,
  filterSocialVariations,
  PLATFORM_SAFE_SOCIAL_RULES,
} from "@/lib/persona-ai-context";
import { getSupabaseServiceClient } from "@/lib/supabase-server";
import {
  getAiFeatureCache,
  upsertAiFeatureCache,
} from "@/services/ai-feature-cache";
import {
  getPersonaByModelId,
  isPersonaAdult,
  listLiveUpdates,
} from "@/services/model-personas";
import { logAiUsage } from "@/services/ai-usage-log";
import type { CreativeIdea, CreativeIdeaType } from "@/lib/creative-studio-types";

export type { CreativeIdea, CreativeIdeaType };

const IDEAS = "creative_studio_ideas";
const RATE = "creative_studio_rate_limits";

const RATE_LIMIT_PER_HOUR = 40;
const MAX_REGEN = 2;
const CACHE_TTL_MS = 12 * 60 * 60 * 1000;

function asString(v: unknown): string {
  return typeof v === "string" ? v : v != null ? String(v) : "";
}

function mapIdea(row: Record<string, unknown>): CreativeIdea {
  const thumbsRaw = Number(row.thumbs ?? 0);
  const thumbs = thumbsRaw === 1 || thumbsRaw === -1 ? (thumbsRaw as 1 | -1) : 0;
  return {
    id: asString(row.id),
    model_id: asString(row.model_id),
    idea_type: asString(row.idea_type) as CreativeIdeaType,
    platform: asString(row.platform),
    title: asString(row.title),
    content: asString(row.content),
    meta:
      row.meta && typeof row.meta === "object" && !Array.isArray(row.meta)
        ? (row.meta as Record<string, unknown>)
        : {},
    is_favourite: row.is_favourite === true,
    thumbs,
    created_by: asString(row.created_by),
    created_at: asString(row.created_at),
    updated_at: asString(row.updated_at),
  };
}

export async function assertCreativeRateLimit(userId: string): Promise<void> {
  const sb = getSupabaseServiceClient();
  const windowStart = new Date();
  windowStart.setMinutes(0, 0, 0);
  const ws = windowStart.toISOString();

  const { data } = await sb
    .from(RATE)
    .select("id, call_count")
    .eq("user_id", userId)
    .eq("window_start", ws)
    .maybeSingle();

  const count = Number((data as { call_count?: number } | null)?.call_count ?? 0);
  if (count >= RATE_LIMIT_PER_HOUR) {
    throw new Error("Rate limit exceeded — try again next hour");
  }

  if (data) {
    await sb
      .from(RATE)
      .update({ call_count: count + 1 })
      .eq("id", (data as { id: string }).id);
  } else {
    await sb.from(RATE).insert({ user_id: userId, window_start: ws, call_count: 1 });
  }
}

async function loadTopPostsFewShot(modelId: string, limit = 5): Promise<string[]> {
  const sb = getSupabaseServiceClient();
  // Resolve clariosuite account via modelss
  const { data: models } = await sb
    .from("modelss")
    .select("id, airtable_id, clariosuite_ig_user_id")
    .or(`id.eq.${modelId},airtable_id.eq.${modelId}`)
    .limit(1);
  const model = (models ?? [])[0] as
    | { clariosuite_ig_user_id?: string | null }
    | undefined;
  const ig = model?.clariosuite_ig_user_id?.trim();
  if (!ig) return [];

  const { data: posts } = await sb
    .from("clariosuite_top_posts")
    .select("caption, insights")
    .eq("ig_user_id", ig)
    .order("posted_at", { ascending: false })
    .limit(30);

  const withCaption = (posts ?? [])
    .map((p) => asString((p as { caption?: unknown }).caption).trim())
    .filter((c) => c.length > 20 && c.length < 500);

  return withCaption.slice(0, limit);
}

async function loadThumbsUpExamples(modelId: string, ideaType: CreativeIdeaType, limit = 3): Promise<string[]> {
  const sb = getSupabaseServiceClient();
  const { data } = await sb
    .from(IDEAS)
    .select("content")
    .eq("model_id", modelId)
    .eq("idea_type", ideaType)
    .eq("thumbs", 1)
    .order("updated_at", { ascending: false })
    .limit(limit);
  return (data ?? []).map((r) => asString((r as { content?: unknown }).content)).filter(Boolean);
}

function hashInput(payload: unknown): string {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex").slice(0, 40);
}

export type GenerateCaptionsInput = {
  modelId: string;
  platform: string;
  format?: string;
  ideaContext?: string;
  toneTweak?: string;
  variations?: number;
  hashtagCount?: number;
  outputLanguage?: string;
  userId: string;
};

export type GenerateTextOnScreenInput = {
  modelId: string;
  ideaContext?: string;
  toneTweak?: string;
  maxChars?: number;
  variations?: number;
  outputLanguage?: string;
  userId: string;
};

export type GenerateResult = {
  variations: string[];
  allowlistKeysUsed: string[];
  cached: boolean;
  droppedRegenRounds: number;
  generationDisabledReason?: string;
};

async function loadPersonaBundle(modelId: string) {
  const persona = await getPersonaByModelId(modelId);
  if (!persona) {
    return { error: "No persona found for this model — create one first" as const };
  }
  if (!isPersonaAdult(persona.personal_info)) {
    return {
      error: "AI generation disabled — birth date required and must be 18+" as const,
      persona,
    };
  }
  const live = await listLiveUpdates(persona.id, { includeInactive: false });
  const bundle = buildPersonaAiContext(persona, live);
  return { persona, live, bundle };
}

export async function generateCaptions(input: GenerateCaptionsInput): Promise<GenerateResult> {
  await assertCreativeRateLimit(input.userId);

  const loaded = await loadPersonaBundle(input.modelId);
  if ("error" in loaded && loaded.error) {
    return {
      variations: [],
      allowlistKeysUsed: [],
      cached: false,
      droppedRegenRounds: 0,
      generationDisabledReason: loaded.error,
    };
  }
  const { persona, bundle } = loaded as {
    persona: NonNullable<Awaited<ReturnType<typeof getPersonaByModelId>>>;
    bundle: ReturnType<typeof buildPersonaAiContext>;
  };

  const variationsN = Math.min(5, Math.max(1, input.variations ?? 3));
  const hashtagCount = Math.min(15, Math.max(0, input.hashtagCount ?? 5));
  const lang =
    input.outputLanguage?.trim() ||
    persona.personal_info.languages?.[0]?.language ||
    "English";

  const cachePayload = {
    f: "captions",
    m: input.modelId,
    p: input.platform,
    fmt: input.format ?? "",
    idea: input.ideaContext ?? "",
    tone: input.toneTweak ?? "",
    n: variationsN,
    h: hashtagCount,
    lang,
    keys: bundle.allowlistKeysUsed,
    personaUpdated: persona.updated_at,
  };
  const cacheKey = hashInput(cachePayload);
  const cached = await getAiFeatureCache("creative_studio_captions", cacheKey);
  if (cached && Date.now() - new Date(cached.generated_at).getTime() < CACHE_TTL_MS) {
    try {
      const parsed = JSON.parse(cached.content_text) as { variations?: string[] };
      if (Array.isArray(parsed.variations) && parsed.variations.length) {
        console.info("[creative-studio] captions cache hit", {
          modelId: input.modelId,
          feature: "creative_studio_captions",
          allowlistKeys: bundle.allowlistKeysUsed,
        });
        return {
          variations: parsed.variations,
          allowlistKeysUsed: bundle.allowlistKeysUsed,
          cached: true,
          droppedRegenRounds: 0,
        };
      }
    } catch {
      /* continue */
    }
  }

  const [fewShot, liked] = await Promise.all([
    loadTopPostsFewShot(input.modelId),
    loadThumbsUpExamples(input.modelId, "caption"),
  ]);

  const avoid = persona.chatting.words_phrases_to_avoid ?? [];
  const redLines = persona.content.red_lines ?? "";

  let kept: string[] = [];
  let rounds = 0;

  while (kept.length < variationsN && rounds <= MAX_REGEN) {
    const need = variationsN - kept.length;
    const system = [
      "You write platform-safe social captions in the creator's voice.",
      PLATFORM_SAFE_SOCIAL_RULES,
      "Return ONLY a JSON array of strings (exact caption text, preserve emojis and line breaks).",
      `Language: ${lang}`,
      `Platform: ${input.platform}`,
      input.format ? `Format: ${input.format}` : "",
      `Hashtag count per caption: ~${hashtagCount}`,
      "Voice from persona writing fields below. Do not mention physique or intimate details.",
    ]
      .filter(Boolean)
      .join("\n");

    const user = [
      "PERSONA CONTEXT (allowlisted):",
      bundle.contextText || "(minimal)",
      fewShot.length ? `\nEXAMPLE PAST POSTS:\n${fewShot.map((c, i) => `${i + 1}. ${c}`).join("\n")}` : "",
      liked.length ? `\nLIKED PRIOR OUTPUTS:\n${liked.join("\n---\n")}` : "",
      input.ideaContext ? `\nIDEA / VIDEO CONTEXT:\n${input.ideaContext}` : "",
      input.toneTweak ? `\nTONE TWEAK: ${input.toneTweak}` : "",
      avoid.length ? `\nNEVER use these words/phrases: ${avoid.join(", ")}` : "",
      redLines ? `\nRED LINES (do not go near): ${redLines}` : "",
      `\nGenerate ${need} caption variation(s) as a JSON array of strings.`,
    ].join("\n");

    console.info("[creative-studio] captions generate", {
      modelId: input.modelId,
      feature: "creative_studio_captions",
      allowlistKeys: bundle.allowlistKeysUsed,
      round: rounds,
    });

    const result = await callAnthropic({
      messages: [{ role: "user", content: user }],
      system,
      maxTokens: 1200,
      temperature: 0.7,
      model: AI_FAST_MODEL,
      logLabel: "creative_studio_captions",
    });

    void logAiUsage({
      featureKey: "creative_studio_captions",
      model: result?.model ?? AI_FAST_MODEL,
      ok: Boolean(result?.text),
    });

    const arr = result?.text ? extractJsonArray(result.text) : null;
    const candidates = (arr ?? [])
      .map((x) => (typeof x === "string" ? x : String(x ?? "")))
      .map((s) => s.trim())
      .filter(Boolean);

    const filtered = filterSocialVariations(candidates, avoid, redLines);
    kept = [...kept, ...filtered.kept];
    if (filtered.droppedReasons.length) {
      console.info("[creative-studio] captions filtered", {
        modelId: input.modelId,
        dropped: filtered.droppedReasons,
      });
    }
    rounds += 1;
    if (!candidates.length) break;
  }

  const final = kept.slice(0, variationsN);
  await upsertAiFeatureCache({
    featureKey: "creative_studio_captions",
    cacheKey,
    contentText: JSON.stringify({ variations: final }),
    contextSnapshot: { allowlistKeys: bundle.allowlistKeysUsed, modelId: input.modelId },
    model: AI_FAST_MODEL,
  });

  return {
    variations: final,
    allowlistKeysUsed: bundle.allowlistKeysUsed,
    cached: false,
    droppedRegenRounds: Math.max(0, rounds - 1),
  };
}

export async function generateTextOnScreen(input: GenerateTextOnScreenInput): Promise<GenerateResult> {
  await assertCreativeRateLimit(input.userId);

  const loaded = await loadPersonaBundle(input.modelId);
  if ("error" in loaded && loaded.error) {
    return {
      variations: [],
      allowlistKeysUsed: [],
      cached: false,
      droppedRegenRounds: 0,
      generationDisabledReason: loaded.error,
    };
  }
  const { persona, bundle } = loaded as {
    persona: NonNullable<Awaited<ReturnType<typeof getPersonaByModelId>>>;
    bundle: ReturnType<typeof buildPersonaAiContext>;
  };

  const variationsN = Math.min(5, Math.max(1, input.variations ?? 3));
  const maxChars = Math.min(80, Math.max(12, input.maxChars ?? 40));
  const lang =
    input.outputLanguage?.trim() ||
    persona.personal_info.languages?.[0]?.language ||
    "English";

  const cacheKey = hashInput({
    f: "tos",
    m: input.modelId,
    idea: input.ideaContext ?? "",
    tone: input.toneTweak ?? "",
    n: variationsN,
    maxChars,
    lang,
    keys: bundle.allowlistKeysUsed,
    personaUpdated: persona.updated_at,
  });

  const cached = await getAiFeatureCache("creative_studio_tos", cacheKey);
  if (cached && Date.now() - new Date(cached.generated_at).getTime() < CACHE_TTL_MS) {
    try {
      const parsed = JSON.parse(cached.content_text) as { variations?: string[] };
      if (Array.isArray(parsed.variations) && parsed.variations.length) {
        return {
          variations: parsed.variations,
          allowlistKeysUsed: bundle.allowlistKeysUsed,
          cached: true,
          droppedRegenRounds: 0,
        };
      }
    } catch {
      /* continue */
    }
  }

  const liked = await loadThumbsUpExamples(input.modelId, "text_on_screen");
  const avoid = persona.chatting.words_phrases_to_avoid ?? [];
  const redLines = persona.content.red_lines ?? "";

  let kept: string[] = [];
  let rounds = 0;

  while (kept.length < variationsN && rounds <= MAX_REGEN) {
    const need = variationsN - kept.length;
    const system = [
      "You write short hook lines for on-screen text overlays (Reels / TikTok).",
      PLATFORM_SAFE_SOCIAL_RULES,
      `Max ${maxChars} characters per line. Punchy, scroll-stopping.`,
      "Return ONLY a JSON array of strings. Preserve emojis if natural.",
      `Language: ${lang}`,
    ].join("\n");

    const user = [
      "PERSONA CONTEXT:",
      bundle.contextText || "(minimal)",
      liked.length ? `\nLIKED EXAMPLES:\n${liked.join("\n")}` : "",
      input.ideaContext ? `\nCONTEXT:\n${input.ideaContext}` : "",
      input.toneTweak ? `\nTONE: ${input.toneTweak}` : "",
      avoid.length ? `\nNEVER use: ${avoid.join(", ")}` : "",
      `\nGenerate ${need} hook line(s) as JSON array.`,
    ].join("\n");

    console.info("[creative-studio] tos generate", {
      modelId: input.modelId,
      feature: "creative_studio_tos",
      allowlistKeys: bundle.allowlistKeysUsed,
      round: rounds,
    });

    const result = await callAnthropic({
      messages: [{ role: "user", content: user }],
      system,
      maxTokens: 600,
      temperature: 0.75,
      model: AI_FAST_MODEL,
      logLabel: "creative_studio_tos",
    });

    void logAiUsage({
      featureKey: "creative_studio_tos",
      model: result?.model ?? AI_FAST_MODEL,
      ok: Boolean(result?.text),
    });

    const arr = result?.text ? extractJsonArray(result.text) : null;
    const candidates = (arr ?? [])
      .map((x) => (typeof x === "string" ? x : String(x ?? "")))
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => (s.length > maxChars ? s.slice(0, maxChars).trim() : s));

    const filtered = filterSocialVariations(candidates, avoid, redLines);
    kept = [...kept, ...filtered.kept];
    rounds += 1;
    if (!candidates.length) break;
  }

  const final = kept.slice(0, variationsN);
  await upsertAiFeatureCache({
    featureKey: "creative_studio_tos",
    cacheKey,
    contentText: JSON.stringify({ variations: final }),
    contextSnapshot: { allowlistKeys: bundle.allowlistKeysUsed, modelId: input.modelId },
    model: AI_FAST_MODEL,
  });

  return {
    variations: final,
    allowlistKeysUsed: bundle.allowlistKeysUsed,
    cached: false,
    droppedRegenRounds: Math.max(0, rounds - 1),
  };
}

export async function listIdeas(modelId: string): Promise<CreativeIdea[]> {
  const sb = getSupabaseServiceClient();
  const { data, error } = await sb
    .from(IDEAS)
    .select("*")
    .eq("model_id", modelId)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw new Error(`listIdeas: ${error.message}`);
  return (data ?? []).map((r) => mapIdea(r as Record<string, unknown>));
}

export async function saveIdea(input: {
  model_id: string;
  idea_type: CreativeIdeaType;
  platform?: string;
  title?: string;
  content: string;
  meta?: Record<string, unknown>;
  userId: string;
}): Promise<CreativeIdea> {
  const sb = getSupabaseServiceClient();
  const { data, error } = await sb
    .from(IDEAS)
    .insert({
      model_id: input.model_id,
      idea_type: input.idea_type,
      platform: input.platform ?? "",
      title: input.title ?? "",
      content: input.content,
      meta: input.meta ?? {},
      created_by: input.userId,
    })
    .select("*")
    .single();
  if (error) throw new Error(`saveIdea: ${error.message}`);
  console.info("[creative-studio] idea saved", {
    ideaId: (data as { id?: string }).id,
    modelId: input.model_id,
    ideaType: input.idea_type,
  });
  return mapIdea(data as Record<string, unknown>);
}

export async function updateIdea(
  id: string,
  patch: Partial<{ is_favourite: boolean; thumbs: -1 | 0 | 1; title: string }>,
): Promise<CreativeIdea> {
  const sb = getSupabaseServiceClient();
  const { data, error } = await sb
    .from(IDEAS)
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw new Error(`updateIdea: ${error.message}`);
  return mapIdea(data as Record<string, unknown>);
}

export async function deleteIdea(id: string): Promise<void> {
  const sb = getSupabaseServiceClient();
  const { error } = await sb.from(IDEAS).delete().eq("id", id);
  if (error) throw new Error(`deleteIdea: ${error.message}`);
}

/** Push caption/TOS into a posting brief post row. */
export async function pushToPostingBrief(input: {
  briefId: string;
  postId?: string;
  caption?: string;
  text_on_screen?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const sb = getSupabaseServiceClient();
  if (input.postId) {
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (input.caption != null) patch.caption = input.caption;
    if (input.text_on_screen != null) patch.text_on_screen = input.text_on_screen;
    const { error } = await sb.from("posting_brief_posts").update(patch).eq("id", input.postId);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  }
  // Append new post to brief
  const { data: existing } = await sb
    .from("posting_brief_posts")
    .select("position")
    .eq("brief_id", input.briefId)
    .order("position", { ascending: false })
    .limit(1);
  const nextPos = Number((existing?.[0] as { position?: number } | undefined)?.position ?? -1) + 1;
  const { error } = await sb.from("posting_brief_posts").insert({
    brief_id: input.briefId,
    position: nextPos,
    caption: input.caption ?? "",
    text_on_screen: input.text_on_screen ?? null,
    video_name: "",
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export { extractJsonObject };
