"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

const paddingClasses = {
  none: "",
  sm: "p-3",
  md: "p-4",
  lg: "p-6",
} as const;

export type MobileCardProps = {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
  padding?: keyof typeof paddingClasses;
};

/**
 * Rounded card tuned for touch-first dashboards (matches pink/zinc chatting surfaces).
 */
export function MobileCard({ children, onClick, className = "", padding = "md" }: MobileCardProps) {
  const base = cn(
    "w-full rounded-2xl border border-zinc-800 bg-zinc-900/90 text-left shadow-sm ring-1 ring-white/[0.04]",
    paddingClasses[padding],
    onClick && "cursor-pointer transition-colors active:bg-zinc-800/90",
    className
  );

  if (onClick) {
    return (
      <motion.button
        type="button"
        onClick={onClick}
        whileTap={{ scale: 0.985 }}
        className={cn(base, "touch-manipulation")}
      >
        {children}
      </motion.button>
    );
  }

  return <div className={base}>{children}</div>;
}

export type MobileTouchButtonProps = {
  children: React.ReactNode;
  onClick: () => void;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  fullWidth?: boolean;
  disabled?: boolean;
  className?: string;
  type?: "button" | "submit";
};

export function MobileTouchButton({
  children,
  onClick,
  variant = "primary",
  fullWidth = true,
  disabled = false,
  className,
  type = "button",
}: MobileTouchButtonProps) {
  const variants: Record<NonNullable<MobileTouchButtonProps["variant"]>, string> = {
    primary:
      "bg-gradient-to-r from-pink-500 to-purple-600 text-white shadow-md shadow-pink-500/20 ring-1 ring-white/15",
    secondary: "border border-zinc-700 bg-zinc-800 text-white hover:bg-zinc-800/90",
    ghost: "border border-zinc-700 bg-transparent text-white hover:bg-white/[0.06]",
    danger: "border border-red-500/30 bg-red-500/10 text-red-300 hover:bg-red-500/15",
  };

  return (
    <motion.button
      type={type}
      whileTap={disabled ? undefined : { scale: 0.98 }}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex min-h-[44px] min-w-[44px] items-center justify-center gap-2 rounded-xl px-5 py-3 text-[15px] font-semibold transition-colors",
        "disabled:cursor-not-allowed disabled:opacity-45",
        variants[variant],
        fullWidth && "w-full",
        "touch-manipulation",
        className
      )}
    >
      {children}
    </motion.button>
  );
}
