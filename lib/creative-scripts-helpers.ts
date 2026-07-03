export const SCRIPT_STATUSES = [
  "Not Applicable",
  "Needs Script",
  "Pending Review",
  "Approved",
  "Rejected",
] as const;

export type ScriptStatus = (typeof SCRIPT_STATUSES)[number];

export const SCRIPT_VIDEO_TYPES = ["Storytelling", "UGC", "Other"] as const;

export type ScriptVideoType = (typeof SCRIPT_VIDEO_TYPES)[number];

export function coerceScriptStatus(raw: unknown): ScriptStatus {
  const s = String(raw ?? "").trim() as ScriptStatus;
  if ((SCRIPT_STATUSES as readonly string[]).includes(s)) return s;
  return "Not Applicable";
}

export function coerceScriptVideoType(raw: unknown): ScriptVideoType | "" {
  const s = String(raw ?? "").trim() as ScriptVideoType;
  return (SCRIPT_VIDEO_TYPES as readonly string[]).includes(s) ? s : "";
}

export const SCRIPT_STATUS_STYLES: Record<
  ScriptStatus,
  { label: string; className: string; glowClassName?: string }
> = {
  "Not Applicable": {
    label: "Not Applicable",
    className: "border-[#B8B4B8]/25 bg-[#B8B4B8]/8 text-[#B8B4B8]/55",
    glowClassName: "shadow-[0_0_12px_-4px_rgba(184,180,184,0.2)]",
  },
  "Needs Script": {
    label: "Needs Script",
    className: "border-amber-500/35 bg-amber-500/12 text-amber-200",
    glowClassName: "shadow-[0_0_12px_-4px_rgba(245,158,11,0.45)]",
  },
  "Pending Review": {
    label: "Pending Review",
    className: "border-sky-500/35 bg-sky-500/12 text-sky-200",
    glowClassName: "shadow-[0_0_12px_-4px_rgba(14,165,233,0.4)]",
  },
  Approved: {
    label: "Approved",
    className: "border-emerald-500/35 bg-emerald-500/12 text-emerald-200",
    glowClassName: "shadow-[0_0_12px_-4px_rgba(16,185,129,0.4)]",
  },
  Rejected: {
    label: "Rejected",
    className: "border-red-500/35 bg-red-500/12 text-red-200",
    glowClassName: "shadow-[0_0_12px_-4px_rgba(239,68,68,0.45)]",
  },
};
