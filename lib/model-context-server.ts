import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { getSessionFromCookies } from "@/lib/auth";
import { ROUTES } from "@/lib/routes";
import { getRecord } from "@/lib/airtable-server";
import { linkedRecordIds, firstLinkedId } from "@/lib/airtable-linked";
import { getModelById } from "@/services/modelss";
import { getUserByAirtableId } from "@/services/users";
import {
  pickActiveModelProfileId,
  readActiveModelProfileCookie,
} from "@/lib/model-active-profile";
import { isSupabaseBackend } from "@/lib/data-backend";
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

export type ModelProfileContext = {
  linkedModelId: string | null;
  linkedModelIds: string[];
  primaryModelId: string | null;
  modelRecord: ModelRecord | null;
  language: "en" | "es";
};

export async function loadModelContextForUser(user: AuthUser): Promise<ModelProfileContext> {
  const userRecordId = user.airtableUserId ?? user.id;
  try {
    let linkedModelIds: string[] = [];
    let primaryModelId: string | null = null;
    let language: "en" | "es" = "en";

    if (isSupabaseBackend()) {
      const row = await getUserByAirtableId(userRecordId);
      linkedModelIds = row?.linked_model_ids?.length
        ? row.linked_model_ids
        : row?.linked_model_id
          ? [row.linked_model_id]
          : [];
      primaryModelId = row?.linked_model_id ?? linkedModelIds[0] ?? null;
      language = languageFromValue(row?.language_preference);
    } else {
      const rec = await getRecord<UserFields>("users", userRecordId);
      const fields = rec.fields ?? {};
      linkedModelIds = linkedRecordIds(fields.linked_model);
      if (!linkedModelIds.length) {
        const one = firstLinkedId(fields.linked_model_id);
        if (one) linkedModelIds = [one];
      }
      primaryModelId = linkedModelIds[0] ?? null;
      language = languageFromValue(fields.language_preference);
    }

    const cookieId = await readActiveModelProfileCookie();
    const linkedModelId = pickActiveModelProfileId(linkedModelIds, primaryModelId, cookieId);
    const modelRecord = linkedModelId ? await getModelById(linkedModelId) : null;
    return { linkedModelId, linkedModelIds, primaryModelId, modelRecord, language };
  } catch {
    return {
      linkedModelId: null,
      linkedModelIds: [],
      primaryModelId: null,
      modelRecord: null,
      language: "en",
    };
  }
}

/**
 * Model session for API routes and non-redirect flows. Returns null if not a linked model user.
 */
export async function getModelApiContext(): Promise<{
  user: AuthUser;
  linkedModelId: string;
  linkedModelIds: string[];
  modelRecord: ModelRecord;
  language: "en" | "es";
} | null> {
  const user = await getSessionFromCookies();
  if (!user || user.role !== "model") return null;
  const { linkedModelId, linkedModelIds, modelRecord, language } = await loadModelContextForUser(user);
  if (!linkedModelId || !modelRecord) return null;
  return { user, linkedModelId, linkedModelIds, modelRecord, language };
}

export const getModelContext = cache(async (): Promise<{
  user: AuthUser | null;
  linkedModelId: string | null;
  linkedModelIds: string[];
  primaryModelId: string | null;
  modelRecord: ModelRecord | null;
  language: "en" | "es";
}> => {
  const user = await getSessionFromCookies();
  if (!user) {
    return {
      user: null,
      linkedModelId: null,
      linkedModelIds: [],
      primaryModelId: null,
      modelRecord: null,
      language: "en",
    };
  }
  if (user.role !== "model") redirect(ROUTES.dashboard);

  const ctx = await loadModelContextForUser(user);
  return { user, ...ctx };
});

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
