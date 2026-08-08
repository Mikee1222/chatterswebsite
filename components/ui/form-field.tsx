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
        "transition-[border-color,box-shadow] duration-200 ease-out",
        "max-md:rounded-none max-md:border-0 max-md:bg-transparent max-md:p-0 max-md:shadow-none max-md:focus-within:ring-0",
        "md:rounded-xl md:border md:border-white/10 md:bg-[#1a1a1a] md:p-4 md:shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]",
        "md:focus-within:border-[#FF1493]/40 md:focus-within:ring-1 md:focus-within:ring-[#FF1493]/20",
        error &&
          "max-md:ring-0 md:border-rose-500/35 md:ring-1 md:ring-rose-500/15 md:focus-within:border-rose-500/40",
        className
      )}
    >
      <label
        htmlFor={htmlFor}
        className="mb-0 flex cursor-default items-center gap-2 text-sm font-medium text-[#FF1493] max-md:mb-2"
      >
        <span
          className="flex shrink-0 items-center justify-center text-[#FF1493] [&_svg]:h-4 [&_svg]:w-4"
          aria-hidden
        >
          {icon}
        </span>
        <span>{label}</span>
        {required ? (
          <span className="text-[#FF1493]" aria-hidden>
            *
          </span>
        ) : null}
      </label>
      {description ? (
        <p className="mt-1.5 text-xs leading-relaxed text-white/50">{description}</p>
      ) : null}
      <div className="mt-0 md:mt-3">{children}</div>
      {error ? (
        <p className="mt-2 text-xs text-rose-300/95" role="alert">
          {error}
        </p>
      ) : null}
    </motion.div>
  );
}
