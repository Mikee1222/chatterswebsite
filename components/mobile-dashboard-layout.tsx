"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export type MobileDashboardLayoutProps = {
  children: React.ReactNode;
  className?: string;
  /**
   * Subtle entry animation for page sections (mobile polish).
   * When false, renders a static wrapper only.
   */
  animate?: boolean;
};

/**
 * Mobile-first content column: `max-w-2xl` centered width, full width on small screens.
 *
 * **Does not** render header or bottom navigation — the shared dashboard shell already
 * provides `MobileAppShell` (sticky header + tab bar + More menu + FABs). Use this to
 * keep page content aligned with the chatting-style narrow column on phones.
 */
export function MobileDashboardLayout({
  children,
  className,
  animate = false,
}: MobileDashboardLayoutProps) {
  /** `isolate` keeps section/backdrop layers predictable; page chrome stays in `MobileAppShell`. */
  const inner = (
    <div className={cn("relative isolate mx-auto w-full max-w-2xl space-y-4 md:space-y-6", className)}>{children}</div>
  );

  if (!animate) {
    return inner;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
    >
      {inner}
    </motion.div>
  );
}
