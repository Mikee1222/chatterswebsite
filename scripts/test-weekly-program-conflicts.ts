/**
 * Smoke tests for weekly program model conflict rules (4 scenarios).
 * Run: npx tsx scripts/test-weekly-program-conflicts.ts
 */
import { addDays, getTimesForShiftType } from "../lib/weekly-program";
import {
  filterProgramsForConflictCheck,
  getWeeklyProgramConflicts,
  rangesOverlap,
  type ConflictCheckExclude,
} from "../lib/weekly-program-conflicts";
import type { WeeklyProgramRecord } from "../types";

const WEEK_START = "2026-08-18";
const MODEL_X = "model-x";
const MODEL_A = "model-a";
const MODEL_B = "model-b";
const modelIdToName: Record<string, string> = {
  [MODEL_X]: "Lina",
  [MODEL_A]: "Model A",
  [MODEL_B]: "Model B",
};

function baseRecord(overrides: Partial<WeeklyProgramRecord>): WeeklyProgramRecord {
  return {
    id: "rec-default",
    program_id: "prog-default",
    chatter_id: "chatter-default",
    chatter_name: "Default",
    model_ids: [],
    day: "Monday",
    shift_type: "Morning",
    start_time: "",
    end_time: "",
    week_start: WEEK_START,
    notes: "",
    created_at: "",
    updated_at: "",
    ...overrides,
  };
}

/** Mirrors server save check: same model + ISO overlap across all other records. */
function checkModelConflict(
  programs: WeeklyProgramRecord[],
  modelIds: string[],
  start_time: string,
  end_time: string,
  exclude?: ConflictCheckExclude
): { conflict: boolean; otherChatter?: string } {
  const others = filterProgramsForConflictCheck(programs, exclude);
  const modelSet = new Set(modelIds.filter(Boolean));
  for (const p of others) {
    if (!p.start_time || !p.end_time) continue;
    if (!rangesOverlap(p.start_time, p.end_time, start_time, end_time)) continue;
    for (const mid of p.model_ids.filter(Boolean)) {
      if (!modelSet.has(mid)) continue;
      return { conflict: true, otherChatter: p.chatter_name ?? undefined };
    }
  }
  return { conflict: false };
}

function hasModelOverlapConflict(programs: WeeklyProgramRecord[]): boolean {
  const { conflicts } = getWeeklyProgramConflicts(programs, [MODEL_X, MODEL_A, MODEL_B], modelIdToName);
  return conflicts.some((c) => c.type === "model_time_overlap");
}

const mondayYmd = addDays(WEEK_START, 0);
const afternoon = getTimesForShiftType("Afternoon", mondayYmd, "Monday");
const night = getTimesForShiftType("Night", mondayYmd, "Monday");
const midday = getTimesForShiftType("Midday", mondayYmd, "Monday");

let passed = 0;
let failed = 0;

function assert(name: string, condition: boolean, detail?: string) {
  if (condition) {
    console.log(`✓ ${name}`);
    passed++;
  } else {
    console.error(`✗ ${name}${detail ? `: ${detail}` : ""}`);
    failed++;
  }
}

// 1. Model X on B when A has X overlapping → BLOCK
{
  const programs: WeeklyProgramRecord[] = [
    baseRecord({
      id: "rec-edgar-afternoon",
      chatter_id: "edgar",
      chatter_name: "Edgar",
      model_ids: [MODEL_X],
      shift_type: "Afternoon",
      start_time: afternoon.start_time,
      end_time: afternoon.end_time,
    }),
  ];
  const result = checkModelConflict(programs, [MODEL_X], night.start_time, night.end_time);
  assert(
    "1. Cross-chatter same model overlapping → BLOCK",
    result.conflict && result.otherChatter === "Edgar",
    `got conflict=${result.conflict}, other=${result.otherChatter}`
  );
}

// 2. Edit A's shift keep X → ALLOW (exclude only that record)
{
  const edgarShift = baseRecord({
    id: "rec-edgar-afternoon",
    chatter_id: "edgar",
    chatter_name: "Edgar",
    model_ids: [MODEL_X],
    shift_type: "Afternoon",
    start_time: afternoon.start_time,
    end_time: afternoon.end_time,
  });
  const programs = [edgarShift];
  const result = checkModelConflict(
    programs,
    [MODEL_X],
    afternoon.start_time,
    afternoon.end_time,
    { recordId: edgarShift.id, programId: edgarShift.program_id }
  );
  assert("2. Edit same shift keep same model → ALLOW", !result.conflict);
}

// 3. Same model non-overlapping times → ALLOW
{
  const programs: WeeklyProgramRecord[] = [
    baseRecord({
      id: "rec-edgar-midday",
      chatter_id: "edgar",
      chatter_name: "Edgar",
      model_ids: [MODEL_X],
      shift_type: "Midday",
      start_time: midday.start_time,
      end_time: midday.end_time,
    }),
  ];
  const result = checkModelConflict(programs, [MODEL_X], afternoon.start_time, afternoon.end_time);
  assert("3. Same model non-overlapping times → ALLOW", !result.conflict);
  assert("3b. Global conflict scan also clean", !hasModelOverlapConflict(programs));
}

// 4. Same chatter Evening + Afternoon different models → ALLOW
{
  const programs: WeeklyProgramRecord[] = [
    baseRecord({
      id: "rec-edgar-afternoon",
      chatter_id: "edgar",
      chatter_name: "Edgar",
      model_ids: [MODEL_A],
      shift_type: "Afternoon",
      start_time: afternoon.start_time,
      end_time: afternoon.end_time,
    }),
    baseRecord({
      id: "rec-edgar-night",
      chatter_id: "edgar",
      chatter_name: "Edgar",
      model_ids: [MODEL_B],
      shift_type: "Night",
      start_time: night.start_time,
      end_time: night.end_time,
    }),
  ];
  assert(
    "4. Same chatter overlapping shifts different models → ALLOW",
    !hasModelOverlapConflict(programs)
  );
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
