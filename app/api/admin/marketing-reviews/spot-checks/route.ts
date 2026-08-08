import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { spotCheckManagerId, spotCheckManagerName } from "@/lib/marketing-reviews-helpers";
import {
  createSpotCheck,
  getSpotChecks,
  type SpotCheckFilters,
  type SpotCheckStatus,
  type SpotCheckType,
} from "@/services/marketing-reviews";

export async function GET(req: Request) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, PERMISSIONS.SPOTCHECK_MANAGE))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const filters: SpotCheckFilters = {
    exec_va_id: url.searchParams.get("exec_va_id") ?? undefined,
    creator_id: url.searchParams.get("creator_id") ?? undefined,
    manager_id: url.searchParams.get("manager_id") ?? undefined,
    manager_name: url.searchParams.get("manager_name") ?? undefined,
    type: (url.searchParams.get("type") as SpotCheckType | null) ?? undefined,
    status: (url.searchParams.get("status") as SpotCheckStatus | null) ?? undefined,
    date_from: url.searchParams.get("date_from") ?? undefined,
    date_to: url.searchParams.get("date_to") ?? undefined,
  };
  const hasAttachment = url.searchParams.get("has_attachment");
  if (hasAttachment === "true") filters.has_attachment = true;
  if (hasAttachment === "false") filters.has_attachment = false;
  if (url.searchParams.get("unresolved_only") === "true") filters.unresolved_only = true;
  const minAge = url.searchParams.get("min_unresolved_age_hours");
  if (minAge != null && minAge !== "") {
    const n = Number(minAge);
    if (Number.isFinite(n)) filters.min_unresolved_age_hours = n;
  }

  const spotChecks = await getSpotChecks(filters);
  return NextResponse.json({ spotChecks });
}

export async function POST(req: Request) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, PERMISSIONS.SPOTCHECK_MANAGE))) {
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
    resolution_time: body.resolution_time != null ? Number(body.resolution_time) : undefined,
  });
  return NextResponse.json({ spotCheck });
}
