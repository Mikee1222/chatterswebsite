import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { ROUTES } from "@/lib/routes";
import {
  deleteFilmingScheduleEntry,
  updateFilmingScheduleEntry,
} from "@/services/filming";

function revalidateFilmingSchedulePaths() {
  revalidatePath(ROUTES.model.contentCalendar);
  revalidatePath(ROUTES.model.schedule);
  revalidatePath(ROUTES.filmingCalendar);
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, PERMISSIONS.FILMING_MANAGE))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await ctx.params;
  const body = (await req.json()) as Record<string, unknown>;
  try {
    const entry = await updateFilmingScheduleEntry(
      id,
      {
        schedule_date: body.schedule_date !== undefined ? String(body.schedule_date) : undefined,
        start_time: body.start_time !== undefined ? String(body.start_time) : undefined,
        end_time: body.end_time !== undefined ? String(body.end_time) : undefined,
        model_id: body.model_id !== undefined ? String(body.model_id) : undefined,
        model_name: body.model_name !== undefined ? String(body.model_name) : undefined,
        location: body.location !== undefined ? String(body.location) : undefined,
        notes: body.notes !== undefined ? String(body.notes) : undefined,
      },
      session.airtableUserId ?? session.id,
    );
    revalidateFilmingSchedulePaths();
    return NextResponse.json({ entry });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed" },
      { status: 400 },
    );
  }
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, PERMISSIONS.FILMING_MANAGE))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await ctx.params;
  try {
    await deleteFilmingScheduleEntry(id);
    revalidateFilmingSchedulePaths();
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed" },
      { status: 400 },
    );
  }
}
