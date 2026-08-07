"use client";

import * as React from "react";
import { Check, Copy, ExternalLink, FolderOpen, LayoutGrid, List, RefreshCw, User } from "lucide-react";
import Link from "next/link";
import {
  FilterBar,
  FilterChip,
  FindingCard,
  ManagerReviewSelect,
  ReviewFieldLabel,
  VA_FILTER_INPUT,
  WinnerVideoStatusBadge,
  type CustomSelectOption,
} from "@/components/manager-review-ui";
import {
  copyTextToClipboard,
  formatWinnerVideoBulkCopy,
  formatWinnerVideoSingleCopy,
  truncateNote,
} from "@/lib/winner-videos-copy";
import {
  WINNER_VIDEO_DATE_RANGE_OPTIONS,
  isStalePending,
  pendingAgeLabel,
  researchDisplayVideoType,
  researchSourceLabel,
  researchSubmissionSource,
  winnerVideoContentTypeLabel,
  winnerVideoDateRangeLabel,
  type ResearchDisplayVideoType,
  type WinnerVideoDateRange,
  type WinnerVideoViewMode,
} from "@/lib/winner-videos-filters";
import {
  WINNER_VIDEO_CONTENT_TYPE_STYLES,
  WINNER_VIDEO_QUALITY_RATINGS,
  WINNER_VIDEO_QUALITY_RATING_META,
  WINNER_VIDEO_STATUSES,
  WINNER_VIDEO_STATUS_STYLES,
  formatQualityRatingAggregate,
  qualityRatingEmoji,
  type WinnerVideoContentType,
  type WinnerVideoQualityRating,
  type WinnerVideoStatus,
} from "@/lib/winner-videos-helpers";
import { ROUTES } from "@/lib/routes";
import { VA_STATUS_BADGE } from "@/lib/va-tasks-tokens";
import { formatDateTimeAthens } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { WinnerVideoRecord } from "@/services/winner-videos";

export type WinnerVideoToastFn = (
  id: string,
  title: string,
  body: string,
  priority: "normal" | "high",
) => void;

export function winnerVideoLocalToast(
  id: string,
  title: string,
  body: string,
  priority: "normal" | "high",
) {
  return {
    id,
    notification_id: id,
    user_id: "local",
    category: "system" as const,
    event_type: "system_alert" as const,
    priority,
    title,
    body,
    entity_type: "system",
    entity_id: "",
    read_at: null,
    created_at: new Date().toISOString(),
  };
}

const KANBAN_COLUMN_GLOW: Record<WinnerVideoStatus, string> = {
  Pending: "border-amber-500/25 bg-amber-500/[0.04] shadow-[0_0_24px_-12px_rgba(245,158,11,0.25)]",
  Approved: "border-emerald-500/25 bg-emerald-500/[0.04] shadow-[0_0_24px_-12px_rgba(16,185,129,0.22)]",
  Rejected: "border-red-500/25 bg-red-500/[0.04] shadow-[0_0_24px_-12px_rgba(239,68,68,0.25)]",
  Recreated: "border-sky-500/25 bg-sky-500/[0.04] shadow-[0_0_24px_-12px_rgba(14,165,233,0.22)]",
  Published: "border-[#D4AF8C]/25 bg-[#D4AF8C]/[0.04] shadow-[0_0_24px_-12px_rgba(212,175,140,0.22)]",
};

export function WinnerVideoContentTypeBadge({ contentType }: { contentType: WinnerVideoContentType }) {
  const style = WINNER_VIDEO_CONTENT_TYPE_STYLES[contentType];
  return (
    <span
      className={cn(
        "inline-flex rounded-md border px-2 py-0.5 text-xs font-medium backdrop-blur-sm",
        style.className,
      )}
    >
      {style.label}
    </span>
  );
}

