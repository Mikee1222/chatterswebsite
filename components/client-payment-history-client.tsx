"use client";

import { useMemo, useState } from "react";
import {
  AlertCircle,
  Building2,
  Calendar,
  CheckCircle2,
  ChevronDown,
  Clock,
  MessageSquare,
  Receipt,
} from "lucide-react";
import { formatDateYmd, formatDateTime } from "@/lib/format-date";
import { cn } from "@/lib/utils";
import type {
  BillingCycleKind,
  BillingCycleRecord,
  PaymentSubmissionRecord,
} from "@/types/client-portal";
import { getCycleAmountDue } from "@/lib/client-portal-utils";

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

function formatMoney(amount: number, currency: string): string {
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
      label: "Approved",
      tone: "text-emerald-300 bg-emerald-500/10 border-emerald-500/30",
      icon: CheckCircle2,
    };
  }
  if (sub?.status === "pending_review") {
    return {
      label: "Pending Review",
      tone: "text-yellow-300 bg-yellow-500/10 border-yellow-500/30",
      icon: Clock,
    };
  }
  if (sub?.status === "rejected") {
    return {
      label: "Rejected",
      tone: "text-red-300 bg-red-500/10 border-red-500/30",
      icon: AlertCircle,
    };
  }
  if (row.status === "confirmed_paid") {
    return {
      label: "Paid",
      tone: "text-emerald-300 bg-emerald-500/10 border-emerald-500/30",
      icon: CheckCircle2,
    };
  }
  if (row.status === "overdue") {
    return {
      label: "Overdue",
      tone: "text-red-300 bg-red-500/10 border-red-500/30",
      icon: AlertCircle,
    };
  }
  if (row.status === "draft") {
    return {
      label: "Draft",
      tone: "text-white/60 bg-white/5 border-white/10",
      icon: Calendar,
    };
  }
  return {
    label: row.status.replace(/_/g, " "),
    tone: "text-white/60 bg-white/5 border-white/10",
    icon: Calendar,
  };
}

function StatusBadge({ row }: { row: CycleRow }) {
  const display = resolveDisplay(row);
  const Icon = display.icon;
  return (
    <span
      className={cn(
        "flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium",
        display.tone
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {display.label}
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
      <div className="mb-6 flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-pink-300/80">Finance</p>
          <h1 className="mt-1 text-3xl font-bold text-white">Payment History</h1>
          <p className="mt-1 text-sm text-white/40">All billing cycles and submissions</p>
        </div>
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

      <div className="space-y-3">
        <div>
          <p className="mb-2 text-xs font-medium text-white/45">Type</p>
          <div className="flex flex-wrap gap-2">
            {TYPE_FILTERS.map(({ value, label }) => (
              <FilterPill
                key={value}
                active={filterKind === value}
                onClick={() => setFilterKind(value)}
              >
                {label}
              </FilterPill>
            ))}
          </div>
        </div>
        <div>
          <p className="mb-2 text-xs font-medium text-white/45">Status</p>
          <div className="flex flex-wrap gap-2">
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
        </div>
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

            return (
              <div
                key={row.id}
                className="glass-card cursor-pointer p-4 transition-colors hover:bg-white/[0.04]"
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
                <div className="flex items-center justify-between gap-4">
                  <div className="flex min-w-0 items-center gap-4">
                    <div
                      className={cn(
                        "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border",
                        isChatting
                          ? "border-pink-500/20 bg-pink-500/15"
                          : "border-violet-500/20 bg-violet-500/15"
                      )}
                    >
                      {isChatting ? (
                        <MessageSquare className="h-5 w-5 text-pink-400" />
                      ) : (
                        <Building2 className="h-5 w-5 text-violet-400" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-white">{kindLabel(row.kind)}</p>
                      <p className="mt-0.5 text-xs text-white/40">
                        {formatPeriod(row.period_start, row.period_end)}
                      </p>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-3 sm:gap-6">
                    <div className="hidden text-right sm:block">
                      <p className="text-xs text-white/40">Due</p>
                      <p className="text-sm text-white">{formatDateYmd(row.due_date)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-white/40">Amount</p>
                      <p className="font-semibold text-white tabular-nums">
                        {formatMoney(amount, currency)}
                      </p>
                    </div>
                    <StatusBadge row={row} />
                    <ChevronDown
                      className={cn(
                        "h-4 w-4 text-white/30 transition-transform",
                        isExpanded && "rotate-180"
                      )}
                    />
                  </div>
                </div>

                {isExpanded && row.latestSubmission && (
                  <div className="mt-4 space-y-2 border-t border-white/5 pt-4">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-white/40">Submitted</span>
                      <span className="text-white">
                        {formatDateTime(row.latestSubmission.submitted_datetime)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-white/40">Amount paid</span>
                      <span className="text-white tabular-nums">
                        {formatMoney(
                          row.latestSubmission.submitted_amount,
                          row.latestSubmission.submitted_currency
                        )}
                      </span>
                    </div>
                    {row.latestSubmission.reference_id && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-white/40">Reference</span>
                        <span className="text-white">{row.latestSubmission.reference_id}</span>
                      </div>
                    )}
                    {row.latestSubmission.note && (
                      <div className="rounded-lg bg-white/5 px-3 py-2 text-xs text-white/60">
                        {row.latestSubmission.note}
                      </div>
                    )}
                    {row.latestSubmission.admin_note && (
                      <div className="rounded-lg bg-white/5 px-3 py-2 text-xs text-white/60">
                        {row.latestSubmission.admin_note}
                      </div>
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
