/**
 * Shared Anthropic Messages API helper (server-side only).
 * Model: claude-sonnet-4-6 — same as Applications AI summary / translate / funnel insight.
 * Never expose ANTHROPIC_API_KEY to the client.
 */

export const AI_ASSISTANT_MODEL = "claude-sonnet-4-6";

const ANTHROPIC_MESSAGES_URL = "https://api.anthropic.com/v1/messages";

type AnthropicContentBlock = {
  type?: string;
  text?: string;
  id?: string;
  name?: string;
  input?: unknown;
};

type AnthropicMessagesResponse = {
  content?: AnthropicContentBlock[];
  stop_reason?: string | null;
  error?: { message?: string };
};

export type AiChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export type CallAnthropicOptions = {
  messages: AiChatMessage[];
  system?: string;
  maxTokens?: number;
  temperature?: number;
  logLabel?: string;
  model?: string;
};

export type CallAnthropicResult = {
  text: string;
  model: string;
};

/** Anthropic tool definition (input_schema JSON Schema). */
export type AnthropicToolDef = {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
};

export type AnthropicToolUseBlock = {
  type: "tool_use";
  id: string;
  name: string;
  input: Record<string, unknown>;
};

export type AnthropicToolResultBlock = {
  type: "tool_result";
  tool_use_id: string;
  content: string;
  is_error?: boolean;
};

/** Message content for tool-use loops (string or content blocks). */
export type AnthropicToolMessage = {
  role: "user" | "assistant";
  content: string | Array<Record<string, unknown>>;
};

export type CallAnthropicWithToolsOptions = {
  messages: AnthropicToolMessage[];
  tools: AnthropicToolDef[];
  system?: string;
  maxTokens?: number;
  temperature?: number;
  logLabel?: string;
  model?: string;
};

export type CallAnthropicWithToolsResult = {
  text: string;
  toolUses: AnthropicToolUseBlock[];
  stopReason: string | null;
  rawContent: AnthropicContentBlock[];
  model: string;
};

/** Call Anthropic Messages API. Returns null if API key missing or call fails. */
export async function callAnthropic(
  options: CallAnthropicOptions,
): Promise<CallAnthropicResult | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  const label = options.logLabel ?? "ai-assistant";
  if (!apiKey) {
    console.warn(`[${label}] ANTHROPIC_API_KEY not set — skipping`);
    return null;
  }

  const model = options.model?.trim() || AI_ASSISTANT_MODEL;
  const messages = options.messages
    .map((m) => ({ role: m.role, content: (m.content ?? "").trim() }))
    .filter((m) => m.content.length > 0);

  if (messages.length === 0) {
    console.warn(`[${label}] no messages to send`);
    return null;
  }

  try {
    const body: Record<string, unknown> = {
      model,
      max_tokens: options.maxTokens ?? 800,
      temperature: options.temperature ?? 0.2,
      messages,
    };
    if (options.system?.trim()) body.system = options.system.trim();

    const res = await fetch(ANTHROPIC_MESSAGES_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(body),
    });

    const data = (await res.json().catch(() => ({}))) as AnthropicMessagesResponse;
    if (!res.ok) {
      console.error(`[${label}] Anthropic error`, res.status, data?.error?.message ?? data);
      return null;
    }

    const text = (data.content ?? [])
      .filter((b) => b.type === "text" && typeof b.text === "string")
      .map((b) => b.text!.trim())
      .filter(Boolean)
      .join("\n")
      .trim();

    if (!text) return null;
    return { text, model };
  } catch (err) {
    console.error(`[${label}] fetch failed`, err);
    return null;
  }
}

/**
 * Call Anthropic Messages API with tools. Returns null if API key missing or call fails.
 * Caller owns the tool loop (append tool_result, re-call).
 */
