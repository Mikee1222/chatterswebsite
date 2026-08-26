/**
 * Programmatic fraud / anomaly detection on infloww_transactions + refunds.
 * AI explains WHY flags were raised using the computed numbers only.
 */

import {
  listCreatorRefunds,
  listCreatorTransactions,
  listLinkedCreatorModels,
  type CreatorRefundRow,
  type CreatorTransactionRow,
} from "@/services/infloww-creator-earnings";
import { resolveInflowwStatsRange } from "@/services/infloww-performance";

export type FraudAnomalyKind =
  | "refund_rate_spike"
  | "repeated_tx_pattern"
  | "amount_zscore"
  | "refund_burst";

export type FraudAnomalyFlag = {
  id: string;
  kind: FraudAnomalyKind;
  severity: "warn" | "critical";
  model_record_id: string;
  model_name: string;
  title: string;
  metrics: Record<string, number | string | null>;
  evidence: string[];
};

export type FraudAnomalyScanResult = {
  startYmd: string;
  endYmd: string;
  baselineStartYmd: string;
  baselineEndYmd: string;
  flags: FraudAnomalyFlag[];
  scanned_tx_count: number;
  scanned_refund_count: number;
};

function mean(nums: number[]): number {
  if (!nums.length) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function stdev(nums: number[]): number {
  if (nums.length < 2) return 0;
  const m = mean(nums);
  const v = nums.reduce((acc, n) => acc + (n - m) ** 2, 0) / (nums.length - 1);
  return Math.sqrt(v);
}

function zScore(value: number, sample: number[]): number | null {
  if (sample.length < 5) return null;
  const s = stdev(sample);
  if (s <= 0) return null;
  return (value - mean(sample)) / s;
}

function ymdDaysAgo(ymd: string, days: number): string {
  const d = new Date(`${ymd}T12:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

function refundRate(txCount: number, refundCount: number): number {
  if (txCount <= 0) return refundCount > 0 ? 1 : 0;
  return refundCount / txCount;
}

function groupByModel<T extends { model_record_id: string | null }>(rows: T[]): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const row of rows) {
    const id = (row.model_record_id ?? "").trim();
    if (!id) continue;
    const list = map.get(id) ?? [];
    list.push(row);
    map.set(id, list);
  }
  return map;
}

function detectRepeatedTxPatterns(
  modelId: string,
  modelName: string,
  txs: CreatorTransactionRow[],
): FraudAnomalyFlag[] {
  const flags: FraudAnomalyFlag[] = [];
  const byFanAmount = new Map<string, CreatorTransactionRow[]>();
  for (const tx of txs) {
    if (!tx.fan_id || tx.amount <= 0) continue;
    const type = (tx.type ?? "unknown").trim() || "unknown";
    const key = `${tx.fan_id}|${tx.amount.toFixed(2)}|${type}`;
    const list = byFanAmount.get(key) ?? [];
    list.push(tx);
    byFanAmount.set(key, list);
  }
  for (const [key, list] of byFanAmount) {
    if (list.length < 4) continue;
    const [fanId, amountStr, type] = key.split("|");
    const times = list
      .map((t) => (t.created_time ? new Date(t.created_time).getTime() : NaN))
      .filter((t) => Number.isFinite(t))
      .sort((a, b) => a - b);
    let tightCluster = false;
    for (let i = 0; i + 3 < times.length; i++) {
      if (times[i + 3]! - times[i]! <= 2 * 60 * 60 * 1000) {
        tightCluster = true;
        break;
      }
    }
    if (!tightCluster && list.length < 6) continue;
    flags.push({
      id: `repeat-tx:${modelId}:${fanId}:${amountStr}:${type}`,
      kind: "repeated_tx_pattern",
      severity: list.length >= 6 || tightCluster ? "critical" : "warn",
      model_record_id: modelId,
      model_name: modelName,
      title: `Repeated ${type} pattern on ${modelName}`,
      metrics: {
        fan_id: fanId ?? "",
        amount: Number(amountStr),
        type: type ?? "unknown",
        repeat_count: list.length,
        window_hours: tightCluster ? 2 : null,
      },
      evidence: [
        `${list.length} identical ${type} txs at $${amountStr} from fan ${fanId}`,
        tightCluster ? "At least 4 occurred within a 2-hour window" : "High repeat count over the scan window",
      ],
    });
  }
  return flags;
}

function detectAmountZScores(
  modelId: string,
  modelName: string,
  recent: CreatorTransactionRow[],
  baseline: CreatorTransactionRow[],
): FraudAnomalyFlag[] {
  const flags: FraudAnomalyFlag[] = [];
  const baselineAmounts = baseline.map((t) => t.amount).filter((n) => n > 0);
  if (baselineAmounts.length < 8) return flags;

  for (const tx of recent) {
    if (tx.amount <= 0) continue;
    const z = zScore(tx.amount, baselineAmounts);
    if (z == null || z < 3.5) continue;
    flags.push({
      id: `zscore:${modelId}:${tx.transaction_id}`,
      kind: "amount_zscore",
      severity: z >= 5 ? "critical" : "warn",
      model_record_id: modelId,
      model_name: modelName,
      title: `Outlier transaction amount on ${modelName}`,
      metrics: {
        transaction_id: tx.transaction_id,
        amount: tx.amount,
        z_score: Math.round(z * 100) / 100,
        baseline_mean: Math.round(mean(baselineAmounts) * 100) / 100,
        baseline_stdev: Math.round(stdev(baselineAmounts) * 100) / 100,
        type: tx.type ?? "unknown",
      },
      evidence: [
        `Tx ${tx.transaction_id} amount $${tx.amount.toFixed(2)} is z=${z.toFixed(2)} vs model baseline (n=${baselineAmounts.length})`,
      ],
    });
  }
  return flags;
}

function detectRefundRateSpike(
  modelId: string,
  modelName: string,
  recentTxs: CreatorTransactionRow[],
  recentRefunds: CreatorRefundRow[],
  baselineTxs: CreatorTransactionRow[],
  baselineRefunds: CreatorRefundRow[],
): FraudAnomalyFlag | null {
  const recentRate = refundRate(recentTxs.length, recentRefunds.length);
  const baselineRate = refundRate(baselineTxs.length, baselineRefunds.length);
  if (recentTxs.length < 8 || recentRefunds.length < 2) return null;
  const absoluteHigh = recentRate >= 0.15 && recentRefunds.length >= 3;
  const relativeSpike =
    baselineTxs.length >= 15 &&
    recentRate >= baselineRate * 2.5 &&
    recentRate - baselineRate >= 0.05;
  if (!absoluteHigh && !relativeSpike) return null;
  return {
    id: `refund-rate:${modelId}`,
    kind: "refund_rate_spike",
    severity: recentRate >= 0.25 || recentRefunds.length >= 8 ? "critical" : "warn",
    model_record_id: modelId,
    model_name: modelName,
    title: `Refund rate spike on ${modelName}`,
    metrics: {
      recent_tx_count: recentTxs.length,
      recent_refund_count: recentRefunds.length,
      recent_refund_rate: Math.round(recentRate * 1000) / 1000,
      baseline_tx_count: baselineTxs.length,
      baseline_refund_count: baselineRefunds.length,
      baseline_refund_rate: Math.round(baselineRate * 1000) / 1000,
    },
    evidence: [
      `Recent refund rate ${(recentRate * 100).toFixed(1)}% (${recentRefunds.length}/${recentTxs.length})`,
      `Baseline refund rate ${(baselineRate * 100).toFixed(1)}% (${baselineRefunds.length}/${baselineTxs.length})`,
    ],
  };
}

function detectRefundBurst(
  modelId: string,
  modelName: string,
  refunds: CreatorRefundRow[],
): FraudAnomalyFlag | null {
  if (refunds.length < 4) return null;
  const times = refunds
    .map((r) => (r.refund_time ? new Date(r.refund_time).getTime() : NaN))
    .filter((t) => Number.isFinite(t))
    .sort((a, b) => a - b);
  for (let i = 0; i + 3 < times.length; i++) {
    if (times[i + 3]! - times[i]! <= 6 * 60 * 60 * 1000) {
      const clusterAmount = refunds
        .filter((r) => {
          const t = r.refund_time ? new Date(r.refund_time).getTime() : NaN;
          return Number.isFinite(t) && t >= times[i]! && t <= times[i + 3]!;
        })
        .reduce((s, r) => s + r.payment_amount, 0);
      return {
        id: `refund-burst:${modelId}:${times[i]}`,
        kind: "refund_burst",
        severity: "critical",
        model_record_id: modelId,
        model_name: modelName,
        title: `Refund burst on ${modelName}`,
        metrics: {
          refunds_in_6h: 4,
          cluster_amount: Math.round(clusterAmount * 100) / 100,
        },
        evidence: [
          `At least 4 refunds within 6 hours (cluster ≈ $${clusterAmount.toFixed(2)})`,
        ],
      };
    }
  }
  return null;
}

/** Scan recent window vs prior baseline for anomaly flags. */
export async function computeFraudAnomalies(opts?: {
  /** Defaults to last 7 Athens days. */
  rangePreset?: "this_week" | "last_7_days" | "this_month";
}): Promise<FraudAnomalyScanResult> {
  const range = resolveInflowwStatsRange(opts?.rangePreset === "this_month" ? "this_month" : "this_week");
  const startYmd = range.startYmd;
  const endYmd = range.endYmd;
  const spanDays = Math.max(
    1,
    Math.round(
      (new Date(`${endYmd}T12:00:00Z`).getTime() - new Date(`${startYmd}T12:00:00Z`).getTime()) /
        (24 * 60 * 60 * 1000),
    ) + 1,
  );
  const baselineEndYmd = ymdDaysAgo(startYmd, 1);
  const baselineStartYmd = ymdDaysAgo(baselineEndYmd, spanDays - 1);

  const [{ linked }, recentTxs, recentRefunds, baselineTxs, baselineRefunds] = await Promise.all([
    listLinkedCreatorModels(),
    listCreatorTransactions({
      startYmd,
      endYmd,
      fetchAll: true,
      revenueOnly: true,
    }),
    listCreatorRefunds({ startYmd, endYmd, limit: 5000 }),
    listCreatorTransactions({
      startYmd: baselineStartYmd,
      endYmd: baselineEndYmd,
      fetchAll: true,
      revenueOnly: true,
    }),
    listCreatorRefunds({ startYmd: baselineStartYmd, endYmd: baselineEndYmd, limit: 5000 }),
  ]);

  const nameByModel = new Map(
    linked.map((l) => [l.modelRecordId, l.modelName || l.modelRecordId] as const),
  );
  const recentByModel = groupByModel(recentTxs);
  const refundsByModel = groupByModel(recentRefunds);
  const baselineTxByModel = groupByModel(baselineTxs);
  const baselineRefundByModel = groupByModel(baselineRefunds);

  const modelIds = new Set<string>([
    ...recentByModel.keys(),
    ...refundsByModel.keys(),
  ]);

  const flags: FraudAnomalyFlag[] = [];
  for (const modelId of modelIds) {
    const modelName = nameByModel.get(modelId) ?? modelId;
    const rTx = recentByModel.get(modelId) ?? [];
    const rRef = refundsByModel.get(modelId) ?? [];
    const bTx = baselineTxByModel.get(modelId) ?? [];
    const bRef = baselineRefundByModel.get(modelId) ?? [];

    const rate = detectRefundRateSpike(modelId, modelName, rTx, rRef, bTx, bRef);
    if (rate) flags.push(rate);
    const burst = detectRefundBurst(modelId, modelName, rRef);
    if (burst) flags.push(burst);
    flags.push(...detectRepeatedTxPatterns(modelId, modelName, rTx));
    flags.push(...detectAmountZScores(modelId, modelName, rTx, bTx));
  }

  flags.sort((a, b) => {
    if (a.severity !== b.severity) return a.severity === "critical" ? -1 : 1;
    return a.title.localeCompare(b.title);
  });

  return {
    startYmd,
    endYmd,
    baselineStartYmd,
    baselineEndYmd,
    flags: flags.slice(0, 40),
    scanned_tx_count: recentTxs.length,
    scanned_refund_count: recentRefunds.length,
  };
}
