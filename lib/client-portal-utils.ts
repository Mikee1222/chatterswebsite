import type { BillingCycleRecord } from "@/types/client-portal";

/** Overdue deadline = period_end + 5 days. */
export function isBillingOverdue(periodEndISO: string, nowISO?: string): boolean {
  const end = new Date(periodEndISO);
  if (Number.isNaN(end.getTime())) return false;
  const deadline = new Date(end);
  deadline.setDate(deadline.getDate() + 5);
  const now = nowISO ? new Date(nowISO) : new Date();
  return now > deadline;
}

/** Chatting weekly due window: day after period_end through period_end + 5. */
export function getChattingWeeklyDueWindow(
  periodEnd: string | null | undefined
): { dueStart: string; dueEnd: string } | null {
  if (!periodEnd) return null;
  const pe = new Date(periodEnd);
  if (Number.isNaN(pe.getTime())) return null;
  const dueStart = new Date(pe);
  dueStart.setDate(dueStart.getDate() + 1);
  const dueEnd = new Date(pe);
  dueEnd.setDate(dueEnd.getDate() + 5);
  return {
    dueStart: dueStart.toISOString().slice(0, 10),
    dueEnd: dueEnd.toISOString().slice(0, 10),
  };
}

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
