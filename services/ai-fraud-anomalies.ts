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
  | "notable_large_tx"
  | "refund_burst";

export type FraudAnomalySeverity = "critical" | "warn" | "notable";

export type FraudAnomalyFlag = {
  id: string;
  kind: FraudAnomalyKind;
  /** critical/warn = fraud-risk; notable = single large tx without corroboration (lower priority). */
  severity: FraudAnomalySeverity;
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

const SEVERITY_RANK: Record<FraudAnomalySeverity, number> = {
  critical: 0,
  warn: 1,
  notable: 2,
};

/** Z-score threshold for considering an amount "large" vs model baseline. */
const AMOUNT_Z_THRESHOLD = 3.5;
/** Short window for clustering large txs (corroborating frequency signal). */
const LARGE_TX_CLUSTER_MS = 2 * 60 * 60 * 1000;
/** How many large txs in the short window count as high frequency. */
const LARGE_TX_CLUSTER_MIN = 3;
/** Identical amount repeats from same fan (corroborating). */
const REPEAT_SAME_FAN_MIN = 2;
/** Amounts within this relative tolerance are treated as "seen" for the model. */
const SEEN_AMOUNT_TOLERANCE = 0.05;

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

function txTimeMs(tx: CreatorTransactionRow): number | null {
  if (!tx.created_time) return null;
  const t = new Date(tx.created_time).getTime();
  return Number.isFinite(t) ? t : null;
}

function amountsNear(a: number, b: number, tol = SEEN_AMOUNT_TOLERANCE): boolean {
  if (a <= 0 || b <= 0) return false;
  return Math.abs(a - b) / Math.max(a, b) <= tol;
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

type AmountCorroboration = {
  highFrequencyLarge: boolean;
  repeatedIdenticalFromFan: boolean;
  unprecedentedAmount: boolean;
  largeInWindow: number;
  sameFanAmountCount: number;
};

/** Exported for unit-style checks of tip false-positive rules. */
export function corroborateLargeAmount(
  tx: CreatorTransactionRow,
  recent: CreatorTransactionRow[],
  baselineAmounts: number[],
  z: number,
): AmountCorroboration {
  const t0 = txTimeMs(tx);
  let largeInWindow = 0;
  if (t0 != null) {
    for (const other of recent) {
      if (other.amount <= 0) continue;
      const t1 = txTimeMs(other);
      if (t1 == null) continue;
      if (Math.abs(t1 - t0) > LARGE_TX_CLUSTER_MS) continue;
      const oz = zScore(other.amount, baselineAmounts);
      // Count txs that are also large vs baseline (or this same high-z tx).
      if (oz != null && oz >= AMOUNT_Z_THRESHOLD) largeInWindow += 1;
    }
  }

  let sameFanAmountCount = 0;
  if (tx.fan_id) {
    for (const other of recent) {
      if (!other.fan_id || other.fan_id !== tx.fan_id) continue;
      if (amountsNear(other.amount, tx.amount, 0.01)) sameFanAmountCount += 1;
    }
  }

  const maxBaseline = baselineAmounts.length ? Math.max(...baselineAmounts) : 0;
  const neverSeenNear = !baselineAmounts.some((a) =>
    amountsNear(a, tx.amount, SEEN_AMOUNT_TOLERANCE),
  );
  // "Unprecedented" must be extreme — not a normal $100–200 tip the model simply hasn't logged yet.
  // Require never-seen AND at least 2× the largest baseline amount (or very high z).
  const unprecedentedAmount =
    baselineAmounts.length > 0 &&
    neverSeenNear &&
    z >= AMOUNT_Z_THRESHOLD &&
    (tx.amount >= maxBaseline * 2 || z >= 6);

  return {
    highFrequencyLarge: largeInWindow >= LARGE_TX_CLUSTER_MIN,
    repeatedIdenticalFromFan: sameFanAmountCount >= REPEAT_SAME_FAN_MIN,
    unprecedentedAmount,
    largeInWindow,
    sameFanAmountCount,
  };
}

/**
 * Large tips ($100–200) often score high z vs a tip-heavy model average.
 * Fraud-risk requires high z AND a corroborating signal; lone outliers are "notable" only.
 */
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
    if (z == null || z < AMOUNT_Z_THRESHOLD) continue;

    const corr = corroborateLargeAmount(tx, recent, baselineAmounts, z);
    const hasCorroboration =
      corr.highFrequencyLarge ||
      corr.repeatedIdenticalFromFan ||
      corr.unprecedentedAmount;

    const evidence: string[] = [
      `Tx ${tx.transaction_id} amount $${tx.amount.toFixed(2)} is z=${z.toFixed(2)} vs model baseline (n=${baselineAmounts.length})`,
    ];
    if (corr.highFrequencyLarge) {
      evidence.push(
        `${corr.largeInWindow} large txs (z≥${AMOUNT_Z_THRESHOLD}) within 2 hours`,
      );
    }
    if (corr.repeatedIdenticalFromFan) {
      evidence.push(
        `${corr.sameFanAmountCount} identical $${tx.amount.toFixed(2)} txs from the same fan in the scan window`,
      );
    }
    if (corr.unprecedentedAmount) {
      evidence.push(
        "Amount never seen for this model in baseline (±5%) and ≥2× max baseline (or z≥6)",
      );
    }

    if (hasCorroboration) {
      flags.push({
        id: `zscore:${modelId}:${tx.transaction_id}`,
        kind: "amount_zscore",
        severity: z >= 5 ? "critical" : "warn",
        model_record_id: modelId,
        model_name: modelName,
        title: `Suspicious outlier amount on ${modelName}`,
        metrics: {
          transaction_id: tx.transaction_id,
          amount: tx.amount,
          z_score: Math.round(z * 100) / 100,
          baseline_mean: Math.round(mean(baselineAmounts) * 100) / 100,
          baseline_stdev: Math.round(stdev(baselineAmounts) * 100) / 100,
          type: tx.type ?? "unknown",
          large_in_2h: corr.largeInWindow,
          same_fan_amount_count: corr.sameFanAmountCount,
          unprecedented: corr.unprecedentedAmount ? 1 : 0,
        },
        evidence,
      });
    } else {
      // Lower-priority tier: don't dilute refund fraud signals with tip noise.
      flags.push({
        id: `notable-tx:${modelId}:${tx.transaction_id}`,
        kind: "notable_large_tx",
        severity: "notable",
        model_record_id: modelId,
        model_name: modelName,
        title: `Notable large ${tx.type ?? "tx"} on ${modelName}`,
        metrics: {
          transaction_id: tx.transaction_id,
          amount: tx.amount,
          z_score: Math.round(z * 100) / 100,
          baseline_mean: Math.round(mean(baselineAmounts) * 100) / 100,
          baseline_stdev: Math.round(stdev(baselineAmounts) * 100) / 100,
          type: tx.type ?? "unknown",
        },
        evidence: [
          ...evidence,
          "No corroborating frequency/repeat/unprecedented signal — not elevated to fraud-risk",
        ],
      });
    }
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
    const ra = SEVERITY_RANK[a.severity];
    const rb = SEVERITY_RANK[b.severity];
    if (ra !== rb) return ra - rb;
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
