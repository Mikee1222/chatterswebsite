import type {
  BillingCycleRecord,
  BillingCycleRevenueRecord,
  PaymentSubmissionRecord,
} from "@/types/client-portal";

export type CrmFeesScope = {
  monthMode: "selected" | "all";
  monthKey?: string;
  clientId?: string;
  modelId?: string;
};

export const toSafeNumber = (value: unknown, fallback = 0): number => {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
};

export const resolveCycleCurrency = (cycle: BillingCycleRecord): string | null => {
  const currency = cycle.currency;
  return currency ? String(currency) : null;
};

export const getCycleType = (cycle: BillingCycleRecord): "crm" | "chatting" => {
  const raw = String(cycle.kind || "").toLowerCase();
  if (raw.includes("crm")) return "crm";
  return "chatting";
};

export const getCycleAmountDue = (cycle: BillingCycleRecord): number => {
  if (cycle.kind === "crm_monthly" && typeof cycle.amount_crm === "number") {
    return cycle.amount_crm;
  }
  if (typeof cycle.amount_due === "number" && cycle.amount_due > 0) {
    return cycle.amount_due;
  }
  if (typeof cycle.total_fee_usd === "number" && cycle.total_fee_usd > 0) {
    return cycle.total_fee_usd;
  }
  return toSafeNumber(cycle.amount, 0);
};

export const getCycleAmountPaid = (cycle: BillingCycleRecord): number => {
  return toSafeNumber(cycle.amount_paid, 0);
};

export const sumByCurrency = (
  cycles: BillingCycleRecord[],
  valueSelector: (cycle: BillingCycleRecord) => number,
  currencyResolver: (cycle: BillingCycleRecord) => string | null = resolveCycleCurrency
): Map<string, number> => {
  const totals = new Map<string, number>();
  cycles.forEach((cycle) => {
    const amount = toSafeNumber(valueSelector(cycle), 0);
    if (!amount) return;
    const currency = currencyResolver(cycle);
    if (!currency) return;
    totals.set(currency, (totals.get(currency) || 0) + amount);
  });
  return totals;
};

export const filterCyclesByClientModel = (
  cycles: BillingCycleRecord[],
  clientId: string,
  modelId: string
): BillingCycleRecord[] => {
  let filtered = cycles;
  if (clientId && clientId !== "all") {
    filtered = filtered.filter((cycle) => cycle.client.includes(clientId));
  }
  if (modelId && modelId !== "all") {
    filtered = filtered.filter((cycle) => {
      const modelIds = cycle.model ?? [];
      return modelIds.includes(modelId);
    });
  }
  return filtered;
};

export const getMonthKeyFromDate = (dateString?: string): string | null => {
  if (!dateString) return null;
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return null;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
};

/** Month key from cycle period_start (YYYY-MM), matching admin billing filters. */
export const getMonthKeyFromCycle = (cycle: BillingCycleRecord): string | null => {
  const periodStart = cycle.period_start;
  if (!periodStart || periodStart.length < 7) return null;
  return periodStart.slice(0, 7);
};

export const cycleMatchesMonthKey = (
  cycle: BillingCycleRecord,
  monthKey: string
): boolean => getMonthKeyFromCycle(cycle) === monthKey;

export const feeFromRevenue = (revenue: BillingCycleRevenueRecord): number => {
  if (typeof revenue.fee_usd === "number" && Number.isFinite(revenue.fee_usd)) {
    return revenue.fee_usd;
  }
  return toSafeNumber(revenue.turnover_usd, 0) * (toSafeNumber(revenue.fee_percent, 0) / 100);
};

export const groupRevenuesByCycleId = (
  revenues: BillingCycleRevenueRecord[]
): Map<string, BillingCycleRevenueRecord[]> => {
  const map = new Map<string, BillingCycleRevenueRecord[]>();
  revenues.forEach((revenue) => {
    revenue.billing_cycle.forEach((cycleId) => {
      const current = map.get(cycleId) ?? [];
      current.push(revenue);
      map.set(cycleId, current);
    });
  });
  return map;
};

export const sumTurnoverFromRevenues = (
  revenues: BillingCycleRevenueRecord[]
): Map<string, number> => {
  const total = revenues.reduce((sum, revenue) => sum + toSafeNumber(revenue.turnover_usd, 0), 0);
  return total ? new Map([["USD", total]]) : new Map();
};

export const sumChattingFeesFromRevenues = (
  revenues: BillingCycleRevenueRecord[]
): Map<string, number> => {
  const total = revenues.reduce((sum, revenue) => sum + feeFromRevenue(revenue), 0);
  return total ? new Map([["USD", total]]) : new Map();
};

export const getCycleTurnoverUsd = (
  cycle: BillingCycleRecord,
  revenuesForCycle: BillingCycleRevenueRecord[]
): number => {
  if (revenuesForCycle.length > 0) {
    return revenuesForCycle.reduce((sum, revenue) => sum + toSafeNumber(revenue.turnover_usd, 0), 0);
  }
  return toSafeNumber(cycle.total_turnover_usd ?? cycle.model_turnover ?? 0, 0);
};

export const getCycleChattingFeeUsd = (
  cycle: BillingCycleRecord,
  revenuesForCycle: BillingCycleRevenueRecord[]
): number => {
  if (getCycleType(cycle) !== "chatting") return 0;
  if (revenuesForCycle.length > 0) {
    return revenuesForCycle.reduce((sum, revenue) => sum + feeFromRevenue(revenue), 0);
  }
  return getCycleAmountDue(cycle);
};

export const getLatestSubmissionForCycle = (
  submissions: PaymentSubmissionRecord[],
  cycleId: string
): PaymentSubmissionRecord | null => {
  if (!cycleId) return null;
  const linked = submissions.filter((submission) => submission.billing_cycle.includes(cycleId));
  if (linked.length === 0) return null;
  return linked
    .slice()
    .sort(
      (a, b) =>
        new Date(b.submitted_datetime).getTime() - new Date(a.submitted_datetime).getTime()
    )[0];
};

/** CRM monthly fees for partnership analytics. */
export function getCrmFeesTotal(
  crmCycles: BillingCycleRecord[],
  scope: CrmFeesScope
): Map<string, number> {
  let filtered = crmCycles.filter((c) => getCycleType(c) === "crm");
  if (scope.clientId && scope.clientId !== "all") {
    filtered = filtered.filter((cycle) => cycle.client.includes(scope.clientId!));
  }
  if (scope.monthMode === "selected" && scope.monthKey) {
    filtered = filtered.filter((cycle) => cycleMatchesMonthKey(cycle, scope.monthKey!));
  }
  return sumByCurrency(filtered, (cycle) =>
    toSafeNumber(cycle.amount_crm ?? cycle.amount_due ?? cycle.amount ?? 0, 0)
  );
}
