"use server";

import { revalidatePath } from "next/cache";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { ROUTES } from "@/lib/routes";
import { setAssignment, setCentralPipelineOwner, CENTRAL_ROLES, type CreatorAssignedRole } from "@/services/creator-assignments";

export type SetPipelineAssignmentInput = {
  creator_model_id: string;
  creator_name: string;
  role: CreatorAssignedRole;
  /** Empty string clears (unassigns) the (creator, role) pair. */
  user_id: string;
  user_name: string;
};

export async function setPipelineAssignment(
  input: SetPipelineAssignmentInput
): Promise<{ success: boolean; error?: string }> {
  const user = await getSessionFromCookies();
  if (!user) return { success: false, error: "Unauthorized." };
  if (!(await hasPermission(user, PERMISSIONS.CONTENT_PIPELINE_MANAGE))) {
    return { success: false, error: "Forbidden." };
  }
  try {
    await setAssignment(input);
    revalidatePath(ROUTES.admin.pipelineAssignments);
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Failed to save." };
  }
}

/** Set the single central owner (one person for all creators) for icloud-manager/head-of-marketing/supervisor. */
export async function setCentralPipelineRole(
  input: { role: string; user_id: string }
): Promise<{ success: boolean; error?: string }> {
  const user = await getSessionFromCookies();
  if (!user) return { success: false, error: "Unauthorized." };
  if (!(await hasPermission(user, PERMISSIONS.CONTENT_PIPELINE_MANAGE))) {
    return { success: false, error: "Forbidden." };
  }
  if (!(CENTRAL_ROLES as readonly string[]).includes(input.role)) {
    return { success: false, error: "Invalid central role." };
  }
  try {
    await setCentralPipelineOwner(input.role as (typeof CENTRAL_ROLES)[number], input.user_id);
    revalidatePath(ROUTES.admin.pipelineAssignments);
    revalidatePath(ROUTES.admin.pipeline);
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Failed to save." };
  }
}
