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
