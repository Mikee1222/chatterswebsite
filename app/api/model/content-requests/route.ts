import { NextResponse } from "next/server";
import { z } from "zod";
import { requireModelApiContext } from "@/lib/model-api-auth";
import {
  createModelContentRequest,
  listModelContentRequestsForModel,
} from "@/services/model-content-requests";
import { notifyAdmins } from "@/services/notification-service";
import { NOTIFICATION_ENTITY, NOTIFICATION_EVENT, NOTIFICATION_PRIORITY } from "@/lib/notification-types";

const createSchema = z.object({
  type: z.enum(["script", "mass", "photo_set", "video", "other"]),
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().min(1).max(4000),
});

export async function GET() {
  const ctx = await requireModelApiContext();
  if (!ctx.ok) return ctx.response;
  const rows = await listModelContentRequestsForModel(ctx.linkedModelId).catch(() => []);
  return NextResponse.json({ records: rows });
}

export async function POST(req: Request) {
  const ctx = await requireModelApiContext();
  if (!ctx.ok) return ctx.response;

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = createSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues.map((i) => i.message).join(" ") }, { status: 400 });
  }

  const row = await createModelContentRequest({
    model_id: ctx.linkedModelId,
    model_user_id: ctx.userRecordId,
    type: parsed.data.type,
    title: parsed.data.title,
    description: parsed.data.description,
  });
  const modelName = (ctx.modelRecord.model_name ?? "").trim() || "Model";
  await notifyAdmins({
    event_type: NOTIFICATION_EVENT.SYSTEM_ALERT,
    priority: NOTIFICATION_PRIORITY.NORMAL,
    title: `📝 New content request from ${modelName}: ${row.title}`,
    body: `${modelName} submitted a ${row.type} request.`,
    entity_type: NOTIFICATION_ENTITY.CUSTOM_REQUEST,
    entity_id: row.id,
    actor_user_id: ctx.userRecordId,
    actor_name: modelName,
  }).catch(() => {});

  return NextResponse.json({ success: true, record: row });
}
