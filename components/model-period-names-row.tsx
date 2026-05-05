"use client";

import { PeriodDayIndicator } from "@/components/period-day-indicator";

type Props = {
  modelIds: string[];
  idToName: Record<string, string>;
  dateYmd: string;
  periodDatesByModelId: Record<string, string[]>;
  className?: string;
};

/**
 * Renders model display names for a calendar day with optional period indicator per model.
 */
export function ModelPeriodNamesRow({
  modelIds,
  idToName,
  dateYmd,
  periodDatesByModelId,
  className = "",
}: Props) {
  if (modelIds.length === 0) return null;
  return (
    <div className={`flex flex-wrap items-center gap-x-2 gap-y-1.5 ${className}`}>
      {modelIds.map((id) => {
        const label = idToName[id] || id;
        const inPeriod = (periodDatesByModelId[id] ?? []).includes(dateYmd);
        return (
          <span
            key={id}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white/90"
          >
            <span>{label}</span>
            {inPeriod ? <PeriodDayIndicator /> : null}
          </span>
        );
      })}
    </div>
  );
}
