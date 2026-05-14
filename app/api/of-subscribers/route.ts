import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";

const MCP_URL = "https://theonlyapi.com/mcp";

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

  const res = await fetch(MCP_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${THE_ONLY_API_KEY}`,
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
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
    next: { revalidate: 0 },
  });

  console.log("[of-subscribers] status:", res.status);
  console.log("[of-subscribers] headers:", Object.fromEntries(res.headers.entries()));
  const raw = await res.text();
  console.log("[of-subscribers] raw:", raw.slice(0, 3000));

  // Parsing disabled until response shape is confirmed in logs.
  return NextResponse.json({ subscribers: [], has_more: false });
}
