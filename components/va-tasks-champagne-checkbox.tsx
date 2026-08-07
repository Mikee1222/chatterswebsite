"use client";

import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  checked: boolean;
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
      const t = window.setTimeout(() => setPulse(false), 220);
      return () => window.clearTimeout(t);
    }
  }, [checked, reduceMotion]);

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
      aria-label={ariaLabel ?? title ?? (checked ? "Completed" : "Mark complete")}
      aria-pressed={checked}
      className={cn(
        // Real min 44px touch target in document flow (survives overflow:hidden parents)
        "relative inline-flex h-11 w-11 shrink-0 items-center justify-center touch-manipulation",
        "rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF8C]/45",
        disabled ? "cursor-not-allowed" : "cursor-pointer",
        className,
      )}
    >
      <motion.span
        aria-hidden
        animate={
          reduceMotion
            ? undefined
            : pulse
              ? { scale: [1, 1.18, 1] }
              : { scale: 1 }
        }
        transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
        className={cn(
          "relative flex h-5 w-5 items-center justify-center rounded-[4px] border-2 transition-colors duration-150 motion-reduce:transition-none",
          checked
            ? "border-[#D4AF8C] bg-[#D4AF8C]/15"
            : disabled
              ? "border-white/8 bg-white/[0.03] opacity-40"
              : "border-[#D4AF8C]/45 bg-transparent",
        )}
      >
        <AnimatePresence mode="wait">
          {checked ? (
            <motion.span
              key="check"
              initial={reduceMotion ? false : { scale: 0.4, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={reduceMotion ? undefined : { scale: 0.4, opacity: 0 }}
              transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
              className="flex items-center justify-center"
            >
              <Check className="h-3 w-3 text-[#D4AF8C]" strokeWidth={3} aria-hidden />
            </motion.span>
          ) : null}
        </AnimatePresence>
      </motion.span>
    </button>
  );
}
