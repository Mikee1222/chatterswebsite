"use client";

import * as React from "react";
import { Receipt, TrendingUp, DollarSign, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { InflowwMonthlyBillingRow } from "@/types/infloww";

function fmt(value: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function StatCard({
  label,
  value,
  accent = false,
  warning = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
  warning?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border px-5 py-4 space-y-1",
        accent
          ? "border-pink-500/30 bg-pink-500/5"
          : warning
            ? "border-yellow-500/30 bg-yellow-500/5"
            : "border-white/10 bg-white/5"
      )}
    >
      <p className="text-xs uppercase tracking-widest text-gray-400">{label}</p>
      <p
        className={cn(
          "text-xl font-semibold",
          accent ? "text-pink-300" : warning ? "text-yellow-300" : "text-white"
        )}
      >
        {value}
      </p>
    </div>
  );
}

interface Props {
  billing: InflowwMonthlyBillingRow[];
}

export function AdminInflowwInvoicesClient({ billing }: Props) {
  const [selected, setSelected] = React.useState<InflowwMonthlyBillingRow | null>(
    billing[0] ?? null
  );

  const totalPaid = billing.reduce((s, r) => s + r.paid, 0);
  const totalPending = billing.reduce((s, r) => s + r.pending, 0);
  const totalBalanceDue = billing.reduce((s, r) => s + r.balanceDue, 0);

  if (billing.length === 0) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/5 p-10 text-center space-y-3">
        <AlertCircle className="mx-auto h-8 w-8 text-gray-500" />
        <p className="text-gray-400 text-sm">
          No billing records yet. Data syncs once daily via the Infloww monthly billing endpoint.
        </p>
        <p className="text-gray-500 text-xs">
          Note: Endpoint requires <span className="text-yellow-400">invoice-data scope</span> on the
          Infloww API key. If records are missing, verify key scope in the Infloww dashboard.
        </p>
      </div>
    );
  }

  const currency = selected?.currency ?? "USD";

  return (
    <div className="space-y-6">
      {/* Summary stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total Paid" value={fmt(totalPaid)} accent />
        <StatCard label="Total Pending" value={fmt(totalPending)} warning={totalPending > 0} />
        <StatCard label="Balance Due" value={fmt(totalBalanceDue)} warning={totalBalanceDue > 0} />
        <StatCard label="Periods" value={String(billing.length)} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Period list */}
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-widest text-gray-500 mb-3">Billing Periods</p>
          {billing.map((row) => (
            <button
              key={row.billingId}
              onClick={() => setSelected(row)}
              className={cn(
                "w-full text-left rounded-lg border px-4 py-3 transition-colors",
                selected?.billingId === row.billingId
                  ? "border-pink-500/50 bg-pink-500/10"
                  : "border-white/10 bg-white/5 hover:bg-white/10"
              )}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Receipt className="h-4 w-4 text-gray-400 shrink-0" />
                  <span className="text-sm font-medium text-white">{row.billingPeriod}</span>
                </div>
                <div className="text-right">
                  <p className="text-sm text-white">{fmt(row.total, row.currency)}</p>
                  {row.pending > 0 && (
                    <p className="text-xs text-yellow-400">
                      {fmt(row.pending, row.currency)} pending
                    </p>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* Detail panel */}
        {selected && (
          <div className="lg:col-span-2 rounded-xl border border-white/10 bg-white/5 p-6 space-y-5">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-lg font-semibold text-white">{selected.billingPeriod}</h2>
                {selected.invoiceId && (
                  <p className="text-xs text-gray-500 mt-0.5">Invoice #{selected.invoiceId}</p>
                )}
              </div>
              <span className="text-xs bg-white/10 rounded-full px-3 py-1 text-gray-300">
                {selected.currency}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <StatCard label="Subscription" value={fmt(selected.subscription, currency)} />
              <StatCard label="Discount" value={fmt(selected.discount, currency)} />
              <StatCard label="IGIC" value={fmt(selected.igic, currency)} />
              <StatCard label="Deductions" value={fmt(selected.deductions, currency)} />
            </div>

            <div className="border-t border-white/10 pt-4 grid grid-cols-3 gap-3">
              <StatCard label="Total" value={fmt(selected.total, currency)} />
              <StatCard label="Paid" value={fmt(selected.paid, currency)} accent />
              <StatCard
                label="Balance Due"
                value={fmt(selected.balanceDue, currency)}
                warning={selected.balanceDue > 0}
              />
            </div>

            {selected.pending > 0 && (
              <div className="flex items-center gap-2 rounded-lg border border-yellow-500/30 bg-yellow-500/5 px-4 py-3">
                <AlertCircle className="h-4 w-4 text-yellow-400 shrink-0" />
                <p className="text-sm text-yellow-300">
                  {fmt(selected.pending, currency)} pending payment
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
