import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionFromCookies } from "@/lib/auth";
import { NOTIFICATION_EVENT, NOTIFICATION_PRIORITY } from "@/lib/notification-types";
import { notify } from "@/services/notification-service";
import { getVAContentAssignmentById } from "@/services/va-content-assignments";
import { getActiveModelUserAirtableIdByLinkedModelRecordId } from "@/services/users";

const bodySchema = z.object({
  assignment_id: z.string().trim().min(1),
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

  const assignment = await getVAContentAssignmentById(parsed.data.assignment_id);
  if (!assignment) return NextResponse.json({ error: "Assignment not found" }, { status: 404 });

  const st = (assignment.status ?? "").trim().toLowerCase();
  if (st !== "pending") {
    return NextResponse.json(
      { error: "Reminders are only sent for assignments awaiting the model (pending)." },
      { status: 400 }
    );
  }

  const modelUserId = await getActiveModelUserAirtableIdByLinkedModelRecordId(assignment.model_id);
  if (!modelUserId) {
    return NextResponse.json({ error: "No active model account linked to assignment" }, { status: 400 });
  }

  const title = assignment.title.trim() || "VA content assignment";
  await notify({
    user_id: modelUserId,
    event_type: NOTIFICATION_EVENT.VA_CONTENT_ASSIGNED,
    priority: NOTIFICATION_PRIORITY.NORMAL,
    title: "Reminder: pending VA content assignment",
    body: `${title} — please review your VA content assignments.`,
    entity_type: "va_content_assignment",
    entity_id: assignment.id,
    actor_user_id: session.airtableUserId ?? session.id,
    actor_name: session.fullName ?? "Admin",
  }).catch(() => {});

  return NextResponse.json({ ok: true });
}
