"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Check,
  ExternalLink,
  FolderOpen,
  Loader2,
  RefreshCw,
  Search,
  Trophy,
  UserRound,
  X,
} from "lucide-react";
import Link from "next/link";
import {
  AttachmentLinks,
  DashPlaceholder,
  FilterBar,
  FilterChip,
  FindingCard,
  ManagerReviewSelect,
  ManagerReviewTextarea,
  QuickActionEscalate,
  QuickActionMarkFixed,
  ReviewEmptyState,
  ReviewFieldLabel,
  ReviewFormSection,
  ReviewLoadingState,
  ReviewModalShell,
  VA_BTN_PRIMARY,
  VA_BTN_SECONDARY,
  VA_FILTER_INPUT,
  WinnerVideoStatusBadge,
  displayOrDash,
  type CustomSelectOption,
} from "@/components/manager-review-ui";
import {
  QualityRatingBadge,
  QualityRatingPicker,
  ResearchBunchLink,
  ResearchDisplayVideoTypeBadge,
  ResearchSourceBadge,
  WinnerVideoCopyButton,
  WinnerVideoKanbanBoard,
  WinnerVideoRefreshButton,
  WinnerVideoSubmissionsToolbar,
  useWinnerVideoCopy,
  winnerVideoLocalToast,
} from "@/components/winner-videos-shared";
import { StaffAssigneePicker, type StaffUserOption } from "@/components/staff-assignee-picker";
import { CountUp, InflowwCustomDateRange, LuxuryStatCard } from "@/components/infloww-performance-ui";
import { useToast } from "@/contexts/toast-context";
import { formatDateOnlyEuropean, formatDateTimeAthens } from "@/lib/format";
import {
  RESEARCH_DISPLAY_VIDEO_TYPE_OPTIONS,
  RESEARCH_SOURCE_FILTER_OPTIONS,
  WINNER_VIDEO_DATE_RANGE_OPTIONS,
  filterWinnerVideosClient,
  groupWinnerVideosByBunch,
  groupWinnerVideosByStatus,
  isStalePending,
  pendingAgeLabel,
  researchDisplayVideoType,
  researchManageStats,
  researchSourceLabel,
  slotTypeFromResearchDisplay,
  sortResearchManageVideos,
  type ResearchDisplayVideoType,
  type ResearchSubmissionSource,
  type WinnerVideoDateRange,
  type WinnerVideoViewMode,
} from "@/lib/winner-videos-filters";
import {
  SLOT_VIDEO_TYPES,
  SLOT_VIDEO_TYPE_LABELS,
  type SlotVideoType,
} from "@/lib/winner-sourcing-helpers";
import {
  WINNER_VIDEO_STATUSES,
  qualityRatingEmoji,
  type WinnerVideoQualityRating,
  type WinnerVideoStatus,
} from "@/lib/winner-videos-helpers";
import { ROUTES } from "@/lib/routes";
import { VA_BTN_SECONDARY as VA_SECONDARY, VA_CARD, VA_CARD_GLOW } from "@/lib/va-tasks-tokens";
import { cn } from "@/lib/utils";
import type { WinnerVideoRecord } from "@/services/winner-videos";
import type { VideoBunch } from "@/services/winner-sourcing";
import type { ModelRecord } from "@/types";
import { AdminCreativeScriptsReview } from "@/components/admin-creative-scripts-review";
import { useIsSupabaseBackend } from "@/contexts/data-backend-context";
import { useSupabaseRealtimeRefresh } from "@/lib/hooks/use-supabase-realtime";

type AdminTab = "submissions" | "scripts";
type StatusTab = WinnerVideoStatus | "all";

export type CreativeOption = {
  id: string;
  name: string;
  email?: string;
  role?: string;
};

type FilterDraft = {
  statusTab: StatusTab;
  videoType: ResearchDisplayVideoType | "";
  source: ResearchSubmissionSource | "";
  modelId: string;
  bunchId: string;
  submitterId: string;
  search: string;
  dateRange: WinnerVideoDateRange;
  dateFrom: string;
  dateTo: string;
};

const EMPTY_FILTERS: FilterDraft = {
  statusTab: "Pending",
  videoType: "",
  source: "",
  modelId: "",
  bunchId: "",
  submitterId: "",
  search: "",
  dateRange: "all",
  dateFrom: "",
  dateTo: "",
};

type Props = {
  initialVideos: WinnerVideoRecord[];
  initialPendingScripts?: WinnerVideoRecord[];
  initialBunches?: VideoBunch[];
  gunzoModels: ModelRecord[];
  creatives?: CreativeOption[];
  canManageScripts?: boolean;
  canAssignCreative?: boolean;
};

