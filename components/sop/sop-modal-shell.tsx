"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { motion, useReducedMotion } from "framer-motion";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

const easeOut = [0.22, 1, 0.36, 1] as const;

const SIZE_CLASS = {
  sm: "md:max-w-md",
  md: "md:max-w-lg",
  lg: "md:max-w-2xl",
  xl: "md:max-w-3xl",
} as const;

function useMobileSheet() {
  const [mobile, setMobile] = React.useState(false);
  React.useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const sync = () => setMobile(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  return mobile;
}

export function SopModalShell({
  onClose,
  title,
  subtitle,
  className,
  size = "md",
  children,
  footer,
  closeDisabled,
}: {
  onClose: () => void;
  title: string;
  subtitle?: string;
  className?: string;
  size?: keyof typeof SIZE_CLASS;
  children: React.ReactNode;
  footer?: React.ReactNode;
  closeDisabled?: boolean;
}) {
  const reduce = useReducedMotion();
  const mobile = useMobileSheet();
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  const panelMotion = reduce
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }
    : mobile
      ? {
          initial: { opacity: 0, y: "100%" },
          animate: { opacity: 1, y: 0 },
          exit: { opacity: 0, y: "100%" },
        }
      : {
          initial: { opacity: 0, scale: 0.96, y: 10 },
          animate: { opacity: 1, scale: 1, y: 0 },
          exit: { opacity: 0, scale: 0.96, y: 10 },
        };

  if (!mounted) return null;

  return createPortal(
    <motion.div
      className={cn(
        "sop-dark fixed z-50 flex items-end justify-center",
        "inset-0",
        "md:top-14 md:left-64 md:right-0 md:bottom-0 md:z-[25] md:items-center md:p-4"
      )}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: reduce ? 0.01 : 0.15, ease: "easeOut" }}
      role="presentation"
    >
      <div
        className="absolute inset-0 bg-black/75 backdrop-blur-md"
        aria-hidden
        onClick={() => !closeDisabled && onClose()}
      />
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="sop-modal-title"
        className={cn(
          "sop-modal-panel relative flex w-full flex-col overflow-hidden",
          "h-[100dvh] max-h-[100dvh] rounded-none border-0",
          "md:h-auto md:max-h-[calc(100dvh-3.5rem-2rem)] md:rounded-2xl md:border",
          SIZE_CLASS[size],
          className
        )}
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        onClick={(e) => e.stopPropagation()}
        {...panelMotion}
        transition={{
          duration: reduce ? 0.01 : mobile ? 0.32 : 0.22,
          ease: easeOut,
        }}
      >
        <header className="sticky top-0 z-20 shrink-0 border-b border-white/10 bg-[rgba(10,10,16,0.98)] backdrop-blur-xl">
          <div className="flex items-start gap-3 px-4 py-4 md:px-5">
            <div className="min-w-0 flex-1">
              <h2
                id="sop-modal-title"
                className="text-lg font-semibold tracking-tight text-white"
              >
                {title}
              </h2>
              {subtitle ? (
                <p className="mt-1 text-sm leading-relaxed text-white/55">{subtitle}</p>
              ) : null}
              <div className="mt-2.5 h-px w-12 rounded-full bg-pink-500/40" />
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={closeDisabled}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.05] text-white/70 transition hover:border-white/20 hover:bg-white/10 hover:text-white disabled:opacity-40"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{children}</div>

        {footer ? (
          <footer className="sticky bottom-0 z-20 shrink-0 border-t border-white/10 bg-[rgba(10,10,16,0.98)] backdrop-blur-xl">
            <div className="px-4 py-4 md:px-5">{footer}</div>
          </footer>
        ) : null}
      </motion.div>
    </motion.div>,
    document.body
  );
}
