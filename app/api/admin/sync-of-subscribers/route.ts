import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { syncAllAccounts, syncSubscribersChunkForAccount } from "@/services/of-sync";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * POST /api/admin/sync-of-subscribers
 * - With `{ ofAccountId, modelName, offset?, highValueOnly? }`: one MCP page; upsert only rows with total_spent ≥ 10 (or ≥ 500 if highValueOnly).
 * - Without `ofAccountId`: sync all models (full sync per account; cron-style).
 */
export async function POST(req: Request) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, "earnings:view"))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: unknown;
  try {
    body = await req.json().catch(() => ({}));
  } catch {
    body = {};
  }
  const b = body as { ofAccountId?: string; modelName?: string; offset?: number; highValueOnly?: boolean };
  const ofAccountId = b.ofAccountId?.trim();
  const modelName = b.modelName?.trim();
  const highValueOnly = b.highValueOnly === true;
  const offsetRaw = b.offset;
  const offset =
    typeof offsetRaw === "number" && Number.isFinite(offsetRaw) && offsetRaw >= 0
      ? Math.floor(offsetRaw)
      : 0;

  if (ofAccountId) {
    if (!/^\d+$/.test(ofAccountId)) {
      return NextResponse.json({ error: "ofAccountId must be numeric OF account id." }, { status: 400 });
    }
    const result = await syncSubscribersChunkForAccount(ofAccountId, modelName ?? "", offset, { highValueOnly });
    return NextResponse.json({
      success: true,
      synced: result.synced,
      checked: result.checked,
      errors: result.errors,
      has_more: result.has_more,
      next_offset: result.next_offset,
    });
  }

  await syncAllAccounts();
  return NextResponse.json({ success: true });
}
