"use client";

import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { sopReveal } from "./sop-motion";

export function SopEmptyState({
  icon: Icon,
  title,
  description,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  className?: string;
}) {
  return (
    <motion.div
      variants={sopReveal}
      initial="hidden"
      animate="show"
      className={cn(
        "sop-glass-card rounded-2xl border border-dashed border-white/12 px-6 py-14 text-center",
        className
      )}
    >
      <div className="mx-auto flex h-12 w-12 items-center justify-center text-white/30">
        <Icon className="h-7 w-7" strokeWidth={1.5} />
      </div>
      <p className="mt-4 text-sm font-medium text-white/75">{title}</p>
      {description ? <p className="mx-auto mt-1.5 max-w-sm text-sm text-white/45">{description}</p> : null}
    </motion.div>
  );
}
