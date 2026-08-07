"use client";

import * as React from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import {
  ExternalLink,
  FolderPlus,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  UserRound,
  Users,
} from "lucide-react";
import { StaffAssigneePicker, type StaffUserOption } from "@/components/staff-assignee-picker";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { useToast } from "@/contexts/toast-context";
import { winnerVideoLocalToast } from "@/components/winner-videos-shared";
import { useSupabaseRealtimeRefresh } from "@/lib/hooks/use-supabase-realtime";
import { usePagination } from "@/lib/use-pagination";
import {
  VA_BTN_PRIMARY,
  VA_BTN_SECONDARY,
  VA_CARD,
  VA_FILTER_INPUT,
  VA_STATUS_BADGE,
} from "@/lib/va-tasks-tokens";
import { SCRIPT_STATUS_STYLES } from "@/lib/creative-scripts-helpers";
import { bunchScriptsReadyForFilming, FILMING_STATUS_STYLES, type FilmingStatus } from "@/lib/filming-helpers";
import {
  SLOT_VIDEO_TYPES,
  SLOT_VIDEO_TYPE_LABELS,
  type SlotVideoType,
} from "@/lib/winner-sourcing-helpers";
import { ROUTES } from "@/lib/routes";
import type { RecreateVideoSlot, VideoBunch } from "@/services/winner-sourcing";
import { cn } from "@/lib/utils";

export type BunchStaffOption = {
  id: string;
  name: string;
  email?: string;
  role?: string;
};

export type BunchModelOption = { model_id: string; model_name: string };

const PAGE_SIZE = 12;
const FILMING_FILTERS: Array<{ value: "all" | FilmingStatus; label: string }> = [
  { value: "all", label: "All filming" },
  { value: "unassigned", label: "Unassigned" },
  { value: "assigned", label: "Assigned" },
  { value: "in_progress", label: "In progress" },
  { value: "uploaded", label: "Uploaded" },
];

