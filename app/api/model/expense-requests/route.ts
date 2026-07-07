import { NextResponse } from "next/server";
import { z } from "zod";
import { requireModelApiContext } from "@/lib/model-api-auth";
import { createModelExpenseRequest, listModelExpenseRequestsForModel } from "@/services/model-expense-requests";
import { notifyAdmins } from "@/services/notification-service";
import { NOTIFICATION_ENTITY, NOTIFICATION_EVENT, NOTIFICATION_PRIORITY } from "@/lib/notification-types";

const bodySchema = z.object({
  va_content_assignment_id: z.string().trim().min(1),
  assignment_title: z.string().trim().min(1).max(200),
  type: z.enum(["airbnb", "other"]).default("airbnb"),
  airbnb_link: z.string().trim().url(),
  notes: z.string().trim().max(4000).optional(),
});

export async function GET() {
  const ctx = await requireModelApiContext();
  if (!ctx.ok) return ctx.response;
  const rows = await listModelExpenseRequestsForModel(ctx.linkedModelId).catch(() => []);
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
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues.map((i) => i.message).join(" ") }, { status: 400 });
  }

  const row = await createModelExpenseRequest({
    model_id: ctx.linkedModelId,
    model_user_id: ctx.userRecordId,
    va_content_assignment_id: parsed.data.va_content_assignment_id,
    assignment_title: parsed.data.assignment_title,
    type: parsed.data.type,
    airbnb_link: parsed.data.airbnb_link,
    notes: parsed.data.notes,
  });

  const modelName = (ctx.modelRecord.model_name ?? "").trim() || "Model";
  const assignmentTitle = parsed.data.assignment_title.trim();
  await notifyAdmins({
    event_type: NOTIFICATION_EVENT.SYSTEM_ALERT,
    priority: NOTIFICATION_PRIORITY.NORMAL,
    title: `💰 Expense Request Submitted`,
    body: `💰 ${parsed.data.airbnb_link} for '${assignmentTitle}'`,
    entity_type: NOTIFICATION_ENTITY.EXPENSE_REQUEST,
    entity_id: row.id,
    actor_user_id: ctx.userRecordId,
    actor_name: modelName,
  }).catch(() => {});

  return NextResponse.json({ success: true, record: row });
}
