/**
 * Central route map — single source of truth for all app paths.
 * Use ROUTES (and the helper functions below) everywhere: sidebar, redirects,
 * router.push, revalidatePath, href, Link. Do not hardcode page paths in components.
 *
 * REAL ROUTE MAP (must match app/(dashboard)/... and app/login/... page.tsx):
 *
 *   Auth:        /login, /dashboard
 *   Chatter:     /home, /shift, /weekly-program, /weekly-availability, /request-custom,
 *                /my-whales, /my-whales/new, /log-transaction
 *   VA:          /va-home, /va-shift, /va-weekly-program, /va-weekly-availability, /live-shifts, /models
 *   Admin:       /admin, /admin/weekly-program, /admin/weekly-program-va, /admin/live-shifts, /admin/models,
 *                /admin/shift-activity, /admin/whales, /admin/customs, /admin/accounts
 *   Accounts:    /accounts, /accounts/new, /accounts/[id]/edit, /accounts/[id]/reset-password,
 *                /accounts/modelss/new, /accounts/modelss/[id]/edit
 *   Other:       /settings, /active-shifts, /task-shifts, /free-modelss, /whales, /whales/[id]
 */

export const ROUTES = {
  login: "/login",
  dashboard: "/dashboard",

  /** Chatter (role: chatter) */
  chatter: {
    home: "/home",
    shift: "/shift",
    weeklyProgram: "/weekly-program",
    weeklyAvailability: "/weekly-availability",
    requestCustom: "/request-custom",
    myWhales: "/my-whales",
    myWhalesNew: "/my-whales/new",
    logTransaction: "/log-transaction",
  },

  /** Virtual assistant (role: virtual_assistant) */
  va: {
    home: "/va-home",
    shift: "/va-shift",
    weeklyProgram: "/va-weekly-program",
    weeklyAvailability: "/va-weekly-availability",
    liveShifts: "/live-shifts",
    models: "/models",
  },

  /** Admin / manager (role: admin | manager) */
  admin: {
    home: "/admin",
    weeklyProgram: "/admin/weekly-program",
    weeklyProgramVa: "/admin/weekly-program-va",
    liveShifts: "/admin/live-shifts",
    models: "/admin/models",
    shiftActivity: "/admin/shift-activity",
    whales: "/admin/whales",
    customs: "/admin/customs",
    accounts: "/admin/accounts",
  },

  /** Shared: accounts (admin-only UI) */
  accounts: "/accounts",
  accountsNew: "/accounts/new",
  accountsModelss: "/accounts?section=modelss",
  accountsModelssNew: "/accounts/modelss/new",
  accountEdit: (id: string) => `/accounts/${id}/edit`,
  accountResetPassword: (id: string) => `/accounts/${id}/reset-password`,
  modelEdit: (id: string) => `/accounts/modelss/${id}/edit`,

  /** Other dashboard pages */
  settings: "/settings",
  activeShifts: "/active-shifts",
  taskShifts: "/task-shifts",
  freeModelss: "/free-modelss",
  whales: "/whales",
  whaleDetail: (id: string) => `/whales/${id}`,
} as const;

/** Build admin weekly program URL with optional week_start query. */
export function adminWeeklyProgramUrl(weekStart?: string): string {
  const base = ROUTES.admin.weeklyProgram;
  if (!weekStart) return base;
  return `${base}?week_start=${encodeURIComponent(weekStart)}`;
}

/** Build admin VA weekly program URL with optional week_start query. */
export function adminWeeklyProgramVaUrl(weekStart?: string): string {
  const base = ROUTES.admin.weeklyProgramVa;
  if (!weekStart) return base;
  return `${base}?week_start=${encodeURIComponent(weekStart)}`;
}

/** Build weekly availability URL with optional week_start query. */
export function weeklyAvailabilityUrl(weekStart?: string): string {
  const base = ROUTES.chatter.weeklyAvailability;
  if (!weekStart) return base;
  return `${base}?week_start=${encodeURIComponent(weekStart)}`;
}

/** Build VA weekly availability URL with optional week_start query. */
export function vaWeeklyAvailabilityUrl(weekStart?: string): string {
  const base = ROUTES.va.weeklyAvailability;
  if (!weekStart) return base;
  return `${base}?week_start=${encodeURIComponent(weekStart)}`;
}

/** Build admin shift activity URL with optional query string. */
export function adminShiftActivityUrl(params?: Record<string, string>): string {
  const base = ROUTES.admin.shiftActivity;
  if (!params || Object.keys(params).length === 0) return base;
  const q = new URLSearchParams(params);
  return `${base}?${q.toString()}`;
}

/** Build admin home URL with optional query string. */
export function adminHomeUrl(params?: Record<string, string>): string {
  const base = ROUTES.admin.home;
  if (!params || Object.keys(params).length === 0) return base;
  const q = new URLSearchParams(params);
  return `${base}?${q.toString()}`;
}
