import type { PhaseItem, TaskPhase } from "@/services/task-phases";

/** Apply a checklist item completion locally (mirrors server-side phase rollup). */
export function applyOptimisticItemCompletion(
  phases: TaskPhase[],
  itemId: string,
  vaName: string,
): TaskPhase[] {
  const now = new Date().toISOString();
  return phases.map((phase) => {
    const itemIndex = phase.items.findIndex((i) => i.id === itemId);
    if (itemIndex === -1) return phase;

    const items: PhaseItem[] = phase.items.map((item, idx) =>
      idx === itemIndex
        ? {
            ...item,
            status: "completed",
            completed_at: now,
            completed_by_va_name: vaName.trim() || "VA",
          }
        : item,
    );

    const allDone = items.length > 0 && items.every((i) => i.status === "completed");
    const anyDone = items.some((i) => i.status === "completed");

    let status = phase.status;
    let start_time = phase.start_time;
    let end_time = phase.end_time;
    let completed_at = phase.completed_at;

    if (anyDone && status === "pending") {
      status = "in_progress";
      start_time = start_time ?? now;
    }
    if (allDone) {
      status = "completed";
      end_time = now;
      completed_at = now;
    }

    return { ...phase, items, status, start_time, end_time, completed_at };
  });
}
