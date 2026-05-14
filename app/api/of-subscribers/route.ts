import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { listAllRecords, type AirtableRecord } from "@/lib/airtable-server";
import { OF_SUBSCRIBERS_TABLE } from "@/lib/airtable-schema";
import {
  categorizeSubscriber,
  parseSubscriber,
  type OFSubscriberCategory,
} from "@/services/of-subscribers";

export const runtime = "nodejs";

const CACHE_CONTROL = "private, max-age=60, stale-while-revalidate=120";

type RowFields = {
  of_user_id?: number;
  of_account_id?: string;
  display_name?: string;
  username?: string;
  subscribed_at?: string;
  expires_at?: string;
  total_spent?: number;
  category?: string;
  last_synced_at?: string;
};

function escapeFormulaString(s: string): string {
  return s.replace(/"/g, '""');
}

function mapRecord(rec: AirtableRecord<RowFields>) {
  const f = rec.fields;
  const sub = parseSubscriber({
    of_user_id: f.of_user_id,
    username: f.username,
    display_name: f.display_name,
    subscribed_at: f.subscribed_at,
    expires_at: f.expires_at,
    total_spent: f.total_spent,
  });
  const cat = (f.category as OFSubscriberCategory | undefined) ?? categorizeSubscriber(sub);
  return { ...sub, category: cat };
}

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

  const limit = Math.min(1000, Math.max(1, Number(searchParams.get("limit")) || 100));
  const offset = Math.max(0, Number(searchParams.get("offset")) || 0);

  const esc = escapeFormulaString(ofUserId);
  const filterByFormula = `{of_account_id} = "${esc}"`;

  let records: AirtableRecord<RowFields>[] = [];
  try {
    records = await listAllRecords<RowFields>(OF_SUBSCRIBERS_TABLE, {
      filterByFormula,
      sort: [{ field: "total_spent", direction: "desc" }],
      _caller: "of-subscribers-get",
    });
  } catch (e) {
    console.error("[of-subscribers]", e);
    return NextResponse.json({ error: "Failed to load subscribers from Airtable." }, { status: 500 });
  }

  const total = records.length;
  const page = records.slice(offset, offset + limit);
  const subscribers = page.map(mapRecord);
  const has_more = offset + limit < total;
  const lastSyncedAt = maxIso(records.map((r) => r.fields.last_synced_at));

  return NextResponse.json(
    { subscribers, has_more, total, lastSyncedAt },
    { headers: { "Cache-Control": CACHE_CONTROL } }
  );
}
