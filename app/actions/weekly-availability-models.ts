"use server";

import { revalidatePath } from "next/cache";
import { getModelContext } from "@/lib/model-context-server";
import { ROUTES } from "@/lib/routes";
import {
  createModelAvailabilityRequest,
  updateModelAvailabilityRequest,
  deleteModelAvailabilityRequest,
  getModelAvailabilityRequestById,
  getModelAvailabilityRequestsForWeek,
} from "@/services/weekly-availability-requests-models";
import type { ModelAvailabilityEntryType, ModelAvailabilityTimeWindow, WeeklyProgramDay } from "@/types";
import { validateTimeWindows } from "@/lib/model-availability-windows";

type ActionResult = { success: true } | { success: false; error: string };

type SubmitInput = {
  week_start: string;
  day: WeeklyProgramDay;
  entry_type: ModelAvailabilityEntryType;
  /** When omitted, falls back to start_time/end_time if both set (legacy single window). */
  time_windows?: ModelAvailabilityTimeWindow[] | null;
  start_time?: string | null;
  end_time?: string | null;
  notes?: string;
};

function needsTime(entryType: ModelAvailabilityEntryType): boolean {
  return entryType === "availability" || entryType === "live_window" || entryType === "custom_window";
}

async function modelGuard() {
  const ctx = await getModelContext();
  if (!ctx.user || !ctx.linkedModelId || !ctx.modelRecord) return null;
  return {
    ...ctx,
    user: ctx.user,
    linkedModelId: ctx.linkedModelId,
    modelRecord: ctx.modelRecord,
  };
}

export async function submitModelAvailabilityAction(input: SubmitInput): Promise<ActionResult> {
  const ctx = await modelGuard();
  if (!ctx) return { success: false, error: "Unauthorized." };
  if (!input.week_start?.trim()) return { success: false, error: "Week is required." };
  let resolvedWindows: ModelAvailabilityTimeWindow[] | undefined;
  if (needsTime(input.entry_type)) {
    const hasExplicitWindows = (input.time_windows?.length ?? 0) > 0;
    const raw = hasExplicitWindows
      ? input.time_windows!
      : input.start_time && input.end_time
        ? [{ start: input.start_time, end: input.end_time }]
        : [];
    const v = validateTimeWindows(raw);
    if (!v.ok) return { success: false, error: v.error };
    resolvedWindows = v.normalized;
  }
  try {
    await createModelAvailabilityRequest({
      week_start: input.week_start,
      model_id: ctx.linkedModelId,
      model_name: ctx.modelRecord.model_name || ctx.user.fullName || "Model",
      day: input.day,
      entry_type: input.entry_type,
      start_time: resolvedWindows?.[0]?.start ?? null,
      end_time: resolvedWindows?.[0]?.end ?? null,
      time_windows: resolvedWindows,
      notes: input.notes?.trim() || "",
    });
    revalidatePath(ROUTES.model.weeklyAvailability);
    revalidatePath(ROUTES.model.schedule);
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Submit failed." };
  }
}

export async function updateModelAvailabilityAction(
  recordId: string,
  patch: {
    entry_type: ModelAvailabilityEntryType;
    time_windows?: ModelAvailabilityTimeWindow[] | null;
    start_time?: string | null;
    end_time?: string | null;
    notes?: string;
  }
): Promise<ActionResult> {
  const ctx = await modelGuard();
  if (!ctx) return { success: false, error: "Unauthorized." };
  const existing = await getModelAvailabilityRequestById(recordId);
  if (!existing || existing.model_id !== ctx.linkedModelId) return { success: false, error: "Entry not found." };
  let time_windows: ModelAvailabilityTimeWindow[] | undefined;
  if (needsTime(patch.entry_type)) {
    const hasExplicitWindows = (patch.time_windows?.length ?? 0) > 0;
    const raw = hasExplicitWindows
      ? patch.time_windows!
      : patch.start_time && patch.end_time
        ? [{ start: patch.start_time, end: patch.end_time }]
        : [];
    const v = validateTimeWindows(raw);
    if (!v.ok) return { success: false, error: v.error };
    time_windows = v.normalized;
  }
  try {
    await updateModelAvailabilityRequest(recordId, {
      entry_type: patch.entry_type,
      ...(time_windows !== undefined ? { time_windows } : {}),
      notes: patch.notes?.trim() ?? "",
    });
    revalidatePath(ROUTES.model.weeklyAvailability);
    revalidatePath(ROUTES.model.schedule);
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Update failed." };
  }
}

export async function deleteModelAvailabilityAction(recordId: string): Promise<ActionResult> {
  const ctx = await modelGuard();
  if (!ctx) return { success: false, error: "Unauthorized." };
  const existing = await getModelAvailabilityRequestById(recordId);
  if (!existing || existing.model_id !== ctx.linkedModelId) return { success: false, error: "Entry not found." };
  try {
    await deleteModelAvailabilityRequest(recordId);
    revalidatePath(ROUTES.model.weeklyAvailability);
    revalidatePath(ROUTES.model.schedule);
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Delete failed." };
  }
}

export async function getWeeklyAvailability(weekStart: string) {
  const ctx = await modelGuard();
  if (!ctx) return [];
  return getModelAvailabilityRequestsForWeek(weekStart, ctx.linkedModelId);
}

export async function updateWeeklyAvailability() {
  return true;
}
