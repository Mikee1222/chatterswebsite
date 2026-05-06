"use client";

import * as React from "react";
import Link from "next/link";
import { AnimatePresence, motion, useDragControls } from "framer-motion";
import {
  Activity,
  Calendar,
  Clock,
  Dices,
  DollarSign,
  FileText,
  Fish,
  Headphones,
  Package,
  Plus,
  Settings,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { ROUTES } from "@/lib/routes";
import { cn } from "@/lib/utils";
import type { SessionUser } from "@/types";
import { useMobileFabHidden } from "@/contexts/mobile-fab-visibility-context";

const SHEET_SPRING = { type: "spring" as const, damping: 25, stiffness: 300 };
const SWIPE_CLOSE_PX = 100;

type AdminQuickActionItem = {
  href: string;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
  /** Hidden for managers (matches nav `adminOnly`). */
  adminOnly?: boolean;
};

function buildAdminQuickActions(role: SessionUser["role"]): AdminQuickActionItem[] {
  const isManager = role === "manager";

  const items: AdminQuickActionItem[] = [
    {
      href: isManager ? ROUTES.admin.models : ROUTES.accountsModelssNew,
      label: "Add new model",
      Icon: UserPlus,
    },
    {
      href: isManager ? ROUTES.admin.accounts : `${ROUTES.accountsNew}?role=chatter`,
      label: "Add new chatter",
      Icon: Users,
    },
    {
      href: isManager ? ROUTES.admin.accounts : `${ROUTES.accountsNew}?role=virtual_assistant`,
      label: "Add new VA",
      Icon: Headphones,
    },
    { href: ROUTES.admin.weeklyProgram, label: "Create weekly program", Icon: Calendar },
    { href: ROUTES.admin.earnings, label: "View earnings", Icon: DollarSign, adminOnly: true },
    { href: ROUTES.admin.shiftActivity, label: "Shift activity", Icon: Activity },
    { href: ROUTES.admin.customs, label: "Customs", Icon: Package },
    { href: ROUTES.hours, label: "Hours", Icon: Clock },
    { href: ROUTES.activityLogs, label: "Activity logs", Icon: FileText },
    { href: ROUTES.admin.spinResults, label: "Spin results", Icon: Dices },
    { href: ROUTES.admin.whales, label: "Whales", Icon: Fish },
    { href: ROUTES.settings, label: "System settings", Icon: Settings },
  ];

  if (isManager) return items.filter((i) => !i.adminOnly);
  return items;
}

const FAB_BTN_CLASS = cn(
  "flex h-14 w-14 items-center justify-center rounded-2xl text-white shadow-lg transition-transform",
  "bg-gradient-to-br from-pink-500 via-pink-500 to-fuchsia-600",
  "border border-pink-400/30",
  "hover:scale-[1.04] active:scale-[0.96]",
  "touch-manipulation focus:outline-none focus-visible:ring-2 focus-visible:ring-pink-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-black/80"
);

export type AdminQuickActionsModalProps = {
  open: boolean;
  onClose: () => void;
  actions: AdminQuickActionItem[];
};

/**
 * Admin / manager quick actions — same bottom sheet behavior as chatter `QuickActionsModal`.
 */
export function AdminQuickActionsModal({ open, onClose, actions }: AdminQuickActionsModalProps) {
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
    <div className="md:hidden">
      <AnimatePresence>
        {open ? (
          <>
            <motion.button
              key="admin-quick-actions-backdrop"
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
              key="admin-quick-actions-sheet"
              role="dialog"
              aria-modal="true"
              aria-labelledby="admin-quick-actions-title"
              className={cn(
                "fixed inset-x-0 bottom-0 z-[106] flex max-h-[min(85dvh,560px)] flex-col overflow-hidden rounded-t-3xl border border-white/10 border-b-0 bg-zinc-900 shadow-[0_-12px_48px_rgba(0,0,0,0.55)]",
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
                <span id="admin-quick-actions-title" className="text-base font-semibold text-white">
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
                {actions.map(({ href, label, Icon }) => (
                  <li key={`${href}-${label}`}>
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
              </ul>
            </motion.div>
          </>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

type AdminFloatingQuickActionsButtonProps = {
  user: SessionUser;
};

/**
 * Admin / manager FAB: mobile bottom sheet (`AdminQuickActionsModal`), desktop dropdown above the + button.
 */
export function AdminFloatingQuickActionsButton({ user }: AdminFloatingQuickActionsButtonProps) {
  const [open, setOpen] = React.useState(false);
  const fabHiddenByOverlay = useMobileFabHidden();

  const actions = React.useMemo(() => buildAdminQuickActions(user.role), [user.role]);

  if ((user.role !== "admin" && user.role !== "manager") || fabHiddenByOverlay) return null;

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
        <AdminQuickActionsModal open={open} onClose={() => setOpen(false)} actions={actions} />

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
      </div>

      <div className="pointer-events-none fixed bottom-6 right-6 z-[50] hidden flex-col items-end gap-2 md:pointer-events-auto md:flex">
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
            className="pointer-events-auto relative z-[50] mb-1 max-h-[min(70vh,480px)] min-w-[240px] overflow-y-auto overflow-x-hidden rounded-2xl border border-white/10 bg-black/90 py-1 shadow-[0_-8px_40px_rgba(0,0,0,0.45),0_0_0_1px_rgba(255,255,255,0.06)] backdrop-blur-xl"
            aria-label="Quick actions"
          >
            <ul className="divide-y divide-white/5">
              {actions.map(({ href, label, Icon }) => (
                <li key={`${href}-${label}`}>
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
    </>
  );
}
