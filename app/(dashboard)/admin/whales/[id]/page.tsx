import { redirect } from "next/navigation";
import Link from "next/link";
import { getSessionFromCookies } from "@/lib/auth";
import { ROUTES } from "@/lib/routes";
import { getWhaleById } from "@/services/whales";
import { listAllRecords } from "@/lib/airtable-server";
import { notFound } from "next/navigation";
import { WhaleDetail } from "@/components/whale-detail";

const ACTIVITY_TABLE = "whale_activity";
const TRANSACTIONS_TABLE = "whale_transactions";

export default async function AdminWhaleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSessionFromCookies();
  if (!user) redirect(ROUTES.login);
  if (user.role !== "admin" && user.role !== "manager") redirect(ROUTES.dashboard);

  const whale = await getWhaleById(id);
  if (!whale) notFound();

  const [activityRaw, transactionsRaw] = await Promise.all([
    listAllRecords<Record<string, unknown>>(ACTIVITY_TABLE, {
      filterByFormula: `{whale_id} = '${whale.whale_id.replace(/'/g, "\\'")}'`,
    }).catch(() => []),
    listAllRecords<Record<string, unknown>>(TRANSACTIONS_TABLE, {
      filterByFormula: `{whale_id} = '${whale.whale_id.replace(/'/g, "\\'")}'`,
    }).catch(() => []),
  ]);

  const activity = activityRaw
    .map((r) => ({ id: r.id, ...r.fields } as Record<string, unknown>))
    .sort((a, b) => String(b.created_at ?? "").localeCompare(String(a.created_at ?? "")))
    .slice(0, 30);
  const transactions = transactionsRaw
    .map((r) => ({ id: r.id, ...r.fields } as Record<string, unknown>))
    .sort((a, b) => String(b.date ?? "").localeCompare(String(a.date ?? "")))
    .slice(0, 50);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href={ROUTES.admin.whales} className="text-sm text-white/60 hover:text-white">
          ← Admin whales
        </Link>
      </div>
      <WhaleDetail whale={whale} activity={activity} transactions={transactions} userRole={user.role} />
    </div>
  );
}
