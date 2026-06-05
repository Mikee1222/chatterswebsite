"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ChevronRight,
  CircleDot,
  DollarSign,
  Layers,
  Sparkles,
  TrendingUp,
  Users,
  X,
} from "lucide-react";
import {
  filterCyclesByClientModel,
  getCycleAmountDue,
  getCycleAmountPaid,
  getCycleType,
  getMonthKeyFromDate,
  resolveCycleCurrency,
  sumByCurrency,
  toSafeNumber,
} from "@/lib/gunzo-partnership-admin";
import { formatDateEuropean } from "@/lib/format";
import { ROUTES } from "@/lib/routes";
import { cn } from "@/lib/utils";
import type {
  BillingClientRecord,
  BillingCycleRecord,
  PaymentSubmissionRecord,
} from "@/services/client-billing";
import type { ModelRecord } from "@/types/client-portal";

type ViewMode = "selected" | "ytd" | "all";
type StatusFilter = "all" | "active" | "overdue";
type RollupMode = "weekly" | "monthly";

type Props = {
  initialCycles: BillingCycleRecord[];
  clients: BillingClientRecord[];
  models: ModelRecord[];
  submissions: PaymentSubmissionRecord[];
  defaultMonth: string;
  defaultView: ViewMode;
  defaultClient?: string;
  defaultModel?: string;
  defaultStatus?: StatusFilter;
  defaultRollup?: RollupMode;
  errorCode?: string | null;
};

