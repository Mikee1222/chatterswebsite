"use server";

import { revalidatePath } from "next/cache";
import { getSessionFromCookies } from "@/lib/auth";
import { getUserByAirtableId } from "@/services/users";
import { ROUTES } from "@/lib/routes";
import {
  createPeriod,
  deletePeriod,
  getPeriodById,
  getPeriodsForModel,
  syncModelPeriodAveragesToModelss,
  updatePeriod,
  daysBetweenStarts,
  type UpdateModelPeriodInput,
} from "@/services/model-periods";
import type { PeriodLoggedBy } from "@/types";

function revalidatePeriodRelatedPaths() {
  revalidatePath(ROUTES.admin.models);
  revalidatePath(ROUTES.admin.weeklyProgram);
  revalidatePath(ROUTES.admin.weeklyProgramVa);
  revalidatePath(ROUTES.model.home);
  revalidatePath(ROUTES.model.weeklyAvailability);
  revalidatePath(ROUTES.chatter.weeklyProgram);
  revalidatePath(ROUTES.va.shift);
  revalidatePath(ROUTES.chatter.shift);
  revalidatePath(ROUTES.settings);
}

function resolveLoggedBy(role: string | undefined): PeriodLoggedBy {
  if (role === "model") return "model";
  if (role === "virtual_assistant") return "va";
  return "admin";
}

async function getLinkedModelIdForSession(): Promise<string | null> {
  const session = await getSessionFromCookies();
  if (!session?.airtableUserId) return null;
  const user = await getUserByAirtableId(session.airtableUserId);
  if (!user || user.role !== "model") return null;
  return user.linked_model_id ?? null;
}

async function canManagePeriodForModel(modelId: string): Promise<boolean> {
  const session = await getSessionFromCookies();
  if (!session) return false;
  if (session.role === "admin" || session.role === "manager") return true;
  if (session.role === "virtual_assistant") return true;
  if (session.role === "model") {
    const linked = await getLinkedModelIdForSession();
    return linked === modelId;
  }
  return false;
}

async function canEditPeriodRecord(periodModelId: string): Promise<boolean> {
  return canManagePeriodForModel(periodModelId);
}

export type PeriodActionResult = { success: true } | { success: false; error: string };

export async function logPeriodAction(
  modelId: string,
  startDate: string,
  endDate: string,
  notes?: string,
  _loggedBy?: PeriodLoggedBy
): Promise<PeriodActionResult> {
  const session = await getSessionFromCookies();
  if (!session) return { success: false, error: "Not signed in." };

  const allowed =
    session.role === "admin" ||
    session.role === "manager" ||
    session.role === "virtual_assistant" ||
    (session.role === "model" && (await getLinkedModelIdForSession()) === modelId);

  if (!allowed) return { success: false, error: "You cannot log periods for this model." };

  const start = startDate.trim().slice(0, 10);
  const end = endDate.trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end) || start > end) {
    return { success: false, error: "Invalid dates." };
  }

  const logged_by = resolveLoggedBy(session.role);

  const existing = await getPeriodsForModel(modelId);
  const asc = [...existing].sort((a, b) => a.start_date.localeCompare(b.start_date));
  const prev = asc.filter((p) => p.start_date < start).pop() ?? null;
  const cycle_length_days = prev ? Math.max(1, daysBetweenStarts(prev.start_date, start)) : null;

  await createPeriod({
    model_id: modelId,
    start_date: start,
    end_date: end,
    notes: notes?.trim(),
    logged_by,
    cycle_length_days: cycle_length_days,
  });

  await syncModelPeriodAveragesToModelss(modelId);
  revalidatePeriodRelatedPaths();
  return { success: true };
}

export async function updatePeriodAction(
  id: string,
  data: UpdateModelPeriodInput
): Promise<PeriodActionResult> {
  const existing = await getPeriodById(id);
  if (!existing) return { success: false, error: "Period not found." };
  if (!(await canEditPeriodRecord(existing.model_id))) {
    return { success: false, error: "Not allowed." };
  }

  await updatePeriod(id, data);
  await syncModelPeriodAveragesToModelss(existing.model_id);
  revalidatePeriodRelatedPaths();
  return { success: true };
}

export async function deletePeriodAction(id: string): Promise<PeriodActionResult> {
  const existing = await getPeriodById(id);
  if (!existing) return { success: false, error: "Period not found." };
  if (!(await canEditPeriodRecord(existing.model_id))) {
    return { success: false, error: "Not allowed." };
  }

  const modelId = existing.model_id;
  await deletePeriod(id);
  await syncModelPeriodAveragesToModelss(modelId);
  revalidatePeriodRelatedPaths();
  return { success: true };
}
