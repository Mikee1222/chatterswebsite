"use server";

import { revalidatePath } from "next/cache";
import { getSessionFromCookies } from "@/lib/auth";
import { ROUTES } from "@/lib/routes";
import { updateUser } from "@/services/users";

export type ModelProfileUpdateResult = { success: true } | { success: false; error: string };

/** Models may update their own UI language (Airtable `language_preference`). */
export async function updateMyModelLanguageAction(language: string): Promise<ModelProfileUpdateResult> {
  const session = await getSessionFromCookies();
  if (!session || session.role !== "model") {
    return { success: false, error: "Only model accounts can change this setting." };
  }
  const recordId = (session.airtableUserId ?? session.id)?.trim();
  if (!recordId) return { success: false, error: "Missing account record." };

  const lang = language === "es" ? "es" : "en";
  try {
    await updateUser(recordId, { language_preference: lang });
    revalidatePath(ROUTES.settings);
    revalidatePath("/model");
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message || "Could not save language." };
  }
}