/** Compact emoji chip for an approved video's quality rating. */
export function QualityRatingBadge({
  rating,
  size = "md",
  showLabel = false,
}: {
  rating: WinnerVideoQualityRating | null | undefined;
  size?: "sm" | "md";
  showLabel?: boolean;
}) {
  if (!rating) return null;
  const meta = WINNER_VIDEO_QUALITY_RATING_META[rating];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border border-[#D4AF8C]/30 bg-[#D4AF8C]/10 font-medium text-[#D4AF8C]",
        size === "sm" ? "px-1.5 py-0.5 text-[11px]" : "px-2 py-0.5 text-xs",
      )}
      title={`${meta.label} (${meta.labelEl})`}
      aria-label={`Quality: ${meta.label}`}
    >
      <span className={size === "sm" ? "text-sm leading-none" : "text-base leading-none"} aria-hidden>
        {meta.emoji}
      </span>
      {showLabel ? <span>{meta.label}</span> : null}
    </span>
  );
}

/** Optional 3-tier emoji picker for Research Manage approve. */
export function QualityRatingPicker({
  value,
  onChange,
  disabled = false,
}: {
  value: WinnerVideoQualityRating | null;
  onChange: (next: WinnerVideoQualityRating | null) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {WINNER_VIDEO_QUALITY_RATINGS.map((key) => {
          const meta = WINNER_VIDEO_QUALITY_RATING_META[key];
          const selected = value === key;
          return (
            <button
              key={key}
              type="button"
              disabled={disabled}
              onClick={() => onChange(selected ? null : key)}
              aria-pressed={selected}
              title={`${meta.label} (${meta.labelEl})`}
              className={cn(
                "group relative flex min-w-[5.5rem] flex-col items-center gap-1 rounded-xl border px-3 py-2.5 transition-all duration-200",
                "disabled:cursor-not-allowed disabled:opacity-40",
                selected
                  ? "border-[#D4AF8C]/55 bg-gradient-to-b from-[#D4AF8C]/18 to-[#FF1493]/10 text-white shadow-[0_0_24px_-8px_rgba(212,175,140,0.55),inset_0_1px_0_rgba(255,255,255,0.08)] ring-1 ring-[#D4AF8C]/35"
                  : "border-white/10 bg-white/[0.03] text-[#B8B4B8]/70 hover:border-[#D4AF8C]/25 hover:bg-white/[0.06] hover:text-[#E8E4E8]",
              )}
            >
              <span className={cn("text-2xl leading-none transition-transform", selected && "scale-110")}>
                {meta.emoji}
              </span>
              <span className={cn("text-[10px] font-semibold uppercase tracking-[0.12em]", selected ? "text-[#D4AF8C]" : "text-[#B8B4B8]/45")}>
                {meta.label}
              </span>
              <span className={cn("text-[10px]", selected ? "text-[#B8B4B8]/70" : "text-[#B8B4B8]/35")}>
                {meta.labelEl}
              </span>
            </button>
          );
        })}
      </div>
      <p className="text-[11px] text-[#B8B4B8]/40">
        Optional — tap again to clear. Researcher sees the emoji on approval.
      </p>
    </div>
  );
}

/** Aggregate line for researcher history, e.g. 🔥 x3 · 🌟 x5 · 👍 x8 */
export function QualityRatingAggregate({
  ratings,
  className,
}: {
  ratings: Array<WinnerVideoQualityRating | null | undefined>;
  className?: string;
}) {
  const line = formatQualityRatingAggregate(ratings);
  if (!line) return null;
  return (
    <p className={cn("text-sm tabular-nums tracking-wide text-[#D4AF8C]/85", className)} aria-label="Quality rating totals">
      {line}
    </p>
  );
}

export { qualityRatingEmoji };

const DISPLAY_VIDEO_TYPE_STYLES: Record<ResearchDisplayVideoType, string> = {
  Skit: "border-violet-500/35 bg-violet-500/12 text-violet-200",
  UGC: "border-teal-500/35 bg-teal-500/12 text-teal-200",
  "Text on screen": "border-fuchsia-500/35 bg-fuchsia-500/12 text-fuchsia-200",
  Interview: "border-amber-500/35 bg-amber-500/12 text-amber-200",
  Clips: "border-rose-500/35 bg-rose-500/12 text-rose-200",
  Other: "border-sky-500/35 bg-sky-500/12 text-sky-200",
};

