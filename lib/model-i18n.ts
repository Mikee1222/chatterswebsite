import type messagesEn from "@/messages/en.json";
import en from "@/messages/en.json";
import es from "@/messages/es.json";
import { getNestedMessageString, interpolate } from "@/lib/i18n-utils";
import { ROUTES } from "@/lib/routes";

export type ModelLang = "en" | "es";
export type ModelMessages = typeof messagesEn;

const roots: Record<ModelLang, ModelMessages["model"]> = {
  en: en.model,
  es: es.model,
};

/** href → key under `model.*` for main nav labels */
export const MODEL_NAV_HREF_TO_LABEL_KEY: Record<string, string> = {
  [ROUTES.model.home]: "nav.home",
  [ROUTES.model.myEarnings]: "nav.myEarnings",
  [ROUTES.model.contentCalendar]: "nav.contentCalendar",
  [ROUTES.model.contentAssignments]: "nav.vaContent",
  [ROUTES.model.schedule]: "nav.mySchedule",
  [ROUTES.model.customs]: "nav.customRequests",
  [ROUTES.settings]: "nav.settings",
};

export const MODEL_MAIN_TAB_SHORT_KEYS = ["nav.tabHome", "nav.tabEarnings", "nav.tabCalendar", "nav.tabSchedule"] as const;

/**
 * Translate keys under `model.*` (same paths as `useTranslations()` with default namespace).
 */
export function getModelT(language: ModelLang) {
  const root = roots[language];
  return function t(key: string, params?: Record<string, string | number | undefined | null>): string {
    const raw = getNestedMessageString(root, key);
    const str = raw ?? key;
    return interpolate(str, params);
  };
}

export function getModelShellTitle(pathname: string, language: ModelLang): string | undefined {
  if (!pathname.startsWith("/model")) return undefined;
  const t = getModelT(language);
  if (pathname === ROUTES.model.myEarnings) return t("shell.myEarnings");
  if (pathname === ROUTES.model.contentCalendar) return t("shell.contentCalendar");
  if (pathname === ROUTES.model.contentAssignments) return t("shell.vaContent");
  if (pathname === ROUTES.model.weeklyAvailability) return t("shell.weeklyAvailability");
  if (pathname === ROUTES.model.schedule) return t("shell.schedule");
  if (pathname === ROUTES.model.tasks) return t("shell.tasks");
  if (pathname === ROUTES.model.liveStreams) return t("shell.liveStreams");
  if (pathname === ROUTES.model.customs) return t("shell.customs");
  if (pathname === ROUTES.model.home || pathname === ROUTES.model.dashboard) return t("shell.home");
  return t("shell.modelArea");
}
