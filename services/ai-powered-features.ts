/**
 * AI-powered feature generators — all grounded in real app data via callAnthropic.
 */

import { AI_ASSISTANT_MODEL, AI_GROUNDING_RULES, callAnthropic } from "@/lib/ai-assistant";
import { getTodayYmdAthens } from "@/lib/airtable-datetime";
import {
  getAiFeatureCache,
  isAiCacheStale,
  upsertAiFeatureCache,
} from "@/services/ai-feature-cache";

export const AI_FEATURE_KEYS = {
  ADMIN_HOME_BRIEFING: "admin_home_briefing",
  CLIENT_MONTHLY_REPORT: "client_monthly_report",
  SPOT_MISTAKE_PATTERNS: "spot_mistake_patterns",
  DAILY_REVIEW_SUMMARY: "daily_review_summary",
  NOTIFICATION_DIGEST: "notification_digest",
} as const;

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;
const MONTH_MS = 32 * DAY_MS;

export type AdminHomeBriefingSignals = {
  todayYmd: string;
  todaySalesUsd: number;
  sparklineWowPct: number | null;
  topChatterName: string;
  topChatterRevenue: number;
  topModelName: string;
  topModelRevenue: number;
  monthlyRevenue: number;
  pendingCustoms: number;
  activeChatterShifts: number;
  activeVaShifts: number;
  pendingApplications: number;
  pendingSpotChecks: number;
  dailyReviewTodayExists: boolean;
  dailyReviewVerified: number;
  dailyReviewFlagged: number;
  igNeedsAttentionCount: number;
  igNeedsAttentionModels: string[];
};

export async function generateAdminHomeBriefing(
  signals: AdminHomeBriefingSignals,
  opts?: { force?: boolean },
): Promise<{ text: string; generated_at: string; cached: boolean; model: string | null }> {
  const cacheKey = signals.todayYmd;
  if (!opts?.force) {
    const cached = await getAiFeatureCache(AI_FEATURE_KEYS.ADMIN_HOME_BRIEFING, cacheKey);
    if (cached && !isAiCacheStale(cached, DAY_MS)) {
      return { text: cached.content_text, generated_at: cached.generated_at, cached: true, model: cached.model };
    }
  }
  const prompt = `You write a short daily ops briefing for an OnlyFans agency admin dashboard.
Write 2–4 sentences summarizing today's operational picture.
${AI_GROUNDING_RULES}
- Mention revenue / top performers only when numbers are present and non-zero.
- Call out pending Applications, Spot Checks, Daily Review status, and IG Needs Attention when counts > 0.
- Plain prose. No bullets. No greeting.
Signals JSON:
${JSON.stringify(signals, null, 2)}`;
  const result = await callAnthropic({ messages: [{ role: "user", content: prompt }], maxTokens: 400, temperature: 0.25, logLabel: "admin-home-briefing" });
  if (!result) throw new Error("Could not generate briefing — check ANTHROPIC_API_KEY");
  const row = await upsertAiFeatureCache({ featureKey: AI_FEATURE_KEYS.ADMIN_HOME_BRIEFING, cacheKey, contentText: result.text, contextSnapshot: signals as unknown as Record<string, unknown>, model: result.model });
  return { text: row.content_text, generated_at: row.generated_at, cached: false, model: row.model };
}

export type SopChatChunk = { function_name: string; role_name: string; department_name: string; content: string };

export async function answerSopLibraryQuestion(input: {
  question: string;
  chunks: SopChatChunk[];
  history?: { role: "user" | "assistant"; content: string }[];
}): Promise<string> {
  const corpus = input.chunks.length === 0
    ? "(No SOP content available for this user.)"
    : input.chunks.map((c, i) => `[SOP ${i + 1}] Role: ${c.role_name} | Function: ${c.function_name} | Dept: ${c.department_name}\n${c.content}`).join("\n\n---\n\n");
  const system = `You are the SOP Library assistant for agency staff (VAs and chatters).
Answer ONLY using the SOP excerpts provided. If the answer is not covered, say clearly that it is not covered in the available SOPs and suggest asking a manager.
Do not invent policies, tools, or steps. Keep answers concise and practical. Quote the SOP function name when relevant.`;
  const messages = [...(input.history ?? []).slice(-6), { role: "user" as const, content: `SOP excerpts:\n${corpus}\n\nQuestion: ${input.question.trim()}` }];
  const result = await callAnthropic({ system, messages, maxTokens: 700, temperature: 0.2, logLabel: "sop-chat" });
  if (!result) throw new Error("Could not answer — check ANTHROPIC_API_KEY");
  return result.text;
}

