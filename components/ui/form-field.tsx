"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export interface FormFieldProps {
  label: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  required?: boolean;
  htmlFor?: string;
  className?: string;
  description?: string;
  error?: string;
  /** Set by `FormStagger`, or pass manually (0, 1, 2, …) for entrance delay. */
  staggerIndex?: number;
}

export function FormField({
  label,
  icon,
  children,
  required,
  htmlFor,
  className,
  description,
  error,
  staggerIndex,
}: FormFieldProps) {
  const delay = staggerIndex != null ? Math.min(staggerIndex, 24) * 0.045 : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.26,
        delay,
        ease: [0.22, 1, 0.36, 1],
      }}
      className={cn(
        "rounded-xl border border-white/10 bg-[#1a1a1a] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] transition-[border-color,box-shadow] duration-200 ease-out",
        "focus-within:border-pink-500/40 focus-within:ring-1 focus-within:ring-pink-500/20",
        error && "border-rose-500/35 ring-1 ring-rose-500/15 focus-within:border-rose-500/40",
        className
      )}
    >
      <label
        htmlFor={htmlFor}
        className="flex cursor-default items-center gap-2 text-sm font-medium text-pink-400"
      >
        <span
          className="flex shrink-0 items-center justify-center text-pink-400 [&_svg]:h-4 [&_svg]:w-4"
          aria-hidden
        >
          {icon}
        </span>
        <span>{label}</span>
        {required ? (
          <span className="text-pink-500" aria-hidden>
            *
          </span>
        ) : null}
      </label>
      {description ? (
        <p className="mt-1.5 text-xs leading-relaxed text-white/50">{description}</p>
      ) : null}
      <div className="mt-3">{children}</div>
      {error ? (
        <p className="mt-2 text-xs text-rose-300/95" role="alert">
          {error}
        </p>
      ) : null}
    </motion.div>
  );
}
