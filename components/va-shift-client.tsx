"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  startMistakeShiftWithModels,
  addModelToMistakeShift,
  removeModelFromMistakeShift,
  startBreak,
  endBreak,
  endMistakeShift,
} from "@/app/actions/shift";
import { ROUTES } from "@/lib/routes";
import { formatTimeFromISO, formatDateTimeEuropean } from "@/lib/format";
import { FormError } from "@/components/ui/form";
import { FormField } from "@/components/ui/form-field";
import { FormInput } from "@/components/ui/form-input";
import { Check, Coffee, Loader2, LogOut, Play, Plus, RefreshCw, Search, X } from "lucide-react";
import { motion } from "framer-motion";
import { LiveTimer } from "@/components/live-timer";
import { TodaySchedulePanel, TodayScheduleCollapsible, buildTodayLabel, type TodayScheduleItem } from "@/components/today-schedule-panel";
import type { Shift, ShiftModel, ModelRecord } from "@/types";
import { cn } from "@/lib/utils";

export type TodayScheduleData = {
  todayYmd: string;
  todayWeekday: string;
  items: TodayScheduleItem[];
};

type Props = {
  vaId: string;
  vaName: string;
  activeShift: Shift | null;
  shiftModels: ShiftModel[];
  modelss: ModelRecord[];
  maxBreakMinutes: number;
  todaySchedule?: TodayScheduleData;
  /** modelss record ids currently in an active period (today). */
  modelIdsInActivePeriodToday?: string[];
};

function formatEnteredAt(enteredAt: string | null): string {
  if (!enteredAt) return "—";
  return formatTimeFromISO(enteredAt);
}

function VaShiftBusyOverlay({
  show,
  title,
  subtitle,
}: {
  show: boolean;
  title: string;
  subtitle?: string;
}) {
  if (!show) return null;
  const node = (
    <div
      className="fixed inset-0 z-[200] flex flex-col items-center justify-center gap-4 bg-black/80 backdrop-blur-sm"
      role="alertdialog"
      aria-busy="true"
      aria-live="polite"
    >
      <div className="h-12 w-12 shrink-0 animate-spin rounded-full border-4 border-[hsl(330,80%,55%)] border-t-transparent" />
      <p className="text-lg font-semibold text-white">{title}</p>
      {subtitle ? <p className="text-sm text-white/40">{subtitle}</p> : null}
    </div>
  );
  if (typeof document !== "undefined") {
    return createPortal(node, document.body);
  }
  return node;
}