export function AdminWinnerVideosClient({
  initialVideos,
  initialPendingScripts = [],
  initialBunches = [],
  gunzoModels,
  creatives = [],
  canManageScripts = false,
  canAssignCreative = false,
}: Props) {
  const { addToast } = useToast();
  const isSupabaseBackend = useIsSupabaseBackend();
  const copySubmission = useWinnerVideoCopy(addToast);
  const [videos, setVideos] = React.useState(initialVideos);
  const [bunches, setBunches] = React.useState(initialBunches);
  const [loading, setLoading] = React.useState(false);
  const [pendingId, setPendingId] = React.useState<string | null>(null);
  const [viewMode, setViewMode] = React.useState<WinnerVideoViewMode>("list");
  const [adminTab, setAdminTab] = React.useState<AdminTab>("submissions");
  const [assignPickerBunchId, setAssignPickerBunchId] = React.useState<string | null>(null);

  const [draft, setDraft] = React.useState<FilterDraft>(EMPTY_FILTERS);
  const [applied, setApplied] = React.useState<FilterDraft>(EMPTY_FILTERS);

  const [approveId, setApproveId] = React.useState<string | null>(null);
  const [rejectId, setRejectId] = React.useState<string | null>(null);
  const [creatorId, setCreatorId] = React.useState("");
  const [deadline, setDeadline] = React.useState("");
  const [rejectReason, setRejectReason] = React.useState("");
  const [qualityRating, setQualityRating] = React.useState<WinnerVideoQualityRating | null>(null);

  React.useEffect(() => setVideos(initialVideos), [initialVideos]);
  React.useEffect(() => setBunches(initialBunches), [initialBunches]);

  const bunchById = React.useMemo(() => {
    const map = new Map<string, VideoBunch>();
    for (const b of bunches) map.set(b.id, b);
    return map;
  }, [bunches]);

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

  const modelOptions = React.useMemo<CustomSelectOption[]>(
    () => [
      { value: "", label: "Select Gunzo-team creator…" },
      ...gunzoModels.map((m) => ({ value: m.id, label: m.model_name })),
    ],
    [gunzoModels],
  );

  const selectedCreatorName = React.useMemo(
    () => gunzoModels.find((m) => m.id === creatorId)?.model_name ?? "",
    [gunzoModels, creatorId],
  );

  const filterModelOptions = React.useMemo<CustomSelectOption[]>(() => {
    const fromVideos = new Map<string, string>();
    for (const v of videos) {
      const id = v.reference_model_id?.trim();
      const name = v.reference_model_name?.trim();
      if (id && name) fromVideos.set(id, name);
      else if (name) fromVideos.set(`name:${name.toLowerCase()}`, name);
    }
    for (const m of gunzoModels) {
      if (m.id && m.model_name) fromVideos.set(m.id, m.model_name);
    }
    return [
      { value: "", label: "All models" },
      ...[...fromVideos.entries()]
        .map(([value, label]) => ({ value, label }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    ];
  }, [videos, gunzoModels]);

  const filterBunchOptions = React.useMemo<CustomSelectOption[]>(() => {
    const map = new Map<string, string>();
    for (const v of videos) {
      if (v.bunch_id?.trim()) map.set(v.bunch_id, v.bunch_name?.trim() || "Unnamed bunch");
    }
    return [
      { value: "", label: "All bunches" },
      ...[...map.entries()]
        .map(([value, label]) => ({ value, label }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    ];
  }, [videos]);

  const filterSubmitterOptions = React.useMemo<CustomSelectOption[]>(() => {
    const map = new Map<string, string>();
    for (const v of videos) {
      if (v.submitted_by_id?.trim()) {
        map.set(v.submitted_by_id, v.submitted_by_name?.trim() || "Unknown");
      }
    }
    return [
      { value: "", label: "All submitters" },
      ...[...map.entries()]
        .map(([value, label]) => ({ value, label }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    ];
  }, [videos]);

  async function reload() {
    setLoading(true);
    try {
      const [videosRes, bunchesRes] = await Promise.all([
        fetch(`/api/admin/winner-videos`, { credentials: "include" }),
        fetch(`/api/winner-sourcing/bunches`, { credentials: "include" }),
      ]);
      const videosData = (await videosRes.json()) as { videos?: WinnerVideoRecord[] };
      if (videosRes.ok) setVideos(videosData.videos ?? []);
      if (bunchesRes.ok) {
        const bunchesData = (await bunchesRes.json()) as { bunches?: VideoBunch[] };
        setBunches(bunchesData.bunches ?? []);
      }
    } finally {
      setLoading(false);
    }
  }

  async function assignCreativeToBunch(bunchId: string, creativeId: string) {
    const creative = creatives.find((c) => c.id === creativeId);
    if (!creative) return;
    setPendingId(bunchId);
    try {
      const res = await fetch(`/api/winner-sourcing/bunches/${encodeURIComponent(bunchId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          action: "assign_creative",
          assigned_creative_id: creative.id,
          assigned_creative_name: creative.name,
        }),
      });
      const data = (await res.json()) as {
        bunch?: VideoBunch;
        updated_slots?: unknown[];
        skipped_slots?: number;
        error?: string;
      };
      if (!res.ok || !data.bunch) {
        addToast(
          winnerVideoLocalToast(
            `wv-assign-${Date.now()}`,
            "Assign failed",
            data.error ?? "Could not assign creative",
            "high",
          ),
        );
        return;
      }
      setBunches((prev) => prev.map((b) => (b.id === bunchId ? { ...b, ...data.bunch! } : b)));
      const updated = data.updated_slots?.length ?? 0;
      const skipped = data.skipped_slots ?? 0;
      addToast(
        winnerVideoLocalToast(
          `wv-assign-ok-${Date.now()}`,
          "Bunch assigned to creative",
          `${creative.name} · ${updated} slot${updated === 1 ? "" : "s"} updated${skipped ? ` · ${skipped} kept historical` : ""}`,
          "normal",
        ),
      );
      setAssignPickerBunchId(null);
    } finally {
      setPendingId(null);
    }
  }

  const reloadRef = React.useRef(reload);
  reloadRef.current = reload;

  React.useEffect(() => {
    if (isSupabaseBackend) return;
    const id = window.setInterval(() => {
      void reloadRef.current();
    }, 60_000);
    return () => window.clearInterval(id);
  }, [isSupabaseBackend]);

  useSupabaseRealtimeRefresh(["winner_videos"], () => void reloadRef.current(), { debounceMs: 600 });

  const stats = React.useMemo(() => researchManageStats(videos), [videos]);
  const statusCounts = React.useMemo(() => groupWinnerVideosByStatus(videos), [videos]);

  const filtered = React.useMemo(() => {
    const modelOpt = filterModelOptions.find((o) => o.value === applied.modelId);
    const modelId =
      applied.modelId.startsWith("name:") ? "" : applied.modelId;
    const modelName = applied.modelId.startsWith("name:")
      ? (modelOpt?.label ?? "")
      : "";

    return sortResearchManageVideos(
      filterWinnerVideosClient(videos, {
        status: applied.statusTab === "all" ? "" : applied.statusTab,
        videoType: applied.videoType,
        source: applied.source,
        modelId,
        modelName,
        bunchId: applied.bunchId,
        submitterId: applied.submitterId,
        search: applied.search,
        dateRange: applied.dateRange,
        dateFrom: applied.dateFrom,
        dateTo: applied.dateTo,
      }),
    );
  }, [videos, applied, filterModelOptions]);

  const groupedByBunch = React.useMemo(() => groupWinnerVideosByBunch(filtered), [filtered]);

  const hasActiveFilters = React.useMemo(() => {
    return Boolean(
      applied.videoType ||
        applied.source ||
        applied.modelId ||
        applied.bunchId ||
        applied.submitterId ||
        applied.search.trim() ||
        applied.dateRange !== "all",
    );
  }, [applied]);

  function applyFilters() {
    setApplied({ ...draft });
  }

  function clearFilters() {
    setDraft(EMPTY_FILTERS);
    setApplied(EMPTY_FILTERS);
  }

  function patchDraft<K extends keyof FilterDraft>(key: K, value: FilterDraft[K]) {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }

  async function patchVideo(id: string, body: Record<string, unknown>) {
    setPendingId(id);
    try {
      const res = await fetch(`/api/admin/winner-videos/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as { video?: WinnerVideoRecord; error?: string };
      if (!res.ok || !data.video) {
        addToast(winnerVideoLocalToast(`wv-adm-${Date.now()}`, "Update failed", data.error ?? "Could not update", "high"));
        return false;
      }
      setVideos((prev) => prev.map((v) => (v.id === id ? data.video! : v)));
      return true;
    } finally {
      setPendingId(null);
    }
  }

  function openApprove(video: WinnerVideoRecord) {
    setApproveId(video.id);
    if (video.bunch_id?.trim()) {
      setCreatorId("");
    } else {
      const match = gunzoModels.find(
        (m) => m.id === video.reference_model_id || m.model_name === video.reference_model_name,
      );
      setCreatorId(match?.id ?? "");
    }
    setDeadline("");
    setQualityRating(null);
  }

  const approveTarget = videos.find((v) => v.id === approveId) ?? null;
  const approveBunch = approveTarget?.bunch_id
    ? (bunchById.get(approveTarget.bunch_id) ?? null)
    : null;
  const approveInheritedModel =
    approveBunch?.model_name?.trim() ||
    approveTarget?.reference_model_name?.trim() ||
    "";
  const approveInheritedCreative =
    approveBunch?.assigned_creative_name?.trim() ||
    approveTarget?.assigned_creative_name?.trim() ||
    "";
  const isBunchApprove = Boolean(approveTarget?.bunch_id?.trim());

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
              Content · Q/A
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white md:text-4xl">
              Content Q/A
            </h1>
            <p className="mt-2 max-w-xl text-sm text-[#B8B4B8]/70">
              Approve or reject Fill Bunches finds and research submissions. Approving a bunch fill
              spawns a recreate slot into that bunch.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void reload()}
            disabled={loading}
            className={cn(VA_SECONDARY, "inline-flex items-center gap-2 px-4 py-2.5 text-sm")}
          >
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
            Refresh
          </button>
        </div>

        <div className="relative mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <LuxuryStatCard
            label="Pending"
            value={<CountUp value={stats.pending} format={(n) => String(Math.round(n))} />}
            accent="amber"
            glow
            tooltip="Submissions awaiting approve or reject. Oldest pending appear first."
          />
          <LuxuryStatCard
            label="Bunch fills pending"
            value={<CountUp value={stats.pendingBunch} format={(n) => String(Math.round(n))} />}
            accent="champagne"
            tooltip="Fill Bunches researcher finds linked to a video bunch."
          />
          <LuxuryStatCard
            label="Approved today"
            value={<CountUp value={stats.approvedToday} format={(n) => String(Math.round(n))} />}
            accent="emerald"
            tooltip="Approved (or further) reviews completed today (Athens day)."
          />
          <LuxuryStatCard
            label="Rejected today"
            value={<CountUp value={stats.rejectedToday} format={(n) => String(Math.round(n))} />}
            accent="pink"
            tooltip="Rejected reviews completed today."
          />
        </div>
      </div>

      {canManageScripts ? (
        <div
          className="inline-flex rounded-2xl border border-white/[0.08] bg-[#0D0B0D]/70 p-1 shadow-[inset_0_2px_6px_rgba(0,0,0,0.35)]"
          role="tablist"
          aria-label="Research views"
        >
          {(
            [
              { id: "submissions" as const, label: "Submissions" },
              { id: "scripts" as const, label: "Scripts pending review" },
            ] as const
          ).map(({ id, label }) => {
            const active = adminTab === id;
            return (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setAdminTab(id)}
                className={cn(
                  "relative rounded-xl px-4 py-2.5 text-sm font-medium transition",
                  active ? "text-white" : "text-[#B8B4B8]/55 hover:text-[#B8B4B8]",
                )}
              >
                {active ? (
                  <motion.span
                    layoutId="research-manage-tab"
                    className="absolute inset-0 rounded-xl border border-[#FF1493]/25 bg-gradient-to-br from-[#FF1493]/25 to-[#D4AF8C]/10"
                    transition={{ type: "spring", damping: 28, stiffness: 380 }}
                  />
                ) : null}
                <span className="relative">{label}</span>
              </button>
            );
          })}
        </div>
      ) : null}

      {canManageScripts && adminTab === "scripts" ? (
        <AdminCreativeScriptsReview initialScripts={initialPendingScripts} />
      ) : (
        <>
          {/* Filters */}
          <FilterBar className={cn(VA_CARD, VA_CARD_GLOW)}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#D4AF8C]/70">
                  Filters
                </p>
                <p className="mt-0.5 text-xs text-[#B8B4B8]/45">
                  Narrow by model, bunch, submitter, tier, type, or date — then Apply.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={clearFilters} className={cn(VA_BTN_SECONDARY, "px-4 py-2 text-xs")}>
                  Clear
                </button>
                <button type="button" onClick={applyFilters} className={cn(VA_BTN_PRIMARY, "px-4 py-2 text-xs")}>
                  Apply filters
                </button>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              <div className="space-y-1.5 sm:col-span-2 lg:col-span-1">
                <ReviewFieldLabel>Search</ReviewFieldLabel>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#B8B4B8]/40" />
                  <input
                    value={draft.search}
                    onChange={(e) => patchDraft("search", e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") applyFilters();
                    }}
                    placeholder="Description or submitter…"
                    className={cn(VA_FILTER_INPUT, "w-full pl-9")}
                    aria-label="Search description or submitter"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <ReviewFieldLabel>Model / creator</ReviewFieldLabel>
                <ManagerReviewSelect
                  value={draft.modelId}
                  onChange={(v) => patchDraft("modelId", v)}
                  options={filterModelOptions}
                  searchable
                  searchPlaceholder="Search models…"
                  aria-label="Filter by model"
                />
              </div>

              <div className="space-y-1.5">
                <ReviewFieldLabel>Bunch</ReviewFieldLabel>
                <ManagerReviewSelect
                  value={draft.bunchId}
                  onChange={(v) => patchDraft("bunchId", v)}
                  options={filterBunchOptions}
                  searchable
                  searchPlaceholder="Search bunches…"
                  aria-label="Filter by bunch"
                />
              </div>

              <div className="space-y-1.5">
                <ReviewFieldLabel>Submitter</ReviewFieldLabel>
                <ManagerReviewSelect
                  value={draft.submitterId}
                  onChange={(v) => patchDraft("submitterId", v)}
                  options={filterSubmitterOptions}
                  searchable
                  searchPlaceholder="Search submitters…"
                  aria-label="Filter by submitter"
                />
              </div>

              <div className="space-y-1.5">
                <ReviewFieldLabel>Tier / source</ReviewFieldLabel>
                <ManagerReviewSelect
                  value={draft.source}
                  onChange={(v) => patchDraft("source", v as ResearchSubmissionSource | "")}
                  options={RESEARCH_SOURCE_FILTER_OPTIONS}
                  aria-label="Filter by tier"
                />
              </div>

              <div className="space-y-1.5">
                <ReviewFieldLabel>Video type</ReviewFieldLabel>
                <ManagerReviewSelect
                  value={draft.videoType}
                  onChange={(v) => patchDraft("videoType", v as ResearchDisplayVideoType | "")}
                  options={RESEARCH_DISPLAY_VIDEO_TYPE_OPTIONS}
                  aria-label="Filter by video type"
                />
              </div>

              <div className="space-y-1.5">
                <ReviewFieldLabel>Date range</ReviewFieldLabel>
                <ManagerReviewSelect
                  value={draft.dateRange}
                  onChange={(v) => patchDraft("dateRange", v as WinnerVideoDateRange)}
                  options={WINNER_VIDEO_DATE_RANGE_OPTIONS}
                  aria-label="Date range"
                />
              </div>
            </div>

            {draft.dateRange === "custom" ? (
              <InflowwCustomDateRange
                startYmd={draft.dateFrom}
                endYmd={draft.dateTo}
                loading={loading}
                onChange={(start, end) => {
                  setDraft((prev) => ({ ...prev, dateFrom: start, dateTo: end }));
                }}
                onApply={(start, end) => {
                  setDraft((prev) => ({ ...prev, dateFrom: start, dateTo: end, dateRange: "custom" }));
                  setApplied((prev) => ({ ...prev, dateFrom: start, dateTo: end, dateRange: "custom" }));
                }}
              />
            ) : null}

            {hasActiveFilters ? (
              <div className="flex flex-wrap items-center gap-2">
                {applied.search.trim() ? (
                  <FilterChip
                    label={`Search: ${applied.search.trim()}`}
                    onRemove={() => {
                      patchDraft("search", "");
                      setApplied((p) => ({ ...p, search: "" }));
                    }}
                  />
                ) : null}
                {applied.modelId ? (
                  <FilterChip
                    label={`Model: ${filterModelOptions.find((o) => o.value === applied.modelId)?.label ?? applied.modelId}`}
                    onRemove={() => {
                      patchDraft("modelId", "");
                      setApplied((p) => ({ ...p, modelId: "" }));
                    }}
                  />
                ) : null}
                {applied.bunchId ? (
                  <FilterChip
                    label={`Bunch: ${filterBunchOptions.find((o) => o.value === applied.bunchId)?.label ?? applied.bunchId}`}
                    onRemove={() => {
                      patchDraft("bunchId", "");
                      setApplied((p) => ({ ...p, bunchId: "" }));
                    }}
                  />
                ) : null}
                {applied.submitterId ? (
                  <FilterChip
                    label={`Submitter: ${filterSubmitterOptions.find((o) => o.value === applied.submitterId)?.label ?? applied.submitterId}`}
                    onRemove={() => {
                      patchDraft("submitterId", "");
                      setApplied((p) => ({ ...p, submitterId: "" }));
                    }}
                  />
                ) : null}
                {applied.source ? (
                  <FilterChip
                    label={`Tier: ${researchSourceLabel(applied.source)}`}
                    onRemove={() => {
                      patchDraft("source", "");
                      setApplied((p) => ({ ...p, source: "" }));
                    }}
                  />
                ) : null}
                {applied.videoType ? (
                  <FilterChip
                    label={`Type: ${applied.videoType}`}
                    onRemove={() => {
                      patchDraft("videoType", "");
                      setApplied((p) => ({ ...p, videoType: "" }));
                    }}
                  />
                ) : null}
                {applied.dateRange !== "all" ? (
                  <FilterChip
                    label={
                      applied.dateRange === "custom" && (applied.dateFrom || applied.dateTo)
                        ? `${applied.dateFrom || "…"} → ${applied.dateTo || "…"}`
                        : applied.dateRange === "7d"
                          ? "Last 7 days"
                          : "Last 30 days"
                    }
                    onRemove={() => {
                      setDraft((p) => ({ ...p, dateRange: "all", dateFrom: "", dateTo: "" }));
                      setApplied((p) => ({ ...p, dateRange: "all", dateFrom: "", dateTo: "" }));
                    }}
                  />
                ) : null}
              </div>
            ) : null}
          </FilterBar>

          {/* Status tabs + toolbar */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div
              className="flex flex-wrap gap-1 rounded-2xl border border-white/[0.06] bg-[#0D0B0D]/80 p-1.5"
              role="tablist"
              aria-label="Status"
            >
              {(
                [
                  { id: "all" as const, label: "All", count: videos.length },
                  ...WINNER_VIDEO_STATUSES.map((s) => ({
                    id: s as StatusTab,
                    label: s,
                    count: statusCounts[s].length,
                  })),
                ] as const
              ).map((tab) => {
                const active = applied.statusTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => {
                      patchDraft("statusTab", tab.id);
                      setApplied((p) => ({ ...p, statusTab: tab.id }));
                    }}
                    className={cn(
                      "relative inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium transition sm:text-sm",
                      active ? "text-white" : "text-[#B8B4B8]/55 hover:text-[#B8B4B8]",
                    )}
                  >
                    {active ? (
                      <motion.span
                        layoutId="research-status-tab"
                        className="absolute inset-0 rounded-xl border border-[#FF1493]/25 bg-gradient-to-br from-[#FF1493]/20 to-[#D4AF8C]/8"
                        transition={{ type: "spring", damping: 28, stiffness: 380 }}
                      />
                    ) : null}
                    <span className="relative">{tab.label}</span>
                    <span
                      className={cn(
                        "relative rounded-md px-1.5 py-0.5 text-[10px] tabular-nums",
                        active ? "bg-white/10 text-white/80" : "bg-white/5 text-[#B8B4B8]/45",
                      )}
                    >
                      {tab.count}
                    </span>
                  </button>
                );
              })}
            </div>

            <WinnerVideoSubmissionsToolbar
              viewMode={viewMode}
              onViewModeChange={setViewMode}
              videos={filtered}
              addToast={addToast}
            />
          </div>

          {loading && videos.length === 0 ? (
            <ReviewLoadingState />
          ) : filtered.length === 0 ? (
            <ReviewEmptyState
              icon={Trophy}
              title="No matching submissions"
              description={
                hasActiveFilters || applied.statusTab !== "all"
                  ? "Try clearing filters or switching status tabs."
                  : "Fill Bunches and research submissions will appear here."
              }
            />
          ) : viewMode === "board" ? (
            <WinnerVideoKanbanBoard
              videos={filtered}
              onCopy={copySubmission}
              addToast={addToast}
              onRefresh={() => void reload()}
              refreshing={loading}
              busyId={pendingId}
              onApprove={openApprove}
              onReject={(video) => {
                setRejectId(video.id);
                setRejectReason("");
              }}
              onMarkPublished={(video) => void patchVideo(video.id, { action: "status", status: "Published" })}
            />
          ) : (
            <AnimatePresence mode="wait">
              <motion.div
                key={`${applied.statusTab}-${applied.source}-${filtered.length}`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.2 }}
                className="space-y-8"
              >
                {groupedByBunch.map((group) => {
                  const bunch = group.bunchId ? bunchById.get(group.bunchId) : null;
                  const isUngrouped = !group.bunchId;
                  const modelName =
                    bunch?.model_name?.trim() ||
                    group.videos.find((v) => v.reference_model_name?.trim())?.reference_model_name?.trim() ||
                    "";
                  const provided = bunch?.provided_count ?? 0;
                  const pending = bunch?.pending_review_count ?? 0;
                  const target = bunch?.target_video_count ?? 0;
                  const remaining =
                    bunch?.remaining_count ??
                    (target > 0 ? Math.max(0, target - provided - pending) : 0);
                  const occupied = provided + pending;
                  const pct =
                    target > 0 ? Math.min(100, Math.round((occupied / target) * 100)) : 0;
                  const creativeLabel =
                    bunch?.assigned_creative_name?.trim() ||
                    group.videos.find((v) => v.assigned_creative_name?.trim())?.assigned_creative_name?.trim() ||
                    "";
                  const showAssignPicker = assignPickerBunchId === group.bunchId;

                  return (
                    <section key={group.bunchId ?? "ungrouped"} className="space-y-3">
                      <div
                        className={cn(
                          VA_CARD,
                          "space-y-3 border border-white/[0.06] p-4",
                          isUngrouped && "border-dashed border-white/[0.1]",
                        )}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0 flex-1 space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <h2 className="text-base font-semibold text-white">
                                {isUngrouped ? "Ungrouped" : group.bunchName}
                              </h2>
                              <span className="rounded-md border border-[#D4AF8C]/25 bg-[#D4AF8C]/10 px-2 py-0.5 text-[10px] tabular-nums text-[#D4AF8C]">
                                {group.videos.length}
                              </span>
                              {!isUngrouped && bunch?.status ? (
                                <span className="rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] uppercase tracking-wider text-[#B8B4B8]/55">
                                  {bunch.status}
                                </span>
                              ) : null}
                            </div>
                            {isUngrouped ? (
                              <p className="text-xs text-[#B8B4B8]/55">
                                Direct submissions without a parent bunch
                              </p>
                            ) : (
                              <>
                                <p className="text-xs text-[#B8B4B8]/65">
                                  Target model:{" "}
                                  <span className="font-medium text-[#D4AF8C]">
                                    {modelName || "—"}
                                  </span>
                                </p>
                                {target > 0 ? (
                                  <p className="text-[11px] text-[#B8B4B8]/45">
                                    Filled {provided} · Pending {pending} · Needed {remaining} ·{" "}
                                    {occupied}/{target}
                                  </p>
                                ) : null}
                                <p className="flex items-center gap-1 text-[11px] text-[#D4AF8C]/80">
                                  <UserRound className="h-3 w-3 opacity-70" aria-hidden />
                                  {creativeLabel
                                    ? `Creative: ${creativeLabel}`
                                    : "No creative assigned"}
                                </p>
                              </>
                            )}
                          </div>

                          {!isUngrouped && group.bunchId && canAssignCreative ? (
                            <button
                              type="button"
                              className={cn(
                                VA_BTN_SECONDARY,
                                "inline-flex items-center gap-1.5 px-3 py-1.5 text-xs",
                              )}
                              onClick={() =>
                                setAssignPickerBunchId((prev) =>
                                  prev === group.bunchId ? null : group.bunchId,
                                )
                              }
                              disabled={pendingId === group.bunchId || creatives.length === 0}
                            >
                              {pendingId === group.bunchId ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <UserRound className="h-3.5 w-3.5" />
                              )}
                              {bunch?.assigned_creative_id
                                ? "Change creative"
                                : "Assign creative"}
                            </button>
                          ) : null}
                        </div>

                        {!isUngrouped && target > 0 ? (
                          <div className="h-1.5 overflow-hidden rounded-full bg-white/5">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-[#FF1493] to-[#D4AF8C]"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        ) : null}

                        {showAssignPicker && group.bunchId && creatives.length > 0 ? (
                          <div className="rounded-xl border border-white/[0.08] bg-[#0A0A0A]/70 p-3">
                            <p className="mb-2 text-[11px] text-[#B8B4B8]/55">
                              Assigns the entire bunch. New slots inherit automatically. Slots already
                              submitted for review keep their historical writer.
                            </p>
                            <StaffAssigneePicker
                              users={staffCreatives}
                              roleLabels={{}}
                              singleSelect
                              selectedIds={
                                bunch?.assigned_creative_id ? [bunch.assigned_creative_id] : []
                              }
                              onChange={(ids) => {
                                const next = ids[0];
                                if (!next) return;
                                // Re-selecting the same creative re-runs propagation (slots → winner_videos).
                                void assignCreativeToBunch(group.bunchId!, next);
                              }}
                            />
                          </div>
                        ) : null}

                        {showAssignPicker && creatives.length === 0 ? (
                          <p className="rounded-lg border border-amber-500/25 bg-amber-500/8 px-3 py-2 text-xs text-amber-200">
                            No Creatives available — grant creative_scripts:submit to a user first.
                          </p>
                        ) : null}
                      </div>

                      <div className="space-y-3">
                        {group.videos.map((v) => (
                          <ResearchSubmissionCard
                            key={v.id}
                            video={v}
                            pendingId={pendingId}
                            loading={loading}
                            hideBunchLink
                            onCopy={() => void copySubmission(v)}
                            onRefresh={() => void reload()}
                            onApprove={() => openApprove(v)}
                            onReject={() => {
                              setRejectId(v.id);
                              setRejectReason("");
                            }}
                            onMarkPublished={() =>
                              void patchVideo(v.id, { action: "status", status: "Published" })
                            }
                            onUpdateVideoType={(type, other) =>
                              void patchVideo(v.id, {
                                action: "update_video_type",
                                sourcing_video_type: type,
                                video_type_other: other,
                              })
                            }
                          />
                        ))}
                      </div>
                    </section>
                  );
                })}
              </motion.div>
            </AnimatePresence>
          )}

          {approveId ? (
            <ReviewModalShell title="Approve research find" onClose={() => setApproveId(null)}>
              <p className="mb-4 text-sm text-[#B8B4B8]/60">
                {isBunchApprove
                  ? `Approving spawns a recreate slot into “${approveTarget?.bunch_name || "the linked bunch"}”. Target model and creative are inherited from the bunch.`
                  : "Pick the Gunzo-team creator who will recreate this direct submission."}
              </p>
              {isBunchApprove && approveTarget ? (
                <div className="mb-4 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <ResearchBunchLink video={approveTarget} />
                    <Link
                      href={ROUTES.admin.winnerVideosHub}
                      className="inline-flex items-center gap-1 text-xs text-[#FF1493] hover:underline"
                    >
                      Open Winner Videos Hub <ExternalLink className="h-3 w-3" />
                    </Link>
                  </div>
                  <div className="rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-xs text-[#B8B4B8]/70">
                    <p>
                      Target model:{" "}
                      <span className="font-medium text-[#D4AF8C]">
                        {approveInheritedModel || "—"}
                      </span>
                    </p>
                    <p className="mt-1">
                      Creative:{" "}
                      <span className="font-medium text-[#D4AF8C]">
                        {approveInheritedCreative || "Unassigned (slot will inherit when assigned)"}
                      </span>
                    </p>
                  </div>
                </div>
              ) : null}
              <ReviewFormSection title="Approval" className="border border-white/[0.06] shadow-[inset_0_2px_8px_rgba(0,0,0,0.25)]">
                <div className="space-y-4">
                  {!isBunchApprove ? (
                    <div>
                      <ReviewFieldLabel>Assigned creator</ReviewFieldLabel>
                      <ManagerReviewSelect
                        value={creatorId}
                        onChange={setCreatorId}
                        options={modelOptions}
                        placeholder="Select Gunzo-team creator…"
                        required
                      />
                    </div>
                  ) : null}
                  <div>
                    <ReviewFieldLabel>Recreation deadline</ReviewFieldLabel>
                    <input
                      type="date"
                      value={deadline}
                      onChange={(e) => setDeadline(e.target.value)}
                      className={VA_FILTER_INPUT}
                      required
                    />
                  </div>
                  <div>
                    <ReviewFieldLabel>Quality rating</ReviewFieldLabel>
                    <QualityRatingPicker value={qualityRating} onChange={setQualityRating} />
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <button type="button" className={VA_BTN_SECONDARY} onClick={() => setApproveId(null)}>
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={
                        !deadline ||
                        (!isBunchApprove && (!creatorId || !selectedCreatorName.trim()))
                      }
                      className={cn(VA_BTN_PRIMARY, "disabled:cursor-not-allowed disabled:opacity-40")}
                      onClick={() => {
                        if (!approveId || !deadline) return;
                        if (!isBunchApprove && (!creatorId || !selectedCreatorName.trim())) return;
                        void (async () => {
                          const ok = await patchVideo(approveId, {
                            action: "approve",
                            assigned_creator_name: isBunchApprove
                              ? approveInheritedModel
                              : selectedCreatorName.trim(),
                            recreation_deadline: deadline,
                            quality_rating: qualityRating,
                          });
                          if (ok) setApproveId(null);
                        })();
                      }}
                    >
                      Approve
                    </button>
                  </div>
                </div>
              </ReviewFormSection>
            </ReviewModalShell>
          ) : null}

          {rejectId ? (
            <ReviewModalShell title="Reject research find" onClose={() => setRejectId(null)}>
              <p className="mb-4 text-sm text-[#B8B4B8]/60">A rejection reason is required — the submitter will be notified.</p>
              <div className="space-y-4">
                <div>
                  <ReviewFieldLabel>Rejection reason</ReviewFieldLabel>
                  <ManagerReviewTextarea
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    rows={4}
                    placeholder="Explain what needs to change…"
                    className="focus:border-red-500/55 focus:shadow-[inset_0_2px_6px_rgba(0,0,0,0.35),0_0_0_1px_rgba(239,68,68,0.25),0_0_20px_-6px_rgba(239,68,68,0.35)]"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <button type="button" className={VA_BTN_SECONDARY} onClick={() => setRejectId(null)}>
                    Cancel
                  </button>
                  <button
                    type="button"
                    className={cn(VA_BTN_PRIMARY, "border-red-500/40 bg-red-500/20 text-red-100")}
                    onClick={() => {
                      if (!rejectId) return;
                      void (async () => {
                        const ok = await patchVideo(rejectId, {
                          action: "reject",
                          rejection_reason: rejectReason,
                        });
                        if (ok) setRejectId(null);
                      })();
                    }}
                  >
                    Reject
                  </button>
                </div>
              </div>
            </ReviewModalShell>
          ) : null}
        </>
      )}
    </div>
  );
}

function ResearchSubmissionCard({
  video,
  pendingId,
  loading,
  hideBunchLink = false,
  onCopy,
  onRefresh,
  onApprove,
  onReject,
  onMarkPublished,
  onUpdateVideoType,
}: {
  video: WinnerVideoRecord;
  pendingId: string | null;
  loading: boolean;
  hideBunchLink?: boolean;
  onCopy: () => void;
  onRefresh: () => void;
  onApprove: () => void;
  onReject: () => void;
  onMarkPublished: () => void;
  onUpdateVideoType?: (type: SlotVideoType, other: string) => void;
}) {
  const age = pendingAgeLabel(video);
  const stale = isStalePending(video);
  const busy = pendingId === video.id;
  const submitterName = video.submitted_by_name?.trim() || "";
  const creativeName = video.assigned_creative_name?.trim() || "";
  const recreateModelName = video.assigned_creator_name?.trim() || "";
  const deadlineLabel = formatRecreationDeadline(video.recreation_deadline);
  const sameSubmitterAndCreative =
    Boolean(submitterName) &&
    Boolean(creativeName) &&
    submitterName.toLowerCase() === creativeName.toLowerCase();
  const showScriptAssignee = Boolean(creativeName) && !sameSubmitterAndCreative;
  const hasAssignmentMeta = Boolean(recreateModelName || deadlineLabel || showScriptAssignee);
  const currentType =
    slotTypeFromResearchDisplay(researchDisplayVideoType(video)) ||
    (video.sourcing_video_type as SlotVideoType) ||
    "skit";
  const [typeOtherDraft, setTypeOtherDraft] = React.useState(video.video_type_other ?? "");

  React.useEffect(() => {
    setTypeOtherDraft(video.video_type_other ?? "");
  }, [video.video_type_other, video.id]);

  return (
    <FindingCard
      pending={video.status === "Pending" && busy}
      className={cn(
        stale && "ring-1 ring-amber-500/35 shadow-[0_0_28px_-10px_rgba(245,158,11,0.4)]",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <WinnerVideoStatusBadge status={video.status} />
            <QualityRatingBadge rating={video.quality_rating} />
            <ResearchSourceBadge video={video} />
            <ResearchDisplayVideoTypeBadge video={video} />
            {age ? (
              <span
                className={cn(
                  "rounded-md border px-2 py-0.5 text-[10px] font-medium tabular-nums",
                  stale
                    ? "border-amber-500/40 bg-amber-500/12 text-amber-200"
                    : "border-white/10 bg-white/5 text-[#B8B4B8]/55",
                )}
                title="Time waiting in pending queue"
              >
                {age}
              </span>
            ) : null}
            <span className="text-xs text-[#B8B4B8]/45">
              {video.submitted_at ? formatDateTimeAthens(video.submitted_at) : <DashPlaceholder />}
            </span>
            <WinnerVideoCopyButton onClick={onCopy} />
            <WinnerVideoRefreshButton onClick={onRefresh} refreshing={loading} />
          </div>

          <div className="space-y-1">
            <p className="text-lg font-semibold text-white">{displayOrDash(video.reference_model_name)}</p>
            {submitterName ? (
              <p className="text-xs text-[#B8B4B8]/55">
                {sameSubmitterAndCreative
                  ? `Submitted by ${submitterName} · writing script`
                  : `Submitted by ${submitterName}`}
              </p>
            ) : null}
          </div>

          {!hideBunchLink ? (
            <div className="flex flex-wrap items-center gap-2">
              <ResearchBunchLink video={video} />
              {video.bunch_id ? (
                <Link
                  href={ROUTES.admin.winnerVideosHub}
                  className="inline-flex items-center gap-1 text-[11px] text-[#B8B4B8]/50 hover:text-[#D4AF8C]"
                >
                  <FolderOpen className="h-3 w-3" />
                  Hub
                </Link>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2">
          {video.status === "Pending" ? (
            <>
              <QuickActionMarkFixed disabled={busy} onClick={onApprove}>
                Approve
              </QuickActionMarkFixed>
              <QuickActionEscalate disabled={busy} onClick={onReject}>
                <X className="h-3.5 w-3.5" aria-hidden />
                Reject
              </QuickActionEscalate>
            </>
          ) : null}
          {video.status === "Recreated" ? (
            <button type="button" disabled={busy} onClick={onMarkPublished} className={VA_BTN_PRIMARY}>
              Mark published
            </button>
          ) : null}
        </div>
      </div>

      {video.video_link ? (
        <a
          href={video.video_link}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-[#FF1493] hover:underline"
        >
          Reference video <ExternalLink className="h-3.5 w-3.5" aria-hidden />
        </a>
      ) : null}

      {video.note?.trim() ? (
        <p className="mt-2 text-sm leading-relaxed text-[#B8B4B8]/75">{video.note}</p>
      ) : null}

      {onUpdateVideoType ? (
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <label className="block min-w-[10rem] space-y-1">
            <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#D4AF8C]/65">
              Video type
            </span>
            <select
              className={cn(VA_FILTER_INPUT, "h-9 w-full text-xs")}
              value={currentType}
              disabled={busy}
              onChange={(e) => {
                const next = e.target.value as SlotVideoType;
                if (next === "other") {
                  const custom = typeOtherDraft.trim() || window.prompt("Custom video type") || "";
                  if (!custom.trim()) return;
                  setTypeOtherDraft(custom.trim());
                  onUpdateVideoType(next, custom.trim());
                  return;
                }
                onUpdateVideoType(next, "");
              }}
            >
              {SLOT_VIDEO_TYPES.map((t) => (
                <option key={t} value={t}>
                  {SLOT_VIDEO_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
          </label>
          {currentType === "other" ? (
            <label className="block min-w-[12rem] flex-1 space-y-1">
              <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#D4AF8C]/65">
                Custom type
              </span>
              <input
                type="text"
                className={cn(VA_FILTER_INPUT, "h-9 w-full text-xs")}
                value={typeOtherDraft}
                disabled={busy}
                onChange={(e) => setTypeOtherDraft(e.target.value)}
                onBlur={() => {
                  if (typeOtherDraft.trim() && typeOtherDraft.trim() !== (video.video_type_other ?? "").trim()) {
                    onUpdateVideoType("other", typeOtherDraft.trim());
                  }
                }}
                placeholder="Required custom type…"
              />
            </label>
          ) : null}
        </div>
      ) : null}

      {video.views_at_submission != null ? (
        <p className="mt-1 text-xs text-[#B8B4B8]/50">
          Views: {video.views_at_submission.toLocaleString()}
        </p>
      ) : null}

      {video.rejection_reason?.trim() ? (
        <p className="mt-3 rounded-lg border border-red-500/20 bg-red-500/8 px-3 py-2 text-sm text-red-200">
          {video.rejection_reason}
        </p>
      ) : null}

      {hasAssignmentMeta ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {recreateModelName ? (
            <ResearchMetaChip label="Recreate for" value={recreateModelName} accent />
          ) : null}
          {deadlineLabel ? <ResearchMetaChip label="Deadline" value={deadlineLabel} /> : null}
          {showScriptAssignee ? (
            <ResearchMetaChip label="Script assigned to" value={creativeName} />
          ) : null}
        </div>
      ) : null}
      {video.recreation_link?.trim() ? (
        <a
          href={video.recreation_link}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-flex items-center gap-1 text-xs text-[#D4AF8C] hover:text-[#FF1493] hover:underline"
        >
          Recreation link <ExternalLink className="h-3 w-3" aria-hidden />
        </a>
      ) : null}
      {video.screenshot.length > 0 ? (
        <div className="mt-3">
          <AttachmentLinks attachments={video.screenshot} />
        </div>
      ) : null}
      {busy ? (
        <p className="mt-2 flex items-center gap-2 text-xs text-[#B8B4B8]/50">
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> Saving…
        </p>
      ) : null}
      {video.status === "Approved" || video.status === "Recreated" || video.status === "Published" ? (
        <p className="mt-2 inline-flex items-center gap-1 text-[11px] text-emerald-400/70">
          <Check className="h-3 w-3" aria-hidden /> Research approved
          {video.quality_rating ? (
            <span className="ml-0.5" aria-hidden>
              {qualityRatingEmoji(video.quality_rating)}
            </span>
          ) : null}
          {video.reviewed_by_name?.trim() ? ` by ${video.reviewed_by_name.trim()}` : ""}
        </p>
      ) : null}
    </FindingCard>
  );
}

function formatRecreationDeadline(raw: string | null | undefined): string {
  const trimmed = raw?.trim();
  if (!trimmed) return "";
  const ymd = trimmed.slice(0, 10);
  const formatted = formatDateOnlyEuropean(ymd);
  return formatted === "—" ? "" : formatted;
}

function ResearchMetaChip({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-1.5 rounded-md border px-2 py-1 text-[11px]",
        accent
          ? "border-[#D4AF8C]/30 bg-[#D4AF8C]/10 text-[#D4AF8C]"
          : "border-white/10 bg-white/5 text-[#B8B4B8]/75",
      )}
    >
      <span className={cn("shrink-0", accent ? "text-[#D4AF8C]/60" : "text-[#B8B4B8]/45")}>{label}</span>
      <span className={cn("truncate font-medium", accent ? "text-[#D4AF8C]" : "text-[#B8B4B8]/85")}>
        {value}
      </span>
    </span>
  );
}
