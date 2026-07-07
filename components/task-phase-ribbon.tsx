"use client";

import * as React from "react";
import type { TaskPhase } from "@/services/task-phases";
import type { PhaseItem } from "@/services/task-phases";
import { cn } from "@/lib/utils";
import { VA_CARD, VA_CARD_INNER } from "@/lib/va-tasks-tokens";

export type PhaseRibbonItem = Pick<
  PhaseItem,
  | "id"
  | "title"
  | "status"
  | "requires_screenshot"
  | "completed_by_va_name"
  | "completed_at"
  | "screenshot"
  | "step_type"
>;

export type PhaseRibbonPhase = Pick<
  TaskPhase,
  | "id"
  | "title"
  | "status"
  | "region"
  | "assigned_model_id"
  | "assigned_model_name"
  | "start_time"
  | "actual_start_time"
  | "actual_end_time"
> & {
  items?: PhaseRibbonItem[];
};

type Props = {
  phases: PhaseRibbonPhase[];
  /** Full timeline for VA task cards; compact for admin builder preview. */
  variant?: "default" | "mini";
  className?: string;
  /** Extra content below phase header (social links, admin controls, etc.) */
  renderPhaseExtra?: (phase: PhaseRibbonPhase, index: number) => React.ReactNode;
  /** Custom checklist row; default renders read-only title. */
  renderItem?: (item: PhaseRibbonItem, phase: PhaseRibbonPhase, index: number) => React.ReactNode;
  emptyMessage?: string;
};

function nodeClass(status: TaskPhase["status"], variant: "default" | "mini") {
  const size = variant === "mini" ? "h-2.5 w-2.5" : "h-3.5 w-3.5";
  if (status === "completed") {
    return cn(size, "border-2 border-[#0D0B0D] bg-[#D4AF8C]");
  }
  if (status === "overdue") {
    return cn(size, "border-2 border-[#0D0B0D] bg-red-500/90");
  }
  if (status === "in_progress") {
    return cn(size, "border-2 border-[#FF1493] bg-[#FF1493]/80");
  }
  return cn(size, "border-2 border-[#D4AF8C]/35 bg-[#151315]");
}

function segmentClass(status: TaskPhase["status"], isLast: boolean) {
  if (isLast) return "hidden";
  if (status === "completed") return "va-ribbon-segment va-ribbon-segment--filled";
  if (status === "in_progress") return "va-ribbon-segment va-ribbon-segment--active";
  return "va-ribbon-segment va-ribbon-segment--pending";
}

const PhaseStatusLabel = React.memo(function PhaseStatusLabel({ status }: { status: TaskPhase["status"] }) {
  const variant =
    status === "completed"
      ? "border-[#D4AF8C]/35 bg-[#D4AF8C]/10 text-[#D4AF8C]"
      : status === "overdue"
        ? "border-red-500/35 bg-red-500/10 text-red-300"
        : status === "in_progress"
          ? "border-[#FF1493]/35 bg-[#FF1493]/10 text-[#FF1493]"
          : "border-white/10 bg-white/[0.04] text-[#B8B4B8]/60";
  return (
    <span
      className={cn(
        "inline-flex rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em]",
        variant,
      )}
    >
      {status.replace(/_/g, " ")}
    </span>
  );
});

function DefaultItemRow({ item }: { item: PhaseRibbonItem }) {
  return (
    <p
      className={cn(
        "text-sm leading-snug",
        item.status === "completed" ? "text-[#B8B4B8]/35 line-through" : "text-[#B8B4B8]",
      )}
    >
      {item.title || "—"}
    </p>
  );
}

export const TaskPhaseRibbon = React.memo(function TaskPhaseRibbon({
  phases,
  variant = "default",
  className,
  renderPhaseExtra,
  renderItem,
  emptyMessage = "No phases for this task",
}: Props) {
  if (phases.length === 0) {
    return (
      <p className={cn(VA_CARD, "py-10 text-center text-sm text-[#B8B4B8]/35")}>
        {emptyMessage}
      </p>
    );
  }

  const isMini = variant === "mini";
  const railLeft = isMini ? "left-[0.3125rem]" : "left-[0.4375rem]";
  const contentPl = isMini ? "pl-5" : "pl-7";

  return (
    <div className={cn("va-phase-ribbon relative", className)}>
      <div
        className={cn(
          "pointer-events-none absolute top-2 bottom-2 w-px bg-gradient-to-b from-[#FF1493]/70 via-[#D4AF8C]/50 to-[#D4AF8C]/20",
          railLeft,
        )}
        aria-hidden
      />

      <div className="space-y-0">
        {phases.map((phase, phaseIndex) => {
          const items = phase.items ?? [];
          const doneCount = items.filter((i) => i.status === "completed").length;
          const total = items.length;
          const isLast = phaseIndex === phases.length - 1;

          return (
            <div key={phase.id} className={cn("relative", !isLast && (isMini ? "pb-4" : "pb-6"))}>
              <div
                className={cn("absolute z-10 rounded-full", nodeClass(phase.status, variant))}
                style={{ left: isMini ? 0 : 1, top: isMini ? 6 : 8 }}
                aria-hidden
              />

              <div
                className={cn(
                  "absolute w-px",
                  railLeft,
                  isMini ? "top-4" : "top-5",
                  segmentClass(phase.status, isLast),
                  isLast ? "h-0" : isMini ? "h-[calc(100%-0.25rem)]" : "h-[calc(100%-0.5rem)]",
                )}
                aria-hidden
              />

              <div className={contentPl}>
                <div
                  className={cn(
                    "overflow-hidden rounded-xl",
                    VA_CARD_INNER,
                    !isMini && "p-4",
                    isMini && "px-3 py-2.5",
                  )}
                >
                  <div className="flex flex-wrap items-start gap-2">
                    <span
                      className={cn(
                        "flex shrink-0 items-center justify-center rounded-full border border-[#D4AF8C]/25 bg-[#D4AF8C]/8 font-semibold tabular-nums text-[#D4AF8C]",
                        isMini ? "h-5 w-5 text-[10px]" : "h-7 w-7 text-xs",
                      )}
                    >
                      {phaseIndex + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p
                          className={cn(
                            "font-semibold text-white",
                            isMini ? "text-xs" : "text-sm",
                          )}
                        >
                          {phase.title || `Phase ${phaseIndex + 1}`}
                        </p>
                        {!isMini ? <PhaseStatusLabel status={phase.status} /> : null}
                      </div>
                      {phase.region && !isMini ? (
                        <p className="mt-0.5 text-xs text-[#B8B4B8]/45">{phase.region}</p>
                      ) : null}
                    </div>
                    {total > 0 ? (
                      <span className="shrink-0 rounded-md border border-[#D4AF8C]/20 bg-[#D4AF8C]/8 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider tabular-nums text-[#D4AF8C]">
                        {doneCount}/{total}
                      </span>
                    ) : null}
                  </div>

                  {renderPhaseExtra?.(phase, phaseIndex)}

                  {items.length > 0 ? (
                    <div className={cn("space-y-1", isMini ? "mt-2" : "mt-3 pt-3")}>
                      {!isMini ? <div className="va-champagne-divider mb-3 h-px w-full" /> : null}
                      {items.map((item, itemIndex) => (
                        <div
                          key={item.id}
                          className={cn(
                            "rounded-lg px-2 py-1.5",
                            item.status === "completed" && "bg-[#D4AF8C]/[0.04]",
                          )}
                        >
                          {renderItem ? renderItem(item, phase, itemIndex) : <DefaultItemRow item={item} />}
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
});
