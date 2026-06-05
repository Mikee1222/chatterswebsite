"use client";

import { Fragment, useMemo, useState } from "react";
import { AlertCircle, Calendar, CheckCircle2, ChevronDown, ChevronUp, Clock, X } from "lucide-react";
import { formatDateYmd, formatDateTime } from "@/lib/format-date";
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

function kindLabel(kind: BillingCycleKind): string {
  return kind === "chatting_weekly" ? "Chatting Weekly" : "CRM Monthly";
}

function formatMoney(amount: number, currency: string): string {
  return `${new Intl.NumberFormat("en-GB", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)} ${currency}`;
}

function resolveDisplay(row: CycleRow) {
  const sub = row.latestSubmission;
  if (sub?.status === "approved") {
    return { label: "Approved", tone: "text-emerald-300 bg-emerald-500/10 border-emerald-500/30", icon: CheckCircle2 };
  }
  if (sub?.status === "pending_review") {
    return { label: "Pending Review", tone: "text-yellow-300 bg-yellow-500/10 border-yellow-500/30", icon: Clock };
  }
  if (sub?.status === "rejected") {
    return { label: "Rejected", tone: "text-red-300 bg-red-500/10 border-red-500/30", icon: AlertCircle };
  }
  if (row.status === "confirmed_paid") {
    return { label: "Paid", tone: "text-emerald-300 bg-emerald-500/10 border-emerald-500/30", icon: CheckCircle2 };
  }
  if (row.status === "overdue") {
    return { label: "Overdue", tone: "text-red-300 bg-red-500/10 border-red-500/30", icon: AlertCircle };
  }
  return { label: row.status, tone: "text-white/60 bg-white/5 border-white/10", icon: Calendar };
}

