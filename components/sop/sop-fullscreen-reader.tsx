"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Maximize2, X } from "lucide-react";
import { Markdown } from "@/components/ui/markdown";
import { FilePreview } from "@/components/ui/file-preview";
import { LoomEmbed } from "@/components/ui/loom-embed";
import { cn } from "@/lib/utils";
import type { SopFunction } from "@/types";

export function SopExpandButton({
  onClick,
  className,
  label = "Expand to fullscreen",
}: {
  onClick: () => void;
  className?: string;
  label?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg border border-white/12 bg-white/[0.04] px-2.5 py-1.5 text-xs font-semibold text-white/55 transition hover:border-pink-500/30 hover:bg-white/[0.07] hover:text-white/85",
        className
      )}
    >
      <Maximize2 className="h-3.5 w-3.5" />
      <span className="hidden sm:inline">Expand</span>
    </button>
  );
}

function hasReadableContent(fn: SopFunction): boolean {
  if (fn.standard_type === "file" && fn.sop_file_url.trim()) return true;
  if (fn.standard_type !== "file" && fn.sop_content.trim()) return true;
  if (fn.loom_url.trim()) return true;
  return false;
}

export function useSopFullscreenReader(fn: SopFunction) {
  const [open, setOpen] = React.useState(false);
  const canExpand = hasReadableContent(fn);
  return {
    open,
    setOpen,
    canExpand,
    expand: () => setOpen(true),
    close: () => setOpen(false),
  };
}

export function SopFullscreenReader({
  open,
  onClose,
  fn,
}: {
  open: boolean;
  onClose: () => void;
  fn: SopFunction;
}) {
  const reduce = useReducedMotion();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => setMounted(true), []);

  React.useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div
          className="sop-dark fixed inset-0 z-[60] flex flex-col bg-black/85 backdrop-blur-md"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduce ? 0.01 : 0.2 }}
          role="dialog"
          aria-modal="true"
          aria-label={`${fn.name} — fullscreen reader`}
        >
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 bg-[rgba(14,14,20,0.92)] px-4 py-3 safe-area-inset-top">
            <h2 className="min-w-0 truncate text-base font-semibold text-white">{fn.name}</h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close fullscreen"
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/12 bg-white/[0.05] text-white/70 transition hover:border-white/20 hover:bg-white/10 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-5 sm:px-6 sm:py-6">
            <div className="mx-auto w-full max-w-4xl space-y-6">
              <section>
                <p className="mb-3 text-[11px] font-bold uppercase tracking-wider text-white/40">Standard</p>
                {fn.standard_type === "file" ? (
                  fn.sop_file_url.trim() ? (
                    <FilePreview url={fn.sop_file_url} name={fn.sop_file_name} fullscreen />
                  ) : (
                    <p className="text-sm text-white/45">No file uploaded yet.</p>
                  )
                ) : (
                  <Markdown emptyFallback="No SOP content yet." className="max-w-3xl text-base">
                    {fn.sop_content}
                  </Markdown>
                )}
              </section>
              {fn.loom_url.trim() ? (
                <section>
                  <LoomEmbed url={fn.loom_url} title={`${fn.name} — Loom`} />
                </section>
              ) : null}
            </div>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body
  );
}
