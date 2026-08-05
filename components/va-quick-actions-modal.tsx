"use client";

import * as React from "react";
import Link from "next/link";
import { AnimatePresence, motion, useDragControls } from "framer-motion";
import { CalendarCheck, Coins, FilePlus2, Play, Plus, X, AlertTriangle } from "lucide-react";
import { ROUTES } from "@/lib/routes";
import { cn } from "@/lib/utils";
import type { SessionUser } from "@/types";
import { getEffectiveStaffRole } from "@/lib/staff-session-role";
import { useMobileFabHidden } from "@/contexts/mobile-fab-visibility-context";
import { FeedbackQuickActionNavRow, FeedbackQuickActionSheetRow } from "@/components/feedback-quick-action-menu-item";
import { VAShadowbanReportModal } from "@/components/va-shadowban-report-modal";
import type { SocialAccount } from "@/services/marketing";

const SHEET_SPRING = { type: "spring" as const, damping: 25, stiffness: 300 };

const SWIPE_CLOSE_PX = 100;

/** VA role FAB / bottom sheet — same layout and motion as `QuickActionsModal` (chatters) / `ModelQuickActionsModal`. */
type VaQuickAction = {
  href: string;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
};

export const VA_QUICK_ACTIONS: VaQuickAction[] = [
  { href: ROUTES.va.shift, label: "Start mistake shift", Icon: Play },
  { href: ROUTES.va.contentAssignments, label: "Assign content to model", Icon: FilePlus2 },
  { href: ROUTES.va.weeklyAvailability, label: "Submit availability", Icon: CalendarCheck },
  { href: ROUTES.finesBonuses, label: "Fines & Bonuses", Icon: Coins },
];

/** Quick actions minus the mistake shift entry when the VA lacks the mistakes:view permission. */
function getVaQuickActions(canMistakeShift: boolean): VaQuickAction[] {
  if (canMistakeShift) return VA_QUICK_ACTIONS;
  return VA_QUICK_ACTIONS.filter((a) => a.href !== ROUTES.va.shift);
}

export type VaQuickActionsModalProps = {
  open: boolean;
  onClose: () => void;
  /** Opens the VA shadowban report flow (parent should close FAB and show modal). */
  onReportShadowban?: () => void;
  /** When false, the "Start mistake shift" action is hidden (missing mistakes:view). */
  canMistakeShift?: boolean;
};

/**
 * Virtual assistant quick actions as a mobile bottom sheet: spring slide-up, blurred backdrop,
 * swipe-down / backdrop / ESC to close — matches chatter `QuickActionsModal`.
 */
