"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  Bell,
  Building2,
  CheckCircle2,
  ChevronDown,
  Clock,
  FileText,
  MessageSquare,
  Receipt,
} from "lucide-react";
import { formatDate, formatDateTime, formatDateYmd } from "@/lib/format-date";
import { ROUTES } from "@/lib/routes";
import { cn } from "@/lib/utils";
import type {
  BillingCycleKind,
  BillingCycleRecord,
  PaymentSubmissionRecord,
} from "@/types/client-portal";
import { getCycleAmountDue } from "@/lib/client-portal-utils";
import { RefreshButton } from "@/components/client-portal/refresh-button";

type CycleRow = BillingCycleRecord & {
  latestSubmission: PaymentSubmissionRecord | null;
};

type Props = {
  cycles: CycleRow[];
};

const TYPE_FILTERS: { value: "all" | BillingCycleKind; label: string }[] = [
  { value: "all", label: "All" },
  { value: "chatting_weekly", label: "Chatting Weekly" },
  { value: "crm_monthly", label: "CRM Monthly" },
];

const STATUS_FILTERS: { value: string; label: string }[] = [
  { value: "all", label: "All" },
  { value: "confirmed_paid", label: "Paid" },
  { value: "pending_review", label: "Pending Review" },
  { value: "approved", label: "Approved" },
  { value: "overdue", label: "Overdue" },
  { value: "draft", label: "Draft" },
];

function kindLabel(kind: BillingCycleKind): string {
  return kind === "chatting_weekly" ? "Chatting Weekly" : "CRM Monthly";
}

function formatAmount(amount: number, currency: string): string {
  return `${new Intl.NumberFormat("en-GB", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)} ${currency}`;
}

function formatPeriod(start: string, end: string): string {
  return `${formatDateYmd(start)} – ${formatDateYmd(end)}`;
}

function resolveDisplay(row: CycleRow) {
  const sub = row.latestSubmission;
  if (sub?.status === "approved") {
    return {
      displayStatus: "Approved",
      tone: "text-emerald-300 bg-emerald-500/10 border-emerald-500/30",
      icon: CheckCircle2,
    };
  }
  if (sub?.status === "pending_review") {
    return {
      displayStatus: "Pending Review",
      tone: "text-yellow-300 bg-yellow-500/10 border-yellow-500/30",
      icon: Clock,
    };
  }
  if (sub?.status === "rejected") {
    return {
      displayStatus: "Rejected",
      tone: "text-red-300 bg-red-500/10 border-red-500/30",
      icon: AlertCircle,
    };
  }
  if (row.status === "confirmed_paid") {
    return {
      displayStatus: "Paid",
      tone: "text-emerald-300 bg-emerald-500/10 border-emerald-500/30",
      icon: CheckCircle2,
    };
  }
  if (row.status === "overdue") {
    return {
      displayStatus: "Overdue",
      tone: "text-red-300 bg-red-500/10 border-red-500/30",
      icon: AlertCircle,
    };
  }
  if (row.status === "announced") {
    return {
      displayStatus: "Announced",
      tone: "text-blue-300 bg-blue-500/10 border-blue-500/30",
      icon: Bell,
    };
  }
  if (row.status === "draft") {
    return {
      displayStatus: "Draft",
      tone: "text-white/60 bg-white/5 border-white/10",
      icon: FileText,
    };
  }
  return {
    displayStatus: row.status.replace(/_/g, " "),
    tone: "text-white/60 bg-white/5 border-white/10",
    icon: FileText,
  };
}

function StatusBadge({ row }: { row: CycleRow }) {
  const { displayStatus, tone, icon: Icon } = resolveDisplay(row);
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium leading-none",
        tone
      )}
    >
      <Icon className="h-3 w-3 shrink-0" />
      <span className="hidden sm:inline">{displayStatus}</span>
    </span>
  );
}

function FilterPill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1.5 text-xs font-medium transition",
        active
          ? "border-pink-500/30 bg-pink-500/20 text-pink-300"
          : "border-white/10 bg-white/5 text-white/50 hover:text-white"
      )}
    >
      {children}
    </button>
  );
}

