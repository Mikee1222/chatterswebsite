"use client";

import * as React from "react";
import { AnimatePresence, motion, useDragControls } from "framer-motion";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

const SHEET_SPRING = { type: "spring" as const, damping: 25, stiffness: 300 };
const SWIPE_CLOSE_PX = 100;

export type MoreMenuRole = "chatter" | "virtual_assistant" | "model" | "admin" | "manager";

export type MoreMenuModalProps = {
  open: boolean;
  onClose: () => void;
  /** Dialog title (default: More). */
  title?: string;
  /** For analytics / testing hooks; shell supplies menu items. */
  userRole?: MoreMenuRole;
  children: React.ReactNode;
};

/**
 * Mobile “More” bottom sheet — same interaction model as `VaQuickActionsModal`:
 * spring slide-up, blurred backdrop, drag handle + swipe down, backdrop tap, Escape.
 */
export function MoreMenuModal({ open, onClose, title = "More", userRole, children }: MoreMenuModalProps) {
  const dragControls = useDragControls();
  const titleId = React.useId();

  React.useEffect(() => {
    if (!open) return;
    const mq = typeof window !== "undefined" ? window.matchMedia("(max-width: 767px)") : null;
    if (mq && !mq.matches) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  return (
    <div className="md:hidden">
      <AnimatePresence>
        {open ? (
          <>
            <motion.button
              key="more-menu-backdrop"
              type="button"
              aria-label="Close menu"
              data-more-user-role={userRole}
              className="fixed inset-0 z-[118] cursor-default touch-manipulation bg-black/60 backdrop-blur-md"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              onClick={onClose}
            />
            <motion.div
              key="more-menu-sheet"
              role="dialog"
              aria-modal="true"
              aria-labelledby={titleId}
              className={cn(
                "fixed inset-x-0 bottom-0 z-[119] flex max-h-[min(85dvh,580px)] flex-col overflow-hidden rounded-t-3xl border border-white/10 border-b-0 bg-zinc-900 shadow-[0_-12px_48px_rgba(0,0,0,0.55)]",
                "touch-manipulation"
              )}
              style={{
                paddingBottom: "max(0.75rem, env(safe-area-inset-bottom, 0px))",
              }}
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={SHEET_SPRING}
              drag="y"
              dragDirectionLock
              dragListener={false}
              dragControls={dragControls}
              dragConstraints={{ top: 0, bottom: 320 }}
              dragElastic={{ top: 0, bottom: 0.35 }}
              onDragEnd={(_, info) => {
                if (info.offset.y > SWIPE_CLOSE_PX) onClose();
              }}
            >
              <div
                className="flex min-h-[44px] shrink-0 cursor-grab flex-col items-center justify-center px-4 active:cursor-grabbing"
                onPointerDown={(e) => dragControls.start(e)}
              >
                <div className="flex w-full justify-center py-1" aria-hidden>
                  <div className="h-1 w-10 shrink-0 rounded-full bg-zinc-500" />
                </div>
              </div>

              <div className="flex shrink-0 items-center justify-between px-4 pb-3 pt-1">
                <span id={titleId} className="text-base font-semibold text-white">
                  {title}
                </span>
                <button
                  type="button"
                  onClick={onClose}
                  className="flex h-11 w-11 items-center justify-center rounded-xl text-white/75 transition hover:bg-white/10 hover:text-white"
                  aria-label="Close menu"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{children}</div>
            </motion.div>
          </>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