export function ResearchDisplayVideoTypeBadge({
  video,
  videoType,
}: {
  video?: WinnerVideoRecord;
  videoType?: ResearchDisplayVideoType;
}) {
  const type = videoType ?? (video ? researchDisplayVideoType(video) : "Skit");
  const label =
    video && type === "Other" && video.video_type_other?.trim()
      ? `Other: ${video.video_type_other.trim()}`
      : type;
  return (
    <span
      className={cn(
        "inline-flex max-w-full truncate rounded-md border px-2 py-0.5 text-xs font-medium backdrop-blur-sm",
        DISPLAY_VIDEO_TYPE_STYLES[type],
      )}
      title={label}
    >
      {label}
    </span>
  );
}

export function ResearchSourceBadge({ video }: { video: WinnerVideoRecord }) {
  const source = researchSubmissionSource(video);
  const styles =
    source === "bunch_fill"
      ? "border-[#D4AF8C]/35 bg-[#D4AF8C]/12 text-[#D4AF8C]"
      : source === "super_winner"
        ? "border-amber-500/35 bg-amber-500/12 text-amber-200"
        : source === "winner"
          ? "border-emerald-500/35 bg-emerald-500/12 text-emerald-200"
          : "border-white/15 bg-white/5 text-[#B8B4B8]/80";
  return (
    <span className={cn(VA_STATUS_BADGE, styles)}>{researchSourceLabel(source)}</span>
  );
}

export function ResearchBunchLink({ video, className }: { video: WinnerVideoRecord; className?: string }) {
  if (!video.bunch_id?.trim()) return null;
  const name = video.bunch_name?.trim() || "Linked bunch";
  return (
    <Link
      href={ROUTES.admin.winnerVideosHub}
      title={`Open Winner Videos Hub · ${name}`}
      className={cn(
        "inline-flex max-w-full items-center gap-1.5 rounded-lg border border-[#D4AF8C]/30 bg-[#D4AF8C]/10 px-2 py-1 text-[11px] font-medium text-[#D4AF8C] transition hover:border-[#D4AF8C]/50 hover:bg-[#D4AF8C]/15",
        className,
      )}
    >
      <FolderOpen className="h-3 w-3 shrink-0" aria-hidden />
      <span className="truncate">{name}</span>
    </Link>
  );
}

export function WinnerVideoViewToggle({
  viewMode,
  onChange,
  className,
}: {
  viewMode: WinnerVideoViewMode;
  onChange: (mode: WinnerVideoViewMode) => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "inline-flex rounded-lg border border-white/[0.08] bg-[#0D0B0D]/70 p-0.5 shadow-[inset_0_2px_6px_rgba(0,0,0,0.35)]",
        className,
      )}
      role="group"
      aria-label="View mode"
    >
      {(
        [
          { mode: "list" as const, label: "List", icon: List },
          { mode: "board" as const, label: "Board", icon: LayoutGrid },
        ] as const
      ).map(({ mode, label, icon: Icon }) => {
        const active = viewMode === mode;
        return (
          <button
            key={mode}
            type="button"
            onClick={() => onChange(mode)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition duration-200 motion-reduce:transition-none",
              active
                ? "border border-[#FF1493]/35 bg-[#FF1493]/12 text-[#FFB3D9] shadow-[0_0_14px_-4px_rgba(255,20,147,0.35)]"
                : "border border-transparent text-[#B8B4B8]/60 hover:text-[#B8B4B8]/85",
            )}
          >
            <Icon className="h-3.5 w-3.5" aria-hidden />
            {label}
          </button>
        );
      })}
    </div>
  );
}

