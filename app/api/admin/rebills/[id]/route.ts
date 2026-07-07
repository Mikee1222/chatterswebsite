import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { getRecord, updateRecord } from "@/lib/airtable-server";
import { ROUTES } from "@/lib/routes";
import { awardPoints } from "@/services/points-engine";
import { getPointsConfig } from "@/services/points-config";
import { updateChallengeProgress } from "@/services/challenges";
import { notify } from "@/services/notification-service";
import { NOTIFICATION_ENTITY, NOTIFICATION_EVENT, NOTIFICATION_PRIORITY } from "@/lib/notification-types";

type RebillFields = {
  status?: string;
  chatter_id?: string;
  chatter_name?: string;
  admin_notes?: string;
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

  const existing = await getRecord<RebillFields>("rebills", id);
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const prevStatus = String(existing.fields?.status ?? "pending").trim();
  const fields: Record<string, unknown> = {};
  if (status !== undefined) fields.status = status;
  if (admin_notes !== undefined) fields.admin_notes = admin_notes;

  const record = await updateRecord<Record<string, unknown>>("rebills", id, fields);

  let pointsAwarded = 0;
  const chatterId = String(existing.fields?.chatter_id ?? "").trim();
  const transitioningToVerified = status === "verified" && prevStatus !== "verified";
  const transitioningToRejected = status === "rejected" && prevStatus !== "rejected";
  if (transitioningToVerified && chatterId) {
    const config = await getPointsConfig();
    const pointsPerRebill = Math.max(0, Math.floor(config.REBILL_VERIFIED));
    if (pointsPerRebill > 0) {
      await awardPoints(chatterId, pointsPerRebill, "Rebill verified", "rebill", id);
      pointsAwarded = pointsPerRebill;
    }
    await updateChallengeProgress(chatterId, "rebills_verified", 1);
    const pointsSuffix = pointsPerRebill > 0 ? ` +${pointsPerRebill} pts earned.` : "";
    await notify({
      user_id: chatterId,
      event_type: NOTIFICATION_EVENT.REBILL_VERIFIED,
      priority: NOTIFICATION_PRIORITY.NORMAL,
      title: "✅ Rebill verified",
      body: `Your rebill was verified.${pointsSuffix}`,
      entity_type: NOTIFICATION_ENTITY.REBILL,
      entity_id: id,
      _triggerSource: "adminRebillVerified",
    }).catch(() => {});
  } else if (transitioningToRejected && chatterId) {
    const note = (admin_notes ?? "").trim();
    await notify({
      user_id: chatterId,
      event_type: NOTIFICATION_EVENT.REBILL_REJECTED,
      priority: NOTIFICATION_PRIORITY.NORMAL,
      title: "❌ Rebill rejected",
      body: note.length > 0 ? `Your rebill was rejected: ${note}` : "Your rebill was rejected.",
      entity_type: NOTIFICATION_ENTITY.REBILL,
      entity_id: id,
      _triggerSource: "adminRebillRejected",
    }).catch(() => {});
  }

  revalidatePath(ROUTES.admin.rebillsTips);
  revalidatePath(ROUTES.chatter.myRebills);

  const chatterName = String(existing.fields?.chatter_name ?? "").trim();
  return NextResponse.json({
    success: true,
    record,
    points_awarded: pointsAwarded,
    chatter_name: chatterName || undefined,
  });
}
