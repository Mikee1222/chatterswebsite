import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSessionFromCookies } from "@/lib/auth";
import { ROUTES } from "@/lib/routes";
import { updateModelExpenseRequest } from "@/services/model-expense-requests";
import { getActiveModelUserAirtableIdByLinkedModelRecordId } from "@/services/users";
import { notify } from "@/services/notification-service";
import { NOTIFICATION_ENTITY, NOTIFICATION_EVENT, NOTIFICATION_PRIORITY } from "@/lib/notification-types";

const bodySchema = z.object({
  status: z.enum(["approved", "rejected"]),
  admin_notes: z.string().trim().max(4000).optional(),
  model_id: z.string().trim().optional(),
});

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromCookies();
  if (!session || (session.role !== "admin" && session.role !== "manager")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
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

  const updated = await updateModelExpenseRequest(id, {
    status: parsed.data.status,
    admin_notes: parsed.data.admin_notes ?? "",
  });

  if (parsed.data.model_id) {
    const modelUserId = await getActiveModelUserAirtableIdByLinkedModelRecordId(parsed.data.model_id);
    if (modelUserId) {
      const note = parsed.data.admin_notes?.trim();
      if (parsed.data.status === "approved") {
        await notify({
          user_id: modelUserId,
          event_type: NOTIFICATION_EVENT.SYSTEM_ALERT,
          priority: NOTIFICATION_PRIORITY.NORMAL,
          title: "✅ Your Airbnb request was approved!",
          body: note && note.length > 0 ? note : "Your request is now approved.",
          entity_type: NOTIFICATION_ENTITY.CUSTOM_REQUEST,
          entity_id: updated.id,
          actor_user_id: session.airtableUserId ?? session.id,
          actor_name: session.fullName ?? "Admin",
        }).catch(() => {});
      } else {
        await notify({
          user_id: modelUserId,
          event_type: NOTIFICATION_EVENT.SYSTEM_ALERT,
          priority: NOTIFICATION_PRIORITY.NORMAL,
          title: "❌ Your Airbnb request was declined.",
          body: note && note.length > 0 ? note : "No reason provided.",
          entity_type: NOTIFICATION_ENTITY.CUSTOM_REQUEST,
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
