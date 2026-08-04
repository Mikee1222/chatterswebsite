"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import { useRegisterMobileOverlay } from "@/contexts/mobile-fab-visibility-context";

/** Glass modal — single `motion` root so `AnimatePresence` in the parent can run exit. */
export function GlassModal({
  children,
  onClose,
  title,
  subtitle,
  className = "",
}: {
  children: React.ReactNode;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  className?: string;
}) {
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => {
    setMounted(true);
  }, []);

  // Mounted only while open — register for the full lifetime of this portal.
  useRegisterMobileOverlay(mounted);

  if (!mounted) return null;

  return createPortal(
    <motion.div
      className="fixed inset-0 z-[300] flex items-end justify-center md:items-center md:p-4 md:pb-0"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.1, ease: "easeOut" }}
      role="presentation"
      data-mobile-chrome-hide
    >
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-md"
        aria-hidden
        onClick={onClose}
      />
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby={title != null ? "glass-modal-title" : undefined}
        className={`relative flex w-full flex-col rounded-t-2xl border border-white/10 border-b-0 bg-black/95 shadow-2xl shadow-black/50 backdrop-blur-xl max-h-[85vh] overflow-y-auto pb-[env(safe-area-inset-bottom)] md:max-h-[calc(100vh-2rem)] md:max-w-md md:rounded-2xl md:border md:pb-0 ${className}`}
        style={{
          boxShadow: "0 0 0 1px rgba(255,255,255,0.06), 0 24px 64px -12px rgba(0,0,0,0.7), 0 0 80px -24px hsl(330 80% 55% / 0.08)",
        }}
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.1, ease: "easeIn" } }}
        transition={{ duration: 0.15, ease: "easeOut" }}
        onClick={(e) => e.stopPropagation()}
      >
        {(title != null || subtitle != null) && (
          <div className="shrink-0 border-b border-white/10 px-4 py-4 md:px-5">
            {title != null && (
              <h2 id="glass-modal-title" className="text-lg font-semibold tracking-tight text-white">
                {title}
              </h2>
            )}
            {subtitle != null && <p className="mt-1 text-sm text-white/55">{subtitle}</p>}
            <div className="mt-2 h-px w-12 rounded-full bg-pink-500/40" />
          </div>
        )}
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      </motion.div>
    </motion.div>,
    document.body
  );
}
