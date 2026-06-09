import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSessionFromCookies } from "@/lib/auth";
import { ROUTES } from "@/lib/routes";
import { updateModelContentRequest } from "@/services/model-content-requests";
import { getActiveModelUserAirtableIdByLinkedModelRecordId } from "@/services/users";
import { notify } from "@/services/notification-service";
import { NOTIFICATION_ENTITY, NOTIFICATION_EVENT, NOTIFICATION_PRIORITY } from "@/lib/notification-types";
import type { ModelContentRequest } from "@/types";

const bodySchema = z
  .object({
    status: z.enum(["pending", "approved", "rejected", "in_progress", "completed"]).optional(),
    admin_notes: z.string().max(4000).optional(),
    title: z.string().trim().optional(),
    model_id: z.string().trim().optional(),
  })
  .refine((d) => d.status !== undefined || d.admin_notes !== undefined, {
    message: "Provide status and/or admin_notes",
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

  const updatePayload: Partial<Pick<ModelContentRequest, "status" | "admin_notes">> = {};
  if (parsed.data.status !== undefined) updatePayload.status = parsed.data.status;
  if (parsed.data.admin_notes !== undefined) updatePayload.admin_notes = parsed.data.admin_notes;

  const updated = await updateModelContentRequest(id, updatePayload);

  const st = parsed.data.status;
  if (parsed.data.model_id && (st === "approved" || st === "rejected")) {
    const modelUserId = await getActiveModelUserAirtableIdByLinkedModelRecordId(parsed.data.model_id);
    if (modelUserId) {
      if (st === "approved") {
        await notify({
          user_id: modelUserId,
          event_type: NOTIFICATION_EVENT.SYSTEM_ALERT,
          priority: NOTIFICATION_PRIORITY.NORMAL,
          title: `✅ Your content request '${parsed.data.title || updated.title}' was approved!`,
          body: (parsed.data.admin_notes ?? updated.admin_notes ?? "").trim() || "Your request is now approved.",
          entity_type: NOTIFICATION_ENTITY.CUSTOM_REQUEST,
          entity_id: updated.id,
          actor_user_id: session.airtableUserId ?? session.id,
          actor_name: session.fullName ?? "Admin",
        }).catch(() => {});
      } else {
        const note = (parsed.data.admin_notes ?? updated.admin_notes ?? "").trim();
        await notify({
          user_id: modelUserId,
          event_type: NOTIFICATION_EVENT.SYSTEM_ALERT,
          priority: NOTIFICATION_PRIORITY.NORMAL,
          title: `❌ Your content request '${parsed.data.title || updated.title}' was declined.`,
          body: note.length > 0 ? note : "No reason provided.",
          entity_type: NOTIFICATION_ENTITY.CUSTOM_REQUEST,
          entity_id: updated.id,
          actor_user_id: session.airtableUserId ?? session.id,
          actor_name: session.fullName ?? "Admin",
        }).catch(() => {});
      }
    }
  }

  revalidatePath(ROUTES.admin.modelContentRequests);
  revalidatePath(ROUTES.model.home);
  return NextResponse.json({ success: true, record: updated });
}
