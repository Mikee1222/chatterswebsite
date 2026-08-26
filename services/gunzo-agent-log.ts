/**
 * Gunzo Agent — audit log CRUD against agent_action_log (service role).
 */

import { getSupabaseServiceClient } from "@/lib/supabase-server";

export type AgentActionLogStatus =
  | "proposed"
  | "confirmed"
  | "executed"
  | "failed"
  | "cancelled";

export type AgentActionLogType = "read" | "action";

export type AgentActionLogRow = {
  id: string;
  action_type: AgentActionLogType;
  tool_name: string;
  parameters: Record<string, unknown>;
  proposed_at: string;
  confirmed_at: string | null;
  executed_by: string;
  executed_by_name: string | null;
  result: unknown;
  status: AgentActionLogStatus;
  error_message: string | null;
  created_at: string;
};

function mapRow(raw: Record<string, unknown>): AgentActionLogRow {
  const parameters =
    raw.parameters && typeof raw.parameters === "object" && !Array.isArray(raw.parameters)
      ? (raw.parameters as Record<string, unknown>)
      : {};
  return {
    id: String(raw.id),
    action_type: raw.action_type === "read" ? "read" : "action",
    tool_name: String(raw.tool_name ?? ""),
    parameters,
    proposed_at: String(raw.proposed_at ?? ""),
    confirmed_at: raw.confirmed_at ? String(raw.confirmed_at) : null,
    executed_by: String(raw.executed_by ?? ""),
    executed_by_name: raw.executed_by_name != null ? String(raw.executed_by_name) : null,
    result: raw.result ?? null,
    status: (String(raw.status ?? "proposed") as AgentActionLogStatus) || "proposed",
    error_message: raw.error_message != null ? String(raw.error_message) : null,
    created_at: String(raw.created_at ?? ""),
  };
}

export async function insertProposedAction(input: {
  tool_name: string;
  parameters: Record<string, unknown>;
  executed_by: string;
  executed_by_name?: string | null;
  action_type?: AgentActionLogType;
}): Promise<AgentActionLogRow> {
  const sb = getSupabaseServiceClient();
  const { data, error } = await sb
    .from("agent_action_log")
    .insert({
      action_type: input.action_type ?? "action",
      tool_name: input.tool_name,
      parameters: input.parameters ?? {},
      executed_by: input.executed_by,
      executed_by_name: input.executed_by_name ?? null,
      status: "proposed",
    })
    .select("*")
    .single();
  if (error) throw new Error(`insertProposedAction: ${error.message}`);
  return mapRow(data as Record<string, unknown>);
}

export async function getAgentActionLogById(id: string): Promise<AgentActionLogRow | null> {
  const sb = getSupabaseServiceClient();
  const { data, error } = await sb.from("agent_action_log").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(`getAgentActionLogById: ${error.message}`);
  if (!data) return null;
  return mapRow(data as Record<string, unknown>);
}

export async function updateAgentActionLog(
  id: string,
  patch: {
    status?: AgentActionLogStatus;
    confirmed_at?: string | null;
    result?: unknown;
    error_message?: string | null;
  },
): Promise<AgentActionLogRow> {
  const sb = getSupabaseServiceClient();
  const updates: Record<string, unknown> = {};
  if (patch.status !== undefined) updates.status = patch.status;
  if (patch.confirmed_at !== undefined) updates.confirmed_at = patch.confirmed_at;
  if (patch.result !== undefined) updates.result = patch.result;
  if (patch.error_message !== undefined) updates.error_message = patch.error_message;

  const { data, error } = await sb
    .from("agent_action_log")
    .update(updates)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw new Error(`updateAgentActionLog: ${error.message}`);
  return mapRow(data as Record<string, unknown>);
}

export async function listAgentActionLogsForUser(
  executedBy: string,
  opts?: { limit?: number },
): Promise<AgentActionLogRow[]> {
  const sb = getSupabaseServiceClient();
  const limit = Math.min(Math.max(opts?.limit ?? 40, 1), 100);
  const { data, error } = await sb
    .from("agent_action_log")
    .select("*")
    .eq("executed_by", executedBy)
    .order("proposed_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`listAgentActionLogsForUser: ${error.message}`);
  return (data ?? []).map((r) => mapRow(r as Record<string, unknown>));
}