export function WinnerVideoCopyButton({
  onClick,
  className,
  label = "Copy submission",
}: {
  onClick: () => void;
  className?: string;
  label?: string;
}) {
  const [copied, setCopied] = React.useState(false);

  function handleClick(e: React.MouseEvent) {
    e.stopPropagation();
    onClick();
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      title={copied ? "Copied" : label}
      aria-label={copied ? "Copied" : label}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-md border border-white/[0.08] bg-[#0D0B0D]/60 p-1.5 text-[#B8B4B8]/55 transition hover:border-[#D4AF8C]/30 hover:bg-[#D4AF8C]/8 hover:text-[#D4AF8C]",
        className,
      )}
    >
      {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" aria-hidden /> : <Copy className="h-3.5 w-3.5" aria-hidden />}
    </button>
  );
}

export function WinnerVideoCopyAllButton({
  videos,
  addToast,
  className,
  label,
}: {
  videos: WinnerVideoRecord[];
  addToast: (toast: ReturnType<typeof winnerVideoLocalToast>) => void;
  className?: string;
  label?: string;
}) {
  const disabled = videos.length === 0;

  async function handleCopy() {
    if (disabled) return;
    const text = formatWinnerVideoBulkCopy(videos);
    const ok = await copyTextToClipboard(text);
    if (!ok) {
      addToast(winnerVideoLocalToast(`wv-copy-err-${Date.now()}`, "Copy failed", "Could not copy to clipboard.", "high"));
      return;
    }
    const count = videos.length;
    addToast(
      winnerVideoLocalToast(
        `wv-copy-all-${Date.now()}`,
        `${count} item${count === 1 ? "" : "s"} copied`,
        `${count} item${count === 1 ? "" : "s"} copied`,
        "normal",
      ),
    );
  }

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => void handleCopy()}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg border border-[#D4AF8C]/25 bg-[#D4AF8C]/8 px-2.5 py-1.5 text-xs font-medium text-[#D4AF8C] transition hover:border-[#D4AF8C]/40 hover:bg-[#D4AF8C]/12 disabled:cursor-not-allowed disabled:opacity-40",
        className,
      )}
    >
      <Copy className="h-3.5 w-3.5" aria-hidden />
      {label ?? `Copy all (${videos.length})`}
    </button>
  );
}

export function useWinnerVideoCopy(addToast: (toast: ReturnType<typeof winnerVideoLocalToast>) => void) {
  return React.useCallback(
    async (video: WinnerVideoRecord) => {
      const ok = await copyTextToClipboard(formatWinnerVideoSingleCopy(video));
      if (!ok) {
        addToast(winnerVideoLocalToast(`wv-copy-err-${Date.now()}`, "Copy failed", "Could not copy to clipboard.", "high"));
        return;
      }
      addToast(winnerVideoLocalToast(`wv-copy-${Date.now()}`, "Copied", "Copied", "normal"));
    },
    [addToast],
  );
}

export function WinnerVideoRefreshButton({
  onClick,
  refreshing = false,
  className,
}: {
  onClick: () => void;
  refreshing?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      title="Refresh"
      aria-label="Refresh"
      disabled={refreshing}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-md border border-white/[0.08] bg-[#0D0B0D]/60 p-1.5 text-[#B8B4B8]/55 transition hover:border-[#D4AF8C]/30 hover:bg-[#D4AF8C]/8 hover:text-[#D4AF8C] disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
    >
      <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} aria-hidden />
    </button>
  );
}

type WinnerVideoFiltersProps = {
  filterStatus?: WinnerVideoStatus | "";
  onFilterStatusChange?: (status: WinnerVideoStatus | "") => void;
  statusOptions?: CustomSelectOption[];
  filterContentType?: WinnerVideoContentType | "";
  onFilterContentTypeChange?: (contentType: WinnerVideoContentType | "") => void;
  contentTypeOptions?: CustomSelectOption[];
  filterDateRange: WinnerVideoDateRange;
  onFilterDateRangeChange: (range: WinnerVideoDateRange) => void;
  filterDateFrom: string;
  onFilterDateFromChange: (value: string) => void;
  filterDateTo: string;
  onFilterDateToChange: (value: string) => void;
};

