import type { WeeklyProgramRecord } from "@/types";

/**
 * Read-only schedule row exposed to chatters in the team ("Everyone") view.
 * Strips admin-only metadata: internal notes, audit timestamps, program ids.
 */
export type ChatterTeamScheduleEntry = Pick<
  WeeklyProgramRecord,
  | "id"
  | "chatter_id"
  | "chatter_name"
  | "model_ids"
  | "day"
  | "shift_type"
  | "start_time"
  | "end_time"
  | "week_start"
>;

export function toChatterTeamScheduleView(entries: WeeklyProgramRecord[]): ChatterTeamScheduleEntry[] {
  return entries.map(
    ({ id, chatter_id, chatter_name, model_ids, day, shift_type, start_time, end_time, week_start }) => ({
      id,
      chatter_id,
      chatter_name,
      model_ids,
      day,
      shift_type,
      start_time,
      end_time,
      week_start,
    }),
  );
}

export type ChatterScheduleViewMode = "everyone" | "mine";

export function parseChatterScheduleViewMode(raw: string | null | undefined): ChatterScheduleViewMode {
  return raw === "mine" ? "mine" : "everyone";
}
