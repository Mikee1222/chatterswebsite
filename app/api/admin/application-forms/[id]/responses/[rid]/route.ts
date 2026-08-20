import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { isApplicationResponseStatus } from "@/lib/application-forms-types";
import {
  applicationResponseEntityId,
  applicationStatusChangedCopy,
  candidateDisplayNameFromAnswers,
} from "@/lib/application-notifications";
import {
  NOTIFICATION_ENTITY,
  NOTIFICATION_EVENT,
  NOTIFICATION_PRIORITY,
} from "@/lib/notification-types";
import {
  getApplicationFormById,
  getResponseDetail,
  updateResponse,
} from "@/services/application-forms";
import { notifyAdmins } from "@/services/notification-service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string; rid: string }> };

/** GET /api/admin/application-forms/[id]/responses/[rid] */
export async function GET(_request: Request, ctx: Ctx) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, PERMISSIONS.APPLICATIONS_VIEW))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { rid } = await ctx.params;
  try {
    const response = await getResponseDetail(rid);
    if (!response) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ response });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to load response";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/** PATCH /api/admin/application-forms/[id]/responses/[rid] */
export async function PATCH(request: Request, ctx: Ctx) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, PERMISSIONS.APPLICATIONS_MANAGE))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: formId, rid } = await ctx.params;
  const body = (await request.json().catch(() => null)) as {
    status?: string;
    internal_notes?: string | null;
  } | null;

  try {
    const nextStatus =
      body?.status && isApplicationResponseStatus(body.status) ? body.status : undefined;
    const before =
      nextStatus !== undefined ? await getResponseDetail(rid).catch(() => null) : null;

    const response = await updateResponse(rid, {
      status: nextStatus,
      internal_notes: body?.internal_notes,
    });

    if (nextStatus && before && before.status !== nextStatus) {
      const form =
        (await getApplicationFormById(formId).catch(() => null)) ??
        (await getApplicationFormById(before.form_id).catch(() => null));
      const candidateName = candidateDisplayNameFromAnswers(before.answers);
      const statusCopy = applicationStatusChangedCopy(
        candidateName,
        form?.title ?? "Application form",
        nextStatus,
      );
      await notifyAdmins({
        event_type: NOTIFICATION_EVENT.APPLICATION_STATUS_CHANGED,
        priority:
          nextStatus === "hired" ? NOTIFICATION_PRIORITY.HIGH : NOTIFICATION_PRIORITY.NORMAL,
        title: statusCopy.title,
        body: statusCopy.body,
        entity_type: NOTIFICATION_ENTITY.APPLICATION_FORM_RESPONSE,
        entity_id: applicationResponseEntityId(before.form_id || formId, response.id),
        actor_user_id: session.airtableUserId ?? session.id,
        actor_name: session.fullName ?? undefined,
      }).catch((err) => console.error("[application_status_changed] notify failed", err));
    }

    return NextResponse.json({ response });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Update failed";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