// VA can add any model (including occupied by chatter). Show all, filter only "already in shift".
function VaAddModelModal({
  modelss,
  alreadyInShiftModelIds,
  onSelect,
  onConfirm,
  onCancel,
  loading,
  error,
  selectedModelId,
  shiftInteractionLocked,
}: {
  modelss: ModelRecord[];
  alreadyInShiftModelIds: Set<string>;
  onSelect: (id: string | null) => void;
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
  error: string | null;
  selectedModelId: string | null;
  shiftInteractionLocked?: boolean;
}) {
  const locked = shiftInteractionLocked ?? false;
  const [search, setSearch] = React.useState("");
  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return modelss;
    return modelss.filter(
      (m) =>
        m.model_name.toLowerCase().includes(q) ||
        (m.current_chatter_name && m.current_chatter_name.toLowerCase().includes(q)),
    );
  }, [modelss, search]);
  const addable = filtered.filter((m) => !alreadyInShiftModelIds.has(m.id));
  const inShift = filtered.filter((m) => alreadyInShiftModelIds.has(m.id));

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-[#0a0a14]/98 backdrop-blur-md md:items-center md:justify-center md:p-4">
      <div className="absolute inset-0 bg-black/60" aria-hidden onClick={locked ? undefined : onCancel} />
      <div className="relative flex max-h-full min-h-0 w-full flex-1 flex-col overflow-hidden rounded-t-3xl border border-white/10 border-b-0 bg-[#0a0a14] shadow-2xl md:max-h-[85vh] md:max-w-lg md:rounded-3xl md:border-b">
        <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-5 py-4">
          <div>
            <h2 className="text-lg font-bold tracking-tight text-white">Add model</h2>
            <p className="mt-0.5 text-xs text-white/45">Any model — even if a chatter is in it.</p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={locked}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white/40 transition hover:bg-white/10 hover:text-white disabled:opacity-40"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="shrink-0 border-b border-white/8 px-5 py-3">
          <FormField label="Search" icon={<Search className="h-4 w-4" />} htmlFor="va-add-model-search">
            <FormInput
              id="va-add-model-search"
              type="search"
              placeholder="Model or chatter…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoComplete="off"
            />
          </FormField>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {error ? (
            <div className="mb-4">
              <FormError>{error}</FormError>
            </div>
          ) : null}
          {filtered.length === 0 ? (
            <p className="py-10 text-center text-sm text-white/40">No models match.</p>
          ) : (
            <ul className="space-y-2">
              {addable.map((m) => (
                <li key={m.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(selectedModelId === m.id ? null : m.id)}
                    disabled={locked}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-2xl border px-4 py-3.5 text-left transition-all",
                      selectedModelId === m.id
                        ? "border-pink-500/35 bg-pink-500/10"
                        : "border-white/10 bg-white/[0.03] hover:bg-white/[0.06]",
                      locked && "pointer-events-none opacity-40",
                    )}
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-pink-500/25 to-rose-500/20 text-sm font-bold text-pink-300">
                      {(m.model_name || "?").trim().slice(0, 1).toUpperCase() || "?"}
                    </div>
                    <span className="min-w-0 flex-1 font-medium text-white/95">{m.model_name}</span>
                    {m.current_status === "occupied" ? (
                      <span className="shrink-0 rounded-full bg-amber-500/20 px-2 py-0.5 text-xs text-amber-300">
                        {m.current_chatter_name || "Busy"}
                      </span>
                    ) : null}
                    {selectedModelId === m.id ? <Check className="h-4 w-4 shrink-0 text-pink-400" aria-hidden /> : null}
                  </button>
                </li>
              ))}
              {inShift.map((m) => (
                <li key={`in-${m.id}`}>
                  <div className="flex cursor-default items-center gap-3 rounded-2xl border border-white/8 bg-white/[0.02] px-4 py-3.5 opacity-70">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/10 text-sm font-bold text-white/40">
                      {(m.model_name || "?").trim().slice(0, 1).toUpperCase() || "?"}
                    </div>
                    <span className="min-w-0 flex-1 font-medium text-white/60">{m.model_name}</span>
                    <span className="shrink-0 rounded-full bg-sky-500/20 px-2 py-0.5 text-xs text-sky-300">In shift</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div
          className="flex shrink-0 flex-wrap items-center justify-end gap-3 border-t border-white/10 px-5 py-4"
          style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom, 0px))" }}
        >
          <button
            type="button"
            onClick={onCancel}
            disabled={locked}
            className="rounded-2xl border border-white/15 bg-white/5 px-5 py-3 text-sm font-semibold text-white/70 hover:bg-white/10 disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading || !selectedModelId || locked}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-pink-500 to-rose-500 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-pink-500/25 disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden /> : null}
            {loading ? "Adding…" : "Add to shift"}
          </button>
        </div>
      </div>
    </div>
  );
}

function VaModelSelectModalRow({
  m,
  selected,
  onToggle,
  disabled,
}: {
  m: ModelRecord;
  selected: boolean;
  onToggle: () => void;
  disabled?: boolean;
}) {
  return (
    <motion.button
      type="button"
      whileTap={disabled ? undefined : { scale: 0.99 }}
      onClick={() => !disabled && onToggle()}
      disabled={disabled}
      className={cn(
        "mb-2 flex w-full items-center gap-3 rounded-2xl border px-4 py-3.5 text-left transition-all",
        selected ? "border-pink-500/35 bg-pink-500/10" : "border-white/10 bg-white/[0.03] hover:bg-white/[0.06]",
        disabled && "cursor-not-allowed opacity-50",
      )}
    >
      <div
        className={cn(
          "flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-colors",
          selected ? "border-pink-500 bg-pink-500" : "border-white/25 bg-transparent",
        )}
      >
        {selected ? <Check className="h-3 w-3 text-white" strokeWidth={3} aria-hidden /> : null}
      </div>
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-pink-500/25 to-rose-500/20 text-sm font-bold text-pink-300">
        {(m.model_name || "?").trim().slice(0, 1).toUpperCase() || "?"}
      </div>
      <span className="min-w-0 flex-1 font-medium text-white/95">{m.model_name}</span>
      {m.current_status === "free" ? (
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs font-medium text-emerald-300">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" aria-hidden />
          Free
        </span>
      ) : (
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-500/20 px-2 py-0.5 text-xs font-medium text-amber-300">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-400" aria-hidden />
          {m.current_chatter_name ? `Chatter: ${m.current_chatter_name}` : "Busy"}
        </span>
      )}
    </motion.button>
  );
}

