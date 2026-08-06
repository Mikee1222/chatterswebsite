import { addDaysAthensYmd, getTodayYmdAthens } from "@/lib/airtable-datetime";
import type { WinnerVideoStatus, WinnerVideoContentType } from "@/lib/winner-videos-helpers";
import type { WinnerVideoRecord } from "@/services/winner-videos";
import type { CustomSelectOption } from "@/components/manager-review-ui";
import { WINNER_VIDEO_CONTENT_TYPES } from "@/lib/winner-videos-helpers";

export type WinnerVideoDateRange = "all" | "7d" | "30d" | "custom";

export type WinnerVideoViewMode = "list" | "board";

export function isoDateDaysAgo(days: number): string {
  return addDaysAthensYmd(getTodayYmdAthens(), -days);
}

export const WINNER_VIDEO_CONTENT_TYPE_FILTER_OPTIONS: CustomSelectOption[] = [
  { value: "", label: "All types" },
  ...WINNER_VIDEO_CONTENT_TYPES.map((type) => ({ value: type, label: type })),
];

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

function startOfDayMs(ymd: string): number {
  return new Date(`${ymd}T00:00:00.000Z`).getTime();
}

function endOfDayMs(ymd: string): number {
  return new Date(`${ymd}T23:59:59.999Z`).getTime();
}

export function filterWinnerVideosClient(
  videos: WinnerVideoRecord[],
  opts: {
    status?: WinnerVideoStatus | "";
    contentType?: WinnerVideoContentType | "";
    dateRange: WinnerVideoDateRange;
    dateFrom: string;
    dateTo: string;
  },
): WinnerVideoRecord[] {
  let result = videos;

  if (opts.status) {
    result = result.filter((v) => v.status === opts.status);
  }

  if (opts.contentType) {
    result = result.filter((v) => v.content_type === opts.contentType);
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
