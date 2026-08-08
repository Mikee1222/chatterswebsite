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
      {
        error: "API key not configured",
        code: "missing_api_key",
        accounts: [],
        count: 0,
        configured: false,
        emptyReason: "missing_api_key" as const,
        message:
          "API key not configured. Set CLARIOSUITE_API_KEY in Vercel (Production) and redeploy.",
      },
      { status: 503 }
    );
  }

  try {
    const accounts = await listClarioSuiteAccounts();
    const empty = accounts.length === 0;
    return NextResponse.json({
      accounts,
      count: accounts.length,
      configured: true,
      emptyReason: empty ? ("no_ig_accounts" as const) : null,
      message: empty
        ? "No IG accounts — connect Instagram accounts in the ClarioSuite dashboard first, then refresh."
        : null,
    });
  } catch (err) {
    console.error("[admin/clariosuite-accounts]", err);
    if (err instanceof ClarioSuiteApiError) {
      const status = err.status >= 400 && err.status < 600 ? err.status : 502;
      return NextResponse.json(
        {
          error: err.message,
          code: err.code,
          accounts: [],
          count: 0,
          configured: true,
          emptyReason: "api_error" as const,
          message: err.message,
        },
        { status }
      );
    }
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "Failed to fetch ClarioSuite accounts",
        accounts: [],
        count: 0,
        configured: true,
        emptyReason: "api_error" as const,
      },
      { status: 500 }
    );
  }
}
