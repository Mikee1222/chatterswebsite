#!/usr/bin/env npx tsx
/**
 * One-time repair: weekly_program rows where start_time/end_time were stored as 12h text
 * (e.g. "12:00 AM") instead of ISO. Default is dry-run; pass --apply to write.
 *
 * Usage: npx tsx scripts/normalize-weekly-program-times.ts [--apply]
 * Requires: AIRTABLE_BASE_ID, AIRTABLE_TOKEN (e.g. from .env.local)
 */
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
dotenv.config();

import { listAllWeeklyProgram, updateWeeklyProgram } from "../services/weekly-program";
import {
  normalizeTime,
  buildCustomShiftTimes,
  getTimesForShiftType,
  addDays,
  WEEKLY_PROGRAM_DAY_OPTIONS,
} from "../lib/weekly-program";
import type { WeeklyProgramDay, WeeklyProgramShiftType } from "../types";

function looksLikeAmPmWall(value: string): boolean {
  const s = value.trim();
  if (!s) return false;
  if (/^\d{4}-\d{2}-\d{2}T/i.test(s)) return false;
  return /\b(am|pm)\b/i.test(s);
}

async function main() {
  const apply = process.argv.includes("--apply");
  const programs = await listAllWeeklyProgram();
  let count = 0;
  for (const p of programs) {
    const rawS = p.start_time ?? "";
    const rawE = p.end_time ?? "";
    if (!looksLikeAmPmWall(rawS) && !looksLikeAmPmWall(rawE)) continue;

    const dayIndex = WEEKLY_PROGRAM_DAY_OPTIONS.indexOf(p.day as WeeklyProgramDay);
    const dateYmd = addDays(p.week_start, dayIndex);
    let newStart: string;
    let newEnd: string;

    if (p.shift_type === "Custom") {
      const built = buildCustomShiftTimes(dateYmd, normalizeTime(rawS), normalizeTime(rawE));
      newStart = built.start_time;
      newEnd = built.end_time;
    } else {
      const times = getTimesForShiftType(p.shift_type as WeeklyProgramShiftType, dateYmd);
      newStart = times.start_time;
      newEnd = times.end_time;
    }

    if (newStart === rawS && newEnd === rawE) continue;

    console.log(
      `Fixed: ${p.chatter_name ?? p.id} ${p.day} ${p.week_start} ${JSON.stringify(rawS)}→${newStart} | ${JSON.stringify(rawE)}→${newEnd}`
    );
    count += 1;
    if (apply) {
      await updateWeeklyProgram(p.id, { start_time: newStart, end_time: newEnd });
    }
  }
  if (apply) {
    console.log(`Updated ${count} record(s).`);
  } else {
    console.log(
      count === 0
        ? "Dry-run: no AM/PM wall-time rows found."
        : `Dry-run: ${count} record(s) would be updated. Re-run with --apply to write.`
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
