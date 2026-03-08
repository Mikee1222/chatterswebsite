import { Suspense } from "react";
import { getSessionFromCookies } from "@/lib/auth";
import { ROUTES } from "@/lib/routes";
import { redirect } from "next/navigation";
import { listAllWhaleTransactions } from "@/services/whale-transactions";
import { getActiveShifts, getShiftsForMonth } from "@/services/shifts";
import { listAllModelss } from "@/services/modelss";
import { listAllCustomRequests } from "@/services/custom-requests";
import { listAllUsers } from "@/services/users";
import { eurToUsd } from "@/lib/exchange";
import { AdminHomeClient } from "@/components/admin-home-client";
import type { WhaleTransaction } from "@/types";

function filterByMonth(transactions: WhaleTransaction[], yearMonth: string): WhaleTransaction[] {
  if (!yearMonth || yearMonth.length < 7) return transactions;
  return transactions.filter((t) => t.date && t.date.startsWith(yearMonth));
}

/** Convert amount to USD for aggregation (all totals in USD). */
function toUsd(t: WhaleTransaction): number {
  const amt = t.amount ?? 0;
  return t.currency === "eur" ? eurToUsd(amt) : amt;
}

function aggregateRevenue(transactions: WhaleTransaction[]) {
  const totalRevenue = transactions.reduce((s, t) => s + toUsd(t), 0);
  const sessionCount = transactions.length;
  const byModel: Record<string, number> = {};
  const byChatter: Record<string, number> = {};
  const byDay: Record<string, number> = {};
  for (const t of transactions) {
    const amountUsd = toUsd(t);
    const modelKey = t.model_name?.trim() || "—";
    byModel[modelKey] = (byModel[modelKey] ?? 0) + amountUsd;
    const chatterKey = t.chatter_name?.trim() || "—";
    byChatter[chatterKey] = (byChatter[chatterKey] ?? 0) + amountUsd;
    const day = t.date ?? "";
    if (day) byDay[day] = (byDay[day] ?? 0) + amountUsd;
  }
  const topModel = Object.entries(byModel).sort((a, b) => b[1] - a[1])[0];
  const topChatter = Object.entries(byChatter).sort((a, b) => b[1] - a[1])[0];
  return {
    totalRevenue,
    sessionCount,
    topModelName: topModel?.[0] ?? "—",
    topModelRevenue: topModel?.[1] ?? 0,
    topChatterName: topChatter?.[0] ?? "—",
    topChatterRevenue: topChatter?.[1] ?? 0,
    byModel: Object.entries(byModel).sort((a, b) => b[1] - a[1]),
    byChatter: Object.entries(byChatter).sort((a, b) => b[1] - a[1]),
    byDay: Object.entries(byDay).sort(([a], [b]) => a.localeCompare(b)),
  };
}

export default async function AdminHomePage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const user = await getSessionFromCookies();
  if (!user || (user.role !== "admin" && user.role !== "manager")) redirect(ROUTES.dashboard);

  const params = await searchParams;
  const monthParam = params.month?.trim() || "";
  const now = new Date();
  const currentYearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const yearMonth = /^\d{4}-\d{2}$/.test(monthParam) ? monthParam : currentYearMonth;

  const [allTransactions, chatterShifts, vaShifts, shiftsThisMonth, modelss, customs, users] = await Promise.all([
    listAllWhaleTransactions().catch(() => []),
    getActiveShifts("chatter").catch(() => []),
    getActiveShifts("virtual_assistant").catch(() => []),
    getShiftsForMonth(yearMonth).catch(() => []),
    listAllModelss().catch(() => []),
    listAllCustomRequests().catch(() => []),
    listAllUsers().catch(() => []),
  ]);
  const chatters = users.filter((u) => u.role === "chatter").map((u) => ({ id: u.id, full_name: u.full_name ?? "" }));

  const filtered = filterByMonth(allTransactions, yearMonth);
  const stats = aggregateRevenue(filtered);
  const freeCount = modelss.filter((m) => m.current_status === "free").length;
  const takenCount = modelss.length - freeCount;
  const pendingCustoms = customs.filter((c) => c.status === "pending").length;

  const chatterHoursThisMonth = shiftsThisMonth
    .filter((s) => s.staff_role === "chatter")
    .reduce((sum, s) => sum + (s.total_hours_decimal ?? 0), 0);
  const vaHoursThisMonth = shiftsThisMonth
    .filter((s) => s.staff_role === "virtual_assistant")
    .reduce((sum, s) => sum + (s.total_hours_decimal ?? 0), 0);
  const avgRevenuePerSession =
    stats.sessionCount > 0 ? stats.totalRevenue / stats.sessionCount : 0;

  return (
    <Suspense fallback={<div className="text-white/60">Loading…</div>}>
      <AdminHomeClient
        chatters={chatters}
        yearMonth={yearMonth}
        totalRevenue={stats.totalRevenue}
        sessionCount={stats.sessionCount}
        avgRevenuePerSession={avgRevenuePerSession}
        topModelName={stats.topModelName}
        topModelRevenue={stats.topModelRevenue}
        topChatterName={stats.topChatterName}
        topChatterRevenue={stats.topChatterRevenue}
        byModel={stats.byModel}
        byChatter={stats.byChatter}
        byDay={stats.byDay}
        activeChatterShifts={chatterShifts.length}
        activeVaShifts={vaShifts.length}
        chatterHoursThisMonth={chatterHoursThisMonth}
        vaHoursThisMonth={vaHoursThisMonth}
        freeModelsCount={freeCount}
        takenModelsCount={takenCount}
        pendingCustomsCount={pendingCustoms}
      />
    </Suspense>
  );
}