// VA can select any model to start (overlap allowed).
function VaModelSelectModal({
  modelss,
  selectedModelIds,
  onToggle,
  onConfirm,
  onCancel,
  loading,
  error,
  schedulePanel,
  modelIdsInActivePeriodToday = [],
}: {
  modelss: ModelRecord[];
  selectedModelIds: Set<string>;
  onToggle: (id: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
  error: string | null;
  schedulePanel: React.ReactNode;
  modelIdsInActivePeriodToday?: string[];
}) {
  const [search, setSearch] = React.useState("");
  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return modelss;
    return modelss.filter(
      (m) =>
        m.model_name.toLowerCase().includes(q) ||
        (m.current_chatter_name && m.current_chatter_name.toLowerCase().includes(q)),
    );
  }, [modelss, search]);

  const inPeriod = filtered.filter((m) => modelIdsInActivePeriodToday.includes(m.id));
  const rest = filtered.filter((m) => !modelIdsInActivePeriodToday.includes(m.id));

  const modalContent = (
    <div className="fixed inset-0 z-[100] flex flex-col bg-[#0a0a14]/98 backdrop-blur-md md:items-center md:justify-center md:p-4" role="dialog" aria-modal="true" aria-label="Select models for mistake shift">
      <div className="absolute inset-0 bg-black/60" aria-hidden onClick={loading ? undefined : onCancel} />
      <div
        className="relative ml-0 flex min-h-full min-w-0 flex-1 flex-col overflow-hidden md:ml-64 md:max-h-[85vh] md:min-h-0 md:w-[calc(100vw-16rem)] md:max-w-4xl md:flex-row md:items-stretch md:justify-center md:rounded-3xl md:border md:border-white/15 md:bg-[#0a0a14] md:shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden md:rounded-2xl">
          {schedulePanel ? <div className="shrink-0 border-b border-white/10 p-4 md:hidden">{schedulePanel}</div> : null}

          <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-5 py-4 md:px-6">
            <div>
              <h2 className="text-lg font-bold text-white md:text-xl">Select models</h2>
              <p className="mt-0.5 text-xs text-white/45 md:text-sm">All models — including those in active chatter shifts.</p>
            </div>
            <button
              type="button"
              onClick={onCancel}
              disabled={loading}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white/40 transition hover:bg-white/10 hover:text-white disabled:opacity-40"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="shrink-0 border-b border-white/8 px-5 py-3 md:px-6">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" aria-hidden />
              <input
                type="search"
                placeholder="Search models…"
                value={search}
                disabled={loading}
                onChange={(e) => setSearch(e.target.value)}
                autoComplete="off"
                className="w-full rounded-xl border border-white/10 bg-white/5 py-2.5 pl-10 pr-4 text-sm text-white placeholder:text-white/25 focus:border-pink-500/50 focus:outline-none disabled:opacity-50"
              />
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 md:max-h-[50vh]">
            {error ? (
              <div className="mb-4">
                <FormError>{error}</FormError>
              </div>
            ) : null}
            {filtered.length === 0 ? (
              <p className="py-10 text-center text-sm text-white/40">No models match.</p>
            ) : (
              <div className="space-y-6">
                {inPeriod.length > 0 ? (
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-amber-400/80">In period today</p>
                    <div>
                      {inPeriod.map((m) => (
                        <VaModelSelectModalRow key={m.id} m={m} selected={selectedModelIds.has(m.id)} onToggle={() => onToggle(m.id)} disabled={loading} />
                      ))}
                    </div>
                  </div>
                ) : null}
                <div>
                  {inPeriod.length > 0 ? (
                    <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-white/35">All models</p>
                  ) : null}
                  {rest.map((m) => (
                    <VaModelSelectModalRow key={m.id} m={m} selected={selectedModelIds.has(m.id)} onToggle={() => onToggle(m.id)} disabled={loading} />
                  ))}
                </div>
              </div>
            )}
          </div>

          <div
            className="flex shrink-0 items-center justify-end gap-3 border-t border-white/10 px-5 py-4 md:px-6"
            style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom, 0px))" }}
          >
            <button
              type="button"
              onClick={onCancel}
              disabled={loading}
              className="rounded-2xl border border-white/15 bg-white/5 px-5 py-3 text-sm font-semibold text-white/60 hover:bg-white/10 disabled:opacity-40"
            >
              Cancel
            </button>
            <motion.button
              type="button"
              onClick={onConfirm}
              disabled={loading || selectedModelIds.size === 0}
              whileTap={{ scale: 0.98 }}
              className="min-h-[44px] flex-1 rounded-2xl bg-gradient-to-r from-pink-500 to-rose-500 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-pink-500/25 disabled:opacity-40 md:min-h-0 md:flex-none"
            >
              {loading ? (
                <span className="inline-flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
                  Starting…
                </span>
              ) : (
                `Start mistake shift (${selectedModelIds.size} model${selectedModelIds.size !== 1 ? "s" : ""})`
              )}
            </motion.button>
          </div>
        </div>

        {schedulePanel ? (
          <div className="hidden w-72 shrink-0 border-l border-white/10 p-4 md:block md:self-stretch md:overflow-y-auto">{schedulePanel}</div>
        ) : null}
      </div>
    </div>
  );

  if (typeof document !== "undefined") {
    return createPortal(modalContent, document.body);
  }
  return modalContent;
}