export function WinnerVideoFilters({
  filterStatus,
  onFilterStatusChange,
  statusOptions,
  filterContentType,
  onFilterContentTypeChange,
  contentTypeOptions,
  filterDateRange,
  onFilterDateRangeChange,
  filterDateFrom,
  onFilterDateFromChange,
  filterDateTo,
  onFilterDateToChange,
}: WinnerVideoFiltersProps) {
  const hasStatus = Boolean(filterStatus);
  const hasContentType = Boolean(filterContentType);
  const hasDate = filterDateRange !== "all";
  const hasFilters = hasStatus || hasContentType || hasDate;

  return (
    <FilterBar>
      <div className="flex flex-wrap gap-2">
        {statusOptions && onFilterStatusChange ? (
          <ManagerReviewSelect
            value={filterStatus ?? ""}
            onChange={(v) => onFilterStatusChange(v as WinnerVideoStatus | "")}
            options={statusOptions}
            triggerClassName="min-w-[9rem]"
            aria-label="Filter by status"
          />
        ) : null}
        {contentTypeOptions && onFilterContentTypeChange ? (
          <ManagerReviewSelect
            value={filterContentType ?? ""}
            onChange={(v) => onFilterContentTypeChange(v as WinnerVideoContentType | "")}
            options={contentTypeOptions}
            triggerClassName="min-w-[9rem]"
            aria-label="Filter by content type"
          />
        ) : null}
        <ManagerReviewSelect
          value={filterDateRange}
          onChange={(v) => onFilterDateRangeChange(v as WinnerVideoDateRange)}
          options={WINNER_VIDEO_DATE_RANGE_OPTIONS}
          triggerClassName="min-w-[9rem]"
          aria-label="Date range"
        />
        {filterDateRange === "custom" ? (
          <>
            <div className="space-y-1">
              <ReviewFieldLabel className="sr-only">From date</ReviewFieldLabel>
              <input
                type="date"
                value={filterDateFrom}
                onChange={(e) => onFilterDateFromChange(e.target.value)}
                className={cn(VA_FILTER_INPUT, "min-w-[9rem]")}
                aria-label="From date"
              />
            </div>
            <div className="space-y-1">
              <ReviewFieldLabel className="sr-only">To date</ReviewFieldLabel>
              <input
                type="date"
                value={filterDateTo}
                onChange={(e) => onFilterDateToChange(e.target.value)}
                className={cn(VA_FILTER_INPUT, "min-w-[9rem]")}
                aria-label="To date"
              />
            </div>
          </>
        ) : null}
      </div>
      {hasFilters ? (
        <div className="flex flex-wrap items-center gap-2">
          {hasStatus && filterStatus ? (
            <FilterChip label={`Status: ${filterStatus}`} onRemove={() => onFilterStatusChange?.("")} />
          ) : null}
          {hasContentType && filterContentType ? (
            <FilterChip
              label={`Type: ${winnerVideoContentTypeLabel(filterContentType)}`}
              onRemove={() => onFilterContentTypeChange?.("")}
            />
          ) : null}
          {hasDate ? (
            <FilterChip
              label={winnerVideoDateRangeLabel(filterDateRange)}
              onRemove={() => {
                onFilterDateRangeChange("all");
                onFilterDateFromChange("");
                onFilterDateToChange("");
              }}
            />
          ) : null}
        </div>
      ) : null}
    </FilterBar>
  );
}

