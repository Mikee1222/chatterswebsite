import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { chatterMistakeReviewedSelf } from "@/lib/notification-copy";
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

async function notifyMistakeReviewed(
  personalUserId: string,
  opts: {
    adminId: string;
    adminName: string;
    mistakeId: string;
    approved: boolean;
    copyOpts: Parameters<typeof chatterMistakeReviewedSelf>[1];
    priority: (typeof NOTIFICATION_PRIORITY)[keyof typeof NOTIFICATION_PRIORITY];
    context: Record<string, unknown>;
  }
) {
  const decision = opts.approved ? "Εγκρίθηκε" : "Απορρίφθηκε";
  const copy = chatterMistakeReviewedSelf(decision, opts.copyOpts);
  await notifyByRoleConfig(NOTIFICATION_EVENT.CHATTER_MISTAKE_REVIEWED, {
    recipient_mode: "personal_only",
    personal_user_id: personalUserId,
    priority: opts.priority,
    title: copy.title,
    body: copy.body,
    entity_type: NOTIFICATION_ENTITY.CHATTER_MISTAKE,
    entity_id: opts.mistakeId,
    actor_user_id: opts.adminId,
    actor_name: opts.adminName,
    context: { decision, ...opts.context },
  }).catch(() => {});
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromCookies();
  if (!(await hasPermission(session, "mistakes:manage"))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const adminId = (session!.airtableUserId ?? session!.id)?.trim();
  if (!adminId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const adminName = (session!.fullName ?? "Admin").trim() || "Admin";

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
  const approved = parsed.data.action === "approve";

  try {
    if (!approved) {
      await updateMistakeRow(id, {
        status: "rejected",
        admin_notes: adminNotes,
        reviewed_at: reviewedAt,
        admin_id: adminId,
      });

      if (mistake.va_id) {
        await notifyMistakeReviewed(mistake.va_id, {
          adminId,
          adminName,
          mistakeId: id,
          approved: false,
          priority: NOTIFICATION_PRIORITY.NORMAL,
          copyOpts: {
            isVaReport: true,
            chatterName: mistake.chatter_name,
            adminNotes,
          },
          context: {
            chatterName: mistake.chatter_name,
            adminNotes,
          },
        });
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
      await notifyMistakeReviewed(mistake.chatter_id, {
        adminId,
        adminName,
        mistakeId: id,
        approved: true,
        priority: NOTIFICATION_PRIORITY.HIGH,
        copyOpts: {
          reasonLabel,
          points,
        },
        context: {
          chatterName: mistake.chatter_name,
          reasonLabel,
          points,
          category,
        },
      });
    }

    if (mistake.va_id) {
      await notifyMistakeReviewed(mistake.va_id, {
        adminId,
        adminName,
        mistakeId: id,
        approved: true,
        priority: NOTIFICATION_PRIORITY.NORMAL,
        copyOpts: {
          isVaReport: true,
          chatterName: mistake.chatter_name,
        },
        context: {
          chatterName: mistake.chatter_name,
        },
      });
    }

    const updated = await getMistakeById(id);
    return NextResponse.json({ success: true, mistake: updated });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
