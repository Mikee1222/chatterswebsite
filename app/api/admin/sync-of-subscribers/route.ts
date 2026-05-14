import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { syncAllAccounts, syncSubscribersChunkForAccount } from "@/services/of-sync";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * POST /api/admin/sync-of-subscribers
 * - With `{ ofAccountId, modelName, offset? }`: sync one MCP page (100 rows) at `offset`, upsert to Airtable.
 * - Without `ofAccountId`: sync all models (full sync per account; cron-style).
 */
export async function POST(req: Request) {
  const session = await getSessionFromCookies();
  if (!session || (session.role !== "admin" && session.role !== "manager")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json().catch(() => ({}));
  } catch {
    body = {};
  }
  const b = body as { ofAccountId?: string; modelName?: string; offset?: number };
  const ofAccountId = b.ofAccountId?.trim();
  const modelName = b.modelName?.trim();
  const offsetRaw = b.offset;
  const offset =
    typeof offsetRaw === "number" && Number.isFinite(offsetRaw) && offsetRaw >= 0
      ? Math.floor(offsetRaw)
      : 0;

  if (ofAccountId) {
    if (!/^\d+$/.test(ofAccountId)) {
      return NextResponse.json({ error: "ofAccountId must be numeric OF account id." }, { status: 400 });
    }
    const r = await syncSubscribersChunkForAccount(ofAccountId, modelName ?? "", offset);
    return NextResponse.json({
      success: true,
      synced: r.synced,
      errors: r.errors,
      has_more: r.has_more,
      next_offset: r.next_offset,
    });
  }

  await syncAllAccounts();
  return NextResponse.json({ success: true });
}
