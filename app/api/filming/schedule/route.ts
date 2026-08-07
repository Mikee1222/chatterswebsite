import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import {
  createFilmingScheduleEntry,
  listFilmingSchedule,
} from "@/services/filming";

export async function GET(req: Request) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const canView = await hasPermission(session, PERMISSIONS.FILMING_VIEW_ASSIGNMENTS);
  const canManage = await hasPermission(session, PERMISSIONS.FILMING_MANAGE);
  if (!canView && !canManage) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const fromDate = url.searchParams.get("from") ?? undefined;
  const toDate = url.searchParams.get("to") ?? undefined;
  const model_id = url.searchParams.get("model_id") ?? undefined;

  try {
    const entries = await listFilmingSchedule({ fromDate, toDate, model_id });
    return NextResponse.json({ entries, canManage });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed" },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, PERMISSIONS.FILMING_MANAGE))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json()) as Record<string, unknown>;
  try {
    const entry = await createFilmingScheduleEntry({
      schedule_date: String(body.schedule_date ?? ""),
      start_time: String(body.start_time ?? ""),
      end_time: String(body.end_time ?? ""),
      model_id: String(body.model_id ?? ""),
      model_name: String(body.model_name ?? ""),
      location: String(body.location ?? ""),
      notes: String(body.notes ?? ""),
      created_by_id: session.airtableUserId ?? session.id,
      created_by_name: (session.fullName || session.email || "").trim(),
    });
    return NextResponse.json({ entry });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed" },
      { status: 400 },
    );
  }
}