function formatBunchDate(iso: string | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export function AdminBunchesClient({
  initialBunches,
  models,
  creatives,
  filmers = [],
  canManageFilming = false,
  initialFilmingProgress = {},
  initialSelectedId = null,
}: {
  initialBunches: VideoBunch[];
  models: BunchModelOption[];
  creatives: BunchStaffOption[];
  filmers?: BunchStaffOption[];
  canManageFilming?: boolean;
  initialFilmingProgress?: Record<string, { filmed_count: number; filmable_count: number }>;
  initialSelectedId?: string | null;
}) {
  const { addToast } = useToast();
  const [bunches, setBunches] = React.useState(initialBunches);
  const [filmingProgress, setFilmingProgress] = React.useState(initialFilmingProgress);
  const [refreshing, setRefreshing] = React.useState(false);
  const [busyId, setBusyId] = React.useState<string | null>(null);

  const [selectedBunchId, setSelectedBunchId] = React.useState<string | null>(initialSelectedId);
  const [slots, setSlots] = React.useState<RecreateVideoSlot[]>([]);
  const [loadingSlots, setLoadingSlots] = React.useState(false);

  const [showCreate, setShowCreate] = React.useState(false);
  const [bunchName, setBunchName] = React.useState("");
  const [bunchModelId, setBunchModelId] = React.useState("");
  const [bunchTarget, setBunchTarget] = React.useState("30");

  const [showAssignPicker, setShowAssignPicker] = React.useState(false);
  const [showFilmerPicker, setShowFilmerPicker] = React.useState(false);

  const [search, setSearch] = React.useState("");
  const [modelFilter, setModelFilter] = React.useState("all");
  const [statusFilter, setStatusFilter] = React.useState<"all" | "open" | "closed">("open");
  const [filmingFilter, setFilmingFilter] = React.useState<"all" | FilmingStatus>("all");
  const [creativeFilter, setCreativeFilter] = React.useState("all");
  const [filmerFilter, setFilmerFilter] = React.useState("all");

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

  const staffFilmers = React.useMemo<StaffUserOption[]>(
    () =>
      filmers.map((f) => ({
        id: f.id,
        full_name: f.name,
        email: f.email ?? "",
        role: f.role ?? "other",
      })),
    [filmers],
  );

  async function refreshFilmingProgress(ids: string[]) {
    if (!canManageFilming || ids.length === 0) return;
    try {
      const res = await fetch(
        `/api/filming/progress?ids=${encodeURIComponent(ids.join(","))}`,
        { credentials: "include" },
      );
      if (res.ok) {
        const d = (await res.json()) as {
          progress?: Record<string, { filmed_count: number; filmable_count: number }>;
        };
        if (d.progress) setFilmingProgress((prev) => ({ ...prev, ...d.progress }));
      }
    } catch {
      /* ignore */
    }
  }

  async function refreshAll() {
    setRefreshing(true);
    try {
      const res = await fetch("/api/winner-sourcing/bunches", { credentials: "include" });
      if (res.ok) {
        const d = await res.json();
        const next = (d.bunches ?? []) as VideoBunch[];
        setBunches(next);
        void refreshFilmingProgress(next.map((b) => b.id));
      }
    } finally {
      setRefreshing(false);
    }
  }

  const refreshAllRef = React.useRef(refreshAll);
  refreshAllRef.current = refreshAll;
  useSupabaseRealtimeRefresh(
    ["video_bunches", "recreate_video_slots"],
    () => void refreshAllRef.current(),
    { debounceMs: 800 },
  );

  async function loadBunchSlots(bunchId: string) {
    setSelectedBunchId(bunchId);
    setShowAssignPicker(false);
    setShowFilmerPicker(false);
    setLoadingSlots(true);
    try {
      const res = await fetch(`/api/winner-sourcing/bunches/${bunchId}`, { credentials: "include" });
      if (!res.ok) return;
      const d = await res.json();
      setSlots(d.slots ?? []);
      if (d.bunch) {
        setBunches((prev) => prev.map((b) => (b.id === bunchId ? { ...b, ...d.bunch } : b)));
      }
    } finally {
      setLoadingSlots(false);
    }
  }

  React.useEffect(() => {
    if (initialSelectedId) void loadBunchSlots(initialSelectedId);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount once for deep-link
  }, []);

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
      setShowCreate(false);
      setBunchName("");
      setBunchModelId("");
      setBunchTarget("30");
      await refreshAll();
      if (data.bunch?.id) await loadBunchSlots(data.bunch.id);
    } finally {
      setBusyId(null);
    }
  }

  async function assignCreativeToBunch(bunchId: string, creativeId: string) {
    const creative = creatives.find((c) => c.id === creativeId);
    if (!creative) {
      addToast(
        winnerVideoLocalToast(`ws-err-${Date.now()}`, "Assign failed", "Creative not found", "high"),
      );
      return;
    }
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

  async function assignFilmerToBunch(bunchId: string, filmerId: string) {
    const filmer = filmers.find((f) => f.id === filmerId);
    if (!filmer) {
      addToast(
        winnerVideoLocalToast(`ws-film-err-${Date.now()}`, "Filmer assign failed", "Filmer not found", "high"),
      );
      return;
    }
    setBusyId(`filmer-${bunchId}`);
    try {
      const res = await fetch(`/api/winner-sourcing/bunches/${encodeURIComponent(bunchId)}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "assign_filmer",
          assigned_filmer_id: filmer.id,
          assigned_filmer_name: filmer.name,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        addToast(
          winnerVideoLocalToast(
            `ws-film-err-${Date.now()}`,
            "Filmer assign failed",
            data.error || "Error",
            "high",
          ),
        );
        return;
      }
      addToast(
        winnerVideoLocalToast(
          `ws-film-ok-${Date.now()}`,
          "Bunch assigned to filmer",
          `${filmer.name} — visible in Shoot Assignments`,
          "normal",
        ),
      );
      if (data.bunch) {
        setBunches((prev) => prev.map((b) => (b.id === bunchId ? { ...b, ...data.bunch } : b)));
      }
      void refreshFilmingProgress([bunchId]);
      if (selectedBunchId === bunchId) await loadBunchSlots(bunchId);
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

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return bunches.filter((b) => {
      if (statusFilter !== "all" && b.status !== statusFilter) return false;
      if (modelFilter !== "all" && b.model_id !== modelFilter) return false;
      if (filmingFilter !== "all" && b.filming_status !== filmingFilter) return false;
      if (creativeFilter !== "all") {
        if (creativeFilter === "__none__") {
          if (b.assigned_creative_id) return false;
        } else if (b.assigned_creative_id !== creativeFilter) return false;
      }
      if (filmerFilter !== "all") {
        if (filmerFilter === "__none__") {
          if (b.assigned_filmer_id) return false;
        } else if (b.assigned_filmer_id !== filmerFilter) return false;
      }
      if (!q) return true;
      const hay = [
        b.name,
        b.model_name,
        b.assigned_creative_name,
        b.assigned_filmer_name,
        b.status,
        b.filming_status,
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [bunches, search, modelFilter, statusFilter, filmingFilter, creativeFilter, filmerFilter]);

  const { page, setPage, totalPages, paginated, reset } = usePagination(filtered, PAGE_SIZE);
  React.useEffect(() => {
    reset();
  }, [search, modelFilter, statusFilter, filmingFilter, creativeFilter, filmerFilter, reset]);

  const selectedBunch = bunches.find((b) => b.id === selectedBunchId) ?? null;
  const scriptsReady = bunchScriptsReadyForFilming(slots);
  const selectedProgress = selectedBunchId
    ? filmingProgress[selectedBunchId] ?? {
        filmed_count: slots.filter((s) => s.status === "Approved" && s.filmed).length,
        filmable_count: slots.filter((s) => s.status === "Approved").length,
      }
    : null;

  const openCount = bunches.filter((b) => b.status === "open").length;
  const filmingReadyCount = canManageFilming
    ? bunches.filter((b) => b.filming_status === "unassigned").length
    : 0;

  function handleAssignFilmerClick() {
    if (!selectedBunch) return;
    if (filmers.length === 0) {
      addToast(
        winnerVideoLocalToast(
          `ws-film-${Date.now()}`,
          "No filmers available",
          "Grant filming:view_assignments to a user in Roles first.",
          "high",
        ),
      );
      return;
    }
    if (!scriptsReady && !selectedBunch.assigned_filmer_id) {
      addToast(
        winnerVideoLocalToast(
          `ws-film-${Date.now()}`,
          "Scripts not ready",
          "Every filled slot needs an approved script before assigning a filmer.",
          "high",
        ),
      );
      return;
    }
    setShowAssignPicker(false);
    setShowFilmerPicker((v) => !v);
  }

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
              Content · Production
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white md:text-4xl">Bunches</h1>
            <p className="mt-2 max-w-xl text-sm text-[#B8B4B8]/70">
              Plan recreate batches, assign creatives & filmers, and track filming through upload.
            </p>
            <p className="mt-3 text-xs text-[#B8B4B8]/45">
              Source winners in{" "}
              <Link href={ROUTES.admin.winnerVideosHub} className="text-[#FF1493]/90 hover:underline">
                Winner Videos Hub
              </Link>
              .
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void refreshAll()}
              disabled={refreshing}
              className={cn(VA_BTN_SECONDARY, "inline-flex items-center gap-2 px-4 py-2.5 text-sm disabled:opacity-40")}
            >
              <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
              Refresh
            </button>
            <button
              type="button"
              onClick={() => setShowCreate((v) => !v)}
              className={cn(VA_BTN_PRIMARY, "inline-flex items-center gap-2 px-4 py-2.5 text-sm")}
            >
              <FolderPlus className="h-4 w-4" />
              Create bunch
            </button>
          </div>
        </div>
        <div className="relative mt-6 flex flex-wrap gap-3">
          <StatChip label="Total" value={bunches.length} />
          <StatChip label="Open" value={openCount} accent />
          {canManageFilming ? <StatChip label="Unassigned filming" value={filmingReadyCount} /> : null}
        </div>
      </div>

      <AnimatePresence>
        {showCreate ? (
          <motion.form
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            onSubmit={(e) => void createBunch(e)}
            className={cn(VA_CARD, "grid gap-3 p-5 sm:grid-cols-2")}
          >
            <label className="space-y-1.5 sm:col-span-2">
              <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#D4AF8C]/70">
                Name
              </span>
              <input
                className={cn(VA_FILTER_INPUT, "w-full")}
                value={bunchName}
                onChange={(e) => setBunchName(e.target.value)}
                placeholder="e.g. Maya March Recreates"
                required
              />
            </label>
            <label className="space-y-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#D4AF8C]/70">
                Model
              </span>
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
                className={cn(VA_BTN_PRIMARY, "inline-flex items-center gap-2 disabled:opacity-40")}
              >
                {busyId === "create-bunch" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                Create
              </button>
            </div>
          </motion.form>
        ) : null}
      </AnimatePresence>

      <div className={cn(VA_CARD, "space-y-3 p-4")}>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <label className="relative block min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#B8B4B8]/35" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search bunches, models, assignees…"
              className={cn(VA_FILTER_INPUT, "w-full pl-9")}
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as "all" | "open" | "closed")}
              className={cn(VA_FILTER_INPUT, "min-w-[7.5rem]")}
            >
              <option value="all">All status</option>
              <option value="open">Open</option>
              <option value="closed">Closed</option>
            </select>
            <select
              value={modelFilter}
              onChange={(e) => setModelFilter(e.target.value)}
              className={cn(VA_FILTER_INPUT, "min-w-[8rem]")}
            >
              <option value="all">All models</option>
              {models.map((m) => (
                <option key={m.model_id} value={m.model_id}>
                  {m.model_name}
                </option>
              ))}
            </select>
            {canManageFilming ? (
              <select
                value={filmingFilter}
                onChange={(e) => setFilmingFilter(e.target.value as "all" | FilmingStatus)}
                className={cn(VA_FILTER_INPUT, "min-w-[8rem]")}
              >
                {FILMING_FILTERS.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </select>
            ) : null}
            <select
              value={creativeFilter}
              onChange={(e) => setCreativeFilter(e.target.value)}
              className={cn(VA_FILTER_INPUT, "min-w-[8rem]")}
            >
              <option value="all">All creatives</option>
              <option value="__none__">No creative</option>
              {creatives.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            {canManageFilming ? (
              <select
                value={filmerFilter}
                onChange={(e) => setFilmerFilter(e.target.value)}
                className={cn(VA_FILTER_INPUT, "min-w-[8rem]")}
              >
                <option value="all">All filmers</option>
                <option value="__none__">No filmer</option>
                {filmers.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            ) : null}
          </div>
        </div>
        <p className="text-xs text-[#B8B4B8]/45">
          {filtered.length} bunch{filtered.length === 1 ? "" : "es"}
          {filtered.length !== bunches.length ? ` (of ${bunches.length})` : ""}
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
        <div className="space-y-3">
          {paginated.length === 0 ? (
            <div className={cn(VA_CARD, "px-5 py-14 text-center text-sm text-[#B8B4B8]/50")}>
              {bunches.length === 0 ? "No bunches yet — create one to get started." : "No matches for these filters."}
            </div>
          ) : (
            <ul className="space-y-3">
              {paginated.map((b) => {
                const provided = b.provided_count ?? 0;
                const pending = b.pending_review_count ?? 0;
                const remaining =
                  b.remaining_count ?? Math.max(0, b.target_video_count - provided - pending);
                const occupied = provided + pending;
                const pct = Math.min(100, Math.round((occupied / Math.max(1, b.target_video_count)) * 100));
                const creativeLabel = b.assigned_creative_name?.trim();
                const filmerLabel = b.assigned_filmer_name?.trim();
                const fp = filmingProgress[b.id];
                const filmSt = FILMING_STATUS_STYLES[b.filming_status] ?? FILMING_STATUS_STYLES.unassigned;
                return (
                  <li key={b.id}>
                    <button
                      type="button"
                      onClick={() => void loadBunchSlots(b.id)}
                      className={cn(
                        VA_CARD,
                        "w-full p-4 text-left transition",
                        selectedBunchId === b.id && "border-[#FF1493]/35 ring-1 ring-[#FF1493]/20",
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-medium text-white">{b.name}</p>
                          <p className="mt-0.5 text-xs text-[#B8B4B8]/55">
                            {b.model_name} · {b.status}
                            <span className="text-[#B8B4B8]/35"> · {formatBunchDate(b.updated_at || b.created_at)}</span>
                          </p>
                          <p className="mt-1.5 text-[11px] text-[#B8B4B8]/45">
                            Filled {provided} · Pending {pending} · Needed {remaining}
                          </p>
                          <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
                            <span className="inline-flex items-center gap-1 text-[#D4AF8C]/85">
                              <UserRound className="h-3 w-3 opacity-70" />
                              {creativeLabel || "No creative"}
                            </span>
                            {canManageFilming ? (
                              <>
                                <span className={cn(VA_STATUS_BADGE, filmSt.className)}>{filmSt.label}</span>
                                <span className="text-[#B8B4B8]/55">
                                  {filmerLabel ? `Filmer: ${filmerLabel}` : "No filmer"}
                                </span>
                                {fp && fp.filmable_count > 0 ? (
                                  <span className="text-[#D4AF8C]/80">
                                    · {fp.filmed_count}/{fp.filmable_count} filmed
                                  </span>
                                ) : null}
                              </>
                            ) : null}
                          </div>
                        </div>
                        <span className="shrink-0 text-xs tabular-nums text-[#D4AF8C]">
                          {occupied}/{b.target_video_count}
                        </span>
                      </div>
                      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/5">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-[#FF1493] to-[#D4AF8C]"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          <PaginationControls
            page={page}
            totalPages={totalPages}
            onPage={setPage}
            totalItems={filtered.length}
            pageSize={PAGE_SIZE}
          />
        </div>

        <div className={cn(VA_CARD, "min-h-[320px] p-4")}>
          {!selectedBunchId || !selectedBunch ? (
            <div className="flex h-full min-h-[280px] flex-col items-center justify-center gap-2 text-sm text-[#B8B4B8]/45">
              <Users className="h-8 w-8 opacity-40" />
              Select a bunch to view slots and assign staff
            </div>
          ) : loadingSlots ? (
            <div className="flex min-h-[280px] items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-[#FF1493]" />
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-white">{selectedBunch.name}</h3>
                  <p className="mt-0.5 text-xs text-[#B8B4B8]/55">
                    {selectedBunch.model_name} · Slots ({slots.length})
                    {selectedBunch.assigned_creative_name?.trim()
                      ? ` · Creative: ${selectedBunch.assigned_creative_name}`
                      : " · No creative yet"}
                    {selectedBunch.assigned_filmer_name?.trim()
                      ? ` · Filmer: ${selectedBunch.assigned_filmer_name}`
                      : ""}
                  </p>
                  {selectedProgress && selectedProgress.filmable_count > 0 ? (
                    <p className="mt-1 text-[11px] text-[#D4AF8C]/75">
                      Filming {selectedProgress.filmed_count} of {selectedProgress.filmable_count}
                      {selectedBunch.filming_status === "uploaded" && selectedBunch.upload_folder_link ? (
                        <>
                          {" · "}
                          <a
                            href={selectedBunch.upload_folder_link}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[#FF1493] hover:underline"
                          >
                            Upload folder
                          </a>
                        </>
                      ) : null}
                    </p>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className={cn(
                      VA_BTN_SECONDARY,
                      "inline-flex items-center gap-1.5 px-3 py-1.5 text-xs disabled:opacity-40",
                    )}
                    onClick={() => {
                      setShowFilmerPicker(false);
                      setShowAssignPicker((v) => !v);
                    }}
                    disabled={busyId === selectedBunch.id || creatives.length === 0}
                  >
                    {busyId === selectedBunch.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <UserRound className="h-3.5 w-3.5" />
                    )}
                    {selectedBunch.assigned_creative_id ? "Re-assign creative" : "Assign creative"}
                  </button>
                  {canManageFilming ? (
                    <button
                      type="button"
                      className={cn(
                        VA_BTN_SECONDARY,
                        "inline-flex items-center gap-1.5 px-3 py-1.5 text-xs",
                        (busyId === `filmer-${selectedBunch.id}` ||
                          (!scriptsReady && !selectedBunch.assigned_filmer_id) ||
                          filmers.length === 0) &&
                          "opacity-50",
                      )}
                      onClick={handleAssignFilmerClick}
                      disabled={busyId === `filmer-${selectedBunch.id}`}
                      title={
                        !scriptsReady && !selectedBunch.assigned_filmer_id
                          ? "All scripts must be approved first"
                          : filmers.length === 0
                            ? "No filmers with filming:view_assignments"
                            : undefined
                      }
                    >
                      {busyId === `filmer-${selectedBunch.id}` ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Sparkles className="h-3.5 w-3.5" />
                      )}
                      {selectedBunch.assigned_filmer_id ? "Re-assign filmer" : "Assign filmer"}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="rounded-xl px-3 py-1.5 text-[10px] font-medium uppercase tracking-wider text-[#B8B4B8]/50 hover:text-[#D4AF8C]"
                    onClick={() =>
                      void toggleBunchStatus(
                        selectedBunch.id,
                        selectedBunch.status === "open" ? "closed" : "open",
                      )
                    }
                  >
                    {selectedBunch.status === "open" ? "Close bunch" : "Reopen bunch"}
                  </button>
                </div>
              </div>

              {creatives.length === 0 ? (
                <p className="rounded-lg border border-amber-500/25 bg-amber-500/8 px-3 py-2 text-xs text-amber-200">
                  No Creatives available — grant creative_scripts:submit to a user first.
                </p>
              ) : null}

              {canManageFilming && filmers.length === 0 ? (
                <p className="rounded-lg border border-amber-500/25 bg-amber-500/8 px-3 py-2 text-xs text-amber-200">
                  No Filmers available — grant filming:view_assignments to a user first.
                </p>
              ) : null}

              {canManageFilming && !scriptsReady && !selectedBunch.assigned_filmer_id && slots.length > 0 ? (
                <p className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-[#B8B4B8]/65">
                  Assign filmer unlocks when every filled slot has an approved script.
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
                    name="bunch-assign-creative"
                    singleSelect
                    selectedIds={
                      selectedBunch.assigned_creative_id ? [selectedBunch.assigned_creative_id] : []
                    }
                    onChange={(ids) => {
                      const next = ids[0];
                      if (!next || next === selectedBunch.assigned_creative_id) return;
                      setShowAssignPicker(false);
                      void assignCreativeToBunch(selectedBunch.id, next);
                    }}
                  />
                </div>
              ) : null}

              {showFilmerPicker && canManageFilming && filmers.length > 0 ? (
                <div className="rounded-xl border border-white/[0.08] bg-[#0A0A0A]/70 p-3">
                  <p className="mb-2 text-[11px] text-[#B8B4B8]/55">
                    Filmer sees this bunch under Shoot Assignments after assignment.
                  </p>
                  <StaffAssigneePicker
                    users={staffFilmers}
                    roleLabels={{}}
                    name="bunch-assign-filmer"
                    singleSelect
                    selectedIds={
                      selectedBunch.assigned_filmer_id ? [selectedBunch.assigned_filmer_id] : []
                    }
                    onChange={(ids) => {
                      const next = ids[0];
                      if (!next || next === selectedBunch.assigned_filmer_id) return;
                      setShowFilmerPicker(false);
                      void assignFilmerToBunch(selectedBunch.id, next);
                    }}
                  />
                </div>
              ) : null}

              {slots.length === 0 ? (
                <p className="text-sm text-[#B8B4B8]/50">
                  No slots yet — assign queue items from{" "}
                  <Link href={ROUTES.admin.winnerVideosHub} className="text-[#FF1493] hover:underline">
                    Winner Videos Hub
                  </Link>{" "}
                  or wait for researchers.
                </p>
              ) : (
                <ul className="max-h-[560px] space-y-2 overflow-y-auto pr-1">
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
                          {slot.filmed ? (
                            <span className={cn(VA_STATUS_BADGE, "bg-emerald-500/15 text-emerald-300")}>
                              Filmed
                            </span>
                          ) : null}
                          <span className="text-[10px] uppercase tracking-wider text-[#B8B4B8]/40">
                            {slot.source === "from_winner" ? "from winner" : "researcher"}
                          </span>
                        </div>
                        <p className="mt-1.5 line-clamp-2 text-xs text-[#B8B4B8]/75">
                          {slot.description || "—"}
                        </p>
                        {slot.video_link ? (
                          <a
                            href={slot.video_link}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-1 inline-flex items-center gap-1 text-[11px] text-[#FF1493]/90 hover:underline"
                          >
                            Source <ExternalLink className="h-3 w-3" />
                          </a>
                        ) : null}
                        {scriptOwner ? (
                          <p className="mt-1 text-[10px] text-[#B8B4B8]/45">Script: {scriptOwner}</p>
                        ) : null}
                        <label className="mt-2 block space-y-1">
                          <span className="text-[10px] uppercase tracking-wider text-[#B8B4B8]/40">
                            Video type
                          </span>
                          <select
                            className={cn(VA_FILTER_INPUT, "w-full py-1.5 text-xs")}
                            value={slot.video_type || ""}
                            disabled={busyId === slot.id}
                            onChange={(e) => {
                              const v = e.target.value as SlotVideoType | "";
                              void updateSlotType(slot.id, v);
                            }}
                          >
                            <option value="">Unset</option>
                            {SLOT_VIDEO_TYPES.map((t) => (
                              <option key={t} value={t}>
                                {SLOT_VIDEO_TYPE_LABELS[t]}
                              </option>
                            ))}
                          </select>
                        </label>
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

function StatChip({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div
      className={cn(
        "rounded-2xl border px-4 py-2.5",
        accent
          ? "border-[#FF1493]/25 bg-[#FF1493]/10"
          : "border-white/[0.08] bg-white/[0.03]",
      )}
    >
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#B8B4B8]/45">{label}</p>
      <p className={cn("mt-0.5 text-xl font-semibold tabular-nums", accent ? "text-[#FF1493]" : "text-white")}>
        {value}
      </p>
    </div>
  );
}
