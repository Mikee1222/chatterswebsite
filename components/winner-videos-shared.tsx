"use client";

import * as React from "react";
import { Check, ChevronDown, ChevronRight, Copy, LayoutGrid, List, RefreshCw } from "lucide-react";
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
  winnerVideoDateRangeLabel,
  type WinnerVideoDateRange,
  type WinnerVideoViewMode,
} from "@/lib/winner-videos-filters";
import { WINNER_VIDEO_STATUSES, WINNER_VIDEO_STATUS_STYLES, type WinnerVideoStatus } from "@/lib/winner-videos-helpers";
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

export function winnerVideoHasPendingTranscript(video: WinnerVideoRecord): boolean {
  return Boolean(video.video_link?.trim()) && !video.transcript?.trim();
}

export function useWinnerVideoTranscriptPolling(
  videos: WinnerVideoRecord[],
  onRefresh: () => void | Promise<void>,
  enabled = true,
) {
  const hasPending = React.useMemo(() => videos.some(winnerVideoHasPendingTranscript), [videos]);
  const onRefreshRef = React.useRef(onRefresh);
  onRefreshRef.current = onRefresh;

  React.useEffect(() => {
    if (!enabled || !hasPending) return;
    const intervalId = window.setInterval(() => {
      void onRefreshRef.current();
    }, 30_000);
    return () => window.clearInterval(intervalId);
  }, [enabled, hasPending]);
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

export function WinnerVideoTranscriptBlock({
  video,
  addToast,
  className,
}: {
  video: WinnerVideoRecord;
  addToast: (toast: ReturnType<typeof winnerVideoLocalToast>) => void;
  className?: string;
}) {
  const [expanded, setExpanded] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  const transcript = video.transcript?.trim() ?? "";
  const pending = winnerVideoHasPendingTranscript(video);

  if (!transcript && !pending) return null;

  async function handleCopyTranscript(e: React.MouseEvent) {
    e.stopPropagation();
    if (!transcript) return;
    const ok = await copyTextToClipboard(transcript);
    if (!ok) {
      addToast(winnerVideoLocalToast(`wv-tr-copy-err-${Date.now()}`, "Copy failed", "Could not copy transcript.", "high"));
      return;
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  if (pending) {
    return (
      <p className={cn("text-[11px] italic text-[#B8B4B8]/40", className)}>Transcript pending…</p>
    );
  }

  return (
    <div className={cn("mt-2", className)}>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setExpanded((v) => !v);
          }}
          className="inline-flex min-w-0 flex-1 items-center gap-1 text-left text-[11px] font-medium text-[#B8B4B8]/55 transition hover:text-[#B8B4B8]/75"
          aria-expanded={expanded}
        >
          {expanded ? (
            <ChevronDown className="h-3 w-3 shrink-0" aria-hidden />
          ) : (
            <ChevronRight className="h-3 w-3 shrink-0" aria-hidden />
          )}
          <span>Transcript</span>
        </button>
        <button
          type="button"
          onClick={(e) => void handleCopyTranscript(e)}
          title={copied ? "Copied" : "Copy transcript"}
          aria-label={copied ? "Copied" : "Copy transcript"}
          className="inline-flex shrink-0 items-center justify-center rounded-md border border-white/[0.08] bg-[#0D0B0D]/60 p-1 text-[#B8B4B8]/55 transition hover:border-[#D4AF8C]/30 hover:bg-[#D4AF8C]/8 hover:text-[#D4AF8C]"
        >
          {copied ? <Check className="h-3 w-3 text-emerald-400" aria-hidden /> : <Copy className="h-3 w-3" aria-hidden />}
        </button>
      </div>
      {expanded ? (
        <p className="mt-1.5 max-h-40 overflow-y-auto whitespace-pre-wrap rounded-md border border-white/[0.06] bg-[#0D0B0D]/50 px-2.5 py-2 text-xs leading-relaxed text-[#B8B4B8]/70">
          {transcript}
        </p>
      ) : null}
    </div>
  );
}

type WinnerVideoFiltersProps = {
  filterStatus?: WinnerVideoStatus | "";
  onFilterStatusChange?: (status: WinnerVideoStatus | "") => void;
  statusOptions?: CustomSelectOption[];
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
  filterDateRange,
  onFilterDateRangeChange,
  filterDateFrom,
  onFilterDateFromChange,
  filterDateTo,
  onFilterDateToChange,
}: WinnerVideoFiltersProps) {
  const hasStatus = Boolean(filterStatus);
  const hasDate = filterDateRange !== "all";
  const hasFilters = hasStatus || hasDate;

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
  addToast,
}: {
  video: WinnerVideoRecord;
  onCopy: (video: WinnerVideoRecord) => void;
  onRefresh?: () => void;
  refreshing?: boolean;
  addToast: (toast: ReturnType<typeof winnerVideoLocalToast>) => void;
}) {
  const notePreview = truncateNote(video.note);

  return (
    <FindingCard className="p-3">
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 flex-1 text-sm font-semibold leading-snug text-white">
          {video.reference_model_name?.trim() || "—"}
        </p>
        <div className="flex shrink-0 items-center gap-1">
          {onRefresh ? <WinnerVideoRefreshButton onClick={onRefresh} refreshing={refreshing} /> : null}
          <WinnerVideoCopyButton onClick={() => onCopy(video)} />
        </div>
      </div>
      {notePreview ? <p className="mt-1.5 text-xs leading-relaxed text-[#B8B4B8]/60">{notePreview}</p> : null}
      <WinnerVideoTranscriptBlock video={video} addToast={addToast} />
      <p className="mt-2 text-[11px] text-[#B8B4B8]/45">
        {video.submitted_at ? formatDateTimeAthens(video.submitted_at) : "—"}
      </p>
    </FindingCard>
  );
}

type WinnerVideoKanbanBoardProps = {
  videos: WinnerVideoRecord[];
  onCopy: (video: WinnerVideoRecord) => void;
  addToast: (toast: ReturnType<typeof winnerVideoLocalToast>) => void;
  onRefresh?: () => void;
  refreshing?: boolean;
};

export function WinnerVideoKanbanBoard({
  videos,
  onCopy,
  addToast,
  onRefresh,
  refreshing = false,
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
                      addToast={addToast}
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
