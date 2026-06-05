import type { BillingCycleRecord } from "@/types/client-portal";

/** Resolve payable amount for a billing cycle. */
export function getCycleAmountDue(cycle: BillingCycleRecord): number {
  if (cycle.kind === "crm_monthly" && typeof cycle.amount_crm === "number") {
    return cycle.amount_crm;
  }
  if (typeof cycle.amount_due === "number" && cycle.amount_due > 0) {
    return cycle.amount_due;
  }
  if (typeof cycle.total_fee_usd === "number" && cycle.total_fee_usd > 0) {
    return cycle.total_fee_usd;
  }
  return cycle.amount;
}
