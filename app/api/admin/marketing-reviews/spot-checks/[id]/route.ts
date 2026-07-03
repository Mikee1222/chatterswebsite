import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import {
  deleteSpotCheck,
  getSpotCheckById,
  updateSpotCheck,
  type SpotCheckStatus,
  type SpotCheckType,
} from "@/services/marketing-reviews";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, PERMISSIONS.SPOTCHECK_MANAGE))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await ctx.params;
  const spotCheck = await getSpotCheckById(id);
  if (!spotCheck) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ spotCheck });
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, PERMISSIONS.SPOTCHECK_MANAGE))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await ctx.params;
  const body = (await req.json()) as Record<string, unknown>;
  await updateSpotCheck(id, {
    type: body.type as SpotCheckType | undefined,
    exec_va_id: body.exec_va_id != null ? String(body.exec_va_id) : undefined,
    exec_va_name: body.exec_va_name != null ? String(body.exec_va_name) : undefined,
    creator_id: body.creator_id != null ? String(body.creator_id) : undefined,
    creator_name: body.creator_name != null ? String(body.creator_name) : undefined,
    what_was_wrong: body.what_was_wrong != null ? String(body.what_was_wrong) : undefined,
    action_taken: body.action_taken != null ? String(body.action_taken) : undefined,
    status: body.status as SpotCheckStatus | undefined,
    resolution_time: body.resolution_time != null ? Number(body.resolution_time) : undefined,
    subject: body.subject != null ? String(body.subject) : undefined,
  });
  const spotCheck = await getSpotCheckById(id);
  return NextResponse.json({ spotCheck });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, PERMISSIONS.SPOTCHECK_MANAGE))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await ctx.params;
  await deleteSpotCheck(id);
  return NextResponse.json({ ok: true });
}
