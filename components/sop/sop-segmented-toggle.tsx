"use client";

import { cn } from "@/lib/utils";

export function SopSegmentedToggle<T extends string>({
  value,
  onChange,
  options,
  name,
  className,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  name: string;
  className?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={name}
      className={cn(
        "grid gap-1 rounded-2xl border border-white/10 bg-black/30 p-1",
        options.length === 2 ? "grid-cols-2" : `grid-cols-${options.length}`,
        className
      )}
    >
      {options.map((opt) => {
        const selected = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(opt.value)}
            className={cn(
              "min-h-[44px] rounded-xl px-3 py-2.5 text-sm font-medium transition",
              selected
                ? "bg-gradient-to-r from-pink-500/25 to-fuchsia-500/20 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
                : "text-white/55 hover:bg-white/[0.05] hover:text-white/80"
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
