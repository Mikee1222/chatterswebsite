"use client";

import * as React from "react";
import Link from "next/link";
import { AnimatePresence, motion, useDragControls } from "framer-motion";
import { CalendarCheck, Coins, DollarSign, Play, UserPlus, Video, X } from "lucide-react";
import { ROUTES } from "@/lib/routes";
import { cn } from "@/lib/utils";
import { FeedbackQuickActionSheetRow } from "@/components/feedback-quick-action-menu-item";
import { ChatterRebillTipFabMenuItems } from "@/components/chatter-rebill-tip-fab-menu-items";

const SHEET_SPRING = { type: "spring" as const, damping: 25, stiffness: 300 };

const SWIPE_CLOSE_PX = 100;

/** Chatter FAB / bottom sheet — shared with `FloatingActionButton` desktop menu. */
export const CHATTER_QUICK_ACTIONS: {
  href: string;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
}[] = [
  // Custom Video first — primary chatter action; was easy to miss mid-list after FAB overlay races.
  { href: ROUTES.chatter.requestCustom, label: "Custom Video", Icon: Video },
  { href: ROUTES.chatter.shift, label: "Start a shift", Icon: Play },
  { href: ROUTES.chatter.weeklyAvailability, label: "My availability", Icon: CalendarCheck },
  { href: ROUTES.chatter.myWhalesNew, label: "Add new whale", Icon: UserPlus },
  { href: ROUTES.chatter.logTransaction, label: "Whale session", Icon: DollarSign },
  { href: ROUTES.finesBonuses, label: "Fines & Bonuses", Icon: Coins },
];

export type QuickActionsModalProps = {
  open: boolean;
  onClose: () => void;
};

/**
 * Chatter quick actions as a mobile bottom sheet: spring slide-up, blurred backdrop,
 * swipe-down / backdrop / ESC to close.
 */
export function QuickActionsModal({ open, onClose }: QuickActionsModalProps) {
  const dragControls = useDragControls();

  React.useEffect(() => {
    if (typeof document === "undefined" || !open) return;
    const mq = window.matchMedia("(max-width: 767px)");
    if (!mq.matches) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  React.useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  return (
    <div className="md:hidden" data-mobile-chrome-ignore>
      <AnimatePresence>
        {open ? (
          <>
            <motion.button
              key="quick-actions-backdrop"
              type="button"
              aria-label="Close quick actions"
              className="fixed inset-0 z-[105] cursor-default touch-manipulation bg-black/60 backdrop-blur-md"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              onClick={onClose}
            />
            <motion.div
              key="quick-actions-sheet"
              role="dialog"
              aria-modal="true"
              aria-labelledby="quick-actions-title"
              data-mobile-chrome-ignore
              className={cn(
                "fixed inset-x-0 bottom-0 z-[106] flex max-h-[min(78dvh,520px)] flex-col overflow-hidden rounded-t-3xl border border-white/10 border-b-0 bg-zinc-900 shadow-[0_-12px_48px_rgba(0,0,0,0.55)]",
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
              dragConstraints={{ top: 0, bottom: 280 }}
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
                <span id="quick-actions-title" className="text-base font-semibold text-white">
                  Quick actions
                </span>
                <button
                  type="button"
                  onClick={onClose}
                  className="flex h-11 w-11 items-center justify-center rounded-xl text-white/75 transition hover:bg-white/10 hover:text-white"
                  aria-label="Close quick actions"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain px-3 pb-2">
                {CHATTER_QUICK_ACTIONS.map(({ href, label, Icon }) => (
                  <li key={href}>
                    <Link
                      href={href}
                      onClick={onClose}
                      className="flex min-h-[52px] items-center gap-3 rounded-xl px-3 py-3.5 text-left text-[15px] font-medium text-white/95 transition-colors active:bg-white/10"
                    >
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-pink-500/20 text-pink-400">
                        <Icon className="h-5 w-5" />
                      </span>
                      {label}
                    </Link>
                  </li>
                ))}
                <ChatterRebillTipFabMenuItems onClose={onClose} variant="sheet" />
                <FeedbackQuickActionSheetRow onClose={onClose} />
              </ul>
            </motion.div>
          </>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
