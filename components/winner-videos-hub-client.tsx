"use client";

import * as React from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import {
  ChevronDown,
  ExternalLink,
  FolderOpen,
  Info,
  Layers,
  Loader2,
  RefreshCw,
  Search,
  Settings2,
  Sparkles,
  Trash2,
  Trophy,
  X,
} from "lucide-react";
import { useToast } from "@/contexts/toast-context";
import { winnerVideoLocalToast } from "@/components/winner-videos-shared";
import { CountUp, LuxuryStatCard, StatInfoTooltip } from "@/components/infloww-performance-ui";
import { FilterBar, FilterChip } from "@/components/manager-review-ui";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useSupabaseRealtimeRefresh } from "@/lib/hooks/use-supabase-realtime";
import {
  VA_BTN_PRIMARY,
  VA_BTN_SECONDARY,
  VA_CARD,
  VA_CARD_GLOW,
  VA_FILTER_INPUT,
  VA_STATUS_BADGE,
} from "@/lib/va-tasks-tokens";
import {
  SUPER_WINNER_VIEW_THRESHOLD,
  TIER_RECREATE_COUNTS,
  WINNER_SUBMISSION_SOURCE_LABELS,
  WINNER_VIEW_THRESHOLD,
  tierLabel,
  type WinnerSourcingRecreateConfig,
  type WinnerSubmissionSource,
  type WinnerTier,
} from "@/lib/winner-sourcing-helpers";
import { ROUTES } from "@/lib/routes";
import type {
  RecreationQueueItem,
  VideoBunch,
  WinnerSubmission,
  WinnerSubmissionDeleteImpact,
} from "@/services/winner-sourcing";
import { cn } from "@/lib/utils";

function formatSubmissionDeleteDescription(
  impact: WinnerSubmissionDeleteImpact | null,
  loading: boolean,
): string {
  if (loading || !impact) return "Checking linked records…";
  const tier = impact.tier === "super_winner" ? "Super Winner" : "Winner";
  const who = impact.model_name.trim() || "this model";

  if (impact.is_simple_delete) {
    return `Permanently delete this ${tier} entry for ${who}? This cannot be undone.`;
  }

  const lines: string[] = [];
  if (impact.recreation_queue_items > 0) {
    lines.push(
      `${impact.recreation_queue_items} recreation queue item${impact.recreation_queue_items === 1 ? "" : "s"}`,
    );
  }
  if (impact.recreate_video_slots > 0) {
    lines.push(
      `${impact.recreate_video_slots} recreate slot${impact.recreate_video_slots === 1 ? "" : "s"}`,
    );
  }
  if (impact.winner_videos > 0) {
    lines.push(
      `${impact.winner_videos} Creative Scripts work item${impact.winner_videos === 1 ? "" : "s"}`,
    );
  }
  if (impact.filming_filmed_slots > 0) {
    lines.push(
      `${impact.filming_filmed_slots} filmed slot${impact.filming_filmed_slots === 1 ? "" : "s"}`,
    );
  }
  if (impact.filming_edited_slots > 0) {
    lines.push(
      `${impact.filming_edited_slots} edited slot${impact.filming_edited_slots === 1 ? "" : "s"}`,
    );
  }

  const bunchBit = impact.bunch_name
    ? ` assigned to bunch “${impact.bunch_name}”`
    : impact.assigned_to_bunch
      ? " assigned to a bunch"
      : "";

  let text = `This will permanently delete this ${tier} for ${who}${bunchBit}`;
  if (lines.length) text += ` and remove: ${lines.join(", ")}`;
  text += ". Deleting cannot be undone.";
  if (impact.has_valuable_work) {
    text += ` Warning: this entry has valuable in-progress work (${impact.valuable_work_reasons.join("; ")}). Type the model name to confirm.`;
  } else {
    text += " Type the model name to confirm.";
  }
  return text;
}

export type HubModelOption = { model_id: string; model_name: string };
export type HubCreativeOption = {
  id: string;
  name: string;
  email?: string;
  role?: string;
};

/** @deprecated Filmer assign lives on /admin/bunches */
export type HubFilmerOption = HubCreativeOption;

type TabId = "winners" | "super" | "queue" | "settings";
type DateRangeId = "all" | "7d" | "30d" | "90d";
type AssignFilter = "all" | "unassigned" | "assigned";

const TABS: { id: TabId; label: string }[] = [
  { id: "winners", label: "Winners" },
  { id: "super", label: "Super Winners" },
  { id: "queue", label: "Recreation Queue" },
  { id: "settings", label: "Settings" },
];

const DATE_RANGE_OPTIONS: { id: DateRangeId; label: string }[] = [
  { id: "all", label: "All time" },
  { id: "7d", label: "7 days" },
  { id: "30d", label: "30 days" },
  { id: "90d", label: "90 days" },
];

const SOURCE_FILTER_OPTIONS: { id: WinnerSubmissionSource | ""; label: string }[] = [
  { id: "", label: "All sources" },
  { id: "auto_detected", label: "Auto-detected" },
  { id: "va_submitted", label: "VA Submitted" },
  { id: "researcher_submitted", label: "Researcher Submitted" },
];

const THRESHOLD_TOOLTIP = `Default view thresholds: Winner ≥ ${WINNER_VIEW_THRESHOLD.toLocaleString()} · Super Winner ≥ ${SUPER_WINNER_VIEW_THRESHOLD.toLocaleString()}. Per-model ClarioSuite thresholds are configured in Settings when auto-detection is enabled.`;

