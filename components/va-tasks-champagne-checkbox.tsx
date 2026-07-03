"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  checked: boolean;
  disabled?: boolean;
  onClick?: () => void;
  title?: string;
  className?: string;
};

/** Champagne-outline checkbox for VA task checklist items. */
export function ChampagneCheckbox({ checked, disabled, onClick, title, className }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-[4px] border-2 transition-all duration-200 motion-reduce:transition-none",
        checked
          ? "border-[#D4AF8C] bg-[#D4AF8C]/15 shadow-[0_0_10px_rgba(212,175,140,0.25)]"
          : disabled
            ? "cursor-not-allowed border-white/8 bg-white/[0.03] opacity-40"
            : "border-[#D4AF8C]/45 bg-transparent hover:border-[#D4AF8C] hover:bg-[#D4AF8C]/8",
        className,
      )}
    >
      {checked ? <Check className="h-3 w-3 text-[#D4AF8C]" strokeWidth={3} aria-hidden /> : null}
    </button>
  );
}