export function AdminPartnershipClient({
  initialCycles,
  clients,
  models,
  submissions,
  defaultMonth,
  defaultView,
  defaultClient = "all",
  defaultModel = "all",
  defaultStatus = "all",
  defaultRollup = "weekly",
  errorCode = null,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [selectedMonth, setSelectedMonth] = React.useState(defaultMonth);
  const [viewMode, setViewMode] = React.useState<ViewMode>(defaultView);
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>(defaultStatus);
  const [clientFilter, setClientFilter] = React.useState(defaultClient);
  const [modelFilter, setModelFilter] = React.useState(defaultModel);
  const [rollupMode, setRollupMode] = React.useState<RollupMode>(defaultRollup);
  const [selectedClientId, setSelectedClientId] = React.useState<string | null>(null);

  const monthOptions = React.useMemo(() => {
    const options: string[] = [];
    for (let i = 0; i < 12; i++) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      options.push(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`);
    }
    return options;
  }, []);

  const formatMonthLabel = (monthKey: string) => {
    const [year, month] = monthKey.split("-").map(Number);
    return new Date(year, month - 1, 1).toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
    });
  };

  const submissionsByCycle = React.useMemo(() => {
    const map = new Map<string, PaymentSubmissionRecord[]>();
    submissions.forEach((submission) => {
      submission.billing_cycle.forEach((cycleId) => {
        const current = map.get(cycleId) ?? [];
        current.push(submission);
        map.set(cycleId, current);
      });
    });
    map.forEach((list, key) => {
      map.set(
        key,
        list.sort(
          (a, b) =>
            new Date(b.submitted_datetime).getTime() - new Date(a.submitted_datetime).getTime()
        )
      );
    });
    return map;
  }, [submissions]);

  const getPaidAmountForCycle = React.useCallback(
    (cycle: BillingCycleRecord) => {
      const directPaid = getCycleAmountPaid(cycle);
      if (directPaid > 0) return directPaid;
      const cycleCurrency = resolveCycleCurrency(cycle);
      const cycleSubmissions = submissionsByCycle.get(cycle.id) ?? [];
      return cycleSubmissions
        .filter((s) => s.status === "approved")
        .reduce((sum, s) => {
          if (cycleCurrency && s.submitted_currency && s.submitted_currency !== cycleCurrency) {
            return sum;
          }
          return sum + toSafeNumber(s.submitted_amount, 0);
        }, 0);
    },
    [submissionsByCycle]
  );

  const baseCycles = React.useMemo(() => {
    let scoped = filterCyclesByClientModel(initialCycles, clientFilter, modelFilter);
    if (viewMode === "selected") {
      scoped = scoped.filter((cycle) => {
        const monthKey = getMonthKeyFromDate(cycle.period_start || cycle.due_date || cycle.period_end);
        return monthKey === selectedMonth;
      });
    } else if (viewMode === "ytd") {
      const [year] = selectedMonth.split("-").map(Number);
      const now = new Date();
      const start = new Date(year, 0, 1);
      const end = year === now.getFullYear() ? now : new Date(year, 11, 31, 23, 59, 59, 999);
      scoped = scoped.filter((cycle) => {
        const dateValue = cycle.period_start || cycle.due_date || cycle.period_end;
        if (!dateValue) return false;
        const date = new Date(dateValue);
        return date >= start && date <= end;
      });
    }
    return scoped;
  }, [initialCycles, clientFilter, modelFilter, viewMode, selectedMonth]);

  const filteredCycles = React.useMemo(() => {
    if (statusFilter === "all") return baseCycles;
    if (statusFilter === "overdue") return baseCycles.filter((c) => c.status === "overdue");
    return baseCycles.filter((c) => !["confirmed_paid", "overdue"].includes(c.status));
  }, [baseCycles, statusFilter]);

  const turnoverTotals = React.useMemo(
    () => sumByCurrency(filteredCycles, (c) => toSafeNumber(c.model_turnover ?? 0, 0)),
    [filteredCycles]
  );
  const chattingTotals = React.useMemo(
    () =>
      sumByCurrency(
        filteredCycles.filter((c) => getCycleType(c) === "chatting"),
        getCycleAmountDue
      ),
    [filteredCycles]
  );
  const crmTotals = React.useMemo(
    () =>
      sumByCurrency(filteredCycles.filter((c) => getCycleType(c) === "crm"), getCycleAmountDue),
    [filteredCycles]
  );
  const receivablesTotals = React.useMemo(
    () =>
      sumByCurrency(
        filteredCycles.filter((c) => c.status !== "confirmed_paid"),
        (c) => Math.max(0, getCycleAmountDue(c) - getPaidAmountForCycle(c))
      ),
    [filteredCycles, getPaidAmountForCycle]
  );
  const paidTotals = React.useMemo(
    () =>
      sumByCurrency(
        filteredCycles.filter((c) => c.status === "confirmed_paid"),
        getPaidAmountForCycle
      ),
    [filteredCycles, getPaidAmountForCycle]
  );

  const clientRollups = React.useMemo(() => {
    const map = new Map<string, BillingCycleRecord[]>();
    filteredCycles.forEach((cycle) => {
      cycle.client.forEach((clientId) => {
        const current = map.get(clientId) ?? [];
        current.push(cycle);
        map.set(clientId, current);
      });
    });
    return Array.from(map.entries())
      .map(([clientId, cyclesForClient]) => ({
        clientId,
        clientName: clients.find((c) => c.id === clientId)?.display_name ?? "Unknown",
        chatting: sumByCurrency(
          cyclesForClient.filter((c) => getCycleType(c) === "chatting"),
          getCycleAmountDue
        ),
        crm: sumByCurrency(
          cyclesForClient.filter((c) => getCycleType(c) === "crm"),
          getCycleAmountDue
        ),
        turnover: sumByCurrency(cyclesForClient, (c) => toSafeNumber(c.model_turnover ?? 0, 0)),
        receivables: sumByCurrency(
          cyclesForClient.filter((c) => c.status !== "confirmed_paid"),
          (c) => Math.max(0, getCycleAmountDue(c) - getPaidAmountForCycle(c))
        ),
        cycles: cyclesForClient,
      }))
      .sort((a, b) => a.clientName.localeCompare(b.clientName));
  }, [filteredCycles, clients, getPaidAmountForCycle]);

  const formatCurrencyInline = (totals: Map<string, number>) => {
    if (totals.size === 0) return "0.00";
    return Array.from(totals.entries())
      .map(([currency, amount]) => {
        const formatted = toSafeNumber(amount).toLocaleString("en-US", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        });
        return `${formatted} ${currency}`;
      })
      .join(" / ");
  };

  const pushParams = (updates: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(updates).forEach(([key, value]) => {
      if (value == null || value === "all") params.delete(key);
      else params.set(key, value);
    });
    router.push(`?${params.toString()}`);
  };

  const glassCard =
    "rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl shadow-[0_18px_45px_rgba(0,0,0,0.35)]";
  const controlBase =
    "h-10 rounded-xl border border-white/10 bg-white/5 px-4 text-sm text-white/90 backdrop-blur-xl transition-all focus:outline-none focus:ring-1 focus:ring-pink-500/40";

  const selectedClient = selectedClientId
    ? clientRollups.find((r) => r.clientId === selectedClientId) ?? null
    : null;

  const selectedClientCycles = React.useMemo(() => {
    if (!selectedClient) return [];
    return baseCycles.filter((c) => c.client.includes(selectedClient.clientId));
  }, [selectedClient, baseCycles]);

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="mb-2 text-4xl font-semibold text-white">Gunzo partnership</h1>
          <p className="text-gray-400">Weekly + monthly partnership rollups</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={selectedMonth}
            onChange={(e) => {
              setSelectedMonth(e.target.value);
              pushParams({ month: e.target.value });
            }}
            className={cn(controlBase, "appearance-none")}
          >
            {monthOptions.map((month) => (
              <option key={month} value={month}>
                {formatMonthLabel(month)}
              </option>
            ))}
          </select>
          <select
            value={clientFilter}
            onChange={(e) => {
              setClientFilter(e.target.value);
              pushParams({ client: e.target.value });
            }}
            className={cn(controlBase, "appearance-none")}
          >
            <option value="all">All clients</option>
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.display_name}
              </option>
            ))}
          </select>
          <select
            value={modelFilter}
            onChange={(e) => {
              setModelFilter(e.target.value);
              pushParams({ model: e.target.value });
            }}
            className={cn(controlBase, "appearance-none")}
          >
            <option value="all">All models</option>
            {models.map((model) => (
              <option key={model.id} value={model.id}>
                {model.model_name}
              </option>
            ))}
          </select>
          {(["selected", "ytd", "all"] as ViewMode[]).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => {
                setViewMode(mode);
                pushParams({ view: mode });
              }}
              className={cn(
                controlBase,
                viewMode === mode
                  ? "border-pink-500/40 bg-pink-500/15 text-pink-200"
                  : "text-white/80 hover:border-white/20"
              )}
            >
              {mode === "selected" ? "Selected month" : mode === "ytd" ? "YTD" : "All time"}
            </button>
          ))}
          {(["weekly", "monthly"] as RollupMode[]).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => {
                setRollupMode(mode);
                pushParams({ rollup: mode });
              }}
              className={cn(
                controlBase,
                rollupMode === mode
                  ? "border-pink-500/40 bg-pink-500/15 text-pink-200"
                  : "text-white/80 hover:border-white/20"
              )}
            >
              {mode === "weekly" ? "Weekly view" : "Monthly rollup"}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {(["all", "active", "overdue"] as StatusFilter[]).map((filter) => (
          <button
            key={filter}
            type="button"
            onClick={() => {
              setStatusFilter(filter);
              pushParams({ status: filter === "all" ? null : filter });
            }}
            className={cn(
              "rounded-full border px-4 py-2 text-sm transition-colors",
              statusFilter === filter
                ? "border-pink-500/40 bg-pink-500/15 text-pink-200"
                : "border-white/15 bg-white/5 text-white/70 hover:text-white"
            )}
          >
            {filter === "all" ? "All" : filter === "active" ? "Active only" : "Overdue only"}
          </button>
        ))}
      </div>

      {errorCode ? (
        <div className={cn(glassCard, "p-8")}>
          <h2 className="mb-2 text-xl font-semibold text-white">Unable to load data</h2>
          <p className="text-sm text-gray-400">
            Error code: <span className="text-pink-300">{errorCode}</span>
          </p>
        </div>
      ) : filteredCycles.length === 0 ? (
        <div className={cn(glassCard, "p-10 text-center")}>
          <CircleDot className="mx-auto mb-4 h-12 w-12 text-white/50" />
          <h2 className="mb-2 text-xl font-semibold text-white">No data for selected filters</h2>
          <Link
            href={ROUTES.admin.billing}
            className="mt-6 inline-flex rounded-lg border border-pink-500/30 bg-pink-500/20 px-4 py-2 text-pink-200 hover:bg-pink-500/30"
          >
            Go to billing
          </Link>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
            {[
              { label: "Total model turnover", icon: TrendingUp, value: turnoverTotals },
              { label: "Chatting fees", icon: DollarSign, value: chattingTotals },
              { label: "CRM fees", icon: DollarSign, value: crmTotals },
              { label: "Receivables", icon: Layers, value: receivablesTotals },
              { label: "Paid", icon: Users, value: paidTotals },
            ].map(({ label, icon: Icon, value }) => (
              <div key={label} className={cn(glassCard, "p-5")}>
                <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-gray-400">
                  <Icon className="h-4 w-4 text-pink-300" />
                  {label}
                </div>
                <p className="mt-3 text-2xl font-semibold text-white">{formatCurrencyInline(value)}</p>
              </div>
            ))}
          </div>

          <div className={cn(glassCard, "p-6")}>
            <div className="mb-4 flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-white/70" />
              <h2 className="text-lg font-semibold text-white">Client rollups</h2>
            </div>
            <div className="space-y-3">
              {clientRollups.map((row) => (
                <div
                  key={row.clientId}
                  className="grid grid-cols-1 items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-4 lg:grid-cols-6"
                >
                  <div className="font-medium text-white">{row.clientName}</div>
                  <div className="text-sm text-white/80">{formatCurrencyInline(row.turnover)}</div>
                  <div className="text-sm text-white/80">{formatCurrencyInline(row.chatting)}</div>
                  <div className="text-sm text-white/80">{formatCurrencyInline(row.crm)}</div>
                  <div className="text-sm text-white/80">{formatCurrencyInline(row.receivables)}</div>
                  <button
                    type="button"
                    onClick={() => setSelectedClientId(row.clientId)}
                    className="inline-flex items-center gap-1 text-sm text-pink-300 hover:text-pink-200"
                  >
                    View details <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {selectedClient ? (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/30 backdrop-blur-sm">
          <div className={cn("h-full w-full max-w-2xl overflow-y-auto p-6", glassCard)}>
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-semibold text-white">{selectedClient.clientName}</h3>
                <p className="text-sm text-gray-400">Partnership details</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedClientId(null)}
                className="rounded-full border border-white/20 bg-white/10 p-2 text-white/70 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-3">
              {selectedClientCycles.map((cycle) => (
                <div
                  key={cycle.id}
                  className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 p-3 text-sm"
                >
                  <div>
                    <p className="text-white">
                      {rollupMode === "monthly"
                        ? formatMonthLabel(
                            getMonthKeyFromDate(cycle.period_start) ?? selectedMonth
                          )
                        : `${formatDateEuropean(cycle.period_start)} – ${formatDateEuropean(cycle.period_end)}`}
                    </p>
                    <p className="text-xs capitalize text-gray-400">{cycle.status.replace(/_/g, " ")}</p>
                  </div>
                  <p className="text-white">
                    {getCycleAmountDue(cycle).toLocaleString("en-US", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}{" "}
                    {resolveCycleCurrency(cycle)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
