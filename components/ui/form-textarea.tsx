"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

const formShellTextareaClass =
  "w-full min-h-[120px] origin-top resize-y rounded-xl border border-white/12 bg-[#1a1a1a] px-4 py-4 text-[15px] text-white placeholder:text-white/40 [color-scheme:dark] transition-[border-color,box-shadow,background-color,transform] duration-200 ease-out hover:border-pink-400/30 hover:bg-[#1f1f1f] focus:border-pink-500 focus:outline-none focus:ring-2 focus:ring-pink-500/25 focus:bg-[#1f1f1f] focus:scale-[1.01]";

const formShellErrorClass =
  "border-rose-500/60 bg-rose-500/[0.07] focus:border-rose-500 focus:ring-rose-500/25";

const formShellSuccessClass =
  "border-emerald-500/50 bg-emerald-500/[0.05] focus:border-emerald-500/70 focus:ring-emerald-500/20";

const disabledTextareaClass =
  "cursor-not-allowed opacity-60 hover:border-white/12 hover:bg-[#1a1a1a] focus:border-white/12 focus:ring-0 focus:scale-100";

function hasErrorState(error: string | boolean | undefined): boolean {
  return error === true || (typeof error === "string" && error.trim().length > 0);
}

function errorMessageText(error: string | boolean | undefined): string | null {
  if (typeof error === "string" && error.trim()) return error.trim();
  return null;
}

export type FormControlErrorProp = string | boolean | undefined;

export const FormTextarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentPropsWithoutRef<"textarea"> & {
    error?: FormControlErrorProp;
    success?: boolean;
    successMessage?: string;
  }
>(function FormTextarea(
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
        <textarea
          ref={ref}
          id={id}
          disabled={disabled}
          aria-invalid={err || undefined}
          aria-describedby={describedBy}
          className={cn(
            formShellTextareaClass,
            err && formShellErrorClass,
            showSuccess && formShellSuccessClass,
            disabled && disabledTextareaClass,
            showSuccess && "pr-10",
            className
          )}
          {...props}
        />
        {showSuccess ? (
          <motion.span
            className="pointer-events-none absolute right-3 top-3"
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

FormTextarea.displayName = "FormTextarea";
