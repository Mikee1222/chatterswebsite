export const VIDEO_TRANSCRIPT_STATUSES = ["Processing", "Done", "Failed"] as const;

export type VideoTranscriptStatus = (typeof VIDEO_TRANSCRIPT_STATUSES)[number];

export const VIDEO_TRANSCRIPT_STATUS_STYLES: Record<
  VideoTranscriptStatus,
  { label: string; className: string; glowClassName: string }
> = {
  Processing: {
    label: "Processing",
    className: "border-amber-500/35 bg-amber-500/10 text-amber-200",
    glowClassName: "shadow-[0_0_14px_-4px_rgba(245,158,11,0.4)]",
  },
  Done: {
    label: "Done",
    className: "border-emerald-500/35 bg-emerald-500/10 text-emerald-200",
    glowClassName: "shadow-[0_0_14px_-4px_rgba(16,185,129,0.35)]",
  },
  Failed: {
    label: "Failed",
    className: "border-red-500/35 bg-red-500/10 text-red-200",
    glowClassName: "shadow-[0_0_14px_-4px_rgba(239,68,68,0.35)]",
  },
};

export function coerceVideoTranscriptStatus(raw: unknown): VideoTranscriptStatus {
  const s = String(raw ?? "").trim();
  if (s === "Done" || s === "Failed" || s === "Processing") return s;
  return "Processing";
}

export function getVideoTranscriptFileUrl(record: {
  video_file: Array<{ url?: string }>;
}): string | null {
  const url = record.video_file[0]?.url?.trim();
  return url || null;
}