function formatViews(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M`;
  if (n >= 10_000) return `${Math.round(n / 1000)}k`;
  return Math.round(n).toLocaleString();
}

function formatShortDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function inDateRange(iso: string | null | undefined, range: DateRangeId): boolean {
  if (range === "all" || !iso) return true;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return true;
  const days = range === "7d" ? 7 : range === "30d" ? 30 : 90;
  return t >= Date.now() - days * 24 * 60 * 60 * 1000;
}

function ModelAvatar({ name, size = "md" }: { name: string; size?: "sm" | "md" | "lg" }) {
  const initial = name.trim().slice(0, 1).toUpperCase() || "?";
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#D4AF8C] to-[#FF1493] font-bold uppercase text-white shadow-inner ring-2 ring-white/10",
        size === "sm" && "h-7 w-7 text-[10px]",
        size === "md" && "h-9 w-9 text-xs",
        size === "lg" && "h-11 w-11 text-sm",
      )}
      aria-hidden
    >
      {initial}
    </span>
  );
}

function TierBadge({ tier, prominent }: { tier: WinnerTier; prominent?: boolean }) {
  const superTier = tier === "super_winner";
  return (
    <span
      className={cn(
        VA_STATUS_BADGE,
        "inline-flex items-center gap-1 font-semibold",
        superTier
          ? "border-amber-300/45 bg-gradient-to-r from-amber-400/25 via-yellow-200/15 to-slate-200/10 text-amber-100 shadow-[0_0_20px_-6px_rgba(251,191,36,0.55)]"
          : "border-[#D4AF8C]/40 bg-gradient-to-r from-[#D4AF8C]/20 to-[#D4AF8C]/05 text-[#F0D9B8]",
        prominent && superTier && "px-2.5 py-1 text-[11px] tracking-wide",
      )}
      title={
        superTier
          ? `Super Winner · ≥ ${SUPER_WINNER_VIEW_THRESHOLD.toLocaleString()} views`
          : `Winner · ≥ ${WINNER_VIEW_THRESHOLD.toLocaleString()} views`
      }
    >
      {superTier ? <Sparkles className="h-3 w-3" /> : <Trophy className="h-3 w-3" />}
      {tierLabel(tier)}
    </span>
  );
}

function SourceBadge({ source }: { source: WinnerSubmissionSource }) {
  const styles: Record<WinnerSubmissionSource, string> = {
    auto_detected: "border-sky-400/35 bg-sky-500/12 text-sky-200",
    va_submitted: "border-pink-400/35 bg-pink-500/12 text-pink-200",
    researcher_submitted: "border-violet-400/35 bg-violet-500/12 text-violet-200",
  };
  return (
    <span className={cn(VA_STATUS_BADGE, styles[source])}>
      {WINNER_SUBMISSION_SOURCE_LABELS[source]}
    </span>
  );
}

function VideoThumb({
  url,
  href,
  superTier,
}: {
  url?: string;
  href: string;
  superTier?: boolean;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className={cn(
        "group relative block aspect-[4/5] w-full overflow-hidden rounded-xl border bg-[#120f12]",
        superTier
          ? "border-amber-400/35 shadow-[0_0_28px_-10px_rgba(251,191,36,0.45)]"
          : "border-white/10",
      )}
      aria-label="View on Instagram"
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]" />
      ) : (
        <div
          className={cn(
            "flex h-full w-full flex-col items-center justify-center gap-2 bg-gradient-to-br",
            superTier
              ? "from-amber-500/20 via-[#1a1410] to-[#0D0B0D]"
              : "from-[#FF1493]/15 via-[#151015] to-[#0D0B0D]",
          )}
        >
          <ExternalLink className="h-6 w-6 text-white/35 transition group-hover:text-[#FF1493]" />
          <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-white/30">
            Instagram
          </span>
        </div>
      )}
      <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-2.5 py-2 opacity-0 transition group-hover:opacity-100">
        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-white">
          <ExternalLink className="h-3 w-3" /> Open
        </span>
      </span>
    </a>
  );
}

/** Fast one-step bunch picker — popover list, not multi-step wizard. */
function BunchAssignPicker({
  bunches,
  busy,
  onAssign,
  label = "Assign to Bunch",
  compact,
}: {
  bunches: VideoBunch[];
  busy?: boolean;
  onAssign: (bunchId: string) => void;
  label?: string;
  compact?: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const rootRef = React.useRef<HTMLDivElement>(null);
  const assignable = React.useMemo(
    () =>
      bunches
        .filter((b) => b.status === "open" && (b.remaining_count ?? 0) > 0)
        .slice()
        .sort((a, b) => {
          const byModel = a.model_name.localeCompare(b.model_name);
          if (byModel !== 0) return byModel;
          return a.name.localeCompare(b.name);
        }),
    [bunches],
  );

  React.useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        disabled={busy || assignable.length === 0}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          VA_BTN_PRIMARY,
          "inline-flex items-center gap-1.5 disabled:cursor-not-allowed disabled:opacity-40",
          compact ? "px-3 py-1.5 text-[11px]" : "px-3.5 py-2 text-xs",
        )}
        title={
          assignable.length === 0
            ? "No open bunches with remaining capacity — create one on Bunches"
            : label
        }
      >
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FolderOpen className="h-3.5 w-3.5" />}
        {label}
        <ChevronDown className={cn("h-3 w-3 transition", open && "rotate-180")} />
      </button>
      <AnimatePresence>
        {open ? (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 z-30 mt-2 w-[min(100vw-2rem,280px)] overflow-hidden rounded-xl border border-white/10 bg-[#141214] shadow-[0_20px_50px_-20px_rgba(0,0,0,0.85)]"
          >
            <p className="border-b border-white/[0.06] px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#B8B4B8]/45">
              Open bunches
            </p>
            {assignable.length === 0 ? (
              <div className="px-3 py-3 text-xs text-[#B8B4B8]/55">
                <p>No open bunches available — create one first.</p>
                <Link
                  href={ROUTES.admin.bunches}
                  className="mt-2 inline-flex text-[#FF1493] hover:underline"
                  onClick={() => setOpen(false)}
                >
                  Create / manage bunches →
                </Link>
              </div>
            ) : (
              <ul className="max-h-56 overflow-y-auto py-1">
                {assignable.map((b) => (
                  <li key={b.id}>
                    <button
                      type="button"
                      className="flex w-full flex-col items-start gap-0.5 px-3 py-2.5 text-left transition hover:bg-white/[0.05]"
                      onClick={() => {
                        setOpen(false);
                        onAssign(b.id);
                      }}
                    >
                      <span className="text-sm font-medium text-white">{b.name}</span>
                      <span className="text-[11px] text-[#B8B4B8]/50">
                        {b.model_name} · {b.remaining_count ?? 0} left / {b.target_video_count}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <Link
              href={ROUTES.admin.bunches}
              className="block border-t border-white/[0.06] px-3 py-2 text-xs text-[#FF1493] hover:underline"
              onClick={() => setOpen(false)}
            >
              Manage bunches →
            </Link>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

export function WinnerVideosHubClient({
  initialWinners,
  initialSuperWinners,
  initialQueue,
  initialBunches,
  initialRecreateConfig,
}: {
  initialWinners: WinnerSubmission[];
  initialSuperWinners: WinnerSubmission[];
  initialQueue: RecreationQueueItem[];
  initialBunches: VideoBunch[];
  initialRecreateConfig: WinnerSourcingRecreateConfig;
  /** @deprecated unused — creatives/filmers managed on Bunches page */
  models?: HubModelOption[];
  creatives?: HubCreativeOption[];
  filmers?: HubFilmerOption[];
  canManageFilming?: boolean;
  initialFilmingProgress?: Record<string, { filmed_count: number; filmable_count: number }>;
}) {
  const { addToast } = useToast();
  const [tab, setTab] = React.useState<TabId>("winners");
  const [winners, setWinners] = React.useState(initialWinners);
  const [supers, setSupers] = React.useState(initialSuperWinners);
  const [queue, setQueue] = React.useState(initialQueue);
  const [bunches, setBunches] = React.useState(initialBunches);
  const [recreateConfig, setRecreateConfig] = React.useState(initialRecreateConfig);
  const [refreshing, setRefreshing] = React.useState(false);
  const [busyId, setBusyId] = React.useState<string | null>(null);

  const [groupByModel, setGroupByModel] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const [modelFilter, setModelFilter] = React.useState("");
  const [sourceFilter, setSourceFilter] = React.useState<WinnerSubmissionSource | "">("");
  const [dateRange, setDateRange] = React.useState<DateRangeId>("all");
  const [assignFilter, setAssignFilter] = React.useState<AssignFilter>("all");
  const [collapsedModels, setCollapsedModels] = React.useState<Record<string, boolean>>({});

  const [deleteTarget, setDeleteTarget] = React.useState<WinnerSubmission | null>(null);
  const [deleteImpact, setDeleteImpact] = React.useState<WinnerSubmissionDeleteImpact | null>(null);
  const [deleteImpactLoading, setDeleteImpactLoading] = React.useState(false);
  const [deleteLoading, setDeleteLoading] = React.useState(false);

  async function openDeleteConfirm(submission: WinnerSubmission) {
    setDeleteTarget(submission);
    setDeleteImpact(null);
    setDeleteImpactLoading(true);
    try {
      const res = await fetch(
        `/api/winner-sourcing/submissions/${encodeURIComponent(submission.id)}?delete_impact=1`,
        { credentials: "include" },
      );
      const data = (await res.json().catch(() => ({}))) as {
        impact?: WinnerSubmissionDeleteImpact;
        error?: string;
      };
      if (!res.ok) {
        addToast(
          winnerVideoLocalToast(
            `ws-del-impact-${Date.now()}`,
            "Could not check delete impact",
            data.error || "Error",
            "high",
          ),
        );
        setDeleteTarget(null);
        return;
      }
      setDeleteImpact(data.impact ?? null);
    } finally {
      setDeleteImpactLoading(false);
    }
  }

  function closeDeleteConfirm() {
    if (deleteLoading) return;
    setDeleteTarget(null);
    setDeleteImpact(null);
    setDeleteImpactLoading(false);
  }

  async function confirmDeleteSubmission() {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    const deletedId = deleteTarget.id;
    const deletedTier = deleteTarget.tier;
    try {
      const res = await fetch(
        `/api/winner-sourcing/submissions/${encodeURIComponent(deletedId)}`,
        { method: "DELETE", credentials: "include" },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        addToast(
          winnerVideoLocalToast(
            `ws-del-err-${Date.now()}`,
            "Delete failed",
            data.error || "Error",
            "high",
          ),
        );
        return;
      }
      setWinners((prev) => prev.filter((s) => s.id !== deletedId));
      setSupers((prev) => prev.filter((s) => s.id !== deletedId));
      setQueue((prev) => prev.filter((q) => q.winner_submission_id !== deletedId));
      setDeleteTarget(null);
      setDeleteImpact(null);
      addToast(
        winnerVideoLocalToast(
          `ws-del-ok-${Date.now()}`,
          deletedTier === "super_winner" ? "Super Winner deleted" : "Winner deleted",
          "Entry and linked recreate progress were removed",
          "normal",
        ),
      );
    } finally {
      setDeleteLoading(false);
    }
  }

  async function refreshAll() {
    setRefreshing(true);
    try {
      const [wRes, sRes, qRes, bRes, cfgRes] = await Promise.all([
        fetch("/api/winner-sourcing/submissions?tier=winner", { credentials: "include" }),
        fetch("/api/winner-sourcing/submissions?tier=super_winner", { credentials: "include" }),
        fetch("/api/winner-sourcing/queue", { credentials: "include" }),
        fetch("/api/winner-sourcing/bunches", { credentials: "include" }),
        fetch("/api/winner-sourcing/settings", { credentials: "include" }),
      ]);
      if (wRes.ok) {
        const d = await wRes.json();
        setWinners(d.submissions ?? []);
      }
      if (sRes.ok) {
        const d = await sRes.json();
        setSupers(d.submissions ?? []);
      }
      if (qRes.ok) {
        const d = await qRes.json();
        setQueue(d.items ?? []);
      }
      if (bRes.ok) {
        const d = await bRes.json();
        setBunches(d.bunches ?? []);
      }
      if (cfgRes.ok) {
        const d = await cfgRes.json();
        if (d.settings) setRecreateConfig(d.settings);
      }
    } finally {
      setRefreshing(false);
    }
  }

  async function saveRecreateConfig(next: WinnerSourcingRecreateConfig) {
    setBusyId("save-settings");
    try {
      const res = await fetch("/api/winner-sourcing/settings", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        addToast(
          winnerVideoLocalToast(
            `ws-err-${Date.now()}`,
            "Save failed",
            data.error || "Error",
            "high",
          ),
        );
        return;
      }
      setRecreateConfig(data.settings ?? next);
      addToast(
        winnerVideoLocalToast(
          `ws-cfg-${Date.now()}`,
          "Settings saved",
          `Winner ${data.settings?.winner_recreate_count ?? next.winner_recreate_count}× · Super ${data.settings?.super_winner_recreate_count ?? next.super_winner_recreate_count}×`,
          "normal",
        ),
      );
    } finally {
      setBusyId(null);
    }
  }

  async function addToQueue(submissionId: string) {
    setBusyId(submissionId);
    try {
      const res = await fetch("/api/winner-sourcing/queue", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ winner_submission_id: submissionId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        addToast(
          winnerVideoLocalToast(`ws-err-${Date.now()}`, "Queue failed", data.error || "Error", "high"),
        );
        return null;
      }
      addToast(
        winnerVideoLocalToast(
          `ws-q-${Date.now()}`,
          "Added to recreation queue",
          `${data.item?.required_recreate_count ?? ""} recreates required`,
          "normal",
        ),
      );
      await refreshAll();
      return data.item as RecreationQueueItem | undefined;
    } finally {
      setBusyId(null);
    }
  }

  async function assignQueueItem(queueItemId: string, bunchId: string) {
    setBusyId(queueItemId);
    try {
      const res = await fetch(`/api/winner-sourcing/queue/${queueItemId}/assign`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bunch_id: bunchId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        addToast(
          winnerVideoLocalToast(`ws-err-${Date.now()}`, "Assign failed", data.error || "Error", "high"),
        );
        return;
      }
      addToast(
        winnerVideoLocalToast(
          `ws-as-${Date.now()}`,
          "Assigned to bunch",
          `Spawned ${data.slots?.length ?? 0} recreate slots`,
          "normal",
        ),
      );
      await refreshAll();
    } finally {
      setBusyId(null);
    }
  }

  /** Queue (if needed) then assign — one picker action. */
  async function assignSubmissionToBunch(submission: WinnerSubmission, bunchId: string) {
    const existing = queue.find((q) => q.winner_submission_id === submission.id);
    if (existing?.bunch_id) {
      addToast(
        winnerVideoLocalToast(
          `ws-info-${Date.now()}`,
          "Already assigned",
          existing.bunch_name || "This find is already on a bunch",
          "normal",
        ),
      );
      return;
    }
    let queueId = existing?.id;
    if (!queueId) {
      setBusyId(submission.id);
      try {
        const res = await fetch("/api/winner-sourcing/queue", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ winner_submission_id: submission.id }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          addToast(
            winnerVideoLocalToast(
              `ws-err-${Date.now()}`,
              "Queue failed",
              data.error || "Error",
              "high",
            ),
          );
          return;
        }
        queueId = data.item?.id as string | undefined;
      } finally {
        setBusyId(null);
      }
    }
    if (!queueId) return;
    await assignQueueItem(queueId, bunchId);
  }

  const refreshAllRef = React.useRef(refreshAll);
  refreshAllRef.current = refreshAll;
  useSupabaseRealtimeRefresh(
    ["video_bunches", "recreate_video_slots", "winner_submissions", "recreation_queue_items"],
    () => {
      void refreshAllRef.current();
    },
    { debounceMs: 800 },
  );

  const allSubmissions = React.useMemo(() => [...winners, ...supers], [winners, supers]);
  const openBunches = React.useMemo(() => bunches.filter((b) => b.status === "open"), [bunches]);
  const queueBySubmission = React.useMemo(() => {
    const m = new Map<string, RecreationQueueItem>();
    for (const q of queue) m.set(q.winner_submission_id, q);
    return m;
  }, [queue]);

  const modelOptions = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const s of allSubmissions) {
      if (s.model_id) map.set(s.model_id, s.model_name || s.model_id);
    }
    for (const q of queue) {
      const sub = q.submission;
      if (sub?.model_id) map.set(sub.model_id, sub.model_name || sub.model_id);
    }
    return [...map.entries()]
      .map(([model_id, model_name]) => ({ model_id, model_name }))
      .sort((a, b) => a.model_name.localeCompare(b.model_name));
  }, [allSubmissions, queue]);

  const searchLc = search.trim().toLowerCase();

  function matchesSubmissionFilters(s: WinnerSubmission, tierScope: "winner" | "super" | "all") {
    if (tierScope === "winner" && s.tier !== "winner") return false;
    if (tierScope === "super" && s.tier !== "super_winner") return false;
    if (modelFilter && s.model_id !== modelFilter) return false;
    if (sourceFilter && s.source !== sourceFilter) return false;
    if (!inDateRange(s.posted_at || s.created_at, dateRange)) return false;
    if (assignFilter !== "all") {
      const q = queueBySubmission.get(s.id);
      const assigned = Boolean(q?.bunch_id);
      if (assignFilter === "assigned" && !assigned) return false;
      if (assignFilter === "unassigned" && assigned) return false;
    }
    if (searchLc) {
      const hay = `${s.model_name} ${s.caption} ${s.submitted_by_name} ${s.video_link}`.toLowerCase();
      if (!hay.includes(searchLc)) return false;
    }
    return true;
  }

  const filteredWinners = React.useMemo(
    () => winners.filter((s) => matchesSubmissionFilters(s, "winner")),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [winners, modelFilter, sourceFilter, dateRange, assignFilter, searchLc, queueBySubmission],
  );
  const filteredSupers = React.useMemo(
    () => supers.filter((s) => matchesSubmissionFilters(s, "super")),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [supers, modelFilter, sourceFilter, dateRange, assignFilter, searchLc, queueBySubmission],
  );

  const filteredQueue = React.useMemo(() => {
    return queue.filter((item) => {
      const sub = item.submission;
      if (modelFilter && sub?.model_id !== modelFilter) return false;
      if (sourceFilter && sub && sub.source !== sourceFilter) return false;
      if (!inDateRange(item.created_at, dateRange)) return false;
      if (assignFilter === "assigned" && !item.bunch_id) return false;
      if (assignFilter === "unassigned" && item.bunch_id) return false;
      if (searchLc) {
        const hay = `${sub?.model_name ?? ""} ${sub?.caption ?? ""} ${sub?.video_link ?? ""} ${item.bunch_name ?? ""}`.toLowerCase();
        if (!hay.includes(searchLc)) return false;
      }
      return true;
    });
  }, [queue, modelFilter, sourceFilter, dateRange, assignFilter, searchLc]);

  const periodItems = React.useMemo(() => {
    return allSubmissions.filter((s) => inDateRange(s.posted_at || s.created_at, dateRange === "all" ? "30d" : dateRange));
  }, [allSubmissions, dateRange]);

  const stats = React.useMemo(() => {
    const pool = dateRange === "all" ? allSubmissions : periodItems;
    const bySource: Record<WinnerSubmissionSource, number> = {
      auto_detected: 0,
      va_submitted: 0,
      researcher_submitted: 0,
    };
    const models = new Set<string>();
    let winnerN = 0;
    let superN = 0;
    for (const s of pool) {
      models.add(s.model_id || s.model_name);
      if (s.tier === "super_winner") superN += 1;
      else winnerN += 1;
      bySource[s.source] += 1;
    }
    return {
      total: pool.length,
      winnerN,
      superN,
      models: models.size,
      bySource,
      unassignedQueue: queue.filter((q) => !q.bunch_id).length,
    };
  }, [allSubmissions, periodItems, dateRange, queue]);

  const activeChips: { key: string; label: string; clear: () => void }[] = [];
  if (modelFilter) {
    const name = modelOptions.find((m) => m.model_id === modelFilter)?.model_name ?? modelFilter;
    activeChips.push({ key: "model", label: `Model: ${name}`, clear: () => setModelFilter("") });
  }
  if (sourceFilter) {
    activeChips.push({
      key: "source",
      label: WINNER_SUBMISSION_SOURCE_LABELS[sourceFilter],
      clear: () => setSourceFilter(""),
    });
  }
  if (dateRange !== "all") {
    activeChips.push({
      key: "date",
      label: DATE_RANGE_OPTIONS.find((d) => d.id === dateRange)?.label ?? dateRange,
      clear: () => setDateRange("all"),
    });
  }
  if (assignFilter !== "all") {
    activeChips.push({
      key: "assign",
      label: assignFilter === "assigned" ? "Assigned" : "Unassigned",
      clear: () => setAssignFilter("all"),
    });
  }
  if (searchLc) {
    activeChips.push({ key: "search", label: `“${search.trim()}”`, clear: () => setSearch("") });
  }

  function jumpToModel(modelId: string) {
    setModelFilter(modelId);
    setGroupByModel(true);
    setCollapsedModels((prev) => ({ ...prev, [modelId]: false }));
    if (tab === "settings") setTab("winners");
    requestAnimationFrame(() => {
      document.getElementById(`model-section-${modelId}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  const showSubmissionFilters = tab === "winners" || tab === "super" || tab === "queue";

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-3xl border border-[#D4AF8C]/15 bg-gradient-to-br from-[#151315] via-[#0D0B0D] to-[#120810] px-5 py-7 md:px-8 md:py-8">
        <div
          className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full opacity-40 blur-3xl"
          style={{ background: "radial-gradient(circle, rgba(255,20,147,0.35), transparent 70%)" }}
        />
        <div
          className="pointer-events-none absolute -bottom-16 left-1/3 h-48 w-48 rounded-full opacity-30 blur-3xl"
          style={{ background: "radial-gradient(circle, rgba(212,175,140,0.25), transparent 70%)" }}
        />
        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#D4AF8C]/70">
              Content · Sourcing
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white md:text-4xl">
              Winner Videos
            </h1>
            <p className="mt-2 max-w-xl text-sm text-[#B8B4B8]/70">
              Source Winners & Super Winners into the recreation queue, then assign them to bunches
              for Creative Scripts and filming.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-[#B8B4B8]/55">
              <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1">
                <Info className="h-3 w-3 text-[#D4AF8C]/70" />
                Tier thresholds
                <StatInfoTooltip text={THRESHOLD_TOOLTIP} />
              </span>
              <button
                type="button"
                onClick={() => setTab("settings")}
                className="text-[#D4AF8C] underline-offset-2 hover:underline"
              >
                Configure thresholds & recreate counts →
              </button>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href={ROUTES.admin.bunches}
              className={cn(VA_BTN_PRIMARY, "inline-flex items-center gap-2 px-4 py-2.5 text-sm")}
            >
              <FolderOpen className="h-4 w-4" />
              Open Bunches
            </Link>
            <button
              type="button"
              onClick={() => void refreshAll()}
              disabled={refreshing}
              className={cn(VA_BTN_SECONDARY, "inline-flex items-center gap-2 px-4 py-2.5 text-sm")}
            >
              <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
              Refresh
            </button>
          </div>
        </div>

        <div className="relative mt-6 grid grid-cols-2 gap-3 lg:grid-cols-5">
          <LuxuryStatCard
            label={dateRange === "all" ? "Total finds" : "In period"}
            value={<CountUp value={stats.total} />}
            accent="champagne"
            tooltip="Winner + Super Winner submissions in the selected date scope (All time uses full list; otherwise the active date filter, defaulting to 30d for the hero when All time)."
          />
          <LuxuryStatCard
            label="Winners"
            value={<CountUp value={stats.winnerN} />}
            accent="emerald"
            tooltip={`≥ ${WINNER_VIEW_THRESHOLD.toLocaleString()} views (below Super).`}
          />
          <LuxuryStatCard
            label="Super Winners"
            value={<CountUp value={stats.superN} />}
            accent="amber"
            glow
            tooltip={`≥ ${SUPER_WINNER_VIEW_THRESHOLD.toLocaleString()} views.`}
          />
          <LuxuryStatCard
            label="Models covered"
            value={<CountUp value={stats.models} />}
            accent="pink"
            tooltip="Distinct models with at least one find in scope."
          />
          <LuxuryStatCard
            label="Unassigned queue"
            value={<CountUp value={stats.unassignedQueue} />}
            accent="white"
            hint={
              <span className="flex flex-wrap gap-x-2 gap-y-0.5">
                <span>Auto {stats.bySource.auto_detected}</span>
                <span>· VA {stats.bySource.va_submitted}</span>
                <span>· Res {stats.bySource.researcher_submitted}</span>
              </span>
            }
            tooltip="Recreation queue items not yet on a bunch. Hint shows source mix for finds in the stats scope."
          />
        </div>
      </div>

      {/* Tabs + Group by Model */}
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-1 rounded-2xl border border-white/[0.06] bg-[#0D0B0D]/80 p-1.5">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                "relative rounded-xl px-3.5 py-2.5 text-sm font-medium transition sm:px-4",
                tab === t.id ? "text-white" : "text-[#B8B4B8]/55 hover:text-[#B8B4B8]",
              )}
            >
              {tab === t.id ? (
                <motion.span
                  layoutId="ws-hub-tab"
                  className="absolute inset-0 rounded-xl border border-[#FF1493]/25 bg-gradient-to-br from-[#FF1493]/25 to-[#D4AF8C]/10"
                  transition={{ type: "spring", damping: 28, stiffness: 380 }}
                />
              ) : null}
              <span className="relative">{t.label}</span>
            </button>
          ))}
        </div>

        {showSubmissionFilters ? (
          <button
            type="button"
            onClick={() => setGroupByModel((v) => !v)}
            aria-pressed={groupByModel}
            className={cn(
              "inline-flex items-center gap-2 rounded-xl border px-3.5 py-2.5 text-sm font-medium transition",
              groupByModel
                ? "border-[#D4AF8C]/40 bg-[#D4AF8C]/12 text-[#D4AF8C]"
                : "border-white/10 bg-white/[0.03] text-[#B8B4B8]/70 hover:border-white/20 hover:text-[#B8B4B8]",
            )}
          >
            <Layers className="h-4 w-4" />
            Group by Model
          </button>
        ) : null}
      </div>

      {/* Filters */}
      {showSubmissionFilters ? (
        <div className="space-y-3">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#B8B4B8]/40" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search captions, models, links…"
                className={cn(VA_FILTER_INPUT, "w-full pl-9")}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <select
                className={cn(VA_FILTER_INPUT, "min-w-[140px]")}
                value={modelFilter}
                onChange={(e) => {
                  const id = e.target.value;
                  setModelFilter(id);
                  if (id && groupByModel) jumpToModel(id);
                }}
              >
                <option value="">All models</option>
                {modelOptions.map((m) => (
                  <option key={m.model_id} value={m.model_id}>
                    {m.model_name}
                  </option>
                ))}
              </select>
              <select
                className={cn(VA_FILTER_INPUT, "min-w-[140px]")}
                value={sourceFilter}
                onChange={(e) => setSourceFilter(e.target.value as WinnerSubmissionSource | "")}
              >
                {SOURCE_FILTER_OPTIONS.map((o) => (
                  <option key={o.id || "all"} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
              <select
                className={cn(VA_FILTER_INPUT, "min-w-[120px]")}
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value as DateRangeId)}
              >
                {DATE_RANGE_OPTIONS.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
              <select
                className={cn(VA_FILTER_INPUT, "min-w-[130px]")}
                value={assignFilter}
                onChange={(e) => setAssignFilter(e.target.value as AssignFilter)}
              >
                <option value="all">All assignment</option>
                <option value="unassigned">Unassigned</option>
                <option value="assigned">Assigned</option>
              </select>
            </div>
          </div>
          {activeChips.length > 0 ? (
            <FilterBar>
              {activeChips.map((c) => (
                <FilterChip key={c.key} label={c.label} onRemove={c.clear} />
              ))}
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] text-[#B8B4B8]/50 hover:text-[#B8B4B8]"
                onClick={() => {
                  setModelFilter("");
                  setSourceFilter("");
                  setDateRange("all");
                  setAssignFilter("all");
                  setSearch("");
                }}
              >
                <X className="h-3 w-3" /> Clear all
              </button>
            </FilterBar>
          ) : null}
        </div>
      ) : null}

      <AnimatePresence mode="wait">
        <motion.div
          key={`${tab}-${groupByModel}`}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.2 }}
        >
          {tab === "winners" ? (
            <SubmissionGallery
              items={filteredWinners}
              empty="No Winner submissions match these filters."
              emptyHint={`Winners need ≥ ${WINNER_VIEW_THRESHOLD.toLocaleString()} views (below Super).`}
              busyId={busyId}
              recreateCount={recreateConfig.winner_recreate_count}
              openBunches={openBunches}
              queueBySubmission={queueBySubmission}
              groupByModel={groupByModel}
              collapsedModels={collapsedModels}
              onToggleModel={(id) =>
                setCollapsedModels((p) => ({ ...p, [id]: !p[id] }))
              }
              onAddToQueue={(id) => void addToQueue(id)}
              onAssignSubmission={(s, bunchId) => void assignSubmissionToBunch(s, bunchId)}
              onDelete={(s) => void openDeleteConfirm(s)}
            />
          ) : null}
          {tab === "super" ? (
            <SubmissionGallery
              items={filteredSupers}
              empty="No Super Winner submissions match these filters."
              emptyHint={`Super Winners need ≥ ${SUPER_WINNER_VIEW_THRESHOLD.toLocaleString()} views.`}
              busyId={busyId}
              recreateCount={recreateConfig.super_winner_recreate_count}
              openBunches={openBunches}
              queueBySubmission={queueBySubmission}
              groupByModel={groupByModel}
              collapsedModels={collapsedModels}
              onToggleModel={(id) =>
                setCollapsedModels((p) => ({ ...p, [id]: !p[id] }))
              }
              onAddToQueue={(id) => void addToQueue(id)}
              onAssignSubmission={(s, bunchId) => void assignSubmissionToBunch(s, bunchId)}
              onDelete={(s) => void openDeleteConfirm(s)}
              superTier
            />
          ) : null}
          {tab === "queue" ? (
            <QueuePanel
              items={filteredQueue}
              bunches={openBunches}
              busyId={busyId}
              groupByModel={groupByModel}
              collapsedModels={collapsedModels}
              onToggleModel={(id) =>
                setCollapsedModels((p) => ({ ...p, [id]: !p[id] }))
              }
              onAssign={(qid, bid) => void assignQueueItem(qid, bid)}
            />
          ) : null}
          {tab === "settings" ? (
            <SettingsPanel
              config={recreateConfig}
              busyId={busyId}
              onSave={(next) => void saveRecreateConfig(next)}
            />
          ) : null}
        </motion.div>
      </AnimatePresence>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={closeDeleteConfirm}
        onConfirm={() => void confirmDeleteSubmission()}
        title={
          deleteTarget
            ? `Delete ${deleteTarget.tier === "super_winner" ? "Super Winner" : "Winner"}?`
            : "Delete entry?"
        }
        description={formatSubmissionDeleteDescription(deleteImpact, deleteImpactLoading)}
        confirmLabel="Delete"
        confirmVariant="danger"
        loading={deleteLoading || deleteImpactLoading}
        requireNameConfirmation={Boolean(deleteImpact && !deleteImpact.is_simple_delete)}
        nameToConfirm={deleteImpact?.model_name || deleteTarget?.model_name || ""}
      />
    </div>
  );
}

