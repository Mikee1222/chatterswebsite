"use client";

import { cn } from "@/lib/utils";

export function SopModalFooter({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-stretch",
        className
      )}
    >
      {children}
    </div>
  );
}
