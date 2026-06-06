"use client";

import { Droplet } from "lucide-react";
import * as React from "react";

const TOOLTIP = "Period day — sensitive content restrictions may apply";

type Props = {
  /** When true, show a compact dot instead of emoji. */
  variant?: "dot" | "emoji";
  className?: string;
};

export function PeriodDayIndicator({ variant = "dot", className = "" }: Props) {
  const [open, setOpen] = React.useState(false);

  if (variant === "emoji") {
    return (
      <span className={`inline-flex items-center ${className}`}>
        <button
          type="button"
          className="cursor-default border-0 bg-transparent p-0 text-[13px] leading-none text-rose-300/90 hover:text-rose-200"
          title={TOOLTIP}
          aria-label={TOOLTIP}
          onClick={() => setOpen((v) => !v)}
        >
          <Droplet className="h-3.5 w-3.5 text-rose-400" aria-hidden />
        </button>
        {open && (
          <span className="sr-only" role="status">
            {TOOLTIP}
          </span>
        )}
      </span>
    );
  }

  return (
    <span
      className={`inline-block h-2 w-2 shrink-0 rounded-full bg-rose-400/80 shadow-[0_0_0_1px_rgba(0,0,0,0.35)] ring-1 ring-rose-300/30 ${className}`}
      title={TOOLTIP}
      role="img"
      aria-label={TOOLTIP}
    />
  );
}
