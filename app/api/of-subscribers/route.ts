import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { categorizeSubscriber, parseSubscriber, type OFSubscriber } from "@/services/of-subscribers";

const SUBSCRIBERS_REST_URL = "https://theonlyapi.com/api/subscribers";

type UpstreamBody = {
  subscribers?: Record<string, unknown>[];
  page?: { has_more?: boolean };
};

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

  const url = new URL(SUBSCRIBERS_REST_URL);
  url.searchParams.set("of_user_id", ofUserId);
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("offset", String(offset));
  url.searchParams.set("type", "all");

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${THE_ONLY_API_KEY}`,
      Accept: "application/json",
    },
    next: { revalidate: 300 },
  });

  console.log("[of-subscribers] status:", res.status);
  const raw = await res.text();
  console.log("[of-subscribers] raw:", raw.slice(0, 2000));

  if (!res.ok) {
    return NextResponse.json(
      { error: `TheOnlyAPI HTTP ${res.status}`, detail: raw.slice(0, 500) },
      { status: 502 }
    );
  }

  let subscribers: OFSubscriber[] = [];
  let has_more = false;
  try {
    const data = JSON.parse(raw) as UpstreamBody;
    subscribers = (data.subscribers ?? []).map((row) => parseSubscriber(row));
    has_more = Boolean(data.page?.has_more);
  } catch {
    /* logged raw above */
  }

  const withCategory = subscribers.map((sub) => ({
    ...sub,
    category: categorizeSubscriber(sub),
  }));

  return NextResponse.json({ subscribers: withCategory, has_more });
}
