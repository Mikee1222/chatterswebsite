import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
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
import { getApplicationFormById, getResponseDetail } from "@/services/application-forms";
import { hireApplicationCandidate } from "@/services/application-hire";
import { notifyAdmins } from "@/services/notification-service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string; rid: string }> };

/**
 * POST /api/admin/application-forms/[id]/responses/[rid]/hire
 * Status → hired + generate (or return existing) cosmetic credentials.
 */
export async function POST(_request: Request, ctx: Ctx) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, PERMISSIONS.APPLICATIONS_MANAGE))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: formId, rid } = await ctx.params;
  try {
    const before = await getResponseDetail(rid);
    if (!before || before.form_id !== formId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const form = await getApplicationFormById(formId);
    const result = await hireApplicationCandidate({
      responseId: rid,
      formId,
      questions: form?.questions,
      actor: {
        userId: session.airtableUserId ?? session.id,
        userName: session.fullName ?? session.email ?? "Admin",
      },
    });

    if (before.status !== "hired") {
      const candidateName = candidateDisplayNameFromAnswers(before.answers);
      const statusCopy = applicationStatusChangedCopy(
        candidateName,
        form?.title ?? "Application form",
        "hired",
      );
      await notifyAdmins({
        event_type: NOTIFICATION_EVENT.APPLICATION_STATUS_CHANGED,
        priority: NOTIFICATION_PRIORITY.HIGH,
        title: statusCopy.title,
        body: statusCopy.body,
        entity_type: NOTIFICATION_ENTITY.APPLICATION_FORM_RESPONSE,
        entity_id: applicationResponseEntityId(formId, rid),
        actor_user_id: session.airtableUserId ?? session.id,
        actor_name: session.fullName ?? undefined,
      }).catch((err) => console.error("[application_status_changed] hire notify failed", err));
    }

    return NextResponse.json({
      response: result.response,
      username: result.username,
      password: result.password,
      created: result.created,
      hire_credentials_created_at: result.hire_credentials_created_at,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Hire failed";
    const status =
      msg.includes("CREDENTIALS_ENCRYPTION_KEY") || msg.includes("not configured")
        ? 503
        : 400;
    return NextResponse.json({ error: msg }, { status });
  }
}
