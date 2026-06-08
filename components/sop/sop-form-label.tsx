"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function SopFormLabel({
  htmlFor,
  children,
  className,
}: {
  htmlFor?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className={cn(
        "mb-2 block text-[11px] font-semibold uppercase tracking-wider text-white/45",
        className
      )}
    >
      {children}
    </label>
  );
}

export function SopFormSectionTitle({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <p
      className={cn(
        "text-[11px] font-semibold uppercase tracking-wider text-white/45",
        className
      )}
    >
      {children}
    </p>
  );
}
