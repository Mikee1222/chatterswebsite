import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { getRecord, updateRecord } from "@/lib/airtable-server";
import { ROUTES } from "@/lib/routes";
import { notify } from "@/services/notification-service";
import { NOTIFICATION_ENTITY, NOTIFICATION_EVENT, NOTIFICATION_PRIORITY } from "@/lib/notification-types";

type TipFields = {
  status?: string;
  chatter_id?: string;
  chatter_name?: string;
};

const bodySchema = z.object({
  status: z.enum(["pending", "verified", "rejected"]).optional(),
  admin_notes: z.string().max(8000).optional(),
});

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, "billing:manage"))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await ctx.params;
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues.map((i) => i.message).join(" ") },
      { status: 400 }
    );
  }

  const { status, admin_notes } = parsed.data;
  if (status === undefined && admin_notes === undefined) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const existing = await getRecord<TipFields>("tips", id);
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const prevStatus = String(existing.fields?.status ?? "pending").trim();

  const fields: Record<string, unknown> = {};
  if (status !== undefined) fields.status = status;
  if (admin_notes !== undefined) fields.admin_notes = admin_notes;

  const record = await updateRecord<Record<string, unknown>>("tips", id, fields);

  const chatterId = String(existing.fields?.chatter_id ?? "").trim();
  if (chatterId && status !== undefined && status !== prevStatus) {
    if (status === "verified") {
      await notify({
        user_id: chatterId,
        event_type: NOTIFICATION_EVENT.TIP_APPROVED,
        priority: NOTIFICATION_PRIORITY.NORMAL,
        title: "✅ Tip approved",
        body: "Your tip was approved. Nice work!",
        entity_type: NOTIFICATION_ENTITY.TIP,
        entity_id: id,
        _triggerSource: "adminTipApproved",
      }).catch(() => {});
    } else if (status === "rejected") {
      const note = (admin_notes ?? "").trim();
      await notify({
        user_id: chatterId,
        event_type: NOTIFICATION_EVENT.TIP_REJECTED,
        priority: NOTIFICATION_PRIORITY.NORMAL,
        title: "❌ Tip rejected",
        body: note.length > 0 ? `Your tip was rejected: ${note}` : "Your tip was rejected.",
        entity_type: NOTIFICATION_ENTITY.TIP,
        entity_id: id,
        _triggerSource: "adminTipRejected",
      }).catch(() => {});
    }
  }

  revalidatePath(ROUTES.admin.rebillsTips);
  revalidatePath(ROUTES.chatter.myRebills);

  const chatterName = String(existing.fields?.chatter_name ?? "").trim();
  return NextResponse.json({ success: true, record, chatter_name: chatterName || undefined });
}
