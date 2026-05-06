import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSessionFromCookies } from "@/lib/auth";
import { ROUTES } from "@/lib/routes";
import { NOTIFICATION_EVENT, NOTIFICATION_PRIORITY } from "@/lib/notification-types";
import { notify } from "@/services/notification-service";
import { cancelVAContentAssignment, getVAContentAssignmentById } from "@/services/va-content-assignments";
import { getActiveModelUserAirtableIdByLinkedModelRecordId } from "@/services/users";

const bodySchema = z.object({
  assignment_id: z.string().trim().min(1),
  reason: z.string().trim().min(3).max(1000),
});

export async function POST(req: Request) {
  const session = await getSessionFromCookies();
  if (!session || (session.role !== "admin" && session.role !== "manager")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues.map((i) => i.message).join(" ") }, { status: 400 });
  }

  const current = await getVAContentAssignmentById(parsed.data.assignment_id);
  if (!current) return NextResponse.json({ error: "Assignment not found" }, { status: 404 });

  const actor = (session.fullName ?? "Admin").trim();
  const updated = await cancelVAContentAssignment(parsed.data.assignment_id, {
    reason: parsed.data.reason,
    actorLabel: actor,
  });
  if (!updated) return NextResponse.json({ error: "Unable to cancel assignment" }, { status: 400 });

  const title = updated.title.trim() || "VA content assignment";
  const body = `${title} was cancelled. Reason: ${parsed.data.reason.trim()}`;

  if (updated.va_id) {
    await notify({
      user_id: updated.va_id,
      event_type: NOTIFICATION_EVENT.VA_CONTENT_ASSIGNED,
      priority: NOTIFICATION_PRIORITY.NORMAL,
      title: "VA content assignment cancelled",
      body,
      entity_type: "va_content_assignment",
      entity_id: updated.id,
      actor_user_id: session.airtableUserId ?? session.id,
      actor_name: actor,
    }).catch(() => {});
  }

  const modelUserId = await getActiveModelUserAirtableIdByLinkedModelRecordId(updated.model_id);
  if (modelUserId) {
    await notify({
      user_id: modelUserId,
      event_type: NOTIFICATION_EVENT.MODEL_CONTENT_SCHEDULED,
      priority: NOTIFICATION_PRIORITY.NORMAL,
      title: "VA content assignment cancelled",
      body,
      entity_type: "va_content_assignment",
      entity_id: updated.id,
      actor_user_id: session.airtableUserId ?? session.id,
      actor_name: actor,
    }).catch(() => {});
  }

  revalidatePath(ROUTES.admin.vaContentAssignments);
  revalidatePath(ROUTES.model.contentAssignments);
  revalidatePath(ROUTES.va.contentAssignments);
  return NextResponse.json({ ok: true });
}
