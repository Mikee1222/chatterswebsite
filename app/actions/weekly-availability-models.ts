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
import type { ModelAvailabilityEntryType, WeeklyProgramDay } from "@/types";

type ActionResult = { success: true } | { success: false; error: string };

type SubmitInput = {
  week_start: string;
  day: WeeklyProgramDay;
  entry_type: ModelAvailabilityEntryType;
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
  if (needsTime(input.entry_type) && (!input.start_time || !input.end_time)) {
    return { success: false, error: "Start and end time are required for this entry type." };
  }
  try {
    await createModelAvailabilityRequest({
      week_start: input.week_start,
      model_id: ctx.linkedModelId,
      model_name: ctx.modelRecord.model_name || ctx.user.fullName || "Model",
      day: input.day,
      entry_type: input.entry_type,
      start_time: needsTime(input.entry_type) ? input.start_time ?? null : null,
      end_time: needsTime(input.entry_type) ? input.end_time ?? null : null,
      notes: input.notes?.trim() || "",
    });
    revalidatePath(ROUTES.model.weeklyAvailability);
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Submit failed." };
  }
}

export async function updateModelAvailabilityAction(
  recordId: string,
  patch: {
    entry_type: ModelAvailabilityEntryType;
    start_time?: string | null;
    end_time?: string | null;
    notes?: string;
  }
): Promise<ActionResult> {
  const ctx = await modelGuard();
  if (!ctx) return { success: false, error: "Unauthorized." };
  const existing = await getModelAvailabilityRequestById(recordId);
  if (!existing || existing.model_id !== ctx.linkedModelId) return { success: false, error: "Entry not found." };
  try {
    await updateModelAvailabilityRequest(recordId, {
      entry_type: patch.entry_type,
      start_time: needsTime(patch.entry_type) ? patch.start_time ?? null : null,
      end_time: needsTime(patch.entry_type) ? patch.end_time ?? null : null,
      notes: patch.notes?.trim() ?? "",
    });
    revalidatePath(ROUTES.model.weeklyAvailability);
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
