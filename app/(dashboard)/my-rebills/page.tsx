import { getSessionFromCookies } from "@/lib/auth";
import { redirect } from "next/navigation";
import { ROUTES } from "@/lib/routes";
import { getEffectiveStaffRole } from "@/lib/staff-session-role";
import { listAllRebills } from "@/services/rebills";
import { getRecentPointsTransactions } from "@/services/points-engine";
import { MyRebillsClient } from "@/components/my-rebills-client";

export const dynamic = "force-dynamic";

export default async function MyRebillsPage() {
  const user = await getSessionFromCookies();
  if (!user || getEffectiveStaffRole(user) !== "chatter") redirect(ROUTES.dashboard);

  const chatterId = user.airtableUserId ?? user.id;

  const allRebills = await listAllRebills().catch(() => []);

  const myRebills = allRebills
    .filter((r) => r.chatter_id === chatterId && (r.sub_type || "paid") === "paid")
    .map((r) => {
      const statusRaw = r.status || "pending";
      const status =
        statusRaw === "verified" || statusRaw === "rejected" || statusRaw === "pending"
          ? statusRaw
          : "pending";
      return {
        id: r.id,
        rebill_id: r.rebill_id,
        model_name: r.model_name || "—",
        model_id: r.model_id,
        sub_username: r.sub_username,
        sub_type: "paid" as const,
        screenshot: r.screenshot.map((url) => ({ url })),
        status: status as "pending" | "verified" | "rejected",
        admin_notes: r.admin_notes || "",
        created_at: r.created_at ?? "",
      };
    })
    .sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));

  const allApproved = allRebills.filter(
    (r) => r.status === "verified" && (r.sub_type || "paid") === "paid"
  );

  const standingsMap = new Map<string, { chatter_name: string; count: number; chatter_id: string }>();
  for (const r of allApproved) {
    const cid = r.chatter_id;
    const cname = r.chatter_name || "Unknown";
    if (!cid) continue;
    const existing = standingsMap.get(cid) ?? { chatter_name: cname, count: 0, chatter_id: cid };
    existing.count++;
    standingsMap.set(cid, existing);
  }
  const standings = Array.from(standingsMap.values())
    .sort((a, b) => b.count - a.count)
    .map((s, i) => ({ ...s, rank: i + 1 }));

  const rebillPointsById: Record<string, number> = {};
  try {
    const rebillTxs = await getRecentPointsTransactions(chatterId, 100);
    for (const tx of rebillTxs) {
      if (tx.category !== "rebill") continue;
      const ref = tx.reference_id.trim();
      const pts = Number(tx.points);
      if (ref && Number.isFinite(pts) && pts > 0) {
        rebillPointsById[ref] = pts;
      }
    }
  } catch {
    // Non-fatal: rebill list still works without points badges
  }

  return (
    <div className="space-y-8 pb-20">
      <MyRebillsClient
        rebills={myRebills}
        standings={standings}
        currentChatterId={chatterId}
        rebillPointsById={rebillPointsById}
      />
    </div>
  );
}