export async function generateDailyReviewTeamSummary(input: {
  reviewId: string; reviewDate: string; teamSummary: Record<string, unknown>;
  flaggedItems: Array<Record<string, unknown>>; vaLeaderboard: Array<Record<string, unknown>>; force?: boolean;
}): Promise<{ text: string; generated_at: string; cached: boolean }> {
  const cacheKey = input.reviewId;
  if (!input.force) {
    const cached = await getAiFeatureCache(AI_FEATURE_KEYS.DAILY_REVIEW_SUMMARY, cacheKey);
    if (cached && !isAiCacheStale(cached, DAY_MS)) return { text: cached.content_text, generated_at: cached.generated_at, cached: true };
  }
  const snapshot = { review_date: input.reviewDate, team_summary: input.teamSummary, flagged_items: input.flaggedItems.slice(0, 40), va_leaderboard: input.vaLeaderboard.slice(0, 20) };
  const prompt = `You summarize a completed Daily Review for agency admins.
Write 3–5 sentences covering: verified vs flagged counts, notable VA flag patterns from the real per-item data, and anything that stands out. Plain prose.
${AI_GROUNDING_RULES}
Data JSON:
${JSON.stringify(snapshot, null, 2)}`;
  const result = await callAnthropic({ messages: [{ role: "user", content: prompt }], maxTokens: 500, temperature: 0.2, logLabel: "daily-review-summary" });
  if (!result) throw new Error("Could not generate summary — check ANTHROPIC_API_KEY");
  const row = await upsertAiFeatureCache({ featureKey: AI_FEATURE_KEYS.DAILY_REVIEW_SUMMARY, cacheKey, contentText: result.text, contextSnapshot: snapshot, model: result.model });
  return { text: row.content_text, generated_at: row.generated_at, cached: false };
}

export async function generateClientMonthlyReport(input: {
  clientId: string; yearMonth: string; clientName: string; modelNames: string[];
  inflowwSnapshot: Record<string, unknown>; igSnapshot: Record<string, unknown> | null; force?: boolean;
}): Promise<{ text: string; generated_at: string; cached: boolean }> {
  const cacheKey = `${input.clientId}:${input.yearMonth}`;
  if (!input.force) {
    const cached = await getAiFeatureCache(AI_FEATURE_KEYS.CLIENT_MONTHLY_REPORT, cacheKey);
    if (cached && !isAiCacheStale(cached, MONTH_MS)) return { text: cached.content_text, generated_at: cached.generated_at, cached: true };
  }
  const snapshot = { year_month: input.yearMonth, client_name: input.clientName, models: input.modelNames, infloww: input.inflowwSnapshot, instagram: input.igSnapshot };
  const prompt = `You write a monthly Gunzo Partnership performance narrative for a client (not internal staff).
Tone: warm, clear, client-facing. 4–8 short sentences. Explain results plainly without jargon dumps.
Cover OnlyFans/Infloww earnings highlights and Instagram signals when present.
Never invent figures. If IG data is missing, skip IG (do not invent).
${AI_GROUNDING_RULES}
Data JSON:
${JSON.stringify(snapshot, null, 2)}`;
  const result = await callAnthropic({ messages: [{ role: "user", content: prompt }], maxTokens: 800, temperature: 0.3, logLabel: "client-monthly-report" });
  if (!result) throw new Error("Could not generate report — check ANTHROPIC_API_KEY");
  const row = await upsertAiFeatureCache({ featureKey: AI_FEATURE_KEYS.CLIENT_MONTHLY_REPORT, cacheKey, contentText: result.text, contextSnapshot: snapshot, model: result.model });
  return { text: row.content_text, generated_at: row.generated_at, cached: false };
}

export async function generateSpotMistakePatterns(input: {
  subjectId: string; subjectName: string; subjectKind: "va" | "chatter" | "agency";
  spotChecks: Array<Record<string, unknown>>; mistakes: Array<Record<string, unknown>>; force?: boolean;
}): Promise<{ text: string; generated_at: string; cached: boolean }> {
  const weekKey = getTodayYmdAthens();
  const cacheKey = `${input.subjectKind}:${input.subjectId}:${weekKey.slice(0, 7)}-w${Math.ceil(Number(weekKey.slice(8)) / 7)}`;
  if (!input.force) {
    const cached = await getAiFeatureCache(AI_FEATURE_KEYS.SPOT_MISTAKE_PATTERNS, cacheKey);
    if (cached && !isAiCacheStale(cached, WEEK_MS)) return { text: cached.content_text, generated_at: cached.generated_at, cached: true };
  }
  const snapshot = { subject: { id: input.subjectId, name: input.subjectName, kind: input.subjectKind }, spot_checks: input.spotChecks.slice(0, 80), mistakes: input.mistakes.slice(0, 80) };
  const prompt = `You detect recurring patterns in Spot Checks and Mistakes for agency admins viewing a performance profile.
Write 3–6 sentences on recurring types, statuses, reasons, and severity — only from the records provided.
If there are few records, say the sample is small. Plain prose.
${AI_GROUNDING_RULES}
Data JSON:
${JSON.stringify(snapshot, null, 2)}`;
  const result = await callAnthropic({ messages: [{ role: "user", content: prompt }], maxTokens: 600, temperature: 0.2, logLabel: "spot-mistake-patterns" });
  if (!result) throw new Error("Could not generate patterns — check ANTHROPIC_API_KEY");
  const row = await upsertAiFeatureCache({ featureKey: AI_FEATURE_KEYS.SPOT_MISTAKE_PATTERNS, cacheKey, contentText: result.text, contextSnapshot: snapshot, model: result.model });
  return { text: row.content_text, generated_at: row.generated_at, cached: false };
}

