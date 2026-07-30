"use server";

import { revalidatePath } from "next/cache";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { ROUTES } from "@/lib/routes";
import type { AuthUser } from "@/lib/auth-config";
import {
  submitStage,
  qaApproveItem,
  qaRejectItem,
  setFilmType,
  getItemById,
  qaRoleForStage,
} from "@/services/content-items";

type Result = { success: boolean; error?: string; message?: string };

function actorId(u: AuthUser): string {
  return u.airtableUserId ?? u.id;
}
function actor(u: AuthUser) {
  return { user_id: actorId(u), user_name: u.fullName ?? u.email };
}

function revalidate() {
  revalidatePath(ROUTES.pipeline);
}

/** Owner presses ✓ on their stage. */
export async function submitStageAction(itemId: string): Promise<Result> {
  const user = await getSessionFromCookies();
  if (!user) return { success: false, error: "Unauthorized." };
  if (!(await hasPermission(user, PERMISSIONS.CONTENT_PIPELINE_VIEW))) return { success: false, error: "Forbidden." };
  const item = await getItemById(itemId);
  if (!item) return { success: false, error: "Item not found." };
  const canManage = await hasPermission(user, PERMISSIONS.CONTENT_PIPELINE_MANAGE);
  if (item.assignee_user_id !== actorId(user) && !canManage) {
    return { success: false, error: "Δεν είναι ανατεθειμένο σε σένα." };
  }
  try {
    await submitStage(itemId, actor(user));
    revalidate();
    return { success: true, message: "Προχώρησε ✓" };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Failed." };
  }
}

async function canQaItem(user: AuthUser, stage: string): Promise<boolean> {
  if (await hasPermission(user, PERMISSIONS.CONTENT_PIPELINE_MANAGE)) return true; // admin/manager/head see all
  const need = qaRoleForStage(stage);
  return !!need && (user.role ?? "").trim().toLowerCase() === need;
}

export async function qaApproveItemAction(itemId: string): Promise<Result> {
  const user = await getSessionFromCookies();
  if (!user) return { success: false, error: "Unauthorized." };
  if (!(await hasPermission(user, PERMISSIONS.CONTENT_PIPELINE_QA))) return { success: false, error: "Forbidden." };
  const item = await getItemById(itemId);
  if (!item) return { success: false, error: "Item not found." };
  if (!(await canQaItem(user, item.stage))) return { success: false, error: "Δεν είσαι ο QA αυτού του σταδίου." };
  try {
    await qaApproveItem(itemId, actor(user));
    revalidate();
    return { success: true, message: "Εγκρίθηκε → επόμενο στάδιο" };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Failed." };
  }
}

export async function qaRejectItemAction(itemId: string, note?: string): Promise<Result> {
  const user = await getSessionFromCookies();
  if (!user) return { success: false, error: "Unauthorized." };
  if (!(await hasPermission(user, PERMISSIONS.CONTENT_PIPELINE_QA))) return { success: false, error: "Forbidden." };
  const item = await getItemById(itemId);
  if (!item) return { success: false, error: "Item not found." };
  if (!(await canQaItem(user, item.stage))) return { success: false, error: "Δεν είσαι ο QA αυτού του σταδίου." };
  try {
    await qaRejectItem(itemId, actor(user), note);
    revalidate();
    return { success: true, message: "Επιστράφηκε με feedback" };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Failed." };
  }
}

/** Manager sets self-record vs filmer for a filming item. */
export async function setFilmTypeAction(itemId: string, filmType: "self_record" | "filmer"): Promise<Result> {
  const user = await getSessionFromCookies();
  if (!user) return { success: false, error: "Unauthorized." };
  const ok =
    (await hasPermission(user, PERMISSIONS.CONTENT_PIPELINE_MANAGE)) ||
    (await hasPermission(user, PERMISSIONS.CONTENT_PIPELINE_QA));
  if (!ok) return { success: false, error: "Forbidden." };
  try {
    await setFilmType(itemId, filmType, actor(user));
    revalidate();
    return { success: true, message: filmType === "self_record" ? "Self-record" : "Filmer" };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Failed." };
  }
}
