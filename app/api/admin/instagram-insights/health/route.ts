import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import {
  ClarioSuiteApiError,
  getClarioSuiteMe,
  isClarioSuiteConfigured,
} from "@/lib/clariosuite-api";
import { listLinkedClarioSuiteModels } from "@/services/clariosuite-sync";
import { listAllModelss } from "@/services/modelss";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/admin/instagram-insights/health
 * Connection health via GET /me + model link status.
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
    modelsTotal: allModels.length,
    modelsLinked: linked.length,
    linked: linked.map((l) => ({
      modelRecordId: l.modelRecordId,
      modelName: l.modelName,
      igUserId: l.igUserId,
    })),
  });
}
