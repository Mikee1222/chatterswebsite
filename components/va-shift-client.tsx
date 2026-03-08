"use client";

import * as React from "react";
import { createPortal } from "react-dom";
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
import { Input, FormError } from "@/components/ui/form";
import { LiveTimer } from "@/components/live-timer";
import { TodaySchedulePanel, TodayScheduleCollapsible, buildTodayLabel, type TodayScheduleItem } from "@/components/today-schedule-panel";
import type { Shift, ShiftModel, ModelRecord } from "@/types";

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
};

function parseStartTime(startTime: string | null): number | null {
  if (!startTime) return null;
  const d = new Date(startTime);
  return isNaN(d.getTime()) ? null : d.getTime();
}

function formatEnteredAt(enteredAt: string | null): string {
  if (!enteredAt) return "—";
  return formatTimeFromISO(enteredAt);
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
}: {
  modelss: ModelRecord[];
  alreadyInShiftModelIds: Set<string>;
  onSelect: (id: string | null) => void;
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
  error: string | null;
  selectedModelId: string | null;
}) {
  const [search, setSearch] = React.useState("");
  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return modelss;
    return modelss.filter(
      (m) =>
        m.model_name.toLowerCase().includes(q) ||
        (m.current_chatter_name && m.current_chatter_name.toLowerCase().includes(q))
    );
  }, [modelss, search]);
  const addable = filtered.filter((m) => !alreadyInShiftModelIds.has(m.id));
  const inShift = filtered.filter((m) => alreadyInShiftModelIds.has(m.id));

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center md:p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" aria-hidden onClick={onCancel} />
      <div className="relative flex max-h-[90dvh] w-full flex-col rounded-t-2xl border border-white/10 border-b-0 bg-black/95 shadow-2xl md:max-h-[85vh] md:w-full md:max-w-lg md:rounded-3xl md:border md:bg-black/90 md:shadow-black/50 md:backdrop-blur-xl">
        <div className="shrink-0 border-b border-white/10 px-4 py-4 md:px-6 md:py-5">
          <h2 className="text-lg font-semibold tracking-tight text-white md:text-xl">Add model to mistake shift</h2>
          <p className="mt-1 text-sm text-white/55">
            You can enter any model (even if a chatter is in it). Select one to add.
          </p>
          <div className="mt-3 md:mt-4">
            <Input
              type="search"
              placeholder="Search by model or chatter…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="py-2.5 md:py-3"
            />
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4 md:max-h-[50vh] md:flex-none">
          {error && (
            <div className="mb-4">
              <FormError>{error}</FormError>
            </div>
          )}
          {filtered.length === 0 ? (
            <p className="py-8 text-center text-sm text-white/50">No models match.</p>
          ) : (
            <ul className="space-y-2">
              {addable.map((m) => (
                <li key={m.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(selectedModelId === m.id ? null : m.id)}
                    className={`flex w-full items-center gap-4 rounded-xl border px-4 py-3 text-left transition-colors hover:bg-white/[0.09] ${
                      selectedModelId === m.id ? "border-[hsl(330,80%,55%)]/50 bg-[hsl(330,80%,55%)]/10" : "border-white/10 bg-white/[0.06]"
                    }`}
                  >
                    <span className="font-medium text-white/95">{m.model_name}</span>
                    {m.current_status === "occupied" && (
                      <span className="ml-auto rounded-full bg-amber-500/20 px-2 py-0.5 text-xs text-amber-300">
                        Chatter: {m.current_chatter_name || "—"}
                      </span>
                    )}
                    {selectedModelId === m.id && <span className="text-[hsl(330,90%,75%)]">Selected</span>}
                  </button>
                </li>
              ))}
              {inShift.map((m) => (
                <li key={m.id}>
                  <div className="flex cursor-default items-center gap-4 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 opacity-75">
                    <span className="font-medium text-white/70">{m.model_name}</span>
                    <span className="ml-auto rounded-full bg-sky-500/20 px-2 py-0.5 text-xs text-sky-300">In your shift</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="flex flex-wrap items-center justify-end gap-3 border-t border-white/10 p-4">
          <button type="button" onClick={onCancel} className="rounded-xl border border-white/15 px-4 py-2.5 text-sm font-medium text-white/80 hover:bg-white/5">
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading || !selectedModelId}
            className="rounded-xl bg-[hsl(330,80%,55%)] px-5 py-2.5 text-sm font-medium text-white hover:bg-[hsl(330,80%,50%)] disabled:opacity-50"
          >
            {loading ? "Adding…" : "Add to shift"}
          </button>
        </div>
      </div>
    </div>
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
}: {
  modelss: ModelRecord[];
  selectedModelIds: Set<string>;
  onToggle: (id: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
  error: string | null;
  schedulePanel: React.ReactNode;
}) {
  const [search, setSearch] = React.useState("");
  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return modelss;
    return modelss.filter(
      (m) =>
        m.model_name.toLowerCase().includes(q) ||
        (m.current_chatter_name && m.current_chatter_name.toLowerCase().includes(q))
    );
  }, [modelss, search]);

  const modalContent = (
    <div className="fixed inset-0 z-[100] flex" role="dialog" aria-modal="true" aria-label="Select models for mistake shift">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" aria-hidden onClick={onCancel} />
      {/* Mobile: full-screen sheet (stacked: Today card → search → list → bottom bar); desktop: centered two-column */}
      <div className="relative ml-0 flex min-h-full min-w-0 flex-1 items-stretch justify-center overflow-hidden md:ml-64 md:items-center md:overflow-y-auto md:p-6 md:w-[calc(100vw-16rem)]" onClick={(e) => e.stopPropagation()}>
        <div className="relative flex h-full w-full flex-col gap-4 rounded-none border-0 bg-black/95 md:h-auto md:max-w-4xl md:flex-row md:rounded-3xl md:border md:border-white/10 md:bg-black/90 md:shadow-2xl md:shadow-black/50 md:backdrop-blur-xl">
          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-none border-0 border-white/10 bg-black/80 md:rounded-2xl md:border md:bg-black/80">
            {schedulePanel && (
              <div className="shrink-0 border-b border-white/10 p-4 md:hidden">
                {schedulePanel}
              </div>
            )}
            <div className="shrink-0 border-b border-white/10 px-4 py-4 md:px-6 md:py-5">
              <h2 className="text-lg font-semibold tracking-tight text-white md:text-xl">Select models for mistake shift</h2>
              <p className="mt-1 text-sm text-white/55">
                You can select any model (including those with a chatter). Overlap is allowed for mistake-checking.
              </p>
              <div className="mt-3 md:mt-4">
                <Input
                  type="search"
                  placeholder="Search by model or chatter…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="min-h-[44px] py-2.5 md:py-3 text-base md:text-sm"
                />
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-4 md:max-h-[50vh] md:flex-none">
              {error && (
                <div className="mb-4">
                  <FormError>{error}</FormError>
                </div>
              )}
              {filtered.length === 0 ? (
                <p className="py-8 text-center text-sm text-white/50">No models match.</p>
              ) : (
                <ul className="space-y-3 md:space-y-2">
                  {filtered.map((m) => (
                    <li key={m.id}>
                      <label className="flex min-h-[52px] cursor-pointer items-center gap-4 rounded-xl border border-white/10 bg-white/[0.06] px-4 py-4 transition-colors hover:bg-white/[0.09] active:bg-white/[0.12] md:min-h-0 md:py-3">
                        <input
                          type="checkbox"
                          checked={selectedModelIds.has(m.id)}
                          onChange={() => onToggle(m.id)}
                          className="h-5 w-5 shrink-0 rounded border-white/30 bg-white/5 text-[hsl(330,80%,55%)] focus:ring-2 focus:ring-[hsl(330,80%,55%)]/40 md:h-4 md:w-4"
                        />
                        <span className="min-w-0 flex-1 font-medium text-white/95 text-base md:text-sm">{m.model_name}</span>
                        {m.current_status === "free" ? (
                          <span className="shrink-0 rounded-full bg-emerald-500/20 px-2.5 py-1 text-xs font-medium text-emerald-300">Free</span>
                        ) : (
                          <span className="shrink-0 rounded-full bg-amber-500/20 px-2.5 py-1 text-xs font-medium text-amber-300">
                            {m.current_chatter_name ? `Chatter: ${m.current_chatter_name}` : "Busy"}
                          </span>
                        )}
                      </label>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="flex shrink-0 flex-wrap items-center justify-end gap-3 border-t border-white/10 p-4" style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}>
              <button type="button" onClick={onCancel} className="min-h-[44px] rounded-xl border border-white/15 px-5 py-2.5 text-base font-medium text-white/80 hover:bg-white/5 md:min-h-0 md:text-sm">
                Cancel
              </button>
              <button
                type="button"
                onClick={onConfirm}
                disabled={loading || selectedModelIds.size === 0}
                className="min-h-[44px] rounded-xl bg-[hsl(330,80%,55%)] px-6 py-2.5 text-base font-medium text-white hover:bg-[hsl(330,80%,50%)] disabled:opacity-50 md:min-h-0 md:text-sm"
              >
                {loading ? "Starting…" : `Start mistake shift (${selectedModelIds.size} model${selectedModelIds.size !== 1 ? "s" : ""})`}
              </button>
            </div>
          </div>
          {schedulePanel && (
            <div className="hidden w-full shrink-0 border-t border-white/10 p-4 md:block md:border-t-0 md:border-l md:border-white/10 md:p-0 md:pl-4 md:pr-0 md:w-72 md:min-w-0">
              {schedulePanel}
            </div>
          )}
        </div>
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
}: Props) {
  const router = useRouter();
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

  React.useEffect(() => {
    if (!successMessage) return;
    const t = setTimeout(() => setSuccessMessage(null), 4000);
    return () => clearTimeout(t);
  }, [successMessage]);

  const startTimeMs = activeShift ? parseStartTime(activeShift.start_time) : null;
  const breakUsed = activeShift?.break_minutes ?? 0;
  const isOnBreak = activeShift?.status === "on_break" || breakStartedAt !== null;
  const breakStartTimeMs = isOnBreak && activeShift
    ? (activeShift.break_started_at ? new Date(activeShift.break_started_at).getTime() : breakStartedAt?.getTime() ?? null)
    : null;
  const breakStartedAtIso = activeShift?.break_started_at ?? breakStartedAt?.toISOString() ?? null;
  const totalBreakUsedDisplay = clientTotalBreakUsed !== null ? clientTotalBreakUsed : breakUsed;
  const remainingBreak = Math.max(0, maxBreakMinutes - totalBreakUsedDisplay);
  const canStartBreak = activeShift && activeShift.status === "active" && remainingBreak > 0;

  React.useEffect(() => {
    if (!isOnBreak || breakStartTimeMs === null) {
      setClientTotalBreakUsed(null);
      return;
    }
    const tick = () =>
      setClientTotalBreakUsed(breakUsed + Math.floor((Date.now() - breakStartTimeMs) / 60000));
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

  async function handleAddModel(model: ModelRecord) {
    if (!activeShift) return;
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
        setSuccessMessage("Model added.");
        router.refresh();
      }
    } finally {
      setAddingModelId(null);
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
    try {
      await startBreak(activeShift.id);
      setBreakStartedAt(new Date());
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start break");
    }
  }

  async function handleEndBreak() {
    if (!activeShift) return;
    setError(null);
    const elapsed = breakStartedAt ? Math.ceil((Date.now() - breakStartedAt.getTime()) / 60000) : 1;
    try {
      await endBreak(activeShift.id, Math.min(elapsed, remainingBreak + elapsed));
      setBreakStartedAt(null);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to end break");
    }
  }

  async function handleEndShift() {
    if (!activeShift) return;
    setError(null);
    setEnding(true);
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
      <div className="space-y-8">
        {error && (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-5 py-3 text-sm text-red-200">{error}</div>
        )}
        {successMessage && (
          <div className="rounded-2xl border border-[hsl(330,80%,55%)]/30 bg-[hsl(330,80%,55%)]/10 px-5 py-3 text-sm text-[hsl(330,90%,75%)]">{successMessage}</div>
        )}
        {todaySchedule && (
          <TodaySchedulePanel
            todayLabel={buildTodayLabel(todaySchedule.todayYmd, todaySchedule.todayWeekday)}
            items={todaySchedule.items}
            title="Today's assigned models to review"
            emptyMessage="No scheduled models today"
          />
        )}
        <div className="glass-panel p-5 md:p-8 md:p-10">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/40">Mistake shift</p>
          <h2 className="mt-2 text-xl font-semibold tracking-tight text-white md:text-3xl">Start a mistake shift</h2>
          <p className="mt-2 text-sm text-white/60 md:text-base">
            Select models to check. You can enter any model (even if a chatter is in it).
          </p>
          <div className="mt-6 md:mt-8">
            <button
              type="button"
              onClick={() => setShowModelSelect(true)}
              className="w-full rounded-2xl bg-[hsl(330,80%,55%)] px-6 py-3.5 text-base font-medium text-white shadow-[0_0_32px_-8px_rgba(236,72,153,0.5)] transition hover:bg-[hsl(330,80%,50%)] md:w-auto md:px-8 md:py-4"
            >
              Start mistake shift
            </button>
          </div>
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="glass-card p-5">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-white/70">All models</h3>
            <p className="mt-1 text-xs text-white/45">You can select any model when starting</p>
            <div className="mt-4 space-y-2">
              {modelss.slice(0, 8).map((m) => (
                <div key={m.id} className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-white/90">
                  {m.model_name}
                  {m.current_status === "occupied" && (
                    <span className="ml-2 text-white/50">→ {m.current_chatter_name || "Occupied"}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
          <div className="glass-card p-5">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-white/70">Live shifts</h3>
            <p className="mt-1 text-xs text-white/45">See who is live</p>
            <a href={ROUTES.va.liveShifts} className="mt-4 inline-block rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm font-medium text-white/90 hover:bg-white/10">
              View live shifts →
            </a>
          </div>
        </div>
        {showModelSelect && (
          <VaModelSelectModal
            modelss={modelss}
            selectedModelIds={selectedModelIds}
            onToggle={toggleModelSelection}
            onConfirm={handleConfirmModelSelection}
            onCancel={() => { setShowModelSelect(false); setError(null); }}
            loading={starting}
            error={error}
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
        )}
      </div>
    );
  }

  const startedAtLabel = activeShift.start_time ? formatDateTimeEuropean(activeShift.start_time) : "—";
  const statusLabel = activeShift.status === "on_break" || breakStartedAt ? "On break" : "Running";
  const statusBadgeColor =
    activeShift.status === "on_break" || breakStartedAt
      ? "bg-amber-500/20 text-amber-300 border-amber-500/30"
      : "bg-emerald-500/20 text-emerald-300 border-emerald-500/30";

  return (
    <div className="space-y-6 pb-24 md:space-y-8 md:pb-0">
      {error && (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-5 py-3 text-sm text-red-200">{error}</div>
      )}
      {successMessage && (
        <div className="rounded-2xl border border-[hsl(330,80%,55%)]/30 bg-[hsl(330,80%,55%)]/10 px-5 py-3 text-sm text-[hsl(330,90%,75%)]">{successMessage}</div>
      )}
      <div className="glass-panel p-4 md:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-semibold tracking-tight text-white md:text-3xl">Mistake shift active</h2>
              <span className={`rounded-full border px-3 py-1 text-xs font-medium ${statusBadgeColor}`}>{statusLabel}</span>
            </div>
            <p className="mt-1 text-base italic text-white/70 md:text-lg">Fix the flow.</p>
          </div>
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4 md:mt-8 md:gap-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-white/45">Started at</p>
            <p className="mt-1 text-sm md:text-base text-white/95">{startedAtLabel}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-white/45">Duration</p>
            <p className="mt-1 font-mono text-2xl tabular-nums text-[hsl(330,90%,75%)] md:text-4xl">
            {activeShift?.start_time ? (
              <LiveTimer startTime={activeShift.start_time} />
            ) : (
              "—"
            )}
          </p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-white/45">Break</p>
            <p className="mt-1 text-sm text-white/95">{totalBreakUsedDisplay} / {maxBreakMinutes} min</p>
          </div>
        </div>
        <div className="mt-6 hidden flex-wrap items-center gap-3 md:mt-8 md:flex">
          <button
            type="button"
            onClick={() => { setSelectedAddModelId(null); setError(null); setShowAddModelModal(true); }}
            className="rounded-xl border border-[hsl(330,80%,55%)]/40 bg-[hsl(330,80%,55%)]/10 px-4 py-2.5 text-sm font-medium text-[hsl(330,90%,75%)]"
          >
            Add model
          </button>
          {canStartBreak && (
            <button type="button" onClick={handleStartBreak} className="rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-medium text-white/90 hover:bg-white/10">
              Start break
            </button>
          )}
          {(activeShift.status === "on_break" || breakStartedAt) && (
            <button type="button" onClick={handleEndBreak} className="rounded-xl bg-[hsl(330,80%,55%)] px-4 py-2.5 text-sm font-medium text-white">
              End break
            </button>
          )}
          <button
            type="button"
            onClick={handleEndShift}
            disabled={ending}
            className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-2.5 text-sm font-medium text-red-300 hover:bg-red-500/20 disabled:opacity-50"
          >
            {ending ? "Ending…" : "End shift"}
          </button>
        </div>
      </div>
      <div className="grid gap-4 md:gap-6 lg:grid-cols-5 lg:gap-8">
        <div className="lg:col-span-3">
          <div className="glass-card p-4 md:p-5">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-white/70">Active models</h3>
            <div className="mt-4 space-y-3">
              {shiftModels.length === 0 ? (
                <p className="rounded-xl border border-white/10 bg-white/5 px-4 py-6 text-center text-sm text-white/50">No models. Add one below.</p>
              ) : (
                shiftModels.map((sm) => (
                  <div key={sm.id} className="flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-white/[0.06] px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-white/95">{sm.model_name}</p>
                      <p className="text-xs text-white/50">Entered {formatEnteredAt(sm.entered_at)}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveModel(sm)}
                      disabled={removingId === sm.id}
                      className="min-h-[44px] shrink-0 rounded-xl border border-white/20 px-4 py-2 text-sm font-medium text-white/70 hover:bg-white/10 disabled:opacity-50 md:min-h-0 md:rounded-lg md:px-3 md:py-1.5 md:text-xs"
                    >
                      {removingId === sm.id ? "Removing…" : "Remove"}
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
        <div className="space-y-6 lg:col-span-2">
          <div className="glass-card p-5">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-white/70">Break tracker</h3>
            <p className="mt-2 font-mono text-2xl tabular-nums text-white/95">{totalBreakUsedDisplay} <span className="text-white/50">/ {maxBreakMinutes}</span> min</p>
            <p className="mt-1 text-xs text-white/50">{remainingBreak} min remaining</p>
          </div>
          <div className="glass-card p-5">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-white/70">Shift details</h3>
            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-white/55">Started</dt>
                <dd className="text-white/90">{startedAtLabel}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-white/55">Models</dt>
                <dd className="text-white/90">{shiftModels.length}</dd>
              </div>
            </dl>
          </div>
        </div>
      </div>
      <div
        className="fixed left-0 right-0 z-30 flex flex-col gap-2 border-t border-white/10 bg-black/95 px-4 py-3 backdrop-blur-xl md:hidden"
        style={{
          bottom: "calc(72px + env(safe-area-inset-bottom, 0px))",
          boxShadow: "0 -4px 20px rgba(0,0,0,0.4)",
        }}
      >
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => { setSelectedAddModelId(null); setError(null); setShowAddModelModal(true); }}
            className="min-h-[48px] rounded-xl border border-[hsl(330,80%,55%)]/40 bg-[hsl(330,80%,55%)]/15 px-4 py-3 text-sm font-medium text-[hsl(330,90%,75%)] hover:bg-[hsl(330,80%,55%)]/25"
          >
            Add model
          </button>
          {canStartBreak && (
            <button type="button" onClick={handleStartBreak} className="min-h-[48px] rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm font-medium text-white/90 hover:bg-white/10">
              Start break
            </button>
          )}
          {(activeShift.status === "on_break" || breakStartedAt) && (
            <button type="button" onClick={handleEndBreak} className="min-h-[48px] rounded-xl bg-[hsl(330,80%,55%)] px-4 py-3 text-sm font-medium text-white hover:bg-[hsl(330,80%,50%)]">
              End break
            </button>
          )}
          <button
            type="button"
            onClick={handleEndShift}
            disabled={ending}
            className="min-h-[48px] rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm font-medium text-red-300 hover:bg-red-500/20 disabled:opacity-50"
          >
            {ending ? "Ending…" : "End shift"}
          </button>
        </div>
      </div>
      {showAddModelModal && (
        <VaAddModelModal
          modelss={modelss}
          alreadyInShiftModelIds={new Set(shiftModels.map((sm) => sm.model_id))}
          selectedModelId={selectedAddModelId}
          onSelect={setSelectedAddModelId}
          onConfirm={handleConfirmAddModel}
          onCancel={() => { setShowAddModelModal(false); setSelectedAddModelId(null); setError(null); }}
          loading={addingModelId !== null}
          error={error}
        />
      )}
    </div>
  );
}
