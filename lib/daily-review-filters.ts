/**
 * Daily Review checklist filters — parse/serialize query params, apply narrowing,
 * and build facets from the day's allowed tree only (never expands scope).
 */
import { TASK_STEP_TYPES, type TaskStepType } from "@/lib/task-step-types";
import type {
  DailyReviewChecklistItem,
  DailyReviewChecklistSummary,
  DailyReviewChecklistTask,
  DailyReviewChecklistVa,
  DailyReviewChecklistVaShared,
} from "@/services/daily-review-checklist";

export const DAILY_REVIEW_PLATFORMS = ["Instagram", "TikTok", "Facebook", "Snapchat"] as const;
export type DailyReviewPlatform = (typeof DAILY_REVIEW_PLATFORMS)[number];

export const DAILY_REVIEW_REVIEW_STATUSES = ["pending", "verified", "flagged"] as const;
export type DailyReviewReviewStatusFilter = (typeof DAILY_REVIEW_REVIEW_STATUSES)[number];

export const DAILY_REVIEW_TASK_STATES = ["completed", "in_progress", "not_started"] as const;
export type DailyReviewTaskStateFilter = (typeof DAILY_REVIEW_TASK_STATES)[number];

export const DAILY_REVIEW_EVIDENCE = ["has", "missing"] as const;
export type DailyReviewEvidenceFilter = (typeof DAILY_REVIEW_EVIDENCE)[number];

export const DAILY_REVIEW_SORTS = ["person", "completion", "flagged", "model"] as const;
export type DailyReviewSort = (typeof DAILY_REVIEW_SORTS)[number];

export const DAILY_REVIEW_PRESETS = [
  "needs_review",
  "flagged",
  "incomplete",
  "missing_screenshots",
] as const;
export type DailyReviewPreset = (typeof DAILY_REVIEW_PRESETS)[number];

export type DailyReviewFilters = {
  roles: string[];
  people: string[];
  models: string[];
  review_status: DailyReviewReviewStatusFilter[];
  task_state: DailyReviewTaskStateFilter[];
  phases: string[];
  platforms: DailyReviewPlatform[];
  item_types: TaskStepType[];
  evidence: DailyReviewEvidenceFilter | "";
  q: string;
  sort: DailyReviewSort;
  preset: DailyReviewPreset | "";
};

export type DailyReviewFilterFacetOption = { value: string; label: string; count: number };

export type DailyReviewFilterFacets = {
  roles: DailyReviewFilterFacetOption[];
  people: DailyReviewFilterFacetOption[];
  models: DailyReviewFilterFacetOption[];
  phases: DailyReviewFilterFacetOption[];
  platforms: DailyReviewFilterFacetOption[];
  item_types: DailyReviewFilterFacetOption[];
};

export const EMPTY_DAILY_REVIEW_FILTERS: DailyReviewFilters = {
  roles: [],
  people: [],
  models: [],
  review_status: [],
  task_state: [],
  phases: [],
  platforms: [],
  item_types: [],
  evidence: "",
  q: "",
  sort: "person",
  preset: "",
};

const CSV_KEYS = [
  "roles",
  "people",
  "models",
  "review_status",
  "task_state",
  "phases",
  "platforms",
  "item_types",
] as const;

function splitCsv(raw: string | null | undefined): string[] {
  if (!raw?.trim()) return [];
  return [
    ...new Set(
      raw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    ),
  ];
}

function asMember<T extends string>(value: string, allowed: readonly T[]): T | null {
  return (allowed as readonly string[]).includes(value) ? (value as T) : null;
}

function intersectAllowed(requested: string[], allowed: Set<string>): string[] {
  if (!requested.length) return [];
  return requested.filter((id) => allowed.has(id));
}

