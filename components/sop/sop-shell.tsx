"use client";

import "./sop-theme.css";
import { cn } from "@/lib/utils";

export function SopShell({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("sop-dark relative min-h-full w-full", className)}>
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        <div className="sop-glow-tl" />
        <div className="sop-glow-br" />
      </div>
      <div className="relative z-10">{children}</div>
    </div>
  );
}
