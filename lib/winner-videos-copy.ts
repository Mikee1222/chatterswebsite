import type { WinnerVideoRecord } from "@/services/winner-videos";

const BULK_SEPARATOR = "—————";

/** Copy-friendly date, e.g. "3 Jul 2026". */
export function formatWinnerVideoCopyDate(isoString: string | null | undefined): string {
  if (!isoString?.trim()) return "—";
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function formatWinnerVideoSingleCopy(video: WinnerVideoRecord): string {
  const lines = [
    video.reference_model_name?.trim() || "—",
    video.video_link?.trim() || "",
  ].filter(Boolean);

  if (video.note?.trim()) lines.push(video.note.trim());
  lines.push(`Submitted: ${formatWinnerVideoCopyDate(video.submitted_at)}`);
  return lines.join("\n");
}

export function formatWinnerVideoBulkCopy(videos: WinnerVideoRecord[]): string {
  return videos
    .map((video, index) => {
      const header = `${index + 1}. ${(video.reference_model_name?.trim() || "—").toUpperCase()} — ${formatWinnerVideoCopyDate(video.submitted_at)}`;
      const lines = [header, video.video_link?.trim() || ""].filter(Boolean);
      if (video.note?.trim()) lines.push(video.note.trim());
      return lines.join("\n");
    })
    .join(`\n${BULK_SEPARATOR}\n`);
}

export async function copyTextToClipboard(text: string): Promise<boolean> {
  try {
    if (!navigator.clipboard?.writeText) return false;
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function truncateNote(note: string | null | undefined, maxLen = 80): string {
  const trimmed = note?.trim() ?? "";
  if (!trimmed) return "";
  if (trimmed.length <= maxLen) return trimmed;
  return `${trimmed.slice(0, maxLen).trimEnd()}…`;
}
