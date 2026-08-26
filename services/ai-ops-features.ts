/**
 * AI ops features (stages 1–6) — grounded in real app data via shared Anthropic util + cache.
 * Kept separate from ai-powered-features.ts to reduce merge conflicts with parallel agents.
 */

import {
  AI_ASSISTANT_MODEL,
  AI_FAST_MODEL,
  AI_GROUNDING_RULES,
  callAnthropic,
  callAnthropicVision,
  extractJsonArray,
  extractJsonObject,
} from "@/lib/ai-assistant";
import {
  getAiFeatureCache,
  isAiCacheStale,
  upsertAiFeatureCache,
} from "@/services/ai-feature-cache";
import {
  computeFraudAnomalies,
  type FraudAnomalyFlag,
  type FraudAnomalyScanResult,
} from "@/services/ai-fraud-anomalies";
import {
  getAdminInflowwPerformanceReport,
  resolveInflowwStatsRange,
} from "@/services/infloww-performance";
import { listLinkedCreatorModels } from "@/services/infloww-creator-earnings";
import { queryClarioSuiteTopPosts } from "@/services/clariosuite-sync";
import { getSpotChecks, getDailyReviews } from "@/services/marketing-reviews";
import { listMistakesForAdmin } from "@/services/chatter-mistakes";
import { computeCategoryTimeStats } from "@/services/task-category-timer";
import { getTodayYmdAthens } from "@/lib/airtable-datetime";

export const AI_OPS_FEATURE_KEYS = {
  FRAUD_ANOMALIES: "fraud_anomalies",
  SCHEDULE_OPTIMIZER: "schedule_optimizer",
  CAPTION_HASHTAGS: "caption_hashtags",
  WELLBEING_SIGNALS: "wellbeing_signals",
  PERFORMANCE_REVIEW: "performance_review",
  CONTENT_QUALITY: "content_quality",
} as const;

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;

export type AiOpsTextResult = {
  text: string;
  generated_at: string;
  cached: boolean;
  model: string | null;
};

