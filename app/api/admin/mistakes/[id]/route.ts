import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { notifyByRoleConfig } from "@/services/notification-service";
import { awardPoints } from "@/services/points-engine";
import { NOTIFICATION_ENTITY, NOTIFICATION_EVENT, NOTIFICATION_PRIORITY } from "@/lib/notification-types";
import {
  getMistakeById,
  getMistakeReasonByReasonId,
  updateMistakeRow,
} from "@/services/chatter-mistakes";

const patchSchema = z.object({
  action: z.enum(["approve", "reject"]),
  admin_notes: z.string().max(8000).optional().default(""),
});

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromCookies();
  if (!(await hasPermission(session, "mistakes:manage"))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const adminId = (session!.airtableUserId ?? session!.id)?.trim();
  if (!adminId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await ctx.params;
  if (!id?.trim()) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const mistake = await getMistakeById(id);
  if (!mistake) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (mistake.status !== "pending") {
    return NextResponse.json({ error: "Mistake is not pending" }, { status: 400 });
  }

  const reviewedAt = new Date().toISOString();
  const adminNotes = parsed.data.admin_notes ?? "";

  try {
    if (parsed.data.action === "reject") {
      await updateMistakeRow(id, {
        status: "rejected",
        admin_notes: adminNotes,
        reviewed_at: reviewedAt,
        admin_id: adminId,
      });

      if (mistake.va_id) {
        await notifyByRoleConfig(NOTIFICATION_EVENT.CHATTER_MISTAKE, {
          recipient_mode: "personal_only",
          personal_user_id: mistake.va_id,
          priority: NOTIFICATION_PRIORITY.NORMAL,
          title: "❌ Mistake Rejected",
          body: `❌ Your report for ${mistake.chatter_name} was rejected: ${adminNotes || "—"}`,
          entity_type: NOTIFICATION_ENTITY.CHATTER_MISTAKE,
          entity_id: id,
        }).catch(() => {});
      }

      const updated = await getMistakeById(id);
      return NextResponse.json({ success: true, mistake: updated });
    }

    const reason = await getMistakeReasonByReasonId(mistake.reason_id);
    const points = Math.max(0, Math.floor(reason?.points_deduction ?? 0));
    const category = mistake.reason_category;
    const reasonLabel = mistake.reason_label || reason?.label || "Mistake";

    await updateMistakeRow(id, {
      status: "approved",
      admin_notes: adminNotes,
      reviewed_at: reviewedAt,
      admin_id: adminId,
      points_deducted: points,
    });

    if (mistake.chatter_id && points > 0) {
      await awardPoints(
        mistake.chatter_id,
        -points,
        reasonLabel,
        "mistake",
        `mistake_approve:${id}`
      );
    }

    if (mistake.chatter_id) {
      await notifyByRoleConfig(NOTIFICATION_EVENT.CHATTER_MISTAKE, {
        recipient_mode: "personal_only",
        personal_user_id: mistake.chatter_id,
        priority: NOTIFICATION_PRIORITY.HIGH,
        title: "⚠️ Mistake approved",
        body: `⚠️ A ${category} mistake was recorded: ${reasonLabel}. Points deducted: ${points}.`,
        entity_type: NOTIFICATION_ENTITY.CHATTER_MISTAKE,
        entity_id: id,
      }).catch(() => {});
    }

    if (mistake.va_id) {
      await notifyByRoleConfig(NOTIFICATION_EVENT.CHATTER_MISTAKE, {
        recipient_mode: "personal_only",
        personal_user_id: mistake.va_id,
        priority: NOTIFICATION_PRIORITY.NORMAL,
        title: "✅ Mistake Approved",
        body: `✅ Your mistake report for ${mistake.chatter_name} was approved.`,
        entity_type: NOTIFICATION_ENTITY.CHATTER_MISTAKE,
        entity_id: id,
      }).catch(() => {});
    }

    const updated = await getMistakeById(id);
    return NextResponse.json({ success: true, mistake: updated });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
