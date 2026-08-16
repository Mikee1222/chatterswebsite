/**
 * Password Library — Supabase-backed encrypted credential storage.
 */

import {
  decryptCredentialPayload,
  encryptCredentialPayload,
} from "@/lib/credentials-crypto";
import {
  CREDENTIAL_FIELDS,
  CREDENTIAL_LIST_PLAINTEXT_FIELDS,
  CUSTOM_FIELDS_STORAGE_KEY,
  MASKED_VALUE,
  customFieldRefKey,
  isCustomFieldRef,
  isCredentialField,
  parseCustomFieldsFromSecrets,
  serializeCustomFieldsToStorage,
  type CredentialAccessAction,
  type CredentialCustomFields,
  type CredentialField,
  type CredentialFieldRef,
  type CredentialSecretData,
} from "@/lib/credentials-types";
import {
  EXPECTED_CATEGORY_LABELS,
  EXPECTED_MODEL_CATEGORY_KEYS,
  detectAttentionReason,
  normalizeCategoryKey,
  type AttentionReason,
  type ExpectedCategoryKey,
} from "@/lib/credentials-ui-helpers";
import { getSupabaseServiceClient } from "@/lib/supabase-server";

export type CredentialEntryRecord = {
  id: string;
  model_id: string | null;
  category: string;
  label: string;
  created_by_id: string | null;
  created_by_name: string | null;
  updated_by_id: string | null;
  updated_by_name: string | null;
  created_at: string;
  updated_at: string;
};

export type MaskedCredentialEntry = CredentialEntryRecord & {
  fields: Record<CredentialField, string>;
  has_value: Record<CredentialField, boolean>;
  custom_fields: Record<string, string>;
  custom_field_keys: string[];
  has_custom_fields: boolean;
};

export type CredentialAccessLogRecord = {
  id: string;
  credential_id: string;
  user_id: string;
  user_name: string | null;
  action: CredentialAccessAction;
  field_name: string | null;
  timestamp: string;
};

type EntryRow = {
  id: string;
  model_id: string | null;
  category: string;
  label: string;
  encrypted_data: string;
  created_by_id: string | null;
  created_by_name: string | null;
  updated_by_id: string | null;
  updated_by_name: string | null;
  created_at: string;
  updated_at: string;
};

type LogRow = {
  id: string;
  credential_id: string;
  user_id: string;
  user_name: string | null;
  action: CredentialAccessAction;
  field_name: string | null;
  timestamp: string;
};

export type CredentialEntryInput = {
  model_id?: string | null;
  category: string;
  label: string;
  data: CredentialSecretData;
};

export type AuditActor = {
  userId: string;
  userName: string;
};

