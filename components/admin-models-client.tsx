"use client";

import * as React from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Pencil, Plus, Search, Settings2, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/contexts/toast-context";
import type { AppNotification } from "@/types";
import { formatDateTimeEuropean, formatDateEuropean } from "@/lib/format";
import { Label, Textarea } from "@/components/ui/form";
import { FormInput } from "@/components/ui/form-input";
import { ROUTES } from "@/lib/routes";
import { cn } from "@/lib/utils";
import { AdminRowAvatar, AdminStatCard, IntegrationLinkBadge, RecordStatusBadge } from "@/components/admin-list-primitives";
import { ListPagination, useClientPagination } from "@/components/earnings-filter-list";
import { CustomSelect } from "@/components/ui/custom-select";
import { addDays, getTodayYmd } from "@/lib/weekly-program";
import { logPeriodAction, deletePeriodAction } from "@/app/actions/model-periods";
import type { ModelRecord, ModelPeriodRecord } from "@/types";

function localToast(id: string, title: string, body: string, priority: "normal" | "high"): AppNotification {
  return {
    id,
    notification_id: id,
    user_id: "local",
    category: "system",
    event_type: "system_alert",
    priority,
    title,
    body,
    entity_type: "system",
    entity_id: "",
    read_at: null,
    created_at: new Date().toISOString(),
  };
}

export type ModelPeriodSummary = {
  current: ModelPeriodRecord | null;
  predictedNextStart: string | null;
  history: ModelPeriodRecord[];
};

