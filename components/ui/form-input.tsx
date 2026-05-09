"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

const formShellControlClass = cn(
  "w-full min-h-[52px] origin-center rounded-2xl border border-white/10 bg-white/5 px-4 py-3.5 text-[15px] text-white placeholder:text-white/30 [color-scheme:dark] transition-[border-color,box-shadow,background-color,transform] duration-200 ease-out",
  "focus:border-pink-500/50 focus:outline-none focus:ring-0",
  "md:rounded-xl md:border-white/12 md:bg-[#1a1a1a] md:py-4 md:placeholder:text-white/40 md:hover:border-pink-400/30 md:hover:bg-[#1f1f1f]",
  "md:focus:border-pink-500 md:focus:ring-2 md:focus:ring-pink-500/25 md:focus:bg-[#1f1f1f] md:focus:scale-[1.01]"
);

const formShellErrorClass =
  "border-rose-500/60 bg-rose-500/[0.07] focus:border-rose-500 focus:ring-0 md:focus:ring-2 md:focus:ring-rose-500/25";

const formShellSuccessClass =
  "border-emerald-500/50 bg-emerald-500/[0.05] focus:border-emerald-500/70 focus:ring-0 md:focus:ring-2 md:focus:ring-emerald-500/20";

const disabledControlClass =
  "cursor-not-allowed opacity-60 focus:border-white/12 focus:ring-0 focus:scale-100 md:hover:border-white/12 md:hover:bg-[#1a1a1a] md:focus:border-white/12 md:focus:ring-0 md:focus:scale-100";

function hasErrorState(error: string | boolean | undefined): boolean {
  return error === true || (typeof error === "string" && error.trim().length > 0);
}

function errorMessageText(error: string | boolean | undefined): string | null {
  if (typeof error === "string" && error.trim()) return error.trim();
  return null;
}

export type FormControlErrorProp = string | boolean | undefined;

export const FormInput = React.forwardRef<
  HTMLInputElement,
  React.ComponentPropsWithoutRef<"input"> & {
    error?: FormControlErrorProp;
    success?: boolean;
    successMessage?: string;
  }
>(function FormInput(
  { className, error, success, successMessage, disabled, id, ...props },
  ref
) {
  const err = hasErrorState(error);
  const errMsg = errorMessageText(error);
  const showSuccess = Boolean(success && !err);
  const errId = React.useId();
  const describedBy = errMsg ? (id ? `${id}-error` : errId) : undefined;

  return (
    <div className={cn("w-full", err && "animate-form-shake")}>
      <div className="relative">
        <input
          ref={ref}
          id={id}
          disabled={disabled}
          aria-invalid={err || undefined}
          aria-describedby={describedBy}
          className={cn(
            formShellControlClass,
            err && formShellErrorClass,
            showSuccess && formShellSuccessClass,
            disabled && disabledControlClass,
            showSuccess && "pr-11",
            className
          )}
          {...props}
        />
        {showSuccess ? (
          <motion.span
            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2"
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          >
            <Check className="h-4 w-4 text-emerald-400/95" aria-hidden />
          </motion.span>
        ) : null}
      </div>
      {errMsg ? (
        <p
          id={id ? `${id}-error` : errId}
          className="mt-1.5 text-xs leading-snug text-rose-300/95"
          role="alert"
        >
          {errMsg}
        </p>
      ) : null}
      {showSuccess && successMessage?.trim() ? (
        <motion.p
          className="mt-1.5 text-xs text-emerald-400/90"
          initial={{ opacity: 0, y: 2 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22, delay: 0.04, ease: [0.22, 1, 0.36, 1] }}
        >
          {successMessage.trim()}
        </motion.p>
      ) : null}
    </div>
  );
});

FormInput.displayName = "FormInput";
