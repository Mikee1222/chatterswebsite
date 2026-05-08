"use client";

import * as React from "react";
import Link from "next/link";
import { AnimatePresence, motion, useDragControls } from "framer-motion";
import { Calendar, CalendarClock, Clock, Download, Plus, X } from "lucide-react";
import { ROUTES, modelScheduleUrl } from "@/lib/routes";
import { cn } from "@/lib/utils";
import type { AuthUser } from "@/lib/auth-config";
import { useMobileFabHidden } from "@/contexts/mobile-fab-visibility-context";
import { useTranslations } from "@/lib/use-translations";
import { FeedbackQuickActionNavRow, FeedbackQuickActionSheetRow } from "@/components/feedback-quick-action-menu-item";

const SHEET_SPRING = { type: "spring" as const, damping: 25, stiffness: 300 };

const SWIPE_CLOSE_PX = 100;

function useModelQuickActionLinks() {
  const { t } = useTranslations();
  return React.useMemo(
    () =>
      [
        { href: ROUTES.model.contentAssignments, label: t("quickActions.vaDeliveries"), Icon: Download },
        { href: `${ROUTES.model.contentCalendar}?action=add-personal-event`, label: "Add personal event", Icon: CalendarClock },
        { href: modelScheduleUrl({ action: "submit" }), label: t("quickActions.submitAvailability"), Icon: Calendar },
        { href: modelScheduleUrl({ action: "request-off" }), label: t("quickActions.requestTimeOff"), Icon: Clock },
      ] as const,
    [t]
  );
}

export type ModelQuickActionsModalProps = {
  open: boolean;
  onClose: () => void;
};

export function ModelQuickActionsModal({ open, onClose }: ModelQuickActionsModalProps) {
  const dragControls = useDragControls();
  const links = useModelQuickActionLinks();
  const { t } = useTranslations();

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
    <div className="md:hidden">
      <AnimatePresence>
        {open ? (
          <>
            <motion.button
              key="model-quick-actions-backdrop"
              type="button"
              aria-label={t("quickActions.close")}
              className="fixed inset-0 z-[105] cursor-default touch-manipulation bg-black/60 backdrop-blur-md"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              onClick={onClose}
            />
            <motion.div
              key="model-quick-actions-sheet"
              role="dialog"
              aria-modal="true"
              aria-labelledby="model-quick-actions-title"
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
                <span id="model-quick-actions-title" className="text-base font-semibold text-white">
                  {t("quickActions.title")}
                </span>
                <button
                  type="button"
                  onClick={onClose}
                  className="flex h-11 w-11 items-center justify-center rounded-xl text-white/75 transition hover:bg-white/10 hover:text-white"
                  aria-label={t("quickActions.close")}
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain px-3 pb-2">
                {links.map(({ href, label, Icon }) => (
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
                <FeedbackQuickActionSheetRow onClose={onClose} />
              </ul>
            </motion.div>
          </>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

const FAB_BTN_CLASS = cn(
  "flex h-14 w-14 items-center justify-center rounded-2xl text-white shadow-lg transition-transform",
  "bg-gradient-to-br from-pink-500 via-pink-500 to-fuchsia-600",
  "border border-pink-400/30",
  "hover:scale-[1.04] active:scale-[0.96]",
  "touch-manipulation focus:outline-none focus-visible:ring-2 focus-visible:ring-pink-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-black/80"
);

export type ModelQuickActionsFabProps = {
  user: AuthUser;
};

export function ModelQuickActionsFab({ user }: ModelQuickActionsFabProps) {
  const [open, setOpen] = React.useState(false);
  const fabHiddenByOverlay = useMobileFabHidden();
  const links = useModelQuickActionLinks();
  const { t } = useTranslations();

  if (user.role !== "model" || fabHiddenByOverlay) return null;

  const fabBottomStyle = {
    bottom: "calc(64px + env(safe-area-inset-bottom, 0px) + 12px)",
    right: "max(1rem, env(safe-area-inset-right, 0px))",
  } as const;

  const fabShadowStyle = {
    boxShadow: "0 10px 28px -6px rgba(236,72,153,0.55), 0 0 0 1px rgba(255,255,255,0.08) inset",
  } as const;

  return (
    <>
      <div className="md:hidden">
        <ModelQuickActionsModal open={open} onClose={() => setOpen(false)} />

        <div className="fixed z-[107] flex flex-col items-end" style={fabBottomStyle}>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className={FAB_BTN_CLASS}
            style={fabShadowStyle}
            aria-expanded={open}
            aria-haspopup="dialog"
            aria-label={open ? t("quickActions.close") : t("quickActions.open")}
          >
            <Plus
              className={cn("h-7 w-7 transition-transform duration-200 ease-out", open && "rotate-45")}
              strokeWidth={2.4}
            />
          </button>
        </div>
      </div>

      <div className="pointer-events-none fixed z-[50] hidden flex-col items-end gap-2 md:pointer-events-auto md:flex bottom-6 right-6">
        {open ? (
          <button
            type="button"
            className="pointer-events-auto fixed inset-0 z-[45] cursor-default bg-black/40 backdrop-blur-[2px]"
            aria-label={t("quickActions.close")}
            onClick={() => setOpen(false)}
          />
        ) : null}

        {open ? (
          <nav
            className="pointer-events-auto relative z-[50] mb-1 min-w-[220px] overflow-hidden rounded-2xl border border-white/10 bg-black/90 py-1 shadow-[0_-8px_40px_rgba(0,0,0,0.45),0_0_0_1px_rgba(255,255,255,0.06)] backdrop-blur-xl"
            aria-label={t("quickActions.title")}
          >
            <ul className="divide-y divide-white/5">
              {links.map(({ href, label, Icon }) => (
                <li key={href}>
                  <Link
                    href={href}
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-3 px-4 py-3.5 text-left text-[15px] font-medium text-white/95 transition-colors hover:bg-white/[0.08]"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-pink-500/20 text-pink-400">
                      <Icon className="h-4 w-4" />
                    </span>
                    {label}
                  </Link>
                </li>
              ))}
              <FeedbackQuickActionNavRow onClose={() => setOpen(false)} />
            </ul>
          </nav>
        ) : null}

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className={cn(FAB_BTN_CLASS, "pointer-events-auto relative z-[50]")}
          style={fabShadowStyle}
          aria-expanded={open}
          aria-haspopup="menu"
          aria-label={open ? t("quickActions.close") : t("quickActions.open")}
        >
          <Plus
            className={cn("h-7 w-7 transition-transform duration-200 ease-out", open && "rotate-45")}
            strokeWidth={2.4}
          />
        </button>
      </div>
    </>
  );
}