type Props = {
  modelss: (ModelRecord & { hasLinkedAccount?: boolean })[];
  modelIdToVaNames: Record<string, string[]>;
  periodSummaryByModelId: Record<string, ModelPeriodSummary>;
  canCreate?: boolean;
};

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = React.useState(value);
  React.useEffect(() => {
    const t = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}

function teamBadgeClass(team: ModelRecord["team"]): string {
  return team === "chatting_agency"
    ? "border-sky-500/35 bg-sky-500/15 text-sky-200"
    : "border-pink-500/35 bg-pink-500/15 text-pink-200";
}

function teamLabel(team: ModelRecord["team"]): string {
  return team === "chatting_agency" ? "Agency" : "Gunzo";
}

function priorityBadgeClass(priority: string): string {
  const p = priority.toLowerCase();
  if (p === "high") return "border-red-500/30 bg-red-500/12 text-red-200";
  if (p === "low") return "border-white/12 bg-white/[0.05] text-white/60";
  return "border-amber-500/30 bg-amber-500/12 text-amber-200";
}

function isInactiveStatus(status: string): boolean {
  const s = status.trim().toLowerCase();
  return s === "inactive" || s === "suspended" || s === "disabled" || s === "paused";
}

function isActiveStatus(status: string): boolean {
  const s = status.trim().toLowerCase();
  return s === "active" || s === "enabled" || s === "live";
}

function PeriodSection({
  summary,
  onLogClick,
  historyExpanded,
  onToggleHistory,
  deletingId,
  onRequestDeletePeriod,
}: {
  summary: ModelPeriodSummary;
  onLogClick: () => void;
  historyExpanded: boolean;
  onToggleHistory: () => void;
  deletingId: string | null;
  onRequestDeletePeriod: (periodId: string) => void;
}) {
  const inPeriod = Boolean(summary.current);
  const hasPrediction = !inPeriod && Boolean(summary.predictedNextStart);
  const visibleHistory = historyExpanded ? summary.history : summary.history.slice(0, 5);
  const hasMoreHistory = summary.history.length > 5;

  return (
    <div className="rounded-xl border border-white/[0.08] bg-black/20 px-3 py-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-medium uppercase tracking-wider text-white/40">Period</p>
          <div className="mt-1.5 flex items-center gap-2 text-xs text-white/75">
            <span
              className={cn(
                "h-1.5 w-1.5 shrink-0 rounded-full",
                inPeriod ? "bg-emerald-400" : hasPrediction ? "bg-amber-400" : "bg-white/30"
              )}
              aria-hidden
            />
            {inPeriod ? (
              <span>
                In period until{" "}
                <span className="font-medium text-white">{formatDateEuropean(summary.current!.end_date)}</span>
              </span>
            ) : hasPrediction ? (
              <span>
                Next predicted:{" "}
                <span className="font-medium text-white">{formatDateEuropean(summary.predictedNextStart!)}</span>
              </span>
            ) : (
              <span className="text-white/50">No period data yet</span>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={onLogClick}
          className="shrink-0 rounded-lg border border-pink-500/35 bg-pink-500/10 px-2.5 py-1 text-[11px] font-medium text-pink-200 hover:bg-pink-500/20"
        >
          Log period
        </button>
      </div>

      {summary.history.length > 0 && (
        <div className="mt-2.5 border-t border-white/[0.06] pt-2">
          <button
            type="button"
            onClick={onToggleHistory}
            className="flex w-full items-center justify-between gap-2 text-left text-[11px] font-medium text-white/50 hover:text-white/70"
          >
            <span>History ({summary.history.length})</span>
            <ChevronDown
              className={cn("h-3.5 w-3.5 shrink-0 transition-transform", historyExpanded && "rotate-180")}
              aria-hidden
            />
          </button>
          <ul className="mt-1.5 space-y-1">
            {visibleHistory.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-2 text-[11px] text-white/50">
                <span>
                  {formatDateEuropean(p.start_date)} → {formatDateEuropean(p.end_date)}
                </span>
                <button
                  type="button"
                  disabled={deletingId === p.id}
                  onClick={() => onRequestDeletePeriod(p.id)}
                  className="shrink-0 text-rose-300/80 hover:text-rose-200 disabled:opacity-40"
                >
                  {deletingId === p.id ? "…" : "Delete"}
                </button>
              </li>
            ))}
          </ul>
          {hasMoreHistory && !historyExpanded && (
            <button
              type="button"
              onClick={onToggleHistory}
              className="mt-1 text-[11px] font-medium text-pink-300/80 hover:text-pink-200"
            >
              Show {summary.history.length - 5} more
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export function AdminModelsClient({ modelss, modelIdToVaNames, periodSummaryByModelId, canCreate = false }: Props) {
  const router = useRouter();
  const { addToast } = useToast();
  const [localModelss, setLocalModelss] = React.useState(modelss);
  const [filterPlatform, setFilterPlatform] = React.useState("");
  const [filterStatus, setFilterStatus] = React.useState("");
  const [filterPriority, setFilterPriority] = React.useState("");
  const [filterChatter, setFilterChatter] = React.useState("");
  const [filterSearch, setFilterSearch] = React.useState("");
  const [recordStatusFilter, setRecordStatusFilter] = React.useState<"all" | "active" | "inactive">("all");
  const debouncedFilterChatter = useDebouncedValue(filterChatter, 300);
  const debouncedFilterSearch = useDebouncedValue(filterSearch, 300);
  const [viewFilter, setViewFilter] = React.useState<"all" | "free" | "taken">("all");
  const [modelPendingDelete, setModelPendingDelete] = React.useState<ModelRecord | null>(null);
  const [confirmingModelDelete, setConfirmingModelDelete] = React.useState(false);
  const [expandedHistoryByModelId, setExpandedHistoryByModelId] = React.useState<Record<string, boolean>>({});

  const [logModel, setLogModel] = React.useState<ModelRecord | null>(null);
  const [logStart, setLogStart] = React.useState("");
  const [logEnd, setLogEnd] = React.useState("");
  const [logNotes, setLogNotes] = React.useState("");
  const [logBusy, setLogBusy] = React.useState(false);
  const [logError, setLogError] = React.useState<string | null>(null);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);
  const [deletePeriodConfirmId, setDeletePeriodConfirmId] = React.useState<string | null>(null);

  React.useEffect(() => setLocalModelss(modelss), [modelss]);

  const openLog = (m: ModelRecord) => {
    const today = getTodayYmd();
    const len =
      typeof m.avg_period_length === "number" && m.avg_period_length > 0
        ? Math.min(14, Math.round(m.avg_period_length))
        : 5;
    setLogModel(m);
    setLogStart(today);
    setLogEnd(addDays(today, len - 1));
    setLogNotes("");
    setLogError(null);
  };

  const submitLog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!logModel) return;
    setLogBusy(true);
    setLogError(null);
    const res = await logPeriodAction(logModel.id, logStart, logEnd, logNotes.trim() || undefined);
    setLogBusy(false);
    if (!res.success) {
      setLogError(res.error);
      return;
    }
    setLogModel(null);
    router.refresh();
  };

  const runDeletePeriod = async (periodId: string) => {
    setDeletingId(periodId);
    const res = await deletePeriodAction(periodId);
    setDeletingId(null);
    if (!res.success) {
      alert(res.error);
      return;
    }
    setDeletePeriodConfirmId(null);
    router.refresh();
  };

  const requestDeletePeriod = (periodId: string) => {
    setDeletePeriodConfirmId(periodId);
  };

  const filtered = React.useMemo(() => {
    let list = localModelss;
    if (filterPlatform) list = list.filter((m) => m.platform === filterPlatform);
    if (filterStatus) list = list.filter((m) => (m.status ?? "") === filterStatus);
    if (filterPriority) list = list.filter((m) => (m.priority ?? "") === filterPriority);
    if (debouncedFilterChatter)
      list = list.filter((m) =>
        (m.current_chatter_name ?? "").toLowerCase().includes(debouncedFilterChatter.toLowerCase())
      );
    if (recordStatusFilter === "active") list = list.filter((m) => isActiveStatus(m.status ?? ""));
    if (recordStatusFilter === "inactive") list = list.filter((m) => isInactiveStatus(m.status ?? ""));
    if (viewFilter === "free") list = list.filter((m) => m.current_status === "free");
    if (viewFilter === "taken") list = list.filter((m) => m.current_status === "occupied");
    const q = debouncedFilterSearch.trim().toLowerCase();
    if (q) {
      list = list.filter((m) => {
        const hay = `${m.model_name ?? ""} ${m.platform ?? ""} ${m.current_chatter_name ?? ""}`.toLowerCase();
        return hay.includes(q);
      });
    }
    return list;
  }, [
    localModelss,
    filterPlatform,
    filterStatus,
    filterPriority,
    debouncedFilterChatter,
    debouncedFilterSearch,
    recordStatusFilter,
    viewFilter,
  ]);

  const { page, setPage, totalPages, pageItems, reset, total } = useClientPagination(filtered, 12);

  React.useEffect(() => {
    reset();
  }, [
    filterPlatform,
    filterStatus,
    filterPriority,
    debouncedFilterChatter,
    debouncedFilterSearch,
    recordStatusFilter,
    viewFilter,
    reset,
  ]);

  const platforms = React.useMemo(() => [...new Set(localModelss.map((m) => m.platform).filter(Boolean))].sort(), [localModelss]);
  const statuses = React.useMemo(() => [...new Set(localModelss.map((m) => m.status).filter(Boolean))].sort(), [localModelss]);
  const priorities = React.useMemo(() => [...new Set(localModelss.map((m) => m.priority).filter(Boolean))].sort(), [localModelss]);

  const platformSelectOptions = React.useMemo(
    () => [
      { value: "", label: "Platform" },
      ...platforms.map((p) => ({ value: p, label: p })),
    ],
    [platforms]
  );
  const statusSelectOptions = React.useMemo(
    () => [
      { value: "", label: "Status" },
      ...statuses.map((s) => ({ value: s, label: s })),
    ],
    [statuses]
  );
  const prioritySelectOptions = React.useMemo(
    () => [
      { value: "", label: "Priority" },
      ...priorities.map((p) => ({ value: p, label: p })),
    ],
    [priorities]
  );

  const freeCount = localModelss.filter((m) => m.current_status === "free").length;
  const takenCount = localModelss.length - freeCount;
  const activeCount = localModelss.filter((m) => isActiveStatus(m.status ?? "")).length;
  const inactiveCount = localModelss.length - activeCount;
  const inPeriodCount = React.useMemo(
    () => localModelss.filter((m) => periodSummaryByModelId[m.id]?.current != null).length,
    [localModelss, periodSummaryByModelId]
  );

  const hasActiveFilters =
    viewFilter !== "all" ||
    recordStatusFilter !== "all" ||
    Boolean(filterPlatform) ||
    Boolean(filterStatus) ||
    Boolean(filterPriority) ||
    filterChatter.trim().length > 0 ||
    filterSearch.trim().length > 0;

  const clearFilters = () => {
    setViewFilter("all");
    setRecordStatusFilter("all");
    setFilterPlatform("");
    setFilterStatus("");
    setFilterPriority("");
    setFilterChatter("");
    setFilterSearch("");
  };

  const handleConfirmDeleteModel = React.useCallback(async () => {
    if (!modelPendingDelete) return;
    const id = modelPendingDelete.id;
    const name = modelPendingDelete.model_name?.trim() || "Model";
    setConfirmingModelDelete(true);
    try {
      const res = await fetch(`/api/models/${encodeURIComponent(id)}`, { method: "DELETE" });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        addToast(localToast(`am-del-err-${Date.now()}`, "Could not delete", data.error ?? "Delete failed.", "high"));
        return;
      }
      setLocalModelss((prev) => prev.filter((m) => m.id !== id));
      setModelPendingDelete(null);
      addToast(localToast(`am-del-ok-${Date.now()}`, "Deleted", `${name} was removed.`, "normal"));
      router.refresh();
    } catch {
      addToast(localToast(`am-del-err-${Date.now()}`, "Could not delete", "Network error.", "high"));
    } finally {
      setConfirmingModelDelete(false);
    }
  }, [modelPendingDelete, addToast, router]);

  const statusTabs: { id: "all" | "free" | "taken"; label: string; count: number }[] = [
    { id: "all", label: "All", count: localModelss.length },
    { id: "free", label: "Free", count: freeCount },
    { id: "taken", label: "Taken", count: takenCount },
  ];

  const recordStatusTabs: { id: "all" | "active" | "inactive"; label: string; count: number }[] = [
    { id: "all", label: "All status", count: localModelss.length },
    { id: "active", label: "Active", count: activeCount },
    { id: "inactive", label: "Inactive", count: inactiveCount },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white">Models</h1>
          <p className="mt-1 text-sm text-white/60">
            {localModelss.length} models · {freeCount} free · {takenCount} occupied
          </p>
        </div>
        {canCreate ? (
          <Link
            href={ROUTES.accountsModelssNew}
            className="inline-flex min-h-[44px] items-center justify-center gap-2 self-start rounded-xl bg-[hsl(330,80%,55%)] px-5 py-2.5 text-sm font-medium text-white shadow-[0_0_28px_-8px_rgba(236,72,153,0.45)] transition hover:bg-[hsl(330,80%,50%)]"
          >
            <Plus className="h-4 w-4" aria-hidden />
            New model
          </Link>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2 border-b border-white/[0.06] pb-4">
        {statusTabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setViewFilter(tab.id)}
            className={cn(
              "inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition-all",
              viewFilter === tab.id
                ? "border-pink-500/40 bg-pink-500/15 text-pink-100 shadow-[0_0_20px_-8px_rgba(236,72,153,0.35)]"
                : "border-white/10 bg-white/[0.03] text-white/65 hover:border-white/20 hover:bg-white/[0.06] hover:text-white/90"
            )}
          >
            {tab.label}
            <span className="rounded-md bg-black/30 px-1.5 py-0.5 text-[11px] font-semibold text-white/70">
              {tab.count}
            </span>
          </button>
        ))}

        {recordStatusTabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setRecordStatusFilter(tab.id)}
            className={cn(
              "inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition-all",
              recordStatusFilter === tab.id
                ? "border-emerald-500/35 bg-emerald-500/12 text-emerald-100"
                : "border-white/10 bg-white/[0.03] text-white/65 hover:border-white/20 hover:bg-white/[0.06] hover:text-white/90"
            )}
          >
            {tab.label}
            <span className="rounded-md bg-black/30 px-1.5 py-0.5 text-[11px] font-semibold text-white/70">
              {tab.count}
            </span>
          </button>
        ))}

        <CustomSelect
          value={filterPlatform}
          onChange={setFilterPlatform}
          options={platformSelectOptions}
          className="w-36"
        />
        <CustomSelect
          value={filterStatus}
          onChange={setFilterStatus}
          options={statusSelectOptions}
          className="w-36"
        />
        <CustomSelect
          value={filterPriority}
          onChange={setFilterPriority}
          options={prioritySelectOptions}
          className="w-36"
        />

        <div className="relative w-full min-w-[160px] max-w-[220px] sm:w-52">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 z-[1] h-4 w-4 -translate-y-1/2 text-white/35"
            aria-hidden
          />
          <FormInput
            type="search"
            placeholder="Search models…"
            value={filterSearch}
            onChange={(e) => setFilterSearch(e.target.value)}
            className="!min-h-11 !py-3 pl-10"
            aria-label="Search models"
          />
        </div>

        <div className="relative w-full min-w-[160px] max-w-[220px] sm:w-52">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 z-[1] h-4 w-4 -translate-y-1/2 text-white/35"
            aria-hidden
          />
          <FormInput
            type="text"
            placeholder="Filter by chatter…"
            value={filterChatter}
            onChange={(e) => setFilterChatter(e.target.value)}
            className="!min-h-11 !py-3 pl-10"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <AdminStatCard label="Total" value={localModelss.length} accent />
        <AdminStatCard label="Active" value={activeCount} />
        <AdminStatCard label="Inactive" value={inactiveCount} />
        <AdminStatCard label="Free" value={freeCount} />
        <AdminStatCard label="In period" value={inPeriodCount} />
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/12 bg-white/[0.02] p-10 text-center">
          <p className="text-sm font-medium text-white/70">No models match filters</p>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="mt-4 inline-flex items-center rounded-xl border border-pink-500/35 bg-pink-500/10 px-4 py-2 text-sm font-medium text-pink-200 hover:bg-pink-500/20"
            >
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <div className="glass-card overflow-hidden">
          <div className="grid grid-cols-1 gap-4 p-4 md:grid-cols-2 md:p-5">
          <AnimatePresence mode="popLayout">
            {pageItems.map((m, index) => {
              const vaNames = modelIdToVaNames[m.id] ?? [];
              const summary = periodSummaryByModelId[m.id] ?? {
                current: null,
                predictedNextStart: null,
                history: [],
              };
              const inactive = isInactiveStatus(m.status);
              const isOccupied = m.current_status === "occupied";
              const notesPreview = m.notes?.trim()
                ? m.notes.trim().length > 80
                  ? `${m.notes.trim().slice(0, 80)}…`
                  : m.notes.trim()
                : null;

              return (
                <motion.article
                  key={m.id}
                  layout
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2, delay: index * 0.03, ease: "easeOut" }}
                  className={cn(
                    "flex flex-col overflow-hidden rounded-2xl border bg-white/[0.06] transition-[border-color,box-shadow,opacity]",
                    "hover:border-pink-500/20 hover:shadow-[0_12px_40px_-28px_rgba(236,72,153,0.2)]",
                    isOccupied ? "border-emerald-500/40" : "border-white/15",
                    inactive && "opacity-60"
                  )}
                  style={{ boxShadow: "0 0 0 1px rgba(255,255,255,0.04)" }}
                >
                  <header className="flex items-start gap-3 border-b border-white/[0.06] p-4">
                    <AdminRowAvatar name={m.model_name || "?"} size="sm" />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        {m.platform ? (
                          <span className="rounded-md border border-white/10 bg-white/[0.05] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-white/55 capitalize">
                            {m.platform}
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <h3 className="truncate text-base font-semibold text-white/95">{m.model_name}</h3>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <RecordStatusBadge status={m.status} />
                        {m.priority ? (
                          <span
                            className={cn(
                              "inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium capitalize",
                              priorityBadgeClass(m.priority)
                            )}
                          >
                            {m.priority}
                          </span>
                        ) : null}
                        {m.hasLinkedAccount === false ? (
                          <span className="rounded-full border border-amber-500/25 bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium text-amber-300">
                            No account linked
                          </span>
                        ) : null}
                        <IntegrationLinkBadge kind="infloww" linked={Boolean(m.infloww_creator_id?.trim())} />
                        <IntegrationLinkBadge kind="instagram" linked={Boolean(m.clariosuite_ig_user_id?.trim())} />
                      </div>
                    </div>
                    <div className="inline-flex shrink-0 items-center gap-0.5 rounded-xl border border-white/[0.08] bg-black/25 p-0.5">
                      <Link
                        href={ROUTES.admin.modelDetail(m.id)}
                        className="rounded-lg p-2 text-white/55 hover:bg-white/10 hover:text-white"
                        title="Admin model settings"
                      >
                        <Settings2 className="h-4 w-4" aria-hidden />
                      </Link>
                      <Link
                        href={ROUTES.modelEdit(m.id)}
                        className="rounded-lg p-2 text-white/55 hover:bg-pink-500/15 hover:text-pink-200"
                        title="Edit model"
                      >
                        <Pencil className="h-4 w-4" aria-hidden />
                      </Link>
                      <button
                        type="button"
                        disabled={confirmingModelDelete && modelPendingDelete?.id === m.id}
                        onClick={() => setModelPendingDelete(m)}
                        className="rounded-lg p-2 text-white/50 hover:bg-red-500/15 hover:text-red-300 disabled:opacity-50"
                        title="Delete model"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden />
                      </button>
                    </div>
                  </header>

                  <div className="px-4 pt-3">
                    <PeriodSection
                      summary={summary}
                      onLogClick={() => openLog(m)}
                      historyExpanded={Boolean(expandedHistoryByModelId[m.id])}
                      onToggleHistory={() =>
                        setExpandedHistoryByModelId((prev) => ({
                          ...prev,
                          [m.id]: !prev[m.id],
                        }))
                      }
                      deletingId={deletingId}
                      onRequestDeletePeriod={requestDeletePeriod}
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2">
                    <dl className="space-y-2.5 text-sm">
                      <div>
                        <dt className="text-[10px] font-medium uppercase tracking-wider text-white/40">Chatter</dt>
                        <dd className="mt-0.5 flex items-center gap-1.5 text-white/85">
                          <span
                            className={cn(
                              "h-1.5 w-1.5 shrink-0 rounded-full",
                              isOccupied ? "bg-emerald-400" : "bg-white/25"
                            )}
                            aria-hidden
                          />
                          {isOccupied ? m.current_chatter_name || "Occupied" : "Free"}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-[10px] font-medium uppercase tracking-wider text-white/40">VA</dt>
                        <dd className="mt-0.5 text-white/85">
                          {vaNames.length > 0 ? vaNames.join(", ") : "—"}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-[10px] font-medium uppercase tracking-wider text-white/40">Entered at</dt>
                        <dd className="mt-0.5 text-white/85">
                          {m.entered_at ? formatDateTimeEuropean(m.entered_at) : "—"}
                        </dd>
                      </div>
                    </dl>
                    <dl className="space-y-2.5 text-sm">
                      <div>
                        <dt className="text-[10px] font-medium uppercase tracking-wider text-white/40">Last chatter</dt>
                        <dd className="mt-0.5 text-white/85">{m.last_chatter_name?.trim() || "—"}</dd>
                      </div>
                      <div>
                        <dt className="text-[10px] font-medium uppercase tracking-wider text-white/40">Last exit</dt>
                        <dd className="mt-0.5 text-white/85">
                          {m.last_exit_at ? formatDateTimeEuropean(m.last_exit_at) : "—"}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-[10px] font-medium uppercase tracking-wider text-white/40">Priority</dt>
                        <dd className="mt-0.5 capitalize text-white/85">{m.priority || "—"}</dd>
                      </div>
                    </dl>
                  </div>

                  <footer className="mt-auto flex flex-wrap items-center gap-2 border-t border-white/[0.06] px-4 py-3">
                    {m.platform ? (
                      <span className="text-[11px] font-medium capitalize text-white/45">{m.platform}</span>
                    ) : null}
                    <span
                      className={cn(
                        "inline-flex shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide",
                        teamBadgeClass(m.team)
                      )}
                    >
                      {teamLabel(m.team)}
                    </span>
                    {notesPreview ? (
                      <span className="min-w-0 flex-1 truncate text-xs text-white/45" title={m.notes}>
                        {notesPreview}
                      </span>
                    ) : (
                      <span className="flex-1" />
                    )}
                  </footer>
                </motion.article>
              );
            })}
          </AnimatePresence>
          </div>
          <ListPagination
            page={page}
            totalPages={totalPages}
            total={total}
            pageSize={12}
            onPageChange={setPage}
          />
        </div>
      )}

      <ConfirmDialog
        open={modelPendingDelete != null}
        title="Delete model?"
        description={`This will permanently delete "${modelPendingDelete?.model_name?.trim() || "Model"}" and all linked data (shifts, assignments, requests, etc.). This cannot be undone.`}
        onClose={() => {
          if (!confirmingModelDelete) setModelPendingDelete(null);
        }}
        onConfirm={handleConfirmDeleteModel}
        confirmLabel="Delete permanently"
        confirmVariant="danger"
        loading={confirmingModelDelete}
        requireNameConfirmation
        nameToConfirm={modelPendingDelete?.model_name?.trim() || "Model"}
      />

      <ConfirmDialog
        open={deletePeriodConfirmId != null}
        onClose={() => deletingId == null && setDeletePeriodConfirmId(null)}
        onConfirm={() => {
          const id = deletePeriodConfirmId;
          if (id) return runDeletePeriod(id);
        }}
        title="Delete period record?"
        description="This removes the logged period from this model. This cannot be undone."
        confirmLabel="Delete"
        confirmVariant="danger"
        loading={deletingId != null}
      />

      {logModel && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 backdrop-blur-sm md:items-center">
          <div
            className="w-full max-w-md rounded-2xl border border-white/10 bg-black/95 p-6 shadow-2xl"
            role="dialog"
            aria-labelledby="log-period-title"
          >
            <h2 id="log-period-title" className="text-lg font-semibold text-white">
              Log period — {logModel.model_name}
            </h2>
            <form onSubmit={submitLog} className="mt-4 space-y-3">
              <div>
                <Label>Start date</Label>
                <FormInput type="date" value={logStart} onChange={(e) => setLogStart(e.target.value)} className="mt-1" required />
              </div>
              <div>
                <Label>End date</Label>
                <FormInput type="date" value={logEnd} onChange={(e) => setLogEnd(e.target.value)} className="mt-1" required />
              </div>
              <div>
                <Label>Notes</Label>
                <Textarea value={logNotes} onChange={(e) => setLogNotes(e.target.value)} rows={2} className="mt-1" />
              </div>
              {logError && <p className="text-sm text-red-300">{logError}</p>}
              <div className="flex flex-wrap gap-2 pt-2">
                <button
                  type="submit"
                  disabled={logBusy}
                  className="rounded-xl bg-[hsl(330,80%,55%)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                >
                  {logBusy ? "Saving…" : "Save"}
                </button>
                <button
                  type="button"
                  onClick={() => setLogModel(null)}
                  className="rounded-xl border border-white/20 px-4 py-2 text-sm text-white/80 hover:bg-white/10"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
