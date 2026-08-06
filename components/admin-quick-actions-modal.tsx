"use client";

import * as React from "react";
import Link from "next/link";
import { AnimatePresence, motion, useDragControls } from "framer-motion";
import {
  Activity,
  AlertTriangle,
  Calendar,
  Clock,
  Coins,
  Dices,
  DollarSign,
  FileText,
  Fish,
  Headphones,
  ListTodo,
  Package,
  Plus,
  Settings,
  Trophy,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { ROUTES } from "@/lib/routes";
import { cn } from "@/lib/utils";
import type { SessionUser } from "@/types";
import { PERMISSIONS, type Permission } from "@/lib/permissions";
import { useQuickActionsFabOpen } from "@/lib/hooks/use-quick-actions-fab-open";
import { FeedbackQuickActionNavRow, FeedbackQuickActionSheetRow } from "@/components/feedback-quick-action-menu-item";
import {
  AdminFineBonusModal,
  FineBonusQuickActionNavRow,
  FineBonusQuickActionSheetRow,
} from "@/components/admin-fine-bonus-modal";
import { VAShadowbanReportModal } from "@/components/va-shadowban-report-modal";
import { WinnerSourcingSubmitModal } from "@/components/winner-sourcing-submit-modal";
import type { SocialAccount } from "@/services/marketing";

const SHEET_SPRING = { type: "spring" as const, damping: 25, stiffness: 300 };
const SWIPE_CLOSE_PX = 100;

type AdminQuickActionItem = {
  href: string;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
  /**
   * Permission that unlocks this action. Omit for universal actions.
   * The list is permission-driven (not role-hardcoded) so ANY role — system or
   * custom — sees exactly the actions its permissions grant.
   */
  permission?: Permission;
};

/**
 * Permission-driven quick actions. Each action declares the permission it needs;
 * the FAB shows whichever ones the current user's permissions unlock. Mappings are
 * chosen so system roles keep their existing visibility:
 *   - admin holds every permission → sees all actions (unchanged).
 *   - manager holds all-but-excluded → the earnings action stays admin-only via
 *     `earnings:config` (a manager-excluded permission), matching the old `adminOnly`.
 */
function buildAdminQuickActions(
  role: SessionUser["role"],
  userPermissions: Permission[],
): AdminQuickActionItem[] {
  const isManager = role === "manager";
  const can = (p: Permission) => userPermissions.includes(p);

  const items: AdminQuickActionItem[] = [
    {
      href: isManager ? ROUTES.admin.models : ROUTES.accountsModelssNew,
      label: "Add new model",
      Icon: UserPlus,
      permission: PERMISSIONS.ACCOUNTS_CREATE,
    },
    {
      href: isManager ? ROUTES.admin.accounts : `${ROUTES.accountsNew}?role=chatter`,
      label: "Add new chatter",
      Icon: Users,
      permission: PERMISSIONS.ACCOUNTS_CREATE,
    },
    {
      href: isManager ? ROUTES.admin.accounts : `${ROUTES.accountsNew}?role=virtual_assistant`,
      label: "Add new VA",
      Icon: Headphones,
      permission: PERMISSIONS.ACCOUNTS_CREATE,
    },
    {
      href: ROUTES.admin.weeklyProgram,
      label: "Create weekly program",
      Icon: Calendar,
      permission: PERMISSIONS.WEEKLY_PROGRAM_MANAGE,
    },
    // Admin-only earnings shortcut: `earnings:config` is excluded from managers, so this
    // reproduces the previous `adminOnly` flag purely through permissions.
    {
      href: ROUTES.admin.earnings,
      label: "View earnings",
      Icon: DollarSign,
      permission: PERMISSIONS.EARNINGS_CONFIG,
    },
    {
      href: ROUTES.admin.shiftActivity,
      label: "Shift activity",
      Icon: Activity,
      permission: PERMISSIONS.SHIFTS_ACTIVE_VIEW,
    },
    {
      href: ROUTES.admin.customs,
      label: "Customs",
      Icon: Package,
      permission: PERMISSIONS.CUSTOM_REQUESTS_VIEW,
    },
    { href: ROUTES.hours, label: "Hours", Icon: Clock, permission: PERMISSIONS.SHIFTS_VIEW },
    {
      href: ROUTES.activityLogs,
      label: "Activity logs",
      Icon: FileText,
      permission: PERMISSIONS.ACTIVITY_LOGS_VIEW,
    },
    {
      href: ROUTES.admin.spinResults,
      label: "Spin results",
      Icon: Dices,
      permission: PERMISSIONS.SPIN_WHEEL_MANAGE,
    },
    {
      href: ROUTES.admin.finesBonuses,
      label: "Fines & bonuses",
      Icon: Coins,
      permission: PERMISSIONS.FINES_MANAGE,
    },
    { href: ROUTES.admin.whales, label: "Whales", Icon: Fish, permission: PERMISSIONS.WHALES_VIEW },
    // Cross-cutting permission-gated action: any role that can manage VA tasks gets a shortcut.
    {
      href: ROUTES.admin.vaTasks,
      label: "Quick task create",
      Icon: ListTodo,
      permission: PERMISSIONS.VA_TASKS_MANAGE,
    },
    {
      href: ROUTES.settings,
      label: "System settings",
      Icon: Settings,
      permission: PERMISSIONS.SETTINGS_MANAGE,
    },
  ];

  return items.filter((i) => !i.permission || can(i.permission));
}

/** Marketing permission that unlocks the "Report shadowban" quick action. */
function canReportShadowban(userPermissions: Permission[]): boolean {
  return (
    userPermissions.includes(PERMISSIONS.MARKETING_SHADOWBAN_REPORT) ||
    userPermissions.includes(PERMISSIONS.MARKETING_MANAGE)
  );
}

function canSubmitWinnerSourcing(userPermissions: Permission[]): boolean {
  return userPermissions.includes(PERMISSIONS.WINNER_SOURCING_SUBMIT);
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
  /** Opens the add fine/bonus modal (admin FAB). */
  onOpenFineBonus?: () => void;
  /** Opens the shadowban report flow (only when the user holds a marketing permission). */
  onReportShadowban?: () => void;
  /** Opens Winner/Super Winner submit modal (winner_sourcing:submit). */
  onAddWinner?: () => void;
};

/**
 * Admin / manager quick actions — same bottom sheet behavior as chatter `QuickActionsModal`.
 */
export function AdminQuickActionsModal({
  open,
  onClose,
  actions,
  onOpenFineBonus,
  onReportShadowban,
  onAddWinner,
}: AdminQuickActionsModalProps) {
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
                {onOpenFineBonus ? (
                  <FineBonusQuickActionSheetRow onClose={onClose} onOpen={onOpenFineBonus} />
                ) : null}
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
                {onAddWinner ? (
                  <li>
                    <button
                      type="button"
                      onClick={onAddWinner}
                      className="flex w-full min-h-[52px] items-center gap-3 rounded-xl px-4 py-3 text-left transition-colors active:bg-white/10"
                    >
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-pink-500/20">
                        <Trophy className="h-4 w-4 text-pink-400" aria-hidden />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-white">Add a Winner / Super Winner</p>
                        <p className="text-xs text-white/40">Log a high-view video for recreation</p>
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

type AdminFloatingQuickActionsButtonProps = {
  user: SessionUser;
  /** Effective permissions of the current user — drives which quick actions appear. */
  userPermissions?: Permission[];
};

/**
 * Admin-area FAB (admin / manager / custom roles): mobile bottom sheet
 * (`AdminQuickActionsModal`), desktop dropdown above the + button.
 *
 * The visible quick actions are permission-driven, so custom roles get a working FAB
 * with whatever their permissions unlock (plus the universal "Report bug" action).
 */
export function AdminFloatingQuickActionsButton({ user, userPermissions = [] }: AdminFloatingQuickActionsButtonProps) {
  const { open, setOpen, requestClose, toggleOpen, showFabChrome } = useQuickActionsFabOpen();
  const [fineBonusOpen, setFineBonusOpen] = React.useState(false);
  const [shadowbanOpen, setShadowbanOpen] = React.useState(false);
  const [winnerSubmitOpen, setWinnerSubmitOpen] = React.useState(false);
  const [shadowbanAccounts, setShadowbanAccounts] = React.useState<SocialAccount[]>([]);

  const actions = React.useMemo(
    () => buildAdminQuickActions(user.role, userPermissions),
    [user.role, userPermissions]
  );
  const showShadowban = React.useMemo(() => canReportShadowban(userPermissions), [userPermissions]);
  const showWinnerSubmit = React.useMemo(() => canSubmitWinnerSourcing(userPermissions), [userPermissions]);
  const canManageFines = userPermissions.includes(PERMISSIONS.FINES_MANAGE);

  const openShadowbanReport = React.useCallback(() => {
    setOpen(false);
    setShadowbanOpen(true);
  }, [setOpen]);

  const openWinnerSubmit = React.useCallback(() => {
    setOpen(false);
    setWinnerSubmitOpen(true);
  }, [setOpen]);

  React.useEffect(() => {
    if (!shadowbanOpen) return;
    let cancelled = false;
    fetch("/api/va/marketing/accounts", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : { accounts: [] }))
      .then((d: { accounts?: SocialAccount[] }) => {
        if (!cancelled) setShadowbanAccounts(d.accounts ?? []);
      })
      .catch(() => {
        if (!cancelled) setShadowbanAccounts([]);
      });
    return () => {
      cancelled = true;
    };
  }, [shadowbanOpen]);

  // Sheet stays mounted while open (dcfd901). FAB chrome also stays while open so
  // MutationObserver overlay-hide does not unmount the + under the opening tap.

  const fabBottomStyle = {
    bottom: "calc(var(--mobile-bottom-nav-height, 76px) + env(safe-area-inset-bottom, 0px) + 12px)",
    right: "max(1rem, env(safe-area-inset-right, 0px))",
  } as const;

  const fabShadowStyle = {
    boxShadow: "0 10px 28px -6px rgba(236,72,153,0.55), 0 0 0 1px rgba(255,255,255,0.08) inset",
  } as const;

  return (
    <>
      <AdminFineBonusModal open={fineBonusOpen} onClose={() => setFineBonusOpen(false)} />
      {showShadowban ? (
        <VAShadowbanReportModal
          open={shadowbanOpen}
          onClose={() => setShadowbanOpen(false)}
          vaAccounts={shadowbanAccounts}
        />
      ) : null}
      {showWinnerSubmit ? (
        <WinnerSourcingSubmitModal open={winnerSubmitOpen} onClose={() => setWinnerSubmitOpen(false)} />
      ) : null}
      <div className="md:hidden">
        <AdminQuickActionsModal
          open={open}
          onClose={requestClose}
          actions={actions}
          onOpenFineBonus={canManageFines ? () => setFineBonusOpen(true) : undefined}
          onReportShadowban={showShadowban ? openShadowbanReport : undefined}
          onAddWinner={showWinnerSubmit ? openWinnerSubmit : undefined}
        />

        {showFabChrome ? (
          <div className="fixed z-[107] flex flex-col items-end" style={fabBottomStyle}>
            <button
              type="button"
              onClick={toggleOpen}
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

      {showFabChrome ? (
        <div className="pointer-events-none fixed bottom-6 right-6 z-[50] hidden flex-col items-end gap-2 md:pointer-events-auto md:flex">
          {open ? (
            <button
              type="button"
              className="pointer-events-auto fixed inset-0 z-[45] cursor-default bg-black/40 backdrop-blur-[2px]"
              aria-label="Close quick actions"
              onClick={requestClose}
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
                      onClick={requestClose}
                      className="flex items-center gap-3 px-4 py-3.5 text-left text-[15px] font-medium text-white/95 transition-colors hover:bg-white/[0.08]"
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-pink-500/20 text-pink-400">
                        <Icon className="h-4 w-4" />
                      </span>
                      {label}
                    </Link>
                  </li>
                ))}
                {canManageFines ? (
                  <FineBonusQuickActionNavRow
                    onClose={requestClose}
                    onOpen={() => setFineBonusOpen(true)}
                  />
                ) : null}
                {showShadowban ? (
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
                ) : null}
                {showWinnerSubmit ? (
                  <li>
                    <button
                      type="button"
                      onClick={openWinnerSubmit}
                      className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-white/5"
                    >
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-pink-500/20">
                        <Trophy className="h-4 w-4 text-pink-400" aria-hidden />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-white">Add a Winner / Super Winner</p>
                        <p className="text-xs text-white/40">Log a high-view video for recreation</p>
                      </div>
                    </button>
                  </li>
                ) : null}
                <FeedbackQuickActionNavRow onClose={requestClose} />
              </ul>
            </nav>
          ) : null}

          <button
            type="button"
            onClick={toggleOpen}
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
