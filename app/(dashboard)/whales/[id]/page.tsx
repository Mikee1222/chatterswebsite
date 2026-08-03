import { redirect } from "next/navigation";
import { getSessionFromCookies } from "@/lib/auth";
import { ROUTES } from "@/lib/routes";
import { getWhaleById } from "@/services/whales";
import { listWhaleActivityByWhaleId } from "@/services/whale-activity";
import { listAllWhaleTransactions } from "@/services/whale-transactions";
import { notFound } from "next/navigation";
import Link from "next/link";
import { WhaleDetail } from "@/components/whale-detail";

export default async function WhaleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSessionFromCookies();
  if (!user) redirect(ROUTES.login);
  const whale = await getWhaleById(id);
  if (!whale) notFound();
  if (user.role === "chatter" && user.airtableUserId && whale.assigned_chatter_id !== user.airtableUserId) {
    notFound();
  }

  const [activity, allTx] = await Promise.all([
    listWhaleActivityByWhaleId(whale.whale_id, 30),
    listAllWhaleTransactions().catch(() => []),
  ]);

  const transactions = allTx
    .filter((t) => t.whale_id === whale.id || t.whale_id === whale.whale_id)
    .sort((a, b) => String(b.date ?? "").localeCompare(String(a.date ?? "")))
    .slice(0, 50)
    .map((t) => ({ ...t } as Record<string, unknown>));

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href={ROUTES.whales} className="text-sm text-white/60 hover:text-white">
          ← Whales
        </Link>
      </div>
      <WhaleDetail whale={whale} activity={activity} transactions={transactions} userRole={user.role} />
    </div>
  );
}
