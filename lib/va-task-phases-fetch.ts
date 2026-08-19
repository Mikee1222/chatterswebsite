import type { PhaseItem, TaskPhase } from "@/services/task-phases";
import {
  coerceTaskStepType,
  DEFAULT_TASK_STEP_TYPE,
  inferTaskStepTypeFromTitle,
} from "@/lib/task-step-types";

/** Client fetch options for task phase APIs — always bypass HTTP cache (PWA/mobile Safari). */
export const VA_TASK_PHASES_FETCH_INIT: RequestInit = {
  credentials: "include",
  cache: "no-store",
};

/** JSON response headers for task phase API routes. */
export const VA_TASK_PHASES_JSON_HEADERS = {
  "Cache-Control": "no-store, max-age=0",
} as const;

/**
 * Re-hydrate step_type after fetch. Stale client caches often retain items without
 * step_type (field added after first paint) — infer from title only when missing.
 */
export function normalizeTaskPhasesForClient(phases: TaskPhase[]): TaskPhase[] {
  return phases.map((phase) => ({
    ...phase,
    items: (phase.items ?? []).map((item) => normalizePhaseItemForClient(item)),
  }));
}

export function normalizePhaseItemForClient(item: PhaseItem): PhaseItem {
  const raw = item.step_type;
  if (raw != null && String(raw).trim() !== "") {
    return { ...item, step_type: coerceTaskStepType(raw) };
  }
  return {
    ...item,
    step_type: inferTaskStepTypeFromTitle(item.title) ?? DEFAULT_TASK_STEP_TYPE,
  };
}
