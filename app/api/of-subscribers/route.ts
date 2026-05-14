import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { categorizeSubscriber, parseSubscriber } from "@/services/of-subscribers";

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
  if (!/^\d+$/.test(ofUserId)) {
    return NextResponse.json({ error: "Invalid of_user_id." }, { status: 400 });
  }

  const ofUserIdNum = parseInt(ofUserId, 10);

  const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit")) || 100));
  const offset = Math.max(0, Number(searchParams.get("offset")) || 0);

  const THE_ONLY_API_KEY = process.env.THE_ONLY_API_KEY ?? "";
  if (!THE_ONLY_API_KEY) {
    return NextResponse.json({ error: "THE_ONLY_API_KEY is not configured." }, { status: 503 });
  }

  const MCP_URL = "https://theonlyapi.com/mcp";
  const authHeader = `Bearer ${THE_ONLY_API_KEY}`;

  // STEP 1: initialize
  const initRes = await fetch(MCP_URL, {
    method: "POST",
    headers: {
      Authorization: authHeader,
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: { name: "gunzo-dashboard", version: "1.0.0" },
      },
    }),
  });

  const sessionId =
    initRes.headers.get("mcp-session-id") ??
    initRes.headers.get("Mcp-Session-Id") ??
    initRes.headers.get("MCP-Session-Id") ??
    "";

  await initRes.text();

  // STEP 2: notifications/initialized (no id, fire and forget)
  if (sessionId) {
    await fetch(MCP_URL, {
      method: "POST",
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
        "mcp-session-id": sessionId,
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "notifications/initialized",
      }),
    }).catch(() => {});
  }

  // STEP 3: tools/call
  const toolRes = await fetch(MCP_URL, {
    method: "POST",
    headers: {
      Authorization: authHeader,
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      ...(sessionId ? { "mcp-session-id": sessionId } : {}),
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: {
        name: "of_list_subscribers",
        arguments: {
          of_user_id: ofUserIdNum,
          limit,
          offset,
          type: "all",
        },
      },
    }),
  });

  const toolRaw = await toolRes.text();

  if (!toolRes.ok) {
    return NextResponse.json({ error: `TheOnlyAPI HTTP ${toolRes.status}` }, { status: 502 });
  }

  try {
    const dataLine = toolRaw.split("\n").find((line) => line.startsWith("data:"));
    if (!dataLine) {
      return NextResponse.json({ subscribers: [], has_more: false });
    }

    const jsonStr = dataLine.slice(5).trim();
    const mcpResult = JSON.parse(jsonStr) as {
      result?: {
        content?: Array<{ type: string; text?: string }>;
        structuredContent?: unknown;
      };
    };

    const textBlock = mcpResult.result?.content?.find((c) => c.type === "text");
    if (!textBlock?.text) {
      return NextResponse.json({ subscribers: [], has_more: false });
    }

    const payload = JSON.parse(textBlock.text) as {
      subscribers?: unknown[];
      page?: { has_more?: boolean };
    };

    const rawSubs = payload.subscribers ?? [];
    const subscribers = rawSubs.map((s) => {
      const sub = parseSubscriber(s as Record<string, unknown>);
      return { ...sub, category: categorizeSubscriber(sub) };
    });

    const hasMore = payload.page?.has_more ?? false;

    return NextResponse.json({ subscribers, has_more: hasMore });
  } catch {
    return NextResponse.json({ subscribers: [], has_more: false });
  }
}
