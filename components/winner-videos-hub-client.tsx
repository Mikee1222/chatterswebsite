"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ExternalLink,
  FolderPlus,
  Loader2,
  Plus,
  RefreshCw,
  Settings2,
  Sparkles,
  Trophy,
  UserRound,
  Users,
} from "lucide-react";
import { StaffAssigneePicker, type StaffUserOption } from "@/components/staff-assignee-picker";
import { useToast } from "@/contexts/toast-context";
import { winnerVideoLocalToast } from "@/components/winner-videos-shared";
import {
  VA_BTN_PRIMARY,
  VA_BTN_SECONDARY,
  VA_CARD,
  VA_CARD_GLOW,
  VA_FILTER_INPUT,
  VA_STATUS_BADGE,
} from "@/lib/va-tasks-tokens";
import { SCRIPT_STATUS_STYLES } from "@/lib/creative-scripts-helpers";
import {
  SLOT_VIDEO_TYPES,
  SLOT_VIDEO_TYPE_LABELS,
  TIER_RECREATE_COUNTS,
  tierLabel,
  type SlotVideoType,
  type WinnerSourcingRecreateConfig,
} from "@/lib/winner-sourcing-helpers";
import type {
  RecreationQueueItem,
  RecreateVideoSlot,
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

type TabId = "winners" | "super" | "queue" | "bunches" | "settings";

const TABS: { id: TabId; label: string }[] = [
  { id: "winners", label: "Winners" },
  { id: "super", label: "Super Winners" },
  { id: "queue", label: "Recreation Queue" },
  { id: "bunches", label: "Bunches" },
  { id: "settings", label: "Settings" },
];

export function WinnerVideosHubClient({
  initialWinners,
  initialSuperWinners,
  initialQueue,
  initialBunches,
  initialRecreateConfig,
  models,
  creatives,
}: {
  initialWinners: WinnerSubmission[];
  initialSuperWinners: WinnerSubmission[];
  initialQueue: RecreationQueueItem[];
  initialBunches: VideoBunch[];
  initialRecreateConfig: WinnerSourcingRecreateConfig;
  models: HubModelOption[];
  creatives: HubCreativeOption[];
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

  // Bunch detail
  const [selectedBunchId, setSelectedBunchId] = React.useState<string | null>(null);
  const [bunchSlots, setBunchSlots] = React.useState<RecreateVideoSlot[]>([]);
  const [loadingSlots, setLoadingSlots] = React.useState(false);

  // Create bunch form
  const [showCreateBunch, setShowCreateBunch] = React.useState(false);
  const [bunchName, setBunchName] = React.useState("");
  const [bunchModelId, setBunchModelId] = React.useState("");
  const [bunchTarget, setBunchTarget] = React.useState("30");

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

  async function loadBunchSlots(bunchId: string) {
    setSelectedBunchId(bunchId);
    setLoadingSlots(true);
    try {
      const res = await fetch(`/api/winner-sourcing/bunches/${bunchId}`, { credentials: "include" });
      if (!res.ok) return;
      const d = await res.json();
      setBunchSlots(d.slots ?? []);
      if (d.bunch) {
        setBunches((prev) => prev.map((b) => (b.id === bunchId ? { ...b, ...d.bunch } : b)));
      }
    } finally {
      setLoadingSlots(false);
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
      if (selectedBunchId === bunchId) await loadBunchSlots(bunchId);
    } finally {
      setBusyId(null);
    }
  }

  async function createBunch(e: React.FormEvent) {
    e.preventDefault();
    const model = models.find((m) => m.model_id === bunchModelId);
    if (!model) return;
    setBusyId("create-bunch");
    try {
      const res = await fetch("/api/winner-sourcing/bunches", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: bunchName,
          model_id: model.model_id,
          model_name: model.model_name,
          target_video_count: Number(bunchTarget) || 30,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        addToast(
          winnerVideoLocalToast(`ws-err-${Date.now()}`, "Create failed", data.error || "Error", "high"),
        );
        return;
      }
      addToast(winnerVideoLocalToast(`ws-b-${Date.now()}`, "Bunch created", data.bunch?.name ?? "", "normal"));
      setShowCreateBunch(false);
      setBunchName("");
      setBunchModelId("");
      setBunchTarget("30");
      await refreshAll();
    } finally {
      setBusyId(null);
    }
  }

  async function assignCreativeToBunch(bunchId: string, creativeId: string) {
    const creative = creatives.find((c) => c.id === creativeId);
    if (!creative) return;
    setBusyId(bunchId);
    try {
      const res = await fetch(`/api/winner-sourcing/bunches/${bunchId}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "assign_creative",
          assigned_creative_id: creative.id,
          assigned_creative_name: creative.name,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        addToast(
          winnerVideoLocalToast(`ws-err-${Date.now()}`, "Assign failed", data.error || "Error", "high"),
        );
        return;
      }
      const updated = data.updated_slots?.length ?? 0;
      const skipped = data.skipped_slots ?? 0;
      addToast(
        winnerVideoLocalToast(
          `ws-cr-${Date.now()}`,
          "Bunch assigned to creative",
          `${creative.name} · ${updated} slot${updated === 1 ? "" : "s"} updated${skipped ? ` · ${skipped} kept historical` : ""}`,
          "normal",
        ),
      );
      if (data.bunch) {
        setBunches((prev) => prev.map((b) => (b.id === bunchId ? { ...b, ...data.bunch } : b)));
      }
      if (selectedBunchId === bunchId) await loadBunchSlots(bunchId);
      else await refreshAll();
    } finally {
      setBusyId(null);
    }
  }

  async function updateSlotType(
    slotId: string,
    video_type: SlotVideoType | "",
    video_type_other?: string,
  ) {
    setBusyId(slotId);
    try {
      const res = await fetch(`/api/winner-sourcing/slots/${slotId}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          video_type,
          video_type_other: video_type === "other" ? (video_type_other ?? "") : "",
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        addToast(
          winnerVideoLocalToast(
            `ws-type-${Date.now()}`,
            "Type update failed",
            data.error || "Could not update type",
            "high",
          ),
        );
        return;
      }
      if (selectedBunchId) await loadBunchSlots(selectedBunchId);
    } finally {
      setBusyId(null);
    }
  }

  async function toggleBunchStatus(id: string, status: "open" | "closed") {
    setBusyId(id);
    try {
      const res = await fetch(`/api/winner-sourcing/bunches/${id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        addToast(
          winnerVideoLocalToast(`ws-err-${Date.now()}`, "Update failed", data.error || "Error", "high"),
        );
        return;
      }
      await refreshAll();
    } finally {
      setBusyId(null);
    }
  }

  const pendingWinners = winners.filter((w) => w.status === "pending");
  const pendingSupers = supers.filter((w) => w.status === "pending");
  const unassignedQueue = queue.filter((q) => !q.bunch_id);
  const openBunches = bunches.filter((b) => b.status === "open");

  return (
    <div className="space-y-6">
      {/* Hero */}
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
              Source Winners & Super Winners, plan recreates into bunches, and hand off to Creative Scripts —
              separate from Research finds.
            </p>
          </div>
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

        <div className="relative mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatPill label="Pending Winners" value={pendingWinners.length} accent="emerald" />
          <StatPill label="Pending Super" value={pendingSupers.length} accent="amber" />
          <StatPill label="Unassigned queue" value={unassignedQueue.length} accent="pink" />
          <StatPill label="Open bunches" value={openBunches.length} accent="champagne" />
        </div>
      </div>

      {/* Tabs */}
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
          {tab === "bunches" ? (
            <BunchesPanel
              bunches={bunches}
              models={models}
              creatives={creatives}
              showCreate={showCreateBunch}
              setShowCreate={setShowCreateBunch}
              bunchName={bunchName}
              setBunchName={setBunchName}
              bunchModelId={bunchModelId}
              setBunchModelId={setBunchModelId}
              bunchTarget={bunchTarget}
              setBunchTarget={setBunchTarget}
              onCreate={(e) => void createBunch(e)}
              busyId={busyId}
              selectedBunchId={selectedBunchId}
              slots={bunchSlots}
              loadingSlots={loadingSlots}
              onSelectBunch={(id) => void loadBunchSlots(id)}
              onAssignCreative={assignCreativeToBunch}
              onUpdateSlotType={updateSlotType}
              onToggleBunchStatus={toggleBunchStatus}
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
      <div className={cn(VA_CARD, "px-6 py-16 text-center text-sm text-[#B8B4B8]/50")}>
        Recreation queue is empty. Add Winners or Super Winners from the other tabs.
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
                  <p className="text-xs text-emerald-300/80">Assigned → {item.bunch_name || item.bunch_id}</p>
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

function BunchesPanel({
  bunches,
  models,
  creatives,
  showCreate,
  setShowCreate,
  bunchName,
  setBunchName,
  bunchModelId,
  setBunchModelId,
  bunchTarget,
  setBunchTarget,
  onCreate,
  busyId,
  selectedBunchId,
  slots,
  loadingSlots,
  onSelectBunch,
  onAssignCreative,
  onUpdateSlotType,
  onToggleBunchStatus,
}: {
  bunches: VideoBunch[];
  models: HubModelOption[];
  creatives: HubCreativeOption[];
  showCreate: boolean;
  setShowCreate: (v: boolean) => void;
  bunchName: string;
  setBunchName: (v: string) => void;
  bunchModelId: string;
  setBunchModelId: (v: string) => void;
  bunchTarget: string;
  setBunchTarget: (v: string) => void;
  onCreate: (e: React.FormEvent) => void;
  busyId: string | null;
  selectedBunchId: string | null;
  slots: RecreateVideoSlot[];
  loadingSlots: boolean;
  onSelectBunch: (id: string) => void;
  onAssignCreative: (bunchId: string, creativeId: string) => void;
  onUpdateSlotType: (
    slotId: string,
    video_type: SlotVideoType | "",
    video_type_other?: string,
  ) => void;
  onToggleBunchStatus?: (id: string, status: "open" | "closed") => void;
}) {
  const [showAssignPicker, setShowAssignPicker] = React.useState(false);
  const selectedBunch = bunches.find((b) => b.id === selectedBunchId) ?? null;

  const staffCreatives = React.useMemo<StaffUserOption[]>(
    () =>
      creatives.map((c) => ({
        id: c.id,
        full_name: c.name,
        email: c.email ?? "",
        role: c.role ?? "other",
      })),
    [creatives],
  );

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setShowCreate(!showCreate)}
          className={cn(VA_BTN_PRIMARY, "inline-flex items-center gap-2 px-4 py-2.5 text-sm")}
        >
          <FolderPlus className="h-4 w-4" />
          Create bunch
        </button>
      </div>

      {showCreate ? (
        <form onSubmit={onCreate} className={cn(VA_CARD, "grid gap-3 p-5 sm:grid-cols-2")}>
          <label className="space-y-1.5 sm:col-span-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#D4AF8C]/70">Name</span>
            <input
              className={cn(VA_FILTER_INPUT, "w-full")}
              value={bunchName}
              onChange={(e) => setBunchName(e.target.value)}
              placeholder="e.g. Maya March Recreates"
              required
            />
          </label>
          <label className="space-y-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#D4AF8C]/70">Model</span>
            <select
              className={cn(VA_FILTER_INPUT, "w-full")}
              value={bunchModelId}
              onChange={(e) => setBunchModelId(e.target.value)}
              required
            >
              <option value="">Select model…</option>
              {models.map((m) => (
                <option key={m.model_id} value={m.model_id}>
                  {m.model_name}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#D4AF8C]/70">
              Target video count
            </span>
            <input
              type="number"
              min={1}
              className={cn(VA_FILTER_INPUT, "w-full")}
              value={bunchTarget}
              onChange={(e) => setBunchTarget(e.target.value)}
              required
            />
          </label>
          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={busyId === "create-bunch"}
              className={cn(VA_BTN_PRIMARY, "inline-flex items-center gap-2")}
            >
              {busyId === "create-bunch" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Create
            </button>
          </div>
        </form>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <ul className="space-y-2">
          {bunches.length === 0 ? (
            <li className={cn(VA_CARD, "px-5 py-12 text-center text-sm text-[#B8B4B8]/50")}>
              No bunches yet.
            </li>
          ) : (
            bunches.map((b) => {
              const provided = b.provided_count ?? 0;
              const pending = b.pending_review_count ?? 0;
              const remaining =
                b.remaining_count ?? Math.max(0, b.target_video_count - provided - pending);
              const occupied = provided + pending;
              const pct = Math.min(100, Math.round((occupied / b.target_video_count) * 100));
              const creativeLabel = b.assigned_creative_name?.trim();
              return (
                <li key={b.id}>
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => onSelectBunch(b.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onSelectBunch(b.id);
                      }
                    }}
                    className={cn(
                      VA_CARD,
                      "w-full cursor-pointer p-4 text-left transition",
                      selectedBunchId === b.id && "border-[#FF1493]/35 ring-1 ring-[#FF1493]/20",
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium text-white">{b.name}</p>
                        <p className="mt-0.5 text-xs text-[#B8B4B8]/55">
                          {b.model_name} · {b.status}
                        </p>
                        <p className="mt-1 text-[11px] text-[#B8B4B8]/45">
                          Filled {provided} · Pending {pending} · Needed {remaining}
                        </p>
                        <p className="mt-1.5 flex items-center gap-1 text-[11px] text-[#D4AF8C]/80">
                          <UserRound className="h-3 w-3 opacity-70" aria-hidden />
                          {creativeLabel ? `Creative: ${creativeLabel}` : "No creative assigned"}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span className="text-xs tabular-nums text-[#D4AF8C]">
                          {occupied}/{b.target_video_count}
                        </span>
                        <button
                          type="button"
                          className="text-[10px] font-medium uppercase tracking-wider text-[#B8B4B8]/50 hover:text-[#D4AF8C]"
                          onClick={(e) => {
                            e.stopPropagation();
                            onToggleBunchStatus?.(b.id, b.status === "open" ? "closed" : "open");
                          }}
                        >
                          {b.status === "open" ? "Close" : "Reopen"}
                        </button>
                      </div>
                    </div>
                    <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/5">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-[#FF1493] to-[#D4AF8C]"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <p className="mt-2 text-[11px] text-[#B8B4B8]/45">{remaining} remaining</p>
                  </div>
                </li>
              );
            })
          )}
        </ul>

        <div className={cn(VA_CARD, "min-h-[240px] p-4")}>
          {!selectedBunchId || !selectedBunch ? (
            <div className="flex h-full min-h-[200px] flex-col items-center justify-center gap-2 text-sm text-[#B8B4B8]/45">
              <Users className="h-8 w-8 opacity-40" />
              Select a bunch to view recreate slots
            </div>
          ) : loadingSlots ? (
            <div className="flex min-h-[200px] items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-[#FF1493]" />
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-white">{selectedBunch.name}</h3>
                  <p className="mt-0.5 text-xs text-[#B8B4B8]/55">
                    Slots ({slots.length})
                    {selectedBunch.assigned_creative_name?.trim()
                      ? ` · Creative: ${selectedBunch.assigned_creative_name}`
                      : " · No creative yet"}
                  </p>
                </div>
                <button
                  type="button"
                  className={cn(VA_BTN_SECONDARY, "inline-flex items-center gap-1.5 px-3 py-1.5 text-xs")}
                  onClick={() => setShowAssignPicker((v) => !v)}
                  disabled={busyId === selectedBunch.id || creatives.length === 0}
                >
                  {busyId === selectedBunch.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <UserRound className="h-3.5 w-3.5" />
                  )}
                  {selectedBunch.assigned_creative_id ? "Re-assign creative" : "Assign creative"}
                </button>
              </div>

              {creatives.length === 0 ? (
                <p className="rounded-lg border border-amber-500/25 bg-amber-500/8 px-3 py-2 text-xs text-amber-200">
                  No Creatives available — grant creative_scripts:submit to a user first.
                </p>
              ) : null}

              {showAssignPicker && creatives.length > 0 ? (
                <div className="rounded-xl border border-white/[0.08] bg-[#0A0A0A]/70 p-3">
                  <p className="mb-2 text-[11px] text-[#B8B4B8]/55">
                    Assigns the entire bunch. New slots inherit automatically. Slots already submitted for
                    review keep their historical writer.
                  </p>
                  <StaffAssigneePicker
                    users={staffCreatives}
                    roleLabels={{}}
                    singleSelect
                    selectedIds={
                      selectedBunch.assigned_creative_id ? [selectedBunch.assigned_creative_id] : []
                    }
                    onChange={(ids) => {
                      const next = ids[0];
                      if (!next || next === selectedBunch.assigned_creative_id) return;
                      setShowAssignPicker(false);
                      onAssignCreative(selectedBunch.id, next);
                    }}
                  />
                </div>
              ) : null}

              {slots.length === 0 ? (
                <p className="text-sm text-[#B8B4B8]/50">No slots yet — assign queue items or wait for researchers.</p>
              ) : (
                <ul className="max-h-[520px] space-y-2 overflow-y-auto pr-1">
                  {slots.map((slot) => {
                    const st = SCRIPT_STATUS_STYLES[slot.status] ?? SCRIPT_STATUS_STYLES["Not Applicable"];
                    const scriptOwner =
                      slot.assigned_creative_name?.trim() ||
                      selectedBunch.assigned_creative_name?.trim() ||
                      "";
                    return (
                      <li
                        key={slot.id}
                        className="rounded-xl border border-white/[0.06] bg-[#0A0A0A]/60 p-3"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-medium text-[#D4AF8C]">#{slot.sequence_number}</span>
                          <span className={cn(VA_STATUS_BADGE, st.className)}>{st.label}</span>
                          <span className="text-[10px] uppercase tracking-wider text-[#B8B4B8]/40">
                            {slot.source === "from_winner" ? "from winner" : "researcher"}
                          </span>
                        </div>
                        <p className="mt-1.5 line-clamp-2 text-xs text-[#B8B4B8]/75">{slot.description || "—"}</p>
                        {slot.video_link ? (
                          <a
                            href={slot.video_link}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-1 inline-flex text-[11px] text-[#FF1493]/90 hover:underline"
                          >
                            Video link
                          </a>
                        ) : null}
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <select
                            className={cn(VA_FILTER_INPUT, "h-8 text-xs")}
                            value={slot.video_type}
                            onChange={(e) => {
                              const next = e.target.value as SlotVideoType | "";
                              if (next === "other") {
                                const custom =
                                  slot.video_type_other?.trim() ||
                                  window.prompt("Custom video type") ||
                                  "";
                                if (!custom.trim()) return;
                                onUpdateSlotType(slot.id, next, custom.trim());
                                return;
                              }
                              onUpdateSlotType(slot.id, next);
                            }}
                            disabled={busyId === slot.id}
                          >
                            <option value="">Type…</option>
                            {SLOT_VIDEO_TYPES.map((t) => (
                              <option key={t} value={t}>
                                {SLOT_VIDEO_TYPE_LABELS[t]}
                              </option>
                            ))}
                          </select>
                          {slot.video_type === "other" && slot.video_type_other?.trim() ? (
                            <span className="max-w-[10rem] truncate text-[11px] text-[#D4AF8C]/80" title={slot.video_type_other}>
                              {slot.video_type_other}
                            </span>
                          ) : null}
                          {scriptOwner ? (
                            <span className="text-[11px] text-emerald-300/80">
                              Scripts: {scriptOwner}
                              {slot.status === "Pending Review" ||
                              slot.status === "Approved" ||
                              slot.status === "Rejected"
                                ? " (historical)"
                                : ""}
                            </span>
                          ) : (
                            <span className="text-[11px] text-[#B8B4B8]/45">Awaiting bunch creative</span>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

