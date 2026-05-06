import { redirect } from "next/navigation";
import { getSessionFromCookies } from "@/lib/auth";
import { ROUTES } from "@/lib/routes";
import { getRecord } from "@/lib/airtable-server";
import { firstLinkedId } from "@/lib/airtable-linked";
import { getModelById } from "@/services/modelss";
import type { AuthUser } from "@/lib/auth-config";
import type { ModelRecord } from "@/types";

type UserFields = {
  linked_model?: string | string[];
  linked_model_id?: string | string[];
  language_preference?: string;
};

function languageFromValue(raw: unknown): "en" | "es" {
  const v = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  return v === "es" ? "es" : "en";
}

export const getModelContext = async (): Promise<{
  user: AuthUser | null;
  linkedModelId: string | null;
  modelRecord: ModelRecord | null;
  language: "en" | "es";
}> => {
  const user = await getSessionFromCookies();
  if (!user) return { user: null, linkedModelId: null, modelRecord: null, language: "en" };
  if (user.role !== "model") redirect(ROUTES.dashboard);

  const userRecordId = user.airtableUserId ?? user.id;
  try {
    const rec = await getRecord<UserFields>("users", userRecordId);
    const fields = rec.fields ?? {};
    const linkedModelId = firstLinkedId(fields.linked_model) ?? firstLinkedId(fields.linked_model_id) ?? null;
    const modelRecord = linkedModelId ? await getModelById(linkedModelId) : null;
    const language = languageFromValue(fields.language_preference);
    return { user, linkedModelId, modelRecord, language };
  } catch {
    return { user, linkedModelId: null, modelRecord: null, language: "en" };
  }
};

export default getModelContext;
