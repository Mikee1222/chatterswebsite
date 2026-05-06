"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { HTMLMotionProps } from "framer-motion";
import { Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/** Shared pink→purple gradient for primary actions (e.g. settings save, add user). */
export const formGradientButtonClass =
  "rounded-xl border border-transparent bg-gradient-to-r from-[#e91e8c] via-[#ec4899] to-[#d946ef] px-5 py-4 text-[15px] font-semibold text-white shadow-[0_0_28px_-6px_rgba(233,30,140,0.45)] transition-[box-shadow,transform] duration-200 ease-out hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-pink-500/45 focus:ring-offset-2 focus:ring-offset-[#050505] disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none inline-flex items-center justify-center";

const formSubmitGradientClass = cn(
  "w-full min-h-[52px]",
  formGradientButtonClass
);

const hoverLiftShadow =
  "0 12px 40px -10px rgba(233,30,140,0.55), 0 0 36px -6px rgba(236,72,153,0.42)";

export function FormSubmitButton({
  children,
  className,
  disabled,
  loading,
  success,
  successLabel = "Saved",
  ...props
}: HTMLMotionProps<"button"> & {
  children: React.ReactNode;
  /** Shows a spinner and disables the button; add your own label in `children` or rely on default pairing. */
  loading?: boolean;
  /** Brief success state: checkmark fades in (use after submit succeeds). */
  success?: boolean;
  successLabel?: string;
}) {
  const isBusy = Boolean(disabled || loading);
  const showDefaultContent = !success || loading;

  return (
    <motion.button
      type="submit"
      disabled={isBusy}
      className={cn(formSubmitGradientClass, "relative overflow-hidden", className)}
      whileHover={
        isBusy
          ? undefined
          : {
              y: -2,
              boxShadow: hoverLiftShadow,
            }
      }
      whileTap={isBusy ? undefined : { scale: 0.98 }}
      transition={{ type: "tween", duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
      {...props}
    >
      <AnimatePresence mode="wait" initial={false}>
        {success && !loading ? (
          <motion.span
            key="success"
            className="inline-flex items-center justify-center gap-2"
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
          >
            <Check className="h-5 w-5 shrink-0 text-white" aria-hidden />
            <span>{successLabel}</span>
          </motion.span>
        ) : (
          <motion.span
            key="default"
            className="inline-flex items-center justify-center gap-2"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 shrink-0 animate-spin text-white" aria-hidden />
            ) : null}
            {showDefaultContent ? children : null}
          </motion.span>
        )}
      </AnimatePresence>
    </motion.button>
  );
}
