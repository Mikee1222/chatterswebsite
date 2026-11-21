import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { hasAnyPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import {
  listModelTopFans,
  type TopFansPeriodDays,
} from "@/services/model-top-fans";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const CACHE_CONTROL = "private, max-age=30, stale-while-revalidate=60";

function parsePeriod(raw: string | null): TopFansPeriodDays {
  if (raw === "all" || raw === "7" || raw === "30" || raw === "90") {
    return raw === "all" ? "all" : (Number(raw) as 7 | 30 | 90);
  }
  return 30;
}

/**
 * GET /api/admin/models/[id]/top-fans
 * Fan-level revenue aggregates from infloww_transactions for this model.
 * Permissions match the former OnlyFans Subscribers tab.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionFromCookies();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (
    !(await hasAnyPermission(user, [
      PERMISSIONS.EARNINGS_VIEW,
      PERMISSIONS.WHALES_VIEW_ALL,
      PERMISSIONS.WHALES_MANAGE,
    ]))
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const modelId = id?.trim();
  if (!modelId) {
    return NextResponse.json({ error: "Missing model id." }, { status: 400 });
  }

  const { searchParams } = new URL(request.url);
  const periodDays = parsePeriod(searchParams.get("period"));
  const search = searchParams.get("search")?.trim() || undefined;
  const inactiveOnly = searchParams.get("inactive") === "1" || searchParams.get("inactive") === "true";
  const inactiveMinNetRaw = Number(searchParams.get("inactive_min_net"));
  const inactiveMinNet = Number.isFinite(inactiveMinNetRaw) ? inactiveMinNetRaw : 100;
  const limit = Math.min(500, Math.max(1, Number(searchParams.get("limit")) || 100));
  const offset = Math.max(0, Number(searchParams.get("offset")) || 0);

  try {
    const result = await listModelTopFans({
      modelId,
      periodDays,
      search,
      inactiveOnly,
      inactiveMinNet,
      limit,
      offset,
    });
    return NextResponse.json(result, { headers: { "Cache-Control": CACHE_CONTROL } });
  } catch (e) {
    console.error("[top-fans]", e);
    const message = e instanceof Error ? e.message : "Failed to load top fans.";
    const status = /RPC is not installed/i.test(message) ? 503 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
