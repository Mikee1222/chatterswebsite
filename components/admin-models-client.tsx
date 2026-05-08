"use client";

import * as React from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Pencil, Search, Settings2, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/contexts/toast-context";
import type { AppNotification } from "@/types";
import { formatDateTimeEuropean, formatDateEuropean } from "@/lib/format";
import { Label, Textarea } from "@/components/ui/form";
import { FormInput } from "@/components/ui/form-input";
import { ROUTES } from "@/lib/routes";
import { cn } from "@/lib/utils";
import { AdminRowAvatar, RecordStatusBadge } from "@/components/admin-list-primitives";
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
};

function PeriodSection({
  summary,
  onLogClick,
}: {
  summary: ModelPeriodSummary;
  onLogClick: () => void;
}) {
  return (
    <div className="mt-3 rounded-xl border border-rose-500/20 bg-rose-500/5 px-3 py-3 text-xs text-white/75">
      <p className="font-semibold uppercase tracking-wider text-rose-200/80">Period</p>
      {summary.current ? (
        <p className="mt-1.5">
          In period until <span className="font-medium text-white">{formatDateEuropean(summary.current.end_date)}</span>
        </p>
      ) : summary.predictedNextStart ? (
        <p className="mt-1.5">
          Next predicted: <span className="font-medium text-white">{formatDateEuropean(summary.predictedNextStart)}</span>
        </p>
      ) : (
        <p className="mt-1.5 text-white/55">No period data yet.</p>
      )}
      <button
        type="button"
        onClick={onLogClick}
        className="mt-2 rounded-lg border border-rose-400/40 bg-rose-500/15 px-3 py-1.5 text-[11px] font-medium text-rose-100 hover:bg-rose-500/25"
      >
        Log period
      </button>
    </div>
  );
}

