import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireClientModelAccess } from "@/lib/client-content-auth";
import { ROUTES } from "@/lib/routes";
import { NOTIFICATION_PRIORITY } from "@/lib/notification-types";
import { notify } from "@/services/notification-service";
import { getModelById } from "@/services/modelss";
import {
  completeVAContentAssignmentForModel,
  getVAContentAssignmentForModel,
} from "@/services/va-content-assignments";

const bodySchema = z.object({
  assignment_id: z.string().min(1),
  model_id: z.string().min(1),
  completion_notes: z.string().max(8000).optional(),
});

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

  const { assignment_id, model_id, completion_notes } = parsed.data;
  const access = await requireClientModelAccess(model_id);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const modelRecord = await getModelById(model_id).catch(() => null);
  const stable = modelRecord?.model_id?.trim() || null;
  const before = await getVAContentAssignmentForModel(assignment_id, model_id, stable);
  if (!before || before.status !== "scheduled") {
    return NextResponse.json({ error: "Assignment not found or not scheduled." }, { status: 404 });
  }

  const updated = await completeVAContentAssignmentForModel(
    assignment_id,
    model_id,
    { completion_notes },
    stable,
  );

  if (!updated) {
    return NextResponse.json({ error: "Could not update assignment." }, { status: 500 });
  }

  const modelName = modelRecord?.model_name?.trim() || "Model";
  const vaId = before.va_id?.trim();
  if (vaId) {
    const title = "Content Marked Complete";
    const body = `${access.actorName} marked “${updated.title}” as complete for ${modelName}.`;
    await notify({
      user_id: vaId,
      event_type: "va_content_completed",
      priority: NOTIFICATION_PRIORITY.NORMAL,
      title,
      body,
      entity_type: "va_content_assignment",
      entity_id: assignment_id,
      actor_name: access.actorName,
      _triggerSource: "complete-assignment",
    }).catch(() => {});
  }

  revalidatePath(ROUTES.client.content);
  return NextResponse.json({ success: true, assignment: updated });
}
