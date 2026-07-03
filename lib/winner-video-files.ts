import type { WinnerVideoRecord } from "@/services/winner-videos";

/** Per-file limit for winner video uploads to Airtable `video_file` (matches next.config body limit). */
export const WINNER_VIDEO_MAX_FILE_BYTES = 100 * 1024 * 1024;

export const WINNER_VIDEO_ACCEPT =
  "video/mp4,video/quicktime,video/webm,video/x-msvideo,video/x-m4v,.mp4,.mov,.webm,.avi,.m4v";

const ALLOWED_VIDEO_TYPES = new Set([
  "video/mp4",
  "video/quicktime",
  "video/webm",
  "video/x-msvideo",
  "video/x-m4v",
]);

export function isAllowedWinnerVideoType(type: string, filename: string): boolean {
  const t = type.trim().toLowerCase();
  if (ALLOWED_VIDEO_TYPES.has(t)) return true;
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  return ["mp4", "mov", "webm", "avi", "m4v"].includes(ext);
}

export function validateWinnerVideoFileSize(bytes: number): string | null {
  if (bytes > WINNER_VIDEO_MAX_FILE_BYTES) {
    return `Video must be under ${WINNER_VIDEO_MAX_FILE_BYTES / (1024 * 1024)} MB.`;
  }
  return null;
}

export function getWinnerVideoFileUrl(video: WinnerVideoRecord): string | null {
  const url = video.video_file[0]?.url?.trim();
  return url || null;
}
