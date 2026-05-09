"use client";
import { devLog } from "@/lib/dev-log";

import * as React from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
  startShiftWithModels,
  bulkAddModelsToShift,
  removeModelFromShift,
  startBreak,
  endBreak,
  endShift,
} from "@/app/actions/shift";
import { ROUTES } from "@/lib/routes";
import { formatDateTimeEuropean } from "@/lib/format";
import { Input, FormError } from "@/components/ui/form";
import useSWR from "swr";
import { Clock, Coffee, Loader2, LogOut, RefreshCw, UserCircle2, UserPlus } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { LiveTimer } from "@/components/live-timer";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { TodaySchedulePanel, TodayScheduleCollapsible, buildTodayLabel, type TodayScheduleItem } from "@/components/today-schedule-panel";
import { useToast } from "@/contexts/toast-context";
import { useMobileFabVisibility } from "@/contexts/mobile-fab-visibility-context";
import type { AppNotification, Shift, ShiftModel, ModelRecord, ShiftQueueEntryApi } from "@/types";

function localToast(id: string, title: string, body: string, priority: "normal" | "high" = "high"): AppNotification {
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

function BusyOverlay({
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

export type TodayScheduleData = {
  todayYmd: string;
  todayWeekday: string;
  items: TodayScheduleItem[];
};

type Props = {
  chatterId: string;
  chatterName: string;
  activeShift: Shift | null;
  shiftModels: ShiftModel[];
  /** Loaded on the server in one slim `modelss` query (name, status, chatter); modals read props only — no per-open fetches. */
  modelss: ModelRecord[];
  maxBreakMinutes: number;
  todaySchedule?: TodayScheduleData;
  modelIdsInActivePeriodToday?: string[];
  /** Today's weekly-program model rows (deduped) for queue presets. */
  weeklyProgramModels?: { id: string; name: string }[];
  /** Free `modelss` rows for queue picker when there is no weekly program today (same filter as Free models panel). */
  freeModelsForQueue?: ModelRecord[];
};

type ShiftQueueOverviewResponse = {
  inQueue: boolean;
  queueEntry: ShiftQueueEntryApi | null;
  activeShifts: { id: string; chatter_name: string; duration_minutes: number }[];
};

type ShiftQueueStatusResponse = {
  inQueue: boolean;
  status: "waiting" | "started" | "cancelled";
  waitingForChatter: string;
  waitingForShiftId: string;
  activeShiftDuration: number;
  estimatedWait: string;
  queuePosition: number;
  totalInQueue: number;
  selectedModelNames: string[];
  queue_type: "full_start" | "add_models";
};

async function shiftQueueJsonFetcher<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : res.statusText);
  return data as T;
}

function parseStartTime(startTime: string | null): number | null {
  if (!startTime) return null;
  const d = new Date(startTime);
  return isNaN(d.getTime()) ? null : d.getTime();
}

function formatEnteredAt(enteredAt: string | null): string {
  if (!enteredAt) return "—";
  const d = new Date(enteredAt);
  if (Number.isNaN(d.getTime())) return "—";
  const display = new Date(d.getTime() + 3 * 60 * 60 * 1000);
  const h = display.getUTCHours();
  const m = display.getUTCMinutes();
  return `${h < 10 ? `0${h}` : h}:${m < 10 ? `0${m}` : m}`;
}

/** Initials avatar — no photo field on modelss slim row today. */
function ModelAvatar({ name, className }: { name: string; className?: string }) {
  const initial = name.trim().slice(0, 1).toUpperCase() || "?";
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-pink-500 to-fuchsia-600 text-sm font-bold uppercase text-white shadow-inner ring-2 ring-white/15",
        "h-11 w-11 md:h-12 md:w-12",
        className
      )}
      aria-hidden
    >
      {initial}
    </span>
  );
}

function FreeModelIntelCard({ model }: { model: ModelRecord }) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 400, damping: 32 }}
      className="flex items-center gap-3 rounded-xl border border-emerald-400/25 bg-gradient-to-r from-emerald-500/[0.1] to-white/[0.03] px-3 py-3.5 sm:px-4"
    >
      <ModelAvatar name={model.model_name} className="h-9 w-9 text-xs md:h-10 md:w-10" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-white/95">{model.model_name}</p>
        <p className="mt-0.5 text-xs font-medium text-emerald-200/80">Available</p>
      </div>
    </motion.div>
  );
}

function TakenModelIntelCard({ model }: { model: ModelRecord }) {
  const chatter = model.current_chatter_name?.trim() || "";
  const chatterInitial = chatter.slice(0, 1).toUpperCase() || "?";
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 400, damping: 32 }}
      className="flex items-center gap-3 rounded-xl border border-pink-500/20 bg-gradient-to-r from-pink-500/[0.08] to-white/[0.04] px-3 py-3.5 sm:px-4"
    >
      <ModelAvatar name={model.model_name} className="h-9 w-9 text-xs md:h-10 md:w-10" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-white/95">{model.model_name}</p>
        <div className="mt-2">
          <span className="inline-flex max-w-full items-center gap-2 rounded-lg border border-white/12 bg-black/30 px-2.5 py-1.5">
            <span
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-sky-500/50 to-indigo-600/40 text-[10px] font-bold uppercase text-white ring-1 ring-white/20"
              aria-hidden
            >
              {chatterInitial}
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-white/45">
                <UserCircle2 className="h-3 w-3 shrink-0 opacity-90" aria-hidden />
                Chattering
              </span>
              <span className="block truncate text-xs font-medium text-pink-100/95">{chatter || "—"}</span>
            </span>
          </span>
        </div>
      </div>
    </motion.div>
  );
}

const shiftActionBtn =
  "inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all duration-200 hover:scale-[1.02] hover:shadow-lg active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40 md:min-h-0";

