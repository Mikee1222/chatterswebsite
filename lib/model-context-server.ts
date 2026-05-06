import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getSessionFromCookies } from "@/lib/auth";
import { ROUTES } from "@/lib/routes";
import { getRecord } from "@/lib/airtable-server";
import { firstLinkedId } from "@/lib/airtable-linked";
import { getModelById } from "@/services/modelss";
import type { AuthUser } from "@/lib/auth-config";
import type { ModelRecord } from "@/types";
import type { ModelLang } from "@/lib/model-i18n";

type UserFields = {
  linked_model?: string | string[];
  linked_model_id?: string | string[];
  language_preference?: string;
};

function languageFromValue(raw: unknown): "en" | "es" {
  const v = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  return v === "es" ? "es" : "en";
}

export async function loadModelContextForUser(user: AuthUser): Promise<{
  linkedModelId: string | null;
  modelRecord: ModelRecord | null;
  language: "en" | "es";
}> {
  const userRecordId = user.airtableUserId ?? user.id;
  try {
    const rec = await getRecord<UserFields>("users", userRecordId);
    const fields = rec.fields ?? {};
    const linkedModelId = firstLinkedId(fields.linked_model) ?? firstLinkedId(fields.linked_model_id) ?? null;
    const modelRecord = linkedModelId ? await getModelById(linkedModelId) : null;
    const language = languageFromValue(fields.language_preference);
    return { linkedModelId, modelRecord, language };
  } catch {
    return { linkedModelId: null, modelRecord: null, language: "en" };
  }
}

/**
 * Model session for API routes and non-redirect flows. Returns null if not a linked model user.
 */
export async function getModelApiContext(): Promise<{
  user: AuthUser;
  linkedModelId: string;
  modelRecord: ModelRecord;
  language: "en" | "es";
} | null> {
  const user = await getSessionFromCookies();
  if (!user || user.role !== "model") return null;
  const { linkedModelId, modelRecord, language } = await loadModelContextForUser(user);
  if (!linkedModelId || !modelRecord) return null;
  return { user, linkedModelId, modelRecord, language };
}

export async function getModelContext(): Promise<{
  user: AuthUser | null;
  linkedModelId: string | null;
  modelRecord: ModelRecord | null;
  language: "en" | "es";
}> {
  const user = await getSessionFromCookies();
  if (!user) return { user: null, linkedModelId: null, modelRecord: null, language: "en" };
  if (user.role !== "model") redirect(ROUTES.dashboard);

  const { linkedModelId, modelRecord, language } = await loadModelContextForUser(user);
  return { user, linkedModelId, modelRecord, language };
}

/**
 * UI language for model users: `language` cookie (if set) wins, else Airtable `language_preference`.
 * For dashboard shell + model layout (no redirect).
 */
export async function getModelDashboardLanguage(user: AuthUser): Promise<ModelLang> {
  if (user.role !== "model") return "en";
  try {
    const jar = await cookies();
    const c = jar.get("language")?.value;
    if (c === "en" || c === "es") return c;
  } catch {
    /* ignore */
  }
  const { language } = await loadModelContextForUser(user);
  return language;
}
