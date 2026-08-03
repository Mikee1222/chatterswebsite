import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { hasAnyPermission } from "@/lib/rbac";
import {
  listStoredSubscribersByAccount,
  toApiSubscriber,
} from "@/services/of-subscribers";

export const runtime = "nodejs";

const CACHE_CONTROL = "private, max-age=60, stale-while-revalidate=120";

function maxIso(dates: (string | undefined)[]): string | null {
  let best: number | null = null;
  for (const d of dates) {
    if (!d || typeof d !== "string") continue;
    const t = new Date(d).getTime();
    if (Number.isNaN(t)) continue;
    if (best === null || t > best) best = t;
  }
  return best === null ? null : new Date(best).toISOString();
}

export async function GET(req: Request) {
  const user = await getSessionFromCookies();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasAnyPermission(user, ["earnings:view", "whales:view"]))) {
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

  const limit = Math.min(1000, Math.max(1, Number(searchParams.get("limit")) || 100));
  const offset = Math.max(0, Number(searchParams.get("offset")) || 0);

  let records: Awaited<ReturnType<typeof listStoredSubscribersByAccount>> = [];
  try {
    records = await listStoredSubscribersByAccount(ofUserId);
  } catch (e) {
    console.error("[of-subscribers]", e);
    return NextResponse.json({ error: "Failed to load subscribers." }, { status: 500 });
  }

  const total = records.length;
  const page = records.slice(offset, offset + limit);
  const subscribers = page.map(toApiSubscriber);
  const has_more = offset + limit < total;
  const lastSyncedAt = maxIso(records.map((r) => r.last_synced_at));

  return NextResponse.json(
    { subscribers, has_more, total, lastSyncedAt },
    { headers: { "Cache-Control": CACHE_CONTROL } }
  );
}
