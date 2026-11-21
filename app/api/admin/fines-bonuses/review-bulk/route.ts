import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionFromCookies } from "@/lib/auth";
import { sendReviewDecisionNotification } from "@/lib/fines-bonuses-review-notify";
import { hasPermission } from "@/lib/rbac";
import { reviewExtraRevenueSubmission, type FineBonusRecord } from "@/services/fines-bonuses";

const MAX_IDS = 50;

const bulkSchema = z.object({
  ids: z.array(z.string().trim().min(1)).min(1).max(MAX_IDS),
});

type BulkItemResult = {
  id: string;
  success: boolean;
  error?: string;
  entry?: FineBonusRecord;
};

/**
 * Bulk approve only. Same permission as single review (`fines:review`).
 * Reuses reviewExtraRevenueSubmission + immediate per-item FINE_BONUS_REVIEWED notifications.
 */
export async function POST(req: Request) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, "fines:review"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const adminId = (session.airtableUserId ?? session.id)?.trim();
  const adminName = (session.fullName ?? session.email ?? "Admin").trim() || "Admin";
  if (!adminId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bulkSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const uniqueIds = [...new Set(parsed.data.ids.map((id) => id.trim()).filter(Boolean))];
  if (uniqueIds.length > MAX_IDS) {
    return NextResponse.json({ error: `Max ${MAX_IDS} ids per request` }, { status: 400 });
  }

  const results: BulkItemResult[] = [];

  for (const id of uniqueIds) {
    try {
      const record = await reviewExtraRevenueSubmission(id, "approve", {
        admin_id: adminId,
        admin_name: adminName,
      });

      await sendReviewDecisionNotification({
        recordId: record.id,
        adminId,
        adminName,
        decision: "Approved",
        chatterName: record.user_name,
        personalUserId: record.user_id,
      });

      results.push({ id, success: true, entry: record });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      results.push({ id, success: false, error: msg || "Approve failed" });
    }
  }

  const approved = results.filter((r) => r.success).length;
  const failed = results.length - approved;
  return NextResponse.json({
    success: failed === 0,
    approved,
    failed,
    results,
  });
}
