/**
 * Per-user sidebar navigation preferences (pinned items, collapsed/hidden sections).
 * Stored on the users row as JSON (`nav_preferences` column / Airtable long text).
 */

import { ROUTES } from "@/lib/routes";
import { NAV_SECTION_ORDER } from "@/lib/nav-config";

export type UserNavPreferences = {
  /** Ordered href list — max {@link MAX_PINNED_NAV_ITEMS}. */
  pinned_hrefs: string[];
  /** Section labels collapsed in the sidebar (admin area). */
  collapsed_sections: string[];
  /** Entire section labels hidden from this user's nav. */
  hidden_sections: string[];
};

export const MAX_PINNED_NAV_ITEMS = 6;

export const PINNED_NAV_SECTION_KEY = "Pinned";

/** Sections collapsed by default for new admin users (Overview + Team stay expanded). */
export const DEFAULT_COLLAPSED_NAV_SECTIONS: readonly string[] = [
  "CONTENT PIPELINE",
  "PERFORMANCE & ANALYTICS",
  "MARKETING",
  "REVIEW & QA",
  "FINANCE",
  "SECURITY",
  "REWARDS",
  "TOOLS",
  "SETTINGS",
];

/** Default pinned destinations for new admin / manager users. */
export const DEFAULT_ADMIN_PINNED_HREFS: readonly string[] = [
  ROUTES.admin.home,
  ROUTES.admin.accounts,
  ROUTES.admin.liveShifts,
  ROUTES.admin.models,
];

function parseStringArray(v: unknown, max?: number): string[] {
  if (!Array.isArray(v)) return [];
  const out = v.filter((x): x is string => typeof x === "string" && x.trim().length > 0);
  return max != null ? out.slice(0, max) : out;
}

export function emptyNavPreferences(): UserNavPreferences {
  return { pinned_hrefs: [], collapsed_sections: [], hidden_sections: [] };
}

/** Parse stored JSON; returns null when empty / invalid. */
export function parseNavPreferencesJson(raw: string | null | undefined): UserNavPreferences | null {
  if (raw == null || String(raw).trim() === "") return null;
  try {
    const parsed = JSON.parse(String(raw)) as unknown;
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return null;
    const o = parsed as Record<string, unknown>;
    return {
      pinned_hrefs: parseStringArray(o.pinned_hrefs, MAX_PINNED_NAV_ITEMS),
      collapsed_sections: parseStringArray(o.collapsed_sections),
      hidden_sections: parseStringArray(o.hidden_sections),
    };
  } catch {
    return null;
  }
}

export function serializeNavPreferences(prefs: UserNavPreferences): string {
  return JSON.stringify({
    pinned_hrefs: prefs.pinned_hrefs.slice(0, MAX_PINNED_NAV_ITEMS),
    collapsed_sections: prefs.collapsed_sections,
    hidden_sections: prefs.hidden_sections,
  });
}

/** First-time admin defaults when no row has been saved yet. */
export function defaultNavPreferencesForRole(role: string): UserNavPreferences {
  const r = role.trim().toLowerCase();
  if (r === "admin" || r === "manager") {
    return {
      pinned_hrefs: [...DEFAULT_ADMIN_PINNED_HREFS],
      collapsed_sections: [...DEFAULT_COLLAPSED_NAV_SECTIONS],
      hidden_sections: [],
    };
  }
  return emptyNavPreferences();
}

/** Merge stored prefs with role defaults (stored wins when present). */
export function resolveNavPreferences(
  stored: UserNavPreferences | null,
  role: string
): UserNavPreferences {
  if (!stored) return defaultNavPreferencesForRole(role);
  const defaults = defaultNavPreferencesForRole(role);
  return {
    pinned_hrefs:
      stored.pinned_hrefs.length > 0 ? stored.pinned_hrefs : defaults.pinned_hrefs,
    collapsed_sections:
      stored.collapsed_sections.length > 0
        ? stored.collapsed_sections
        : defaults.collapsed_sections,
    hidden_sections: stored.hidden_sections,
  };
}

/** Known section labels — used to validate hide/collapse toggles. */
export const KNOWN_NAV_SECTIONS: readonly string[] = [
  PINNED_NAV_SECTION_KEY,
  ...NAV_SECTION_ORDER,
  "TASKS",
  "WORK",
  "INFO",
  "REQUESTS",
  "OTHER",
];