export function VaShiftClient({
  vaId,
  vaName,
  activeShift,
  shiftModels,
  modelss,
  maxBreakMinutes,
  todaySchedule,
  modelIdsInActivePeriodToday = [],
}: Props) {
  const router = useRouter();
  const [refreshing, setRefreshing] = React.useState(false);
  const handleRefresh = React.useCallback(() => {
    setRefreshing(true);
    router.refresh();
    setTimeout(() => setRefreshing(false), 1000);
  }, [router]);

  const [showModelSelect, setShowModelSelect] = React.useState(false);
  const [selectedModelIds, setSelectedModelIds] = React.useState<Set<string>>(new Set());
  const [starting, setStarting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [successMessage, setSuccessMessage] = React.useState<string | null>(null);
  const [breakStartedAt, setBreakStartedAt] = React.useState<Date | null>(null);
  const [addingModelId, setAddingModelId] = React.useState<string | null>(null);
  const [removingId, setRemovingId] = React.useState<string | null>(null);
  const [ending, setEnding] = React.useState(false);
  const [showAddModelModal, setShowAddModelModal] = React.useState(false);
  const [selectedAddModelId, setSelectedAddModelId] = React.useState<string | null>(null);
  const [clientTotalBreakUsed, setClientTotalBreakUsed] = React.useState<number | null>(null);
  const [breakAction, setBreakAction] = React.useState<"idle" | "starting" | "ending">("idle");
  const [optimisticNotOnBreak, setOptimisticNotOnBreak] = React.useState(false);

  React.useEffect(() => {
    if (!successMessage) return;
    const t = setTimeout(() => setSuccessMessage(null), 4000);
    return () => clearTimeout(t);
  }, [successMessage]);

  const breakUsed = activeShift?.break_minutes ?? 0;
  const isOnBreak =
    !optimisticNotOnBreak && (activeShift?.status === "on_break" || breakStartedAt !== null);
  const breakStartTimeMs = isOnBreak && activeShift
    ? (activeShift.break_started_at ? new Date(activeShift.break_started_at).getTime() : breakStartedAt?.getTime() ?? null)
    : null;
  const breakStartedAtIso = activeShift?.break_started_at ?? breakStartedAt?.toISOString() ?? null;
  const totalBreakUsedDisplay = clientTotalBreakUsed !== null ? clientTotalBreakUsed : breakUsed;
  const remainingBreak = Math.max(0, maxBreakMinutes - totalBreakUsedDisplay);
  const shiftControlsBusy = breakAction !== "idle" || ending;
  const canStartBreak =
    activeShift &&
    activeShift.status === "active" &&
    !isOnBreak &&
    remainingBreak > 0 &&
    breakAction === "idle" &&
    !ending;

  React.useEffect(() => {
    if (optimisticNotOnBreak && activeShift?.status === "active") {
      setOptimisticNotOnBreak(false);
    }
  }, [optimisticNotOnBreak, activeShift?.status]);

  React.useEffect(() => {
    if (!isOnBreak || breakStartTimeMs === null) {
      setClientTotalBreakUsed(null);
      return;
    }
    const tick = () => setClientTotalBreakUsed(breakUsed + Math.floor((Date.now() - breakStartTimeMs) / 60000));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [isOnBreak, breakStartTimeMs, breakUsed]);

  function toggleModelSelection(id: string) {
    setSelectedModelIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleConfirmModelSelection() {
    setError(null);
    setStarting(true);
    try {
      const result = await startMistakeShiftWithModels(vaId, vaName, Array.from(selectedModelIds));
      if (!result || typeof result !== "object" || !("success" in result)) {
        setError("Something went wrong. Please try again.");
        return;
      }
      if (!result.success) {
        setError(result.error ?? "Something went wrong. Please try again.");
        return;
      }
      setShowModelSelect(false);
      setSelectedModelIds(new Set());
      setSuccessMessage("Mistake shift started. Loading…");
      if (result.redirectTo) router.push(result.redirectTo);
      else router.refresh();
    } finally {
      setStarting(false);
    }
  }

  async function handleConfirmAddModel() {
    const model = modelss.find((m) => m.id === selectedAddModelId);
    if (!model || !activeShift) return;
    setError(null);
    setAddingModelId(model.id);
    try {
      const result = await addModelToMistakeShift({
        shiftRecordId: activeShift.id,
        modelRecordId: model.id,
        modelName: model.model_name,
        vaRecordId: vaId,
        vaName,
      });
      if (!result || typeof result !== "object" || !result.success) {
        setError(result?.error ?? "Something went wrong. Please try again.");
      } else {
        setShowAddModelModal(false);
        setSelectedAddModelId(null);
        setSuccessMessage("Model added.");
        router.refresh();
      }
    } finally {
      setAddingModelId(null);
    }
  }

  async function handleRemoveModel(sm: ShiftModel) {
    if (!activeShift) return;
    setError(null);
    setRemovingId(sm.id);
    try {
      const result = await removeModelFromMistakeShift(sm.id, activeShift.id);
      if (!result || typeof result !== "object" || !result.success) {
        setError(result?.error ?? "Something went wrong. Please try again.");
      } else {
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove model");
    } finally {
      setRemovingId(null);
    }
  }

  async function handleStartBreak() {
    if (!activeShift) return;
    setError(null);
    setBreakAction("starting");
    setBreakStartedAt(new Date());
    try {
      const result = await startBreak(activeShift.id);
      if (result && "success" in result && !result.success) {
        setBreakStartedAt(null);
        setError(result.error);
        return;
      }
      router.refresh();
    } catch (err) {
      setBreakStartedAt(null);
      setError(err instanceof Error ? err.message : "Failed to start break");
    } finally {
      setBreakAction("idle");
    }
  }

  async function handleEndBreak() {
    if (!activeShift) return;
    setError(null);
    const bStartMs = breakStartTimeMs ?? (breakStartedAt != null ? breakStartedAt.getTime() : null);
    const elapsed = bStartMs != null ? Math.max(1, Math.ceil((Date.now() - bStartMs) / 60000)) : 1;
    const usedForCap = clientTotalBreakUsed !== null ? clientTotalBreakUsed : breakUsed;
    const remainingSnap = Math.max(0, maxBreakMinutes - usedForCap);
    const additionalBreak = Math.min(elapsed, remainingSnap + elapsed);

    setBreakAction("ending");
    setOptimisticNotOnBreak(true);
    setBreakStartedAt(null);
    try {
      await endBreak(activeShift.id, additionalBreak);
      router.refresh();
    } catch (err) {
      setOptimisticNotOnBreak(false);
      setError(err instanceof Error ? err.message : "Failed to end break");
      void router.refresh();
    } finally {
      setBreakAction("idle");
    }
  }

  async function handleEndShift() {
    if (!activeShift) return;
    setEnding(true);
    setError(null);
    try {
      await endMistakeShift(activeShift.id);
      setBreakStartedAt(null);
      setSuccessMessage("Mistake shift ended.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to end shift");
    } finally {
      setEnding(false);
    }
  }

  if (!activeShift) {
    return (
      <div className="space-y-6 pb-24 md:pb-0">
        <VaShiftBusyOverlay show={starting} title="Starting shift…" subtitle="Attaching models" />

        {error ? (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-5 py-4 text-sm text-red-300">{error}</div>
        ) : null}
        {successMessage ? (
          <div className="rounded-2xl border border-pink-500/30 bg-pink-500/10 px-5 py-4 text-sm text-pink-200">{successMessage}</div>
        ) : null}

        {todaySchedule ? (
          <TodaySchedulePanel
            todayLabel={buildTodayLabel(todaySchedule.todayYmd, todaySchedule.todayWeekday)}
            items={todaySchedule.items}
            title="Today's assigned models to review"
            emptyMessage="No scheduled models today"
          />
        ) : null}

        <div
          className="glass-panel relative overflow-hidden p-6 md:p-10"
          style={{ boxShadow: "0 0 0 1px rgba(255,255,255,0.05), 0 0 48px -12px hsl(330 80% 55% / 0.12)" }}
        >
          <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-pink-500/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-rose-500/[0.08] blur-3xl" />

          <div className="relative flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-pink-500/25 bg-pink-500/10 px-3 py-1.5">
                <div className="h-2 w-2 rounded-full bg-pink-400" />
                <span className="text-xs font-semibold uppercase tracking-widest text-pink-300">Mistake shift</span>
              </div>
              <h2 className="text-2xl font-bold tracking-tight text-white md:text-4xl">Start a mistake shift</h2>
              <p className="mt-2 text-sm text-white/50 md:text-base">
                Review chatter errors across models. You can add any model — even ones currently in a chatter shift.
              </p>
              <div className="mt-6 flex flex-wrap gap-4">
                <div className="flex items-center gap-2.5 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5">
                  <span className="text-xl" aria-hidden>
                    🎭
                  </span>
                  <div>
                    <p className="text-lg font-bold text-white">{modelss.length}</p>
                    <p className="text-xs text-white/40">Models available</p>
                  </div>
                </div>
                <div className="flex items-center gap-2.5 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5">
                  <span className="text-xl" aria-hidden>
                    ⏱
                  </span>
                  <div>
                    <p className="text-lg font-bold text-white">{maxBreakMinutes}m</p>
                    <p className="text-xs text-white/40">Max break</p>
                  </div>
                </div>
              </div>
              <motion.button
                type="button"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setShowModelSelect(true)}
                disabled={starting}
                className="mt-8 inline-flex items-center gap-3 rounded-2xl bg-gradient-to-r from-pink-500 to-rose-500 px-8 py-4 text-base font-bold text-white shadow-lg shadow-pink-500/25 transition-all hover:shadow-pink-500/40 hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Play className="h-5 w-5 shrink-0" aria-hidden />
                Start mistake shift
              </motion.button>
            </div>
            <button
              type="button"
              onClick={handleRefresh}
              disabled={starting}
              className="flex shrink-0 items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/50 transition hover:bg-white/10 hover:text-white disabled:opacity-40"
            >
              <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} aria-hidden />
              {refreshing ? "Refreshing…" : "Refresh"}
            </button>
          </div>
        </div>

        <div>
          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs font-medium uppercase tracking-widest text-white/40">All models</p>
            <Link href={ROUTES.va.models} className="text-xs font-medium text-pink-400 transition hover:text-pink-300">
              View all →
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
            {modelss.slice(0, 8).map((m) => (
              <div
                key={m.id}
                className="flex items-center gap-2.5 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 transition-all hover:bg-white/[0.06]"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-pink-500/25 bg-gradient-to-br from-pink-500/30 to-rose-500/25 text-sm font-bold text-pink-300">
                  {(m.model_name || "?").trim().slice(0, 1).toUpperCase() || "?"}
                </div>
                <span className="truncate text-sm font-medium text-white/75">{m.model_name}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-white/60">Live shifts</h3>
          <p className="mt-1 text-xs text-white/40">See who is on shift agency-wide.</p>
          <Link
            href={ROUTES.va.liveShifts}
            className="mt-4 inline-flex rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm font-medium text-white/90 transition hover:bg-white/10"
          >
            View live shifts →
          </Link>
        </div>

        {showModelSelect ? (
          <VaModelSelectModal
            modelss={modelss}
            selectedModelIds={selectedModelIds}
            onToggle={toggleModelSelection}
            onConfirm={handleConfirmModelSelection}
            onCancel={() => {
              setShowModelSelect(false);
              setError(null);
            }}
            loading={starting}
            error={error}
            modelIdsInActivePeriodToday={modelIdsInActivePeriodToday}
            schedulePanel={
              todaySchedule ? (
                <TodayScheduleCollapsible
                  todayLabel={buildTodayLabel(todaySchedule.todayYmd, todaySchedule.todayWeekday)}
                  items={todaySchedule.items}
                  title="Today's assigned models to review"
                  emptyMessage="No scheduled models today"
                />
              ) : null
            }
          />
        ) : null}
      </div>
    );
  }

  const startedAtLabel = activeShift.start_time ? formatDateTimeEuropean(activeShift.start_time) : "—";
  const statusLabel =
    breakAction === "starting" ? "On break…" : breakAction === "ending" ? "Ending break…" : isOnBreak ? "On break" : "Running";
  const statusBadgeColor =
    isOnBreak || breakAction === "starting" || breakAction === "ending"
      ? "bg-amber-500/20 text-amber-300 border-amber-500/30"
      : "bg-emerald-500/20 text-emerald-300 border-emerald-500/30";

  return (
    <>
      <VaShiftBusyOverlay show={ending} title="Ending shift…" subtitle="Saving records" />

      <div className={cn("space-y-5 pb-28 md:space-y-6 md:pb-0", ending && "pointer-events-none opacity-70")}>
        {error ? (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-5 py-4 text-sm text-red-300">{error}</div>
        ) : null}
        {successMessage ? (
          <div className="rounded-2xl border border-pink-500/30 bg-pink-500/10 px-5 py-4 text-sm text-pink-200">{successMessage}</div>
        ) : null}

        <div
          className="glass-panel relative overflow-hidden p-5 md:p-8"
          style={{ boxShadow: "0 0 0 1px rgba(255,255,255,0.05), 0 0 48px -12px hsl(330 80% 55% / 0.12)" }}
        >
          <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-green-500/10 blur-3xl" />

          <div className="relative">
            <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-green-500/30 bg-green-500/20">
                  <div className="h-3 w-3 animate-pulse rounded-full bg-green-400" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white md:text-2xl">Mistake shift active</h2>
                  <p className="mt-0.5 text-xs text-white/45">{isOnBreak ? "☕ On break" : "Reviewing mistakes"}</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium", statusBadgeColor)}>
                  <span
                    className={cn(
                      "h-1.5 w-1.5 shrink-0 rounded-full",
                      isOnBreak || breakAction === "starting" || breakAction === "ending" ? "animate-pulse bg-amber-400" : "animate-pulse bg-emerald-400",
                    )}
                    aria-hidden
                  />
                  {statusLabel}
                </span>
                <button
                  type="button"
                  onClick={handleRefresh}
                  className="flex items-center justify-center rounded-xl border border-white/10 bg-white/5 p-2 text-white/45 transition hover:bg-white/10 hover:text-white"
                  aria-label="Refresh"
                >
                  <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
                </button>
              </div>
            </div>

            <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                <p className="text-xs text-white/35">▶ Started</p>
                <p className="mt-1 text-sm font-bold text-white">{startedAtLabel}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                <p className="text-xs text-white/35">⏱ Duration</p>
                <p className="mt-1 font-mono text-lg font-bold tabular-nums text-pink-200 md:text-xl">
                  {activeShift.start_time ? <LiveTimer startTime={activeShift.start_time} /> : "—"}
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                <p className="text-xs text-white/35">🎭 Models</p>
                <p className="mt-1 text-sm font-bold text-white">{shiftModels.length}</p>
              </div>
            </div>

            <div className="hidden flex-wrap gap-3 md:flex">
              <motion.button
                type="button"
                whileTap={{ scale: 0.97 }}
                onClick={() => {
                  setSelectedAddModelId(null);
                  setError(null);
                  setShowAddModelModal(true);
                }}
                disabled={shiftControlsBusy}
                className="inline-flex items-center gap-2 rounded-2xl border border-white/15 bg-white/10 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Plus className="h-4 w-4" aria-hidden />
                Add model
              </motion.button>
              {canStartBreak ? (
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.97 }}
                  onClick={handleStartBreak}
                  disabled={shiftControlsBusy}
                  className="inline-flex items-center gap-2 rounded-2xl border border-amber-500/30 bg-amber-500/15 px-5 py-3 text-sm font-semibold text-amber-200 transition hover:bg-amber-500/25 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Coffee className="h-4 w-4" aria-hidden />
                  Start break
                </motion.button>
              ) : null}
              {isOnBreak ? (
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.97 }}
                  onClick={handleEndBreak}
                  disabled={shiftControlsBusy}
                  className="inline-flex items-center gap-2 rounded-2xl border border-emerald-500/30 bg-emerald-500/15 px-5 py-3 text-sm font-semibold text-emerald-200 transition hover:bg-emerald-500/25 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {breakAction === "ending" ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden /> : <Play className="h-4 w-4" aria-hidden />}
                  {breakAction === "ending" ? "Ending break…" : "End break"}
                </motion.button>
              ) : null}
              <motion.button
                type="button"
                whileTap={{ scale: 0.97 }}
                onClick={handleEndShift}
                disabled={ending || shiftControlsBusy}
                className="ml-auto inline-flex items-center gap-2 rounded-2xl border border-red-500/35 bg-red-500/15 px-5 py-3 text-sm font-semibold text-red-300 transition hover:bg-red-500/25 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {ending ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden /> : <LogOut className="h-4 w-4" aria-hidden />}
                {ending ? "Ending…" : "End shift"}
              </motion.button>
            </div>
          </div>
        </div>

        {(isOnBreak || breakUsed > 0) && (
          <div
            className={cn(
              "rounded-2xl border px-5 py-4",
              isOnBreak ? "border-amber-500/30 bg-amber-500/10" : "border-white/10 bg-white/[0.03]",
            )}
          >
            <div className="flex flex-wrap items-start gap-3">
              <Coffee className={cn("mt-0.5 h-5 w-5 shrink-0", isOnBreak ? "text-amber-400" : "text-white/30")} aria-hidden />
              <div className="min-w-0 flex-1">
                <p className={cn("text-sm font-semibold", isOnBreak ? "text-amber-300" : "text-white/50")}>
                  {isOnBreak ? "On break" : "Break usage"}
                </p>
                <p className="mt-1 text-xs text-white/40">
                  {breakStartedAtIso ? (
                    <>
                      Started {formatEnteredAt(breakStartedAtIso)}
                      {" · "}
                    </>
                  ) : null}
                  {totalBreakUsedDisplay} / {maxBreakMinutes} min used · {remainingBreak} min remaining
                </p>
                {isOnBreak && breakStartedAtIso ? (
                  <div className="mt-3 font-mono text-xl tabular-nums text-amber-100">
                    <LiveTimer startTime={breakStartedAtIso} mode="break" />
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        )}

        <div>
          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-widest text-white/40">Active models ({shiftModels.length})</p>
            <button
              type="button"
              onClick={() => {
                setSelectedAddModelId(null);
                setError(null);
                setShowAddModelModal(true);
              }}
              className="inline-flex items-center gap-1 text-xs font-semibold text-pink-400 transition hover:text-pink-300"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden />
              Add model
            </button>
          </div>

          {shiftModels.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/15 py-10 text-center">
              <p className="text-sm text-white/30">No models in this shift yet</p>
              <button
                type="button"
                onClick={() => {
                  setSelectedAddModelId(null);
                  setError(null);
                  setShowAddModelModal(true);
                }}
                className="mt-3 text-sm font-medium text-pink-400 hover:text-pink-300"
              >
                + Add a model
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {(() => {
                const names = shiftModels
                  .filter((sm) => modelIdsInActivePeriodToday.includes(sm.model_id))
                  .map((sm) => sm.model_name)
                  .filter(Boolean);
                if (names.length === 0) return null;
                return (
                  <p className="mb-3 rounded-xl border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-xs text-amber-100/95">
                    ⚠️ {names.join(", ")} may have content restrictions today
                  </p>
                );
              })()}
              {shiftModels.map((sm) => (
                <div
                  key={sm.id}
                  className="group flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 transition-all hover:bg-white/[0.05]"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-pink-500/20 bg-gradient-to-br from-pink-500/20 to-rose-500/15 text-sm font-bold text-pink-300">
                    {(sm.model_name || "?").trim().slice(0, 1).toUpperCase() || "?"}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-white">{sm.model_name}</p>
                    <p className="text-xs text-white/35">Entered {formatEnteredAt(sm.entered_at)}</p>
                    {modelIdsInActivePeriodToday.includes(sm.model_id) ? (
                      <p className="mt-1 text-[11px] text-amber-200/90">⚠️ Possible content restrictions today</p>
                    ) : null}
                  </div>
                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.95 }}
                    onClick={() => handleRemoveModel(sm)}
                    disabled={removingId === sm.id || shiftControlsBusy}
                    className="rounded-xl p-2 text-white/25 opacity-0 transition-all hover:bg-red-500/10 hover:text-red-400 group-hover:opacity-100 disabled:cursor-not-allowed disabled:opacity-30"
                    aria-label={`Remove ${sm.model_name}`}
                  >
                    {removingId === sm.id ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <X className="h-4 w-4" aria-hidden />}
                  </motion.button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="glass-card rounded-2xl border border-white/10 p-5">
            <h3 className="text-xs font-bold uppercase tracking-widest text-white/45">Break tracker</h3>
            <p className="mt-2 font-mono text-2xl tabular-nums text-white">
              {totalBreakUsedDisplay} <span className="text-white/40">/ {maxBreakMinutes}</span> min
            </p>
            <p className="mt-1 text-xs text-white/40">{remainingBreak} min remaining</p>
          </div>
          <div className="glass-card rounded-2xl border border-white/10 p-5">
            <h3 className="text-xs font-bold uppercase tracking-widest text-white/45">Shift details</h3>
            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-white/45">Started</dt>
                <dd className="text-right font-medium text-white/90">{startedAtLabel}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-white/45">Models</dt>
                <dd className="text-right font-medium text-white/90">{shiftModels.length}</dd>
              </div>
            </dl>
          </div>
        </div>
      </div>

      <div
        className="fixed bottom-0 left-0 right-0 z-40 flex gap-2 border-t border-white/10 bg-[#0a0a14]/95 px-4 py-3 backdrop-blur-xl md:hidden"
        style={{
          bottom: "calc(var(--mobile-bottom-nav-height, 76px) + env(safe-area-inset-bottom, 0px))",
          paddingBottom: "max(0.75rem, env(safe-area-inset-bottom, 0px))",
          boxShadow: "0 -4px 24px rgba(0,0,0,0.45)",
        }}
      >
        <button
          type="button"
          onClick={() => {
            setSelectedAddModelId(null);
            setError(null);
            setShowAddModelModal(true);
          }}
          disabled={shiftControlsBusy}
          className="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/10 py-3 text-sm font-semibold text-white disabled:opacity-40"
        >
          <Plus className="h-4 w-4" aria-hidden />
          Add model
        </button>
        {canStartBreak ? (
          <button
            type="button"
            onClick={handleStartBreak}
            disabled={shiftControlsBusy}
            className="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-amber-500/30 bg-amber-500/15 py-3 text-sm font-semibold text-amber-300 disabled:opacity-40"
          >
            <Coffee className="h-4 w-4" aria-hidden />
            Break
          </button>
        ) : null}
        {isOnBreak ? (
          <button
            type="button"
            onClick={handleEndBreak}
            disabled={shiftControlsBusy}
            className="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-emerald-500/30 bg-emerald-500/15 py-3 text-sm font-semibold text-emerald-300 disabled:opacity-40"
          >
            {breakAction === "ending" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Play className="h-4 w-4" aria-hidden />}
            End break
          </button>
        ) : null}
        <button
          type="button"
          onClick={handleEndShift}
          disabled={ending || shiftControlsBusy}
          className="flex items-center justify-center gap-2 rounded-2xl border border-red-500/35 bg-red-500/15 px-4 py-3 text-sm font-semibold text-red-300 disabled:opacity-50"
          aria-label="End shift"
        >
          {ending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <LogOut className="h-4 w-4" aria-hidden />}
        </button>
      </div>

      {showAddModelModal ? (
        <VaAddModelModal
          modelss={modelss}
          alreadyInShiftModelIds={new Set(shiftModels.map((sm) => sm.model_id))}
          selectedModelId={selectedAddModelId}
          onSelect={setSelectedAddModelId}
          onConfirm={handleConfirmAddModel}
          onCancel={() => {
            setShowAddModelModal(false);
            setSelectedAddModelId(null);
            setError(null);
          }}
          loading={Boolean(selectedAddModelId && addingModelId === selectedAddModelId)}
          shiftInteractionLocked={shiftControlsBusy}
          error={error}
        />
      ) : null}
    </>
  );
}
