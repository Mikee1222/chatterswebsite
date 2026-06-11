import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireClientModelAccess } from "@/lib/client-content-auth";
import { ROUTES } from "@/lib/routes";
import { NOTIFICATION_EVENT, NOTIFICATION_PRIORITY } from "@/lib/notification-types";
import { notifyByRoleConfig } from "@/services/notification-service";
import { getModelById } from "@/services/modelss";
import { getActiveModelUserAirtableIdByLinkedModelRecordId } from "@/services/users";
import {
  getVAContentAssignmentForModel,
  scheduleVAContentAssignmentForModel,
} from "@/services/va-content-assignments";

const bodySchema = z.object({
  assignment_id: z.string().min(1),
  model_id: z.string().min(1),
  scheduled_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  notes: z.string().max(8000).optional(),
});

function scheduledIsoFromDateOnly(dateStr: string): string {
  return `${dateStr}T12:00:00.000Z`;
}

export async function POST(request: Request) {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const { assignment_id, model_id, scheduled_date, notes } = parsed.data;
  const access = await requireClientModelAccess(model_id);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const modelRecord = await getModelById(model_id).catch(() => null);
  const stable = modelRecord?.model_id?.trim() || null;
  const before = await getVAContentAssignmentForModel(assignment_id, model_id, stable);
  if (!before || before.status !== "pending") {
    return NextResponse.json({ error: "Assignment not found or not pending." }, { status: 404 });
  }

  const scheduled_iso = scheduledIsoFromDateOnly(scheduled_date);
  const updated = await scheduleVAContentAssignmentForModel(
    assignment_id,
    model_id,
    { scheduled_date_iso: scheduled_iso, notes },
    stable,
  );

  if (!updated) {
    return NextResponse.json({ error: "Could not update assignment." }, { status: 500 });
  }

  const modelName = modelRecord?.model_name?.trim() || "Model";
  const dateLabel = scheduled_date;
  const modelUserId = await getActiveModelUserAirtableIdByLinkedModelRecordId(model_id);
  if (modelUserId) {
    const title = "Content delivery scheduled";
    const body = `${access.actorName} scheduled “${updated.title}” for ${modelName} on ${dateLabel}.`;
    await notifyByRoleConfig(NOTIFICATION_EVENT.VA_CONTENT_SCHEDULED, {
      personal_user_id: modelUserId,
      priority: NOTIFICATION_PRIORITY.NORMAL,
      title,
      body,
      entity_type: "va_content_assignment",
      entity_id: assignment_id,
      actor_name: access.actorName,
    }).catch(() => {});
  }

  revalidatePath(ROUTES.client.content);
  return NextResponse.json({ success: true, assignment: updated });
}