export function ClientPaymentHistoryClient({ cycles }: Props) {
  const [filterKind, setFilterKind] = useState<"all" | BillingCycleKind>("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return cycles.filter((row) => {
      if (filterKind !== "all" && row.kind !== filterKind) return false;
      if (filterStatus === "all") return true;
      if (filterStatus === "pending_review") {
        return (
          row.latestSubmission?.status === "pending_review" ||
          row.status === "pending_review"
        );
      }
      return row.status === filterStatus || row.latestSubmission?.status === filterStatus;
    });
  }, [cycles, filterKind, filterStatus]);

  const pendingCount = cycles.filter(
    (c) =>
      c.status === "announced" ||
      c.status === "overdue" ||
      c.status === "pending_review"
  ).length;

  const paidCount = cycles.filter((c) => c.status === "confirmed_paid").length;

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  return (
    <div className="space-y-6 pb-20 md:pb-0">
      <div className="mb-6 flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-pink-300/80">Finance</p>
          <h1 className="mt-1 text-3xl font-bold text-white">Payment History</h1>
          <p className="mt-1 text-sm text-white/40">All billing cycles and submissions</p>
        </div>
        <RefreshButton />
      </div>

      {cycles.length > 0 && (
        <div className="mb-6 grid grid-cols-3 gap-3">
          <div className="glass-card p-4 text-center">
            <p className="text-2xl font-bold text-white">{cycles.length}</p>
            <p className="mt-1 text-xs text-white/40">Total Cycles</p>
          </div>
          <div className="glass-card p-4 text-center">
            <p className="text-2xl font-bold text-emerald-400">{paidCount}</p>
            <p className="mt-1 text-xs text-white/40">Paid</p>
          </div>
          <div className="glass-card p-4 text-center">
            <p className="text-2xl font-bold text-yellow-400">{pendingCount}</p>
            <p className="mt-1 text-xs text-white/40">Pending</p>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[10px] font-medium uppercase tracking-wide text-white/35">Type</span>
        {TYPE_FILTERS.map(({ value, label }) => (
          <FilterPill
            key={value}
            active={filterKind === value}
            onClick={() => setFilterKind(value)}
          >
            {label}
          </FilterPill>
        ))}
        <span className="ml-1 text-[10px] font-medium uppercase tracking-wide text-white/35">
          Status
        </span>
        {STATUS_FILTERS.map(({ value, label }) => (
          <FilterPill
            key={value}
            active={filterStatus === value}
            onClick={() => setFilterStatus(value)}
          >
            {label}
          </FilterPill>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="glass-card space-y-3 p-16 text-center">
          <Receipt className="mx-auto h-12 w-12 text-white/10" />
          <p className="font-medium text-white/40">No payment history yet</p>
          <p className="text-xs text-white/25">Your billing cycles will appear here</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((row) => {
            const amount =
              row.latestSubmission?.submitted_amount ?? getCycleAmountDue(row);
            const currency =
              row.latestSubmission?.submitted_currency ?? row.currency;
            const isExpanded = expandedId === row.id;
            const isChatting = row.kind === "chatting_weekly";
            const canPayNow = row.status === "announced" || row.status === "overdue";
            const payHref =
              row.kind === "chatting_weekly"
                ? ROUTES.client.payChatting
                : ROUTES.client.payCrm;

            return (
              <div
                key={row.id}
                className="glass-card cursor-pointer p-3 transition-colors hover:bg-white/[0.04] sm:p-4"
                onClick={() => toggleExpand(row.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    toggleExpand(row.id);
                  }
                }}
                role="button"
                tabIndex={0}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div
                    className={cn(
                      "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border sm:h-10 sm:w-10",
                      isChatting
                        ? "border-pink-500/20 bg-pink-500/15"
                        : "border-violet-500/20 bg-violet-500/15"
                    )}
                  >
                    {isChatting ? (
                      <MessageSquare className="h-4 w-4 text-pink-400 sm:h-5 sm:w-5" />
                    ) : (
                      <Building2 className="h-4 w-4 text-violet-400 sm:h-5 sm:w-5" />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-white sm:text-base">
                      {kindLabel(row.kind)}
                    </p>
                    <p className="truncate text-xs text-white/40">
                      {formatPeriod(row.period_start, row.period_end)}
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
                    <p className="whitespace-nowrap text-sm font-semibold tabular-nums text-white">
                      {formatAmount(amount, currency)}
                    </p>
                    <StatusBadge row={row} />
                    <ChevronDown
                      className={cn(
                        "h-4 w-4 shrink-0 text-white/30 transition-transform",
                        isExpanded && "rotate-180"
                      )}
                    />
                  </div>
                </div>

                {isExpanded && (
                  <div
                    className="mt-3 space-y-3 border-t border-white/8 pt-3"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="grid grid-cols-2 gap-3 rounded-xl bg-white/[0.03] p-3 text-sm">
                      <div>
                        <p className="text-[10px] font-medium uppercase tracking-wide text-white/35">
                          Due date
                        </p>
                        <p className="mt-0.5 font-medium text-white">{formatDate(row.due_date)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-medium uppercase tracking-wide text-white/35">
                          Status
                        </p>
                        <p className="mt-0.5 font-medium capitalize text-white">
                          {resolveDisplay(row).displayStatus}
                        </p>
                      </div>
                    </div>

                    {row.latestSubmission && (
                      <div className="space-y-2 rounded-xl border border-white/8 bg-white/[0.02] p-3">
                        <p className="text-[10px] font-medium uppercase tracking-wide text-white/35">
                          Submission
                        </p>
                        <div className="space-y-1.5 text-sm">
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-white/40">Submitted</span>
                            <span className="text-right text-white">
                              {formatDateTime(row.latestSubmission.submitted_datetime)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-white/40">Amount paid</span>
                            <span className="text-right tabular-nums text-white">
                              {formatAmount(
                                row.latestSubmission.submitted_amount,
                                row.latestSubmission.submitted_currency
                              )}
                            </span>
                          </div>
                          {row.latestSubmission.reference_id && (
                            <div className="flex items-center justify-between gap-3">
                              <span className="text-white/40">Reference</span>
                              <span className="truncate text-right text-white">
                                {row.latestSubmission.reference_id}
                              </span>
                            </div>
                          )}
                          {row.latestSubmission.note && (
                            <div className="rounded-lg bg-white/5 px-3 py-2 text-xs text-white/60">
                              {row.latestSubmission.note}
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {row.latestSubmission?.admin_note && (
                      <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-3 py-2.5">
                        <p className="text-[10px] font-medium uppercase tracking-wide text-amber-300/70">
                          Admin note
                        </p>
                        <p className="mt-1 text-xs leading-relaxed text-white/70">
                          {row.latestSubmission.admin_note}
                        </p>
                      </div>
                    )}

                    {canPayNow && (
                      <Link
                        href={payHref}
                        className="inline-flex w-full items-center justify-center rounded-full bg-pink-500/80 px-4 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-pink-500 sm:w-auto"
                        onClick={(e) => e.stopPropagation()}
                      >
                        Pay now
                      </Link>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
