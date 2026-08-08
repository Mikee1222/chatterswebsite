import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import {
  filterSpotChecksByManager,
  spotCheckManagerId,
  spotCheckManagerName,
} from "@/lib/marketing-reviews-helpers";
import {
  createSpotCheck,
  getSpotChecks,
  type SpotCheckStatus,
  type SpotCheckType,
} from "@/services/marketing-reviews";

export async function GET(req: Request) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, PERMISSIONS.SPOTCHECK_SUBMIT))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const managerId = spotCheckManagerId(session);
  const managerName = spotCheckManagerName(session);
  const status = url.searchParams.get("status") as SpotCheckStatus | null;
  const dateFrom = url.searchParams.get("date_from");
  const dateTo = url.searchParams.get("date_to");

  const all = await getSpotChecks({
    manager_id: managerId,
    ...(status ? { status } : {}),
    ...(dateFrom ? { date_from: dateFrom } : {}),
    ...(dateTo ? { date_to: dateTo } : {}),
  });
  // Defense-in-depth: also filter by ownership for legacy rows missing manager_id.
  const spotChecks = filterSpotChecksByManager(all, managerName, managerId);
  return NextResponse.json({ spotChecks });
}

export async function POST(req: Request) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, PERMISSIONS.SPOTCHECK_SUBMIT))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json()) as Record<string, unknown>;
  const execVaId = String(body.exec_va_id ?? "").trim();
  const creatorId = String(body.creator_id ?? "").trim();
  if (!execVaId || !creatorId) {
    return NextResponse.json(
      { error: "Exec/VA and Creator are required" },
      { status: 400 },
    );
  }

  const spotCheck = await createSpotCheck({
    manager_name: spotCheckManagerName(session),
    manager_id: spotCheckManagerId(session),
    type: body.type as SpotCheckType | undefined,
    exec_va_id: execVaId,
    exec_va_name: String(body.exec_va_name ?? ""),
    creator_id: creatorId,
    creator_name: String(body.creator_name ?? ""),
    what_was_wrong: String(body.what_was_wrong ?? ""),
    action_taken: String(body.action_taken ?? ""),
    status: (body.status as SpotCheckStatus | undefined) ?? "Pending",
    subject: body.subject != null ? String(body.subject) : undefined,
  });
  return NextResponse.json({ spotCheck });
}
