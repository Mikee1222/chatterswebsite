import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionFromCookies } from "@/lib/auth";
import { notify } from "@/services/notification-service";
import {
  isChatterExtraRevenueSubmission,
  reviewExtraRevenueSubmission,
} from "@/services/fines-bonuses";
import { NOTIFICATION_ENTITY, NOTIFICATION_EVENT, NOTIFICATION_PRIORITY } from "@/lib/notification-types";

function isStaffAdmin(session: { role: string } | null): boolean {
  return session != null && (session.role === "admin" || session.role === "manager");
}

const reviewSchema = z.object({
  action: z.enum(["approve", "reject"]),
  reject_reason: z.string().max(8000).optional(),
});

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromCookies();
  if (!isStaffAdmin(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

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

    if (parsed.data.action === "approve") {
      await notify({
        user_id: record.user_id,
        event_type: NOTIFICATION_EVENT.SYSTEM_ALERT,
        priority: NOTIFICATION_PRIORITY.NORMAL,
        title: " Extra revenue approved",
        body: `Your €${record.amount.toFixed(2)} extra revenue for ${record.model_name || "a model"} was approved.`,
        entity_type: NOTIFICATION_ENTITY.FINE_BONUS,
        entity_id: record.id,
        actor_user_id: adminId,
        actor_name: adminName,
        _triggerSource: "admin_extra_revenue_approve",
      }).catch(() => {});
    } else {
      await notify({
        user_id: record.user_id,
        event_type: NOTIFICATION_EVENT.SYSTEM_ALERT,
        priority: NOTIFICATION_PRIORITY.NORMAL,
        title: " Extra revenue rejected",
        body:
          parsed.data.reject_reason?.trim() ||
          `Your extra revenue submission for ${record.model_name || "a model"} was rejected.`,
        entity_type: NOTIFICATION_ENTITY.FINE_BONUS,
        entity_id: record.id,
        actor_user_id: adminId,
        actor_name: adminName,
        _triggerSource: "admin_extra_revenue_reject",
      }).catch(() => {});
    }

    return NextResponse.json({ success: true, entry: record });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg || "Review failed" }, { status: 500 });
  }
}