export function WinnerVideoKanbanCard({
  video,
  onCopy,
  onRefresh,
  refreshing = false,
  onApprove,
  onReject,
  onMarkRecreated,
  onMarkPublished,
  busy = false,
}: {
  video: WinnerVideoRecord;
  onCopy: (video: WinnerVideoRecord) => void;
  onRefresh?: () => void;
  refreshing?: boolean;
  onApprove?: (video: WinnerVideoRecord) => void;
  onReject?: (video: WinnerVideoRecord) => void;
  onMarkRecreated?: (video: WinnerVideoRecord) => void;
  onMarkPublished?: (video: WinnerVideoRecord) => void;
  busy?: boolean;
}) {
  const notePreview = truncateNote(video.note);
  const age = pendingAgeLabel(video);
  const stale = isStalePending(video);
  const hasActions =
    (video.status === "Pending" && (onApprove || onReject)) ||
    (video.status === "Approved" && onMarkRecreated) ||
    (video.status === "Recreated" && onMarkPublished);

  return (
    <FindingCard
      className={cn(
        "p-3",
        stale && "ring-1 ring-amber-500/30 shadow-[0_0_20px_-8px_rgba(245,158,11,0.35)]",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1 space-y-1.5">
          <p className="text-sm font-semibold leading-snug text-white">
            {video.reference_model_name?.trim() || "—"}
          </p>
          <div className="flex flex-wrap items-center gap-1.5">
            <ResearchSourceBadge video={video} />
            <ResearchDisplayVideoTypeBadge video={video} />
            <QualityRatingBadge rating={video.quality_rating} size="sm" />
          </div>
          <ResearchBunchLink video={video} />
          <p className="inline-flex items-center gap-1 text-[11px] text-[#B8B4B8]/50">
            <User className="h-3 w-3 shrink-0" aria-hidden />
            <span className="truncate">{video.submitted_by_name?.trim() || "—"}</span>
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {onRefresh ? <WinnerVideoRefreshButton onClick={onRefresh} refreshing={refreshing} /> : null}
          <WinnerVideoCopyButton onClick={() => onCopy(video)} />
        </div>
      </div>
      {notePreview ? <p className="mt-1.5 text-xs leading-relaxed text-[#B8B4B8]/60">{notePreview}</p> : null}
      {video.video_link ? (
        <a
          href={video.video_link}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-[#FF1493] hover:underline"
        >
          Open video <ExternalLink className="h-3 w-3" aria-hidden />
        </a>
      ) : null}
      <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-[#B8B4B8]/45">
        <span>{video.submitted_at ? formatDateTimeAthens(video.submitted_at) : "—"}</span>
        {age ? (
          <span
            className={cn(
              "rounded-md border px-1.5 py-0.5 tabular-nums",
              stale
                ? "border-amber-500/35 bg-amber-500/10 text-amber-200"
                : "border-white/10 bg-white/5 text-[#B8B4B8]/55",
            )}
          >
            {age}
          </span>
        ) : null}
      </div>
      {hasActions ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {video.status === "Pending" && onApprove ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => onApprove(video)}
              className="inline-flex min-h-[44px] items-center rounded-lg border border-emerald-500/30 bg-emerald-500/8 px-3 py-1.5 text-xs font-medium text-emerald-300 disabled:opacity-50"
            >
              Approve
            </button>
          ) : null}
          {video.status === "Pending" && onReject ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => onReject(video)}
              className="inline-flex min-h-[44px] items-center rounded-lg border border-red-500/30 bg-red-500/8 px-3 py-1.5 text-xs font-medium text-red-300 disabled:opacity-50"
            >
              Reject
            </button>
          ) : null}
          {video.status === "Approved" && onMarkRecreated ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => onMarkRecreated(video)}
              className="inline-flex min-h-[44px] items-center rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/80 disabled:opacity-50"
            >
              Mark recreated
            </button>
          ) : null}
          {video.status === "Recreated" && onMarkPublished ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => onMarkPublished(video)}
              className="inline-flex min-h-[44px] items-center rounded-lg border border-[#D4AF8C]/35 bg-[#D4AF8C]/10 px-3 py-1.5 text-xs font-medium text-[#D4AF8C] disabled:opacity-50"
            >
              Mark published
            </button>
          ) : null}
        </div>
      ) : null}
    </FindingCard>
  );
}