/** Infer social platform from checklist item / phase title text. */
export function inferDailyReviewPlatform(text: string): DailyReviewPlatform | null {
  const t = text.trim().toLowerCase();
  if (!t) return null;
  if (
    t.includes("instagram") ||
    /\big\b/.test(t) ||
    t.includes(" ig ") ||
    t.startsWith("ig ") ||
    t.includes("reel") ||
    t.includes("story")
  ) {
    // Prefer explicit platform tokens over generic "story/reel" when another platform is named.
    if (t.includes("tiktok") || t.includes("tik tok") || /\btt\b/.test(t)) return "TikTok";
    if (t.includes("facebook") || /\bfb\b/.test(t)) return "Facebook";
    if (t.includes("snapchat") || t.includes("snap ")) return "Snapchat";
    if (t.includes("instagram") || /\big\b/.test(t) || t.includes(" ig ")) return "Instagram";
    // story/reel alone → Instagram convention for this agency's checklists
    if (t.includes("reel") || t.includes("story")) return "Instagram";
  }
  if (t.includes("tiktok") || t.includes("tik tok") || /\btt\b/.test(t) || t.includes("spotlight")) {
    return "TikTok";
  }
  if (t.includes("facebook") || /\bfb\b/.test(t)) return "Facebook";
  if (t.includes("snapchat") || (t.includes("snap") && !t.includes("snapshot"))) return "Snapchat";
  return null;
}

export function emptyDailyReviewFilters(): DailyReviewFilters {
  return { ...EMPTY_DAILY_REVIEW_FILTERS, roles: [], people: [], models: [], review_status: [], task_state: [], phases: [], platforms: [], item_types: [] };
}

export function hasActiveDailyReviewFilters(filters: DailyReviewFilters): boolean {
  return (
    filters.roles.length > 0 ||
    filters.people.length > 0 ||
    filters.models.length > 0 ||
    filters.review_status.length > 0 ||
    filters.task_state.length > 0 ||
    filters.phases.length > 0 ||
    filters.platforms.length > 0 ||
    filters.item_types.length > 0 ||
    Boolean(filters.evidence) ||
    Boolean(filters.q.trim()) ||
    Boolean(filters.preset) ||
    filters.sort !== "person"
  );
}

export function parseDailyReviewFilters(
  input: URLSearchParams | Record<string, string | string[] | undefined | null>,
): DailyReviewFilters {
  const get = (key: string): string => {
    if (input instanceof URLSearchParams) return input.get(key) ?? "";
    const v = input[key];
    if (Array.isArray(v)) return v[0] ?? "";
    return v ?? "";
  };

  const filters = emptyDailyReviewFilters();
  filters.roles = splitCsv(get("roles"));
  filters.people = splitCsv(get("people"));
  filters.models = splitCsv(get("models"));
  filters.phases = splitCsv(get("phases"));
  filters.review_status = splitCsv(get("review_status"))
    .map((s) => asMember(s, DAILY_REVIEW_REVIEW_STATUSES))
    .filter((s): s is DailyReviewReviewStatusFilter => Boolean(s));
  filters.task_state = splitCsv(get("task_state"))
    .map((s) => asMember(s, DAILY_REVIEW_TASK_STATES))
    .filter((s): s is DailyReviewTaskStateFilter => Boolean(s));
  filters.platforms = splitCsv(get("platforms"))
    .map((s) => asMember(s, DAILY_REVIEW_PLATFORMS))
    .filter((s): s is DailyReviewPlatform => Boolean(s));
  filters.item_types = splitCsv(get("item_types"))
    .map((s) => asMember(s, TASK_STEP_TYPES))
    .filter((s): s is TaskStepType => Boolean(s));
  const evidence = asMember(get("evidence").trim(), DAILY_REVIEW_EVIDENCE);
  filters.evidence = evidence ?? "";
  filters.q = get("q").trim().slice(0, 200);
  filters.sort = asMember(get("sort").trim(), DAILY_REVIEW_SORTS) ?? "person";
  filters.preset = asMember(get("preset").trim(), DAILY_REVIEW_PRESETS) ?? "";
  return applyDailyReviewPreset(filters);
}

