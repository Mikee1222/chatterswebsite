import { redirect } from "next/navigation";
import { getEffectiveStaffRole } from "@/lib/staff-session-role";
import { getSessionFromCookies } from "@/lib/auth";
import { ROUTES } from "@/lib/routes";
import { getWhalesByChatter } from "@/services/whales";
import { getActiveShiftByChatter, getShiftsByChatter, listShiftModels } from "@/services/shifts";
import { listTransactionsByChatter } from "@/services/whale-transactions";
import { getMonthlyTargetByTeamMemberAndMonth } from "@/services/monthly-targets";
import { transactionTypeLabel } from "@/lib/airtable-options";
import { formatDateEuropean, displayName } from "@/lib/format";
import { getNowInAthens } from "@/lib/airtable-datetime";
import { ChatterHomeClient } from "@/components/chatter-home-client";
import { ChatterHomePageClient } from "@/components/chatter-home-page-client";
import { SopResumeBanner } from "@/components/sop-resume-banner";
import { getAcademyResumeForMember } from "@/lib/sop-academy";
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
  if (!user || getEffectiveStaffRole(user) !== "chatter") redirect(ROUTES.dashboard);

  const chatterId = user.airtableUserId ?? user.id;
  const athens = getNowInAthens();
  const currentMonthKey = `${athens.getUTCFullYear()}-${String(athens.getUTCMonth() + 1).padStart(2, "0")}`;

  const [whales, shiftCardData, transactions, monthlyTarget, sopResume] = await Promise.all([
    getWhalesByChatter(chatterId).catch(() => []),
    getHomeShiftCardData(chatterId),
    listTransactionsByChatter(chatterId, 10000).catch(() => []),
    getMonthlyTargetByTeamMemberAndMonth(chatterId, currentMonthKey).catch(() => null),
    getAcademyResumeForMember(chatterId, {
      airtableUserId: user.airtableUserId,
      memberRole: user.role,
      secondaryRole: "chatter",
    }).catch(() => null),
  ]);

  const assignedWhalesCount = whales.length;

  let eurToUsdRate = 1.087; // fallback
  try {
    const fxRes = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL ?? "https://www.gunzoteam.com"}/api/client/fx?base=EUR&quote=USD`,
      { next: { revalidate: 3600 } }
    );
    if (fxRes.ok) {
      const fxData = await fxRes.json() as { rate: number };
      if (fxData.rate && fxData.rate > 0) eurToUsdRate = fxData.rate;
    }
  } catch {
    // keep fallback
  }

  const totalEarnedUsd = transactions.reduce((sum: number, tx: WhaleTransaction) => {
    const amountUsd = tx.currency === "eur" ? tx.amount * eurToUsdRate : tx.amount;
    return sum + amountUsd;
  }, 0);

  const transactionsThisMonth = transactions.filter((tx) => tx.date && tx.date.startsWith(currentMonthKey));
  const achievedThisMonthUsd = transactionsThisMonth.reduce((sum: number, tx: WhaleTransaction) => {
    const amountUsd = tx.currency === "eur" ? tx.amount * eurToUsdRate : tx.amount;
    return sum + amountUsd;
  }, 0);

  const monthlyTargetData =
    monthlyTarget && (monthlyTarget.is_active ?? true)
      ? { target: monthlyTarget, achievedUsd: achievedThisMonthUsd }
      : null;

  return (
    <ChatterHomePageClient>
      <div
        className="rounded-2xl border border-pink-500/15 bg-gradient-to-br from-pink-500/[0.08] via-black/45 to-fuchsia-950/25 px-6 py-6 backdrop-blur-xl transition-shadow duration-300 hover:border-pink-400/25 hover:shadow-[0_0_40px_-8px_hsl(330_80%_55%/0.2)]"
        style={{ boxShadow: "0 0 0 1px rgba(255,255,255,0.06), 0 0 36px -10px hsl(330 80% 55% / 0.12)" }}
      >
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-pink-200/50">Dashboard</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white md:text-3xl">
          Welcome back{user.fullName ? `, ${user.fullName.split("")[0]}` : ""}
        </h1>
        <p className="mt-1.5 text-[15px] text-white/65">Your chatter dashboard</p>
      </div>

      {sopResume ? <SopResumeBanner resume={sopResume} /> : null}

      <ChatterHomeClient
        totalEarnedUsd={totalEarnedUsd}
        shiftCardData={shiftCardData}
        assignedWhalesCount={assignedWhalesCount}
        monthlyTargetData={monthlyTargetData}
      />

      <section>
        <div
          className="overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.06] to-black/50 backdrop-blur-xl transition-shadow duration-300 hover:border-pink-500/20 hover:shadow-[0_12px_40px_-12px_hsl(330_80%_55%/0.15)]"
          style={{ boxShadow: "0 0 0 1px rgba(255,255,255,0.05), 0 0 32px -8px hsl(330 80% 55% / 0.08)" }}
        >
          <div className="border-b border-white/10 bg-gradient-to-r from-pink-500/10 to-transparent px-5 py-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-white/90">Recent activity</h2>
          </div>
          {transactions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <p className="text-sm text-white/50">No recent transactions</p>
            </div>
          ) : (
            <ul className="divide-y divide-white/5">
              {transactions.slice(0, 8).map((tx: WhaleTransaction) => (
                <li
                  key={tx.id}
                  className="flex items-center justify-between px-4 py-3 transition-colors duration-200 hover:bg-white/[0.04]"
                >
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
    </ChatterHomePageClient>
  );
}
