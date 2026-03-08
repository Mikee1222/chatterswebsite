"use server";

import { listAllShifts } from "./shifts";

/** Get total minutes/hours from shifts. userId is filtered in code (chatter is linked; no chatter_id in Airtable). */
export async function getHoursSummary(options: {
  userId?: string;
  role?: "chatter" | "virtual_assistant";
  weekStart?: string;
  monthKey?: string;
  fromDate?: string;
  toDate?: string;
}) {
  const esc = (s: string) => s.replace(/"/g, '""');
  let formula = "";
  const conditions: string[] = [];
  if (options.role) conditions.push(`{staff_role} = "${esc(options.role)}"`);
  if (options.weekStart) conditions.push(`{week_start} = "${esc(options.weekStart)}"`);
  if (options.monthKey) conditions.push(`FIND("${esc(options.monthKey)}", {date})`);
  if (options.fromDate && options.toDate && options.fromDate === options.toDate) {
    conditions.push(`{date} = "${esc(options.fromDate)}"`);
  } else {
    if (options.fromDate) conditions.push(`IS_AFTER({date}, "${esc(options.fromDate)}")`);
    if (options.toDate) conditions.push(`IS_BEFORE({date}, "${esc(options.toDate)}")`);
  }
  if (conditions.length) formula = `AND(${conditions.join(", ")})`;

  let shifts = await listAllShifts(formula || undefined, "hours.getHoursSummary");
  if (options.userId) {
    shifts = shifts.filter((s) => s.chatter_id === options.userId);
  }
  const totalMinutes = shifts.reduce((sum, s) => sum + (s.total_minutes ?? 0), 0);
  const totalHoursDecimalFromShifts = shifts.reduce((sum, s) => sum + (s.total_hours_decimal ?? 0), 0);
  const totalHoursDecimal =
    totalHoursDecimalFromShifts > 0 ? totalHoursDecimalFromShifts : totalMinutes / 60;
  return {
    shifts,
    totalMinutes,
    totalHoursDecimal,
    shiftsCount: shifts.length,
  };
}
