import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getModelApiContext } from "@/lib/model-context-server";
import { ROUTES } from "@/lib/routes";
import { NOTIFICATION_EVENT } from "@/lib/notification-types";
import { notify } from "@/services/notification-service";
import { getVAContentAssignmentForModel, scheduleVAContentAssignmentForModel } from "@/services/va-content-assignments";

const bodySchema = z.object({
  assignment_id: z.string().min(1),
  scheduled_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  notes: z.string().max(8000).optional(),
});

function scheduledIsoFromDateOnly(dateStr: string): string {
  return `${dateStr}T12:00:00.000Z`;
}

export async function POST(request: Request) {
  const ctx = await getModelApiContext();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

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

  const { assignment_id, scheduled_date, notes } = parsed.data;
  const scheduled_iso = scheduledIsoFromDateOnly(scheduled_date);

  const before = await getVAContentAssignmentForModel(assignment_id, ctx.linkedModelId);
  if (!before || before.status !== "pending") {
    return NextResponse.json({ error: "Assignment not found or not pending." }, { status: 404 });
  }

  const updated = await scheduleVAContentAssignmentForModel(assignment_id, ctx.linkedModelId, {
    scheduled_date_iso: scheduled_iso,
    notes,
  });

  if (!updated) {
    return NextResponse.json({ error: "Could not update assignment." }, { status: 500 });
  }

  const modelName = ctx.modelRecord.model_name || ctx.user.fullName || "Model";
  const dateLabel = scheduled_date;
  if (before.va_id) {
    const title =
      ctx.language === "es" ? "Entrega de contenido programada" : "Content delivery scheduled";
    const body =
      ctx.language === "es"
        ? `${modelName} programó «${updated.title}» para el ${dateLabel}.`
        : `${modelName} scheduled “${updated.title}” for ${dateLabel}.`;
    await notify({
      user_id: before.va_id,
      event_type: NOTIFICATION_EVENT.MODEL_CONTENT_SCHEDULED,
      title,
      body,
      entity_type: "va_content_assignment",
      entity_id: assignment_id,
      actor_user_id: ctx.user.airtableUserId ?? ctx.user.id,
      actor_name: modelName,
      _triggerSource: "model_va_content_schedule",
    });
  }

  revalidatePath(ROUTES.model.contentAssignments);
  revalidatePath(ROUTES.model.home);
  return NextResponse.json({ success: true, assignment: updated });
}