function mapEntryRow(row: EntryRow): CredentialEntryRecord {
  return {
    id: row.id,
    model_id: row.model_id,
    category: row.category.trim(),
    label: row.label.trim(),
    created_by_id: row.created_by_id?.trim() || null,
    created_by_name: row.created_by_name?.trim() || null,
    updated_by_id: row.updated_by_id?.trim() || null,
    updated_by_name: row.updated_by_name?.trim() || null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function normalizeSecretData(data: CredentialSecretData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const field of CREDENTIAL_FIELDS) {
    const value = data[field]?.trim() ?? "";
    if (value) out[field] = value;
  }
  out[CUSTOM_FIELDS_STORAGE_KEY] = serializeCustomFieldsToStorage(data.customFields);
  return out;
}

function buildMaskedFields(secrets: Record<string, string>): {
  fields: Record<CredentialField, string>;
  has_value: Record<CredentialField, boolean>;
  custom_fields: Record<string, string>;
  custom_field_keys: string[];
  has_custom_fields: boolean;
} {
  const fields = {} as Record<CredentialField, string>;
  const has_value = {} as Record<CredentialField, boolean>;

  for (const field of CREDENTIAL_FIELDS) {
    const raw = secrets[field]?.trim() ?? "";
    has_value[field] = raw.length > 0;
    if (!raw) {
      fields[field] = "";
    } else if (CREDENTIAL_LIST_PLAINTEXT_FIELDS.includes(field)) {
      fields[field] = raw;
    } else {
      fields[field] = MASKED_VALUE;
    }
  }

  const customRaw = parseCustomFieldsFromSecrets(secrets);
  const custom_field_keys = Object.keys(customRaw).sort((a, b) => a.localeCompare(b));
  const custom_fields: Record<string, string> = {};
  for (const key of custom_field_keys) {
    custom_fields[key] = MASKED_VALUE;
  }

  return {
    fields,
    has_value,
    custom_fields,
    custom_field_keys,
    has_custom_fields: custom_field_keys.length > 0,
  };
}

function decryptRowSecrets(row: EntryRow): Record<string, string> {
  return decryptCredentialPayload(row.encrypted_data);
}

function mergeSecretData(
  currentSecrets: Record<string, string>,
  input: CredentialSecretData,
): Record<string, string> {
  const merged: Record<string, string> = { ...currentSecrets };
  for (const field of CREDENTIAL_FIELDS) {
    const incoming = input[field]?.trim() ?? "";
    if (incoming) merged[field] = incoming;
  }
  if (input.customFields !== undefined) {
    const currentCustom = parseCustomFieldsFromSecrets(merged);
    const nextCustom: CredentialCustomFields = {};
    for (const [key, value] of Object.entries(input.customFields)) {
      const trimmedKey = key.trim();
      const trimmedValue = value?.trim() ?? "";
      if (!trimmedKey) continue;
      if (trimmedValue) {
        nextCustom[trimmedKey] = trimmedValue;
      } else if (currentCustom[trimmedKey]) {
        nextCustom[trimmedKey] = currentCustom[trimmedKey];
      }
    }
    merged[CUSTOM_FIELDS_STORAGE_KEY] = serializeCustomFieldsToStorage(nextCustom);
  }
  return merged;
}

function readFieldValue(secrets: Record<string, string>, fieldRef: CredentialFieldRef): string {
  if (isCredentialField(fieldRef)) {
    return secrets[fieldRef]?.trim() ?? "";
  }
  if (isCustomFieldRef(fieldRef)) {
    const key = customFieldRefKey(fieldRef);
    const custom = parseCustomFieldsFromSecrets(secrets);
    return custom[key]?.trim() ?? "";
  }
  return "";
}

export async function listCredentialEntries(): Promise<MaskedCredentialEntry[]> {
  const sb = getSupabaseServiceClient();
  const { data, error } = await sb
    .from("credential_entries")
    .select(
      "id,model_id,category,label,encrypted_data,created_by_id,created_by_name,updated_by_id,updated_by_name,created_at,updated_at",
    )
    .order("category", { ascending: true })
    .order("label", { ascending: true });
  if (error) throw new Error(`list credential_entries: ${error.message}`);

  return (data ?? []).map((row) => {
    const base = mapEntryRow(row as EntryRow);
    const secrets = decryptRowSecrets(row as EntryRow);
    const masked = buildMaskedFields(secrets);
    return { ...base, ...masked };
  });
}

export async function getCredentialEntryMasked(id: string): Promise<MaskedCredentialEntry | null> {
  const sb = getSupabaseServiceClient();
  const { data, error } = await sb
    .from("credential_entries")
    .select(
      "id,model_id,category,label,encrypted_data,created_by_id,created_by_name,updated_by_id,updated_by_name,created_at,updated_at",
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`get credential_entry: ${error.message}`);
  if (!data) return null;

  const base = mapEntryRow(data as EntryRow);
  const secrets = decryptRowSecrets(data as EntryRow);
  const masked = buildMaskedFields(secrets);
  return { ...base, ...masked };
}

export async function createCredentialEntry(
  input: CredentialEntryInput,
  actor: AuditActor,
): Promise<MaskedCredentialEntry> {
  const category = input.category.trim();
  const label = input.label.trim();
  if (!category) throw new Error("category is required");
  if (!label) throw new Error("label is required");

  const encrypted_data = encryptCredentialPayload(normalizeSecretData(input.data));
  const now = new Date().toISOString();

  const sb = getSupabaseServiceClient();
  const { data, error } = await sb
    .from("credential_entries")
    .insert({
      model_id: input.model_id?.trim() || null,
      category,
      label,
      encrypted_data,
      created_by_id: actor.userId,
      created_by_name: actor.userName,
      updated_by_id: actor.userId,
      updated_by_name: actor.userName,
      created_at: now,
      updated_at: now,
    })
    .select(
      "id,model_id,category,label,encrypted_data,created_by_id,created_by_name,updated_by_id,updated_by_name,created_at,updated_at",
    )
    .single();
  if (error) throw new Error(`create credential_entry: ${error.message}`);

  await logCredentialAccess({
    credentialId: data.id,
    actor,
    action: "created",
  });

  const base = mapEntryRow(data as EntryRow);
  const secrets = decryptRowSecrets(data as EntryRow);
  const masked = buildMaskedFields(secrets);
  return { ...base, ...masked };
}

export async function updateCredentialEntry(
  id: string,
  input: CredentialEntryInput,
  actor: AuditActor,
): Promise<MaskedCredentialEntry> {
  const category = input.category.trim();
  const label = input.label.trim();
  if (!category) throw new Error("category is required");
  if (!label) throw new Error("label is required");

  const sb = getSupabaseServiceClient();
  const { data: existing, error: existingError } = await sb
    .from("credential_entries")
    .select("encrypted_data")
    .eq("id", id)
    .maybeSingle();
  if (existingError) throw new Error(`update credential_entry: ${existingError.message}`);
  if (!existing) throw new Error("Credential entry not found");

  const currentSecrets = decryptCredentialPayload(existing.encrypted_data);
  const merged = mergeSecretData(currentSecrets, input.data);
  const encrypted_data = encryptCredentialPayload(merged);
  const now = new Date().toISOString();

  const { data, error } = await sb
    .from("credential_entries")
    .update({
      model_id: input.model_id?.trim() || null,
      category,
      label,
      encrypted_data,
      updated_by_id: actor.userId,
      updated_by_name: actor.userName,
      updated_at: now,
    })
    .eq("id", id)
    .select(
      "id,model_id,category,label,encrypted_data,created_by_id,created_by_name,updated_by_id,updated_by_name,created_at,updated_at",
    )
    .maybeSingle();
  if (error) throw new Error(`update credential_entry: ${error.message}`);
  if (!data) throw new Error("Credential entry not found");

  await logCredentialAccess({
    credentialId: id,
    actor,
    action: "updated",
  });

  const base = mapEntryRow(data as EntryRow);
  const secrets = decryptRowSecrets(data as EntryRow);
  const masked = buildMaskedFields(secrets);
  return { ...base, ...masked };
}

export async function deleteCredentialEntry(id: string, actor: AuditActor): Promise<void> {
  await logCredentialAccess({
    credentialId: id,
    actor,
    action: "deleted",
  });

  const sb = getSupabaseServiceClient();
  const { error } = await sb.from("credential_entries").delete().eq("id", id);
  if (error) throw new Error(`delete credential_entry: ${error.message}`);
}

export async function revealCredentialField(
  id: string,
  field: CredentialFieldRef,
  actor: AuditActor,
): Promise<{ field: CredentialFieldRef; value: string }> {
  const sb = getSupabaseServiceClient();
  const { data, error } = await sb
    .from("credential_entries")
    .select("id,encrypted_data")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`reveal credential_entry: ${error.message}`);
  if (!data) throw new Error("Credential entry not found");

  const secrets = decryptCredentialPayload(data.encrypted_data);
  const value = readFieldValue(secrets, field);

  await logCredentialAccess({
    credentialId: id,
    actor,
    action: "revealed",
    fieldName: field,
  });

  return { field, value };
}