// --- Add model to shift modal (multi-select; mobile: portaled + fixed bottom actions above nav) ---
function AddModelToShiftModal({
  modelss,
  alreadyInShiftModelIds,
  selectedModelIds,
  onToggle,
  onConfirm,
  onCancel,
  loading,
  error,
  shiftInteractionLocked,
}: {
  modelss: ModelRecord[];
  alreadyInShiftModelIds: Set<string>;
  selectedModelIds: Set<string>;
  onToggle: (id: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
  error: string | null;
  /** When break/shift actions are in flight — block confirm only */
  shiftInteractionLocked?: boolean;
}) {
  const locked = shiftInteractionLocked ?? false;
  const [mounted, setMounted] = React.useState(false);
  const [search, setSearch] = React.useState("");

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return modelss;
    return modelss.filter(
      (m) =>
        m.model_name.toLowerCase().includes(q) ||
        (m.current_chatter_name && m.current_chatter_name.toLowerCase().includes(q))
    );
  }, [modelss, search]);
  const sortedModels = React.useMemo(() => {
    const priority = (m: ModelRecord) => {
      if (alreadyInShiftModelIds.has(m.id)) return 1;
      if (m.current_status === "free") return 0;
      return 2;
    };
    return [...filtered].sort(
      (a, b) => priority(a) - priority(b) || a.model_name.localeCompare(b.model_name)
    );
  }, [filtered, alreadyInShiftModelIds]);

  const selectedCount = selectedModelIds.size;

  const closeModal = onCancel;
  const handleAddModels = onConfirm;

  const sheetBody = (
    <>
      <div className="shrink-0 border-b border-white/10 px-4 py-4 md:px-6 md:py-5">
        <h2 id="add-model-shift-title" className="text-lg font-semibold tracking-tight text-white md:text-xl">
          Add models to shift
        </h2>
        <p className="mt-1 text-sm text-white/55">
          Select free models with checkboxes, then add them in one step. Models on this shift or taken elsewhere are
          shown but can’t be selected.
        </p>
        <div className="mt-3 md:mt-4">
          <Input
            type="search"
            placeholder="Search by model or chatter…"
            value={search}
            disabled={loading}
            onChange={(e) => setSearch(e.target.value)}
            className="py-2.5 md:py-3"
          />
        </div>
      </div>
      <div
        className="min-h-0 flex-1 overflow-y-auto p-4 md:max-h-[min(50vh,360px)] md:flex-none"
        style={{ paddingBottom: "120px" }}
      >
        {error && (
          <div className="mb-4">
            <FormError>{error}</FormError>
          </div>
        )}
        {filtered.length === 0 ? (
          <p className="py-8 text-center text-sm text-white/50">No models match your search.</p>
        ) : (
          <ul className="space-y-2 pb-2">
            {sortedModels.map((m) => {
              const onThisShift = alreadyInShiftModelIds.has(m.id);
              const isFree = m.current_status === "free";
              const canSelect = !locked && !loading && !onThisShift && isFree;
              const isSelected = selectedModelIds.has(m.id);
              const statusLabel = onThisShift
                ? "On this shift"
                : isFree
                  ? "Free"
                  : `Taken · ${(m.current_chatter_name ?? "").trim() || "—"}`;

              return (
                <li key={m.id}>
                  <label
                    className={cn(
                      "flex cursor-default items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-3 sm:px-4",
                      canSelect && "cursor-pointer hover:bg-white/[0.08]",
                      (!canSelect || onThisShift) && "opacity-60"
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected && canSelect}
                      disabled={!canSelect}
                      onChange={() => canSelect && onToggle(m.id)}
                      className={cn(
                        "h-5 w-5 shrink-0 rounded border-white/25 bg-black/40",
                        "accent-[hsl(330,80%,55%)] focus:outline-none focus:ring-2 focus:ring-pink-500/45 focus:ring-offset-2 focus:ring-offset-zinc-950",
                        !canSelect && "cursor-not-allowed opacity-50"
                      )}
                    />
                    <ModelAvatar name={m.model_name} className="h-10 w-10 text-xs sm:h-11 sm:w-11" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-white/95">{m.model_name}</p>
                      <p
                        className={cn(
                          "mt-0.5 text-xs font-medium",
                          onThisShift && "text-sky-300/90",
                          !onThisShift && isFree && "text-emerald-300/85",
                          !onThisShift && !isFree && "text-amber-200/80"
                        )}
                      >
                        {statusLabel}
                      </p>
                    </div>
                  </label>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </>
  );

  const bottomBarStyle: React.CSSProperties = {
    position: "fixed",
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
    backgroundColor: "#111111",
    borderTop: "1px solid rgba(255,255,255,0.08)",
    padding: "12px 16px 32px 16px",
    display: "flex",
    gap: "12px",
  };

  const node = (
    <>
      <button
        type="button"
        className="fixed inset-0 z-[9980] bg-black/70 backdrop-blur-sm"
        aria-label="Close"
        disabled={loading}
        onClick={loading ? undefined : closeModal}
      />
      <div
        className="pointer-events-none fixed inset-0 z-[9985] flex max-md:items-end max-md:justify-center md:items-center md:justify-center md:p-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-model-shift-title"
      >
        <div
          className="pointer-events-auto flex max-h-[min(calc(100dvh-9.5rem-env(safe-area-inset-bottom,0px)),90dvh)] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-white/10 border-b-0 bg-black/95 shadow-2xl md:mb-0 md:max-h-[85vh] md:rounded-3xl md:border-b md:bg-black/90 md:shadow-black/50 md:backdrop-blur-xl"
          style={{ boxShadow: "0 0 0 1px rgba(255,255,255,0.06), 0 0 60px -12px hsl(330 80% 55% / 0.15)" }}
        >
          {sheetBody}
        </div>
      </div>
      <div style={bottomBarStyle}>
        <button
          type="button"
          onClick={closeModal}
          disabled={loading}
          style={{
            flex: 1,
            height: "52px",
            borderRadius: "12px",
            border: "1px solid rgba(255,255,255,0.15)",
            background: "transparent",
            color: "white",
            fontSize: "15px",
            opacity: loading ? 0.6 : 1,
          }}
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleAddModels}
          disabled={selectedCount === 0 || loading || locked}
          style={{
            flex: 2,
            height: "52px",
            borderRadius: "12px",
            background:
              selectedCount > 0 && !loading && !locked ? "#ec4899" : "rgba(236,72,153,0.3)",
            border: "none",
            color: "white",
            fontSize: "15px",
            fontWeight: "600",
            cursor:
              selectedCount > 0 && !loading && !locked ? "pointer" : "not-allowed",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
          }}
        >
          {loading ? <Loader2 className="h-5 w-5 shrink-0 animate-spin" aria-hidden /> : null}
          {loading
            ? "Adding models…"
            : selectedCount > 0
              ? `Add selected models (${selectedCount})`
              : "Select models"}
        </button>
      </div>
    </>
  );

  if (!mounted || typeof document === "undefined") {
    return null;
  }
  return createPortal(node, document.body);
}

// --- Model selection modal (start shift: multi-select) with schedule context ---
function ModelSelectModal({
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
  const free = filtered.filter((m) => m.current_status === "free");
  const occupied = filtered.filter((m) => m.current_status === "occupied");

  const modalContent = (
    <div className="fixed inset-0 z-[100] flex" role="dialog" aria-modal="true" aria-label="Select models">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        aria-hidden
        onClick={loading ? undefined : onCancel}
      />
      {/* Mobile: full-screen sheet (stacked: Today card → search → list → bottom bar); desktop: centered two-column */}
      <div className="relative ml-0 flex min-h-full min-w-0 flex-1 items-stretch justify-center overflow-hidden md:ml-64 md:items-center md:overflow-y-auto md:p-6 md:w-[calc(100vw-16rem)]" onClick={(e) => e.stopPropagation()}>
        <div className="relative flex h-full w-full flex-col gap-4 rounded-none border-0 bg-black/95 shadow-none md:h-auto md:max-w-4xl md:flex-row md:rounded-3xl md:border md:border-white/10 md:bg-black/90 md:shadow-2xl md:shadow-black/50 md:backdrop-blur-xl" style={{ boxShadow: "0 0 0 1px rgba(255,255,255,0.06), 0 0 60px -12px hsl(330 80% 55% / 0.15)" }}>
          {/* Mobile: stacked order — Today card → search → list → bottom bar */}
          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-none border-0 border-white/10 bg-black/80 md:rounded-2xl md:border md:bg-black/80">
            {/* Mobile-only: Today info card at top */}
            {schedulePanel && (
              <div className="shrink-0 border-b border-white/10 p-4 md:hidden">
                {schedulePanel}
              </div>
            )}
            <div className="shrink-0 border-b border-white/10 px-4 py-4 md:px-6 md:py-5">
              <h2 className="text-lg font-semibold tracking-tight text-white md:text-xl">Select models</h2>
              <p className="mt-1 text-sm text-white/55">
                Free models can be selected. Occupied models show who has them.
              </p>
              <div className="mt-3 md:mt-4">
                <Input
                  type="search"
                  placeholder="Search by model or chatter…"
                  value={search}
                  disabled={loading}
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
                <p className="py-8 text-center text-sm text-white/50">No models match your search.</p>
              ) : (
                <ul className="space-y-3 md:space-y-2">
                  {free.map((m) => (
                    <li key={m.id}>
                      <motion.label
                    whileHover={loading ? undefined : { scale: 1.01 }}
                    transition={{ duration: 0.15, ease: "easeOut" }}
                    className={`flex min-h-[52px] items-center gap-4 rounded-xl border border-white/10 bg-white/[0.06] px-4 py-4 transition-colors md:min-h-0 md:py-3 ${loading ? "cursor-not-allowed opacity-60" : "cursor-pointer hover:bg-white/[0.09] active:bg-white/[0.12]"}`}
                  >
                        <input
                          type="checkbox"
                          checked={selectedModelIds.has(m.id)}
                          disabled={loading}
                          onChange={() => onToggle(m.id)}
                          className="h-5 w-5 shrink-0 rounded border-white/30 bg-white/5 text-[hsl(330,80%,55%)] focus:ring-2 focus:ring-[hsl(330,80%,55%)]/40 disabled:cursor-not-allowed disabled:opacity-40 md:h-4 md:w-4"
                        />
                        <span className="min-w-0 flex-1 font-medium text-white/95 text-base md:text-sm">{m.model_name}</span>
                        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-emerald-500/20 px-2.5 py-1 text-xs font-medium text-emerald-300">
                          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400 animate-pulse" aria-hidden />
                          Free
                        </span>
                      </motion.label>
                    </li>
                  ))}
                  {occupied.map((m) => (
                    <li key={m.id}>
                      <div className="flex min-h-[52px] cursor-not-allowed items-center gap-4 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-4 opacity-75 md:min-h-0 md:py-3">
                        <span className="h-5 w-5 shrink-0 rounded border border-white/20 bg-white/5 md:h-4 md:w-4" aria-hidden />
                        <span className="min-w-0 flex-1 font-medium text-white/70 text-base md:text-sm">{m.model_name}</span>
                        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-amber-500/20 px-2.5 py-1 text-xs font-medium text-amber-300">
                          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400 animate-pulse" aria-hidden />
                          {m.current_chatter_name || "Busy"}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="flex shrink-0 flex-wrap items-center justify-end gap-3 border-t border-white/10 p-4 pb-4 md:pb-4" style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}>
              <button
                type="button"
                onClick={onCancel}
                disabled={loading}
                className="min-h-[44px] rounded-xl border border-white/15 px-5 py-2.5 text-base font-medium text-white/80 hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40 md:min-h-0 md:text-sm"
              >
                Cancel
              </button>
              <motion.button
                type="button"
                onClick={onConfirm}
                disabled={loading}
                whileTap={{ scale: 0.97 }}
                transition={{ duration: 0.12 }}
                className="min-h-[44px] rounded-xl bg-[hsl(330,80%,55%)] px-6 py-2.5 text-base font-medium text-white shadow-[0_0_20px_-4px_rgba(236,72,153,0.4)] hover:bg-[hsl(330,80%,50%)] disabled:opacity-50 md:min-h-0 md:text-sm"
              >
                {loading ? "Starting shift…" : `Start shift with ${selectedModelIds.size} model${selectedModelIds.size !== 1 ? "s" : ""}`}
              </motion.button>
            </div>
          </div>
          {/* Desktop-only: schedule panel on the right */}
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

export function ShiftClient({
  chatterId,
  chatterName,
  activeShift,
  shiftModels,
  modelss,
  maxBreakMinutes,
  todaySchedule,
  modelIdsInActivePeriodToday = [],
  weeklyProgramModels = [],
  freeModelsForQueue,
}: Props) {
  const router = useRouter();
  const { addToast } = useToast();
  /** Prevents double-submit on shift/break actions. */
  const submittingRef = React.useRef(false);
  /** Coalesce rapid `router.refresh()` calls into one RSC reload to stay under Cloudflare subrequest limits. */
  const refreshCoalesceTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestRouterRefresh = React.useCallback(() => {
    if (refreshCoalesceTimerRef.current !== null) {
      clearTimeout(refreshCoalesceTimerRef.current);
    }
    refreshCoalesceTimerRef.current = setTimeout(() => {
      refreshCoalesceTimerRef.current = null;
      router.refresh();
    }, 350);
  }, [router]);

  React.useEffect(
    () => () => {
      if (refreshCoalesceTimerRef.current !== null) clearTimeout(refreshCoalesceTimerRef.current);
    },
    []
  );

  const [refreshing, setRefreshing] = React.useState(false);
  const handleRefresh = React.useCallback(() => {
    setRefreshing(true);
    router.refresh();
    setTimeout(() => setRefreshing(false), 1000);
  }, [router]);

  const [showModelSelect, setShowModelSelect] = React.useState(false);
  const [selectedModelIds, setSelectedModelIds] = React.useState<Set<string>>(new Set());
  const [isStartingShift, setIsStartingShift] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [successMessage, setSuccessMessage] = React.useState<string | null>(null);
  const [breakStartedAt, setBreakStartedAt] = React.useState<Date | null>(null);
  const [removingId, setRemovingId] = React.useState<string | null>(null);
  const [removeConfirmModel, setRemoveConfirmModel] = React.useState<ShiftModel | null>(null);
  const [isEndingShift, setIsEndingShift] = React.useState(false);
  const [showAddModelModal, setShowAddModelModal] = React.useState(false);
  const [selectedAddModelIds, setSelectedAddModelIds] = React.useState<Set<string>>(() => new Set());
  const [isAddingModelsToShift, setIsAddingModelsToShift] = React.useState(false);
  const [clientTotalBreakUsed, setClientTotalBreakUsed] = React.useState<number | null>(null);
  /** Instant UI while startBreak / endBreak server actions run */
  const [breakAction, setBreakAction] = React.useState<"idle" | "starting" | "ending">("idle");
  /** After End break click, treat shift as active until server props catch up */
  const [optimisticNotOnBreak, setOptimisticNotOnBreak] = React.useState(false);
  const [showBreakConfirmModal, setShowBreakConfirmModal] = React.useState(false);
  /** Selected reminder length (minutes); `null` = no push reminder. Default 15 when opening modal. */
  const [breakReminderMins, setBreakReminderMins] = React.useState<number | null>(15);
  const [queueSelectedModelIds, setQueueSelectedModelIds] = React.useState<Set<string>>(() => new Set());
  const [queueJoinBusy, setQueueJoinBusy] = React.useState(false);
  const [queueCancelBusy, setQueueCancelBusy] = React.useState(false);
  const [addModelsQueueBusy, setAddModelsQueueBusy] = React.useState(false);
  const queuePresetInitRef = React.useRef(false);

  const { data: queueOverview, mutate: mutateQueueOverview } = useSWR<ShiftQueueOverviewResponse>(
    "/api/chatter/shift-queue",
    shiftQueueJsonFetcher,
    { refreshInterval: 45_000 }
  );
  const inQueue = Boolean(queueOverview?.inQueue);
  const queueEntryApi = queueOverview?.queueEntry ?? null;
  const addModelsQueueEntry =
    activeShift && inQueue && queueEntryApi?.queue_type === "add_models" ? queueEntryApi : null;
  const activeShiftsFromApi = queueOverview?.activeShifts ?? [];

  const pollQueueStatusDetail =
    inQueue && (!activeShift || queueEntryApi?.queue_type === "add_models");

  const { data: queueStatus } = useSWR<ShiftQueueStatusResponse>(
    pollQueueStatusDetail ? "/api/chatter/shift-queue/status" : null,
    shiftQueueJsonFetcher,
    { refreshInterval: 30_000 }
  );

  const takenWeeklyModels = React.useMemo(() => {
    if (!activeShift || !weeklyProgramModels?.length) return [];
    const myModelIds = new Set(shiftModels.map((sm) => sm.model_id).filter(Boolean));
    const cid = chatterId.trim();
    const out: { id: string; name: string; takenByChatter: string; waitingShiftId: string }[] = [];
    for (const m of weeklyProgramModels) {
      if (myModelIds.has(m.id)) continue;
      const row = modelss.find((x) => x.id === m.id);
      if (!row || row.current_status !== "occupied") continue;
      const other = (row.current_chatter_id ?? "").trim();
      if (!other || other === cid) continue;
      const waitingShiftId = (row.current_shift_id ?? "").trim();
      if (!waitingShiftId) continue;
      out.push({
        id: m.id,
        name: m.name,
        takenByChatter: (row.current_chatter_name ?? "").trim() || "another chatter",
        waitingShiftId,
      });
    }
    return out;
  }, [activeShift, weeklyProgramModels, shiftModels, modelss, chatterId]);

  React.useEffect(() => {
    if (activeShift) queuePresetInitRef.current = false;
  }, [activeShift]);

  React.useEffect(() => {
    if (activeShift || queuePresetInitRef.current) return;
    if (weeklyProgramModels.length === 0) return;
    queuePresetInitRef.current = true;
    setQueueSelectedModelIds(new Set(weeklyProgramModels.map((m) => m.id)));
  }, [activeShift, weeklyProgramModels]);

  const mobileFabVisibility = useMobileFabVisibility();
  React.useEffect(() => {
    if (!mobileFabVisibility) return;
    mobileFabVisibility.setMobileFabHidden(showAddModelModal || showBreakConfirmModal || removeConfirmModel != null);
    return () => {
      mobileFabVisibility.setMobileFabHidden(false);
    };
  }, [showAddModelModal, showBreakConfirmModal, mobileFabVisibility]);

  React.useEffect(() => {
    if (!successMessage) return;
    const t = setTimeout(() => setSuccessMessage(null), 4000);
    return () => clearTimeout(t);
  }, [successMessage]);

  const startTimeMs = activeShift ? parseStartTime(activeShift.start_time) : null;
  const breakUsed = activeShift?.break_minutes ?? 0;
  const isOnBreak =
    !optimisticNotOnBreak &&
    (activeShift?.status === "on_break" || breakStartedAt !== null);
  const breakStartTimeMs = isOnBreak && activeShift
    ? (activeShift.break_started_at ? new Date(activeShift.break_started_at).getTime() : breakStartedAt?.getTime() ?? null)
    : null;
  const breakStartedAtIso = activeShift?.break_started_at ?? breakStartedAt?.toISOString() ?? null;
  const totalBreakUsedDisplay = clientTotalBreakUsed !== null ? clientTotalBreakUsed : breakUsed;
  const remainingBreak = Math.max(0, maxBreakMinutes - totalBreakUsedDisplay);
  const shiftControlsBusy =
    breakAction !== "idle" ||
    isEndingShift ||
    isStartingShift ||
    isAddingModelsToShift ||
    showBreakConfirmModal;
  const breakStartEligible =
    !!activeShift &&
    activeShift.status === "active" &&
    !isOnBreak &&
    remainingBreak > 0 &&
    breakAction === "idle" &&
    !isEndingShift &&
    !isStartingShift &&
    !isAddingModelsToShift;
  const canStartBreak = breakStartEligible && !showBreakConfirmModal;

  React.useEffect(() => {
    if (!activeShift) setIsEndingShift(false);
  }, [activeShift]);

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
    const tick = () =>
      setClientTotalBreakUsed(breakUsed + Math.floor((Date.now() - breakStartTimeMs) / 60000));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [isOnBreak, breakStartTimeMs, breakUsed]);

  React.useEffect(() => {
    if (activeShift) {
      devLog("[shift] active shift loaded", {
        shiftId: activeShift.id,
        start_time: activeShift.start_time,
        modelsAttached: shiftModels.length,
      });
    }
  }, [activeShift?.id, activeShift?.start_time, shiftModels.length]);

  const freeModelss = modelss.filter((m) => m.current_status === "free");
  const occupiedModelss = modelss.filter((m) => m.current_status === "occupied");
  const queuePickerFreeModels = freeModelsForQueue ?? freeModelss;

  function toggleModelSelection(id: string) {
    if (isStartingShift) return;
    const m = modelss.find((x) => x.id === id);
    if (m?.current_status !== "free") return;
    setSelectedModelIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleConfirmModelSelection() {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setIsStartingShift(true);
    setError(null);
    try {
      const result = await startShiftWithModels(chatterId, chatterName, Array.from(selectedModelIds));
      if (!result || !result.success) {
        setError(result?.error ?? "Failed to start shift");
        return;
      }
      setShowModelSelect(false);
      setSelectedModelIds(new Set());
      setSuccessMessage("Shift started. Loading…");
      router.push(ROUTES.chatter.shift);
      requestRouterRefresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to start shift");
      addToast(localToast(`shift-start-err-${Date.now()}`, "Failed to start shift", "Please try again."));
    } finally {
      setIsStartingShift(false);
      submittingRef.current = false;
    }
  }

  const toggleQueueModel = React.useCallback(
    (id: string) => {
      if (queueJoinBusy || isStartingShift || inQueue) return;
      const allowedWeekly = weeklyProgramModels.some((m) => m.id === id);
      const allowedFree = queuePickerFreeModels.some((m) => m.id === id);
      if (weeklyProgramModels.length > 0) {
        if (!allowedWeekly) return;
      } else if (!allowedFree) {
        return;
      }
      setQueueSelectedModelIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
    },
    [queueJoinBusy, isStartingShift, inQueue, weeklyProgramModels, queuePickerFreeModels]
  );

  async function handleJoinQueue() {
    if (queueJoinBusy) return;
    const targetShift = activeShiftsFromApi[0];
    if (!targetShift?.id || queueSelectedModelIds.size === 0) return;
    setQueueJoinBusy(true);
    setError(null);
    try {
      const ids = Array.from(queueSelectedModelIds);
      const names = ids.map(
        (id) =>
          weeklyProgramModels.find((m) => m.id === id)?.name ??
          queuePickerFreeModels.find((m) => m.id === id)?.model_name ??
          modelss.find((x) => x.id === id)?.model_name ??
          id
      );
      const res = await fetch("/api/chatter/shift-queue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          selected_model_ids: ids,
          selected_model_names: names,
          waiting_for_shift_id: targetShift.id,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Could not join queue");
        return;
      }
      await mutateQueueOverview();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not join queue");
    } finally {
      setQueueJoinBusy(false);
    }
  }

  async function handleCancelQueue() {
    if (queueCancelBusy) return;
    setQueueCancelBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/chatter/shift-queue", { method: "DELETE" });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Could not cancel queue");
        return;
      }
      await mutateQueueOverview();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not cancel queue");
    } finally {
      setQueueCancelBusy(false);
    }
  }

  async function handleQueueForModels() {
    if (!activeShift || takenWeeklyModels.length === 0) return;
    const firstShiftId = takenWeeklyModels[0]?.waitingShiftId;
    if (!firstShiftId) return;
    const modelsForWait = takenWeeklyModels.filter((m) => m.waitingShiftId === firstShiftId);
    if (modelsForWait.length === 0) return;

    setAddModelsQueueBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/chatter/shift-queue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          selected_model_ids: modelsForWait.map((m) => m.id),
          selected_model_names: modelsForWait.map((m) => m.name),
          waiting_for_shift_id: firstShiftId,
          queue_type: "add_models",
          target_shift_id: activeShift.id,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Could not join queue");
        return;
      }
      await mutateQueueOverview();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not join queue");
    } finally {
      setAddModelsQueueBusy(false);
    }
  }

  const toggleAddModelSelection = React.useCallback((id: string) => {
    if (shiftControlsBusy) return;
    const m = modelss.find((x) => x.id === id);
    if (!m || m.current_status !== "free") return;
    setSelectedAddModelIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, [modelss, shiftControlsBusy]);

  async function handleConfirmAddModels() {
    if (!activeShift || selectedAddModelIds.size === 0 || submittingRef.current) return;
    submittingRef.current = true;
    setIsAddingModelsToShift(true);
    setError(null);
    const ids = Array.from(selectedAddModelIds);
    const items = ids
      .map((id) => {
        const model = modelss.find((m) => m.id === id);
        return model ? { modelRecordId: model.id, modelName: model.model_name } : null;
      })
      .filter((x): x is { modelRecordId: string; modelName: string } => x != null);
    try {
      const result = await bulkAddModelsToShift({
        shiftRecordId: activeShift.id,
        items,
        chatterRecordId: chatterId,
        chatterName,
      });
      if (!result.success) {
        setError(result.error);
        addToast(localToast(`add-models-err-${Date.now()}`, "Could not add models", result.error, "high"));
        return;
      }
      setShowAddModelModal(false);
      setSelectedAddModelIds(new Set());
      const n = result.added;
      setSuccessMessage(n === 1 ? "Model added." : `${n} models added.`);
      addToast(
        localToast(
          `add-models-ok-${Date.now()}`,
          "Shift updated",
          `${n} model${n !== 1 ? "s" : ""} added to shift.`,
          "normal"
        )
      );
      router.refresh();
      requestRouterRefresh();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to add models";
      setError(msg);
      addToast(localToast(`add-models-err-${Date.now()}`, "Could not add models", msg, "high"));
    } finally {
      setIsAddingModelsToShift(false);
      submittingRef.current = false;
    }
  }

  function openRemoveModelConfirm(sm: ShiftModel) {
    if (!activeShift || removingId !== null || isEndingShift) return;
    setRemoveConfirmModel(sm);
  }

  function cancelRemoveModelConfirm() {
    setRemoveConfirmModel(null);
  }

  async function confirmRemoveModelFromShift() {
    if (submittingRef.current) return;
    const sm = removeConfirmModel;
    if (!sm || !activeShift) return;
    submittingRef.current = true;
    devLog("[remove-model]", {
      shiftId: activeShift.id,
      modelRecordId: sm.model_id,
      modelName: sm.model_name,
    });
    setRemoveConfirmModel(null);
    setRemovingId(sm.id);
    setError(null);
    try {
      const result = await removeModelFromShift(activeShift.id, sm.model_id);
      if (!result || !result.success) {
        const msg = result?.error ?? "Failed to remove model";
        setError(msg);
        addToast(localToast(`remove-model-err-${Date.now()}`, "Remove failed", msg, "high"));
        return;
      }
      if (result.shiftEnded) {
        setSuccessMessage("Shift ended — no models left on this shift.");
      }
      router.refresh();
      requestRouterRefresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to remove model";
      setError(msg);
      addToast(localToast(`remove-model-err-${Date.now()}`, "Remove failed", msg, "high"));
    } finally {
      setRemovingId(null);
      submittingRef.current = false;
    }
  }

  function openBreakConfirmModal() {
    if (!breakStartEligible) return;
    setBreakReminderMins(15);
    setShowBreakConfirmModal(true);
    setError(null);
  }

  function closeBreakConfirmModal() {
    setShowBreakConfirmModal(false);
  }

  async function confirmStartBreak(reminderMinutes: number | null) {
    if (!activeShift || submittingRef.current) return;
    submittingRef.current = true;
    setError(null);
    setBreakAction("starting");
    setBreakStartedAt(new Date());
    setShowBreakConfirmModal(false);
    try {
      const result = await startBreak(activeShift.id, reminderMinutes);
      if (result && "success" in result && !result.success) {
        setBreakStartedAt(null);
        setError(result.error);
        return;
      }
      requestRouterRefresh();
    } catch (err) {
      setBreakStartedAt(null);
      setError(err instanceof Error ? err.message : "Failed to start break");
    } finally {
      setBreakAction("idle");
      submittingRef.current = false;
    }
  }

  async function handleEndBreak() {
    if (!activeShift || submittingRef.current) return;
    submittingRef.current = true;
    setError(null);
    const bStartMs =
      breakStartTimeMs ??
      (breakStartedAt != null ? breakStartedAt.getTime() : null);
    const elapsed =
      bStartMs != null ? Math.max(1, Math.ceil((Date.now() - bStartMs) / 60000)) : 1;
    const usedForCap = clientTotalBreakUsed !== null ? clientTotalBreakUsed : breakUsed;
    const remainingSnap = Math.max(0, maxBreakMinutes - usedForCap);
    const additionalBreak = Math.min(elapsed, remainingSnap + elapsed);

    setBreakAction("ending");
    setOptimisticNotOnBreak(true);
    setBreakStartedAt(null);
    try {
      await endBreak(activeShift.id, additionalBreak);
      requestRouterRefresh();
    } catch (err) {
      setOptimisticNotOnBreak(false);
      setError(err instanceof Error ? err.message : "Failed to end break");
      requestRouterRefresh();
    } finally {
      setBreakAction("idle");
      submittingRef.current = false;
    }
  }

  async function handleEndShift() {
    if (!activeShift || submittingRef.current) return;
    submittingRef.current = true;
    setIsEndingShift(true);
    setError(null);
    try {
      await endShift(activeShift.id);
      setBreakStartedAt(null);
      setSuccessMessage("Shift ended.");
      requestRouterRefresh();
    } catch (err) {
      setIsEndingShift(false);
      setError(err instanceof Error ? err.message : "Failed to end shift");
      addToast(
        localToast(`shift-end-err-${Date.now()}`, "Failed to end shift", "Please try again.")
      );
    } finally {
      submittingRef.current = false;
    }
  }

  // ——— No active shift: start shift hero + intelligence ———
  if (!activeShift) {
    return (
      <>
        <BusyOverlay show={isStartingShift} title="Starting shift…" subtitle="Attaching models" />
        <div className={`space-y-8 ${isStartingShift ? "pointer-events-none opacity-90" : ""}`}>
        {error && (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-5 py-3 text-sm text-red-200">
            {error}
          </div>
        )}
        {successMessage && (
          <div className="rounded-2xl border border-[hsl(330,80%,55%)]/30 bg-[hsl(330,80%,55%)]/10 px-5 py-3 text-sm text-[hsl(330,90%,75%)]">
            {successMessage}
          </div>
        )}

        {todaySchedule && (
          <TodaySchedulePanel
            todayLabel={buildTodayLabel(todaySchedule.todayYmd, todaySchedule.todayWeekday)}
            items={todaySchedule.items}
            title="Your scheduled models today"
            emptyMessage="No scheduled models today"
          />
        )}
        {/* Start shift hero card */}
        <div
          className="glass-panel p-5 md:p-8 md:p-10"
          style={{ boxShadow: "0 0 0 1px rgba(255,255,255,0.05), 0 0 48px -12px hsl(330 80% 55% / 0.12)" }}
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/40">Live operations</p>
              <h2 className="mt-2 text-xl font-semibold tracking-tight text-white md:text-3xl">Start a shift</h2>
              <p className="mt-2 text-sm text-white/60 md:text-base">
                Select models and go live. You can add or remove models during your shift.
              </p>
            </div>
            <button
              type="button"
              onClick={handleRefresh}
              disabled={isStartingShift}
              className="flex shrink-0 items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white/60 transition-all hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              <RefreshCw className={`h-3.5 w-3.5 shrink-0 ${refreshing ? "animate-spin" : ""}`} aria-hidden />
              <span>{refreshing ? "Refreshing..." : "Refresh"}</span>
            </button>
          </div>
          <div className="mt-6 md:mt-8">
            <motion.button
              type="button"
              onClick={() => setShowModelSelect(true)}
              disabled={isStartingShift}
              whileTap={{ scale: 0.97 }}
              transition={{ duration: 0.12 }}
              className="w-full rounded-2xl bg-[hsl(330,80%,55%)] px-6 py-3.5 text-base font-medium text-white shadow-[0_0_32px_-8px_rgba(236,72,153,0.5)] transition hover:bg-[hsl(330,80%,50%)] disabled:cursor-not-allowed disabled:opacity-50 md:w-auto md:px-8 md:py-4"
            >
              Start shift
            </motion.button>

            <div className="mt-6 flex items-center gap-3">
              <div className="h-px flex-1 bg-white/10" />
              <span className="text-xs text-white/30">or</span>
              <div className="h-px flex-1 bg-white/10" />
            </div>

            {activeShiftsFromApi.length > 0 && !inQueue && (
              <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-5">
                <div className="mb-4 flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-500/20">
                    <Clock className="h-5 w-5 text-sky-400" aria-hidden />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-white">Join shift queue</p>
                    <p className="text-sm text-white/50">Auto-start when the current shift ends</p>
                  </div>
                </div>

                <div className="mb-4 rounded-xl border border-white/10 bg-black/20 p-3">
                  <p className="mb-2 text-xs uppercase tracking-widest text-white/40">Currently active</p>
                  <div className="space-y-2">
                    {activeShiftsFromApi.map((shift) => (
                      <div key={shift.id} className="flex items-center justify-between gap-2 text-sm">
                        <span className="truncate text-white/70">{shift.chatter_name}</span>
                        <span className="shrink-0 text-xs text-white/40">{shift.duration_minutes} min in</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mb-4">
                  {weeklyProgramModels.length === 0 ? (
                    <>
                      <p className="mb-2 text-xs uppercase tracking-widest text-white/40">
                        Select models for your shift
                      </p>
                      <div className="flex max-h-48 flex-col gap-2 overflow-y-auto pr-1">
                        {queuePickerFreeModels.map((model) => (
                          <label
                            key={model.id}
                            className={cn(
                              "flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 transition-all",
                              queueSelectedModelIds.has(model.id)
                                ? "border-[hsl(330,80%,55%)]/40 bg-[hsl(330,80%,55%)]/15 text-[hsl(330,90%,80%)]"
                                : "border-white/10 bg-white/5 text-white/60 hover:border-white/20"
                            )}
                          >
                            <input
                              type="checkbox"
                              checked={queueSelectedModelIds.has(model.id)}
                              onChange={() => toggleQueueModel(model.id)}
                              className="sr-only"
                            />
                            <div
                              className={cn(
                                "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                                queueSelectedModelIds.has(model.id)
                                  ? "bg-[hsl(330,80%,55%)]/30 text-[hsl(330,90%,80%)]"
                                  : "bg-white/10 text-white/50"
                              )}
                            >
                              {(model.model_name || "?").trim().slice(0, 1).toUpperCase() || "?"}
                            </div>
                            <span className="min-w-0 flex-1 truncate text-sm font-medium">{model.model_name}</span>
                            <span className="shrink-0 text-xs font-medium text-emerald-400">Free</span>
                          </label>
                        ))}
                      </div>
                      {queuePickerFreeModels.length === 0 ? (
                        <p className="mt-2 text-sm text-white/30">No free models available right now.</p>
                      ) : null}
                    </>
                  ) : (
                    <>
                      <p className="mb-2 text-xs uppercase tracking-widest text-white/40">
                        Your models (from weekly program)
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {weeklyProgramModels.map((model) => (
                          <label
                            key={model.id}
                            className={cn(
                              "flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-1.5 text-sm transition-all",
                              queueSelectedModelIds.has(model.id)
                                ? "border-[hsl(330,80%,55%)]/40 bg-[hsl(330,80%,55%)]/15 text-[hsl(330,90%,80%)]"
                                : "border-white/10 bg-white/5 text-white/60 hover:border-white/20"
                            )}
                          >
                            <input
                              type="checkbox"
                              checked={queueSelectedModelIds.has(model.id)}
                              onChange={() => toggleQueueModel(model.id)}
                              className="sr-only"
                            />
                            {model.name}
                          </label>
                        ))}
                      </div>
                    </>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => void handleJoinQueue()}
                  disabled={queueJoinBusy || isStartingShift || queueSelectedModelIds.size === 0}
                  className="w-full rounded-xl border border-sky-500/35 bg-sky-500/15 py-3 font-semibold text-sky-300 transition hover:bg-sky-500/25 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {queueJoinBusy
                    ? "Joining…"
                    : queueSelectedModelIds.size === 0
                      ? "Select at least one model"
                      : `Join queue with ${queueSelectedModelIds.size} model${queueSelectedModelIds.size > 1 ? "s" : ""}`}
                </button>
              </div>
            )}

            {inQueue && (
              <div className="mt-6 rounded-2xl border border-sky-500/25 bg-sky-500/10 p-5">
                <div className="mb-4 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-sky-400" aria-hidden />
                    <span className="font-semibold text-sky-300">In queue</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleCancelQueue()}
                    disabled={queueCancelBusy}
                    className="text-xs text-white/40 transition hover:text-red-400 disabled:opacity-50"
                  >
                    {queueCancelBusy ? "…" : "Cancel"}
                  </button>
                </div>

                <div className="mb-3 rounded-xl border border-white/10 bg-white/5 p-3">
                  <p className="mb-1 text-xs text-white/40">Waiting for</p>
                  <p className="font-semibold text-white">{queueStatus?.waitingForChatter ?? "—"}</p>
                  <p className="mt-1 text-xs text-white/40">
                    Has been on shift for {queueStatus?.activeShiftDuration ?? 0} min
                  </p>
                </div>

                <div className="mb-3 flex items-center gap-2 text-sm text-sky-300">
                  <Clock className="h-4 w-4 shrink-0" aria-hidden />
                  <span>Estimated wait: {queueStatus?.estimatedWait ?? "—"}</span>
                </div>

                {(queueStatus?.totalInQueue ?? 0) > 1 && (
                  <p className="mb-3 text-xs text-white/40">
                    Position {queueStatus?.queuePosition ?? 1} of {queueStatus?.totalInQueue ?? 1} in queue
                  </p>
                )}

                <div className="mt-3 border-t border-white/10 pt-3">
                  <p className="mb-2 text-xs text-white/40">Your models when shift starts</p>
                  <div className="flex flex-wrap gap-1.5">
                    {(queueStatus?.selectedModelNames?.length
                      ? queueStatus.selectedModelNames
                      : Array.from(queueSelectedModelIds).map(
                          (id) =>
                            weeklyProgramModels.find((m) => m.id === id)?.name ??
                            modelss.find((m) => m.id === id)?.model_name ??
                            id
                        )
                    ).map((name, idx) => (
                      <span
                        key={`${name}-${idx}`}
                        className="rounded-full bg-white/10 px-2 py-0.5 text-xs text-white/60"
                      >
                        {name}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Bottom intelligence */}
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="glass-card p-5">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-white/70">Free models</h3>
            <div className="mt-4 space-y-3">
              {freeModelss.length === 0 ? (
                <p className="text-sm text-white/45">None available</p>
              ) : (
                freeModelss.map((m) => <FreeModelIntelCard key={m.id} model={m} />)
              )}
            </div>
          </div>
          <div className="glass-card p-5">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-white/70">Taken models</h3>
            <p className="mt-1 text-xs text-white/45">Who is on each model right now</p>
            <div className="mt-4 space-y-3">
              {occupiedModelss.length === 0 ? (
                <p className="text-sm text-white/45">None</p>
              ) : (
                occupiedModelss.map((m) => <TakenModelIntelCard key={m.id} model={m} />)
              )}
            </div>
          </div>
        </div>

        {showModelSelect && (
          <ModelSelectModal
            modelss={modelss}
            selectedModelIds={selectedModelIds}
            onToggle={toggleModelSelection}
            onConfirm={handleConfirmModelSelection}
            onCancel={() => {
              setShowModelSelect(false);
              setError(null);
            }}
            loading={isStartingShift}
            error={error}
            schedulePanel={
              todaySchedule ? (
                <TodayScheduleCollapsible
                  todayLabel={buildTodayLabel(todaySchedule.todayYmd, todaySchedule.todayWeekday)}
                  items={todaySchedule.items}
                  title="Your scheduled models today"
                  emptyMessage="No scheduled models today"
                />
              ) : null
            }
          />
        )}
        </div>
      </>
    );
  }

  // ——— Active shift: hero + two-column + intelligence ———
  const startedAtLabel = activeShift.start_time ? formatDateTimeEuropean(activeShift.start_time) : "—";
  const statusLabel =
    breakAction === "starting"
      ? "On break…"
      : breakAction === "ending"
        ? "Ending break…"
        : isOnBreak
          ? "On break"
          : "Running";
  const statusBadgeColor =
    isOnBreak || breakAction === "starting" || breakAction === "ending"
      ? "bg-amber-500/20 text-amber-300 border-amber-500/30"
      : "bg-emerald-500/20 text-emerald-300 border-emerald-500/30";

  return (
    <>
      <BusyOverlay show={isEndingShift} title="Ending shift…" subtitle="Releasing all models" />
      <div className={`space-y-6 pb-24 md:space-y-8 md:pb-0 ${isEndingShift ? "pointer-events-none" : ""}`}>
      {error && (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-5 py-3 text-sm text-red-200">
          {error}
        </div>
      )}
      {successMessage && (
        <div className="rounded-2xl border border-[hsl(330,80%,55%)]/30 bg-[hsl(330,80%,55%)]/10 px-5 py-3 text-sm text-[hsl(330,90%,75%)]">
          {successMessage}
        </div>
      )}

      {/* 1. Top hero / control center card — stacked on mobile, grid on desktop */}
      <div
        className="glass-panel p-4 md:p-8"
        style={{ boxShadow: "0 0 0 1px rgba(255,255,255,0.05), 0 0 48px -12px hsl(330 80% 55% / 0.12)" }}
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-semibold tracking-tight text-white md:text-3xl">Shift Active</h2>
            <p className="mt-1 text-base italic text-white/70 md:text-lg">Milk them.</p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${statusBadgeColor}`}
            >
              <span
                className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                  isOnBreak || breakAction === "starting" || breakAction === "ending"
                    ? "bg-amber-400 animate-pulse"
                    : "bg-emerald-400 animate-pulse"
                }`}
                aria-hidden
              />
              {statusLabel}
            </span>
            <button
              type="button"
              onClick={handleRefresh}
              className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white/60 transition-all hover:bg-white/10 hover:text-white"
            >
              <RefreshCw className={`h-3.5 w-3.5 shrink-0 ${refreshing ? "animate-spin" : ""}`} aria-hidden />
              <span>{refreshing ? "Refreshing..." : "Refresh"}</span>
            </button>
          </div>
        </div>

        <div className="mt-6 grid gap-6 md:mt-8 md:grid-cols-12 md:gap-6">
          <div className="md:col-span-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-white/50">Started at</p>
            <p className="mt-1.5 text-sm font-medium text-white md:text-base">{startedAtLabel}</p>
          </div>
          <div className="md:col-span-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-pink-200/80">Shift duration</p>
            <div className="mt-2 rounded-2xl border border-pink-500/30 bg-gradient-to-br from-pink-500/[0.12] via-black/50 to-fuchsia-950/25 px-4 py-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_0_40px_-12px_rgba(236,72,153,0.25)] md:px-5 md:py-6">
              {activeShift?.start_time ? (
                <LiveTimer startTime={activeShift.start_time} variant="hero" glowPulse as="div" />
              ) : (
                <span className="block text-3xl font-bold text-white/35">—</span>
              )}
            </div>
          </div>
          <div className="md:col-span-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-amber-300/90">Break timer</p>
            {isOnBreak ? (
              <>
                <div className="mt-2 rounded-2xl border border-amber-500/35 bg-gradient-to-br from-amber-500/15 via-black/45 to-black/60 px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_0_32px_-10px_rgba(251,191,36,0.2)] md:px-5 md:py-5">
                  {breakStartedAtIso ? (
                    <LiveTimer startTime={breakStartedAtIso} mode="break" variant="hero" glowPulse as="div" />
                  ) : (
                    <span className="block text-3xl font-bold text-amber-200/50">00:00:00</span>
                  )}
                </div>
                <p className="mt-2 text-xs font-medium text-amber-100/85 md:text-sm">
                  {totalBreakUsedDisplay} / {maxBreakMinutes} min used
                </p>
              </>
            ) : (
              <p className="mt-2 text-sm font-medium text-amber-100/90 md:text-base">
                {totalBreakUsedDisplay} / {maxBreakMinutes} min used
              </p>
            )}
          </div>
        </div>

        {activeShift && takenWeeklyModels.length > 0 && !addModelsQueueEntry && (
          <div className="mt-4 rounded-2xl border border-amber-500/25 bg-amber-500/5 p-4">
            <div className="mb-3 flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-500/20">
                <Clock className="h-4 w-4 text-amber-400" aria-hidden />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white">Models in use</p>
                <p className="text-xs text-white/50">Queue to auto-add when they are free</p>
              </div>
            </div>
            <div className="mb-3 space-y-1.5">
              {takenWeeklyModels.map((model) => (
                <div
                  key={model.id}
                  className="flex items-center justify-between rounded-xl bg-white/5 px-3 py-2"
                >
                  <span className="text-sm text-white/70">{model.name}</span>
                  <span className="text-xs text-amber-400">With {model.takenByChatter}</span>
                </div>
              ))}
            </div>
            {takenWeeklyModels.some((m) => m.waitingShiftId !== takenWeeklyModels[0]?.waitingShiftId) ? (
              <p className="mb-2 text-xs text-white/40">
                Only models on the same shift as &ldquo;{takenWeeklyModels[0]?.name}&rdquo; will be queued first.
                After they join your shift, queue again for any others.
              </p>
            ) : null}
            <button
              type="button"
              onClick={() => void handleQueueForModels()}
              disabled={addModelsQueueBusy}
              className="w-full rounded-xl border border-amber-500/30 bg-amber-500/20 py-2.5 text-sm font-semibold text-amber-400 transition hover:bg-amber-500/30 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {addModelsQueueBusy ? "Joining…" : "Queue for these models"}
            </button>
          </div>
        )}

        {addModelsQueueEntry && (
          <div className="mt-4 rounded-2xl border border-sky-500/25 bg-sky-500/5 p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-sky-400" aria-hidden />
                <span className="text-sm font-semibold text-sky-400">Waiting for models</span>
              </div>
              <button
                type="button"
                onClick={() => void handleCancelQueue()}
                disabled={queueCancelBusy}
                className="text-xs text-white/30 transition hover:text-red-400 disabled:opacity-50"
              >
                {queueCancelBusy ? "…" : "Cancel"}
              </button>
            </div>
            {queueStatus?.queue_type === "add_models" && (queueStatus?.totalInQueue ?? 0) > 1 ? (
              <p className="mb-2 text-xs text-white/35">
                {queueStatus.queuePosition} of {queueStatus.totalInQueue} in this add-models queue
              </p>
            ) : null}
            <p className="mb-2 text-xs text-white/40">Will be added when freed:</p>
            <div className="flex flex-wrap gap-1.5">
              {(addModelsQueueEntry.selected_model_names.filter(Boolean).length
                ? addModelsQueueEntry.selected_model_names.filter(Boolean)
                : takenWeeklyModels.map((m) => m.name)
              ).map((name, idx) => (
                <span key={`${name}-${idx}`} className="rounded-full bg-white/10 px-2 py-0.5 text-xs text-white/60">
                  {name}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Desktop: inline action buttons */}
        <div className="mt-6 hidden flex-wrap items-center gap-3 md:mt-8 md:flex">
          <motion.button
            type="button"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => {
              setSelectedAddModelIds(new Set());
              setError(null);
              setShowAddModelModal(true);
            }}
            disabled={shiftControlsBusy}
            className={cn(
              shiftActionBtn,
              "border border-pink-400/40 bg-gradient-to-r from-pink-500/20 to-fuchsia-600/15 text-pink-100 shadow-[0_0_24px_-8px_hsl(330_80%_55%/0.35)] hover:border-pink-300/55 hover:from-pink-500/30 hover:to-fuchsia-600/25"
            )}
          >
            <UserPlus className="h-4 w-4 shrink-0" aria-hidden />
            Add model
          </motion.button>
          {canStartBreak && (
            <motion.button
              type="button"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={openBreakConfirmModal}
              disabled={shiftControlsBusy}
              className={cn(
                shiftActionBtn,
                "border border-white/18 bg-white/[0.07] text-white shadow-md hover:border-amber-400/35 hover:bg-amber-500/10 hover:text-amber-50"
              )}
            >
              <Coffee className="h-4 w-4 shrink-0 text-amber-200/90" aria-hidden />
              Start break
            </motion.button>
          )}
          {isOnBreak && (
            <motion.button
              type="button"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleEndBreak}
              disabled={shiftControlsBusy}
              className={cn(
                shiftActionBtn,
                "border border-pink-400/30 bg-gradient-to-r from-pink-500 to-fuchsia-600 text-white shadow-[0_0_28px_-6px_hsl(330_80%_55%/0.45)] hover:brightness-110"
              )}
            >
              {breakAction === "ending" ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden /> : null}
              {breakAction === "ending" ? "Ending break…" : "End break"}
            </motion.button>
          )}
          <motion.button
            type="button"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleEndShift}
            disabled={shiftControlsBusy}
            className={cn(
              shiftActionBtn,
              "border border-red-400/45 bg-red-500/15 text-red-100 hover:border-red-400/60 hover:bg-red-500/25 hover:shadow-[0_0_24px_-8px_rgba(248,113,113,0.35)]"
            )}
          >
            <LogOut className="h-4 w-4 shrink-0" aria-hidden />
            End shift
          </motion.button>
        </div>
      </div>

      {/* 2. Active models — stacked on mobile, two-column on desktop */}
      <div className="grid gap-4 md:gap-6 lg:grid-cols-5 lg:gap-8">
        <div className="lg:col-span-3">
          <div className="glass-card p-4 md:p-5">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-white/70">Active models</h3>
            {(() => {
              const names = shiftModels
                .filter((sm) => modelIdsInActivePeriodToday.includes(sm.model_id))
                .map((sm) => sm.model_name)
                .filter(Boolean);
              if (names.length === 0) return null;
              return (
                <p className="mt-3 rounded-xl border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-xs text-amber-100/95">
                  ⚠️ {names.join(", ")} may have content restrictions today
                </p>
              );
            })()}
            <div className="mt-4 space-y-3">
              {shiftModels.length === 0 ? (
                <p className="rounded-xl border border-white/10 bg-white/5 px-4 py-6 text-center text-sm text-white/50">
                  No models in this shift. Add one below.
                </p>
              ) : (
                shiftModels.map((sm) => (
                  <motion.div
                    key={sm.id}
                    layout
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ type: "spring", stiffness: 380, damping: 28 }}
                    className="flex items-center justify-between gap-4 rounded-2xl border border-white/12 bg-gradient-to-r from-white/[0.07] to-black/40 px-4 py-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition-shadow hover:border-pink-500/25 hover:shadow-[0_8px_28px_-12px_hsl(330_80%_55%/0.15)] md:px-5"
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <ModelAvatar name={sm.model_name} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold text-white">{sm.model_name}</p>
                        <motion.p
                          key={sm.entered_at ?? sm.id}
                          initial={{ opacity: 0, x: -6 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ type: "spring", stiffness: 420, damping: 28 }}
                          className="mt-0.5 text-xs text-white/55"
                        >
                          Entered{" "}
                          <motion.span
                            key={`${sm.id}-${formatEnteredAt(sm.entered_at)}`}
                            className="inline-block font-mono tabular-nums text-pink-100/90"
                            initial={{ opacity: 0.35, scale: 0.96 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                          >
                            {formatEnteredAt(sm.entered_at)}
                          </motion.span>
                        </motion.p>
                        {modelIdsInActivePeriodToday.includes(sm.model_id) && (
                          <p className="mt-1 text-[11px] text-amber-200/90">⚠️ Possible content restrictions today</p>
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => openRemoveModelConfirm(sm)}
                      disabled={removingId !== null || isEndingShift || removeConfirmModel !== null}
                      className="inline-flex min-h-[44px] shrink-0 items-center justify-center gap-2 rounded-xl border border-white/20 px-4 py-2 text-sm font-medium text-white/75 transition-colors hover:border-red-400/35 hover:bg-red-500/10 hover:text-red-100 disabled:cursor-not-allowed disabled:opacity-50 md:min-h-0 md:rounded-lg md:px-3 md:py-1.5 md:text-xs"
                    >
                      {removingId === sm.id ? (
                        <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
                      ) : null}
                      {removingId === sm.id ? "Removing…" : "Remove"}
                    </button>
                  </motion.div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="space-y-6 lg:col-span-2">
          <div className="glass-card p-5">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-white/70">Shift controls</h3>
            <p className="mt-1 text-xs text-white/50">Add model, break, end shift</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <motion.button
                type="button"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => {
                  setSelectedAddModelIds(new Set());
                  setError(null);
                  setShowAddModelModal(true);
                }}
                disabled={shiftControlsBusy}
                className={cn(
                  shiftActionBtn,
                  "rounded-lg border border-pink-400/40 bg-pink-500/15 px-3 py-2 text-sm text-pink-100 hover:bg-pink-500/25"
                )}
              >
                <UserPlus className="h-4 w-4 shrink-0" aria-hidden />
                Add model
              </motion.button>
              {canStartBreak && (
                <motion.button
                  type="button"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={openBreakConfirmModal}
                  disabled={shiftControlsBusy}
                  className={cn(
                    shiftActionBtn,
                    "rounded-lg border border-white/18 bg-white/[0.07] px-3 py-2 text-sm text-white hover:border-amber-400/30 hover:bg-amber-500/10"
                  )}
                >
                  <Coffee className="h-4 w-4 shrink-0 text-amber-200/90" aria-hidden />
                  Start break
                </motion.button>
              )}
              {isOnBreak && (
                <motion.button
                  type="button"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleEndBreak}
                  disabled={shiftControlsBusy}
                  className={cn(
                    shiftActionBtn,
                    "rounded-lg bg-gradient-to-r from-pink-500 to-fuchsia-600 px-3 py-2 text-sm text-white shadow-[0_0_20px_-6px_hsl(330_80%_55%/0.4)] hover:brightness-110"
                  )}
                >
                  {breakAction === "ending" ? <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" aria-hidden /> : null}
                  {breakAction === "ending" ? "Ending break…" : "End break"}
                </motion.button>
              )}
              <motion.button
                type="button"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleEndShift}
                disabled={shiftControlsBusy}
                className={cn(
                  shiftActionBtn,
                  "rounded-lg border border-red-400/45 bg-red-500/15 px-3 py-2 text-sm text-red-100 hover:bg-red-500/25"
                )}
              >
                <LogOut className="h-4 w-4 shrink-0" aria-hidden />
                End shift
              </motion.button>
            </div>
          </div>

          <div className="glass-card p-5" style={{ boxShadow: "0 0 0 1px rgba(251,191,36,0.08), 0 0 24px -8px rgba(251,191,36,0.15)" }}>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-amber-400/80">Break tracker</h3>
            {isOnBreak ? (
              <>
                <div className="mt-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-3">
                  {breakStartedAtIso ? (
                    <LiveTimer startTime={breakStartedAtIso} mode="break" variant="hero" glowPulse as="div" />
                  ) : (
                    <span className="block text-2xl font-bold text-amber-200/50">00:00:00</span>
                  )}
                </div>
                <p className="mt-1 text-sm text-amber-200/80">{totalBreakUsedDisplay} / {maxBreakMinutes} min used</p>
                <p className="mt-0.5 text-xs text-amber-200/60">{remainingBreak} min remaining</p>
              </>
            ) : (
              <>
                <p className="mt-2 font-mono text-xl tabular-nums text-amber-200/95">{totalBreakUsedDisplay} <span className="text-amber-200/50">/ {maxBreakMinutes}</span> min used</p>
                <p className="mt-1 text-xs text-amber-200/60">{remainingBreak} min remaining</p>
              </>
            )}
          </div>

          <div className="glass-card p-5">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-white/70">Shift details</h3>
            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-white/55">Started</dt>
                <dd className="text-white/90">{startedAtLabel}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-white/55">Status</dt>
                <dd className="text-white/90">{statusLabel}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-white/55">Models</dt>
                <dd className="text-white/90">{shiftModels.length}</dd>
              </div>
            </dl>
          </div>
        </div>
      </div>

      {/* 3. Bottom intelligence */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="glass-card p-5">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-white/70">Free models</h3>
          <div className="mt-4 space-y-3">
            {freeModelss.length === 0 ? (
              <p className="text-sm text-white/45">None available</p>
            ) : (
              freeModelss.map((m) => <FreeModelIntelCard key={m.id} model={m} />)
            )}
          </div>
        </div>
        <div className="glass-card p-5">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-white/70">Taken models</h3>
          <p className="mt-1 text-xs text-white/45">Who is on each model right now</p>
          <div className="mt-4 space-y-3">
            {occupiedModelss.length === 0 ? (
              <p className="text-sm text-white/45">None</p>
            ) : (
              occupiedModelss.map((m) => <TakenModelIntelCard key={m.id} model={m} />)
            )}
          </div>
        </div>
      </div>

      {/* Mobile: sticky control bar above bottom nav */}
      <div
        className="fixed left-0 right-0 z-30 flex flex-col gap-2 border-t border-white/10 bg-black/95 py-3 pl-4 pr-[5.25rem] backdrop-blur-md md:hidden"
        style={{
          bottom: "calc(64px + env(safe-area-inset-bottom, 0px))",
          boxShadow: "0 -4px 20px rgba(0,0,0,0.4)",
        }}
      >
        <div className="grid min-w-0 grid-cols-2 gap-2">
          <motion.button
            type="button"
            whileTap={{ scale: 0.98 }}
            onClick={() => {
              setSelectedAddModelIds(new Set());
              setError(null);
              setShowAddModelModal(true);
            }}
            disabled={shiftControlsBusy}
            className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-pink-400/40 bg-pink-500/15 px-3 py-3 text-sm font-semibold text-pink-100 shadow-[0_0_20px_-8px_hsl(330_80%_55%/0.35)] hover:bg-pink-500/25 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <UserPlus className="h-4 w-4 shrink-0" aria-hidden />
            Add model
          </motion.button>
          {canStartBreak && (
            <motion.button
              type="button"
              whileTap={{ scale: 0.98 }}
              onClick={openBreakConfirmModal}
              disabled={shiftControlsBusy}
              className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-white/18 bg-white/[0.07] px-3 py-3 text-sm font-semibold text-white hover:border-amber-400/35 hover:bg-amber-500/10 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Coffee className="h-4 w-4 shrink-0 text-amber-200" aria-hidden />
              Break
            </motion.button>
          )}
          {isOnBreak && (
            <motion.button
              type="button"
              whileTap={{ scale: 0.98 }}
              onClick={handleEndBreak}
              disabled={shiftControlsBusy}
              className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-pink-500 to-fuchsia-600 px-3 py-3 text-sm font-semibold text-white shadow-[0_0_20px_-6px_hsl(330_80%_55%/0.4)] hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {breakAction === "ending" ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden /> : null}
              {breakAction === "ending" ? "Ending…" : "End break"}
            </motion.button>
          )}
          <motion.button
            type="button"
            whileTap={{ scale: 0.98 }}
            onClick={handleEndShift}
            disabled={shiftControlsBusy}
            className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-red-400/45 bg-red-500/15 px-3 py-3 text-sm font-semibold text-red-100 hover:bg-red-500/25 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <LogOut className="h-4 w-4 shrink-0" aria-hidden />
            End shift
          </motion.button>
        </div>
      </div>

      {showAddModelModal && (
        <AddModelToShiftModal
          modelss={modelss}
          alreadyInShiftModelIds={new Set(shiftModels.map((sm) => sm.model_id))}
          selectedModelIds={selectedAddModelIds}
          onToggle={toggleAddModelSelection}
          onConfirm={handleConfirmAddModels}
          onCancel={() => {
            setShowAddModelModal(false);
            setSelectedAddModelIds(new Set());
            setError(null);
          }}
          loading={isAddingModelsToShift}
          shiftInteractionLocked={shiftControlsBusy}
          error={error}
        />
      )}

      {showBreakConfirmModal && activeShift && typeof document !== "undefined"
        ? createPortal(
            <div
              className="fixed inset-0 z-[10050] flex items-center justify-center p-4"
              role="dialog"
              aria-modal="true"
              aria-labelledby="break-confirm-title"
            >
              <button
                type="button"
                className="absolute inset-0 bg-black/75 backdrop-blur-sm"
                aria-label="Dismiss"
                onClick={closeBreakConfirmModal}
              />
              <div className="relative z-10 w-full max-w-md rounded-2xl border border-white/10 bg-[#111] p-5 shadow-2xl">
                <h3 id="break-confirm-title" className="text-lg font-semibold text-white">
                  Starting break
                </h3>
                <p className="mt-2 text-sm text-white/70">You have {remainingBreak} min remaining</p>
                <div className="mt-5">
                  <p className="text-sm font-medium text-white/85">Remind me in:</p>
                  <div className="mt-2 grid grid-cols-4 gap-2">
                    {[5, 10, 15, 20, 30].map((mins) => (
                      <button
                        key={mins}
                        type="button"
                        onClick={() => setBreakReminderMins(mins)}
                        className={`rounded-lg px-2 py-2.5 text-sm font-medium transition-colors ${
                          breakReminderMins === mins ? "bg-pink-600 text-white" : "bg-white/10 text-white/90 hover:bg-white/15"
                        }`}
                      >
                        {mins}m
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setBreakReminderMins(null)}
                      className={`col-span-3 rounded-lg px-2 py-2.5 text-sm font-medium transition-colors ${
                        breakReminderMins === null ? "bg-pink-600 text-white" : "bg-white/10 text-white/90 hover:bg-white/15"
                      }`}
                    >
                      No reminder
                    </button>
                  </div>
                </div>
                <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:gap-3">
                  <button
                    type="button"
                    onClick={closeBreakConfirmModal}
                    className="flex min-h-[48px] flex-1 items-center justify-center rounded-xl border border-white/20 bg-transparent text-sm font-semibold text-white/90 hover:bg-white/5"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => void confirmStartBreak(breakReminderMins)}
                    disabled={breakAction === "starting"}
                    className="flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-xl bg-pink-600 text-sm font-semibold text-white hover:bg-pink-500 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {breakAction === "starting" ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden /> : null}
                    Start break
                  </button>
                </div>
              </div>
            </div>,
            document.body
          )
        : null}

      <ConfirmDialog
        open={removeConfirmModel != null}
        onClose={() => removingId === null && cancelRemoveModelConfirm()}
        onConfirm={() => void confirmRemoveModelFromShift()}
        title="Remove model"
        description={
          removeConfirmModel ? `Remove ${removeConfirmModel.model_name} from this shift?` : ""
        }
        confirmLabel="Remove"
        confirmVariant="danger"
        loading={removingId !== null}
      />
    </div>
    </>
  );
}
