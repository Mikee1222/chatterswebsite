/**
 * Gunzo Agent — chat loop with Anthropic tools.
 * READ tools execute immediately; ACTION tools propose + stop for confirmation.
 * Dedupes identical READ tool calls within a turn and bounds conversation history.
 */

import type { AuthUser } from "@/lib/auth-config";
import {
  callAnthropicWithTools,
  type AnthropicToolMessage,
  type AnthropicToolResultBlock,
} from "@/lib/ai-assistant";
import {
  GUNZO_AGENT_SYSTEM,
  GUNZO_AGENT_TOOLS,
  GUNZO_TOOL_META,
  isGunzoActionTool,
  isGunzoReadTool,
  isGunzoToolName,
} from "@/lib/gunzo-agent-tools";
import { executeGunzoTool } from "@/services/gunzo-agent-exec";
import { insertProposedAction, type AgentActionLogRow } from "@/services/gunzo-agent-log";

/** Extra rounds so cross-system synthesis can chain multiple READ tool batches. */
const MAX_ROUNDS = 6;
/** Keep the last N user/assistant text turns (tool loops still append within the turn). */
const MAX_HISTORY_MESSAGES = 12;

export type GunzoChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export type GunzoPendingAction = {
  log_id: string;
  tool_name: string;
  parameters: Record<string, unknown>;
  description: string;
  proposed_at: string;
};

export type GunzoChatResult = {
  assistantText: string;
  pendingActions: GunzoPendingAction[];
  readSummaries?: string[];
};

function adminAttribution(user: AuthUser): { executed_by: string; executed_by_name: string } {
  const executed_by = (user.airtableUserId ?? user.id)?.trim() || user.id;
  const executed_by_name = (user.fullName ?? user.email ?? "Admin").trim() || "Admin";
  return { executed_by, executed_by_name };
}

function stringifyToolResult(payload: unknown): string {
  try {
    const s = JSON.stringify(payload);
    if (s.length > 8_000) return `${s.slice(0, 8_000)}…[truncated]`;
    return s;
  } catch {
    return String(payload);
  }
}

function toolCallKey(name: string, input: Record<string, unknown>): string {
  try {
    return `${name}:${JSON.stringify(input)}`;
  } catch {
    return `${name}:`;
  }
}

/** Bound history: keep newest messages; optionally prepend a short note when trimmed. */
function boundHistory(messages: GunzoChatMessage[]): GunzoChatMessage[] {
  if (messages.length <= MAX_HISTORY_MESSAGES) return messages;
  const kept = messages.slice(-MAX_HISTORY_MESSAGES);
  return [
    {
      role: "assistant",
      content:
        "(Earlier messages in this chat were trimmed to save context. Continue from the recent turns below.)",
    },
    ...kept,
  ];
}