export function AdminModelsClient({ modelss, modelIdToVaNames, periodSummaryByModelId }: Props) {
  const router = useRouter();
  const { addToast } = useToast();
  const [localModelss, setLocalModelss] = React.useState(modelss);
  const [filterPlatform, setFilterPlatform] = React.useState("");
  const [filterStatus, setFilterStatus] = React.useState("");
  const [filterPriority, setFilterPriority] = React.useState("");
  const [filterChatter, setFilterChatter] = React.useState("");
  const [viewFilter, setViewFilter] = React.useState<"all" | "free" | "taken">("all");
  const [modelPendingDelete, setModelPendingDelete] = React.useState<ModelRecord | null>(null);
  const [confirmingModelDelete, setConfirmingModelDelete] = React.useState(false);

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
    if (filterChatter) list = list.filter((m) => (m.current_chatter_name ?? "").toLowerCase().includes(filterChatter.toLowerCase()));
    if (viewFilter === "free") list = list.filter((m) => m.current_status === "free");
    if (viewFilter === "taken") list = list.filter((m) => m.current_status === "occupied");
    return list;
  }, [localModelss, filterPlatform, filterStatus, filterPriority, filterChatter, viewFilter]);

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-white">Models</h1>
        <p className="mt-1 text-sm text-white/60">
          Model availability and current ownership. Table: modelss. Chatter occupancy vs VA presence.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <div className="inline-flex rounded-xl border border-white/10 bg-white/5 p-1">
          {(["all", "free", "taken"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setViewFilter(v)}
              className={`rounded-lg px-4 py-2 text-sm font-medium capitalize ${
                viewFilter === v
                  ? "bg-[hsl(330,80%,55%)]/20 text-[hsl(330,90%,65%)]"
                  : "text-white/70 hover:bg-white/5 hover:text-white"
              }`}
            >
              {v} {v === "free" && `(${freeCount})`} {v === "taken" && `(${takenCount})`}
            </button>
          ))}
        </div>
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
          <Search className="pointer-events-none absolute left-3 top-1/2 z-[1] h-4 w-4 -translate-y-1/2 text-white/35" aria-hidden />
          <FormInput
            type="text"
            placeholder="Filter by chatter…"
            value={filterChatter}
            onChange={(e) => setFilterChatter(e.target.value)}
            className="!min-h-11 !py-3 pl-10"
          />
        </div>
      </div>

      <div className="space-y-4 md:hidden">
        {filtered.length === 0 ? (
          <p className="rounded-2xl border border-white/10 bg-white/5 p-6 text-center text-white/50">No models match</p>
        ) : (
          filtered.map((m, index) => {
            const vaNames = modelIdToVaNames[m.id] ?? [];
            const summary = periodSummaryByModelId[m.id] ?? {
              current: null,
              predictedNextStart: null,
              history: [],
            };
            return (
              <motion.div
                key={m.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: index * 0.04, ease: "easeOut" }}
                whileHover={{ scale: 1.01 }}
                className="rounded-2xl border border-white/10 bg-white/[0.06] p-4 transition-[transform,box-shadow,border-color] duration-200 hover:border-pink-500/20 hover:shadow-[0_12px_40px_-24px_rgba(236,72,153,0.25)]"
                style={{ boxShadow: "0 0 0 1px rgba(255,255,255,0.04)" }}
              >
                <div className="flex items-start gap-3">
                  <AdminRowAvatar name={m.model_name || "?"} />
                  <div className="min-w-0 flex-1">
                    <p className="text-base font-semibold text-white/95">{m.model_name}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      {m.platform ? (
                        <span className="rounded-md border border-white/10 bg-white/[0.06] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-white/60">
                          {m.platform}
                        </span>
                      ) : null}
                      <RecordStatusBadge status={m.status} />
                      {m.hasLinkedAccount === false ? (
                        <span className="rounded-full border border-amber-500/25 bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium text-amber-300">
                          No account linked
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span
                    className={`inline-flex items-center gap-1.5 ${
                      m.current_status === "occupied"
                        ? "rounded-full border border-amber-500/30 bg-amber-500/15 px-2.5 py-1 text-xs font-medium text-amber-300"
                        : "rounded-full border border-emerald-500/30 bg-emerald-500/15 px-2.5 py-1 text-xs font-medium text-emerald-300"
                    }`}
                  >
                    <span
                      className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                        m.current_status === "occupied" ? "bg-amber-400 animate-pulse" : "bg-emerald-400 animate-pulse"
                      }`}
                      aria-hidden
                    />
                    {m.current_status === "occupied" ? m.current_chatter_name || "Occupied" : "Free"}
                  </span>
                  {vaNames.length > 0 && (
                    <span className="rounded-full border border-[hsl(330,80%,55%)]/30 bg-[hsl(330,80%,55%)]/15 px-2.5 py-1 text-xs text-[hsl(330,90%,75%)]">
                      VA: {vaNames.join(", ")}
                    </span>
                  )}
                </div>
                <div className="mt-3 space-y-1 text-sm text-white/70">
                  {m.entered_at && <p>Entered: {formatDateTimeEuropean(m.entered_at)}</p>}
                  {m.last_chatter_name && <p>Last chatter: {m.last_chatter_name}</p>}
                  {m.last_exit_at && <p>Last exit: {formatDateTimeEuropean(m.last_exit_at)}</p>}
                  {m.priority && <p>Priority: {m.priority}</p>}
                </div>
                <PeriodSection summary={summary} onLogClick={() => openLog(m)} />
                {summary.history.length > 0 && (
                  <div className="mt-2 space-y-1 border-t border-white/10 pt-2 text-[11px] text-white/50">
                    {summary.history.map((p) => (
                      <div key={p.id} className="flex items-center justify-between gap-2">
                        <span>
                          {formatDateEuropean(p.start_date)} → {formatDateEuropean(p.end_date)}
                        </span>
                        <button
                          type="button"
                          disabled={deletingId === p.id}
                          onClick={() => requestDeletePeriod(p.id)}
                          className="shrink-0 text-rose-300/80 hover:text-rose-200 disabled:opacity-40"
                        >
                          {deletingId === p.id ? "…" : "Delete"}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="mt-4 flex flex-wrap justify-end gap-2 border-t border-white/10 pt-3">
                  <Link
                    href={ROUTES.admin.modelDetail(m.id)}
                    className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/[0.04] px-3 py-2 text-sm text-white/85 transition-colors hover:border-white/25 hover:bg-white/[0.08] hover:text-white"
                  >
                    <Settings2 className="h-4 w-4" aria-hidden />
                    Admin
                  </Link>
                  <Link
                    href={ROUTES.modelEdit(m.id)}
                    className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/[0.04] px-3 py-2 text-sm text-white/85 transition-colors hover:border-pink-500/30 hover:bg-pink-500/10 hover:text-white"
                  >
                    <Pencil className="h-4 w-4" aria-hidden />
                    Edit
                  </Link>
                  <button
                    type="button"
                    disabled={confirmingModelDelete && modelPendingDelete?.id === m.id}
                    onClick={() => setModelPendingDelete(m)}
                    className="inline-flex items-center gap-2 rounded-lg border border-red-500/35 px-3 py-2 text-sm text-red-300/90 transition-colors hover:border-red-400/50 hover:bg-red-500/10 hover:text-red-200 disabled:opacity-50"
                    title="Delete model"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden />
                    Delete
                  </button>
                </div>
              </motion.div>
            );
          })
        )}
      </div>

      <div className="glass-card hidden overflow-x-auto md:block">
        <table className="w-full min-w-[960px] text-sm">
          <thead className="border-b border-white/10 bg-gradient-to-r from-black/60 via-black/50 to-pink-950/20 text-left text-xs font-medium uppercase tracking-wider text-white/50">
            <tr>
              <th className="p-3.5 font-medium">Model</th>
              <th className="p-3.5 font-medium min-w-[200px]">Period</th>
              <th className="p-3.5 font-medium">Chatter</th>
              <th className="p-3.5 font-medium">VA in model</th>
              <th className="p-3.5 font-medium">Entered at</th>
              <th className="p-3.5 font-medium">Last chatter</th>
              <th className="p-3.5 font-medium">Last exit</th>
              <th className="p-3.5 font-medium">Priority</th>
              <th className="p-3.5 font-medium w-[88px] text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.06]">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={9} className="p-8 text-center text-white/50">
                  No models match
                </td>
              </tr>
            ) : (
              <AnimatePresence mode="popLayout">
                {filtered.map((m, index) => {
                const vaNames = modelIdToVaNames[m.id] ?? [];
                const summary = periodSummaryByModelId[m.id] ?? {
                  current: null,
                  predictedNextStart: null,
                  history: [],
                };
                return (
                  <motion.tr
                    key={m.id}
                    layout
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2, delay: index * 0.04, ease: "easeOut" }}
                    className={cn(
                      "group transition-[background-color,box-shadow] duration-200 ease-out",
                      "hover:bg-gradient-to-r hover:from-white/[0.05] hover:to-pink-500/[0.04] hover:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04)]"
                    )}
                  >
                    <td className="p-3.5 align-top">
                      <div className="flex items-start gap-3">
                        <AdminRowAvatar name={m.model_name || "?"} className="ring-1 ring-white/10" />
                        <div className="min-w-0">
                          <p className="font-semibold text-white/95">{m.model_name}</p>
                          <div className="mt-1 flex flex-wrap items-center gap-1.5">
                            {m.platform ? (
                              <span className="rounded-md border border-white/10 bg-white/[0.05] px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-white/55">
                                {m.platform}
                              </span>
                            ) : null}
                            <RecordStatusBadge status={m.status} />
                            {m.hasLinkedAccount === false ? (
                              <span className="rounded-full border border-amber-500/25 bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium text-amber-300">
                                No account linked
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="p-3.5 align-top text-xs text-white/70">
                      <PeriodSection summary={summary} onLogClick={() => openLog(m)} />
                      {summary.history.length > 0 && (
                        <ul className="mt-2 max-h-32 space-y-1 overflow-y-auto border-t border-white/10 pt-2 text-[11px] text-white/50">
                          {summary.history.map((p) => (
                            <li key={p.id} className="flex items-start justify-between gap-2">
                              <span>
                                {formatDateEuropean(p.start_date)} → {formatDateEuropean(p.end_date)}
                              </span>
                              <button
                                type="button"
                                disabled={deletingId === p.id}
                                onClick={() => requestDeletePeriod(p.id)}
                                className="shrink-0 text-rose-300/80 hover:text-rose-200 disabled:opacity-40"
                              >
                                {deletingId === p.id ? "…" : "×"}
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </td>
                    <td className="p-3.5 align-top">
                      <span
                        className={`inline-flex items-center gap-1.5 ${
                          m.current_status === "occupied"
                            ? "rounded-full border border-amber-500/30 bg-amber-500/15 px-2 py-0.5 text-amber-300"
                            : "rounded-full border border-emerald-500/30 bg-emerald-500/15 px-2 py-0.5 text-emerald-300"
                        }`}
                      >
                        <span
                          className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                            m.current_status === "occupied" ? "bg-amber-400 animate-pulse" : "bg-emerald-400 animate-pulse"
                          }`}
                          aria-hidden
                        />
                        {m.current_status === "occupied" ? m.current_chatter_name || "Occupied" : "Free"}
                      </span>
                    </td>
                    <td className="p-3.5 align-top">
                      {vaNames.length > 0 ? (
                        <span className="rounded-full border border-[hsl(330,80%,55%)]/30 bg-[hsl(330,80%,55%)]/15 px-2 py-0.5 text-[hsl(330,90%,75%)]">
                          {vaNames.join(", ")}
                        </span>
                      ) : (
                        <span className="text-white/45">—</span>
                      )}
                    </td>
                    <td className="p-3.5 align-top text-white/70">{m.entered_at ? formatDateTimeEuropean(m.entered_at) : "—"}</td>
                    <td className="p-3.5 align-top text-white/70">{m.last_chatter_name || "—"}</td>
                    <td className="p-3.5 align-top text-white/70">{m.last_exit_at ? formatDateTimeEuropean(m.last_exit_at) : "—"}</td>
                    <td className="p-3.5 align-top text-white/60">{m.priority || "—"}</td>
                    <td className="p-3.5 align-top">
                      <div className="flex justify-end gap-1 opacity-90 transition-opacity group-hover:opacity-100">
                        <Link
                          href={ROUTES.admin.modelDetail(m.id)}
                          className="rounded-lg p-2 text-white/55 transition-colors hover:bg-white/10 hover:text-white"
                          title="Admin model settings"
                        >
                          <Settings2 className="h-4 w-4" aria-hidden />
                        </Link>
                        <Link
                          href={ROUTES.modelEdit(m.id)}
                          className="rounded-lg p-2 text-white/55 transition-colors hover:bg-pink-500/15 hover:text-pink-200"
                          title="Edit model"
                        >
                          <Pencil className="h-4 w-4" aria-hidden />
                        </Link>
                        <button
                          type="button"
                          disabled={confirmingModelDelete && modelPendingDelete?.id === m.id}
                          onClick={() => setModelPendingDelete(m)}
                          className="rounded-lg p-2 text-white/50 transition-colors hover:bg-red-500/15 hover:text-red-300 disabled:opacity-50"
                          title="Delete model"
                        >
                          <Trash2 className="h-4 w-4" aria-hidden />
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                );
              })}
              </AnimatePresence>
            )}
          </tbody>
        </table>
      </div>

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
