import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
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
    type: (url.searchParams.get("type") as SpotCheckType | null) ?? undefined,
    status: (url.searchParams.get("status") as SpotCheckStatus | null) ?? undefined,
    date_from: url.searchParams.get("date_from") ?? undefined,
    date_to: url.searchParams.get("date_to") ?? undefined,
  };

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
  const managerName = session.fullName?.trim() || session.email?.trim() || "Manager";
  const spotCheck = await createSpotCheck({
    manager_name: managerName,
    type: body.type as SpotCheckType | undefined,
    exec_va_id: String(body.exec_va_id ?? ""),
    exec_va_name: String(body.exec_va_name ?? ""),
    creator_id: String(body.creator_id ?? ""),
    creator_name: String(body.creator_name ?? ""),
    what_was_wrong: String(body.what_was_wrong ?? ""),
    action_taken: String(body.action_taken ?? ""),
    status: (body.status as SpotCheckStatus | undefined) ?? "Pending",
    subject: body.subject != null ? String(body.subject) : undefined,
    resolution_time: body.resolution_time != null ? Number(body.resolution_time) : undefined,
  });
  return NextResponse.json({ spotCheck });
}
