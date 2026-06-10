import type { BillingCycleStatus, PaymentSubmissionStatus } from "@/types/client-portal";

const KNOWN_CYCLE_STATUSES = new Set<string>([
  "draft",
  "announced",
  "pending_review",
  "confirmed_paid",
  "overdue",
]);

const KNOWN_SUBMISSION_STATUSES = new Set<string>([
  "pending_review",
  "approved",
  "rejected",
]);

export function normalizeBillingCycleStatus(status?: string | null): BillingCycleStatus {
  if (!status) return "draft";
  if (status === "confirmed_paid") return "confirmed_paid";
  if (KNOWN_CYCLE_STATUSES.has(status)) return status as BillingCycleStatus;
  return "draft";
}

export function getStatusLabel(status?: string | null): string {
  const normalized = normalizeBillingCycleStatus(status);
  switch (normalized) {
    case "announced":
      return "Announced";
    case "overdue":
      return "Overdue";
    case "pending_review":
      return "Pending review";
    case "confirmed_paid":
      return "Paid";
    case "draft":
    default:
      return "Draft";
  }
}

export function getStatusTone(status?: string | null): string {
  const normalized = normalizeBillingCycleStatus(status);
  switch (normalized) {
    case "confirmed_paid":
      return "text-emerald-300 bg-emerald-500/10 border-emerald-500/30";
    case "pending_review":
      return "text-yellow-300 bg-yellow-500/10 border-yellow-500/30";
    case "overdue":
      return "text-red-300 bg-red-500/10 border-red-500/30";
    case "announced":
      return "text-violet-300 bg-violet-500/10 border-violet-500/30";
    case "draft":
    default:
      return "text-gray-400 bg-gray-400/10 border-gray-400/30";
  }
}

export function normalizeSubmissionStatus(status?: string | null): PaymentSubmissionStatus | null {
  if (!status) return null;
  if (KNOWN_SUBMISSION_STATUSES.has(status)) return status as PaymentSubmissionStatus;
  return null;
}

export function getSubmissionStatusLabel(status?: string | null): string {
  const normalized = normalizeSubmissionStatus(status);
  switch (normalized) {
    case "approved":
      return "Approved";
    case "rejected":
      return "Rejected";
    case "pending_review":
      return "Pending review";
    default:
      return "Pending review";
  }
}

export function getSubmissionStatusTone(status?: string | null): string {
  const normalized = normalizeSubmissionStatus(status);
  switch (normalized) {
    case "approved":
      return "text-emerald-300 bg-emerald-500/10 border-emerald-500/30";
    case "rejected":
      return "text-red-300 bg-red-500/10 border-red-500/30";
    case "pending_review":
      return "text-yellow-300 bg-yellow-500/10 border-yellow-500/30";
    default:
      return "text-yellow-300 bg-yellow-500/10 border-yellow-500/30";
  }
}

export function canSubmitPayment(
  billingCycleStatus?: BillingCycleStatus | string | null,
  existingSubmissionStatus?: PaymentSubmissionStatus | string | null
): boolean {
  const submissionStatus = normalizeSubmissionStatus(existingSubmissionStatus ?? undefined);
  if (submissionStatus && submissionStatus !== "rejected") {
    return false;
  }
  const normalized = normalizeBillingCycleStatus(billingCycleStatus ?? undefined);
  if (!submissionStatus && normalized === "pending_review") return false;
  if (normalized === "confirmed_paid") return false;
  return true;
}

export function isPendingReviewStatus(status?: string | null): boolean {
  return normalizeBillingCycleStatus(status) === "pending_review";
}

/** Effective cycle status for UI when a payment submission may override billing_cycles.status. */
export function resolveCycleDisplayStatus(
  cycleStatus?: BillingCycleStatus | string | null,
  latestSubmissionStatus?: PaymentSubmissionStatus | string | null
): BillingCycleStatus {
  const submissionStatus = normalizeSubmissionStatus(latestSubmissionStatus ?? undefined);
  if (submissionStatus === "approved") return "confirmed_paid";
  if (submissionStatus === "pending_review") return "pending_review";
  return normalizeBillingCycleStatus(cycleStatus);
}
