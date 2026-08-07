"use client";

import * as React from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  ExternalLink,
  FolderOpen,
  Loader2,
  RefreshCw,
  Settings2,
  Sparkles,
  Trophy,
} from "lucide-react";
import { useToast } from "@/contexts/toast-context";
import { winnerVideoLocalToast } from "@/components/winner-videos-shared";
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
  TIER_RECREATE_COUNTS,
  tierLabel,
  type WinnerSourcingRecreateConfig,
} from "@/lib/winner-sourcing-helpers";
import { ROUTES } from "@/lib/routes";
import type {
  RecreationQueueItem,
  VideoBunch,
  WinnerSubmission,
} from "@/services/winner-sourcing";
import { cn } from "@/lib/utils";

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

const TABS: { id: TabId; label: string }[] = [
  { id: "winners", label: "Winners" },
  { id: "super", label: "Super Winners" },
  { id: "queue", label: "Recreation Queue" },
  { id: "settings", label: "Settings" },
];

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
        return;
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
    } finally {
      setBusyId(null);
    }
  }

  async function assignToBunch(queueItemId: string, bunchId: string) {
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

  const refreshAllRef = React.useRef(refreshAll);
  refreshAllRef.current = refreshAll;
  useSupabaseRealtimeRefresh(
    ["video_bunches", "recreate_video_slots", "winner_submissions", "recreation_queue_items"],
    () => {
      void refreshAllRef.current();
    },
    { debounceMs: 800 },
  );

  const pendingWinners = winners.filter((w) => w.status === "pending");
  const pendingSupers = supers.filter((w) => w.status === "pending");
  const unassignedQueue = queue.filter((q) => !q.bunch_id);
  const openBunches = bunches.filter((b) => b.status === "open");

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-3xl border border-[#D4AF8C]/15 bg-gradient-to-br from-[#151315] via-[#0D0B0D] to-[#120810] px-6 py-8 md:px-8">
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

        <div className="relative mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatPill label="Pending Winners" value={pendingWinners.length} accent="emerald" />
          <StatPill label="Pending Super" value={pendingSupers.length} accent="amber" />
          <StatPill label="Unassigned queue" value={unassignedQueue.length} accent="pink" />
          <Link href={ROUTES.admin.bunches} className="block transition hover:brightness-110">
            <StatPill label="Open bunches" value={openBunches.length} accent="champagne" />
          </Link>
        </div>
      </div>

      <div className="flex flex-wrap gap-1 rounded-2xl border border-white/[0.06] bg-[#0D0B0D]/80 p-1.5">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              "relative rounded-xl px-4 py-2.5 text-sm font-medium transition",
              tab === t.id ? "text-white" : "text-[#B8B4B8]/55 hover:text-[#B8B4B8]",
            )}
          >
            {tab === t.id ? (
              <motion.span
                layoutId="ws-hub-tab"
                className="absolute inset-0 rounded-xl bg-gradient-to-br from-[#FF1493]/25 to-[#D4AF8C]/10 border border-[#FF1493]/25"
                transition={{ type: "spring", damping: 28, stiffness: 380 }}
              />
            ) : null}
            <span className="relative">{t.label}</span>
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.2 }}
        >
          {tab === "winners" ? (
            <SubmissionList
              items={winners}
              empty="No Winner submissions yet (100k–299,999 views)."
              busyId={busyId}
              onAddToQueue={addToQueue}
              recreateCount={recreateConfig.winner_recreate_count}
            />
          ) : null}
          {tab === "super" ? (
            <SubmissionList
              items={supers}
              empty="No Super Winner submissions yet (300k+ views)."
              busyId={busyId}
              onAddToQueue={addToQueue}
              recreateCount={recreateConfig.super_winner_recreate_count}
              superTier
            />
          ) : null}
          {tab === "queue" ? (
            <QueuePanel
              items={queue}
              bunches={openBunches}
              busyId={busyId}
              onAssign={assignToBunch}
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
    </div>
  );
}

