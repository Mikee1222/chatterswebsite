/**
 * Agent token CRUD + lookup (service role). Plaintext never stored — only sha256 hex.
 */

import { getSupabaseServiceClient } from "@/lib/supabase-server";
import { isUserActiveForAssignment } from "@/lib/assignment-filters";
import {
  agentTokenDisplayPrefix,
  generateAgentTokenPlaintext,
  hashAgentToken,
  isAgentTokenFormat,
} from "@/lib/agent-token-crypto";
import { publicId } from "@/lib/supabase-data";
import type { AuthUser } from "@/lib/auth-config";
import type { VaType } from "@/types";

export type AgentTokenRow = {
  id: string;
  user_id: string;
  token_prefix: string;
  label: string | null;
  created_by: string | null;
  created_at: string;
  expires_at: string;
  revoked_at: string | null;
  last_used_at: string | null;
};

const LAST_USED_THROTTLE_MS = 5 * 60 * 1000;

type UserAgentRow = {
  id: string;
  airtable_id?: string | null;
  email?: string | null;
  full_name?: string | null;
  role?: string | null;
  secondary_role?: string | null;
  va_type?: string | null;
  status?: string | null;
  can_login?: boolean | null;
  is_agent?: boolean | null;
};

function mapVaType(raw: unknown): VaType | null {
  const s = String(raw ?? "").trim().toLowerCase();
  if (s === "chatting" || s === "marketing" || s === "both") return s;
  return null;
}

function mapSecondaryRole(raw: unknown): "chatter" | "virtual_assistant" | null {
  const s = String(raw ?? "").trim().toLowerCase();
  if (s === "chatter") return "chatter";
  if (s === "va" || s === "virtual_assistant") return "virtual_assistant";
  return null;
}

function mapTokenRow(raw: Record<string, unknown>): AgentTokenRow {
  return {
    id: String(raw.id),
    user_id: String(raw.user_id),
    token_prefix: String(raw.token_prefix ?? ""),
    label: raw.label != null ? String(raw.label) : null,
    created_by: raw.created_by != null ? String(raw.created_by) : null,
    created_at: String(raw.created_at ?? ""),
    expires_at: String(raw.expires_at ?? ""),
    revoked_at: raw.revoked_at != null ? String(raw.revoked_at) : null,
    last_used_at: raw.last_used_at != null ? String(raw.last_used_at) : null,
  };
}

/** Cached is_agent lookups (cookie reject path). */
const isAgentCache = new Map<string, { value: boolean; expiresAt: number }>();
const IS_AGENT_CACHE_TTL_MS = 30_000;

export async function userIsAgent(userPublicOrUuid: string): Promise<boolean> {
  const key = userPublicOrUuid.trim();
  if (!key) return false;
  const cached = isAgentCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const sb = getSupabaseServiceClient();
  let value = false;
  if (key.includes("-") && key.length >= 32) {
    const { data } = await sb.from("users").select("is_agent").eq("id", key).maybeSingle();
    value = Boolean((data as { is_agent?: boolean } | null)?.is_agent);
  }
  if (!value) {
    const { data } = await sb
      .from("users")
      .select("is_agent")
      .or(`airtable_id.eq.${key},id.eq.${key}`)
      .limit(1)
      .maybeSingle();
    value = Boolean((data as { is_agent?: boolean } | null)?.is_agent);
  }
  isAgentCache.set(key, { value, expiresAt: Date.now() + IS_AGENT_CACHE_TTL_MS });
  return value;
}

export async function createAgentToken(input: {
  userEmail: string;
  label?: string | null;
  createdBy?: string | null;
  expiresInDays?: number;
}): Promise<{ token: string; row: AgentTokenRow }> {
  const email = input.userEmail.trim().toLowerCase();
  if (!email) throw new Error("user email required");

  const sb = getSupabaseServiceClient();
  const { data: user, error: userErr } = await sb
    .from("users")
    .select("id, email, is_agent, status, can_login")
    .eq("email", email)
    .maybeSingle();
  if (userErr) throw new Error(`createAgentToken user lookup: ${userErr.message}`);
  if (!user) throw new Error(`No user with email ${email}`);
  if (!(user as UserAgentRow).is_agent) {
    throw new Error(`User ${email} is not marked is_agent=true`);
  }

  const plaintext = generateAgentTokenPlaintext();
  const token_hash = hashAgentToken(plaintext);
  const token_prefix = agentTokenDisplayPrefix(plaintext);
  const days = input.expiresInDays ?? 90;
  const expires_at = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await sb
    .from("agent_tokens")
    .insert({
      user_id: (user as { id: string }).id,
      token_hash,
      token_prefix,
      label: input.label?.trim() || null,
      created_by: input.createdBy?.trim() || null,
      expires_at,
    })
    .select("*")
    .single();
  if (error) throw new Error(`createAgentToken insert: ${error.message}`);

  return { token: plaintext, row: mapTokenRow(data as Record<string, unknown>) };
}

