import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSessionFromCookies } from "@/lib/auth";
import { getRecord, updateRecord } from "@/lib/airtable-server";
import { ROUTES } from "@/lib/routes";
import { awardPoints } from "@/services/points-engine";
import { getPointsConfig } from "@/services/points-config";
import { updateChallengeProgress } from "@/services/challenges";
import { notify } from "@/services/notification-service";
import { NOTIFICATION_EVENT, NOTIFICATION_PRIORITY } from "@/lib/notification-types";

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
  const transitioningToVerified = status === "verified" && prevStatus !== "verified";
  if (transitioningToVerified) {
    const chatterId = String(existing.fields?.chatter_id ?? "").trim();
    if (chatterId) {
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
        event_type: NOTIFICATION_EVENT.SYSTEM_ALERT,
        priority: NOTIFICATION_PRIORITY.NORMAL,
        title: "✅ Rebill Verified",
        body: `🎯 Your rebill was approved!${pointsSuffix}`,
        entity_type: "rebill",
        entity_id: id,
        _triggerSource: "adminRebillVerified",
      }).catch(() => {});
    }
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
