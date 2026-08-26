/**
 * Model churn risk — grounded in trailing revenue, IG reach/engagement,
 * Creator Status Log disconnects, and posting frequency drops.
 */

import { getTodayYmdAthens, addDaysAthensYmd } from "@/lib/airtable-datetime";
import { listAllModelss, getModelById } from "@/services/modelss";
import { listCreatorTransactions } from "@/services/infloww-creator-earnings";
import { queryClarioSuiteDailyInsights } from "@/services/clariosuite-sync";
import { listCreatorStatusLog } from "@/services/infloww-creator-status-log";
import { sumCreatorTxRevenueInAthensRange } from "@/lib/admin-home-dashboard";
import {
  NOTIFICATION_ENTITY,
  NOTIFICATION_EVENT,
  NOTIFICATION_PRIORITY,
} from "@/lib/notification-types";
import { EVENT_TYPE_TO_AIRTABLE } from "@/lib/notifications-schema";
import { notifyAdminsOnce } from "@/services/notification-service";
import { findExistingNotification } from "@/services/notifications";
import type { ModelRecord } from "@/types";

export type ChurnRiskLevel = "low" | "medium" | "high" | "insufficient";

export type ModelChurnRisk = {
  modelId: string;
  modelName: string;
  score: number | null;
  level: ChurnRiskLevel;
  label: string;
  signals: {
    revenueTrendPct: number | null;
    igReachTrendPct: number | null;
    igEngagementTrendPct: number | null;
    disconnectionCount: number;
    postingFrequencyDropPct: number | null;
  };
  reasons: string[];
};

function pctChange(recent: number, prior: number): number | null {
  if (prior <= 0 && recent <= 0) return null;
  if (prior <= 0) return recent > 0 ? 100 : null;
  return ((recent - prior) / prior) * 100;
}

