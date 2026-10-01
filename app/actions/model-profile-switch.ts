"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { getSessionFromCookies } from "@/lib/auth";
import { getUserByAirtableId } from "@/services/users";
import {
  MODEL_ACTIVE_PROFILE_COOKIE,
  MODEL_ACTIVE_PROFILE_MAX_AGE,
} from "@/lib/model-active-profile";
import { ROUTES } from "@/lib/routes";

export type SwitchModelProfileResult =
  | { success: true; modelId: string }
  | { success: false; error: string };

/** Persist active model profile for the signed-in model user (httpOnly cookie). */
export async function switchActiveModelProfile(modelId: string): Promise<SwitchModelProfileResult> {
  const session = await getSessionFromCookies();
  if (!session || session.role !== "model") {
    return { success: false, error: "Not authenticated as model." };
  }
  const recordId = (session.airtableUserId ?? session.id)?.trim();
  if (!recordId) return { success: false, error: "Missing user record." };

  const user = await getUserByAirtableId(recordId);
  if (!user) return { success: false, error: "User not found." };

  const linked = (user.linked_model_ids?.length
    ? user.linked_model_ids
    : user.linked_model_id
      ? [user.linked_model_id]
      : []
  )
    .map((id) => id.trim())
    .filter(Boolean);

  const target = modelId.trim();
  if (!target || !linked.includes(target)) {
    return { success: false, error: "That profile is not linked to this account." };
  }

  const jar = await cookies();
  jar.set(MODEL_ACTIVE_PROFILE_COOKIE, target, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: MODEL_ACTIVE_PROFILE_MAX_AGE,
    secure: process.env.NODE_ENV === "production",
  });

  revalidatePath(ROUTES.model.home);
  revalidatePath(ROUTES.model.myEarnings);
  revalidatePath(ROUTES.model.contentCalendar);
  revalidatePath(ROUTES.model.contentAssignments);
  revalidatePath(ROUTES.model.schedule);
  revalidatePath(ROUTES.model.customs);
  revalidatePath(ROUTES.model.liveStreams);
  revalidatePath(ROUTES.model.weeklyAvailability);
  revalidatePath("/model", "layout");

  return { success: true, modelId: target };
}
