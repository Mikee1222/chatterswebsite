/**
 * Single source of truth for Weekly Program preset shift types.
 * Edit labels / colors here — UI, forms, and calendar read from this module.
 */

import type { WeeklyProgramDay, WeeklyProgramShiftType } from "@/types";

/** Preset shift types shown in forms and filters (excludes Custom). */
export const PRESET_WEEKLY_PROGRAM_SHIFT_TYPES = [
  "Morning",
  "Midday",
  "Afternoon",
  "Night",
  "LateNight",
] as const satisfies readonly WeeklyProgramShiftType[];

export type PresetWeeklyProgramShiftType = (typeof PRESET_WEEKLY_PROGRAM_SHIFT_TYPES)[number];

export type WeeklyProgramShiftTypeDefinition = {
  /** English label shown in UI. */
  label: string;
  /** Greek label (admin-editable display name). */
  greekLabel: string;
  /** Static time window label for forms (Night uses getNightEndHHmm for Fri/Sat). */
  timeRangeLabel: string;
  /** Sort order / fallback start minute (UTC wall clock). */
  startMinutes: number;
  /** Tailwind border accent for shift cards. */
  accentClass: string;
  /** Badge chip classes for ShiftTypeBadge. */
  badgeClass: string;
  /** Lucide icon key consumed by ShiftTypeBadge. */
  icon: "sun" | "sunrise" | "sunset" | "moon" | "stars" | "layers";
};

/** Admin-editable shift type names and calendar colors. */
export const WEEKLY_PROGRAM_SHIFT_TYPE_DEFINITIONS: Record<
  Exclude<WeeklyProgramShiftType, "Custom">,
  WeeklyProgramShiftTypeDefinition
> = {
  Morning: {
    label: "Morning",
    greekLabel: "πρωινή",
    timeRangeLabel: "12:00–20:00",
    startMinutes: 720,
    accentClass: "border-l-[3px] border-l-amber-400/55",
    badgeClass: "border-amber-400/35 bg-amber-500/15 text-amber-100",
    icon: "sun",
  },
  Midday: {
    label: "Midday",
    greekLabel: "Μεσημεριανή",
    timeRangeLabel: "12:00–16:00",
    startMinutes: 720,
    accentClass: "border-l-[3px] border-l-lime-400/55",
    badgeClass: "border-lime-400/35 bg-lime-500/15 text-lime-100",
    icon: "sunrise",
  },
  Afternoon: {
    label: "Afternoon",
    greekLabel: "Απογευματινή",
    timeRangeLabel: "16:00–00:00",
    startMinutes: 960,
    accentClass: "border-l-[3px] border-l-orange-400/55",
    badgeClass: "border-orange-400/35 bg-orange-500/15 text-orange-100",
    icon: "sunset",
  },
  Night: {
    label: "Evening",
    greekLabel: "βραδινή",
    timeRangeLabel: "20:00–03:00",
    startMinutes: 1200,
    accentClass: "border-l-[3px] border-l-indigo-400/55",
    badgeClass: "border-indigo-400/35 bg-indigo-500/15 text-indigo-100",
    icon: "moon",
  },
  LateNight: {
    label: "Late Night",
    greekLabel: "Νυχτερινή",
    timeRangeLabel: "00:00–03:00",
    startMinutes: 0,
    accentClass: "border-l-[3px] border-l-violet-400/55",
    badgeClass: "border-violet-400/35 bg-violet-500/15 text-violet-100",
    icon: "stars",
  },
};

/** Evening (Night) end time: Fri/Sat → 04:00, all other days → 03:00. */
export function getNightEndHHmm(day: WeeklyProgramDay): string {
  return day === "Friday" || day === "Saturday" ? "04:00" : "03:00";
}

export function getShiftTypeDefinition(
  shiftType: WeeklyProgramShiftType
): WeeklyProgramShiftTypeDefinition | null {
  if (shiftType === "Custom") return null;
  return WEEKLY_PROGRAM_SHIFT_TYPE_DEFINITIONS[shiftType] ?? null;
}

export function getShiftTypeLabel(shiftType: WeeklyProgramShiftType): string {
  const def = getShiftTypeDefinition(shiftType);
  if (!def) return shiftType === "Custom" ? "Custom" : shiftType;
  return def.label;
}

export function getShiftTypeDisplayName(shiftType: WeeklyProgramShiftType): string {
  const def = getShiftTypeDefinition(shiftType);
  if (!def) return shiftType === "Custom" ? "Custom" : shiftType;
  return `${def.label} (${def.greekLabel})`;
}

/** Form select label including time window; Night reflects Fri/Sat extension when day is known. */
export function getShiftTypeFormLabel(
  shiftType: WeeklyProgramShiftType,
  day?: WeeklyProgramDay
): string {
  const def = getShiftTypeDefinition(shiftType);
  if (!def) return shiftType === "Custom" ? "Custom" : shiftType;
  if (shiftType === "Night" && day) {
    const end = getNightEndHHmm(day);
    return `${def.label} (${def.greekLabel}) · 20:00–${end}`;
  }
  return `${def.label} (${def.greekLabel}) · ${def.timeRangeLabel}`;
}

export function shiftCardAccentClass(shiftType: WeeklyProgramShiftType | string): string {
  const def = getShiftTypeDefinition(shiftType as WeeklyProgramShiftType);
  return def?.accentClass ?? "border-l-[3px] border-l-pink-400/55";
}

export function fallbackShiftStartMinutes(shiftType: WeeklyProgramShiftType | string): number {
  const def = getShiftTypeDefinition(shiftType as WeeklyProgramShiftType);
  return def?.startMinutes ?? 9999;
}

export function weekdayFromDateYmd(dateYmd: string): WeeklyProgramDay {
  const d = new Date(dateYmd.trim().slice(0, 10) + "T12:00:00.000Z");
  const names: WeeklyProgramDay[] = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];
  return names[d.getUTCDay()] ?? "Monday";
}

/** Hero / page description summarizing all preset shift windows. */
export function weeklyProgramShiftTypesSummary(): string {
  return PRESET_WEEKLY_PROGRAM_SHIFT_TYPES.map((key) => {
    const def = WEEKLY_PROGRAM_SHIFT_TYPE_DEFINITIONS[key];
    return `${def.label} ${def.timeRangeLabel}`;
  }).join(", ");
}
