"use client";

import * as React from "react";
import { usdToEur } from "@/lib/exchange";
import { ROUTES } from "@/lib/routes";
import { formatTimeEuropean, formatDurationMinutes, formatDateEuropean } from "@/lib/format";
import { Label, Input } from "@/components/ui/form";
import type { HomeShiftCardData } from "@/app/(dashboard)/home/page";
import type { MonthlyTarget } from "@/types";

type MonthlyTargetData = { target: MonthlyTarget; achievedUsd: number } | null;

type Props = {
  totalEarnedUsd: number;
  shiftCardData: HomeShiftCardData;
  assignedWhalesCount: number;
  monthlyTargetData?: MonthlyTargetData;
};

function formatLiveDurationMinutes(date: string, startTime: string | null): number {
  if (!date || !startTime?.trim()) return 0;
  const t = startTime.trim();
  const timePart = t.length >= 5 ? t.slice(0, 5) : t;
  const withSeconds = timePart.length === 5 && timePart.includes(":") ? `${timePart}:00` : timePart;
  const iso = `${date}T${withSeconds}`;
  const start = new Date(iso);
  if (Number.isNaN(start.getTime())) return 0;
  return Math.max(0, Math.floor((Date.now() - start.getTime()) / 60_000));
}

function formatDurationHHMM(totalMinutes: number): string {
  if (!Number.isFinite(totalMinutes) || totalMinutes < 0) return "0:00";
  const h = Math.floor(totalMinutes / 60);
  const m = Math.round(totalMinutes % 60);
  return `${h}:${m.toString().padStart(2, "0")}`;
}

