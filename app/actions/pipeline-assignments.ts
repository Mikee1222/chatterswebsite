"use server";

import { revalidatePath } from "next/cache";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { ROUTES } from "@/lib/routes";
import { setAssignment, type CreatorAssignedRole } from "@/services/creator-assignments";

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
