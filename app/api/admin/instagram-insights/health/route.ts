import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import {
  formatClarioSuiteUserMessage,
  getClarioSuiteMe,
  isClarioSuiteConfigured,
  listClarioSuiteAccounts,
} from "@/lib/clariosuite-api";
import {
  buildClarioSuiteOutageMessage,
  clearClarioSuiteOutage,
  getClarioSuiteDataAsOfIso,
  getClarioSuiteOutageState,
  recordClarioSuiteOutage,
} from "@/services/clariosuite-outage";
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
  let outageSince: string | null = null;
  let dataAsOf: string | null = null;
  let outageMessage: string | null = null;

  if (configured) {
    dataAsOf = await getClarioSuiteDataAsOfIso();
    try {
      me = await getClarioSuiteMe();
    } catch (err) {
      meError = formatClarioSuiteUserMessage(err);
      const state = await recordClarioSuiteOutage(err);
      outageSince = state.startedAt;
      outageMessage = await buildClarioSuiteOutageMessage(state);
    }
    // Only list accounts when /me succeeded — avoid hammering during outages.
    if (me) {
      try {
        const accounts = await listClarioSuiteAccounts();
        accountsCount = accounts.length;
        await clearClarioSuiteOutage().catch(() => undefined);
      } catch (err) {
        accountsError = formatClarioSuiteUserMessage(err);
        const state = await recordClarioSuiteOutage(err);
        outageSince = state.startedAt;
        outageMessage = await buildClarioSuiteOutageMessage(state);
      }
    } else {
      const existing = await getClarioSuiteOutageState();
      outageSince = existing?.startedAt ?? outageSince;
      if (!outageMessage) outageMessage = await buildClarioSuiteOutageMessage(existing);
    }
  }

  const [allModels, linked] = await Promise.all([
    listAllModelss().catch(() => []),
    listLinkedClarioSuiteModels().catch(() => []),
  ]);

  const unavailable = Boolean(meError || accountsError || outageSince);

  return NextResponse.json({
    configured,
    healthy: Boolean(me) && !accountsError,
    me,
    meError: configured ? meError : "CLARIOSUITE_API_KEY not set",
    accountsCount,
    accountsError,
    outageSince,
    dataAsOf,
    outageMessage,
    emptyReason: !configured
      ? ("missing_api_key" as const)
      : unavailable
        ? ("api_error" as const)
        : accountsCount === 0
          ? ("no_ig_accounts" as const)
          : null,
    message: !configured
      ? "API key not configured. Set CLARIOSUITE_API_KEY in Vercel Production."
      : outageMessage
        ? outageMessage
        : meError
          ? meError
          : accountsError
            ? accountsError
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
