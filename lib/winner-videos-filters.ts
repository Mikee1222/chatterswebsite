import { addDaysAthensYmd, getTodayYmdAthens } from "@/lib/airtable-datetime";
import type { WinnerVideoStatus, WinnerVideoContentType } from "@/lib/winner-videos-helpers";
import type { WinnerVideoRecord } from "@/services/winner-videos";
import type { CustomSelectOption } from "@/components/manager-review-ui";
import { WINNER_VIDEO_CONTENT_TYPES } from "@/lib/winner-videos-helpers";
import {
  mapScriptFieldsToSlotType,
  tierFromViewCount,
} from "@/lib/winner-sourcing-helpers";

export type WinnerVideoDateRange = "all" | "7d" | "30d" | "custom";

export type WinnerVideoViewMode = "list" | "board";

/** Display video type for Research Manage (Fill Bunches Skit/UGC/Other). */
export type ResearchDisplayVideoType = "Skit" | "UGC" | "Other";

/**
 * Source / tier for Research Manage queue.
 * Bunch-fill = Fill Bunches researcher submit; Winner/Super = view-tier finds; research = other.
 */
export type ResearchSubmissionSource = "bunch_fill" | "winner" | "super_winner" | "research";

export function isoDateDaysAgo(days: number): string {
  return addDaysAthensYmd(getTodayYmdAthens(), -days);
}

export const WINNER_VIDEO_CONTENT_TYPE_FILTER_OPTIONS: CustomSelectOption[] = [
  { value: "", label: "All types" },
  ...WINNER_VIDEO_CONTENT_TYPES.map((type) => ({ value: type, label: type })),
];

export const RESEARCH_DISPLAY_VIDEO_TYPE_OPTIONS: CustomSelectOption[] = [
  { value: "", label: "All video types" },
  { value: "Skit", label: "Skit" },
  { value: "UGC", label: "UGC" },
  { value: "Other", label: "Other" },
];

export const RESEARCH_SOURCE_FILTER_OPTIONS: CustomSelectOption[] = [
  { value: "", label: "All sources" },
  { value: "bunch_fill", label: "Bunch-fill" },
  { value: "winner", label: "Winner" },
  { value: "super_winner", label: "Super Winner" },
  { value: "research", label: "Research find" },
];

export function researchDisplayVideoType(video: WinnerVideoRecord): ResearchDisplayVideoType {
  const slot = mapScriptFieldsToSlotType(video.content_type, video.script_video_type);
  if (slot === "ugc") return "UGC";
  if (slot === "other") return "Other";
  return "Skit";
}

export function researchSubmissionSource(video: WinnerVideoRecord): ResearchSubmissionSource {
  if (video.bunch_id?.trim()) return "bunch_fill";
  const views = video.views_at_submission;
  if (views != null) {
    const tier = tierFromViewCount(views);
    if (tier === "super_winner") return "super_winner";
    if (tier === "winner") return "winner";
  }
  return "research";
}

export function researchSourceLabel(source: ResearchSubmissionSource): string {
  switch (source) {
    case "bunch_fill":
      return "Bunch submission";
    case "winner":
      return "Winner";
    case "super_winner":
      return "Super Winner";
    default:
      return "Research find";
  }
}

export function winnerVideoContentTypeLabel(contentType: WinnerVideoContentType | ""): string {
  if (contentType === "Skit") return "Skit";
  if (contentType === "UGC") return "UGC";
  return "All types";
}

export function appendWinnerVideoContentTypeParam(
  params: URLSearchParams,
  contentType: WinnerVideoContentType | "",
): void {
  if (contentType) params.set("content_type", contentType);
}

export const WINNER_VIDEO_DATE_RANGE_OPTIONS: CustomSelectOption[] = [
  { value: "all", label: "All dates" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "custom", label: "Custom range" },
];

export function winnerVideoDateRangeLabel(range: WinnerVideoDateRange): string {
  if (range === "7d") return "Last 7 days";
  if (range === "30d") return "Last 30 days";
  if (range === "custom") return "Custom range";
  return "All dates";
}

export function appendWinnerVideoDateParams(
  params: URLSearchParams,
  dateRange: WinnerVideoDateRange,
  dateFrom: string,
  dateTo: string,
): void {
  if (dateRange === "7d") params.set("date_from", isoDateDaysAgo(7));
  if (dateRange === "30d") params.set("date_from", isoDateDaysAgo(30));
  if (dateRange === "custom") {
    if (dateFrom) params.set("date_from", dateFrom);
    if (dateTo) params.set("date_to", dateTo);
  }
}

function submittedAtMs(video: WinnerVideoRecord): number {
  if (!video.submitted_at?.trim()) return 0;
  const ms = new Date(video.submitted_at).getTime();
  return Number.isNaN(ms) ? 0 : ms;
}

function reviewedAtMs(video: WinnerVideoRecord): number {
  if (!video.reviewed_at?.trim()) return 0;
  const ms = new Date(video.reviewed_at).getTime();
  return Number.isNaN(ms) ? 0 : ms;
}

function startOfDayMs(ymd: string): number {
  return new Date(`${ymd}T00:00:00.000Z`).getTime();
}

function endOfDayMs(ymd: string): number {
  return new Date(`${ymd}T23:59:59.999Z`).getTime();
}

export type ResearchManageFilterOpts = {
  status?: WinnerVideoStatus | "";
  contentType?: WinnerVideoContentType | "";
  videoType?: ResearchDisplayVideoType | "";
  source?: ResearchSubmissionSource | "";
  modelId?: string;
  modelName?: string;
  bunchId?: string;
  submitterId?: string;
  search?: string;
  dateRange: WinnerVideoDateRange;
  dateFrom: string;
  dateTo: string;
};

