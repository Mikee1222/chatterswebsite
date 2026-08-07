/** Editing status for a video bunch after filming upload. */
export const EDITING_STATUSES = ["unassigned", "assigned", "in_progress", "uploaded"] as const;
export type EditingStatus = (typeof EDITING_STATUSES)[number];

export function coerceEditingStatus(raw: unknown): EditingStatus {
  const s = String(raw ?? "").trim().toLowerCase();
  if ((EDITING_STATUSES as readonly string[]).includes(s)) return s as EditingStatus;
  return "unassigned";
}

export const EDITING_STATUS_LABELS: Record<EditingStatus, string> = {
  unassigned: "Unassigned",
  assigned: "Assigned",
  in_progress: "In progress",
  uploaded: "Edited & Uploaded",
};

export const EDITING_STATUS_STYLES: Record<EditingStatus, { label: string; className: string }> = {
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
    label: "Edited & Uploaded",
    className: "bg-emerald-500/15 text-emerald-300",
  },
};

/** True when filming is uploaded — editing can be assigned. */
export function bunchReadyForEditing(bunch: { filming_status?: string }): boolean {
  return String(bunch.filming_status ?? "").toLowerCase() === "uploaded";
}
