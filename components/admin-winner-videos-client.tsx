"use client";

import * as React from "react";
import { ExternalLink, Loader2, Trophy, X } from "lucide-react";
import {
  AttachmentLinks,
  DashPlaceholder,
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
  ReviewPageEyebrow,
  ReviewSectionHeader,
  VA_BTN_PRIMARY,
  VA_BTN_SECONDARY,
  VA_FILTER_INPUT,
  WinnerVideoStatusBadge,
  displayOrDash,
  type CustomSelectOption,
} from "@/components/manager-review-ui";
import {
  WinnerVideoCopyButton,
  WinnerVideoContentTypeBadge,
  WinnerVideoFilters,
  WinnerVideoKanbanBoard,
  WinnerVideoRefreshButton,
  WinnerVideoSubmissionsToolbar,
  useWinnerVideoCopy,
  winnerVideoLocalToast,
} from "@/components/winner-videos-shared";
import { useToast } from "@/contexts/toast-context";
import { formatDateTimeAthens } from "@/lib/format";
import { appendWinnerVideoContentTypeParam, appendWinnerVideoDateParams, WINNER_VIDEO_CONTENT_TYPE_FILTER_OPTIONS, type WinnerVideoDateRange, type WinnerVideoViewMode } from "@/lib/winner-videos-filters";
import { WINNER_VIDEO_STATUSES, type WinnerVideoContentType, type WinnerVideoStatus } from "@/lib/winner-videos-helpers";
import { cn } from "@/lib/utils";
import type { WinnerVideoRecord } from "@/services/winner-videos";
import type { ModelRecord } from "@/types";
import { AdminCreativeScriptsReview } from "@/components/admin-creative-scripts-review";
import { useIsSupabaseBackend } from "@/contexts/data-backend-context";
import { useSupabaseRealtimeRefresh } from "@/lib/hooks/use-supabase-realtime";

type AdminTab = "submissions" | "scripts";

export type CreativeOption = { id: string; name: string };

type Props = {
  initialVideos: WinnerVideoRecord[];
  initialPendingScripts?: WinnerVideoRecord[];
  gunzoModels: ModelRecord[];
  creatives?: CreativeOption[];
  canManageScripts?: boolean;
};