export function filterWinnerVideosClient(
  videos: WinnerVideoRecord[],
  opts: ResearchManageFilterOpts,
): WinnerVideoRecord[] {
  let result = videos;

  if (opts.status) {
    result = result.filter((v) => v.status === opts.status);
  }

  if (opts.contentType) {
    result = result.filter((v) => v.content_type === opts.contentType);
  }

  if (opts.videoType) {
    result = result.filter((v) => researchDisplayVideoType(v) === opts.videoType);
  }

  if (opts.source) {
    result = result.filter((v) => researchSubmissionSource(v) === opts.source);
  }

  if (opts.modelId?.trim()) {
    const id = opts.modelId.trim();
    result = result.filter((v) => v.reference_model_id === id);
  } else if (opts.modelName?.trim()) {
    const name = opts.modelName.trim().toLowerCase();
    result = result.filter((v) => v.reference_model_name.trim().toLowerCase() === name);
  }

  if (opts.bunchId?.trim()) {
    const id = opts.bunchId.trim();
    result = result.filter((v) => v.bunch_id === id);
  }

  if (opts.submitterId?.trim()) {
    const id = opts.submitterId.trim();
    result = result.filter((v) => v.submitted_by_id === id);
  }

  const q = opts.search?.trim().toLowerCase();
  if (q) {
    result = result.filter((v) => {
      const hay = [
        v.note,
        v.submitted_by_name,
        v.reference_model_name,
        v.bunch_name,
        v.video_link,
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }

  if (opts.dateRange === "7d") {
    const cutoff = startOfDayMs(isoDateDaysAgo(7));
    result = result.filter((v) => submittedAtMs(v) >= cutoff);
  } else if (opts.dateRange === "30d") {
    const cutoff = startOfDayMs(isoDateDaysAgo(30));
    result = result.filter((v) => submittedAtMs(v) >= cutoff);
  } else if (opts.dateRange === "custom") {
    if (opts.dateFrom) {
      const from = startOfDayMs(opts.dateFrom);
      result = result.filter((v) => submittedAtMs(v) >= from);
    }
    if (opts.dateTo) {
      const to = endOfDayMs(opts.dateTo);
      result = result.filter((v) => submittedAtMs(v) <= to);
    }
  }

  return result;
}

/** Pending oldest-first; other statuses newest-first. */
export function sortResearchManageVideos(videos: WinnerVideoRecord[]): WinnerVideoRecord[] {
  return [...videos].sort((a, b) => {
    if (a.status === "Pending" && b.status === "Pending") {
      return submittedAtMs(a) - submittedAtMs(b);
    }
    if (a.status === "Pending") return -1;
    if (b.status === "Pending") return 1;
    return submittedAtMs(b) - submittedAtMs(a);
  });
}

export function groupWinnerVideosByStatus(
  videos: WinnerVideoRecord[],
): Record<WinnerVideoStatus, WinnerVideoRecord[]> {
  const groups: Record<WinnerVideoStatus, WinnerVideoRecord[]> = {
    Pending: [],
    Approved: [],
    Rejected: [],
    Recreated: [],
    Published: [],
  };
  for (const video of videos) {
    groups[video.status].push(video);
  }
  return groups;
}

export function groupWinnerVideosBySource(videos: WinnerVideoRecord[]): {
  bunchFills: WinnerVideoRecord[];
  other: WinnerVideoRecord[];
} {
  const bunchFills: WinnerVideoRecord[] = [];
  const other: WinnerVideoRecord[] = [];
  for (const v of videos) {
    if (researchSubmissionSource(v) === "bunch_fill") bunchFills.push(v);
    else other.push(v);
  }
  return { bunchFills: sortResearchManageVideos(bunchFills), other: sortResearchManageVideos(other) };
}

export function researchManageStats(videos: WinnerVideoRecord[]) {
  const today = getTodayYmdAthens();
  const todayStart = startOfDayMs(today);
  const todayEnd = endOfDayMs(today);

  let pending = 0;
  let pendingBunch = 0;
  let approvedToday = 0;
  let rejectedToday = 0;

  for (const v of videos) {
    if (v.status === "Pending") {
      pending += 1;
      if (v.bunch_id?.trim()) pendingBunch += 1;
    }
    const reviewed = reviewedAtMs(v);
    if (reviewed >= todayStart && reviewed <= todayEnd) {
      if (v.status === "Approved" || v.status === "Recreated" || v.status === "Published") {
        approvedToday += 1;
      } else if (v.status === "Rejected") {
        rejectedToday += 1;
      }
    }
  }

  return { pending, pendingBunch, approvedToday, rejectedToday, total: videos.length };
}

/** Age hint for pending queue priority (ms since submit). */
export function pendingAgeMs(video: WinnerVideoRecord): number {
  const submitted = submittedAtMs(video);
  if (!submitted) return 0;
  return Math.max(0, Date.now() - submitted);
}

export function pendingAgeLabel(video: WinnerVideoRecord): string | null {
  if (video.status !== "Pending") return null;
  const ms = pendingAgeMs(video);
  if (ms < 60_000) return "Just now";
  const hours = ms / 3_600_000;
  if (hours < 1) return `${Math.max(1, Math.round(ms / 60_000))}m waiting`;
  if (hours < 48) return `${Math.round(hours)}h waiting`;
  return `${Math.round(hours / 24)}d waiting`;
}

export function isStalePending(video: WinnerVideoRecord, hours = 24): boolean {
  return video.status === "Pending" && pendingAgeMs(video) >= hours * 3_600_000;
}
