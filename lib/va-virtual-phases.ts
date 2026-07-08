import { isVirtualVaTaskId } from "@/lib/recurrence";
import type { PhaseItem, TaskPhase } from "@/services/task-phases";

/**
 * Virtual occurrence ids are `virt_{sourceAirtableId}_{YYYY-MM-DD}`.
 * Source ids are Airtable records (`rec…`); the trailing `_YYYY-MM-DD` is the Athens day.
 */
export function parseVirtualVaTaskId(
  id: string | null | undefined,
): { sourceTaskId: string; ymd: string } | null {
  const raw = id?.trim() ?? "";
  if (!isVirtualVaTaskId(raw)) return null;
  const match = /^virt_(.+)_(\d{4}-\d{2}-\d{2})$/.exec(raw);
  if (!match) return null;
  const sourceTaskId = match[1]?.trim() ?? "";
  const ymd = match[2] ?? "";
  if (!sourceTaskId || !ymd) return null;
  return { sourceTaskId, ymd };
}

/** Resolve the Airtable task whose phases should be projected for display. */
export function resolveVirtualPhaseSourceId(
  taskId: string,
  explicitSourceId?: string | null,
): string | null {
  const explicit = explicitSourceId?.trim();
  if (explicit && !isVirtualVaTaskId(explicit)) return explicit;
  return parseVirtualVaTaskId(taskId)?.sourceTaskId ?? null;
}

/**
 * Map a real task's phase+item structure onto a virtual occurrence for preview.
 * Pending statuses only — no real Airtable ids / checkmarks. Does not persist.
 */
export function projectPhasesForVirtualOccurrence(
  sourcePhases: TaskPhase[],
  virtualTaskId: string,
): TaskPhase[] {
  const virtId = virtualTaskId.trim();
  if (!virtId || !isVirtualVaTaskId(virtId)) return [];

  return sourcePhases.map((phase, phaseIdx) => {
    const virtPhaseId = `virt_phase_${virtId}_${phase.phase_number || phaseIdx + 1}`;
    const stablePhaseId = phase.phase_id || phase.id;
    const items: PhaseItem[] = (phase.items ?? []).map((item, itemIdx) => ({
      ...item,
      id: `virt_item_${virtId}_${stablePhaseId}_${item.sort_order ?? itemIdx}`,
      item_id: `virt_item_${virtId}_${stablePhaseId}_${item.sort_order ?? itemIdx}`,
      phase_id: virtPhaseId,
      task_id: virtId,
      status: "pending",
      screenshot: [],
      completed_by_va_id: "",
      completed_by_va_name: "",
      completed_at: null,
    }));

    return {
      ...phase,
      id: virtPhaseId,
      phase_id: virtPhaseId,
      task_id: virtId,
      status: "pending",
      start_time: null,
      end_time: null,
      completed_at: null,
      items,
    };
  });
}