export async function callAnthropicWithTools(
  options: CallAnthropicWithToolsOptions,
): Promise<CallAnthropicWithToolsResult | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  const label = options.logLabel ?? "ai-assistant-tools";
  if (!apiKey) {
    console.warn(`[${label}] ANTHROPIC_API_KEY not set — skipping`);
    return null;
  }

  const model = options.model?.trim() || AI_ASSISTANT_MODEL;
  if (!options.messages.length) {
    console.warn(`[${label}] no messages to send`);
    return null;
  }

  try {
    const body: Record<string, unknown> = {
      model,
      max_tokens: options.maxTokens ?? 2048,
      temperature: options.temperature ?? 0.2,
      messages: options.messages,
      tools: options.tools,
    };
    if (options.system?.trim()) body.system = options.system.trim();

    const res = await fetch(ANTHROPIC_MESSAGES_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(body),
    });

    const data = (await res.json().catch(() => ({}))) as AnthropicMessagesResponse;
    if (!res.ok) {
      console.error(`[${label}] Anthropic error`, res.status, data?.error?.message ?? data);
      return null;
    }

    const rawContent = data.content ?? [];
    const text = rawContent
      .filter((b) => b.type === "text" && typeof b.text === "string")
      .map((b) => b.text!.trim())
      .filter(Boolean)
      .join("\n")
      .trim();

    const toolUses: AnthropicToolUseBlock[] = [];
    for (const b of rawContent) {
      if (b.type === "tool_use" && typeof b.id === "string" && typeof b.name === "string") {
        const input =
          b.input && typeof b.input === "object" && !Array.isArray(b.input)
            ? (b.input as Record<string, unknown>)
            : {};
        toolUses.push({ type: "tool_use", id: b.id, name: b.name, input });
      }
    }

    return {
      text,
      toolUses,
      stopReason: data.stop_reason ?? null,
      rawContent,
      model,
    };
  } catch (err) {
    console.error(`[${label}] fetch failed`, err);
    return null;
  }
}

export function extractJsonObject(raw: string): Record<string, unknown> | null {
  const trimmed = raw.trim();
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (fence?.[1] ?? trimmed).trim();
  try {
    return JSON.parse(candidate) as Record<string, unknown>;
  } catch {
    const start = candidate.indexOf("{");
    const end = candidate.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(candidate.slice(start, end + 1)) as Record<string, unknown>;
      } catch {
        return null;
      }
    }
    return null;
  }
}

export function extractJsonArray(raw: string): unknown[] | null {
  const trimmed = raw.trim();
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (fence?.[1] ?? trimmed).trim();
  try {
    const parsed = JSON.parse(candidate);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    const start = candidate.indexOf("[");
    const end = candidate.lastIndexOf("]");
    if (start >= 0 && end > start) {
      try {
        const parsed = JSON.parse(candidate.slice(start, end + 1));
        return Array.isArray(parsed) ? parsed : null;
      } catch {
        return null;
      }
    }
    return null;
  }
}

export type AnthropicImageSource = {
  mediaType: "image/jpeg" | "image/png" | "image/gif" | "image/webp";
  base64: string;
};

/**
 * Multimodal Messages call (text + optional images). Claude Sonnet supports vision.
 */
export async function callAnthropicVision(options: {
  text: string;
  images?: AnthropicImageSource[];
  system?: string;
  maxTokens?: number;
  temperature?: number;
  logLabel?: string;
  model?: string;
}): Promise<CallAnthropicResult | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  const label = options.logLabel ?? "ai-assistant-vision";
  if (!apiKey) {
    console.warn(`[${label}] ANTHROPIC_API_KEY not set — skipping`);
    return null;
  }

  const content: Array<Record<string, unknown>> = [];
  for (const img of options.images ?? []) {
    const data = img.base64.trim();
    if (!data) continue;
    content.push({
      type: "image",
      source: {
        type: "base64",
        media_type: img.mediaType,
        data,
      },
    });
  }
  const text = options.text.trim();
  if (text) content.push({ type: "text", text });
  if (content.length === 0) {
    console.warn(`[${label}] no content to send`);
    return null;
  }

  const model = options.model?.trim() || AI_ASSISTANT_MODEL;
  try {
    const body: Record<string, unknown> = {
      model,
      max_tokens: options.maxTokens ?? 500,
      temperature: options.temperature ?? 0.2,
      messages: [{ role: "user", content }],
    };
    if (options.system?.trim()) body.system = options.system.trim();

    const res = await fetch(ANTHROPIC_MESSAGES_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(body),
    });

    const data = (await res.json().catch(() => ({}))) as AnthropicMessagesResponse;
    if (!res.ok) {
      console.error(`[${label}] Anthropic error`, res.status, data?.error?.message ?? data);
      return null;
    }

    const out = (data.content ?? [])
      .filter((b) => b.type === "text" && typeof b.text === "string")
      .map((b) => b.text!.trim())
      .filter(Boolean)
      .join("\n")
      .trim();

    if (!out) return null;
    return { text: out, model };
  } catch (err) {
    console.error(`[${label}] fetch failed`, err);
    return null;
  }
}

export const AI_GROUNDING_RULES = `STRICT RULES:
- Use ONLY the facts provided in the context / data below.
- Do NOT invent numbers, names, trends, causes, or recommendations not supported by the data.
- If data is missing or sparse, say so briefly — do not speculate.
- Neutral professional tone. No hype, no markdown headings unless asked.`;
