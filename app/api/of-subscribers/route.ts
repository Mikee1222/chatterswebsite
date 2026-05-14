import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";

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

  const initRaw = await initRes.text();
  console.log("[of-subscribers] init status:", initRes.status);
  console.log("[of-subscribers] session:", sessionId);
  console.log("[of-subscribers] init raw:", initRaw.slice(0, 500));

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
          of_user_id: ofUserId,
          limit,
          offset,
          type: "all",
        },
      },
    }),
  });

  const toolRaw = await toolRes.text();
  console.log("[of-subscribers] tool status:", toolRes.status);
  console.log("[of-subscribers] tool raw:", toolRaw.slice(0, 3000));

  // Return empty for now until we confirm the shape
  return NextResponse.json({ subscribers: [], has_more: false });
}