/** Expand a quick preset onto concrete filter fields (preset remains set for UI chips). */
export function applyDailyReviewPreset(filters: DailyReviewFilters): DailyReviewFilters {
  if (!filters.preset) return filters;
  const next = { ...filters };
  switch (filters.preset) {
    case "needs_review":
      next.review_status = ["pending"];
      break;
    case "flagged":
      next.review_status = ["flagged"];
      break;
    case "incomplete":
      next.task_state = ["in_progress", "not_started"];
      break;
    case "missing_screenshots":
      next.evidence = "missing";
      break;
  }
  return next;
}

export function serializeDailyReviewFilters(filters: DailyReviewFilters): URLSearchParams {
  const params = new URLSearchParams();
  for (const key of CSV_KEYS) {
    const values = filters[key];
    if (values.length) params.set(key, values.join(","));
  }
  if (filters.evidence) params.set("evidence", filters.evidence);
  if (filters.q.trim()) params.set("q", filters.q.trim());
  if (filters.sort && filters.sort !== "person") params.set("sort", filters.sort);
  if (filters.preset) params.set("preset", filters.preset);
  return params;
}

export function dailyReviewFiltersToQueryString(filters: DailyReviewFilters, date?: string): string {
  const params = serializeDailyReviewFilters(filters);
  if (date) params.set("date", date);
  return params.toString();
}

type ItemLike = DailyReviewChecklistItem | DailyReviewChecklistVaShared["tasks"][number]["items"][number];
type TaskLike = DailyReviewChecklistTask | DailyReviewChecklistVaShared["tasks"][number];
type VaLike = DailyReviewChecklistVa | DailyReviewChecklistVaShared;

function itemVerificationStatuses(item: ItemLike): Array<"verified" | "flagged_not_done"> {
  if ("verifications" in item && Array.isArray(item.verifications)) {
    return item.verifications.map((v) => v.verified_status);
  }
  if ("verification" in item && item.verification) {
    return [item.verification.verified_status];
  }
  return [];
}

function itemMatchesReviewStatus(item: ItemLike, wanted: Set<DailyReviewReviewStatusFilter>): boolean {
  if (!wanted.size) return true;
  const statuses = itemVerificationStatuses(item);
  const isVerified = statuses.includes("verified");
  const isFlagged = statuses.includes("flagged_not_done");
  const isPending = !isVerified && !isFlagged;
  // "Pending" = completed by VA but not yet reviewed (product definition).
  const pendingOk = wanted.has("pending") && isPending && item.va_status === "completed";
  const verifiedOk = wanted.has("verified") && isVerified;
  const flaggedOk = wanted.has("flagged") && isFlagged;
  return pendingOk || verifiedOk || flaggedOk;
}

function mapTaskState(status: string): DailyReviewTaskStateFilter {
  if (status === "done" || status === "completed") return "completed";
  if (status === "in_progress") return "in_progress";
  return "not_started";
}

function itemPlatform(item: ItemLike): DailyReviewPlatform | null {
  if ("platform" in item && item.platform) return item.platform as DailyReviewPlatform;
  return inferDailyReviewPlatform(`${item.title} ${item.phase_title ?? ""}`);
}

function itemStepType(item: ItemLike): TaskStepType {
  if ("step_type" in item && item.step_type) return item.step_type as TaskStepType;
  return "Other";
}

function itemModelId(item: ItemLike): string {
  return ("model_id" in item && item.model_id ? String(item.model_id) : "").trim();
}

function vaRole(va: VaLike): string {
  return ("role" in va && va.role ? String(va.role) : "").trim();
}

function itemMatchesFilters(item: ItemLike, task: TaskLike, filters: DailyReviewFilters): boolean {
  if (filters.phases.length && !filters.phases.includes(item.phase_title || `Phase ${item.phase_number}`)) {
    return false;
  }
  if (filters.item_types.length && !filters.item_types.includes(itemStepType(item))) {
    return false;
  }
  if (filters.platforms.length) {
    const plat = itemPlatform(item);
    if (!plat || !filters.platforms.includes(plat)) return false;
  }
  if (filters.models.length) {
    const mid = itemModelId(item);
    if (!mid || !filters.models.includes(mid)) return false;
  }
  if (filters.task_state.length) {
    const state = mapTaskState(task.task_status);
    if (!filters.task_state.includes(state)) return false;
  }
  if (filters.review_status.length) {
    if (!itemMatchesReviewStatus(item, new Set(filters.review_status))) return false;
  }
  if (filters.evidence === "has") {
    if (!item.requires_screenshot || item.screenshot_count <= 0) return false;
  } else if (filters.evidence === "missing") {
    if (!item.requires_screenshot || item.screenshot_count > 0) return false;
  }
  if (filters.q.trim()) {
    const q = filters.q.trim().toLowerCase();
    const hay = `${task.task_title} ${item.title} ${item.phase_title}`.toLowerCase();
    if (!hay.includes(q)) return false;
  }
  return true;
}

