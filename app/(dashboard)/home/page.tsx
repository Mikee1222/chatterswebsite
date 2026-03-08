import { redirect } from "next/navigation";
import { getSessionFromCookies } from "@/lib/auth";
import { ROUTES } from "@/lib/routes";
import { getWhalesByChatter } from "@/services/whales";
import { getActiveShiftByChatter, getShiftsByChatter, listShiftModels } from "@/services/shifts";
import { listTransactionsByChatter } from "@/services/whale-transactions";
import { getMonthlyTargetByTeamMemberAndMonth } from "@/services/monthly-targets";
import { transactionTypeLabel } from "@/lib/airtable-options";
import { eurToUsd } from "@/lib/exchange";
import { formatDateEuropean, displayName } from "@/lib/format";
import { ChatterHomeClient } from "@/components/chatter-home-client";
import type { WhaleTransaction } from "@/types";

export type HomeShiftCardData =
  | {
      kind: "live";
      date: string;
      startTime: string | null;
      modelsCount: number;
      modelNames: string[];
    }
  | {
      kind: "last";
      date: string;
      durationMinutes: number | null;
      modelNames: string[];
    }
  | { kind: "none" };

async function getHomeShiftCardData(chatterId: string): Promise<HomeShiftCardData> {
  const activeShift = await getActiveShiftByChatter(chatterId).catch(() => null);
  if (activeShift) {
    const shiftModels = await listShiftModels(activeShift.id).catch(() => []);
    const modelNames = shiftModels.map((sm) => sm.model_name?.trim()).filter(Boolean) as string[];
    const startTime = activeShift.start_time ?? null;
    return {
      kind: "live",
      date: activeShift.date ?? "",
      startTime,
      modelsCount: activeShift.models_count ?? 0,
      modelNames,
    };
  }
  const shifts = await getShiftsByChatter(chatterId, "chatter").catch(() => []);
  const completed = shifts.filter((s) => s.status === "completed");
  const sorted = [...completed].sort((a, b) => {
    const d = (b.date ?? "").localeCompare(a.date ?? "");
    if (d !== 0) return d;
    return (b.updated_at ?? "").localeCompare(a.updated_at ?? "");
  });
  const lastShift = sorted[0];
  if (!lastShift) return { kind: "none" };
  const shiftModels = await listShiftModels(lastShift.id).catch(() => []);
  const modelNames = shiftModels.map((sm) => sm.model_name?.trim()).filter(Boolean) as string[];
  const durationMinutes = lastShift.worked_minutes ?? lastShift.total_minutes ?? null;
  return {
    kind: "last",
    date: lastShift.date ?? "",
    durationMinutes,
    modelNames,
  };
}

export default async function ChatterHomePage() {
  const user = await getSessionFromCookies();
  if (!user || user.role !== "chatter") redirect(ROUTES.dashboard);

  const chatterId = user.airtableUserId ?? user.id;
  const now = new Date();
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const [whales, shiftCardData, transactions, monthlyTarget] = await Promise.all([
    getWhalesByChatter(chatterId).catch(() => []),
    getHomeShiftCardData(chatterId),
    listTransactionsByChatter(chatterId, 10000).catch(() => []),
    getMonthlyTargetByTeamMemberAndMonth(chatterId, currentMonthKey).catch(() => null),
  ]);

  const assignedWhalesCount = whales.length;

  const totalEarnedUsd = transactions.reduce((sum: number, tx: WhaleTransaction) => {
    const amountUsd = tx.currency === "eur" ? eurToUsd(tx.amount) : tx.amount;
    return sum + amountUsd;
  }, 0);

  const transactionsThisMonth = transactions.filter((tx) => tx.date && tx.date.startsWith(currentMonthKey));
  const achievedThisMonthUsd = transactionsThisMonth.reduce((sum: number, tx: WhaleTransaction) => {
    const amountUsd = tx.currency === "eur" ? eurToUsd(tx.amount) : tx.amount;
    return sum + amountUsd;
  }, 0);

  const monthlyTargetData =
    monthlyTarget && (monthlyTarget.is_active ?? true)
      ? { target: monthlyTarget, achievedUsd: achievedThisMonthUsd }
      : null;

  return (
    <div className="space-y-8">
      <div
        className="rounded-2xl border border-white/10 bg-black/40 px-6 py-5 backdrop-blur-xl"
        style={{ boxShadow: "0 0 0 1px rgba(255,255,255,0.05), 0 0 32px -8px hsl(330 80% 55% / 0.08)" }}
      >
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/40">Dashboard</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white md:text-3xl">
          Welcome back{user.fullName ? `, ${user.fullName.split(" ")[0]}` : ""}
        </h1>
        <p className="mt-1 text-white/60">Your chatter dashboard</p>
      </div>

      <ChatterHomeClient
        totalEarnedUsd={totalEarnedUsd}
        shiftCardData={shiftCardData}
        assignedWhalesCount={assignedWhalesCount}
        monthlyTargetData={monthlyTargetData}
      />

      <section>
        <div
          className="overflow-hidden rounded-2xl border border-white/10 bg-black/40 backdrop-blur-xl"
          style={{ boxShadow: "0 0 0 1px rgba(255,255,255,0.05), 0 0 32px -8px hsl(330 80% 55% / 0.06)" }}
        >
          <div className="border-b border-white/10 bg-white/[0.04] px-5 py-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-white/90">Recent activity</h2>
          </div>
          {transactions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <p className="text-sm text-white/50">No recent transactions</p>
            </div>
          ) : (
            <ul className="divide-y divide-white/5">
              {transactions.slice(0, 8).map((tx: WhaleTransaction) => (
                <li key={tx.id} className="flex items-center justify-between px-4 py-3">
                  <div>
                    <p className="font-medium text-white/90">{displayName(tx.whale_username)}</p>
                    <p className="text-xs text-white/50">
                      {formatDateEuropean(tx.date)} · {transactionTypeLabel(tx.type)} · {tx.amount} {tx.currency}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