function clampScore(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

function levelFromScore(score: number): Exclude<ChurnRiskLevel, "insufficient"> {
  if (score >= 70) return "high";
  if (score >= 40) return "medium";
  return "low";
}

function looksLikeDisconnect(before: string, after: string): boolean {
  const blob = `${before} ${after}`.toLowerCase();
  return /disconnect|unbind|2fa|logout|revok|offline|remove|expire|fail/.test(blob);
}

export async function computeModelChurnRisk(
  model: ModelRecord,
): Promise<ModelChurnRisk> {
  const today = getTodayYmdAthens();
  const recentStart = addDaysAthensYmd(today, -13);
  const priorStart = addDaysAthensYmd(today, -27);
  const priorEnd = addDaysAthensYmd(today, -14);
  const windowStart = priorStart;

  const reasons: string[] = [];
  let signalCount = 0;
  let score = 20; // baseline low risk when some data exists

  let revenueTrendPct: number | null = null;
  let igReachTrendPct: number | null = null;
  let igEngagementTrendPct: number | null = null;
  let disconnectionCount = 0;
  let postingFrequencyDropPct: number | null = null;

  // --- Revenue (Infloww transactions) ---
  if (model.infloww_creator_id?.trim()) {
    try {
      const txs = await listCreatorTransactions({
        modelRecordId: model.id,
        creatorInflowwId: model.infloww_creator_id.trim(),
        startYmd: windowStart,
        endYmd: today,
        fetchAll: true,
        revenueOnly: true,
      });
      const recentRev = sumCreatorTxRevenueInAthensRange(txs, recentStart, today);
      const priorRev = sumCreatorTxRevenueInAthensRange(txs, priorStart, priorEnd);
      if (recentRev > 0 || priorRev > 0) {
        signalCount += 1;
        revenueTrendPct = pctChange(recentRev, priorRev);
        if (revenueTrendPct != null) {
          if (revenueTrendPct <= -40) {
            score += 35;
            reasons.push(`Revenue down ${Math.abs(Math.round(revenueTrendPct))}% vs prior 2 weeks`);
          } else if (revenueTrendPct <= -20) {
            score += 20;
            reasons.push(`Revenue soft (${Math.round(revenueTrendPct)}% WoW-ish)`);
          } else if (revenueTrendPct >= 15) {
            score -= 10;
          }
        }
      }
    } catch {
      // ignore — treat as missing signal
    }
  }

  // --- IG reach / engagement / posting frequency ---
  try {
    const insights = await queryClarioSuiteDailyInsights({
      modelRecordId: model.id,
      startYmd: windowStart,
      endYmd: today,
    });
    if (insights.length >= 4) {
      signalCount += 1;
      const recent = insights.filter((r) => r.date >= recentStart);
      const prior = insights.filter((r) => r.date >= priorStart && r.date <= priorEnd);
      const sumReach = (rows: typeof insights) => rows.reduce((s, r) => s + r.reach, 0);
      const avgEng = (rows: typeof insights) => {
        const vals = rows
          .map((r) => r.engagement_rate)
          .filter((v): v is number => v != null && Number.isFinite(v));
        if (!vals.length) return 0;
        return vals.reduce((a, b) => a + b, 0) / vals.length;
      };
      const recentReach = sumReach(recent);
      const priorReach = sumReach(prior);
      igReachTrendPct = pctChange(recentReach, priorReach);
      if (igReachTrendPct != null) {
        if (igReachTrendPct <= -35) {
          score += 25;
          reasons.push(`IG reach down ${Math.abs(Math.round(igReachTrendPct))}%`);
        } else if (igReachTrendPct <= -15) {
          score += 12;
        }
      }
      const recentEng = avgEng(recent);
      const priorEng = avgEng(prior);
      igEngagementTrendPct = pctChange(recentEng, priorEng);
      if (igEngagementTrendPct != null && igEngagementTrendPct <= -25) {
        score += 15;
        reasons.push(`IG engagement down ${Math.abs(Math.round(igEngagementTrendPct))}%`);
      }

      // Posting proxy: days with views/interactions > 0
      const activeDays = (rows: typeof insights) =>
        rows.filter((r) => r.views > 0 || r.total_interactions > 0).length;
      const recentActive = activeDays(recent);
      const priorActive = activeDays(prior);
      postingFrequencyDropPct = pctChange(recentActive, priorActive);
      if (postingFrequencyDropPct != null && postingFrequencyDropPct <= -40) {
        score += 18;
        reasons.push("Posting / activity frequency dropped sharply");
      }
    }
  } catch {
    // ignore
  }

  // --- Creator Status Log disconnects ---
  try {
    const logs = await listCreatorStatusLog({
      modelId: model.id,
      startYmd: windowStart,
      endYmd: today,
      limit: 100,
    });
    const disconnects = logs.filter((row) =>
      looksLikeDisconnect(String(row.status_before ?? ""), String(row.status_after ?? "")),
    );
    disconnectionCount = disconnects.length;
    if (logs.length > 0) signalCount += 1;
    if (disconnectionCount >= 3) {
      score += 30;
      reasons.push(`${disconnectionCount} disconnect / auth events in 28 days`);
    } else if (disconnectionCount >= 1) {
      score += 12;
      reasons.push(`${disconnectionCount} disconnect / auth event(s) recently`);
    }
  } catch {
    // ignore
  }

  if (signalCount < 2) {
    return {
      modelId: model.id,
      modelName: model.model_name || "Model",
      score: null,
      level: "insufficient",
      label: "Not enough data yet",
      signals: {
        revenueTrendPct,
        igReachTrendPct,
        igEngagementTrendPct,
        disconnectionCount,
        postingFrequencyDropPct,
      },
      reasons: ["Need at least two trailing signals (revenue, IG, or status log)"],
    };
  }

  const finalScore = clampScore(score);
  const level = levelFromScore(finalScore);
  return {
    modelId: model.id,
    modelName: model.model_name || "Model",
    score: finalScore,
    level,
    label: level === "high" ? "High" : level === "medium" ? "Medium" : "Low",
    signals: {
      revenueTrendPct,
      igReachTrendPct,
      igEngagementTrendPct,
      disconnectionCount,
      postingFrequencyDropPct,
    },
    reasons: reasons.length ? reasons : ["Signals stable"],
  };
}

export async function getModelChurnRiskById(modelId: string): Promise<ModelChurnRisk | null> {
  const model = await getModelById(modelId);
  if (!model) return null;
  return computeModelChurnRisk(model);
}

export async function listAtRiskModels(limit = 8): Promise<ModelChurnRisk[]> {
  const models = await listAllModelss();
  const active = models.filter((m) => (m.status ?? "").toLowerCase() !== "inactive");
  // Cap compute for dashboard — prioritize models with infloww or IG link
  const candidates = active
    .filter((m) => m.infloww_creator_id || m.clariosuite_ig_user_id)
    .slice(0, 40);
  const results: ModelChurnRisk[] = [];
  for (const m of candidates) {
    try {
      results.push(await computeModelChurnRisk(m));
    } catch {
      // skip
    }
  }
  return results
    .filter((r) => r.level === "high" || r.level === "medium")
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, limit);
}

export async function notifyHighChurnIfNeeded(risk: ModelChurnRisk): Promise<void> {
  if (risk.level !== "high" || risk.score == null) return;
  const dedupeId = `churn-high:${risk.modelId}:${getTodayYmdAthens().slice(0, 7)}`;
  await notifyAdminsOnce(
    {
      event_type: NOTIFICATION_EVENT.MODEL_CHURN_HIGH_RISK,
      priority: NOTIFICATION_PRIORITY.HIGH,
      title: `High churn risk: ${risk.modelName}`,
      body: `Score ${risk.score}/100. ${risk.reasons.slice(0, 2).join(" · ")}`,
      entity_type: NOTIFICATION_ENTITY.MODEL,
      entity_id: risk.modelId,
      actor_name: "Churn Risk",
    },
    async (userId) => {
      // Dedupe per model per calendar month via synthetic entity lookup
      const hit = await findExistingNotification(
        userId,
        NOTIFICATION_ENTITY.MODEL,
        dedupeId,
        EVENT_TYPE_TO_AIRTABLE[NOTIFICATION_EVENT.MODEL_CHURN_HIGH_RISK] ??
          NOTIFICATION_EVENT.MODEL_CHURN_HIGH_RISK,
      );
      if (hit) return true;
      return findExistingNotification(
        userId,
        NOTIFICATION_ENTITY.MODEL,
        risk.modelId,
        EVENT_TYPE_TO_AIRTABLE[NOTIFICATION_EVENT.MODEL_CHURN_HIGH_RISK] ??
          NOTIFICATION_EVENT.MODEL_CHURN_HIGH_RISK,
      );
    },
  ).catch((err) => console.error("[churn-risk] notify failed", err));
}