function computeStatsFromTasks(tasks: DailyReviewChecklistTask[]): DailyReviewChecklistVa["stats"] & { overdue: number } {
  let total_items = 0;
  let va_completed = 0;
  let verified = 0;
  let flagged = 0;
  let unverified = 0;
  let overdue = 0;
  for (const task of tasks) {
    for (const item of task.items) {
      total_items += 1;
      if (item.va_status === "completed") va_completed += 1;
      if (item.verification?.verified_status === "verified") verified += 1;
      else if (item.verification?.verified_status === "flagged_not_done") flagged += 1;
      else unverified += 1;
      if (item.is_overdue) overdue += 1;
    }
  }
  return { total_items, va_completed, verified, flagged, unverified, overdue };
}

function computeSharedStats(
  tasks: DailyReviewChecklistVaShared["tasks"],
): DailyReviewChecklistVa["stats"] & { overdue: number } {
  let total_items = 0;
  let va_completed = 0;
  let verified = 0;
  let flagged = 0;
  let overdue = 0;
  for (const task of tasks) {
    for (const item of task.items) {
      total_items += 1;
      if (item.va_status === "completed") va_completed += 1;
      if (item.verifications.some((v) => v.verified_status === "flagged_not_done")) flagged += 1;
      else if (item.verifications.some((v) => v.verified_status === "verified")) verified += 1;
      if (item.is_overdue) overdue += 1;
    }
  }
  const unverified = Math.max(0, total_items - verified - flagged);
  return { total_items, va_completed, verified, flagged, unverified, overdue };
}

function sortVas<T extends VaLike>(vas: T[], sort: DailyReviewSort): T[] {
  const copy = [...vas];
  copy.sort((a, b) => {
    if (sort === "flagged") {
      const d = b.stats.flagged - a.stats.flagged;
      if (d) return d;
    } else if (sort === "completion") {
      const ap = a.stats.total_items ? a.stats.va_completed / a.stats.total_items : 0;
      const bp = b.stats.total_items ? b.stats.va_completed / b.stats.total_items : 0;
      const d = bp - ap;
      if (d) return d;
    } else if (sort === "model") {
      const am =
        ("primary_model_name" in a && a.primary_model_name ? String(a.primary_model_name) : "") ||
        a.va_name;
      const bm =
        ("primary_model_name" in b && b.primary_model_name ? String(b.primary_model_name) : "") ||
        b.va_name;
      const d = am.localeCompare(bm);
      if (d) return d;
    }
    return a.va_name.localeCompare(b.va_name);
  });
  return copy;
}

/**
 * Narrow a supervisor checklist tree. `allowedPersonIds` / `allowedRoleSlugs` /
 * `allowedModelIds` are the day's universe — requested filters are intersected
 * so URL tampering cannot expand scope.
 */
