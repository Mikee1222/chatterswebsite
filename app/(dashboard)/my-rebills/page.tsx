import { getSessionFromCookies } from "@/lib/auth";
import { redirect } from "next/navigation";
import { ROUTES } from "@/lib/routes";
import { listAllRecords, listRecords } from "@/lib/airtable-server";
import { escapeAirtableString } from "@/lib/airtable-linked";
import { getEffectiveStaffRole } from "@/lib/staff-session-role";
import { MyRebillsClient } from "@/components/my-rebills-client";

export const dynamic = "force-dynamic";

export default async function MyRebillsPage() {
  const user = await getSessionFromCookies();
  if (!user || getEffectiveStaffRole(user) !== "chatter") redirect(ROUTES.dashboard);

  const chatterId = user.airtableUserId ?? user.id;

  const allRebills = await listAllRecords("rebills", {
    sort: [{ field: "created_at", direction: "desc" }],
    _caller: "my-rebills",
  });

  const myRebills = allRebills
    .filter((r) => {
      const f = r.fields as Record<string, unknown>;
      return String(f.chatter_id ?? "") === chatterId && String(f.sub_type ?? "paid") === "paid";
    })
    .map((r) => {
      const f = r.fields as Record<string, unknown>;
      const statusRaw = String(f.status ?? "pending");
      const status =
        statusRaw === "verified" || statusRaw === "rejected" || statusRaw === "pending"
          ? statusRaw
          : "pending";
      return {
        id: r.id,
        rebill_id: String(f.rebill_id ?? ""),
        model_name: String(f.model_name ?? "—"),
        model_id: String(f.model_id ?? ""),
        sub_username: String(f.sub_username ?? ""),
        sub_type: "paid" as const,
        screenshot: Array.isArray(f.screenshot)
          ? (f.screenshot as Array<{ url?: string; filename?: string }>)
          : [],
        status: status as "pending" | "verified" | "rejected",
        admin_notes: String(f.admin_notes ?? ""),
        created_at: String(f.created_at ?? ""),
      };
    });

  const allApproved = allRebills.filter((r) => {
    const f = r.fields as Record<string, unknown>;
    return String(f.status ?? "") === "verified" && String(f.sub_type ?? "paid") === "paid";
  });

  const standingsMap = new Map<string, { chatter_name: string; count: number; chatter_id: string }>();
  for (const r of allApproved) {
    const f = r.fields as Record<string, unknown>;
    const cid = String(f.chatter_id ?? "");
    const cname = String(f.chatter_name ?? "Unknown");
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
    const { records: rebillTxs } = await listRecords<{
      points?: number;
      reference_id?: string;
      category?: string;
    }>("points_transactions", {
      filterByFormula: `AND({user_id} = "${escapeAirtableString(chatterId)}", {category} = "rebill")`,
      pageSize: 100,
      _caller: "my-rebills.rebillPoints",
    });
    for (const tx of rebillTxs) {
      const ref = String(tx.fields?.reference_id ?? "").trim();
      const pts = Number(tx.fields?.points ?? 0);
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
