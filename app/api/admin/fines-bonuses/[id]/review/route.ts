import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionFromCookies } from "@/lib/auth";
import {
  sendReviewDecisionNotification,
  sendReviewRevertedNotification,
} from "@/lib/fines-bonuses-review-notify";
import { hasPermission } from "@/lib/rbac";
import { reviewExtraRevenueSubmission } from "@/services/fines-bonuses";

const reviewSchema = z.object({
  action: z.enum(["approve", "reject", "revert"]),
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

    const notifyBase = {
      recordId: record.id,
      adminId,
      adminName,
      chatterName: record.user_name,
      personalUserId: record.user_id,
    };

    if (parsed.data.action === "approve") {
      await sendReviewDecisionNotification({ ...notifyBase, decision: "Approved" });
    } else if (parsed.data.action === "reject") {
      await sendReviewDecisionNotification({ ...notifyBase, decision: "Rejected" });
    } else if (parsed.data.action === "revert") {
      // Approval notify was already sent — send a short corrective message.
      await sendReviewRevertedNotification(notifyBase);
    }

    return NextResponse.json({ success: true, entry: record });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const status =
      msg === "Already reviewed" ||
      msg === "Not a pending extra revenue submission" ||
      msg === "Revert window expired" ||
      msg === "Can only undo your own approval" ||
      msg === "Not found"
        ? 400
        : 500;
    return NextResponse.json({ error: msg || "Review failed" }, { status });
  }
}