export async function copyCredentialField(
  id: string,
  field: CredentialFieldRef,
  actor: AuditActor,
): Promise<{ field: CredentialFieldRef; value: string }> {
  const sb = getSupabaseServiceClient();
  const { data, error } = await sb
    .from("credential_entries")
    .select("id,encrypted_data")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`copy credential_entry: ${error.message}`);
  if (!data) throw new Error("Credential entry not found");

  const secrets = decryptCredentialPayload(data.encrypted_data);
  const value = readFieldValue(secrets, field);

  await logCredentialAccess({
    credentialId: id,
    actor,
    action: "copied",
    fieldName: field,
  });

  return { field, value };
}

export async function logCredentialAccess(params: {
  credentialId: string;
  actor: AuditActor;
  action: CredentialAccessAction;
  fieldName?: CredentialFieldRef | null;
}): Promise<void> {
  const sb = getSupabaseServiceClient();
  const { error } = await sb.from("credential_access_log").insert({
    credential_id: params.credentialId,
    user_id: params.actor.userId,
    user_name: params.actor.userName,
    action: params.action,
    field_name: params.fieldName ?? null,
  });
  if (error) throw new Error(`log credential access: ${error.message}`);
}

export async function listCredentialAccessLog(params?: {
  credentialId?: string;
  limit?: number;
}): Promise<CredentialAccessLogRecord[]> {
  const limit = Math.min(Math.max(params?.limit ?? 200, 1), 500);
  const sb = getSupabaseServiceClient();
  let query = sb
    .from("credential_access_log")
    .select("id,credential_id,user_id,user_name,action,field_name,timestamp")
    .order("timestamp", { ascending: false })
    .limit(limit);

  if (params?.credentialId) {
    query = query.eq("credential_id", params.credentialId);
  }

  const { data, error } = await query;
  if (error) throw new Error(`list credential_access_log: ${error.message}`);

  return (data ?? []).map((row) => {
    const r = row as LogRow;
    return {
      id: r.id,
      credential_id: r.credential_id,
      user_id: r.user_id,
      user_name: r.user_name?.trim() || null,
      action: r.action,
      field_name: r.field_name?.trim() || null,
      timestamp: r.timestamp,
    };
  });
}