export async function revokeAgentToken(id: string): Promise<AgentTokenRow | null> {
  const sb = getSupabaseServiceClient();
  const { data, error } = await sb
    .from("agent_tokens")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", id.trim())
    .is("revoked_at", null)
    .select("*")
    .maybeSingle();
  if (error) throw new Error(`revokeAgentToken: ${error.message}`);
  if (!data) return null;
  return mapTokenRow(data as Record<string, unknown>);
}

export async function listAgentTokens(opts?: {
  userId?: string;
  includeRevoked?: boolean;
}): Promise<AgentTokenRow[]> {
  const sb = getSupabaseServiceClient();
  let q = sb
    .from("agent_tokens")
    .select("id, user_id, token_prefix, label, created_by, created_at, expires_at, revoked_at, last_used_at")
    .order("created_at", { ascending: false });
  if (opts?.userId?.trim()) q = q.eq("user_id", opts.userId.trim());
  if (!opts?.includeRevoked) q = q.is("revoked_at", null);
  const { data, error } = await q;
  if (error) throw new Error(`listAgentTokens: ${error.message}`);
  return (data ?? []).map((r) => mapTokenRow(r as Record<string, unknown>));
}

/**
 * Validate Bearer plaintext → AuthUser (via agent_token) or null.
 * Caller must already have confirmed allowlist + format.
 */
export async function resolveAgentTokenSession(
  plaintext: string,
): Promise<(AuthUser & { via: "agent_token"; agentTokenId: string }) | null> {
  if (!isAgentTokenFormat(plaintext)) return null;
  const token_hash = hashAgentToken(plaintext);
  const sb = getSupabaseServiceClient();
  const nowIso = new Date().toISOString();

  const { data: tokenRow, error } = await sb
    .from("agent_tokens")
    .select("*")
    .eq("token_hash", token_hash)
    .is("revoked_at", null)
    .gt("expires_at", nowIso)
    .maybeSingle();
  if (error || !tokenRow) return null;

  const row = mapTokenRow(tokenRow as Record<string, unknown>);
  const { data: user, error: userErr } = await sb
    .from("users")
    .select(
      "id, airtable_id, email, full_name, role, secondary_role, va_type, status, can_login, is_agent",
    )
    .eq("id", row.user_id)
    .maybeSingle();
  if (userErr || !user) return null;

  const u = user as UserAgentRow;
  if (!u.is_agent) return null;
  if (!isUserActiveForAssignment({ status: u.status ?? "", can_login: u.can_login !== false })) {
    return null;
  }

  const roleRaw = (u.role ?? "").trim().toLowerCase();
  const role =
    roleRaw === "va" || roleRaw === "virtual_assistant" ? "virtual_assistant" : roleRaw || "virtual_assistant";

  const authUser: AuthUser & { via: "agent_token"; agentTokenId: string } = {
    id: publicId({ id: u.id, airtable_id: u.airtable_id }),
    email: (u.email ?? "").trim().toLowerCase(),
    role,
    airtableUserId: u.airtable_id?.trim() || u.id,
    fullName: u.full_name?.trim() || null,
    via: "agent_token",
    agentTokenId: row.id,
  };
  const sec = mapSecondaryRole(u.secondary_role);
  if (sec) authUser.secondary_role = sec;
  const vaType = mapVaType(u.va_type);
  if (vaType) authUser.va_type = vaType;
  if (role === "virtual_assistant") {
    authUser.active_role = "virtual_assistant";
  }

  void touchAgentTokenLastUsed(row.id, row.last_used_at).catch(() => {});

  return authUser;
}

async function touchAgentTokenLastUsed(
  tokenId: string,
  lastUsedAt: string | null,
): Promise<void> {
  if (lastUsedAt) {
    const last = Date.parse(lastUsedAt);
    if (Number.isFinite(last) && Date.now() - last < LAST_USED_THROTTLE_MS) return;
  }
  const sb = getSupabaseServiceClient();
  await sb
    .from("agent_tokens")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", tokenId);
}

export async function findUserUuidByEmail(email: string): Promise<string | null> {
  const sb = getSupabaseServiceClient();
  const { data } = await sb
    .from("users")
    .select("id")
    .eq("email", email.trim().toLowerCase())
    .maybeSingle();
  return data ? String((data as { id: string }).id) : null;
}
