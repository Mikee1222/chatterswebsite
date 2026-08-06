"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ExternalLink,
  FolderPlus,
  Loader2,
  Plus,
  RefreshCw,
  Sparkles,
  Trophy,
  Users,
} from "lucide-react";
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
  TIER_RECREATE_COUNTS,
  tierLabel,
  type SlotVideoType,
} from "@/lib/winner-sourcing-helpers";
import type {
  RecreationQueueItem,
  RecreateVideoSlot,
  VideoBunch,
  WinnerSubmission,
} from "@/services/winner-sourcing";
import { cn } from "@/lib/utils";

export type HubModelOption = { model_id: string; model_name: string };
export type HubCreativeOption = { id: string; name: string };

type TabId = "winners" | "super" | "queue" | "bunches";

const TABS: { id: TabId; label: string }[] = [
  { id: "winners", label: "Winners" },
  { id: "super", label: "Super Winners" },
  { id: "queue", label: "Recreation Queue" },
  { id: "bunches", label: "Bunches" },
];

export function WinnerVideosHubClient({
  initialWinners,
  initialSuperWinners,
  initialQueue,
  initialBunches,
  models,
  creatives,
}: {
  initialWinners: WinnerSubmission[];
  initialSuperWinners: WinnerSubmission[];
  initialQueue: RecreationQueueItem[];
  initialBunches: VideoBunch[];
  models: HubModelOption[];
  creatives: HubCreativeOption[];
}) {
  const { addToast } = useToast();
  const [tab, setTab] = React.useState<TabId>("winners");
  const [winners, setWinners] = React.useState(initialWinners);
  const [supers, setSupers] = React.useState(initialSuperWinners);
  const [queue, setQueue] = React.useState(initialQueue);
  const [bunches, setBunches] = React.useState(initialBunches);
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
      const [wRes, sRes, qRes, bRes] = await Promise.all([
        fetch("/api/winner-sourcing/submissions?tier=winner", { credentials: "include" }),
        fetch("/api/winner-sourcing/submissions?tier=super_winner", { credentials: "include" }),
        fetch("/api/winner-sourcing/queue", { credentials: "include" }),
        fetch("/api/winner-sourcing/bunches", { credentials: "include" }),
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
    } finally {
      setRefreshing(false);
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

  async function assignCreative(slotId: string, creativeId: string) {
    const creative = creatives.find((c) => c.id === creativeId);
    if (!creative) return;
    setBusyId(slotId);
    try {
      const res = await fetch(`/api/winner-sourcing/slots/${slotId}`, {
        method: "POST",
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
      addToast(
        winnerVideoLocalToast(
          `ws-cr-${Date.now()}`,
          "Creative Scripts work item created",
          `Assigned to ${creative.name}`,
          "normal",
        ),
      );
      if (selectedBunchId) await loadBunchSlots(selectedBunchId);
    } finally {
      setBusyId(null);
    }
  }

  async function updateSlotType(slotId: string, video_type: SlotVideoType) {
    setBusyId(slotId);
    try {
      await fetch(`/api/winner-sourcing/slots/${slotId}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ video_type }),
      });
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
            />
          ) : null}
          {tab === "super" ? (
            <SubmissionList
              items={supers}
              empty="No Super Winner submissions yet (300k+ views)."
              busyId={busyId}
              onAddToQueue={addToQueue}
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
              onAssignCreative={assignCreative}
              onUpdateSlotType={updateSlotType}
              onToggleBunchStatus={toggleBunchStatus}
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
  superTier,
}: {
  items: WinnerSubmission[];
  empty: string;
  busyId: string | null;
  onAddToQueue: (id: string) => void;
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
                Add to queue ({TIER_RECREATE_COUNTS[s.tier]}×)
              </button>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
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
  onAssignCreative: (slotId: string, creativeId: string) => void;
  onUpdateSlotType: (slotId: string, video_type: SlotVideoType) => void;
  onToggleBunchStatus?: (id: string, status: "open" | "closed") => void;
}) {
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
          {!selectedBunchId ? (
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
              <h3 className="text-sm font-semibold text-white">
                Slots ({slots.length})
              </h3>
              {slots.length === 0 ? (
                <p className="text-sm text-[#B8B4B8]/50">No slots yet — assign queue items or wait for researchers.</p>
              ) : (
                <ul className="max-h-[520px] space-y-2 overflow-y-auto pr-1">
                  {slots.map((slot) => {
                    const st = SCRIPT_STATUS_STYLES[slot.status] ?? SCRIPT_STATUS_STYLES["Not Applicable"];
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
                            onChange={(e) =>
                              onUpdateSlotType(slot.id, e.target.value as SlotVideoType)
                            }
                            disabled={busyId === slot.id}
                          >
                            <option value="">Type…</option>
                            <option value="skit">Skit</option>
                            <option value="ugc">UGC</option>
                            <option value="other">Other</option>
                          </select>
                          {!slot.winner_video_id ? (
                            <select
                              className={cn(VA_FILTER_INPUT, "h-8 min-w-[140px] text-xs")}
                              defaultValue=""
                              onChange={(e) => {
                                if (e.target.value) onAssignCreative(slot.id, e.target.value);
                              }}
                              disabled={busyId === slot.id || !slot.video_link}
                            >
                              <option value="">Assign creative → Scripts</option>
                              {creatives.map((c) => (
                                <option key={c.id} value={c.id}>
                                  {c.name}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <span className="text-[11px] text-emerald-300/80">
                              Scripts: {slot.assigned_creative_name || "assigned"}
                            </span>
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
