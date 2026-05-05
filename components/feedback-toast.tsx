"use client";

import { useEffect, useState } from "react";
import { Check, X } from "lucide-react";
import { motion } from "framer-motion";

export type FeedbackToastEntry = {
  id: string;
  variant: "success" | "error";
  title: string;
  body?: string;
  createdAt: number;
};

export function FeedbackToast({
  item,
  onDismiss,
}: {
  item: FeedbackToastEntry;
  onDismiss: () => void;
}) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(t);
  }, []);

  const autoDismissMs = item.variant === "success" ? 4500 : 8000;
  useEffect(() => {
    const timer = setTimeout(onDismiss, autoDismissMs);
    return () => clearTimeout(timer);
  }, [onDismiss, autoDismissMs]);

  const isError = item.variant === "error";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 16, scale: 0.98 }}
      animate={visible ? { opacity: 1, x: 0, scale: 1 } : {}}
      transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
      className={`overflow-hidden rounded-xl border bg-white/[0.06] shadow-2xl backdrop-blur-xl ${
        isError ? "border-rose-500/35" : "border-[hsl(330,80%,55%)]/35"
      }`}
      role="alert"
    >
      <div className="flex gap-3 p-3.5">
        <span
          className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
            isError ? "bg-rose-500/20 text-rose-200" : "bg-[hsl(330,80%,55%)]/20 text-[hsl(330,90%,75%)]"
          }`}
        >
          {isError ? (
            <X className="h-4 w-4" strokeWidth={2.5} />
          ) : (
            <motion.span
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 500, damping: 22, delay: 0.08 }}
            >
              <Check className="h-4 w-4" strokeWidth={2.5} />
            </motion.span>
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p className={`text-sm font-semibold ${isError ? "text-rose-100" : "text-[hsl(330,90%,80%)]"}`}>
            {item.title}
          </p>
          {item.body && <p className="mt-0.5 text-sm leading-snug text-white/75">{item.body}</p>}
          <button type="button" onClick={onDismiss} className="mt-2 text-xs text-white/45 hover:text-white/75">
            Dismiss
          </button>
        </div>
      </div>
    </motion.div>
  );
}
