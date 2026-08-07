/** Filming status for a video bunch after scripts are approved. */
export const FILMING_STATUSES = ["unassigned", "assigned", "in_progress", "uploaded"] as const;
export type FilmingStatus = (typeof FILMING_STATUSES)[number];

export function coerceFilmingStatus(raw: unknown): FilmingStatus {
  const s = String(raw ?? "").trim().toLowerCase();
  if ((FILMING_STATUSES as readonly string[]).includes(s)) return s as FilmingStatus;
  return "unassigned";
}

export const FILMING_STATUS_LABELS: Record<FilmingStatus, string> = {
  unassigned: "Unassigned",
  assigned: "Assigned",
  in_progress: "In progress",
  uploaded: "Uploaded",
};

export const FILMING_STATUS_STYLES: Record<FilmingStatus, { label: string; className: string }> = {
  unassigned: {
    label: "Unassigned",
    className: "bg-white/10 text-white/60",
  },
  assigned: {
    label: "Assigned",
    className: "bg-[#D4AF8C]/15 text-[#D4AF8C]",
  },
  in_progress: {
    label: "In progress",
    className: "bg-[#FF1493]/15 text-[#FF1493]",
  },
  uploaded: {
    label: "Uploaded",
    className: "bg-emerald-500/15 text-emerald-300",
  },
};

/** True when every filled slot has an Approved script (ready to assign to a filmer). */
export function bunchScriptsReadyForFilming(slots: { status: string; video_link?: string; description?: string }[]): boolean {
  const filled = slots.filter((s) => {
    const link = (s.video_link ?? "").trim();
    const desc = (s.description ?? "").trim();
    return Boolean(link || desc) || s.status === "Approved" || s.status === "Pending Review" || s.status === "Needs Script" || s.status === "Rejected";
  });
  if (filled.length === 0) return false;
  return filled.every((s) => s.status === "Approved");
}