function groupSubmissionsByModel(items: WinnerSubmission[]) {
  const map = new Map<string, { model_id: string; model_name: string; items: WinnerSubmission[] }>();
  for (const s of items) {
    const key = s.model_id || s.model_name || "unknown";
    const existing = map.get(key);
    if (existing) existing.items.push(s);
    else map.set(key, { model_id: s.model_id || key, model_name: s.model_name || "Unknown model", items: [s] });
  }
  return [...map.values()].sort((a, b) => a.model_name.localeCompare(b.model_name));
}

function SubmissionGallery({
  items,
  empty,
  emptyHint,
  busyId,
  recreateCount,
  openBunches,
  queueBySubmission,
  groupByModel,
  collapsedModels,
  onToggleModel,
  onAddToQueue,
  onAssignSubmission,
  onDelete,
  superTier,
}: {
  items: WinnerSubmission[];
  empty: string;
  emptyHint?: string;
  busyId: string | null;
  recreateCount: number;
  openBunches: VideoBunch[];
  queueBySubmission: Map<string, RecreationQueueItem>;
  groupByModel: boolean;
  collapsedModels: Record<string, boolean>;
  onToggleModel: (modelId: string) => void;
  onAddToQueue: (id: string) => void;
  onAssignSubmission: (s: WinnerSubmission, bunchId: string) => void;
  onDelete: (s: WinnerSubmission) => void;
  superTier?: boolean;
}) {
  if (!items.length) {
    return (
      <div className={cn(VA_CARD, "px-6 py-16 text-center")}>
        <Trophy className="mx-auto h-8 w-8 text-[#B8B4B8]/25" />
        <p className="mt-3 text-sm text-[#B8B4B8]/55">{empty}</p>
        {emptyHint ? <p className="mt-1 text-xs text-[#B8B4B8]/35">{emptyHint}</p> : null}
      </div>
    );
  }

  if (!groupByModel) {
    return (
      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {items.map((s) => (
          <li key={s.id}>
            <WinnerCard
              submission={s}
              busyId={busyId}
              recreateCount={recreateCount}
              openBunches={openBunches}
              queueItem={queueBySubmission.get(s.id)}
              onAddToQueue={onAddToQueue}
              onAssign={(bunchId) => onAssignSubmission(s, bunchId)}
              onDelete={() => onDelete(s)}
              superTier={superTier}
            />
          </li>
        ))}
      </ul>
    );
  }

  const groups = groupSubmissionsByModel(items);
  return (
    <div className="space-y-4">
      {groups.map((g) => {
        const collapsed = collapsedModels[g.model_id] === true;
        const wCount = g.items.filter((i) => i.tier === "winner").length;
        const sCount = g.items.filter((i) => i.tier === "super_winner").length;
        return (
          <section
            key={g.model_id}
            id={`model-section-${g.model_id}`}
            className={cn(
              "overflow-hidden rounded-2xl border",
              superTier
                ? "border-amber-400/20 bg-gradient-to-b from-amber-500/[0.06] to-transparent"
                : "border-white/[0.06] bg-[#0D0B0D]/60",
            )}
          >
            <button
              type="button"
              onClick={() => onToggleModel(g.model_id)}
              className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition hover:bg-white/[0.03] md:px-5"
            >
              <ModelAvatar name={g.model_name} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-base font-semibold text-white">{g.model_name}</p>
                <p className="mt-0.5 text-xs text-[#B8B4B8]/55">
                  {wCount > 0 ? `${wCount} Winner${wCount === 1 ? "" : "s"}` : null}
                  {wCount > 0 && sCount > 0 ? ", " : null}
                  {sCount > 0 ? `${sCount} Super Winner${sCount === 1 ? "" : "s"}` : null}
                  {wCount === 0 && sCount === 0 ? `${g.items.length} finds` : null}
                </p>
              </div>
              <ChevronDown
                className={cn(
                  "h-5 w-5 shrink-0 text-[#B8B4B8]/45 transition",
                  collapsed ? "-rotate-90" : "rotate-0",
                )}
              />
            </button>
            <AnimatePresence initial={false}>
              {!collapsed ? (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.22 }}
                  className="overflow-hidden"
                >
                  <ul className="grid gap-4 border-t border-white/[0.05] p-4 sm:grid-cols-2 xl:grid-cols-3 md:p-5">
                    {g.items.map((s) => (
                      <li key={s.id}>
                        <WinnerCard
                          submission={s}
                          busyId={busyId}
                          recreateCount={recreateCount}
                          openBunches={openBunches}
                          queueItem={queueBySubmission.get(s.id)}
                          onAddToQueue={onAddToQueue}
                          onAssign={(bunchId) => onAssignSubmission(s, bunchId)}
                          onDelete={() => onDelete(s)}
                          superTier={superTier || s.tier === "super_winner"}
                        />
                      </li>
                    ))}
                  </ul>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </section>
        );
      })}
    </div>
  );
}