export function VaQuickActionsModal({ open, onClose, onReportShadowban, canMistakeShift = true }: VaQuickActionsModalProps) {
  const dragControls = useDragControls();
  const quickActions = getVaQuickActions(canMistakeShift);

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
              key="va-quick-actions-backdrop"
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
              key="va-quick-actions-sheet"
              role="dialog"
              aria-modal="true"
              aria-labelledby="va-quick-actions-title"
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
                <span id="va-quick-actions-title" className="text-base font-semibold text-white">
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
                {quickActions.map(({ href, label, Icon }) => (
                  <li key={href + label}>
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
                {onReportShadowban ? (
                  <li>
                    <button
                      type="button"
                      onClick={onReportShadowban}
                      className="flex w-full min-h-[52px] items-center gap-3 rounded-xl px-4 py-3 text-left transition-colors active:bg-white/10"
                    >
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/20">
                        <AlertTriangle className="h-4 w-4 text-amber-400" aria-hidden />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-white">Report shadowban</p>
                        <p className="text-xs text-white/40">Report an account issue</p>
                      </div>
                    </button>
                  </li>
                ) : null}
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

type VaFloatingActionButtonProps = {
  user: SessionUser;
  /** When false, the "Start mistake shift" action is hidden (missing mistakes:view). */
  canMistakeShift?: boolean;
};

/**
 * VA-only FAB: fixed bottom-right above the mobile tab bar.
 * - Mobile: `VaQuickActionsModal` bottom sheet.
 * - Desktop: compact menu above the button (matches `ModelQuickActionsFab`).
 */
export function VaFloatingActionButton({ user, canMistakeShift = true }: VaFloatingActionButtonProps) {
  const [open, setOpen] = React.useState(false);
  const quickActions = getVaQuickActions(canMistakeShift);
  const [shadowbanModalOpen, setShadowbanModalOpen] = React.useState(false);
  const [vaAccounts, setVaAccounts] = React.useState<SocialAccount[]>([]);
  const fabHiddenByOverlay = useMobileFabHidden();

  const openShadowbanReport = React.useCallback(() => {
    setOpen(false);
    setShadowbanModalOpen(true);
  }, []);

  React.useEffect(() => {
    if (!shadowbanModalOpen) return;
    let cancelled = false;
    fetch("/api/va/marketing/accounts", { credentials: "include" })
      .then((r) => r.json())
      .then((d: { accounts?: SocialAccount[] }) => {
        if (!cancelled) setVaAccounts(d.accounts ?? []);
      })
      .catch(() => {
        if (!cancelled) setVaAccounts([]);
      });
    return () => {
      cancelled = true;
    };
  }, [shadowbanModalOpen]);

  if (getEffectiveStaffRole(user) !== "virtual_assistant") return null;

  // Never return null while open: our sheet is role=dialog, which sets fabHiddenByOverlay
  // via MutationObserver. Unmounting the sheet would clear the dialog → remount loop (screen flash).
  const fabBottomStyle = {
    bottom: "calc(var(--mobile-bottom-nav-height, 76px) + env(safe-area-inset-bottom, 0px) + 12px)",
    right: "max(1rem, env(safe-area-inset-right, 0px))",
  } as const;

  const fabShadowStyle = {
    boxShadow: "0 10px 28px -6px rgba(236,72,153,0.55), 0 0 0 1px rgba(255,255,255,0.08) inset",
  } as const;

  return (
    <>
      <VAShadowbanReportModal
        open={shadowbanModalOpen}
        onClose={() => setShadowbanModalOpen(false)}
        vaAccounts={vaAccounts}
      />
      <div className="md:hidden">
        <VaQuickActionsModal
          open={open}
          onClose={() => setOpen(false)}
          onReportShadowban={openShadowbanReport}
          canMistakeShift={canMistakeShift}
        />

        {!fabHiddenByOverlay ? (
          <div className="fixed z-[107] flex flex-col items-end" style={fabBottomStyle}>
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              className={FAB_BTN_CLASS}
              style={fabShadowStyle}
              aria-expanded={open}
              aria-haspopup="dialog"
              aria-label={open ? "Close quick actions" : "Open quick actions"}
            >
              <Plus
                className={cn("h-7 w-7 transition-transform duration-200 ease-out", open && "rotate-45")}
                strokeWidth={2.4}
              />
            </button>
          </div>
        ) : null}
      </div>

      {!fabHiddenByOverlay ? (
        <div className="pointer-events-none fixed z-[50] hidden flex-col items-end gap-2 md:pointer-events-auto md:flex bottom-6 right-6">
          {open ? (
            <button
              type="button"
              className="pointer-events-auto fixed inset-0 z-[45] cursor-default bg-black/40 backdrop-blur-[2px]"
              aria-label="Close quick actions"
              onClick={() => setOpen(false)}
            />
          ) : null}

          {open ? (
            <nav
              className="pointer-events-auto relative z-[50] mb-1 min-w-[220px] overflow-hidden rounded-2xl border border-white/10 bg-black/90 py-1 shadow-[0_-8px_40px_rgba(0,0,0,0.45),0_0_0_1px_rgba(255,255,255,0.06)] backdrop-blur-xl"
              aria-label="Quick actions"
            >
              <ul className="divide-y divide-white/5">
                {quickActions.map(({ href, label, Icon }) => (
                  <li key={href + label}>
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
                <li>
                  <button
                    type="button"
                    onClick={openShadowbanReport}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-white/5"
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/20">
                      <AlertTriangle className="h-4 w-4 text-amber-400" aria-hidden />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">Report shadowban</p>
                      <p className="text-xs text-white/40">Report an account issue</p>
                    </div>
                  </button>
                </li>
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
            aria-label={open ? "Close quick actions" : "Open quick actions"}
          >
            <Plus
              className={cn("h-7 w-7 transition-transform duration-200 ease-out", open && "rotate-45")}
              strokeWidth={2.4}
            />
          </button>
        </div>
      ) : null}
    </>
  );
}
