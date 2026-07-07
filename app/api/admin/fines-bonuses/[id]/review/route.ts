import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { fineBonusReviewedPersonal } from "@/lib/notification-copy";
import { notifyByRoleConfig } from "@/services/notification-service";
import {
  isChatterExtraRevenueSubmission,
  reviewExtraRevenueSubmission,
} from "@/services/fines-bonuses";
import { NOTIFICATION_ENTITY, NOTIFICATION_EVENT, NOTIFICATION_PRIORITY } from "@/lib/notification-types";

const reviewSchema = z.object({
  action: z.enum(["approve", "reject"]),
  reject_reason: z.string().max(8000).optional(),
});

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, "fines:review"))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const adminId = (session!.airtableUserId ?? session!.id)?.trim();
  const adminName = (session!.fullName ?? session!.email ?? "Admin").trim() || "Admin";
  if (!adminId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await ctx.params;
  if (!id?.trim()) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = reviewSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  if (parsed.data.action === "reject" && !parsed.data.reject_reason?.trim()) {
    return NextResponse.json({ error: "Reject reason is required" }, { status: 400 });
  }

  try {
    const record = await reviewExtraRevenueSubmission(
      id.trim(),
      parsed.data.action,
      { admin_id: adminId, admin_name: adminName },
      parsed.data.reject_reason
    );

    if (!isChatterExtraRevenueSubmission(record)) {
      return NextResponse.json({ error: "Not an extra revenue submission" }, { status: 400 });
    }

    const approved = parsed.data.action === "approve";
    const decision = approved ? "Approved" : "Rejected";
    const copy = fineBonusReviewedPersonal(decision, adminName);

    await notifyByRoleConfig(NOTIFICATION_EVENT.FINE_BONUS_REVIEWED, {
      personal_user_id: record.user_id,
      priority: NOTIFICATION_PRIORITY.NORMAL,
      title: copy.title,
      body: copy.body,
      entity_type: NOTIFICATION_ENTITY.FINE_BONUS,
      entity_id: record.id,
      actor_user_id: adminId,
      actor_name: adminName,
      context: {
        decision,
        adminName,
        chatterName: record.user_name,
      },
    }).catch(() => {});

    return NextResponse.json({ success: true, entry: record });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg || "Review failed" }, { status: 500 });
  }
}