function WinnerCard({
  submission: s,
  busyId,
  recreateCount,
  openBunches,
  queueItem,
  onAddToQueue,
  onAssign,
  onDelete,
  superTier,
}: {
  submission: WinnerSubmission;
  busyId: string | null;
  recreateCount: number;
  openBunches: VideoBunch[];
  queueItem?: RecreationQueueItem;
  onAddToQueue: (id: string) => void;
  onAssign: (bunchId: string) => void;
  onDelete: () => void;
  superTier?: boolean;
}) {
  const [expanded, setExpanded] = React.useState(false);
  const busy = busyId === s.id || busyId === queueItem?.id;
  const assigned = Boolean(queueItem?.bunch_id);
  const pending = s.status === "pending";
  const modelBunches =
    openBunches.length > 0
      ? openBunches
      : [];

  return (
    <article
      className={cn(
        VA_CARD,
        "flex h-full flex-col overflow-hidden p-0 transition duration-200",
        superTier
          ? "border-amber-400/30 shadow-[0_0_40px_-18px_rgba(251,191,36,0.5)] ring-1 ring-amber-400/15"
          : VA_CARD_GLOW,
      )}
    >
      <div className="p-3 pb-0">
        <VideoThumb url={s.thumbnail_url || undefined} href={s.video_link} superTier={superTier} />
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4 pt-3">
        <div className="flex items-start gap-2.5">
          <ModelAvatar name={s.model_name} size="sm" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-white">{s.model_name}</p>
            <p className="mt-0.5 text-[11px] text-[#B8B4B8]/45">
              {formatShortDate(s.posted_at || s.created_at)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-lg font-semibold tabular-nums text-white">
              <CountUp value={s.view_count} format={formatViews} duration={700} />
            </p>
            <p className="text-[10px] uppercase tracking-[0.12em] text-[#B8B4B8]/40">views</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <TierBadge tier={s.tier} prominent={superTier} />
          <SourceBadge source={s.source} />
          {assigned ? (
            <span className={cn(VA_STATUS_BADGE, "border-emerald-500/35 bg-emerald-500/12 text-emerald-200")}>
              Assigned
            </span>
          ) : pending ? (
            <span className={cn(VA_STATUS_BADGE, "border-sky-500/35 bg-sky-500/12 text-sky-200")}>
              Pending
            </span>
          ) : (
            <span className={cn(VA_STATUS_BADGE, "border-[#D4AF8C]/35 bg-[#D4AF8C]/10 text-[#D4AF8C]")}>
              Queued
            </span>
          )}
        </div>

        <div>
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="text-[11px] font-medium text-[#B8B4B8]/50 hover:text-[#B8B4B8]"
          >
            {expanded ? "Hide details" : s.caption ? "Show caption & details" : "Details"}
          </button>
          <AnimatePresence initial={false}>
            {expanded ? (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <p className="mt-2 line-clamp-4 text-xs leading-relaxed text-[#B8B4B8]/65">
                  {s.caption || "No caption on file."}
                </p>
                <p className="mt-1.5 text-[11px] text-[#B8B4B8]/40">
                  By {s.submitted_by_name || "—"}
                </p>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>

        <div className="mt-auto flex flex-wrap items-center gap-2 border-t border-white/[0.05] pt-3">
          <a
            href={s.video_link}
            target="_blank"
            rel="noreferrer"
            className={cn(VA_BTN_SECONDARY, "inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px]")}
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Instagram
          </a>
          {!assigned ? (
            <BunchAssignPicker
              bunches={modelBunches}
              busy={busy}
              compact
              label="Assign to Bunch"
              onAssign={onAssign}
            />
          ) : queueItem?.bunch_id ? (
            <Link
              href={`${ROUTES.admin.bunches}?id=${encodeURIComponent(queueItem.bunch_id)}`}
              className="text-[11px] text-emerald-300/90 underline-offset-2 hover:underline"
            >
              {queueItem.bunch_name || "View bunch"} →
            </Link>
          ) : null}
          {pending && !assigned ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => onAddToQueue(s.id)}
              className="text-[11px] text-[#B8B4B8]/45 underline-offset-2 hover:text-[#B8B4B8] hover:underline disabled:opacity-40"
              title={`Queue only (${recreateCount}× recreates)`}
            >
              Queue only ({recreateCount}×)
            </button>
          ) : null}
          <button
            type="button"
            disabled={busy}
            onClick={onDelete}
            className="ml-auto inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-[11px] text-red-300/70 transition hover:bg-red-500/10 hover:text-red-200 disabled:opacity-40"
            aria-label={`Delete ${s.tier === "super_winner" ? "Super Winner" : "Winner"} for ${s.model_name}`}
            title="Delete entry"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete
          </button>
        </div>
      </div>
    </article>
  );
}

function SettingsPanel({
  config,
  busyId,
  onSave,
}: {
  config: WinnerSourcingRecreateConfig;
  busyId: string | null;
  onSave: (next: WinnerSourcingRecreateConfig) => void;
}) {
  const { addToast } = useToast();
  const [winnerCount, setWinnerCount] = React.useState(String(config.winner_recreate_count));
  const [superCount, setSuperCount] = React.useState(String(config.super_winner_recreate_count));
  const [thresholdRows, setThresholdRows] = React.useState<
    Array<{
      model_id: string;
      model_name: string;
      winner_threshold_views: number;
      super_winner_threshold_views: number;
    }>
  >([]);
  const [thresholdsLoading, setThresholdsLoading] = React.useState(true);
  const [savingModelId, setSavingModelId] = React.useState<string | null>(null);

  React.useEffect(() => {
    setWinnerCount(String(config.winner_recreate_count));
    setSuperCount(String(config.super_winner_recreate_count));
  }, [config.winner_recreate_count, config.super_winner_recreate_count]);

  React.useEffect(() => {
    let cancelled = false;
    setThresholdsLoading(true);
    fetch("/api/winner-sourcing/thresholds", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("Failed to load thresholds"))))
      .then((d: {
        models?: Array<{ model_id: string; model_name: string }>;
        thresholds?: Array<{
          model_id: string;
          winner_threshold_views: number;
          super_winner_threshold_views: number;
        }>;
      }) => {
        if (cancelled) return;
        const byId = new Map(
          (d.thresholds ?? []).map((t) => [t.model_id, t] as const),
        );
        setThresholdRows(
          (d.models ?? []).map((m) => {
            const t = byId.get(m.model_id);
            return {
              model_id: m.model_id,
              model_name: m.model_name,
              winner_threshold_views:
                t?.winner_threshold_views ?? WINNER_VIEW_THRESHOLD,
              super_winner_threshold_views:
                t?.super_winner_threshold_views ?? SUPER_WINNER_VIEW_THRESHOLD,
            };
          }),
        );
      })
      .catch(() => {
        if (!cancelled) setThresholdRows([]);
      })
      .finally(() => {
        if (!cancelled) setThresholdsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSave({
      winner_recreate_count: Number(winnerCount),
      super_winner_recreate_count: Number(superCount),
    });
  }

  async function saveModelThresholds(row: {
    model_id: string;
    winner_threshold_views: number;
    super_winner_threshold_views: number;
  }) {
    setSavingModelId(row.model_id);
    try {
      const res = await fetch("/api/winner-sourcing/thresholds", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(row),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        addToast(
          winnerVideoLocalToast(
            `ws-thr-err-${Date.now()}`,
            "Threshold save failed",
            data.error || "Error",
            "high",
          ),
        );
        return;
      }
      const saved = data.thresholds;
      if (saved) {
        setThresholdRows((rows) =>
          rows.map((r) =>
            r.model_id === row.model_id
              ? {
                  ...r,
                  winner_threshold_views: saved.winner_threshold_views,
                  super_winner_threshold_views: saved.super_winner_threshold_views,
                }
              : r,
          ),
        );
      }
      addToast(
        winnerVideoLocalToast(
          `ws-thr-${Date.now()}`,
          "Thresholds saved",
          "Already-classified videos keep their original tier — changes are not retroactive.",
          "normal",
        ),
      );
    } finally {
      setSavingModelId(null);
    }
  }

  const saving = busyId === "save-settings";

  return (
    <div className="space-y-4">
      <div id="winner-thresholds" className={cn(VA_CARD, "p-5 md:p-6")}>
        <div className="mb-4 flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-amber-400/25 bg-amber-500/10">
            <Trophy className="h-5 w-5 text-amber-200" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">View thresholds</h2>
            <p className="mt-1 max-w-2xl text-sm text-[#B8B4B8]/65">
              Agency defaults: Winner ≥ {WINNER_VIEW_THRESHOLD.toLocaleString()} · Super Winner ≥{" "}
              {SUPER_WINNER_VIEW_THRESHOLD.toLocaleString()}. Per-model overrides apply to ClarioSuite
              auto-detection and VA submits. Changing a threshold never reclassifies videos already in
              the hub.
            </p>
          </div>
        </div>
        <div className="mb-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-[#D4AF8C]/20 bg-[#D4AF8C]/5 px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#D4AF8C]/70">
              Default Winner
            </p>
            <p className="mt-1 text-xl font-semibold tabular-nums text-[#F0D9B8]">
              ≥ {WINNER_VIEW_THRESHOLD.toLocaleString()}
            </p>
          </div>
          <div className="rounded-xl border border-amber-400/25 bg-amber-500/10 px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-200/70">
              Default Super Winner
            </p>
            <p className="mt-1 text-xl font-semibold tabular-nums text-amber-100">
              ≥ {SUPER_WINNER_VIEW_THRESHOLD.toLocaleString()}
            </p>
          </div>
        </div>

        {thresholdsLoading ? (
          <p className="flex items-center gap-2 text-sm text-[#B8B4B8]/50">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading per-model thresholds…
          </p>
        ) : thresholdRows.length === 0 ? (
          <p className="text-sm text-[#B8B4B8]/50">No active models found.</p>
        ) : (
          <ul className="space-y-3">
            {thresholdRows.map((row) => (
              <li
                key={row.model_id}
                className="rounded-xl border border-white/[0.06] bg-black/20 p-4"
              >
                <div className="mb-3 flex items-center gap-2">
                  <ModelAvatar name={row.model_name} size="sm" />
                  <span className="text-sm font-medium text-white">{row.model_name}</span>
                </div>
                <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
                  <label className="block space-y-1.5">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#B8B4B8]/50">
                      Winner views
                    </span>
                    <input
                      type="number"
                      min={0}
                      step={1000}
                      value={row.winner_threshold_views}
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        setThresholdRows((rows) =>
                          rows.map((r) =>
                            r.model_id === row.model_id
                              ? { ...r, winner_threshold_views: v }
                              : r,
                          ),
                        );
                      }}
                      className={cn(VA_FILTER_INPUT, "w-full")}
                    />
                  </label>
                  <label className="block space-y-1.5">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#B8B4B8]/50">
                      Super Winner views
                    </span>
                    <input
                      type="number"
                      min={0}
                      step={1000}
                      value={row.super_winner_threshold_views}
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        setThresholdRows((rows) =>
                          rows.map((r) =>
                            r.model_id === row.model_id
                              ? { ...r, super_winner_threshold_views: v }
                              : r,
                          ),
                        );
                      }}
                      className={cn(VA_FILTER_INPUT, "w-full")}
                    />
                  </label>
                  <div className="flex items-end">
                    <button
                      type="button"
                      disabled={savingModelId === row.model_id}
                      onClick={() => void saveModelThresholds(row)}
                      className={cn(VA_BTN_SECONDARY, "inline-flex items-center gap-2 px-4 py-2 text-xs")}
                    >
                      {savingModelId === row.model_id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : null}
                      Save
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className={cn(VA_CARD, "p-5 md:p-6")}>
        <div className="mb-5 flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#D4AF8C]/25 bg-[#D4AF8C]/10">
            <Settings2 className="h-5 w-5 text-[#D4AF8C]" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">Recreate counts</h2>
            <p className="mt-1 max-w-2xl text-sm text-[#B8B4B8]/65">
              How many recreate videos are required when a Winner or Super Winner is added to a bunch.
              Changes only affect newly queued items.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block space-y-2">
              <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[#B8B4B8]/55">
                Winner recreate count
              </span>
              <input
                type="number"
                min={1}
                max={500}
                step={1}
                required
                value={winnerCount}
                onChange={(e) => setWinnerCount(e.target.value)}
                className={cn(VA_FILTER_INPUT, "w-full")}
              />
              <span className="text-[11px] text-[#B8B4B8]/40">
                Default {TIER_RECREATE_COUNTS.winner}
              </span>
            </label>
            <label className="block space-y-2">
              <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[#B8B4B8]/55">
                Super Winner recreate count
              </span>
              <input
                type="number"
                min={1}
                max={500}
                step={1}
                required
                value={superCount}
                onChange={(e) => setSuperCount(e.target.value)}
                className={cn(VA_FILTER_INPUT, "w-full")}
              />
              <span className="text-[11px] text-[#B8B4B8]/40">
                Default {TIER_RECREATE_COUNTS.super_winner}
              </span>
            </label>
          </div>

          <button
            type="submit"
            disabled={saving}
            className={cn(VA_BTN_PRIMARY, "inline-flex items-center gap-2 px-5 py-2.5 text-sm")}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Save
          </button>
        </form>
      </div>
    </div>
  );
}

function groupQueueByModel(items: RecreationQueueItem[]) {
  const map = new Map<
    string,
    { model_id: string; model_name: string; items: RecreationQueueItem[] }
  >();
  for (const item of items) {
    const sub = item.submission;
    const key = sub?.model_id || sub?.model_name || "unknown";
    const name = sub?.model_name || "Unknown model";
    const existing = map.get(key);
    if (existing) existing.items.push(item);
    else map.set(key, { model_id: key, model_name: name, items: [item] });
  }
  return [...map.values()].sort((a, b) => a.model_name.localeCompare(b.model_name));
}

function QueuePanel({
  items,
  bunches,
  busyId,
  groupByModel,
  collapsedModels,
  onToggleModel,
  onAssign,
}: {
  items: RecreationQueueItem[];
  bunches: VideoBunch[];
  busyId: string | null;
  groupByModel: boolean;
  collapsedModels: Record<string, boolean>;
  onToggleModel: (modelId: string) => void;
  onAssign: (queueItemId: string, bunchId: string) => void;
}) {
  if (!items.length) {
    return (
      <div className={cn(VA_CARD, "space-y-3 px-6 py-16 text-center text-sm text-[#B8B4B8]/50")}>
        <p>Recreation queue is empty — or nothing matches your filters.</p>
        <p className="text-xs text-[#B8B4B8]/35">
          Add Winners or Super Winners from the other tabs, or clear filters.
        </p>
        <Link href={ROUTES.admin.bunches} className="inline-flex text-[#FF1493] hover:underline">
          Manage bunches →
        </Link>
      </div>
    );
  }

  const renderItem = (item: RecreationQueueItem) => {
    const sub = item.submission;
    const superTier = sub?.tier === "super_winner";
    return (
      <li
        key={item.id}
        className={cn(
          VA_CARD,
          "p-4 md:p-5",
          superTier && "border-amber-400/25 shadow-[0_0_32px_-16px_rgba(251,191,36,0.4)]",
        )}
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 flex-1 gap-3">
            {sub ? (
              <div className="hidden w-16 shrink-0 sm:block">
                <VideoThumb
                  url={sub.thumbnail_url || undefined}
                  href={sub.video_link}
                  superTier={superTier}
                />
              </div>
            ) : null}
            <div className="min-w-0 space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <ModelAvatar name={sub?.model_name || "?"} size="sm" />
                <span className="font-medium text-white">{sub?.model_name ?? "—"}</span>
                {sub ? <TierBadge tier={sub.tier} prominent={superTier} /> : null}
                {sub ? <SourceBadge source={sub.source} /> : null}
                <span className={cn(VA_STATUS_BADGE, "border-pink-500/30 bg-pink-500/10 text-pink-200")}>
                  {item.required_recreate_count} recreates
                </span>
              </div>
              {sub?.view_count != null ? (
                <p className="text-xs text-[#B8B4B8]/55">
                  <CountUp value={sub.view_count} format={formatViews} duration={600} /> views ·{" "}
                  {formatShortDate(sub.posted_at || item.created_at)}
                </p>
              ) : null}
              {sub?.video_link ? (
                <a
                  href={sub.video_link}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-[#FF1493]/90 hover:underline"
                >
                  <ExternalLink className="h-3 w-3" />
                  View on Instagram
                </a>
              ) : null}
              {item.bunch_id ? (
                <p className="text-xs text-emerald-300/80">
                  Assigned →{" "}
                  <Link
                    href={`${ROUTES.admin.bunches}?id=${encodeURIComponent(item.bunch_id)}`}
                    className="underline decoration-emerald-300/40 hover:text-emerald-200"
                  >
                    {item.bunch_name || item.bunch_id}
                  </Link>
                </p>
              ) : (
                <p className="text-xs text-[#B8B4B8]/50">Awaiting bunch assignment</p>
              )}
            </div>
          </div>
          {!item.bunch_id ? (
            <BunchAssignPicker
              bunches={bunches}
              busy={busyId === item.id}
              onAssign={(bunchId) => onAssign(item.id, bunchId)}
            />
          ) : null}
        </div>
      </li>
    );
  };

  if (!groupByModel) {
    return <ul className="space-y-3">{items.map(renderItem)}</ul>;
  }

  const groups = groupQueueByModel(items);
  return (
    <div className="space-y-4">
      {groups.map((g) => {
        const collapsed = collapsedModels[g.model_id] === true;
        return (
          <section
            key={g.model_id}
            id={`model-section-${g.model_id}`}
            className="overflow-hidden rounded-2xl border border-white/[0.06] bg-[#0D0B0D]/60"
          >
            <button
              type="button"
              onClick={() => onToggleModel(g.model_id)}
              className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition hover:bg-white/[0.03] md:px-5"
            >
              <ModelAvatar name={g.model_name} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-base font-semibold text-white">{g.model_name}</p>
                <p className="mt-0.5 text-xs text-[#B8B4B8]/55">
                  {g.items.length} queue item{g.items.length === 1 ? "" : "s"} ·{" "}
                  {g.items.filter((i) => !i.bunch_id).length} unassigned
                </p>
              </div>
              <ChevronDown
                className={cn(
                  "h-5 w-5 shrink-0 text-[#B8B4B8]/45 transition",
                  collapsed ? "-rotate-90" : "rotate-0",
                )}
              />
            </button>
            <AnimatePresence initial={false}>
              {!collapsed ? (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.22 }}
                  className="overflow-hidden border-t border-white/[0.05] p-4 md:p-5"
                >
                  <ul className="space-y-3">{g.items.map(renderItem)}</ul>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </section>
        );
      })}
    </div>
  );
}
