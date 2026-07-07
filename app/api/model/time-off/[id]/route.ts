import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireModelApiContext } from "@/lib/model-api-auth";
import { ROUTES } from "@/lib/routes";
import { notifyAdmins } from "@/services/notification-service";
import { NOTIFICATION_EVENT, NOTIFICATION_ENTITY, NOTIFICATION_PRIORITY } from "@/lib/notification-types";
import { deleteModelScheduleTimeOffForModel } from "@/services/model-schedule";
import { deleteModelTimeOffRequestForModel } from "@/services/model-time-off-requests";

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const modelCtx = await requireModelApiContext();
  if (!modelCtx.ok) return modelCtx.response;

  const { id } = await ctx.params;
  const recordId = id?.trim();
  if (!recordId) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const modelName = (modelCtx.modelRecord.model_name ?? "").trim() || "Model";
  let deleted = false;

  if (await deleteModelScheduleTimeOffForModel(recordId, modelCtx.linkedModelId)) {
    deleted = true;
  } else if (await deleteModelTimeOffRequestForModel(recordId, modelCtx.linkedModelId)) {
    deleted = true;
  }

  if (!deleted) {
    return NextResponse.json({ error: "Not found or cannot cancel this request" }, { status: 404 });
  }

  await notifyAdmins({
    event_type: NOTIFICATION_EVENT.TIME_OFF_REQUESTED,
    priority: NOTIFICATION_PRIORITY.NORMAL,
    title: `❌ Time off cancelled — ${modelName}`,
    body: `${modelName} cancelled a pending time-off request.`,
    entity_type: NOTIFICATION_ENTITY.ACCOUNT,
    entity_id: modelCtx.linkedModelId,
    actor_name: modelName,
  }).catch(() => {});

  revalidatePath(ROUTES.model.schedule);
  return NextResponse.json({ success: true });
}