export async function runGunzoAgentChat(
  user: AuthUser,
  messages: GunzoChatMessage[],
): Promise<GunzoChatResult> {
  const cleaned = messages
    .map((m) => ({
      role: m.role,
      content: (m.content ?? "").trim(),
    }))
    .filter((m) => m.content.length > 0 && (m.role === "user" || m.role === "assistant"));

  if (cleaned.length === 0) {
    return { assistantText: "Send a message to get started.", pendingActions: [] };
  }

  const thread: AnthropicToolMessage[] = boundHistory(cleaned).map((m) => ({
    role: m.role,
    content: m.content,
  }));

  const pendingActions: GunzoPendingAction[] = [];
  const readSummaries: string[] = [];
  /** Deduplicate identical READ tool calls across rounds in this conversation turn. */
  const readCache = new Map<string, string>();
  let lastText = "";
  const { executed_by, executed_by_name } = adminAttribution(user);

  for (let round = 0; round < MAX_ROUNDS; round++) {
    const response = await callAnthropicWithTools({
      messages: thread,
      tools: GUNZO_AGENT_TOOLS,
      system: GUNZO_AGENT_SYSTEM,
      maxTokens: 1800,
      temperature: 0.35,
      logLabel: "gunzo-agent",
    });

    if (!response) {
      return {
        assistantText:
          lastText ||
          "Gunzo Agent could not reach the AI service. Check ANTHROPIC_API_KEY and try again.",
        pendingActions,
        readSummaries: readSummaries.length ? readSummaries : undefined,
      };
    }

    if (response.text) lastText = response.text;

    if (!response.toolUses.length) {
      return {
        assistantText: lastText || "Done.",
        pendingActions,
        readSummaries: readSummaries.length ? readSummaries : undefined,
      };
    }

    // Append assistant turn with raw content (includes tool_use blocks)
    thread.push({
      role: "assistant",
      content: response.rawContent as unknown as Array<Record<string, unknown>>,
    });

    const toolResults: AnthropicToolResultBlock[] = [];
    let stopForConfirm = false;

    for (const use of response.toolUses) {
      const name = use.name;
      const input = use.input ?? {};

      if (!isGunzoToolName(name)) {
        toolResults.push({
          type: "tool_result",
          tool_use_id: use.id,
          content: stringifyToolResult({ ok: false, error: `Unknown tool: ${name}` }),
          is_error: true,
        });
        continue;
      }

      if (isGunzoActionTool(name)) {
        let log: AgentActionLogRow;
        try {
          log = await insertProposedAction({
            tool_name: name,
            parameters: input,
            executed_by,
            executed_by_name,
            action_type: "action",
          });
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          toolResults.push({
            type: "tool_result",
            tool_use_id: use.id,
            content: stringifyToolResult({ ok: false, error: msg }),
            is_error: true,
          });
          continue;
        }

        pendingActions.push({
          log_id: log.id,
          tool_name: name,
          parameters: input,
          description: GUNZO_TOOL_META[name].description,
          proposed_at: log.proposed_at,
        });

        toolResults.push({
          type: "tool_result",
          tool_use_id: use.id,
          content: stringifyToolResult({
            ok: true,
            status: "proposed",
            log_id: log.id,
            message:
              "Action proposed. Waiting for human Confirm/Cancel in the UI. Do not claim it executed.",
          }),
        });
        stopForConfirm = true;
        continue;
      }

      if (isGunzoReadTool(name)) {
        const key = toolCallKey(name, input);
        const cachedPayload = readCache.get(key);
        if (cachedPayload) {
          readSummaries.push(`${name}: (reused prior result)`);
          toolResults.push({
            type: "tool_result",
            tool_use_id: use.id,
            content: cachedPayload,
            is_error: false,
          });
          continue;
        }

        const result = await executeGunzoTool(name, input, { user, confirmed: false });
        readSummaries.push(`${name}: ${result.summary}`);
        const payload = stringifyToolResult(result);
        readCache.set(key, payload);
        toolResults.push({
          type: "tool_result",
          tool_use_id: use.id,
          content: payload,
          is_error: !result.ok,
        });
      }
    }

    thread.push({
      role: "user",
      content: toolResults as unknown as Array<Record<string, unknown>>,
    });

    if (stopForConfirm) {
      // One more model turn so it can narrate the pending confirmation, then stop.
      const wrap = await callAnthropicWithTools({
        messages: thread,
        tools: GUNZO_AGENT_TOOLS,
        system: GUNZO_AGENT_SYSTEM,
        maxTokens: 800,
        temperature: 0.2,
        logLabel: "gunzo-agent-confirm-wrap",
      });
      if (wrap?.text) lastText = wrap.text;
      else if (!lastText) {
        lastText =
          pendingActions.length === 1
            ? `I prepared **${pendingActions[0]!.tool_name}** for your confirmation.`
            : `I prepared ${pendingActions.length} actions for your confirmation.`;
      }
      return {
        assistantText: lastText,
        pendingActions,
        readSummaries: readSummaries.length ? readSummaries : undefined,
      };
    }
  }

  return {
    assistantText: lastText || "Stopped after max tool rounds. Ask a follow-up if you need more.",
    pendingActions,
    readSummaries: readSummaries.length ? readSummaries : undefined,
  };
}