export function ClientPaymentHistoryClient({ cycles }: Props) {
  const [filterKind, setFilterKind] = useState<"all" | BillingCycleKind>("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [detailRow, setDetailRow] = useState<CycleRow | null>(null);

  const filtered = useMemo(() => {
    return cycles.filter((row) => {
      if (filterKind !== "all" && row.kind !== filterKind) return false;
      if (filterStatus === "all") return true;
      if (filterStatus === "pending_review") {
        return row.latestSubmission?.status === "pending_review" || row.status === "pending_review";
      }
      return row.status === filterStatus || row.latestSubmission?.status === filterStatus;
    });
  }, [cycles, filterKind, filterStatus]);

  return (
    <div className="space-y-6 pb-20 md:pb-0">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-white">Payment History</h1>
        <p className="mt-1 text-sm text-white/55">All billing cycles and submissions</p>
      </div>

      <div className="glass-card flex flex-wrap gap-4 rounded-2xl p-4">
        <div className="min-w-[140px] flex-1">
          <label className="mb-1.5 block text-xs font-medium text-white/45">Type</label>
          <select
            value={filterKind}
            onChange={(e) => setFilterKind(e.target.value as "all" | BillingCycleKind)}
            className="w-full rounded-xl border border-white/10 bg-white/[0.06] px-3 py-2 text-sm text-white focus:border-pink-400/40 focus:outline-none"
          >
            <option value="all" className="bg-[#1a1a1a]">All types</option>
            <option value="chatting_weekly" className="bg-[#1a1a1a]">Chatting Weekly</option>
            <option value="crm_monthly" className="bg-[#1a1a1a]">CRM Monthly</option>
          </select>
        </div>
        <div className="min-w-[140px] flex-1">
          <label className="mb-1.5 block text-xs font-medium text-white/45">Status</label>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-white/[0.06] px-3 py-2 text-sm text-white focus:border-pink-400/40 focus:outline-none"
          >
            <option value="all" className="bg-[#1a1a1a]">All statuses</option>
            <option value="draft" className="bg-[#1a1a1a]">Draft</option>
            <option value="confirmed_paid" className="bg-[#1a1a1a]">Paid</option>
            <option value="pending_review" className="bg-[#1a1a1a]">Pending Review</option>
            <option value="overdue" className="bg-[#1a1a1a]">Overdue</option>
            <option value="announced" className="bg-[#1a1a1a]">Announced</option>
            <option value="approved" className="bg-[#1a1a1a]">Approved</option>
            <option value="rejected" className="bg-[#1a1a1a]">Rejected</option>
          </select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="glass-card rounded-2xl p-8 text-center">
          <Calendar className="mx-auto mb-3 h-10 w-10 text-white/25" />
          <p className="text-white/70">No payment history found</p>
        </div>
      ) : (
        <div className="glass-card overflow-hidden rounded-2xl">
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-white/10 bg-white/[0.04]">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-white/45">Period</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-white/45">Type</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-white/45">Amount</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-white/45">Due</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-white/45">Status</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-white/45" />
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {filtered.map((row) => {
                  const display = resolveDisplay(row);
                  const Icon = display.icon;
                  const amount = row.latestSubmission?.submitted_amount ?? getCycleAmountDue(row);
                  const currency = row.latestSubmission?.submitted_currency ?? row.currency;
                  const isExpanded = expandedId === row.id;
                  return (
                    <Fragment key={row.id}>
                      <tr className="hover:bg-white/[0.03]">
                        <td className="px-4 py-3 text-white">
                          {formatDateYmd(row.period_start)} – {formatDateYmd(row.period_end)}
                        </td>
                        <td className="px-4 py-3 text-white/70">{kindLabel(row.kind)}</td>
                        <td className="px-4 py-3 text-right font-medium text-white tabular-nums">
                          {formatMoney(amount, currency)}
                        </td>
                        <td className="px-4 py-3 text-white/60">{formatDateYmd(row.due_date)}</td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold ${display.tone}`}
                          >
                            <Icon className="h-3 w-3" />
                            {display.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => setExpandedId(isExpanded ? null : row.id)}
                            className="text-pink-400 hover:text-pink-300"
                          >
                            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </button>
                        </td>
                      </tr>
                      {isExpanded && row.latestSubmission && (
                        <tr className="bg-white/[0.02]">
                          <td colSpan={6} className="px-4 py-3 text-sm text-white/60">
                            Submitted {formatDateTime(row.latestSubmission.submitted_datetime)}
                            {row.latestSubmission.reference_id && (
                              <> · Ref: {row.latestSubmission.reference_id}</>
                            )}
                            {row.latestSubmission.note && <> · {row.latestSubmission.note}</>}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="space-y-3 p-4 md:hidden">
            {filtered.map((row) => {
              const display = resolveDisplay(row);
              const Icon = display.icon;
              const amount = row.latestSubmission?.submitted_amount ?? getCycleAmountDue(row);
              const currency = row.latestSubmission?.submitted_currency ?? row.currency;
              return (
                <button
                  key={row.id}
                  type="button"
                  onClick={() => setDetailRow(row)}
                  className="w-full rounded-xl border border-white/10 bg-white/[0.04] p-4 text-left"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-white">{kindLabel(row.kind)}</p>
                      <p className="text-xs text-white/50">
                        {formatDateYmd(row.period_start)} – {formatDateYmd(row.period_end)}
                      </p>
                    </div>
                    <span
                      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${display.tone}`}
                    >
                      <Icon className="h-3 w-3" />
                      {display.label}
                    </span>
                  </div>
                  <p className="mt-2 text-sm font-semibold text-white tabular-nums">
                    {formatMoney(amount, currency)}
                  </p>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {detailRow && (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-4 md:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setDetailRow(null)} aria-hidden />
          <div className="relative w-full rounded-2xl border border-white/10 bg-[#14141a] p-5">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-semibold text-white">{kindLabel(detailRow.kind)}</h3>
              <button type="button" onClick={() => setDetailRow(null)} className="text-white/50">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-2 text-sm">
              <p className="text-white/60">
                {formatDateYmd(detailRow.period_start)} – {formatDateYmd(detailRow.period_end)}
              </p>
              <p className="text-white">
                {formatMoney(
                  detailRow.latestSubmission?.submitted_amount ?? getCycleAmountDue(detailRow),
                  detailRow.latestSubmission?.submitted_currency ?? detailRow.currency
                )}
              </p>
              {detailRow.latestSubmission && (
                <p className="text-white/50">
                  Submitted {formatDateTime(detailRow.latestSubmission.submitted_datetime)}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
