/** Checklist step types — must match Airtable single-select on template + phase items. */
export const TASK_STEP_TYPES = [
  "IP Check",
  "Warm-up",
  "Posting",
  "Engagement",
  "Other",
] as const;

export type TaskStepType = (typeof TASK_STEP_TYPES)[number];

export const DEFAULT_TASK_STEP_TYPE: TaskStepType = "Other";

export function coerceTaskStepType(raw: unknown): TaskStepType {
  const s = String(raw ?? "").trim() as TaskStepType;
  return (TASK_STEP_TYPES as readonly string[]).includes(s) ? s : DEFAULT_TASK_STEP_TYPE;
}

/** Best-effort category from checklist title when DB/clone left step_type as Other. */
export function inferTaskStepTypeFromTitle(title: string): TaskStepType | null {
  const t = title.trim().toLowerCase();
  if (!t) return null;
  if (t.includes("mobile data") || t.includes("ip check")) return "IP Check";
  if (t.includes("tik tok scroll") || (t.includes("repost") && t.includes("tik tok"))) return "Other";
  if (t.includes("scroll time")) return "Warm-up";
  if (
    t.startsWith("post ") ||
    t.includes(" post ") ||
    t.includes("story") ||
    t.includes("reel") ||
    t.includes("spotlight") ||
    t.includes("cta story")
  ) {
    return "Posting";
  }
  if (
    t.includes("follow") ||
    t.includes("friend") ||
    t.includes("engagement") ||
    t.includes("reply") ||
    t.includes("repost") ||
    t.includes("comment") ||
    t.includes("accept")
  ) {
    return "Engagement";
  }
  return null;
}
