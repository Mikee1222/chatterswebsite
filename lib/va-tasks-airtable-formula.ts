/**
 * Airtable filterByFormula builders for `va_tasks`.
 * Athens calendar bucketing uses Europe/Athens — matches {@link ymdInAthens} in lib/airtable-datetime.ts.
 */

import { escapeAirtableString, formulaLinkedContains, formulaLinkedIsEmpty } from "@/lib/airtable-linked";

const ATHENS_TZ = "Europe/Athens";

/** Escape and validate YYYY-MM-DD for formula literals. */
function assertAthensYmd(ymd: string, label: string): string {
  const s = ymd.trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    throw new Error(`Invalid Athens YMD for ${label}: ${ymd}`);
  }
  return s;
}

/** Athens calendar day for a datetime field — mirrors {@link ymdInAthens}. */
export function formulaAthensYmdFromField(fieldName: string): string {
  return `DATETIME_FORMAT(SET_TIMEZONE({${fieldName}}, '${ATHENS_TZ}'), 'YYYY-MM-DD')`;
}

/** `due_date` buckets to the given Athens YYYY-MM-DD. */
export function formulaVaTaskDueOnAthensYmd(ymd: string): string {
  const day = escapeAirtableString(assertAthensYmd(ymd, "due on"));
  const bucket = formulaAthensYmdFromField("due_date");
  return `AND({due_date} != BLANK(), ${bucket} = "${day}")`;
}

/** Datetime field buckets to an inclusive Athens YYYY-MM-DD range. */
export function formulaAthensYmdFieldInRange(fieldName: string, startYmd: string, endYmd: string): string {
  const start = escapeAirtableString(assertAthensYmd(startYmd, "range start"));
  const end = escapeAirtableString(assertAthensYmd(endYmd, "range end"));
  const bucket = formulaAthensYmdFromField(fieldName);
  return `AND({${fieldName}} != BLANK(), ${bucket} >= "${start}", ${bucket} <= "${end}")`;
}

/** `due_date` in inclusive Athens range. */
export function formulaVaTaskDueInAthensRange(startYmd: string, endYmd: string): string {
  return formulaAthensYmdFieldInRange("due_date", startYmd, endYmd);
}

/**
 * Task visible to a VA: unassigned (all VAs) or `assigned_to` contains the user record id.
 * Uses ARRAYJOIN + FIND — same pattern as force-delete-cascade / va-content-assignments.
 */
export function formulaVaTaskVisibleToUser(userId: string): string {
  const id = userId.trim();
  if (!id) return "FALSE()";
  return `OR(${formulaLinkedIsEmpty("assigned_to")}, ${formulaLinkedContains("assigned_to", id)})`;
}

export type VaTasksFetchRangeOptions = {
  /** Inclusive Athens YYYY-MM-DD bounds. */
  athensStartYmd: string;
  athensEndYmd: string;
  /**
   * When true, also match `completed_at` / `created_at` Athens buckets (VA statistics).
   * When false, match `due_date` range and (by default) all recurring rows.
   */
  includeBucketDates?: boolean;
  /**
   * Union all `{is_recurring} = TRUE()` rows — required for virtual day projection in List / Progress.
   * Defaults to true when `includeBucketDates` is false.
   */
  includeRecurring?: boolean;
};

/**
 * Scope `getAllVaTasks` to a relevant Athens date window instead of the full table.
 * Always unions recurring rows unless `includeRecurring` is explicitly false.
 */
export function buildGetAllVaTasksFormula(options?: VaTasksFetchRangeOptions): string | undefined {
  if (!options) return undefined;

  const start = assertAthensYmd(options.athensStartYmd, "fetch start");
  const end = assertAthensYmd(options.athensEndYmd, "fetch end");
  const parts: string[] = [];

  if (options.includeBucketDates) {
    parts.push(formulaAthensYmdFieldInRange("due_date", start, end));
    parts.push(formulaAthensYmdFieldInRange("completed_at", start, end));
    parts.push(formulaAthensYmdFieldInRange("created_at", start, end));
  } else {
    parts.push(formulaVaTaskDueInAthensRange(start, end));
    const includeRecurring = options.includeRecurring !== false;
    if (includeRecurring) {
      parts.push("{is_recurring} = TRUE()");
    }
  }

  if (parts.length === 1) return parts[0]!;
  return `OR(${parts.join(", ")})`;
}

/** Admin List / Progress initial SSR fetch window (days before/after Athens today). */
export const VA_TASKS_ADMIN_FETCH_PAST_DAYS = 365;
export const VA_TASKS_ADMIN_FETCH_FUTURE_DAYS = 365;

/**
 * `task_id` text field matches any of the given ids — single OR formula for batch phase fetches.
 */
export function formulaTaskIdIn(taskIds: string[]): string | undefined {
  const ids = [...new Set(taskIds.map((id) => id.trim()).filter(Boolean))];
  if (ids.length === 0) return undefined;
  if (ids.length === 1) {
    return `{task_id} = "${escapeAirtableString(ids[0]!)}"`;
  }
  const parts = ids.map((id) => `{task_id} = "${escapeAirtableString(id)}"`);
  return `OR(${parts.join(", ")})`;
}