export function filterDailyReviewVas(
  vas: DailyReviewChecklistVa[],
  filters: DailyReviewFilters,
  scope: {
    allowedPersonIds: Set<string>;
    allowedRoleSlugs: Set<string>;
    allowedModelIds: Set<string>;
  },
): DailyReviewChecklistVa[] {
  const people = intersectAllowed(filters.people, scope.allowedPersonIds);
  const roles = intersectAllowed(filters.roles, scope.allowedRoleSlugs);
  const models = intersectAllowed(filters.models, scope.allowedModelIds);
  // If the client asked for people/roles/models but none are in scope → empty.
  if (filters.people.length && !people.length) return [];
  if (filters.roles.length && !roles.length) return [];
  if (filters.models.length && !models.length) return [];

  const effective: DailyReviewFilters = {
    ...filters,
    people,
    roles,
    models,
  };

  const out: DailyReviewChecklistVa[] = [];
  for (const va of vas) {
    if (effective.people.length && !effective.people.includes(va.va_id)) continue;
    if (effective.roles.length && !effective.roles.includes(vaRole(va))) continue;

    const tasks: DailyReviewChecklistTask[] = [];
    for (const task of va.tasks) {
      const items = task.items.filter((item) => itemMatchesFilters(item, task, effective));
      if (!items.length) continue;
      tasks.push({ ...task, items });
    }
    if (!tasks.length) continue;
    const stats = computeStatsFromTasks(tasks);
    out.push({
      ...va,
      tasks,
      stats: {
        total_items: stats.total_items,
        va_completed: stats.va_completed,
        verified: stats.verified,
        flagged: stats.flagged,
        unverified: stats.unverified,
        overdue: stats.overdue,
      },
    });
  }
  return sortVas(out, filters.sort);
}

export function filterDailyReviewSharedVas(
  vas: DailyReviewChecklistVaShared[],
  filters: DailyReviewFilters,
  scope: {
    allowedPersonIds: Set<string>;
    allowedRoleSlugs: Set<string>;
    allowedModelIds: Set<string>;
  },
): DailyReviewChecklistVaShared[] {
  const people = intersectAllowed(filters.people, scope.allowedPersonIds);
  const roles = intersectAllowed(filters.roles, scope.allowedRoleSlugs);
  const models = intersectAllowed(filters.models, scope.allowedModelIds);
  if (filters.people.length && !people.length) return [];
  if (filters.roles.length && !roles.length) return [];
  if (filters.models.length && !models.length) return [];

  const effective: DailyReviewFilters = { ...filters, people, roles, models };
  const out: DailyReviewChecklistVaShared[] = [];
  for (const va of vas) {
    if (effective.people.length && !effective.people.includes(va.va_id)) continue;
    if (effective.roles.length && !effective.roles.includes(vaRole(va))) continue;

    const tasks: DailyReviewChecklistVaShared["tasks"] = [];
    for (const task of va.tasks) {
      const items = task.items.filter((item) => itemMatchesFilters(item, task, effective));
      if (!items.length) continue;
      tasks.push({ ...task, items });
    }
    if (!tasks.length) continue;
    const stats = computeSharedStats(tasks);
    out.push({
      ...va,
      tasks,
      stats: {
        total_items: stats.total_items,
        va_completed: stats.va_completed,
        verified: stats.verified,
        flagged: stats.flagged,
        unverified: stats.unverified,
        overdue: stats.overdue,
      },
    });
  }
  return sortVas(out, filters.sort);
}

export function summarizeFilteredVas(
  vas: Array<DailyReviewChecklistVa | DailyReviewChecklistVaShared>,
): DailyReviewChecklistSummary & { overdue: number } {
  const summary = {
    total_items: 0,
    va_completed: 0,
    verified: 0,
    flagged: 0,
    unverified: 0,
    vas_reviewed: vas.length,
    tasks: 0,
    overdue: 0,
  };
  for (const va of vas) {
    summary.total_items += va.stats.total_items;
    summary.va_completed += va.stats.va_completed;
    summary.verified += va.stats.verified;
    summary.flagged += va.stats.flagged;
    summary.unverified += va.stats.unverified;
    summary.overdue += va.stats.overdue ?? 0;
    summary.tasks += va.tasks.length;
  }
  return summary;
}

function bump(
  map: Map<string, DailyReviewFilterFacetOption>,
  value: string,
  label: string,
) {
  const key = value || "";
  if (!key) return;
  const existing = map.get(key);
  if (existing) existing.count += 1;
  else map.set(key, { value: key, label: label || key, count: 1 });
}

