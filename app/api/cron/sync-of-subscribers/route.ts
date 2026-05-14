import { NextResponse } from "next/server";
import { syncAllAccounts } from "@/services/of-sync";
import { listAllModelss } from "@/services/modelss";

export const runtime = "nodejs";

function isCronAuthorized(request: Request): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return true;
  const authHeader = request.headers.get("authorization");
  if (authHeader === `Bearer ${cronSecret}`) return true;
  const headerSecret = request.headers.get("x-cron-secret");
  if (headerSecret === cronSecret) return true;
  return false;
}

/**
 * GET /api/cron/sync-of-subscribers
 * Pulls OF subscribers for every model with `of_user_id` set into Airtable `of_subscribers`.
 */
export async function GET(request: Request) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const models = await listAllModelss();
    const accountCount = models.filter((m) => (m.of_user_id ?? "").trim() !== "").length;
    await syncAllAccounts();
    return NextResponse.json({
      success: true,
      message: `Synced ${accountCount} accounts`,
    });
  } catch (err) {
    console.error("[cron/sync-of-subscribers]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Sync failed" },
      { status: 500 }
    );
  }
}