export function AdminWinnerVideosClient({
  initialVideos,
  initialPendingScripts = [],
  gunzoModels,
  creatives = [],
  canManageScripts = false,
}: Props) {
  const { addToast } = useToast();
  const isSupabaseBackend = useIsSupabaseBackend();
  const copySubmission = useWinnerVideoCopy(addToast);
  const [videos, setVideos] = React.useState(initialVideos);
  const [loading, setLoading] = React.useState(false);
  const [pendingId, setPendingId] = React.useState<string | null>(null);
  const [viewMode, setViewMode] = React.useState<WinnerVideoViewMode>("list");
  const [adminTab, setAdminTab] = React.useState<AdminTab>("submissions");

  const [filterStatus, setFilterStatus] = React.useState<WinnerVideoStatus | "">("");
  const [filterContentType, setFilterContentType] = React.useState<WinnerVideoContentType | "">("");
  const [filterDateRange, setFilterDateRange] = React.useState<WinnerVideoDateRange>("all");
  const [filterDateFrom, setFilterDateFrom] = React.useState("");
  const [filterDateTo, setFilterDateTo] = React.useState("");

  const [approveId, setApproveId] = React.useState<string | null>(null);
  const [rejectId, setRejectId] = React.useState<string | null>(null);
  const [recreatedId, setRecreatedId] = React.useState<string | null>(null);
  const [creatorId, setCreatorId] = React.useState("");
  const [creativeId, setCreativeId] = React.useState("");
  const [deadline, setDeadline] = React.useState("");
  const [rejectReason, setRejectReason] = React.useState("");
  const [recreationLink, setRecreationLink] = React.useState("");

  React.useEffect(() => setVideos(initialVideos), [initialVideos]);

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

  const creativeOptions = React.useMemo<CustomSelectOption[]>(
    () => [
      { value: "", label: "Select Creative…" },
      ...creatives.map((c) => ({ value: c.id, label: c.name })),
    ],
    [creatives],
  );

  const selectedCreativeName = React.useMemo(
    () => creatives.find((c) => c.id === creativeId)?.name ?? "",
    [creatives, creativeId],
  );

  const statusOptions = React.useMemo<CustomSelectOption[]>(
    () => [{ value: "", label: "All statuses" }, ...WINNER_VIDEO_STATUSES.map((s) => ({ value: s, label: s }))],
    [],
  );

  async function reload() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterStatus) params.set("status", filterStatus);
      appendWinnerVideoContentTypeParam(params, filterContentType);
      appendWinnerVideoDateParams(params, filterDateRange, filterDateFrom, filterDateTo);
      const res = await fetch(`/api/admin/winner-videos?${params}`, { credentials: "include" });
      const data = (await res.json()) as { videos?: WinnerVideoRecord[] };
      if (res.ok) setVideos(data.videos ?? []);
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterStatus, filterContentType, filterDateRange, filterDateFrom, filterDateTo]);

  const reloadRef = React.useRef(reload);
  reloadRef.current = reload;

  React.useEffect(() => {
    if (isSupabaseBackend) return;
    const id = window.setInterval(() => {
      void reloadRef.current();
    }, 60_000);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSupabaseBackend, filterStatus, filterContentType, filterDateRange, filterDateFrom, filterDateTo]);

  useSupabaseRealtimeRefresh(["winner_videos"], () => void reloadRef.current(), { debounceMs: 600 });

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

  return (
    <div className="space-y-8">
      <div>
        <ReviewPageEyebrow>Content</ReviewPageEyebrow>
        <h1 className="mt-1 text-2xl font-bold text-white">Research</h1>
        <p className="mt-1 text-sm text-[#B8B4B8]/60">
          Review VA research submissions. Step-type analytics dashboards are planned as a future task.
        </p>
      </div>

      {canManageScripts ? (
        <div
          className="inline-flex rounded-lg border border-white/[0.08] bg-[#0D0B0D]/70 p-0.5 shadow-[inset_0_2px_6px_rgba(0,0,0,0.35)]"
          role="tablist"
          aria-label="Research views"
        >
          {(
            [
              { id: "submissions" as const, label: "All submissions" },
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
                  "rounded-md px-4 py-2 text-sm font-medium transition duration-200 motion-reduce:transition-none",
                  active
                    ? "border border-[#FF1493]/35 bg-[#FF1493]/12 text-[#FFB3D9] shadow-[0_0_14px_-4px_rgba(255,20,147,0.35)]"
                    : "border border-transparent text-[#B8B4B8]/60 hover:text-[#B8B4B8]/85",
                )}
              >
                {label}
              </button>
            );
          })}
        </div>
      ) : null}

      {canManageScripts && adminTab === "scripts" ? (
        <AdminCreativeScriptsReview initialScripts={initialPendingScripts} />
      ) : (
        <>
      <WinnerVideoFilters
        filterStatus={filterStatus}
        onFilterStatusChange={setFilterStatus}
        statusOptions={statusOptions}
        filterContentType={filterContentType}
        onFilterContentTypeChange={setFilterContentType}
        contentTypeOptions={WINNER_VIDEO_CONTENT_TYPE_FILTER_OPTIONS}
        filterDateRange={filterDateRange}
        onFilterDateRangeChange={setFilterDateRange}
        filterDateFrom={filterDateFrom}
        onFilterDateFromChange={setFilterDateFrom}
        filterDateTo={filterDateTo}
        onFilterDateToChange={setFilterDateTo}
      />

      {loading ? (
        <ReviewLoadingState />
      ) : videos.length === 0 ? (
        <ReviewEmptyState icon={Trophy} title="No research finds" description="Submissions from VAs will appear here." />
      ) : (
        <div className="space-y-4">
          <ReviewSectionHeader
            action={
              <WinnerVideoSubmissionsToolbar
                viewMode={viewMode}
                onViewModeChange={setViewMode}
                videos={videos}
                addToast={addToast}
              />
            }
          >
            Submissions
          </ReviewSectionHeader>
          {viewMode === "board" ? (
            <WinnerVideoKanbanBoard
              videos={videos}
              onCopy={copySubmission}
              addToast={addToast}
              onRefresh={() => void reload()}
              refreshing={loading}
            />
          ) : (
            videos.map((v) => (
              <FindingCard key={v.id} pending={v.status === "Pending" && pendingId === v.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <WinnerVideoStatusBadge status={v.status} />
                      {v.content_type ? <WinnerVideoContentTypeBadge contentType={v.content_type} /> : null}
                      <span className="text-xs text-[#B8B4B8]/45">
                        {v.submitted_at ? formatDateTimeAthens(v.submitted_at) : <DashPlaceholder />}
                      </span>
                      <WinnerVideoCopyButton onClick={() => void copySubmission(v)} />
                      <WinnerVideoRefreshButton onClick={() => void reload()} refreshing={loading} />
                    </div>
                    <p className="text-lg font-semibold text-white">{displayOrDash(v.reference_model_name)}</p>
                    <p className="text-xs text-[#B8B4B8]/55">By {displayOrDash(v.submitted_by_name)}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {v.status === "Pending" ? (
                      <>
                        <QuickActionMarkFixed
                          disabled={pendingId === v.id}
                          onClick={() => {
                            setApproveId(v.id);
                            setCreatorId("");
                            setCreativeId("");
                            setDeadline("");
                          }}
                        >
                          Approve
                        </QuickActionMarkFixed>
                        <QuickActionEscalate
                          disabled={pendingId === v.id}
                          onClick={() => {
                            setRejectId(v.id);
                            setRejectReason("");
                          }}
                        >
                          <X className="h-3.5 w-3.5" aria-hidden />
                          Reject
                        </QuickActionEscalate>
                      </>
                    ) : null}
                    {v.status === "Approved" ? (
                      <button
                        type="button"
                        disabled={pendingId === v.id}
                        onClick={() => {
                          setRecreatedId(v.id);
                          setRecreationLink(v.recreation_link ?? "");
                        }}
                        className={VA_BTN_SECONDARY}
                      >
                        Mark recreated
                      </button>
                    ) : null}
                    {v.status === "Recreated" ? (
                      <button
                        type="button"
                        disabled={pendingId === v.id}
                        onClick={() => void patchVideo(v.id, { action: "status", status: "Published" })}
                        className={VA_BTN_PRIMARY}
                      >
                        Mark published
                      </button>
                    ) : null}
                  </div>
                </div>

                {v.video_link ? (
                  <a
                    href={v.video_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 inline-flex items-center gap-1 text-sm text-[#FF1493] hover:underline"
                  >
                    Reference video <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                  </a>
                ) : null}
                {v.note?.trim() ? <p className="mt-2 text-sm text-[#B8B4B8]/70">{v.note}</p> : null}
                {v.views_at_submission != null ? (
                  <p className="mt-1 text-xs text-[#B8B4B8]/50">Views: {v.views_at_submission.toLocaleString()}</p>
                ) : null}
                {v.rejection_reason?.trim() ? (
                  <p className="mt-3 rounded-lg border border-red-500/20 bg-red-500/8 px-3 py-2 text-sm text-red-200">
                    {v.rejection_reason}
                  </p>
                ) : null}
                {v.assigned_creator_name ? (
                  <p className="mt-2 text-xs text-[#D4AF8C]/80">
                    Creator: {v.assigned_creator_name}
                    {v.recreation_deadline ? ` · deadline ${v.recreation_deadline}` : ""}
                  </p>
                ) : null}
                {v.assigned_creative_name ? (
                  <p className="mt-1 text-xs text-[#D4AF8C]/80">Assigned to: {v.assigned_creative_name}</p>
                ) : null}
                {v.recreation_link?.trim() ? (
                  <a
                    href={v.recreation_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-flex items-center gap-1 text-xs text-[#D4AF8C] hover:text-[#FF1493] hover:underline"
                  >
                    Recreation link <ExternalLink className="h-3 w-3" aria-hidden />
                  </a>
                ) : null}
                {v.screenshot.length > 0 ? (
                  <div className="mt-3">
                    <AttachmentLinks attachments={v.screenshot} />
                  </div>
                ) : null}
                {pendingId === v.id ? (
                  <p className="mt-2 flex items-center gap-2 text-xs text-[#B8B4B8]/50">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> Saving…
                  </p>
                ) : null}
              </FindingCard>
            ))
          )}
        </div>
      )}

      {approveId ? (
        <ReviewModalShell title="Approve research find" onClose={() => setApproveId(null)}>
          <p className="mb-4 text-sm text-[#B8B4B8]/60">
            Pick the Gunzo-team creator who will recreate this video and assign a Creative to write the script.
          </p>
          <ReviewFormSection title="Assignment" className="border border-white/[0.06] shadow-[inset_0_2px_8px_rgba(0,0,0,0.25)]">
            <div className="space-y-4">
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
              <div>
                <ReviewFieldLabel>Assign to Creative</ReviewFieldLabel>
                {creatives.length === 0 ? (
                  <p className="mt-1 rounded-lg border border-amber-500/25 bg-amber-500/8 px-3 py-2 text-xs text-amber-200">
                    No Creatives available — grant creative_scripts:submit to a user first.
                  </p>
                ) : (
                  <ManagerReviewSelect
                    value={creativeId}
                    onChange={setCreativeId}
                    options={creativeOptions}
                    placeholder="Select Creative…"
                    searchable
                    searchPlaceholder="Search Creatives…"
                    required
                  />
                )}
              </div>
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
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" className={VA_BTN_SECONDARY} onClick={() => setApproveId(null)}>
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={
                    !creatorId ||
                    !selectedCreatorName.trim() ||
                    !creativeId ||
                    !selectedCreativeName.trim() ||
                    !deadline
                  }
                  className={cn(VA_BTN_PRIMARY, "disabled:cursor-not-allowed disabled:opacity-40")}
                  onClick={() => {
                    if (
                      !approveId ||
                      !creatorId ||
                      !selectedCreatorName.trim() ||
                      !creativeId ||
                      !selectedCreativeName.trim() ||
                      !deadline
                    ) {
                      return;
                    }
                    void (async () => {
                      const ok = await patchVideo(approveId, {
                        action: "approve",
                        assigned_creator_name: selectedCreatorName.trim(),
                        assigned_creative_id: creativeId,
                        assigned_creative_name: selectedCreativeName.trim(),
                        recreation_deadline: deadline,
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

      {recreatedId ? (
        <ReviewModalShell title="Mark as recreated" onClose={() => setRecreatedId(null)}>
          <p className="mb-4 text-sm text-[#B8B4B8]/60">Optional link to the recreated video.</p>
          <div className="space-y-4">
            <div>
              <ReviewFieldLabel>Recreation link (optional)</ReviewFieldLabel>
              <input
                value={recreationLink}
                onChange={(e) => setRecreationLink(e.target.value)}
                className={VA_FILTER_INPUT}
                placeholder="https://…"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" className={VA_BTN_SECONDARY} onClick={() => setRecreatedId(null)}>
                Cancel
              </button>
              <button
                type="button"
                className={VA_BTN_PRIMARY}
                onClick={() => {
                  if (!recreatedId) return;
                  void (async () => {
                    const ok = await patchVideo(recreatedId, {
                      action: "status",
                      status: "Recreated",
                      recreation_link: recreationLink,
                    });
                    if (ok) setRecreatedId(null);
                  })();
                }}
              >
                Mark recreated
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
