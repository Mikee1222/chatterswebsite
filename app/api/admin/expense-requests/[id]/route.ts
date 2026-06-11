import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { ROUTES } from "@/lib/routes";
import { updateModelExpenseRequest } from "@/services/model-expense-requests";
import { getActiveModelUserAirtableIdByLinkedModelRecordId } from "@/services/users";
import { notify } from "@/services/notification-service";
import { NOTIFICATION_ENTITY, NOTIFICATION_EVENT, NOTIFICATION_PRIORITY } from "@/lib/notification-types";
import type { ModelExpenseRequest } from "@/types";

const bodySchema = z
  .object({
    status: z.enum(["approved", "rejected"]).optional(),
    admin_notes: z.string().max(4000).optional(),
    model_id: z.string().trim().optional(),
  })
  .refine((d) => d.status !== undefined || d.admin_notes !== undefined, {
    message: "Provide status and/or admin_notes",
  });

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, "content:manage"))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await ctx.params;
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

  const updatePayload: Partial<Pick<ModelExpenseRequest, "status" | "admin_notes">> = {};
  if (parsed.data.status !== undefined) updatePayload.status = parsed.data.status;
  if (parsed.data.admin_notes !== undefined) updatePayload.admin_notes = parsed.data.admin_notes;

  const updated = await updateModelExpenseRequest(id, updatePayload);

  const st = parsed.data.status;
  if (st === "approved" || st === "rejected") {
    const modelId = parsed.data.model_id || updated.model_id;
    const modelUserId = await getActiveModelUserAirtableIdByLinkedModelRecordId(modelId);
    if (modelUserId) {
      const note = (parsed.data.admin_notes ?? updated.admin_notes ?? "").trim();
      if (st === "approved") {
        await notify({
          user_id: modelUserId,
          event_type: NOTIFICATION_EVENT.EXPENSE_APPROVED,
          priority: NOTIFICATION_PRIORITY.NORMAL,
          title: "✅ Expense Request Approved",
          body: note && note.length > 0 ? note : "Your request is now approved.",
          entity_type: NOTIFICATION_ENTITY.EXPENSE_REQUEST,
          entity_id: updated.id,
          actor_user_id: session.airtableUserId ?? session.id,
          actor_name: session.fullName ?? "Admin",
        }).catch(() => {});
      } else {
        await notify({
          user_id: modelUserId,
          event_type: NOTIFICATION_EVENT.EXPENSE_REJECTED,
          priority: NOTIFICATION_PRIORITY.NORMAL,
          title: "❌ Expense Request Declined",
          body: note && note.length > 0 ? note : "No reason provided.",
          entity_type: NOTIFICATION_ENTITY.EXPENSE_REQUEST,
          entity_id: updated.id,
          actor_user_id: session.airtableUserId ?? session.id,
          actor_name: session.fullName ?? "Admin",
        }).catch(() => {});
      }
    }
  }

  revalidatePath(ROUTES.admin.expenseRequests);
  revalidatePath(ROUTES.model.home);
  revalidatePath(ROUTES.model.contentAssignments);
  return NextResponse.json({ success: true, record: updated });
}
