import type { UserRole } from "@/types";

/** Resource:action permission strings — single source of truth for RBAC. */
export const PERMISSIONS = {
  BILLING_VIEW: "billing:view",
  BILLING_MANAGE: "billing:manage",

  ACCOUNTS_VIEW: "accounts:view",
  ACCOUNTS_CREATE: "accounts:create",
  ACCOUNTS_EDIT: "accounts:edit",
  ACCOUNTS_DELETE: "accounts:delete",
  ACCOUNTS_RESET_PASSWORD: "accounts:reset-password",

  EARNINGS_VIEW: "earnings:view",
  EARNINGS_CONFIG: "earnings:config",

  MISTAKES_VIEW: "mistakes:view",
  MISTAKES_MANAGE: "mistakes:manage",
  MISTAKES_REASONS_MANAGE: "mistakes:reasons-manage",

  CHALLENGES_VIEW: "challenges:view",
  CHALLENGES_MANAGE: "challenges:manage",

  REWARDS_VIEW: "rewards:view",
  REWARDS_CONFIG: "rewards:config",
  REWARDS_MANAGE: "rewards:manage",

  SHIFTS_VIEW: "shifts:view",
  SHIFTS_MANAGE: "shifts:manage",
  SHIFTS_START: "shifts:start",
  SHIFTS_ACTIVE_VIEW: "shifts:active-view",

  FINES_VIEW: "fines:view",
  FINES_MANAGE: "fines:manage",
  FINES_REVIEW: "fines:review",

  MODELS_VIEW: "models:view",
  MODELS_MANAGE: "models:manage",
  MODELS_SCHEDULES: "models:schedules",
  MODELS_AVAILABILITY: "models:availability",

  CLIENTS_VIEW: "clients:view",
  CLIENTS_MANAGE: "clients:manage",

  WHALES_VIEW: "whales:view",
  WHALES_MANAGE: "whales:manage",
  WHALES_ASSIGN: "whales:assign",

  MARKETING_VIEW: "marketing:view",
  MARKETING_MANAGE: "marketing:manage",
  MARKETING_SHADOWBAN_REPORT: "marketing:shadowban-report",

  VA_TASKS_VIEW: "va-tasks:view",
  VA_TASKS_MANAGE: "va-tasks:manage",
  VA_TASKS_ASSIGN: "va-tasks:assign",

  SOPS_VIEW: "sops:view",
  SOPS_MANAGE: "sops:manage",
  SOPS_SIGN_OFF: "sops:sign-off",
  SOPS_QUIZ: "sops:quiz",

  CONTENT_VIEW: "content:view",
  CONTENT_MANAGE: "content:manage",
  CONTENT_ASSIGN: "content:assign",

  SPIN_WHEEL_VIEW: "spin-wheel:view",
  SPIN_WHEEL_MANAGE: "spin-wheel:manage",

  NOTIFICATIONS_VIEW: "notifications:view",
  NOTIFICATIONS_MANAGE: "notifications:manage",
  NOTIFICATIONS_DIAGNOSTIC: "notifications:diagnostic",

  CUSTOM_REQUESTS_VIEW: "custom-requests:view",
  CUSTOM_REQUESTS_MANAGE: "custom-requests:manage",
  CUSTOM_REQUESTS_APPROVE: "custom-requests:approve",

  WEEKLY_PROGRAM_VIEW: "weekly-program:view",
  WEEKLY_PROGRAM_MANAGE: "weekly-program:manage",

  PAYMENTS_VIEW: "payments:view",
  PAYMENTS_SUBMIT: "payments:submit",

  SETTINGS_VIEW: "settings:view",
  SETTINGS_MANAGE: "settings:manage",

  ROLES_VIEW: "roles:view",
  ROLES_MANAGE: "roles:manage",

  FEEDBACK_VIEW: "feedback:view",
  FEEDBACK_MANAGE: "feedback:manage",

  PRICING_VIEW: "pricing:view",
  PRICING_MANAGE: "pricing:manage",

  MASS_LISTS_VIEW: "mass-lists:view",
  MASS_LISTS_MANAGE: "mass-lists:manage",
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const ALL_PERMISSIONS: Permission[] = Object.values(PERMISSIONS);

const MANAGER_EXCLUDED: Permission[] = [
  PERMISSIONS.ROLES_MANAGE,
  PERMISSIONS.ACCOUNTS_DELETE,
  PERMISSIONS.EARNINGS_CONFIG,
  PERMISSIONS.NOTIFICATIONS_DIAGNOSTIC,
  PERMISSIONS.REWARDS_CONFIG,
  PERMISSIONS.MISTAKES_REASONS_MANAGE,
];

const CHATTER_PERMISSIONS: Permission[] = [
  PERMISSIONS.SHIFTS_START,
  PERMISSIONS.SHIFTS_VIEW,
  PERMISSIONS.WHALES_VIEW,
  PERMISSIONS.WHALES_MANAGE,
  PERMISSIONS.CUSTOM_REQUESTS_VIEW,
  PERMISSIONS.CUSTOM_REQUESTS_MANAGE,
  PERMISSIONS.FINES_VIEW,
  PERMISSIONS.REWARDS_VIEW,
  PERMISSIONS.SOPS_VIEW,
  PERMISSIONS.SOPS_SIGN_OFF,
  PERMISSIONS.SOPS_QUIZ,
  PERMISSIONS.SPIN_WHEEL_VIEW,
  PERMISSIONS.SETTINGS_VIEW,
];

const VA_PERMISSIONS: Permission[] = [
  PERMISSIONS.VA_TASKS_VIEW,
  PERMISSIONS.MARKETING_VIEW,
  PERMISSIONS.MARKETING_SHADOWBAN_REPORT,
  PERMISSIONS.CONTENT_VIEW,
  PERMISSIONS.CONTENT_MANAGE,
  PERMISSIONS.WHALES_VIEW,
  PERMISSIONS.SOPS_VIEW,
  PERMISSIONS.SOPS_SIGN_OFF,
  PERMISSIONS.SOPS_QUIZ,
  PERMISSIONS.SETTINGS_VIEW,
  PERMISSIONS.WEEKLY_PROGRAM_VIEW,
];

const MODEL_PERMISSIONS: Permission[] = [
  PERMISSIONS.MODELS_VIEW,
  PERMISSIONS.CONTENT_VIEW,
  PERMISSIONS.SETTINGS_VIEW,
];

const CLIENT_PERMISSIONS: Permission[] = [
  PERMISSIONS.PAYMENTS_VIEW,
  PERMISSIONS.PAYMENTS_SUBMIT,
  PERMISSIONS.CLIENTS_VIEW,
];

/** Default permission sets per role — mirrors pre-RBAC behavior. */
export const DEFAULT_ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  admin: [...ALL_PERMISSIONS],
  manager: ALL_PERMISSIONS.filter((p) => !MANAGER_EXCLUDED.includes(p)),
  chatter: CHATTER_PERMISSIONS,
  virtual_assistant: VA_PERMISSIONS,
  model: MODEL_PERMISSIONS,
  client: CLIENT_PERMISSIONS,
};
