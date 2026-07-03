import { getThisWeekMonday } from "@/lib/weekly-program";

/**
 * Central route map — single source of truth for all app paths.
 * Use ROUTES (and the helper functions below) everywhere: sidebar, redirects,
 * router.push, revalidatePath, href, Link. Do not hardcode page paths in components.
 *
 * REAL ROUTE MAP (must match app/(dashboard)/... and app/login/... page.tsx):
 *
 *   Auth:        /login, /dashboard
 *   Chatter:     /home, /shift, /weekly-program, /weekly-availability, /request-custom,
 *                /my-whales, /my-whales/new, /my-rebills, /log-transaction, /rewards, /spin-wheel, /challenges, /mistakes, /fines-bonuses, /admin/spin-results
 *   VA:          /va-home, /va-tasks, /va/schedule, /va/schedule-overview, /va/whales, /va/content-assignments, /va/custom-requests, /va/mistakes, /fines-bonuses, /va/blur-tool, /va-shift, /va-weekly-program, /va-weekly-availability, /live-shifts, /models
 *   Admin:       /admin, /admin/va-tasks, /admin/weekly-program, /admin/weekly-program-va, /admin/live-shifts, /admin/models, /admin/mistakes, /admin/mistake-reasons,
 *                /admin/shift-activity, /admin/earnings, /admin/earnings-config, /admin/rewards, /admin/challenges, /admin/spin-results, /admin/whales, /admin/whales/[id], /admin/customs, /admin/custom-requests, /admin/accounts, /admin/accounts/[id], /admin/rewards-config,
 *                /admin/model-schedules/overview, /admin/va-content-assignments, /admin/rebills-tips, /admin/fines-bonuses,
 *                /admin/test-notifications, /admin/notification-diagnostic
 *   Accounts:    /accounts, /accounts/new, /accounts/[id]/edit, /accounts/[id]/reset-password,
 *                /accounts/modelss/new, /accounts/modelss/[id]/edit
 *   Model:        /model, /model/earnings, /model/content-calendar, /model/content-assignments, /model/availability, /model/schedule, /model/custom-requests, /settings (shared)
 *   Other:       /settings, /hours, /fines-bonuses, /active-shifts, /task-shifts, /free-modelss, /whales, /whales/[id]
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
    myRebills: "/my-rebills",
    myWhaleEdit: (id: string) => `/my-whales/${id}/edit`,
    logTransaction: "/log-transaction",
    rewards: "/rewards",
    spinWheel: "/spin-wheel",
    challenges: "/challenges",
    mistakes: "/mistakes",
    informations: "/informations",
    sops: "/sops",
  },

  /** Virtual assistant (role: virtual_assistant) */
  va: {
    home: "/va-home",
    tasks: "/va-tasks",
    /** Personal week/month view: VA program shifts, tasks, active shift. */
    schedule: "/va/schedule",
    /** Read-only multi-model schedule (models inferred from VA content assignments). */
    scheduleOverview: "/va/schedule-overview",
    /** Read-only agency whales list (same filters as admin). */
    whales: "/va/whales",
    /** Create & list VA → model content assignments */
    contentAssignments: "/va/content-assignments",
    /** Agency queue for customs (Airtable admin_status pending/accepted/rejected). */
    customRequests: "/va/custom-requests",
    /** Client-side photo blur utility (VA + admin nav). */
    blurTool: "/va/blur-tool",
    shift: "/va-shift",
    weeklyProgram: "/va-weekly-program",
    weeklyAvailability: "/va-weekly-availability",
    liveShifts: "/live-shifts",
    models: "/models",
    mistakes: "/va/mistakes",
    marketingAccounts: "/va/marketing",
  },

  /** Admin / manager (role: admin | manager) */
  admin: {
    home: "/admin",
    customRoleHome: "/admin/custom-role-home",
    weeklyProgram: "/admin/weekly-program",
    weeklyProgramVa: "/admin/weekly-program-va",
    liveShifts: "/admin/live-shifts",
    models: "/admin/models",
    /** Admin model detail (settings / period toggle). */
    modelDetail: (id: string) => `/admin/models/${encodeURIComponent(id)}`,
    customRequests: "/admin/custom-requests",
    rebillsTips: "/admin/rebills-tips",
    finesBonuses: "/admin/fines-bonuses",
    shiftActivity: "/admin/shift-activity",
    earnings: "/admin/earnings",
    earningsConfig: "/admin/earnings-config",
    whales: "/admin/whales",
    /** Admin whale profile (Airtable whales record id). */
    whaleDetail: (id: string) => `/admin/whales/${encodeURIComponent(id)}`,
    /** Deep link → redirects to account edit (Airtable users record id). */
    accountDetail: (id: string) => `/admin/accounts/${encodeURIComponent(id)}`,
    customs: "/admin/customs",
    accounts: "/admin/accounts",
    clients: "/admin/clients",
    billing: "/admin/billing",
    paymentMethods: "/admin/payment-methods",
    submissions: "/admin/submissions",
    partnership: "/admin/partnership",
    /** Model operations (modelss) */
    modelAvailability: "/admin/model-availability",
    modelSchedules: "/admin/model-schedules",
    /** Read-only multi-model schedule overview (±8 weeks from selected week). */
    modelSchedulesOverview: "/admin/model-schedules/overview",
    vaContentAssignments: "/admin/va-content-assignments",
    modelTasks: "/admin/model-tasks",
    modelLiveStreams: "/admin/model-live-streams",
    modelCustoms: "/admin/model-customs",
    modelContentRequests: "/admin/model-content-requests",
    expenseRequests: "/admin/expense-requests",
    marketing: "/admin/marketing",
    spotChecks: "/admin/spot-checks",
    dailyReview: "/admin/daily-review",
    informations: "/admin/informations",
    sopLibrary: "/admin/sop-library",
    pdfMaker: "/admin/pdf-maker",
    vaTasks: "/admin/va-tasks",
    taskTemplates: "/admin/task-templates",
    winnerVideos: "/admin/winner-videos",
    rewardsConfig: "/admin/rewards-config",
    rewards: "/admin/rewards",
    challenges: "/admin/challenges",
    mistakes: "/admin/mistakes",
    mistakeReasons: "/admin/mistake-reasons",
    feedback: "/admin/feedback",
    spinResults: "/admin/spin-results",
    /** Admin-only notification lab (`ENABLE_NOTIFICATION_TESTING` in production). */
    testNotifications: "/admin/test-notifications",
    /** Admin-only full notification pipeline diagnostic (same env gate as test notifications). */
    notificationDiagnostic: "/admin/notification-diagnostic",
    roles: "/admin/roles",
    linkPages: "/admin/link-pages",
  },

  /** Public link-in-bio pages */
  linkPage: (slug: string) => `/l/${encodeURIComponent(slug)}`,

  /** Model (role: model) – modelss-linked user */
  model: {
    home: "/model",
    dashboard: "/model",
    myEarnings: "/model/earnings",
    contentCalendar: "/model/content-calendar",
    contentAssignments: "/model/content-assignments",
    weeklyAvailability: "/model/availability",
    schedule: "/model/schedule",
    tasks: "/model/tasks",
    liveStreams: "/model/live-streams",
    /** Model workflow for assigned customs (canonical path). */
    customs: "/model/custom-requests",
    settings: "/settings",
  },

  client: {
    home: "/client",
    payChatting: "/client/pay-chatting",
    payCrm: "/client/pay-crm",
    gunzoPartnership: "/client/gunzo-partnership",
    weeklyPayments: "/client/weekly-payments",
    payments: "/client/payments",
    paymentHistory: "/client/payment-history",
    invoices: "/client/invoices",
    content: "/client/content",
    models: "/client/models",
    calendar: "/client/calendar",
    settings: "/client/settings",
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
  /** Supervisor spot-check submissions (permission-gated, not under /admin). */
  spotChecks: "/spot-checks",
  /** Supervisor daily review submissions (permission-gated, not under /admin). */
  dailyReview: "/daily-review",
  /** VA winner video submissions (permission-gated). */
  winners: "/winners",
  /** Standalone video transcription tool (permission-gated). */
  transcriptVideos: "/transcript-videos",
  /** Fines & bonuses (chatter + VA shared). */
  finesBonuses: "/fines-bonuses",
  /** SOP Library member view (chatter + VA shared). */
  sops: "/sops",
  settings: "/settings",
  /** Hours / time summary (VA, chatter, admin). */
  hours: "/hours",
  activityLogs: "/activity-logs",
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

/** Build model weekly availability URL with optional week_start query. */
export function modelWeeklyAvailabilityUrl(weekStart?: string): string {
  const base = ROUTES.model.weeklyAvailability;
  if (!weekStart) return base;
  return `${base}?week_start=${encodeURIComponent(weekStart)}`;
}

/** Build model schedule URL with optional week_start and action (quick actions). */
export function modelScheduleUrl(opts?: { weekStart?: string; action?: "submit" | "request-off" }): string {
  const base = ROUTES.model.schedule;
  const p = new URLSearchParams();
  const monday = opts?.weekStart?.trim();
  if (monday && monday !== getThisWeekMonday()) p.set("week_start", monday);
  if (opts?.action) p.set("action", opts.action);
  const q = p.toString();
  return q ? `${base}?${q}` : base;
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
