import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getModelApiContext } from "@/lib/model-context-server";
import { ROUTES } from "@/lib/routes";
import { NOTIFICATION_EVENT } from "@/lib/notification-types";
import { notify } from "@/services/notification-service";
import { completeVAContentAssignmentForModel, getVAContentAssignmentForModel } from "@/services/va-content-assignments";

const bodySchema = z.object({
  assignment_id: z.string().min(1),
  completion_notes: z.string().max(8000).optional(),
});

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

  const { assignment_id, completion_notes } = parsed.data;

  const stable = ctx.modelRecord.model_id?.trim() || null;
  const before = await getVAContentAssignmentForModel(assignment_id, ctx.linkedModelId, stable);
  if (!before || before.status !== "scheduled") {
    return NextResponse.json({ error: "Assignment not found or not scheduled." }, { status: 404 });
  }

  const updated = await completeVAContentAssignmentForModel(
    assignment_id,
    ctx.linkedModelId,
    {
      completion_notes,
    },
    stable,
  );

  if (!updated) {
    return NextResponse.json({ error: "Could not update assignment." }, { status: 500 });
  }

  const modelName = ctx.modelRecord.model_name || ctx.user.fullName || "Model";
  if (before.va_id) {
    const title =
      ctx.language === "es" ? "Contenido marcado como completado" : "✅ Content Delivery Complete";
    const body =
      ctx.language === "es"? `${modelName} marcó como hecha la entrega «${updated.title}».`
        : `${modelName} marked the delivery “${updated.title}” as complete.`;
    await notify({
      user_id: before.va_id,
      event_type: NOTIFICATION_EVENT.MODEL_CONTENT_COMPLETED,
      title,
      body,
      entity_type: "va_content_assignment",
      entity_id: assignment_id,
      actor_user_id: ctx.user.airtableUserId ?? ctx.user.id,
      actor_name: modelName,
      _triggerSource: "model_va_content_complete",
    });
  }

  revalidatePath(ROUTES.model.contentAssignments);
  revalidatePath(ROUTES.model.home);
  return NextResponse.json({ success: true, assignment: updated });
}
