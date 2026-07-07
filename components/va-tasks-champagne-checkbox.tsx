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
};

/** Champagne-outline checkbox for VA task checklist items. */
export function ChampagneCheckbox({ checked, disabled, onClick, title, className }: Props) {
  const reduceMotion = useReducedMotion();
  const [pulse, setPulse] = React.useState(false);
  const prevChecked = React.useRef(checked);

  React.useEffect(() => {
    if (checked && !prevChecked.current && !reduceMotion) {
      setPulse(true);
      const t = window.setTimeout(() => setPulse(false), 220);
      return () => window.clearTimeout(t);
    }
    prevChecked.current = checked;
  }, [checked, reduceMotion]);

  return (
    <motion.button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      animate={
        reduceMotion
          ? undefined
          : pulse
            ? { scale: [1, 1.18, 1] }
            : { scale: 1 }
      }
      transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-[4px] border-2 transition-colors duration-150 motion-reduce:transition-none",
        checked
          ? "border-[#D4AF8C] bg-[#D4AF8C]/15"
          : disabled
            ? "cursor-not-allowed border-white/8 bg-white/[0.03] opacity-40"
            : "border-[#D4AF8C]/45 bg-transparent hover:border-[#D4AF8C] hover:bg-[#D4AF8C]/8",
        className,
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
    </motion.button>
  );
}