function ymdDaysAgo(ymd: string, days: number): string {
  const d = new Date(`${ymd}T12:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

// ─── Stage 1: Fraud / Anomaly ───────────────────────────────────────────────

export type FraudAnomalyExplainResult = {
  scan: FraudAnomalyScanResult;
  explanations: Array<{ flag_id: string; explanation: string }>;
  summary: string;
  generated_at: string;
  cached: boolean;
  model: string | null;
};

export async function runFraudAnomalyDetection(opts?: {
  force?: boolean;
}): Promise<FraudAnomalyExplainResult> {
  const scan = await computeFraudAnomalies();
  const cacheKey = `${scan.startYmd}:${scan.endYmd}:${scan.flags.map((f) => f.id).join("|").slice(0, 180)}`;

  if (scan.flags.length === 0) {
    return {
      scan,
      explanations: [],
      summary: "No fraud/anomaly flags in the current window.",
      generated_at: new Date().toISOString(),
      cached: false,
      model: null,
    };
  }

  if (!opts?.force) {
    const cached = await getAiFeatureCache(AI_OPS_FEATURE_KEYS.FRAUD_ANOMALIES, cacheKey);
    if (cached && !isAiCacheStale(cached, DAY_MS)) {
      const snap = cached.context_snapshot as {
        explanations?: Array<{ flag_id: string; explanation: string }>;
      };
      return {
        scan,
        explanations: snap.explanations ?? [],
        summary: cached.content_text,
        generated_at: cached.generated_at,
        cached: true,
        model: cached.model,
      };
    }
  }

  const compactFlags = scan.flags.slice(0, 12).map((f) => ({
    id: f.id,
    kind: f.kind,
    severity: f.severity,
    model: f.model_name,
    title: f.title,
    metrics: f.metrics,
    evidence: f.evidence,
  }));

  const prompt = `You explain fraud/anomaly flags for an OnlyFans agency admin.
For EACH flag, write 1–2 sentences explaining WHY it was flagged using ONLY the provided metrics/evidence. Do not invent causes (no "likely chargeback rings" unless numbers support it).
Severity "notable" means a large transaction without corroborating fraud signals — describe it as noteworthy, not as confirmed fraud.
Then write a 1–2 sentence overall summary prioritizing refund-rate / refund-burst / repeated patterns over notable large tips.
Return JSON only (no markdown fences):
{"summary":"...","explanations":[{"flag_id":"...","explanation":"..."}]}
${AI_GROUNDING_RULES}
Window: ${scan.startYmd} → ${scan.endYmd} (baseline ${scan.baselineStartYmd} → ${scan.baselineEndYmd})
Scanned txs=${scan.scanned_tx_count}, refunds=${scan.scanned_refund_count}
Flags JSON:
${JSON.stringify(compactFlags)}`;

  const result = await callAnthropic({
    messages: [{ role: "user", content: prompt }],
    // Explanations for up to 12 flags need headroom; 900 truncated mid-JSON and leaked raw fences into the UI.
    maxTokens: 2200,
    temperature: 0.2,
    logLabel: "fraud-anomalies",
    model: AI_ASSISTANT_MODEL,
  });
  if (!result) throw new Error("Could not explain anomalies — check ANTHROPIC_API_KEY");

  const parsed = extractJsonObject(result.text);
  const explanations: Array<{ flag_id: string; explanation: string }> = [];
  const rawEx = parsed?.explanations;
  if (Array.isArray(rawEx)) {
    for (const item of rawEx) {
      if (!item || typeof item !== "object") continue;
      const row = item as Record<string, unknown>;
      const flag_id = typeof row.flag_id === "string" ? row.flag_id : "";
      const explanation = typeof row.explanation === "string" ? row.explanation.trim() : "";
      if (flag_id && explanation) explanations.push({ flag_id, explanation });
    }
  }
  const parsedSummary =
    typeof parsed?.summary === "string" ? parsed.summary.trim() : "";
  // Never dump truncated/fenced JSON into the card — prefer a clean fallback.
  const rawTrim = result.text.trim();
  const looksLikeRawJson =
    rawTrim.startsWith("```") ||
    rawTrim.startsWith("{") ||
    rawTrim.startsWith("[");
  const summary =
    parsedSummary ||
    (looksLikeRawJson
      ? `Detected ${scan.flags.length} anomaly flag(s) in the current window.`
      : rawTrim.slice(0, 400));

  const row = await upsertAiFeatureCache({
    featureKey: AI_OPS_FEATURE_KEYS.FRAUD_ANOMALIES,
    cacheKey,
    contentText: summary,
    contextSnapshot: { explanations, flag_ids: scan.flags.map((f) => f.id) },
    model: result.model,
  });

  return {
    scan,
    explanations,
    summary: row.content_text,
    generated_at: row.generated_at,
    cached: false,
    model: row.model,
  };
}

export function attachExplanationsToFlags(
  flags: FraudAnomalyFlag[],
  explanations: Array<{ flag_id: string; explanation: string }>,
): Array<FraudAnomalyFlag & { ai_explanation: string | null }> {
  const map = new Map(explanations.map((e) => [e.flag_id, e.explanation]));
  return flags.map((f) => ({ ...f, ai_explanation: map.get(f.id) ?? null }));
}

// ─── Stage 2: Schedule optimizer ────────────────────────────────────────────

export type ScheduleSuggestion = {
  chatter_id: string;
  chatter_name: string;
  model_ids: string[];
  model_names: string[];
  day: string;
  shift_type: string;
  rationale: string;
  score_hint: number | null;
};

export type ScheduleOptimizerResult = {
  week_start: string;
  suggestions: ScheduleSuggestion[];
  summary: string;
  generated_at: string;
  cached: boolean;
  model: string | null;
};

export async function generateScheduleOptimizerSuggestions(input: {
  week_start: string;
  force?: boolean;
}): Promise<ScheduleOptimizerResult> {
  const weekStart = input.week_start.slice(0, 10);
  const today = getTodayYmdAthens();
  const range = resolveInflowwStatsRange("custom", ymdDaysAgo(today, 29), today);
  const [{ linked }, report] = await Promise.all([
    listLinkedCreatorModels().catch(() => ({ linked: [] as Awaited<ReturnType<typeof listLinkedCreatorModels>>["linked"] })),
    getAdminInflowwPerformanceReport(range, { includeRoi: false }),
  ]);

  const availableModels = linked.slice(0, 40).map((l) => ({
    model_record_id: l.modelRecordId,
    model_name: l.modelName,
  }));

  const chatterRows = (report.chatters ?? []).slice(0, 25).map((c) => ({
    id: c.user_public_id,
    name: c.full_name || c.user_public_id,
    sales: c.totals.sales,
    revenue_per_hour: c.analytics?.revenue_per_hour ?? null,
    top_models: (c.by_performer ?? []).slice(0, 4).map((p) => ({
      performer_name: p.performer_name,
      sales: p.totals.sales,
    })),
  }));

  const snapshot = { week_start: weekStart, chatterRows, availableModels };
  // Week-stable key — sliding 30d window must not bust cache every calendar day.
  const cacheKey = weekStart;

  if (!input.force) {
    const cached = await getAiFeatureCache(AI_OPS_FEATURE_KEYS.SCHEDULE_OPTIMIZER, cacheKey);
    if (cached && !isAiCacheStale(cached, WEEK_MS)) {
      const snap = cached.context_snapshot as { suggestions?: ScheduleSuggestion[] };
      return {
        week_start: weekStart,
        suggestions: snap.suggestions ?? [],
        summary: cached.content_text,
        generated_at: cached.generated_at,
        cached: true,
        model: cached.model,
      };
    }
  }

  const prompt = `Suggest a weekly chatter schedule for an OnlyFans agency (suggestion-only; humans must confirm before creating shifts).
Use ONLY the performance JSON + available models list. Prefer assigning chatters to models where they historically made the most sales (match names to availableModels.model_record_id). Spread across Mon–Sun and shift types Morning/Afternoon/Night when data supports it.
If data is sparse, return fewer suggestions and say so in summary.
Return JSON only:
{"summary":"...","suggestions":[{"chatter_id":"...","chatter_name":"...","model_ids":["model_record_id"],"model_names":["..."],"day":"Monday","shift_type":"Afternoon","rationale":"...","score_hint":123.45}]}
Days must be Monday..Sunday. shift_type one of: Morning, Midday, Afternoon, Night, LateNight, Custom.
Max 12 suggestions. model_ids MUST be from availableModels.model_record_id only.
${AI_GROUNDING_RULES}
Target week starting Monday ${weekStart}.
Available models:
${JSON.stringify(availableModels)}
Performance window ${range.startYmd}→${range.endYmd}:
${JSON.stringify(chatterRows)}`;

  const result = await callAnthropic({
    messages: [{ role: "user", content: prompt }],
    maxTokens: 1200,
    temperature: 0.3,
    logLabel: "schedule-optimizer",
    model: AI_ASSISTANT_MODEL,
  });
  if (!result) throw new Error("Could not generate schedule suggestions — check ANTHROPIC_API_KEY");

  const parsed = extractJsonObject(result.text);
  const suggestions: ScheduleSuggestion[] = [];
  const raw = parsed?.suggestions;
  if (Array.isArray(raw)) {
    for (const item of raw) {
      if (!item || typeof item !== "object") continue;
      const row = item as Record<string, unknown>;
      const chatter_id = typeof row.chatter_id === "string" ? row.chatter_id : "";
      const chatter_name = typeof row.chatter_name === "string" ? row.chatter_name : "";
      if (!chatter_id || !chatter_name) continue;
      const model_ids = Array.isArray(row.model_ids)
        ? row.model_ids.filter((x): x is string => typeof x === "string" && Boolean(x.trim()))
        : [];
      const model_names = Array.isArray(row.model_names)
        ? row.model_names.filter((x): x is string => typeof x === "string" && Boolean(x.trim()))
        : [];
      const day = typeof row.day === "string" ? row.day : "";
      const shift_type = typeof row.shift_type === "string" ? row.shift_type : "";
      const rationale = typeof row.rationale === "string" ? row.rationale.trim() : "";
      const score_hint =
        typeof row.score_hint === "number" && Number.isFinite(row.score_hint)
          ? row.score_hint
          : null;
      if (!day || !shift_type || !rationale) continue;
      suggestions.push({
        chatter_id,
        chatter_name,
        model_ids,
        model_names,
        day,
        shift_type,
        rationale,
        score_hint,
      });
    }
  }

  const summary =
    (typeof parsed?.summary === "string" && parsed.summary.trim()) ||
    `Proposed ${suggestions.length} schedule assignments for week of ${weekStart}.`;

  const row = await upsertAiFeatureCache({
    featureKey: AI_OPS_FEATURE_KEYS.SCHEDULE_OPTIMIZER,
    cacheKey,
    contentText: summary,
    contextSnapshot: { ...snapshot, suggestions },
    model: result.model,
  });

  return {
    week_start: weekStart,
    suggestions,
    summary: row.content_text,
    generated_at: row.generated_at,
    cached: false,
    model: row.model,
  };
}

// ─── Stage 3: Caption / hashtag generator ───────────────────────────────────

export type CaptionIdea = {
  caption: string;
  hashtags: string[];
};

export type CaptionIdeasResult = {
  ideas: CaptionIdea[];
  grounded_post_count: number;
  generated_at: string;
  cached: boolean;
  model: string | null;
};

export async function generateCaptionHashtagIdeas(input: {
  modelRecordId: string;
  modelName?: string;
  topicHint?: string;
  force?: boolean;
}): Promise<CaptionIdeasResult> {
  const modelId = input.modelRecordId.trim();
  if (!modelId) throw new Error("modelRecordId required");

  const posts = await queryClarioSuiteTopPosts({ modelRecordId: modelId, limit: 8 });
  const grounded = posts.slice(0, 6).map((p) => ({
    caption: (p.caption ?? "").slice(0, 280),
    likes: p.likes,
    comments: p.comments,
    reach: p.reach,
    engagement_score: p.engagement_score,
    media_product_type: p.media_product_type,
  }));

  const cacheKey = `${modelId}:${(input.topicHint ?? "").slice(0, 40)}:${grounded.map((g) => g.caption.slice(0, 24)).join("|").slice(0, 120)}`;

  if (!input.force) {
    const cached = await getAiFeatureCache(AI_OPS_FEATURE_KEYS.CAPTION_HASHTAGS, cacheKey);
    if (cached && !isAiCacheStale(cached, WEEK_MS)) {
      const snap = cached.context_snapshot as { ideas?: CaptionIdea[] };
      return {
        ideas: snap.ideas ?? [],
        grounded_post_count: grounded.length,
        generated_at: cached.generated_at,
        cached: true,
        model: cached.model,
      };
    }
  }

  const prompt = `Generate 2–3 Instagram caption ideas with hashtags for model "${input.modelName ?? modelId}".
Ground style in the model's real top posts below. Do not invent brand claims or specific locations not present.
Return JSON only:
{"ideas":[{"caption":"...","hashtags":["#a","#b"]}]}
Each caption 1–3 sentences. 5–12 hashtags each. Topic hint: ${input.topicHint?.trim() || "(none)"}
${AI_GROUNDING_RULES}
Top posts:
${JSON.stringify(grounded.length ? grounded : [{ note: "No top posts on file — keep captions generic and say data was sparse." }])}`;

  const result = await callAnthropic({
    messages: [{ role: "user", content: prompt }],
    maxTokens: 600,
    temperature: 0.55,
    logLabel: "caption-hashtags",
    model: AI_FAST_MODEL,
  });
  if (!result) throw new Error("Could not generate captions — check ANTHROPIC_API_KEY");

  const parsed = extractJsonObject(result.text);
  const ideas: CaptionIdea[] = [];
  const raw = parsed?.ideas ?? extractJsonArray(result.text);
  if (Array.isArray(raw)) {
    for (const item of raw) {
      if (!item || typeof item !== "object") continue;
      const row = item as Record<string, unknown>;
      const caption = typeof row.caption === "string" ? row.caption.trim() : "";
      const hashtags = Array.isArray(row.hashtags)
        ? row.hashtags
            .filter((h): h is string => typeof h === "string")
            .map((h) => (h.startsWith("#") ? h : `#${h}`))
        : [];
      if (caption) ideas.push({ caption, hashtags });
    }
  }

  const row = await upsertAiFeatureCache({
    featureKey: AI_OPS_FEATURE_KEYS.CAPTION_HASHTAGS,
    cacheKey,
    contentText: ideas.map((i) => i.caption).join("\n---\n"),
    contextSnapshot: { ideas, grounded_post_count: grounded.length },
    model: result.model,
  });

  return {
    ideas: ideas.slice(0, 3),
    grounded_post_count: grounded.length,
    generated_at: row.generated_at,
    cached: false,
    model: row.model,
  };
}

// ─── Stage 4: Wellbeing / burnout early-warning (admin-only) ────────────────

export type WellbeingSignal = {
  person_id: string;
  person_name: string;
  role: "chatter" | "virtual_assistant" | "unknown";
  severity: "notable";
  headline: string;
  evidence: string[];
  ai_note: string | null;
};

export type WellbeingScanResult = {
  signals: WellbeingSignal[];
  summary: string;
  generated_at: string;
  cached: boolean;
  model: string | null;
};

export async function generateWellbeingEarlyWarnings(opts?: {
  force?: boolean;
}): Promise<WellbeingScanResult> {
  const today = getTodayYmdAthens();
  const from = ymdDaysAgo(today, 21);

  const [mistakes, spotChecks, dailyReviews] = await Promise.all([
    listMistakesForAdmin({ date_from: from, date_to: today }).catch(() => []),
    getSpotChecks({ date_from: from, date_to: today }).catch(() => []),
    getDailyReviews({ date_from: from, date_to: today }).catch(() => []),
  ]);

  type Bucket = {
    person_id: string;
    person_name: string;
    role: WellbeingSignal["role"];
    mistake_count: number;
    spot_count: number;
    note_snippets: string[];
  };
  const buckets = new Map<string, Bucket>();

  function touch(
    id: string,
    name: string,
    role: WellbeingSignal["role"],
    snippet: string | null,
    kind: "mistake" | "spot",
  ) {
    const key = id.trim();
    if (!key) return;
    const b = buckets.get(key) ?? {
      person_id: key,
      person_name: name || key,
      role,
      mistake_count: 0,
      spot_count: 0,
      note_snippets: [],
    };
    if (kind === "mistake") b.mistake_count += 1;
    else b.spot_count += 1;
    if (snippet?.trim() && b.note_snippets.length < 6) {
      b.note_snippets.push(snippet.trim().slice(0, 180));
    }
    buckets.set(key, b);
  }

  for (const m of mistakes) {
    const id = (m.chatter_id || m.va_id || "").trim();
    const name = (m.chatter_name || m.va_name || "Unknown").trim();
    const role: WellbeingSignal["role"] = m.chatter_id
      ? "chatter"
      : m.va_id
        ? "virtual_assistant"
        : "unknown";
    const text = [m.explanation, m.admin_notes, m.reason_label].filter(Boolean).join(" — ");
    touch(id, name, role, text, "mistake");
  }

  for (const s of spotChecks) {
    const id = (s.exec_va_id || s.manager_id || "").trim();
    const name = (s.exec_va_name || s.manager_name || "Unknown").trim();
    const text = [s.what_was_wrong, s.action_taken, s.subject].filter(Boolean).join(" — ");
    touch(id, name, "virtual_assistant", text, "spot");
  }

  const reviewSnippets = dailyReviews
    .slice(0, 12)
    .flatMap((r) =>
      [r.issues_found, r.actions_assigned]
        .filter((x): x is string => typeof x === "string" && Boolean(x.trim()))
        .map((t) => t.slice(0, 200)),
    );

  const candidates = [...buckets.values()]
    .filter((b) => b.mistake_count + b.spot_count >= 3)
    .sort((a, b) => b.mistake_count + b.spot_count - (a.mistake_count + a.spot_count))
    .slice(0, 8);

  if (candidates.length === 0) {
    return {
      signals: [],
      summary: "No notable wellbeing trends in the last 21 days based on mistakes/spot checks.",
      generated_at: new Date().toISOString(),
      cached: false,
      model: null,
    };
  }

  const cacheKey = `${from}:${today}:${candidates.map((c) => `${c.person_id}:${c.mistake_count}:${c.spot_count}`).join(",")}`;

  if (!opts?.force) {
    const cached = await getAiFeatureCache(AI_OPS_FEATURE_KEYS.WELLBEING_SIGNALS, cacheKey);
    if (cached && !isAiCacheStale(cached, DAY_MS)) {
      const snap = cached.context_snapshot as { signals?: WellbeingSignal[] };
      return {
        signals: snap.signals ?? [],
        summary: cached.content_text,
        generated_at: cached.generated_at,
        cached: true,
        model: cached.model,
      };
    }
  }

  const prompt = `You write PRIVATE admin-only check-in suggestions for agency managers.
Be CONSERVATIVE: only flag people with clear volume + supporting note themes. Never diagnose medical/mental conditions. Phrase as "worth a supportive check-in" with evidence counts.
This output must NEVER be shown to the person.
Return JSON only:
{"summary":"...","signals":[{"person_id":"...","person_name":"...","role":"chatter"|"virtual_assistant","headline":"...","evidence":["..."],"ai_note":"..."}]}
${AI_GROUNDING_RULES}
Candidates (21d):
${JSON.stringify(candidates)}
Daily review snippets (context only):
${JSON.stringify(reviewSnippets)}`;

  const result = await callAnthropic({
    messages: [{ role: "user", content: prompt }],
    maxTokens: 900,
    temperature: 0.2,
    logLabel: "wellbeing-signals",
    model: AI_ASSISTANT_MODEL,
  });
  if (!result) throw new Error("Could not generate wellbeing signals — check ANTHROPIC_API_KEY");

  const parsed = extractJsonObject(result.text);
  const signals: WellbeingSignal[] = [];
  const raw = parsed?.signals;
  if (Array.isArray(raw)) {
    for (const item of raw) {
      if (!item || typeof item !== "object") continue;
      const row = item as Record<string, unknown>;
      const person_id = typeof row.person_id === "string" ? row.person_id : "";
      const person_name = typeof row.person_name === "string" ? row.person_name : "";
      if (!person_id || !person_name) continue;
      const roleRaw = row.role === "virtual_assistant" ? "virtual_assistant" : "chatter";
      const evidence = Array.isArray(row.evidence)
        ? row.evidence.filter((e): e is string => typeof e === "string").slice(0, 5)
        : [];
      const headline =
        typeof row.headline === "string" ? row.headline.trim() : "Worth a supportive check-in";
      const ai_note = typeof row.ai_note === "string" ? row.ai_note.trim() : null;
      if (evidence.length === 0) continue;
      signals.push({
        person_id,
        person_name,
        role: roleRaw,
        severity: "notable",
        headline,
        evidence,
        ai_note,
      });
    }
  }

  const summary =
    (typeof parsed?.summary === "string" && parsed.summary.trim()) ||
    `${signals.length} private check-in signal(s) for admins only.`;

  const row = await upsertAiFeatureCache({
    featureKey: AI_OPS_FEATURE_KEYS.WELLBEING_SIGNALS,
    cacheKey,
    contentText: summary,
    contextSnapshot: { signals },
    model: result.model,
  });

  return {
    signals,
    summary: row.content_text,
    generated_at: row.generated_at,
    cached: false,
    model: row.model,
  };
}

// ─── Stage 5: Performance review generator ──────────────────────────────────

export type PerformanceReviewResult = {
  person_id: string;
  person_name: string;
  role: "chatter" | "virtual_assistant";
  period: { startYmd: string; endYmd: string };
  review_markdown: string;
  sections: Array<{ title: string; body: string }>;
  generated_at: string;
  cached: boolean;
  model: string | null;
};

export async function generatePerformanceReview(input: {
  personId: string;
  personName: string;
  role: "chatter" | "virtual_assistant";
  force?: boolean;
}): Promise<PerformanceReviewResult> {
  const today = getTodayYmdAthens();
  const range = resolveInflowwStatsRange("custom", ymdDaysAgo(today, 29), today);
  const personId = input.personId.trim();
  const personName = input.personName.trim() || personId;

  const [perfReport, mistakesRaw, timerStats] = await Promise.all([
    input.role === "chatter"
      ? getAdminInflowwPerformanceReport(range, {
          publicUserId: personId,
          includeRoi: false,
        }).catch(() => null)
      : Promise.resolve(null),
    listMistakesForAdmin({
      date_from: range.startYmd,
      date_to: range.endYmd,
      ...(input.role === "chatter" ? { chatter_id: personId } : {}),
    }).catch(() => []),
    input.role === "virtual_assistant"
      ? computeCategoryTimeStats({
          startYmd: range.startYmd,
          endYmd: range.endYmd,
          va_id: personId,
        }).catch(() => null)
      : Promise.resolve(null),
  ]);

  const mistakes =
    input.role === "virtual_assistant"
      ? mistakesRaw.filter((m) => m.va_id === personId)
      : mistakesRaw;

  const chatterRow = perfReport?.chatters?.find((c) => c.user_public_id === personId);
  const analytics = chatterRow?.analytics;

  const statsSnapshot = {
    role: input.role,
    period: range,
    performance: chatterRow
      ? {
          sales: chatterRow.totals.sales,
          tips: chatterRow.totals.tips,
          ppv_sales: chatterRow.totals.ppv_sales,
          messages_sent: chatterRow.totals.messages_sent,
          fans_chatted: chatterRow.totals.fans_chatted,
          golden_ratio: chatterRow.totals.golden_ratio,
          top_models: (chatterRow.by_performer ?? []).slice(0, 5).map((p) => ({
            name: p.performer_name,
            sales: p.totals.sales,
          })),
          revenue_per_hour: analytics?.revenue_per_hour ?? null,
          unlock_rate: analytics?.funnel?.unlock_rate ?? null,
          consistency_score: analytics?.consistency_score ?? null,
        }
      : null,
    mistakes: mistakes.slice(0, 15).map((m) => ({
      date: m.mistake_date,
      reason: m.reason_label,
      explanation: (m.explanation ?? "").slice(0, 160),
      status: m.status,
    })),
    task_timer: timerStats
      ? {
          total_tracked_seconds: timerStats.total_tracked_seconds,
          by_category: timerStats.by_category.slice(0, 8).map((c) => ({
            category: c.category,
            total_seconds: c.total_seconds,
            total_sessions: c.total_sessions,
          })),
        }
      : null,
  };

  // Week-stable key — avoid regenerating every day as the 30d window slides.
  const weekBucket = `${today.slice(0, 7)}-w${Math.ceil(Number(today.slice(8)) / 7)}`;
  const cacheKey = `${personId}:${weekBucket}`;
  if (!input.force) {
    const cached = await getAiFeatureCache(AI_OPS_FEATURE_KEYS.PERFORMANCE_REVIEW, cacheKey);
    if (cached && !isAiCacheStale(cached, WEEK_MS)) {
      const snap = cached.context_snapshot as {
        sections?: Array<{ title: string; body: string }>;
      };
      return {
        person_id: personId,
        person_name: personName,
        role: input.role,
        period: { startYmd: range.startYmd, endYmd: range.endYmd },
        review_markdown: cached.content_text,
        sections: snap.sections ?? [{ title: "Review", body: cached.content_text }],
        generated_at: cached.generated_at,
        cached: true,
        model: cached.model,
      };
    }
  }

  const prompt = `Write a structured performance review for ${personName} (${input.role}).
Use ONLY the stats JSON. No character judgments or fabricated anecdotes. If a section lacks data, say "Insufficient data".
Return JSON only:
{"sections":[{"title":"Overview","body":"..."},{"title":"Strengths","body":"..."},{"title":"Growth areas","body":"..."},{"title":"Mistakes & QA","body":"..."},{"title":"Next period focus","body":"..."}]}
${AI_GROUNDING_RULES}
Stats:
${JSON.stringify(statsSnapshot)}`;

  const result = await callAnthropic({
    messages: [{ role: "user", content: prompt }],
    maxTokens: 1100,
    temperature: 0.25,
    logLabel: "performance-review",
    model: AI_ASSISTANT_MODEL,
  });
  if (!result) throw new Error("Could not generate performance review — check ANTHROPIC_API_KEY");

  const parsed = extractJsonObject(result.text);
  const sections: Array<{ title: string; body: string }> = [];
  if (Array.isArray(parsed?.sections)) {
    for (const item of parsed!.sections as unknown[]) {
      if (!item || typeof item !== "object") continue;
      const row = item as Record<string, unknown>;
      const title = typeof row.title === "string" ? row.title.trim() : "";
      const body = typeof row.body === "string" ? row.body.trim() : "";
      if (title && body) sections.push({ title, body });
    }
  }
  if (sections.length === 0) {
    sections.push({ title: "Review", body: result.text.trim() });
  }

  const review_markdown = sections.map((s) => `## ${s.title}\n\n${s.body}`).join("\n\n");
  const row = await upsertAiFeatureCache({
    featureKey: AI_OPS_FEATURE_KEYS.PERFORMANCE_REVIEW,
    cacheKey,
    contentText: review_markdown,
    contextSnapshot: { sections, statsSnapshot },
    model: result.model,
  });

  return {
    person_id: personId,
    person_name: personName,
    role: input.role,
    period: { startYmd: range.startYmd, endYmd: range.endYmd },
    review_markdown: row.content_text,
    sections,
    generated_at: row.generated_at,
    cached: false,
    model: row.model,
  };
}

// ─── Stage 6 helpers used by content quality service ────────────────────────

export { AI_ASSISTANT_MODEL, AI_FAST_MODEL, callAnthropicVision };
