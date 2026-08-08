import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import {
  ClarioSuiteApiError,
  getClarioSuiteMe,
  isClarioSuiteConfigured,
  listClarioSuiteAccounts,
} from "@/lib/clariosuite-api";
import { listLinkedClarioSuiteModels } from "@/services/clariosuite-sync";
import { listAllModelss } from "@/services/modelss";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/admin/instagram-insights/health
 * Connection health via GET /me + accessible accounts + model link status.
 */
export async function GET() {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, PERMISSIONS.INSTAGRAM_INSIGHTS_VIEW))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const configured = isClarioSuiteConfigured();
  let me: Awaited<ReturnType<typeof getClarioSuiteMe>> | null = null;
  let meError: string | null = null;
  let accountsCount: number | null = null;
  let accountsError: string | null = null;
  if (configured) {
    try {
      me = await getClarioSuiteMe();
    } catch (err) {
      meError =
        err instanceof ClarioSuiteApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Failed to verify API key";
    }
    try {
      const accounts = await listClarioSuiteAccounts();
      accountsCount = accounts.length;
    } catch (err) {
      accountsError =
        err instanceof ClarioSuiteApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Failed to list ClarioSuite accounts";
    }
  }

  const [allModels, linked] = await Promise.all([
    listAllModelss().catch(() => []),
    listLinkedClarioSuiteModels().catch(() => []),
  ]);

  return NextResponse.json({
    configured,
    healthy: Boolean(me),
    me,
    meError: configured ? meError : "CLARIOSUITE_API_KEY not set",
    accountsCount,
    accountsError,
    emptyReason: !configured
      ? ("missing_api_key" as const)
      : meError
        ? ("api_error" as const)
        : accountsCount === 0
          ? ("no_ig_accounts" as const)
          : null,
    message: !configured
      ? "API key not configured. Set CLARIOSUITE_API_KEY in Vercel Production."
      : meError
        ? meError
        : accountsCount === 0
          ? "No IG accounts — connect Instagram accounts in the ClarioSuite dashboard first."
          : null,
    modelsTotal: allModels.length,
    modelsLinked: linked.length,
    linked: linked.map((l) => ({
      modelRecordId: l.modelRecordId,
      modelName: l.modelName,
      igUserId: l.igUserId,
    })),
  });
}
