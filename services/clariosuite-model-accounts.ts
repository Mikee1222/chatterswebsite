/**
 * ClarioSuite multi-account linking per model (Supabase).
 */

import { getSupabaseServiceClient } from "@/lib/supabase-server";
import type { ModelRecord } from "@/types";

export type ClarioSuiteModelAccount = {
  id: string;
  model_id: string;
  clariosuite_ig_user_id: string;
  account_label: string;
  is_primary: boolean;
  created_at: string;
};

export type ClarioSuiteModelAccountInput = {
  clariosuite_ig_user_id: string;
  account_label: string;
  is_primary?: boolean;
};

type AccountRow = {
  id: string;
  model_id: string;
  clariosuite_ig_user_id: string;
  account_label: string;
  is_primary: boolean;
  created_at: string;
};

function mapRow(row: AccountRow): ClarioSuiteModelAccount {
  return {
    id: row.id,
    model_id: row.model_id,
    clariosuite_ig_user_id: row.clariosuite_ig_user_id.trim(),
    account_label: row.account_label.trim() || "Account",
    is_primary: row.is_primary === true,
    created_at: row.created_at,
  };
}

export async function listClarioSuiteModelAccounts(
  modelId: string
): Promise<ClarioSuiteModelAccount[]> {
  const sb = getSupabaseServiceClient();
  const { data, error } = await sb
    .from("clariosuite_model_accounts")
    .select("id,model_id,clariosuite_ig_user_id,account_label,is_primary,created_at")
    .eq("model_id", modelId.trim())
    .order("is_primary", { ascending: false })
    .order("created_at", { ascending: true });
  if (error) throw new Error(`list clariosuite_model_accounts: ${error.message}`);
  return (data ?? []).map((r) => mapRow(r as AccountRow));
}

export async function listAllClarioSuiteModelAccounts(): Promise<ClarioSuiteModelAccount[]> {
  const sb = getSupabaseServiceClient();
  const { data, error } = await sb
    .from("clariosuite_model_accounts")
    .select("id,model_id,clariosuite_ig_user_id,account_label,is_primary,created_at")
    .order("model_id")
    .order("is_primary", { ascending: false });
  if (error) throw new Error(`list all clariosuite_model_accounts: ${error.message}`);
  return (data ?? []).map((r) => mapRow(r as AccountRow));
}

/** Resolve primary IG user id — accounts table first, deprecated column fallback. */
export function resolvePrimaryIgUserId(
  model: Pick<ModelRecord, "clariosuite_ig_user_id"> | null | undefined,
  accounts: ClarioSuiteModelAccount[]
): string | null {
  const primary = accounts.find((a) => a.is_primary)?.clariosuite_ig_user_id?.trim();
  if (primary) return primary;
  const first = accounts[0]?.clariosuite_ig_user_id?.trim();
  if (first) return first;
  const legacy = model?.clariosuite_ig_user_id?.trim();
  return legacy || null;
}

/** Keep deprecated modelss.clariosuite_ig_user_id synced to primary account. */
export async function syncPrimaryIgToModelss(modelId: string): Promise<void> {
  const accounts = await listClarioSuiteModelAccounts(modelId);
  const primary =
    accounts.find((a) => a.is_primary)?.clariosuite_ig_user_id ??
    accounts[0]?.clariosuite_ig_user_id ??
    null;
  const sb = getSupabaseServiceClient();
  const { error } = await sb
    .from("modelss")
    .update({ clariosuite_ig_user_id: primary, updated_at: new Date().toISOString() })
    .or(`airtable_id.eq.${modelId},id.eq.${modelId}`);
  if (error) throw new Error(`sync primary ig to modelss: ${error.message}`);
}

/**
 * Replace all linked accounts for a model (from admin edit form).
 * Ensures exactly one primary when any accounts exist.
 */
export async function saveClarioSuiteModelAccounts(
  modelId: string,
  inputs: ClarioSuiteModelAccountInput[]
): Promise<ClarioSuiteModelAccount[]> {
  const mid = modelId.trim();
  const cleaned = inputs
    .map((a) => ({
      clariosuite_ig_user_id: a.clariosuite_ig_user_id.trim(),
      account_label: (a.account_label.trim() || "Account").slice(0, 120),
      is_primary: a.is_primary === true,
    }))
    .filter((a) => a.clariosuite_ig_user_id.length > 0);

  if (cleaned.length && !cleaned.some((a) => a.is_primary)) {
    cleaned[0]!.is_primary = true;
  }
  if (cleaned.filter((a) => a.is_primary).length > 1) {
    let seen = false;
    for (const a of cleaned) {
      if (a.is_primary) {
        if (seen) a.is_primary = false;
        else seen = true;
      }
    }
  }

  const sb = getSupabaseServiceClient();
  const { error: delErr } = await sb.from("clariosuite_model_accounts").delete().eq("model_id", mid);
  if (delErr) throw new Error(`delete clariosuite_model_accounts: ${delErr.message}`);

  if (!cleaned.length) {
    await syncPrimaryIgToModelss(mid);
    return [];
  }

  const now = new Date().toISOString();
  const payload = cleaned.map((a) => ({
    model_id: mid,
    clariosuite_ig_user_id: a.clariosuite_ig_user_id,
    account_label: a.account_label,
    is_primary: a.is_primary,
    created_at: now,
  }));

  const { data, error } = await sb
    .from("clariosuite_model_accounts")
    .insert(payload)
    .select("id,model_id,clariosuite_ig_user_id,account_label,is_primary,created_at");
  if (error) throw new Error(`insert clariosuite_model_accounts: ${error.message}`);

  await syncPrimaryIgToModelss(mid);
  return (data ?? []).map((r) => mapRow(r as AccountRow));
}