function StatPill({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent: "emerald" | "amber" | "pink" | "champagne";
}) {
  const colors = {
    emerald: "text-emerald-300 border-emerald-500/25 bg-emerald-500/10",
    amber: "text-amber-300 border-amber-500/25 bg-amber-500/10",
    pink: "text-pink-300 border-pink-500/25 bg-pink-500/10",
    champagne: "text-[#D4AF8C] border-[#D4AF8C]/25 bg-[#D4AF8C]/10",
  };
  return (
    <div className={cn("rounded-2xl border px-4 py-3", colors[accent])}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-70">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function SubmissionList({
  items,
  empty,
  busyId,
  onAddToQueue,
  recreateCount,
  superTier,
}: {
  items: WinnerSubmission[];
  empty: string;
  busyId: string | null;
  onAddToQueue: (id: string) => void;
  recreateCount: number;
  superTier?: boolean;
}) {
  if (!items.length) {
    return (
      <div className={cn(VA_CARD, "px-6 py-16 text-center text-sm text-[#B8B4B8]/50")}>{empty}</div>
    );
  }
  return (
    <ul className="space-y-3">
      {items.map((s) => (
        <li key={s.id} className={cn(VA_CARD, VA_CARD_GLOW, "p-4 md:p-5")}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={cn(
                    VA_STATUS_BADGE,
                    superTier
                      ? "border-amber-500/35 bg-amber-500/12 text-amber-200"
                      : "border-emerald-500/35 bg-emerald-500/12 text-emerald-200",
                  )}
                >
                  {tierLabel(s.tier)}
                </span>
                <span
                  className={cn(
                    VA_STATUS_BADGE,
                    s.status === "pending"
                      ? "border-sky-500/35 bg-sky-500/12 text-sky-200"
                      : "border-[#D4AF8C]/35 bg-[#D4AF8C]/10 text-[#D4AF8C]",
                  )}
                >
                  {s.status === "pending" ? "Pending" : "Queued"}
                </span>
                <span className="text-sm font-medium text-white">{s.model_name}</span>
              </div>
              <a
                href={s.video_link}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-[#FF1493]/90 hover:underline"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Open video
              </a>
              <p className="text-xs text-[#B8B4B8]/55">
                {s.view_count.toLocaleString()} views · by {s.submitted_by_name || "—"} ·{" "}
                {s.created_at ? new Date(s.created_at).toLocaleString() : ""}
              </p>
            </div>
            {s.status === "pending" ? (
              <button
                type="button"
                disabled={busyId === s.id}
                onClick={() => onAddToQueue(s.id)}
                className={cn(VA_BTN_PRIMARY, "inline-flex items-center gap-2 px-4 py-2 text-xs")}
              >
                {busyId === s.id ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5" />
                )}
                Add to queue ({recreateCount}×)
              </button>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
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
  const [winnerCount, setWinnerCount] = React.useState(String(config.winner_recreate_count));
  const [superCount, setSuperCount] = React.useState(String(config.super_winner_recreate_count));

  React.useEffect(() => {
    setWinnerCount(String(config.winner_recreate_count));
    setSuperCount(String(config.super_winner_recreate_count));
  }, [config.winner_recreate_count, config.super_winner_recreate_count]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSave({
      winner_recreate_count: Number(winnerCount),
      super_winner_recreate_count: Number(superCount),
    });
  }

  const saving = busyId === "save-settings";

  return (
    <div className={cn(VA_CARD, "p-5 md:p-6")}>
      <div className="mb-5 flex items-start gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#D4AF8C]/25 bg-[#D4AF8C]/10">
          <Settings2 className="h-5 w-5 text-[#D4AF8C]" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-white">Recreate counts</h2>
          <p className="mt-1 max-w-2xl text-sm text-[#B8B4B8]/65">
            This determines how many recreate videos are required when a Winner or Super Winner is
            added to a bunch. Changes only affect NEWLY queued items — existing recreation_queue_items
            keep their originally-assigned count.
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
  );
}

function QueuePanel({
  items,
  bunches,
  busyId,
  onAssign,
}: {
  items: RecreationQueueItem[];
  bunches: VideoBunch[];
  busyId: string | null;
  onAssign: (queueItemId: string, bunchId: string) => void;
}) {
  const [pick, setPick] = React.useState<Record<string, string>>({});

  if (!items.length) {
    return (
      <div className={cn(VA_CARD, "space-y-3 px-6 py-16 text-center text-sm text-[#B8B4B8]/50")}>
        <p>Recreation queue is empty. Add Winners or Super Winners from the other tabs.</p>
        <Link href={ROUTES.admin.bunches} className="inline-flex text-[#FF1493] hover:underline">
          Manage bunches →
        </Link>
      </div>
    );
  }

  return (
    <ul className="space-y-3">
      {items.map((item) => {
        const sub = item.submission;
        return (
          <li key={item.id} className={cn(VA_CARD, "p-4 md:p-5")}>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <Trophy className="h-4 w-4 text-[#D4AF8C]" />
                  <span className="font-medium text-white">
                    {sub?.model_name ?? "—"} · {sub ? tierLabel(sub.tier) : "—"}
                  </span>
                  <span className={cn(VA_STATUS_BADGE, "border-pink-500/30 bg-pink-500/10 text-pink-200")}>
                    {item.required_recreate_count} recreates
                  </span>
                </div>
                {sub?.video_link ? (
                  <a
                    href={sub.video_link}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-[#FF1493]/90 hover:underline"
                  >
                    Source video
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
              {!item.bunch_id ? (
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    className={cn(VA_FILTER_INPUT, "min-w-[180px]")}
                    value={pick[item.id] ?? ""}
                    onChange={(e) => setPick((p) => ({ ...p, [item.id]: e.target.value }))}
                  >
                    <option value="">Select open bunch…</option>
                    {bunches.length === 0 ? (
                      <option value="" disabled>
                        No open bunches — create one on Bunches
                      </option>
                    ) : null}
                    {bunches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name} ({b.remaining_count ?? 0} left / {b.target_video_count})
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    disabled={!pick[item.id] || busyId === item.id}
                    onClick={() => onAssign(item.id, pick[item.id])}
                    className={cn(VA_BTN_PRIMARY, "px-4 py-2 text-xs")}
                  >
                    {busyId === item.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Assign & spawn slots"}
                  </button>
                </div>
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