export async function brainstormCreativeScript(input: {
  draftScript: string; brief?: string; caption?: string; videoType?: string; modelName?: string;
}): Promise<string> {
  const prompt = `You are a creative brainstorming assistant for short-form / UGC style scripts for OnlyFans creators.
Suggest 2–3 alternative angles or improvements based on the CURRENT DRAFT.
Assist the author — do not replace them. Be concrete and actionable. Use short bullets.
${AI_GROUNDING_RULES}
- Do not invent brand claims or facts not in the draft/brief/caption.
Context:
Model: ${input.modelName || "—"}
Video type: ${input.videoType || "—"}
Brief: ${input.brief?.trim() || "(none)"}
Caption/context: ${input.caption?.trim() || "(none)"}
Current draft:
"""
${input.draftScript.trim() || "(empty)"}
"""`;
  const result = await callAnthropic({ messages: [{ role: "user", content: prompt }], maxTokens: 700, temperature: 0.5, logLabel: "creative-script-brainstorm" });
  if (!result) throw new Error("Could not brainstorm — check ANTHROPIC_API_KEY");
  return result.text;
}

export async function generateNotificationDigestText(input: {
  userId: string; ymd: string;
  notifications: Array<{ title: string; body: string; event_type: string; created_at: string }>;
}): Promise<string> {
  const prompt = `Summarize today's in-app notifications for this user in 3–4 sentences.
Only use the listed notifications (already filtered to enabled categories).
Group themes briefly. If the list is empty, say there was little activity today.
${AI_GROUNDING_RULES}
Notifications JSON:
${JSON.stringify(input.notifications.slice(0, 80), null, 2)}`;
  const result = await callAnthropic({ messages: [{ role: "user", content: prompt }], maxTokens: 400, temperature: 0.25, logLabel: "notification-digest" });
  if (!result) throw new Error("Could not generate digest — check ANTHROPIC_API_KEY");
  return result.text;
}

export async function generateWinnerVideoCreativeBrief(input: {
  caption?: string; adminInstructions?: string; qualityRating?: string; modelName?: string; researchNotes?: string;
}): Promise<string> {
  const prompt = `Write a starting creative script brief for a Winner/Super Winner video that was just approved and assigned to a creative.
Output plain editable brief text (short paragraphs or bullets) the creative can revise.
Base it ONLY on the caption/context provided. Do not invent filming locations, props, or claims not present.
${AI_GROUNDING_RULES}
Model: ${input.modelName || "—"}
Quality rating: ${input.qualityRating || "—"}
Admin instructions: ${input.adminInstructions?.trim() || "(none)"}
Research notes: ${input.researchNotes?.trim() || "(none)"}
Caption / context:
"""
${input.caption?.trim() || "(none)"}
"""`;
  const result = await callAnthropic({ messages: [{ role: "user", content: prompt }], maxTokens: 600, temperature: 0.35, logLabel: "winner-creative-brief" });
  if (!result) throw new Error("Could not generate brief — check ANTHROPIC_API_KEY");
  return result.text;
}

export async function draftSopFromBullets(input: {
  title: string; bullets: string; roleName?: string; departmentName?: string;
}): Promise<string> {
  const prompt = `You help admins draft SOP (Standard Operating Procedure) content from rough bullets.
Produce structured markdown suitable for an SOP library: short intro, numbered steps, and optional notes/checklist.
Never invent tools, policies, or metrics not implied by the bullets. Mark gaps as "[TO CONFIRM]".
This is a DRAFT for admin review — do not claim it is published.
Title: ${input.title.trim() || "Untitled SOP"}
Role: ${input.roleName || "—"}
Department: ${input.departmentName || "—"}
Bullets / notes:
"""
${input.bullets.trim()}
"""`;
  const result = await callAnthropic({ messages: [{ role: "user", content: prompt }], maxTokens: 2000, temperature: 0.3, logLabel: "sop-draft" });
  if (!result) throw new Error("Could not draft SOP — check ANTHROPIC_API_KEY");
  return result.text;
}

export { AI_ASSISTANT_MODEL };
