"use client";

import * as React from "react";
import { BarChart3, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

/** Luxury external-link CTA — 44px touch target on mobile. */
export function IgInstagramExternalButton({
  href,
  label = "View on Instagram",
  className,
  onClick,
}: {
  href: string;
  label?: string;
  className?: string;
  onClick?: (e: React.MouseEvent) => void;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      onClick={onClick}
      className={cn(
        "inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-[#D4AF8C]/35 bg-[#D4AF8C]/[0.06] px-4 py-2.5 text-sm font-semibold text-[#E8D0B0] shadow-[inset_0_1px_0_rgba(212,175,140,0.12)] transition hover:border-[#D4AF8C]/55 hover:bg-[#D4AF8C]/[0.1] active:scale-[0.99] md:min-h-0 md:w-auto md:py-2",
        className
      )}
    >
      {label}
      <ExternalLink className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
    </a>
  );
}

/** Luxury in-app detail CTA — opens post detail modal. */
export function IgViewStatsButton({
  onClick,
  className,
}: {
  onClick: (e: React.MouseEvent) => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-[#FF1493]/30 bg-[#FF1493]/[0.08] px-4 py-2.5 text-[13px] font-semibold text-[#FFB6DE] shadow-[inset_0_1px_0_rgba(255,20,147,0.08)] transition hover:border-[#FF1493]/50 hover:bg-[#FF1493]/[0.12] active:scale-[0.99] md:min-h-0 md:w-auto md:py-2",
        className
      )}
    >
      View detailed stats
      <BarChart3 className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
    </button>
  );
}