export async function logCredentialViewedMasked(
  id: string,
  actor: AuditActor,
): Promise<void> {
  await logCredentialAccess({
    credentialId: id,
    actor,
    action: "viewed_masked",
  });
}

export type CredentialNeedsAttention = {
  id: string;
  label: string;
  category: string;
  model_id: string | null;
  reason: AttentionReason;
  note_snippet: string;
};

export type CredentialModelCoverage = {
  model_id: string;
  entry_count: number;
  filled_categories: ExpectedCategoryKey[];
  expected_categories: ExpectedCategoryKey[];
  coverage_pct: number;
};

export type CredentialLibraryInsights = {
  category_breakdown: { category: string; count: number; normalized: string }[];
  general_count: number;
  model_specific_count: number;
  recently_added: {
    id: string;
    label: string;
    category: string;
    model_id: string | null;
    created_at: string;
  }[];
  recently_accessed: {
    credential_id: string;
    last_accessed_at: string;
    access_count: number;
  }[];
  never_accessed_ids: string[];
  accessed_credential_ids: string[];
  needs_attention: CredentialNeedsAttention[];
  model_coverage: CredentialModelCoverage[];
};

const ACCESS_ACTIONS: CredentialAccessAction[] = ["revealed", "copied"];

export async function getCredentialLibraryInsights(): Promise<CredentialLibraryInsights> {
  const sb = getSupabaseServiceClient();

  const [{ data: entryRows, error: entryError }, { data: logRows, error: logError }] =
    await Promise.all([
      sb
        .from("credential_entries")
        .select(
          "id,model_id,category,label,encrypted_data,created_at,updated_at",
        )
        .order("created_at", { ascending: false }),
      sb
        .from("credential_access_log")
        .select("credential_id,action,timestamp")
        .in("action", ACCESS_ACTIONS)
        .order("timestamp", { ascending: false })
        .limit(2000),
    ]);

  if (entryError) throw new Error(`insights credential_entries: ${entryError.message}`);
  if (logError) throw new Error(`insights credential_access_log: ${logError.message}`);

  const entries = entryRows ?? [];
  const logs = logRows ?? [];

  const categoryCounts = new Map<string, { category: string; count: number; normalized: string }>();
  let generalCount = 0;
  let modelSpecificCount = 0;
  const needsAttention: CredentialNeedsAttention[] = [];
  const modelCategorySets = new Map<string, Set<ExpectedCategoryKey>>();
  const modelEntryCounts = new Map<string, number>();

  for (const row of entries) {
    const category = (row.category ?? "").trim();
    const normalized = normalizeCategoryKey(category);
    const existing = categoryCounts.get(normalized);
    if (existing) {
      existing.count += 1;
    } else {
      categoryCounts.set(normalized, { category, count: 1, normalized });
    }

    if (row.model_id) {
      modelSpecificCount += 1;
      modelEntryCounts.set(row.model_id, (modelEntryCounts.get(row.model_id) ?? 0) + 1);
      const key = normalizeCategoryKey(category);
      if ((EXPECTED_MODEL_CATEGORY_KEYS as readonly string[]).includes(key)) {
        if (!modelCategorySets.has(row.model_id)) modelCategorySets.set(row.model_id, new Set());
        modelCategorySets.get(row.model_id)!.add(key as ExpectedCategoryKey);
      }
    } else {
      generalCount += 1;
    }

    try {
      const secrets = decryptCredentialPayload(row.encrypted_data);
      const notes = secrets.notes?.trim() ?? "";
      const reason = detectAttentionReason(notes);
      if (reason) {
        needsAttention.push({
          id: row.id,
          label: row.label.trim(),
          category,
          model_id: row.model_id,
          reason,
          note_snippet: notes.length > 120 ? `${notes.slice(0, 117)}…` : notes,
        });
      }
    } catch {
      // skip unreadable entries for attention scan
    }
  }

  const accessByCredential = new Map<string, { last_accessed_at: string; access_count: number }>();
  for (const log of logs) {
    const cid = log.credential_id;
    const existing = accessByCredential.get(cid);
    if (!existing) {
      accessByCredential.set(cid, {
        last_accessed_at: log.timestamp,
        access_count: 1,
      });
    } else {
      existing.access_count += 1;
    }
  }

  const accessedCredentialIds = [...accessByCredential.keys()];
  const neverAccessedIds = entries
    .map((e) => e.id)
    .filter((id) => !accessByCredential.has(id));

  const recentlyAdded = entries.slice(0, 8).map((row) => ({
    id: row.id,
    label: row.label.trim(),
    category: row.category.trim(),
    model_id: row.model_id,
    created_at: row.created_at,
  }));

  const recentlyAccessed = [...accessByCredential.entries()]
    .map(([credential_id, meta]) => ({ credential_id, ...meta }))
    .sort((a, b) => b.last_accessed_at.localeCompare(a.last_accessed_at))
    .slice(0, 8);

  const modelCoverage: CredentialModelCoverage[] = [...modelCategorySets.entries()]
    .map(([model_id, filledSet]) => {
      const filled_categories = [...filledSet].sort();
      const expected_categories = [...EXPECTED_MODEL_CATEGORY_KEYS];
      const coverage_pct = Math.round(
        (filled_categories.length / expected_categories.length) * 100,
      );
      return {
        model_id,
        entry_count: modelEntryCounts.get(model_id) ?? 0,
        filled_categories,
        expected_categories,
        coverage_pct,
      };
    })
    .sort((a, b) => a.coverage_pct - b.coverage_pct);

  return {
    category_breakdown: [...categoryCounts.values()].sort((a, b) => b.count - a.count),
    general_count: generalCount,
    model_specific_count: modelSpecificCount,
    recently_added: recentlyAdded,
    recently_accessed: recentlyAccessed,
    never_accessed_ids: neverAccessedIds,
    accessed_credential_ids: accessedCredentialIds,
    needs_attention: needsAttention.sort((a, b) => a.label.localeCompare(b.label)),
    model_coverage: modelCoverage,
  };
}

export { EXPECTED_CATEGORY_LABELS };