/** Facets from the unfiltered day tree (options only for people/roles/models that have tasks). */
export function buildDailyReviewFacets(
  vas: Array<DailyReviewChecklistVa | DailyReviewChecklistVaShared>,
): DailyReviewFilterFacets {
  const roles = new Map<string, DailyReviewFilterFacetOption>();
  const people = new Map<string, DailyReviewFilterFacetOption>();
  const models = new Map<string, DailyReviewFilterFacetOption>();
  const phases = new Map<string, DailyReviewFilterFacetOption>();
  const platforms = new Map<string, DailyReviewFilterFacetOption>();
  const item_types = new Map<string, DailyReviewFilterFacetOption>();

  for (const va of vas) {
    bump(people, va.va_id, va.va_name);
    const role = vaRole(va);
    if (role) {
      const label =
        ("role_label" in va && va.role_label ? String(va.role_label) : "") || role.replace(/_/g, " ");
      bump(roles, role, label);
    }
    for (const task of va.tasks) {
      for (const item of task.items) {
        const phaseKey = item.phase_title || `Phase ${item.phase_number}`;
        bump(phases, phaseKey, phaseKey);
        const step = itemStepType(item);
        bump(item_types, step, step);
        const plat = itemPlatform(item);
        if (plat) bump(platforms, plat, plat);
        const mid = itemModelId(item);
        const mname =
          ("model_name" in item && item.model_name ? String(item.model_name) : "") || mid;
        if (mid) bump(models, mid, mname);
      }
    }
  }

  const byLabel = (a: DailyReviewFilterFacetOption, b: DailyReviewFilterFacetOption) =>
    a.label.localeCompare(b.label);

  return {
    roles: [...roles.values()].sort(byLabel),
    people: [...people.values()].sort(byLabel),
    models: [...models.values()].sort(byLabel),
    phases: [...phases.values()].sort(byLabel),
    platforms: [...platforms.values()].sort(byLabel),
    item_types: [...item_types.values()].sort(byLabel),
  };
}

export function scopeFromVas(
  vas: Array<DailyReviewChecklistVa | DailyReviewChecklistVaShared>,
): {
  allowedPersonIds: Set<string>;
  allowedRoleSlugs: Set<string>;
  allowedModelIds: Set<string>;
} {
  const allowedPersonIds = new Set<string>();
  const allowedRoleSlugs = new Set<string>();
  const allowedModelIds = new Set<string>();
  for (const va of vas) {
    allowedPersonIds.add(va.va_id);
    const role = vaRole(va);
    if (role) allowedRoleSlugs.add(role);
    for (const task of va.tasks) {
      for (const item of task.items) {
        const mid = itemModelId(item);
        if (mid) allowedModelIds.add(mid);
      }
    }
  }
  return { allowedPersonIds, allowedRoleSlugs, allowedModelIds };
}

export const DAILY_REVIEW_FILTER_STORAGE_KEY = "daily-review-filters:v1";

export function readStoredDailyReviewFilters(scope: "submit" | "manage"): DailyReviewFilters | null {
  try {
    if (typeof window === "undefined") return null;
    const raw = window.localStorage.getItem(`${DAILY_REVIEW_FILTER_STORAGE_KEY}:${scope}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(parsed)) {
      if (typeof v === "string" && v) params.set(k, v);
      else if (Array.isArray(v) && v.length) params.set(k, v.map(String).join(","));
    }
    return parseDailyReviewFilters(params);
  } catch {
    return null;
  }
}

export function writeStoredDailyReviewFilters(
  scope: "submit" | "manage",
  filters: DailyReviewFilters,
): void {
  try {
    if (typeof window === "undefined") return;
    const payload = {
      roles: filters.roles,
      people: filters.people,
      models: filters.models,
      review_status: filters.review_status,
      task_state: filters.task_state,
      phases: filters.phases,
      platforms: filters.platforms,
      item_types: filters.item_types,
      evidence: filters.evidence,
      q: filters.q,
      sort: filters.sort,
      preset: filters.preset,
    };
    window.localStorage.setItem(
      `${DAILY_REVIEW_FILTER_STORAGE_KEY}:${scope}`,
      JSON.stringify(payload),
    );
  } catch {
    // ignore quota / private mode
  }
}
