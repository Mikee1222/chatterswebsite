"use client";

import {
  autoFlagBadgeClass,
  type ApplicationAutoFlag,
} from "@/lib/application-candidate-flags";
import { cn } from "@/lib/utils";

export function ApplicationFlagBadges({
  flags,
  className,
  max = 3,
}: {
  flags: ApplicationAutoFlag[] | null | undefined;
  className?: string;
  max?: number;
}) {
  if (!flags?.length) return null;
  return (
    <div className={cn("flex flex-wrap gap-1.5", className)}>
      {flags.slice(0, max).map((f) => (
        <span
          key={f.id}
          className={cn(
            "inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-medium tracking-wide",
            autoFlagBadgeClass(f.severity),
          )}
        >
          {f.label}
        </span>
      ))}
    </div>
  );
}
