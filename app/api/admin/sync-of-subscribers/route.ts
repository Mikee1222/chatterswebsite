import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { syncAllAccounts, syncSubscribersForAccount } from "@/services/of-sync";

export const runtime = "nodejs";

/**
 * POST /api/admin/sync-of-subscribers
 * Body (optional): `{ "ofAccountId": "<digits>", "modelName": "..." }` — sync one account; omit to sync all models with OF id.
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
  const b = body as { ofAccountId?: string; modelName?: string };
  const ofAccountId = b.ofAccountId?.trim();
  const modelName = b.modelName?.trim();

  if (ofAccountId) {
    if (!/^\d+$/.test(ofAccountId)) {
      return NextResponse.json({ error: "ofAccountId must be numeric OF account id." }, { status: 400 });
    }
    const r = await syncSubscribersForAccount(ofAccountId, modelName ?? "");
    return NextResponse.json({
      success: true,
      synced: r.synced,
      errors: r.errors,
    });
  }

  await syncAllAccounts();
  return NextResponse.json({ success: true });
}
