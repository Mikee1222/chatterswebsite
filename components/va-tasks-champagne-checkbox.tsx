"use client";

import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Check, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  checked: boolean;
  /** Timer running for this item — distinct from empty (pending) and checked (completed). */
  inProgress?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  title?: string;
  className?: string;
  /** Accessible name; falls back to title. */
  "aria-label"?: string;
};

/**
 * Champagne-outline checkbox for VA task checklist items.
 *
 * Hit target is a real 44×44 layout box (not a ::before expansion). Pseudo-element
 * hit pads are clipped by overflow-hidden ancestors (va-card / phase inner), which
 * left a 20×20 target that felt completely dead on mobile.
 */
export function ChampagneCheckbox({
  checked,
  inProgress = false,
  disabled,
  onClick,
  title,
  className,
  "aria-label": ariaLabel,
}: Props) {
  const reduceMotion = useReducedMotion();
  const [pulse, setPulse] = React.useState(false);
  const prevChecked = React.useRef(checked);

  React.useEffect(() => {
    const wasChecked = prevChecked.current;
    prevChecked.current = checked;
    if (checked && !wasChecked && !reduceMotion) {
      setPulse(true);
      const t = window.setTimeout(() => setPulse(false), 320);
      return () => window.clearTimeout(t);
    }
  }, [checked, reduceMotion]);

  const showInProgress = inProgress && !checked;

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        if (disabled) return;
        onClick?.();
      }}
      disabled={disabled}
      title={title}
      aria-label={
        ariaLabel ?? title ?? (checked ? "Completed" : showInProgress ? "In progress" : "Mark complete")
      }
      aria-pressed={checked}
      className={cn(
        // Real min 44px touch target in document flow (survives overflow:hidden parents)
        "relative inline-flex h-11 w-11 shrink-0 items-center justify-center touch-manipulation",
        "rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF8C]/45",
        "transition-transform duration-150 ease-out active:scale-[0.92] motion-reduce:transition-none motion-reduce:active:scale-100",
        disabled ? "cursor-not-allowed active:scale-100" : "cursor-pointer",
        className,
      )}
    >
      <motion.span
        aria-hidden
        animate={
          reduceMotion
            ? undefined
            : pulse
              ? { scale: [1, 1.22, 0.94, 1.06, 1] }
              : { scale: 1 }
        }
        transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
        className={cn(
          "relative flex h-5 w-5 items-center justify-center overflow-hidden rounded-[5px] border-2",
          "transition-[border-color,box-shadow,background-color] duration-200 ease-out motion-reduce:transition-none",
          checked
            ? "border-[#FF1493]/80 bg-gradient-to-br from-[#FF1493] via-[#E91E8C] to-[#D4AF8C] shadow-[0_0_14px_-3px_rgba(255,20,147,0.55),inset_0_1px_0_rgba(255,255,255,0.25)]"
            : showInProgress
              ? "border-[#D4AF8C]/70 bg-[#D4AF8C]/25 shadow-[0_0_10px_-2px_rgba(212,175,140,0.35),inset_0_1px_0_rgba(255,255,255,0.12)]"
              : disabled
                ? "border-white/8 bg-white/[0.03] opacity-40"
                : "border-[#D4AF8C]/50 bg-[#D4AF8C]/[0.04] shadow-[inset_0_1px_0_rgba(212,175,140,0.08)] hover:border-[#D4AF8C]/75 hover:bg-[#D4AF8C]/[0.08]",
        )}
      >
        {/* In-progress partial fill + pulse */}
        {showInProgress ? (
          <>
            <span
              className={cn(
                "pointer-events-none absolute inset-x-0 bottom-0 rounded-b-[3px] bg-gradient-to-t from-[#D4AF8C]/55 to-[#D4AF8C]/20",
                !reduceMotion && "animate-pulse motion-reduce:animate-none",
              )}
              style={{ height: "58%" }}
            />
            <Clock
              className="relative z-[1] h-2.5 w-2.5 text-[#D4AF8C] drop-shadow-[0_1px_1px_rgba(0,0,0,0.35)]"
              strokeWidth={2.75}
              aria-hidden
            />
          </>
        ) : null}
        {/* Soft fill wash on check — skipped when reduced motion */}
        {!reduceMotion && checked ? (
          <motion.span
            key="wash"
            initial={{ opacity: 0.85, scale: 0.35 }}
            animate={{ opacity: 0, scale: 1.65 }}
            transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
            className="pointer-events-none absolute inset-0 rounded-[3px] bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.55)_0%,transparent_70%)]"
          />
        ) : null}
        <AnimatePresence mode="wait">
          {checked ? (
            <motion.span
              key="check"
              initial={reduceMotion ? false : { scale: 0.35, opacity: 0, y: 2 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={reduceMotion ? undefined : { scale: 0.4, opacity: 0 }}
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
              className="relative z-[1] flex items-center justify-center"
            >
              <Check className="h-3.5 w-3.5 text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.35)]" strokeWidth={3.25} aria-hidden />
            </motion.span>
          ) : null}
        </AnimatePresence>
      </motion.span>
    </button>
  );
}
