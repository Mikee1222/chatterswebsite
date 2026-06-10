import { redirect } from "next/navigation";
import { getSessionFromCookies } from "@/lib/auth";
import { requireAdminRoute } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { ROUTES } from "@/lib/routes";
import { getAllSpinsForAdmin, type AdminSpinRow } from "@/services/spin-wheel";
import { AdminSpinResultsClient } from "@/components/admin-spin-results-client";

function computeStats(rows: AdminSpinRow[]) {
  const totalSpins = rows.length;
  const counts = new Map<string, number>();
  for (const r of rows) {
    const label = r.prize_label.trim() || "—";
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  let mostCommonPrize: string | null = null;
  let best = 0;
  for (const [label, c] of counts) {
    if (c > best) {
      best = c;
      mostCommonPrize = label;
    }
  }
  let totalCashAwarded = 0;
  let pendingCashPayout = 0;
  for (const r of rows) {
    const pt = r.prize_type.toLowerCase();
    const amt = Math.max(0, Number.parseFloat(r.prize_value) || 0);
    if (pt === "cash" && r.claimed) {
      totalCashAwarded += amt;
    }
    if (pt === "cash" && !r.claimed) {
      pendingCashPayout += amt;
    }
  }
  return { totalSpins, mostCommonPrize, totalCashAwarded, pendingCashPayout };
}

export default async function AdminSpinResultsPage() {
  const user = await requireAdminRoute(await getSessionFromCookies(), PERMISSIONS.SPIN_WHEEL_VIEW);

  const rows = await getAllSpinsForAdmin().catch(() => []);
  const stats = computeStats(rows);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 md:px-6">
      <AdminSpinResultsClient rows={rows} stats={stats} />
    </div>
  );
}