type WinnerVideoKanbanBoardProps = {
  videos: WinnerVideoRecord[];
  onCopy: (video: WinnerVideoRecord) => void;
  addToast: (toast: ReturnType<typeof winnerVideoLocalToast>) => void;
  onRefresh?: () => void;
  refreshing?: boolean;
  onApprove?: (video: WinnerVideoRecord) => void;
  onReject?: (video: WinnerVideoRecord) => void;
  onMarkRecreated?: (video: WinnerVideoRecord) => void;
  onMarkPublished?: (video: WinnerVideoRecord) => void;
  busyId?: string | null;
};

export function WinnerVideoKanbanBoard({
  videos,
  onCopy,
  addToast,
  onRefresh,
  refreshing = false,
  onApprove,
  onReject,
  onMarkRecreated,
  onMarkPublished,
  busyId = null,
}: WinnerVideoKanbanBoardProps) {
  const grouped = React.useMemo(() => {
    const map: Record<WinnerVideoStatus, WinnerVideoRecord[]> = {
      Pending: [],
      Approved: [],
      Rejected: [],
      Recreated: [],
      Published: [],
    };
    for (const video of videos) map[video.status].push(video);
    for (const status of WINNER_VIDEO_STATUSES) {
      map[status].sort((a, b) => {
        const am = a.submitted_at ? new Date(a.submitted_at).getTime() : 0;
        const bm = b.submitted_at ? new Date(b.submitted_at).getTime() : 0;
        if (status === "Pending") return am - bm;
        return bm - am;
      });
    }
    return map;
  }, [videos]);

  return (
    <div className="-mx-1 overflow-x-auto pb-2">
      <div className="flex min-w-min gap-3 px-1 md:gap-4">
        {WINNER_VIDEO_STATUSES.map((status) => {
          const columnVideos = grouped[status];
          const style = WINNER_VIDEO_STATUS_STYLES[status];
          return (
            <section
              key={status}
              className={cn(
                "flex w-[min(100%,17.5rem)] shrink-0 flex-col rounded-xl border p-3 md:w-72",
                KANBAN_COLUMN_GLOW[status],
              )}
            >
              <div className="mb-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <WinnerVideoStatusBadge status={status} />
                  <span className="text-xs tabular-nums text-[#B8B4B8]/45">{columnVideos.length}</span>
                </div>
                <WinnerVideoCopyAllButton
                  videos={columnVideos}
                  addToast={addToast}
                  label={`Copy all (${columnVideos.length})`}
                  className="w-full justify-center"
                />
              </div>
              <div className="flex flex-1 flex-col gap-2">
                {columnVideos.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-white/[0.06] px-3 py-6 text-center text-xs text-[#B8B4B8]/35">
                    No {style.label.toLowerCase()} items
                  </p>
                ) : (
                  columnVideos.map((video) => (
                    <WinnerVideoKanbanCard
                      key={video.id}
                      video={video}
                      onCopy={onCopy}
                      onRefresh={onRefresh}
                      refreshing={refreshing}
                      onApprove={onApprove}
                      onReject={onReject}
                      onMarkRecreated={onMarkRecreated}
                      onMarkPublished={onMarkPublished}
                      busy={busyId === video.id}
                    />
                  ))
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

export function WinnerVideoSubmissionsToolbar({
  viewMode,
  onViewModeChange,
  videos,
  addToast,
}: {
  viewMode: WinnerVideoViewMode;
  onViewModeChange: (mode: WinnerVideoViewMode) => void;
  videos: WinnerVideoRecord[];
  addToast: (toast: ReturnType<typeof winnerVideoLocalToast>) => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <WinnerVideoCopyAllButton videos={videos} addToast={addToast} />
      <WinnerVideoViewToggle viewMode={viewMode} onChange={onViewModeChange} />
    </div>
  );
}
