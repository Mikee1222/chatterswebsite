import * as React from "react";
import { cn } from "@/lib/utils";

export function MobileFormField({
  label,
  icon,
  children,
  error,
  className,
}: {
  label: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  error?: string;
  className?: string;
}) {
  return (
    <div className={cn("space-y-2", className)}>
      <label className="flex items-center gap-2 text-sm font-medium text-zinc-300">
        {icon ? <span className="text-pink-400">{icon}</span> : null}
        {label}
      </label>
      {children}
      {error ? <p className="text-xs text-red-400">{error}</p> : null}
    </div>
  );
}

export type MobileInputProps = React.InputHTMLAttributes<HTMLInputElement>;

export function MobileInput({ className, ...props }: MobileInputProps) {
  return (
    <input
      className={cn(
        "w-full min-h-[44px] rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-[15px] text-white placeholder:text-zinc-500",
        "transition-all duration-200",
        "focus:border-transparent focus:outline-none focus:ring-2 focus:ring-pink-500/80",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "touch-manipulation",
        className
      )}
      {...props}
    />
  );
}

export type MobileTextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

export function MobileTextarea({ className, rows = 4, ...props }: MobileTextareaProps) {
  return (
    <textarea
      rows={rows}
      className={cn(
        "w-full resize-none rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-[15px] text-white placeholder:text-zinc-500",
        "transition-all duration-200",
        "focus:border-transparent focus:outline-none focus:ring-2 focus:ring-pink-500/80",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "touch-manipulation",
        className
      )}
      {...props}
    />
  );
}
