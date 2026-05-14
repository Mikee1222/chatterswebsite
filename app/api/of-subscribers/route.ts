import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { categorizeSubscriber, parseSubscriber } from "@/services/of-subscribers";

type SubscriberCacheData = { subscribers: unknown[]; has_more: boolean };

const subscriberCache = new Map<string, { data: SubscriberCacheData; fetchedAt: number }>();
const CACHE_TTL_MS = 30 * 60 * 1000;

const CACHE_CONTROL = "private, max-age=1800, stale-while-revalidate=300";

function jsonWithCache(body: SubscriberCacheData): NextResponse {
  return NextResponse.json(body, {
    headers: { "Cache-Control": CACHE_CONTROL },
  });
}

function buildSubscriberRows(rawSubs: unknown[]) {
  return rawSubs.map((s) => {
    const sub = parseSubscriber(s as Record<string, unknown>);
    return { ...sub, category: categorizeSubscriber(sub) };
  });
}

type CachedPayload = {
  subscribers: ReturnType<typeof buildSubscriberRows>;
  has_more: boolean;
};

function parseToolResponseToPayload(toolRaw: string): CachedPayload | null {
  try {
    const dataLine = toolRaw.split("\n").find((line) => line.startsWith("data:"));
    if (!dataLine) return null;

    const jsonStr = dataLine.slice(5).trim();
    const mcpResult = JSON.parse(jsonStr) as {
      result?: {
        content?: Array<{ type: string; text?: string }>;
        structuredContent?: unknown;
      };
    };

    const textBlock = mcpResult.result?.content?.find((c) => c.type === "text");
    if (!textBlock?.text) return null;

    const payload = JSON.parse(textBlock.text) as {
      subscribers?: unknown[];
      page?: { has_more?: boolean };
    };

    const rawSubs = payload.subscribers ?? [];
    const subscribers = buildSubscriberRows(rawSubs);
    const has_more = payload.page?.has_more ?? false;
    return { subscribers, has_more };
  } catch {
    return null;
  }
}

async function fetchSubscribersFromMcp(
  ofUserId: string,
  limit: number,
  offset: number,
  THE_ONLY_API_KEY: string
): Promise<{ ok: boolean; status: number; payload: CachedPayload | null }> {
  const MCP_URL = "https://theonlyapi.com/mcp";
  const authHeader = `Bearer ${THE_ONLY_API_KEY}`;

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
          of_user_id: ofUserId,
          limit,
          offset,
          type: "all",
        },
      },
    }),
  });

  const toolRaw = await toolRes.text();
  if (!toolRes.ok) {
    return { ok: false, status: toolRes.status, payload: null };
  }

  const payload = parseToolResponseToPayload(toolRaw);
  return {
    ok: true,
    status: toolRes.status,
    payload: payload ?? { subscribers: [], has_more: false },
  };
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
  if (!/^\d+$/.test(ofUserId)) {
    return NextResponse.json({ error: "Invalid of_user_id." }, { status: 400 });
  }

  const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit")) || 100));
  const offset = Math.max(0, Number(searchParams.get("offset")) || 0);

  const bust = searchParams.get("bust") === "1";

  const THE_ONLY_API_KEY = process.env.THE_ONLY_API_KEY ?? "";
  if (!THE_ONLY_API_KEY) {
    return NextResponse.json({ error: "THE_ONLY_API_KEY is not configured." }, { status: 503 });
  }

  const cacheKey = `${ofUserId}:${offset}`;

  if (!bust) {
    const hit = subscriberCache.get(cacheKey);
    if (hit && Date.now() - hit.fetchedAt < CACHE_TTL_MS) {
      return jsonWithCache(hit.data);
    }
  }

  const mcp = await fetchSubscribersFromMcp(ofUserId, limit, offset, THE_ONLY_API_KEY);

  if (!mcp.ok) {
    return NextResponse.json({ error: `TheOnlyAPI HTTP ${mcp.status}` }, { status: 502 });
  }

  const body: CachedPayload = mcp.payload ?? { subscribers: [], has_more: false };
  subscriberCache.set(cacheKey, { data: body, fetchedAt: Date.now() });

  return jsonWithCache(body);
}
