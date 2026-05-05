"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

function parsePlainNumber(value: string | number): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const t = value.trim().replace(/,/g, "");
    if (t === "" || !/^-?\d+(\.\d+)?$/.test(t)) return null;
    const n = Number(t);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export function StatCard({
  label,
  value,
  className,
}: {
  label: string;
  value: string | number;
  className?: string;
}) {
  const target = parsePlainNumber(value);
  const [display, setDisplay] = React.useState<number | string>(() => (target != null ? 0 : value));

  React.useEffect(() => {
    if (target == null) {
      setDisplay(value);
      return;
    }
    setDisplay(0);
    const start = performance.now();
    const duration = 220;
    let frame: number;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - (1 - t) * (1 - t);
      setDisplay(Math.round(target * eased));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, value]);

  return (
    <div className={cn("stat-card", className)}>
      <p className="text-sm font-medium text-white/75 md:text-white/60">{label}</p>
      <p className="mt-1.5 text-[1.625rem] font-semibold leading-tight tracking-tight text-white md:text-2xl tabular-nums">
        {display}
      </p>
    </div>
  );
}