export function ChatterHomeClient({
  totalEarnedUsd,
  shiftCardData,
  assignedWhalesCount,
  monthlyTargetData = null,
}: Props) {
  const [revenueUsd, setRevenueUsd] = React.useState("");
  const [chatterPct, setChatterPct] = React.useState("");

  const rev = parseFloat(revenueUsd) || 0;
  const pct = parseFloat(chatterPct) || 0;
  const onlyfansFee = rev * 0.2;
  const netAfterOnlyfans = rev * 0.8;
  const chatterEarnings = netAfterOnlyfans * (pct / 100);
  const eurAmount = usdToEur(chatterEarnings);
  const totalEarnedEur = usdToEur(totalEarnedUsd);

  const [liveDurationMinutes, setLiveDurationMinutes] = React.useState(0);
  const liveData = shiftCardData.kind === "live" ? shiftCardData : null;
  React.useEffect(() => {
    if (!liveData) return;
    const tick = () =>
      setLiveDurationMinutes(formatLiveDurationMinutes(liveData.date, liveData.startTime));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [liveData]);

  return (
    <>
      <section className="space-y-6">
        {/* Monthly target hero card */}
        {monthlyTargetData ? (
          <div
            className="block rounded-2xl border border-white/10 bg-black/60 p-6 shadow-[0_0_32px_-8px_rgba(236,72,153,0.12)] backdrop-blur-xl"
            style={{ boxShadow: "0 0 0 1px rgba(255,255,255,0.06), 0 24px 48px -12px rgba(0,0,0,0.5)" }}
          >
            <p className="text-xs font-semibold uppercase tracking-wider text-white/50">Monthly target</p>
            <p className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">
              ${monthlyTargetData.achievedUsd.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / ${monthlyTargetData.target.target_amount_usd.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-4">
              <span className="text-lg font-semibold text-[hsl(330,90%,75%)]">
                {monthlyTargetData.target.target_amount_usd > 0
                  ? Math.min(100, Math.round((monthlyTargetData.achievedUsd / monthlyTargetData.target.target_amount_usd) * 100))
                  : 0}%
              </span>
              <span className="text-sm text-white/70">
                ${Math.max(0, monthlyTargetData.target.target_amount_usd - monthlyTargetData.achievedUsd).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} left
              </span>
            </div>
            <div className="mt-4 h-3 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-[hsl(330,80%,55%)] transition-all duration-500"
                style={{
                  width: `${monthlyTargetData.target.target_amount_usd > 0
                    ? Math.min(100, (monthlyTargetData.achievedUsd / monthlyTargetData.target.target_amount_usd) * 100)
                    : 0}%`,
                }}
              />
            </div>
          </div>
        ) : (
          <div
            className="block rounded-2xl border border-white/10 bg-black/40 p-6 backdrop-blur-xl"
            style={{ boxShadow: "0 0 0 1px rgba(255,255,255,0.04)" }}
          >
            <p className="text-xs font-semibold uppercase tracking-wider text-white/50">Monthly target</p>
            <p className="mt-3 text-xl font-medium text-white/60">No monthly target set yet</p>
          </div>
        )}

        <a
          href={ROUTES.chatter.logTransaction}
          className="glass-card block p-6 shadow-[0_0_32px_-8px_rgba(236,72,153,0.15)] transition-all hover:border-[hsl(330,80%,55%)]/30 hover:shadow-[0_0_40px_-6px_rgba(236,72,153,0.2)]"
        >
          <p className="text-sm font-medium uppercase tracking-wider text-white/50">Total earned</p>
          <p className="mt-2 text-4xl font-bold tracking-tight text-white sm:text-5xl">
            {typeof totalEarnedUsd !== "number" || Number.isNaN(totalEarnedUsd)
              ? "—"
              : `$${totalEarnedUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          </p>
          <p className="mt-1 text-sm text-white/50">
            {typeof totalEarnedUsd !== "number" || Number.isNaN(totalEarnedUsd)
              ? "—"
              : `≈ €${totalEarnedEur.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          </p>
        </a>

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="glass-card p-6">
            <h2 className="mb-4 text-lg font-medium text-white">Mini earnings calculator</h2>
            <div className="space-y-4">
              <div>
                <Label className="text-white/70">Revenue (USD)</Label>
                <Input
                  type="number"
                  min={0}
                  step={0.01}
                  value={revenueUsd}
                  onChange={(e) => setRevenueUsd(e.target.value)}
                  placeholder="1000"
                />
              </div>
              <div>
                <Label className="text-white/70">Chatter %</Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  step={1}
                  value={chatterPct}
                  onChange={(e) => setChatterPct(e.target.value)}
                />
              </div>
              <div className="space-y-2 rounded-xl border border-white/10 bg-white/5 p-4">
                <Row label="Gross revenue (USD)" value={`$${rev.toFixed(2)}`} />
                <Row label="OnlyFans fee (20%)" value={`$${onlyfansFee.toFixed(2)}`} />
                <Row label="Remaining after OF" value={`$${netAfterOnlyfans.toFixed(2)}`} />
                <Row label="Chatter %" value={`${pct}%`} />
                <Row label="Chatter earnings (USD)" value={`$${chatterEarnings.toFixed(2)}`} highlight />
                <Row label="≈ EUR" value={`€${eurAmount.toFixed(2)}`} sub />
              </div>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 content-start">
            <ShiftCard data={shiftCardData} liveDurationMinutes={liveDurationMinutes} />
            <a
              href={ROUTES.chatter.myWhales}
              className="glass-card flex flex-col p-5 transition-all hover:bg-white/[0.08] hover:shadow-[0_0_24px_-4px_rgba(236,72,153,0.12)]"
            >
              <p className="text-sm font-medium text-white/60">Assigned whales</p>
              <p className="mt-1 text-2xl font-semibold text-white">{assignedWhalesCount}</p>
            </a>
          </div>
        </div>
      </section>
    </>
  );
}

function ShiftCard({
  data,
  liveDurationMinutes,
}: {
  data: HomeShiftCardData;
  liveDurationMinutes: number;
}) {
  if (data.kind === "live") {
    const startedAt = formatTimeEuropean(data.startTime);
    const durationStr = formatDurationHHMM(liveDurationMinutes);
    const modelsLabel = data.modelNames.length > 0 ? data.modelNames.join(", ") : "—";
    return (
      <a
        href={ROUTES.chatter.shift}
        className="glass-card flex flex-col p-5 transition-all hover:bg-white/[0.08] hover:shadow-[0_0_24px_-4px_rgba(236,72,153,0.12)]"
      >
        <p className="text-sm font-medium text-white/60">Shift</p>
        <p className="mt-1 text-lg font-semibold text-emerald-300">Live now</p>
        <div className="mt-2 space-y-1 text-sm text-white/80">
          <p>Started {startedAt}</p>
          <p>Duration {durationStr}</p>
          <p>Models: {modelsLabel}</p>
        </div>
      </a>
    );
  }
  if (data.kind === "last") {
    const dateStr = formatDateEuropean(data.date);
    const durationStr = formatDurationMinutes(data.durationMinutes);
    const modelsLabel = data.modelNames.length > 0 ? data.modelNames.join(", ") : "—";
    return (
      <a
        href={ROUTES.chatter.shift}
        className="glass-card flex flex-col p-5 transition-all hover:bg-white/[0.08] hover:shadow-[0_0_24px_-4px_rgba(236,72,153,0.12)]"
      >
        <p className="text-sm font-medium text-white/60">Shift</p>
        <p className="mt-1 text-lg font-semibold text-white/90">Last shift</p>
        <div className="mt-2 space-y-1 text-sm text-white/80">
          <p>{dateStr}</p>
          <p>Duration {durationStr}</p>
          <p>Models: {modelsLabel}</p>
        </div>
      </a>
    );
  }
  return (
    <a
      href={ROUTES.chatter.shift}
      className="glass-card flex flex-col p-5 transition-all hover:bg-white/[0.08] hover:shadow-[0_0_24px_-4px_rgba(236,72,153,0.12)]"
    >
      <p className="text-sm font-medium text-white/60">Shift</p>
      <p className="mt-1 text-2xl font-semibold text-white/70">No shifts yet</p>
    </a>
  );
}

function Row({
  label,
  value,
  highlight,
  sub,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  sub?: boolean;
}) {
  return (
    <div className="flex justify-between text-sm">
      <span className={sub ? "text-white/50" : "text-white/70"}>{label}</span>
      <span
        className={
          highlight
            ? "font-semibold text-[hsl(330,90%,65%)]"
            : sub
              ? "text-white/50"
              : "text-white/90"
        }
      >
        {value}
      </span>
    </div>
  );
}
