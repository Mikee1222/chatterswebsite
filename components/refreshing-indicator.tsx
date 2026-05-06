"use client";

import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type RefreshingIndicatorProps = {
  isRefreshing: boolean;
  className?: string;
  label?: string;
};

export function RefreshingIndicator({
  isRefreshing,
  className,
  label = "Refreshing",
}: RefreshingIndicatorProps) {
  if (!isRefreshing) return null;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-[11px] font-medium text-white/45",
        className
      )}
      aria-live="polite"
    >
      <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
      {label}
    </span>
  );
}
