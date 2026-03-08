import { redirect } from "next/navigation";
import { getSessionFromCookies } from "@/lib/auth";
import { ROUTES } from "@/lib/routes";
import { getWhalesByChatter } from "@/services/whales";
import { listTransactionsByChatter } from "@/services/whale-transactions";
import { FormCard } from "@/components/ui/form";
import { LogTransactionForm } from "@/components/log-transaction-form";
import { WhaleSessionHistory } from "@/components/whale-session-history";

export default async function LogTransactionPage() {
  const user = await getSessionFromCookies();
  if (!user || user.role !== "chatter") redirect(ROUTES.dashboard);

  const chatterId = user.airtableUserId ?? user.id;
  const chatterName = user.fullName ?? user.email;
  const [whales, transactions] = await Promise.all([
    getWhalesByChatter(chatterId).catch(() => []),
    listTransactionsByChatter(chatterId, 50).catch(() => []),
  ]);
  if (process.env.NODE_ENV !== "production") {
    console.log("[log-transaction page] history debug", {
      currentUserEmail: user.email,
      currentUserId: user.id,
      currentAirtableUserRecordId: user.airtableUserId ?? "(null)",
      chatterIdUsedForFilter: chatterId,
      previousSessionsCount: transactions.length,
    });
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_1.2fr]">
      <div className="min-w-0">
        <FormCard title="Whale session" subtitle="Record a session with a whale">
          <LogTransactionForm
            chatterRecordId={chatterId}
            chatterName={chatterName ?? ""}
            whales={whales.map((w) => ({
              id: w.id,
              username: w.username,
              assigned_model_id: w.assigned_model_id,
              assigned_model_name: w.assigned_model_name,
            }))}
          />
        </FormCard>
      </div>
      <div className="min-w-0">
        <WhaleSessionHistory transactions={transactions} />
      </div>
    </div>
  );
}
