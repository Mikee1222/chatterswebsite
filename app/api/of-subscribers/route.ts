import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { categorizeSubscriber, parseSubscriber, type OFSubscriber } from "@/services/of-subscribers";

const MCP_URL = "https://theonlyapi.com/mcp";

type JsonRpcRequest = {
  jsonrpc: "2.0";
  id?: number | string | null;
  method: string;
  params?: Record<string, unknown>;
};

type McpTextContent = { type?: string; text?: string };

type McpToolResult = {
  content?: McpTextContent[];
  structuredContent?: unknown;
};

type JsonRpcResponse = {
  jsonrpc?: string;
  id?: number | string | null;
  result?: McpToolResult;
  error?: { code?: number; message?: string; data?: unknown };
};

function getSessionHeader(res: Response): string | null {
  return (
    res.headers.get("mcp-session-id") ??
    res.headers.get("Mcp-Session-Id") ??
    res.headers.get("MCP-Session-Id")
  );
}

async function postMcp(
  body: JsonRpcRequest,
  apiKey: string,
  sessionId: string | null
): Promise<Response> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };
  if (sessionId) headers["Mcp-Session-Id"] = sessionId;
  return fetch(MCP_URL, { method: "POST", headers, body: JSON.stringify(body) });
}

/**
 * Optional MCP streamable-HTTP style handshake. If the server returns
 * `mcp-session-id`, we send `notifications/initialized` then reuse the header for `tools/call`.
 */
async function ensureMcpSession(apiKey: string): Promise<string | null> {
  const initRes = await postMcp(
    {
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: { name: "chatter-dashboard", version: "1.0.0" },
      },
    },
    apiKey,
    null
  );

  const initText = await initRes.text();
  let initJson: JsonRpcResponse;
  try {
    initJson = JSON.parse(initText) as JsonRpcResponse;
  } catch {
    initJson = {};
  }

  if (!initRes.ok || initJson.error) {
    console.warn("[of-subscribers MCP] initialize non-OK or error — continuing without session", {
      status: initRes.status,
      initJson,
      initText: initText.slice(0, 2000),
    });
    return null;
  }

  const sid = getSessionHeader(initRes);
  if (!sid) return null;

  const notifRes = await postMcp({ jsonrpc: "2.0", method: "notifications/initialized" }, apiKey, sid);
  await notifRes.text();

  return sid;
}

function parseSubscribersFromMcpResult(result: McpToolResult | undefined): {
  subscribers: OFSubscriber[];
  has_more: boolean;
} {
  if (!result) return { subscribers: [], has_more: false };

  const firstText = result.content?.find((c) => c?.type === "text" && typeof c.text === "string")?.text;
  if (firstText) {
    try {
      const parsed = JSON.parse(firstText) as {
        subscribers?: Record<string, unknown>[];
        page?: { has_more?: boolean };
      };
      const rows = (parsed.subscribers ?? []).map((row) => parseSubscriber(row));
      return { subscribers: rows, has_more: Boolean(parsed.page?.has_more) };
    } catch {
      return { subscribers: [], has_more: false };
    }
  }

  if (result.structuredContent && typeof result.structuredContent === "object") {
    const sc = result.structuredContent as {
      subscribers?: Record<string, unknown>[];
      page?: { has_more?: boolean };
    };
    const rows = (sc.subscribers ?? []).map((row) => parseSubscriber(row));
    return { subscribers: rows, has_more: Boolean(sc.page?.has_more) };
  }

  return { subscribers: [], has_more: false };
}

export async function GET(req: Request) {
  const user = await getSessionFromCookies();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (user.role !== "admin" && user.role !== "manager" && user.role !== "chatter") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const ofUserId = searchParams.get("of_user_id")?.trim();
  if (!ofUserId) {
    return NextResponse.json({ error: "Missing of_user_id query parameter." }, { status: 400 });
  }

  const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit")) || 100));
  const offset = Math.max(0, Number(searchParams.get("offset")) || 0);

  const THE_ONLY_API_KEY = process.env.THE_ONLY_API_KEY ?? "";
  if (!THE_ONLY_API_KEY) {
    return NextResponse.json({ error: "THE_ONLY_API_KEY is not configured." }, { status: 503 });
  }

  const sessionId = await ensureMcpSession(THE_ONLY_API_KEY);

  const mcpResponse = await postMcp(
    {
      jsonrpc: "2.0",
      id: Date.now(),
      method: "tools/call",
      params: {
        name: "of_list_subscribers",
        arguments: {
          of_user_id: ofUserId,
          limit,
          offset,
          type: "all",
        },
      },
    },
    THE_ONLY_API_KEY,
    sessionId
  );

  const mcpText = await mcpResponse.text();
  let mcpData: JsonRpcResponse;
  try {
    mcpData = JSON.parse(mcpText) as JsonRpcResponse;
  } catch {
    mcpData = {};
  }

  // Temporary: log raw MCP response for debugging (truncate for log size).
  console.log(
    "[of-subscribers MCP] raw response",
    JSON.stringify({
      httpStatus: mcpResponse.status,
      sessionId: sessionId ?? "(none)",
      body: mcpData,
      bodyTextFallback: mcpText.length > 12000 ? `${mcpText.slice(0, 12000)}…` : mcpText,
    })
  );

  if (!mcpResponse.ok) {
    return NextResponse.json(
      { error: `TheOnlyAPI MCP HTTP ${mcpResponse.status}`, detail: mcpData.error ?? mcpText.slice(0, 500) },
      { status: 502 }
    );
  }

  if (mcpData.error) {
    return NextResponse.json(
      { error: mcpData.error.message ?? "MCP error", detail: mcpData.error },
      { status: 502 }
    );
  }

  const { subscribers, has_more } = parseSubscribersFromMcpResult(mcpData.result);

  const withCategory = subscribers.map((sub) => ({
    ...sub,
    category: categorizeSubscriber(sub),
  }));

  return NextResponse.json({ subscribers: withCategory, has_more });
}
