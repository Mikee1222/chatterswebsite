import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import {
  ClarioSuiteApiError,
  isClarioSuiteConfigured,
  listClarioSuiteAccounts,
} from "@/lib/clariosuite-api";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/admin/clariosuite-accounts
 * Live ClarioSuite IG account list for linking modelss.clariosuite_ig_user_id.
 */
export async function GET() {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, PERMISSIONS.INSTAGRAM_INSIGHTS_VIEW))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!isClarioSuiteConfigured()) {
    return NextResponse.json(
      { error: "ClarioSuite API key is not configured.", accounts: [], count: 0 },
      { status: 503 }
    );
  }

  try {
    const accounts = await listClarioSuiteAccounts();
    return NextResponse.json({ accounts, count: accounts.length });
  } catch (err) {
    console.error("[admin/clariosuite-accounts]", err);
    if (err instanceof ClarioSuiteApiError) {
      const status = err.status >= 400 && err.status < 600 ? err.status : 502;
      return NextResponse.json({ error: err.message, code: err.code }, { status });
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch ClarioSuite accounts" },
      { status: 500 }
    );
  }
}
