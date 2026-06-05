"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, ChevronDown, ChevronRight } from "lucide-react";
import { GlassModal } from "@/components/ui/glass-modal";
import { ButtonSecondary, Label } from "@/components/ui/form";
import { FormInput } from "@/components/ui/form-input";
import { FormSelect } from "@/components/ui/form-select";
import { FormSubmitButton } from "@/components/ui/form-submit-button";
import { formatDateEuropean } from "@/lib/format";
import { cn } from "@/lib/utils";
import type {
  BillingClientRecord,
  BillingCycleRecord,
  BillingCycleRevenueRecord,
} from "@/services/client-billing";
import type { BillingCycleRevenueStatus, ModelRecord } from "@/types/client-portal";

type Props = {
  initialCycles: BillingCycleRecord[];
  clients: BillingClientRecord[];
  models: ModelRecord[];
  initialClientCounts: Record<string, number>;
};

const REVENUE_STATUSES: BillingCycleRevenueStatus[] = [
  "draft",
  "announced",
  "pending_review",
  "confirmed_paid",
  "overdue",
];

const fmtUsd = (n: number) =>
  n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

async function parseJson<T>(res: Response): Promise<T> {
  return (await res.json()) as T;
}

export function AdminBillingClient({
  initialCycles,
  clients,
  models,
  initialClientCounts,
}: Props) {
  const router = useRouter();
  const [monthFilter, setMonthFilter] = React.useState(() => {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}`;
  });
  const [expandedCycleId, setExpandedCycleId] = React.useState<string | null>(null);
  const [revenuesByCycleId, setRevenuesByCycleId] = React.useState<
    Record<string, BillingCycleRevenueRecord[]>
  >({});
  const [loadingRevenuesForCycleId, setLoadingRevenuesForCycleId] = React.useState<string | null>(
    null
  );
  const [clientCountsByCycleId, setClientCountsByCycleId] =
    React.useState<Record<string, number>>(initialClientCounts);
  const [showGenerateModal, setShowGenerateModal] = React.useState(false);
  const [generateMode, setGenerateMode] = React.useState<"month" | "range">("month");
  const [generateMonth, setGenerateMonth] = React.useState("");
  const [generatePeriodStart, setGeneratePeriodStart] = React.useState("");
  const [generatePeriodEnd, setGeneratePeriodEnd] = React.useState("");
  const [generateLoading, setGenerateLoading] = React.useState(false);
  const [generateMessage, setGenerateMessage] = React.useState<{
    text: string;
    isError: boolean;
  } | null>(null);
  const [editDatesCycle, setEditDatesCycle] = React.useState<BillingCycleRecord | null>(null);
  const [editDatesStart, setEditDatesStart] = React.useState("");
  const [editDatesEnd, setEditDatesEnd] = React.useState("");
  const [editDatesDue, setEditDatesDue] = React.useState("");
  const [editDatesStatus, setEditDatesStatus] = React.useState("");
  const [editDatesLoading, setEditDatesLoading] = React.useState(false);
  const [editDatesError, setEditDatesError] = React.useState<string | null>(null);
  const [editingRevenue, setEditingRevenue] = React.useState<BillingCycleRevenueRecord | null>(null);
  const [editRevenueTurnover, setEditRevenueTurnover] = React.useState("");
  const [editRevenueFeePercent, setEditRevenueFeePercent] = React.useState(20);
  const [editRevenueStatus, setEditRevenueStatus] = React.useState<BillingCycleRevenueStatus>("draft");
  const [editRevenueError, setEditRevenueError] = React.useState<string | null>(null);
  const [addRevenueClientId, setAddRevenueClientId] = React.useState("");
  const [addRevenueModelId, setAddRevenueModelId] = React.useState("");
  const [addRevenueTurnover, setAddRevenueTurnover] = React.useState("");
  const [addRevenueFeePercent, setAddRevenueFeePercent] = React.useState(20);
  const [addRevenueLoading, setAddRevenueLoading] = React.useState(false);
  const [addRevenueError, setAddRevenueError] = React.useState<string | null>(null);
  const [revenueAssignedModelIds, setRevenueAssignedModelIds] = React.useState<string[]>([]);
  const [announceToast, setAnnounceToast] = React.useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const monthOptions = React.useMemo(() => {
    const year = new Date().getFullYear();
    return Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, "0")}`);
  }, []);

  const cycles = React.useMemo(() => {
    if (!monthFilter) return initialCycles;
    return initialCycles.filter((c) => c.period_start.slice(0, 7) === monthFilter);
  }, [initialCycles, monthFilter]);

  const fetchRevenues = React.useCallback(async (cycleId: string) => {
    setLoadingRevenuesForCycleId(cycleId);
    try {
      const res = await fetch(`/api/admin/billing/revenues?cycleId=${encodeURIComponent(cycleId)}`);
      const data = await parseJson<{ revenues?: BillingCycleRevenueRecord[] }>(res);
      const revs = data.revenues ?? [];
      setRevenuesByCycleId((prev) => ({ ...prev, [cycleId]: revs }));
      const clientIds = new Set(revs.flatMap((r) => r.client).filter(Boolean));
      setClientCountsByCycleId((prev) => ({ ...prev, [cycleId]: clientIds.size }));
    } finally {
      setLoadingRevenuesForCycleId(null);
    }
  }, []);

  React.useEffect(() => {
    if (expandedCycleId) {
      void fetchRevenues(expandedCycleId);
      const cycle = initialCycles.find((c) => c.id === expandedCycleId);
      const clientId = cycle?.client[0];
      if (clientId) {
        setAddRevenueClientId(clientId);
        const client = clients.find((c) => c.id === clientId);
        setAddRevenueFeePercent(
          client?.client_percentage != null ? client.client_percentage * 100 : 20
        );
      } else {
        setAddRevenueClientId("");
        setAddRevenueFeePercent(20);
      }
      setAddRevenueModelId("");
      setAddRevenueTurnover("");
      setAddRevenueError(null);
    }
    setEditingRevenue(null);
    setAnnounceToast(null);
  }, [expandedCycleId, initialCycles, clients, fetchRevenues]);

  React.useEffect(() => {
    if (!addRevenueClientId) {
      setRevenueAssignedModelIds([]);
      return;
    }
    void (async () => {
      try {
        const res = await fetch(`/api/admin/clients/${addRevenueClientId}`);
        const data = await parseJson<{ models?: Array<{ model: string[] }> }>(res);
        const ids = (data.models ?? []).flatMap((a) => a.model);
        setRevenueAssignedModelIds(ids);
      } catch {
        setRevenueAssignedModelIds([]);
      }
    })();
  }, [addRevenueClientId]);

  React.useEffect(() => {
    if (editDatesCycle) {
      setEditDatesStart(editDatesCycle.period_start);
      setEditDatesEnd(editDatesCycle.period_end);
      setEditDatesDue(editDatesCycle.due_date);
      setEditDatesStatus(editDatesCycle.status);
      setEditDatesError(null);
    }
  }, [editDatesCycle]);

  React.useEffect(() => {
    if (editingRevenue) {
      setEditRevenueTurnover(String(editingRevenue.turnover_usd ?? ""));
      setEditRevenueFeePercent(editingRevenue.fee_percent ?? 20);
      setEditRevenueStatus(editingRevenue.status ?? "draft");
      setEditRevenueError(null);
    }
  }, [editingRevenue]);

  React.useEffect(() => {
    if (showGenerateModal && generateMode === "month" && !generateMonth) {
      const n = new Date();
      setGenerateMonth(`${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}`);
    }
  }, [showGenerateModal, generateMode, generateMonth]);

  const revenueFilteredModels = React.useMemo(() => {
    if (revenueAssignedModelIds.length === 0) return models;
    return models.filter((m) => revenueAssignedModelIds.includes(m.id));
  }, [models, revenueAssignedModelIds]);

  const getClientName = (clientId?: string) =>
    clients.find((c) => c.id === clientId)?.display_name ?? "Unknown";

  const getModelName = (modelId?: string) =>
    models.find((m) => m.id === modelId)?.model_name ?? "Unknown";

  return (
    <>
      <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] p-6 backdrop-blur-xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-white">Chatting billing</h2>
            <p className="text-sm text-gray-400">Weekly chatting periods and per-model revenue.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-gray-400">
              Month
              <FormSelect
                value={monthFilter}
                onChange={(e) => setMonthFilter(e.target.value)}
                className="min-w-[130px] py-1.5 text-sm"
              >
                {monthOptions.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </FormSelect>
            </label>
            <ButtonSecondary type="button" onClick={() => setShowGenerateModal(true)}>
              Generate periods
            </ButtonSecondary>
          </div>
        </div>

        <p className="mb-4 text-sm text-gray-400">
          {cycles.length} period{cycles.length === 1 ? "" : "s"}
        </p>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="sticky top-0 z-10 border-b border-white/10 bg-white/5">
              <tr className="text-left text-xs uppercase tracking-wide text-gray-400">
                <th className="w-10 px-2 py-3" />
                <th className="px-4 py-3">Clients</th>
                <th className="px-4 py-3">Models</th>
                <th className="px-4 py-3">Period</th>
                <th className="px-4 py-3">Due</th>
                <th className="px-4 py-3">Turnover</th>
                <th className="px-4 py-3">Fee</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Edit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {cycles.map((cycle) => {
                const isExpanded = expandedCycleId === cycle.id;
                const revenues = revenuesByCycleId[cycle.id] ?? [];
                const weekTurnover = revenues.reduce((s, r) => s + (r.turnover_usd ?? 0), 0);
                const weekFee = revenues.reduce(
                  (s, r) => s + (r.fee_usd ?? r.turnover_usd * ((r.fee_percent ?? 0) / 100)),
                  0
                );
                const count =
                  revenues.length > 0
                    ? new Set(revenues.flatMap((r) => r.client)).size
                    : clientCountsByCycleId[cycle.id];
                const modelIds =
                  revenues.length > 0
                    ? Array.from(new Set(revenues.flatMap((r) => r.model)))
                    : (cycle.model ?? []);
                const fee =
                  cycle.amount_due ?? cycle.total_fee_usd ?? cycle.amount_crm ?? cycle.amount ?? 0;
                const turnover = cycle.total_turnover_usd ?? cycle.model_turnover;

                return (
                  <React.Fragment key={cycle.id}>
                    <tr className="hover:bg-white/[0.03]">
                      <td className="px-2 py-3">
                        <button
                          type="button"
                          onClick={() => setExpandedCycleId(isExpanded ? null : cycle.id)}
                          className="rounded p-1 text-white/70 hover:bg-white/10 hover:text-white"
                        >
                          {isExpanded ? (
                            <ChevronDown className="h-5 w-5" />
                          ) : (
                            <ChevronRight className="h-5 w-5" />
                          )}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-sm text-white">
                        {count === undefined ? "—" : count === 1 ? "1 client" : `${count} clients`}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-300">
                        {modelIds.length === 0
                          ? "—"
                          : `${modelIds.length} model${modelIds.length === 1 ? "" : "s"}`}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-400">
                        {formatDateEuropean(cycle.period_start)} –{" "}
                        {formatDateEuropean(cycle.period_end)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-400">
                        {formatDateEuropean(cycle.due_date)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-300">
                        {turnover != null ? `${fmtUsd(turnover)} ${cycle.currency}` : "—"}
                      </td>
                      <td className="px-4 py-3 text-sm font-semibold text-white">
                        {fmtUsd(fee)} {cycle.currency}
                      </td>
                      <td className="px-4 py-3 text-sm capitalize text-gray-300">{cycle.status.replace(/_/g, " ")}</td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => setEditDatesCycle(cycle)}
                          className="text-sm font-medium text-pink-400 hover:text-pink-300"
                        >
                          Edit
                        </button>
                      </td>
                    </tr>
                    {isExpanded ? (
                      <tr>
                        <td colSpan={9} className="p-0">
                          <div className="mx-4 mb-4 rounded-2xl border border-white/10 bg-white/5 p-4">
                            {loadingRevenuesForCycleId === cycle.id ? (
                              <p className="py-4 text-sm text-white/60">Loading revenues…</p>
                            ) : (
                              <>
                                <div className="mb-4 flex flex-wrap gap-3 text-sm text-white/80">
                                  <span className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5">
                                    Week turnover: {fmtUsd(weekTurnover)} USD
                                  </span>
                                  <span className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5">
                                    Week fee: {fmtUsd(weekFee)} USD
                                  </span>
                                  <span className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5">
                                    Entries: {revenues.length}
                                  </span>
                                </div>
                                {announceToast ? (
                                  <div
                                    className={cn(
                                      "mb-4 rounded-lg px-3 py-2 text-sm",
                                      announceToast.type === "success"
                                        ? "border border-emerald-500/30 bg-emerald-500/20 text-emerald-300"
                                        : "border border-red-500/30 bg-red-500/20 text-red-300"
                                    )}
                                  >
                                    {announceToast.message}
                                  </div>
                                ) : null}
                                <div className="mb-6 overflow-x-auto">
                                  <table className="w-full text-sm">
                                    <thead>
                                      <tr className="border-b border-white/10 text-left text-white/60">
                                        <th className="pb-2 pr-4">Client</th>
                                        <th className="pb-2 pr-4">Model</th>
                                        <th className="pb-2 pr-4">Turnover</th>
                                        <th className="pb-2 pr-4">Fee %</th>
                                        <th className="pb-2 pr-4">Fee USD</th>
                                        <th className="pb-2">Actions</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                      {revenues.map((rev) => {
                                        const feeUsd =
                                          rev.fee_usd ??
                                          rev.turnover_usd * ((rev.fee_percent ?? 0) / 100);
                                        return (
                                          <tr key={rev.id}>
                                            <td className="py-2 pr-4">
                                              {getClientName(rev.client[0])}
                                            </td>
                                            <td className="py-2 pr-4">{getModelName(rev.model[0])}</td>
                                            <td className="py-2 pr-4">{fmtUsd(rev.turnover_usd)}</td>
                                            <td className="py-2 pr-4">{rev.fee_percent}%</td>
                                            <td className="py-2 pr-4">{fmtUsd(feeUsd)}</td>
                                            <td className="py-2">
                                              <button
                                                type="button"
                                                className="mr-2 text-xs text-blue-400 hover:text-blue-300"
                                                onClick={async () => {
                                                  const res = await fetch(
                                                    `/api/admin/billing/revenues/${rev.id}`,
                                                    {
                                                      method: "PATCH",
                                                      headers: { "Content-Type": "application/json" },
                                                      body: JSON.stringify({ status: "announced" }),
                                                    }
                                                  );
                                                  const data = await parseJson<{
                                                    ok?: boolean;
                                                    userMessage?: string;
                                                  }>(res);
                                                  if (data.ok) {
                                                    await fetchRevenues(cycle.id);
                                                    router.refresh();
                                                    setAnnounceToast({
                                                      type: "success",
                                                      message: "Status updated to announced",
                                                    });
                                                  } else {
                                                    setAnnounceToast({
                                                      type: "error",
                                                      message: data.userMessage ?? "Failed",
                                                    });
                                                  }
                                                }}
                                              >
                                                Announce
                                              </button>
                                              <button
                                                type="button"
                                                className="mr-2 text-xs text-pink-400 hover:text-pink-300"
                                                onClick={() => setEditingRevenue(rev)}
                                              >
                                                Edit
                                              </button>
                                              <button
                                                type="button"
                                                className="text-xs text-red-400 hover:text-red-300"
                                                onClick={async () => {
                                                  if (!confirm("Delete this revenue entry?")) return;
                                                  const res = await fetch(
                                                    `/api/admin/billing/revenues/${rev.id}`,
                                                    { method: "DELETE" }
                                                  );
                                                  if (res.ok) {
                                                    await fetchRevenues(cycle.id);
                                                    router.refresh();
                                                  }
                                                }}
                                              >
                                                Delete
                                              </button>
                                            </td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                  {revenues.length === 0 ? (
                                    <p className="py-4 text-sm text-white/50">No revenue entries yet.</p>
                                  ) : null}
                                </div>
                                <div className="border-t border-white/10 pt-4">
                                  <h4 className="mb-3 text-sm font-medium text-white/80">Add revenue</h4>
                                  <div className="flex flex-wrap items-end gap-4">
                                    <div>
                                      <Label>Client</Label>
                                      <FormSelect
                                        value={addRevenueClientId}
                                        onChange={(e) => {
                                          setAddRevenueClientId(e.target.value);
                                          setAddRevenueModelId("");
                                          const c = clients.find((x) => x.id === e.target.value);
                                          setAddRevenueFeePercent(
                                            c?.client_percentage != null
                                              ? c.client_percentage * 100
                                              : 20
                                          );
                                        }}
                                        className="min-w-[140px]"
                                      >
                                        <option value="">Select client</option>
                                        {clients.map((c) => (
                                          <option key={c.id} value={c.id}>
                                            {c.display_name}
                                          </option>
                                        ))}
                                      </FormSelect>
                                    </div>
                                    <div>
                                      <Label>Model</Label>
                                      <FormSelect
                                        value={addRevenueModelId}
                                        onChange={(e) => setAddRevenueModelId(e.target.value)}
                                        className="min-w-[140px]"
                                      >
                                        <option value="">Select model</option>
                                        {revenueFilteredModels.map((m) => (
                                          <option key={m.id} value={m.id}>
                                            {m.model_name}
                                          </option>
                                        ))}
                                      </FormSelect>
                                    </div>
                                    <div>
                                      <Label>Turnover (USD)</Label>
                                      <FormInput
                                        type="number"
                                        step="0.01"
                                        min="0.01"
                                        value={addRevenueTurnover}
                                        onChange={(e) => setAddRevenueTurnover(e.target.value)}
                                        className="w-28"
                                      />
                                    </div>
                                    <div>
                                      <Label>Fee %</Label>
                                      <p className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white">
                                        {addRevenueFeePercent}
                                      </p>
                                    </div>
                                    <FormSubmitButton
                                      type="button"
                                      loading={addRevenueLoading}
                                      disabled={
                                        addRevenueLoading ||
                                        !addRevenueClientId ||
                                        !addRevenueModelId ||
                                        !addRevenueTurnover ||
                                        parseFloat(addRevenueTurnover) <= 0
                                      }
                                      onClick={async () => {
                                        setAddRevenueLoading(true);
                                        setAddRevenueError(null);
                                        const res = await fetch("/api/admin/billing/revenues", {
                                          method: "POST",
                                          headers: { "Content-Type": "application/json" },
                                          body: JSON.stringify({
                                            billing_cycle: [cycle.id],
                                            client: [addRevenueClientId],
                                            model: [addRevenueModelId],
                                            turnover_usd: parseFloat(addRevenueTurnover),
                                            fee_percent: addRevenueFeePercent,
                                          }),
                                        });
                                        const data = await parseJson<{
                                          ok?: boolean;
                                          userMessage?: string;
                                        }>(res);
                                        setAddRevenueLoading(false);
                                        if (data.ok) {
                                          setAddRevenueTurnover("");
                                          setAddRevenueModelId("");
                                          await fetchRevenues(cycle.id);
                                          router.refresh();
                                        } else {
                                          setAddRevenueError(data.userMessage ?? "Failed to add revenue");
                                        }
                                      }}
                                    >
                                      Add revenue
                                    </FormSubmitButton>
                                  </div>
                                  {addRevenueError ? (
                                    <p className="mt-2 text-sm text-red-400">{addRevenueError}</p>
                                  ) : null}
                                </div>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ) : null}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {editDatesCycle ? (
        <GlassModal title="Edit period" subtitle="Update week dates and status" onClose={() => setEditDatesCycle(null)}>
          <div className="space-y-4 p-4 md:p-5">
            <div>
              <Label>Week start</Label>
              <FormInput type="date" value={editDatesStart} onChange={(e) => setEditDatesStart(e.target.value)} />
            </div>
            <div>
              <Label>Week end</Label>
              <FormInput type="date" value={editDatesEnd} onChange={(e) => setEditDatesEnd(e.target.value)} />
            </div>
            <div>
              <Label>Due date</Label>
              <FormInput type="date" value={editDatesDue} onChange={(e) => setEditDatesDue(e.target.value)} />
            </div>
            <div>
              <Label>Status</Label>
              <FormSelect value={editDatesStatus} onChange={(e) => setEditDatesStatus(e.target.value)}>
                <option value="draft">Draft</option>
                <option value="announced">Announced</option>
                <option value="pending_review">Pending review</option>
                <option value="confirmed_paid">Confirmed paid</option>
                <option value="overdue">Overdue</option>
              </FormSelect>
            </div>
            {editDatesError ? (
              <div className="flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/20 p-3 text-sm text-red-400">
                <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
                {editDatesError}
              </div>
            ) : null}
            <div className="flex justify-end gap-3">
              <ButtonSecondary type="button" onClick={() => setEditDatesCycle(null)}>
                Cancel
              </ButtonSecondary>
              <FormSubmitButton
                type="button"
                loading={editDatesLoading}
                disabled={editDatesLoading || !editDatesStart || !editDatesEnd || !editDatesDue}
                onClick={async () => {
                  if (new Date(editDatesEnd) <= new Date(editDatesStart)) {
                    setEditDatesError("Week end must be after week start.");
                    return;
                  }
                  setEditDatesLoading(true);
                  setEditDatesError(null);
                  const res = await fetch(
                    `/api/admin/billing/cycles/${editDatesCycle.id}`,
                    {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        period_start: editDatesStart,
                        period_end: editDatesEnd,
                        due_date: editDatesDue,
                        status: editDatesStatus,
                      }),
                    }
                  );
                  setEditDatesLoading(false);
                  if (res.ok) {
                    setEditDatesCycle(null);
                    router.refresh();
                  } else {
                    const data = await parseJson<{ error?: string }>(res);
                    setEditDatesError(data.error ?? "Failed to update");
                  }
                }}
              >
                Save
              </FormSubmitButton>
            </div>
          </div>
        </GlassModal>
      ) : null}

      {editingRevenue ? (
        <GlassModal title="Edit revenue" onClose={() => setEditingRevenue(null)}>
          <div className="space-y-4 p-4 md:p-5">
            <div>
              <Label>Turnover (USD)</Label>
              <FormInput
                type="number"
                step="0.01"
                value={editRevenueTurnover}
                onChange={(e) => setEditRevenueTurnover(e.target.value)}
              />
            </div>
            <div>
              <Label>Fee %</Label>
              <FormInput
                type="number"
                step="0.1"
                value={String(editRevenueFeePercent)}
                onChange={(e) => setEditRevenueFeePercent(parseFloat(e.target.value) || 0)}
              />
            </div>
            <div>
              <Label>Status</Label>
              <FormSelect
                value={editRevenueStatus}
                onChange={(e) =>
                  setEditRevenueStatus(e.target.value as BillingCycleRevenueStatus)
                }
              >
                {REVENUE_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s.replace(/_/g, " ")}
                  </option>
                ))}
              </FormSelect>
            </div>
            {editRevenueError ? (
              <p className="text-sm text-red-400">{editRevenueError}</p>
            ) : null}
            <div className="flex justify-end gap-3">
              <ButtonSecondary type="button" onClick={() => setEditingRevenue(null)}>
                Cancel
              </ButtonSecondary>
              <FormSubmitButton
                type="button"
                onClick={async () => {
                  const res = await fetch(`/api/admin/billing/revenues/${editingRevenue.id}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      turnover_usd: parseFloat(editRevenueTurnover),
                      fee_percent: editRevenueFeePercent,
                      status: editRevenueStatus,
                    }),
                  });
                  const data = await parseJson<{ ok?: boolean; userMessage?: string }>(res);
                  if (data.ok) {
                    const cycleId = editingRevenue.billing_cycle[0];
                    setEditingRevenue(null);
                    if (cycleId) await fetchRevenues(cycleId);
                    router.refresh();
                  } else {
                    setEditRevenueError(data.userMessage ?? "Failed to update");
                  }
                }}
              >
                Save
              </FormSubmitButton>
            </div>
          </div>
        </GlassModal>
      ) : null}

      {showGenerateModal ? (
        <GlassModal
          title="Generate periods"
          subtitle="Create weekly chatting periods"
          onClose={() => {
            setShowGenerateModal(false);
            setGenerateMessage(null);
          }}
        >
          <div className="space-y-4 p-4 md:p-5">
            <div>
              <Label>Mode</Label>
              <FormSelect
                value={generateMode}
                onChange={(e) => setGenerateMode(e.target.value as "month" | "range")}
              >
                <option value="month">Month (YYYY-MM)</option>
                <option value="range">Date range</option>
              </FormSelect>
            </div>
            {generateMode === "month" ? (
              <div>
                <Label>Month</Label>
                <FormInput
                  type="month"
                  value={generateMonth}
                  onChange={(e) => setGenerateMonth(e.target.value)}
                />
              </div>
            ) : (
              <>
                <div>
                  <Label>Period start</Label>
                  <FormInput
                    type="date"
                    value={generatePeriodStart}
                    onChange={(e) => setGeneratePeriodStart(e.target.value)}
                  />
                </div>
                <div>
                  <Label>Period end</Label>
                  <FormInput
                    type="date"
                    value={generatePeriodEnd}
                    onChange={(e) => setGeneratePeriodEnd(e.target.value)}
                  />
                </div>
              </>
            )}
            {generateMessage ? (
              <div
                className={cn(
                  "rounded-xl p-3 text-sm",
                  generateMessage.isError
                    ? "border border-red-500/30 bg-red-500/20 text-red-400"
                    : "border border-emerald-500/30 bg-emerald-500/20 text-emerald-300"
                )}
              >
                {generateMessage.text}
              </div>
            ) : null}
            <div className="flex justify-end gap-3">
              <ButtonSecondary
                type="button"
                onClick={() => {
                  setShowGenerateModal(false);
                  setGenerateMessage(null);
                }}
              >
                Cancel
              </ButtonSecondary>
              <FormSubmitButton
                type="button"
                loading={generateLoading}
                disabled={
                  generateLoading ||
                  (generateMode === "month" ? !generateMonth : !generatePeriodStart || !generatePeriodEnd)
                }
                onClick={async () => {
                  setGenerateLoading(true);
                  setGenerateMessage(null);
                  const payload =
                    generateMode === "month"
                      ? { mode: "month" as const, month: generateMonth }
                      : {
                          mode: "range" as const,
                          period_start: generatePeriodStart,
                          period_end: generatePeriodEnd,
                        };
                  const res = await fetch("/api/admin/billing/generate", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload),
                  });
                  const result = await parseJson<{
                    ok?: boolean;
                    created?: number;
                    skipped?: number;
                    month?: string;
                    userMessage?: string;
                    error?: string;
                  }>(res);
                  setGenerateLoading(false);
                  if (result.ok) {
                    const msg = result.month
                      ? `Generated ${result.created}/4 periods for ${result.month}${result.skipped ? ` (skipped ${result.skipped} existing)` : ""}.`
                      : `Created ${result.created ?? 0} period(s).`;
                    setGenerateMessage({ text: msg, isError: false });
                    setTimeout(() => router.refresh(), 1500);
                  } else {
                    setGenerateMessage({
                      text: result.userMessage ?? result.error ?? "Failed to generate",
                      isError: true,
                    });
                  }
                }}
              >
                Generate
              </FormSubmitButton>
            </div>
          </div>
        </GlassModal>
      ) : null}
    </>
  );
}
