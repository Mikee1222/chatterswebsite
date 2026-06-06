import { NextResponse } from "next/server";
import { z } from "zod";
import { requireModelApiContext } from "@/lib/model-api-auth";
import { completeVAContentAssignmentForModel } from "@/services/va-content-assignments";
import { notify } from "@/services/notification-service";
import { NOTIFICATION_EVENT, NOTIFICATION_PRIORITY } from "@/lib/notification-types";

const bodySchema = z.object({
  assignment_id: z.string().min(1),
  completion_notes: z.string().max(5000).optional(),
});

export async function POST(req: Request) {
  const ctx = await requireModelApiContext();
  if (!ctx.ok) return ctx.response;

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const assignmentId = parsed.data.assignment_id.trim();
  try {
    const stable = ctx.modelRecord.model_id?.trim() || null;
    const updated = await completeVAContentAssignmentForModel(
      assignmentId,
      ctx.linkedModelId,
      {
        completion_notes: parsed.data.completion_notes,
      },
      stable,
    );
    if (!updated) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }
    const modelName = (ctx.modelRecord.model_name ?? "").trim() || "Model";
    const vaId = updated.va_id?.trim();
    if (vaId) {
      await notify({
        user_id: vaId,
        event_type: NOTIFICATION_EVENT.MODEL_CONTENT_COMPLETED,
        priority: NOTIFICATION_PRIORITY.NORMAL,
        title: " Content assignment completed",
        body: `${modelName} marked "${updated.title}" as completed.`,
        entity_type: "va_content_assignment",
        entity_id: updated.id,
        actor_name: modelName,
      }).catch(() => {});
    }
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Request failed" }, { status: 500 });
  }
}
