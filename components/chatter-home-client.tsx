"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Calculator, Clock, Fish } from "lucide-react";
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

const easeOut = [0.22, 1, 0.36, 1] as const;

const hoverLift = {
  scale: 1.02,
  transition: { type: "spring", stiffness: 380, damping: 28 },
} as const;

function Reveal({
  children,
  delay = 0,
  className = "",
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: easeOut, delay }}
    >
      {children}
    </motion.div>
  );
}

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

  const totalValid = typeof totalEarnedUsd === "number" && !Number.isNaN(totalEarnedUsd);
  const eurLabel = totalValid
    ? `≈ €${totalEarnedEur.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : "—";

  return (
    <section className="space-y-8">
      {monthlyTargetData ? (
        <Reveal delay={0}>
          <motion.div
            whileHover={hoverLift}
            className="group block rounded-2xl border border-pink-500/15 bg-gradient-to-br from-pink-500/[0.12] via-black/55 to-fuchsia-950/30 p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.05)] backdrop-blur-xl transition-shadow duration-300 hover:border-pink-400/25 hover:shadow-[0_20px_48px_-14px_hsl(330_80%_55%/0.28)]"
          >
            <p className="text-xs font-semibold uppercase tracking-wider text-pink-200/55">Monthly target</p>
            <p className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">
              ${monthlyTargetData.achievedUsd.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{""}
              <span className="text-white/35">/</span>{""}
              ${monthlyTargetData.target.target_amount_usd.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-4">
              <span className="text-lg font-semibold text-[hsl(330,90%,78%)]">
                {monthlyTargetData.target.target_amount_usd > 0
                  ? Math.min(100, Math.round((monthlyTargetData.achievedUsd / monthlyTargetData.target.target_amount_usd) * 100))
                  : 0}
                %
              </span>
              <span className="text-sm text-white/70">
                $
                {Math.max(0, monthlyTargetData.target.target_amount_usd - monthlyTargetData.achievedUsd).toLocaleString("en-US", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}{""}
                left
              </span>
            </div>
            <div className="mt-4 h-3 overflow-hidden rounded-full bg-white/10">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-pink-500 to-fuchsia-500"
                initial={{ width: 0 }}
                animate={{
                  width: `${monthlyTargetData.target.target_amount_usd > 0
                    ? Math.min(100, (monthlyTargetData.achievedUsd / monthlyTargetData.target.target_amount_usd) * 100)
                    : 0}%`,
                }}
                transition={{ duration: 0.9, ease: easeOut, delay: 0.28 }}
              />
            </div>
          </motion.div>
        </Reveal>
      ) : (
        <Reveal delay={0}>
          <motion.div
            whileHover={hoverLift}
            className="block rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.05] to-black/60 p-6 backdrop-blur-xl transition-shadow duration-300 hover:border-pink-500/20 hover:shadow-[0_16px_40px_-12px_hsl(330_80%_55%/0.12)]"
          >
            <p className="text-xs font-semibold uppercase tracking-wider text-white/50">Monthly target</p>
            <p className="mt-3 text-xl font-medium text-white/60">No monthly target set yet</p>
          </motion.div>
        </Reveal>
      )}

      <Reveal delay={0.09}>
        <motion.a
          href={ROUTES.chatter.logTransaction}
          whileHover={hoverLift}
          className="group block rounded-2xl border border-pink-500/25 bg-gradient-to-br from-pink-500/[0.14] via-black/50 to-fuchsia-950/35 p-7 shadow-[0_0_0_1px_rgba(255,255,255,0.06)] backdrop-blur-xl transition-shadow duration-300 hover:border-pink-400/40 hover:shadow-[0_24px_56px_-12px_hsl(330_85%_55%/0.35)]"
        >
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-pink-200/70">Total earned</p>
          <motion.p
            className="mt-3 text-5xl font-bold tracking-tight text-white sm:text-6xl"
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: "spring", stiffness: 140, damping: 20, delay: 0.2 }}
          >
            {!totalValid ? "—" : `$${totalEarnedUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          </motion.p>
          <motion.p
            className="mt-2 text-lg font-medium text-pink-100/85 sm:text-xl"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: easeOut, delay: 0.42 }}
          >
            {eurLabel}
          </motion.p>
          <p className="mt-2 text-sm text-white/45">Tap to log a whale session</p>
        </motion.a>
      </Reveal>

      <div className="grid gap-8 lg:grid-cols-2">
        <Reveal delay={0.18}>
          <motion.div
            whileHover={hoverLift}
            className="glass-card h-full rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.07] via-black/40 to-pink-950/20 p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] transition-shadow duration-300 hover:border-pink-500/20 hover:shadow-[0_18px_44px_-14px_hsl(330_80%_55%/0.2)]"
          >
            <div className="mb-4 flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-pink-500/20 text-pink-200">
                <Calculator className="h-5 w-5" aria-hidden />
              </span>
              <h2 className="text-lg font-semibold text-white">Mini earnings calculator</h2>
            </div>
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
              <div className="space-y-2 rounded-xl border border-pink-500/10 bg-black/30 p-4">
                <Row label="Gross revenue (USD)" value={`$${rev.toFixed(2)}`} />
                <Row label="OnlyFans fee (20%)" value={`$${onlyfansFee.toFixed(2)}`} />
                <Row label="Remaining after OF" value={`$${netAfterOnlyfans.toFixed(2)}`} />
                <Row label="Chatter %" value={`${pct}%`} />
                <Row label="Chatter earnings (USD)" value={`$${chatterEarnings.toFixed(2)}`} highlight />
                <Row label="≈ EUR" value={`€${eurAmount.toFixed(2)}`} sub />
              </div>
            </div>
          </motion.div>
        </Reveal>

        <div className="grid gap-5 sm:grid-cols-2 content-start">
          <Reveal delay={0.26}>
            <ShiftCard data={shiftCardData} liveDurationMinutes={liveDurationMinutes} />
          </Reveal>
          <Reveal delay={0.34}>
            <motion.a
              href={ROUTES.chatter.myWhales}
              whileHover={hoverLift}
              className="glass-card flex h-full min-h-[140px] flex-col rounded-2xl border border-white/10 bg-gradient-to-br from-cyan-950/20 via-black/45 to-pink-950/25 p-5 transition-shadow duration-300 hover:border-pink-500/25 hover:shadow-[0_18px_44px_-14px_hsl(330_80%_55%/0.22)]"
            >
              <div className="flex items-center gap-3">
                <span
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-pink-500/20 text-lg"
                  aria-hidden
                >
                  <Fish className="h-5 w-5 text-cyan-300" aria-hidden />
                </span>
                <p className="text-sm font-medium text-white/65">Assigned whales</p>
              </div>
              <p className="mt-3 text-3xl font-bold tabular-nums text-white">{assignedWhalesCount}</p>
            </motion.a>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

function ShiftCard({
  data,
  liveDurationMinutes,
}: {
  data: HomeShiftCardData;
  liveDurationMinutes: number;
}) {
  const iconWrap = (
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-pink-500/20 text-pink-200">
      <Clock className="h-5 w-5" aria-hidden />
    </span>
  );

  if (data.kind === "live") {
    const startedAt = formatTimeEuropean(data.startTime);
    const durationStr = formatDurationHHMM(liveDurationMinutes);
    const modelsLabel = data.modelNames.length > 0 ? data.modelNames.join(", ") : "—";
    return (
      <motion.a
        href={ROUTES.chatter.shift}
        whileHover={hoverLift}
        className="glass-card flex h-full min-h-[140px] flex-col rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-950/30 via-black/50 to-black/70 p-5 transition-shadow duration-300 hover:border-emerald-400/35 hover:shadow-[0_18px_44px_-14px_rgba(52,211,153,0.18)]"
      >
        <div className="flex items-center gap-3">
          {iconWrap}
          <p className="text-sm font-medium text-white/65">Shift</p>
        </div>
        <p className="mt-2 text-lg font-semibold text-emerald-300">Live now</p>
        <div className="mt-2 space-y-1 text-sm text-white/80">
          <p>Started {startedAt}</p>
          <p>Duration {durationStr}</p>
          <p>Models: {modelsLabel}</p>
        </div>
      </motion.a>
    );
  }
  if (data.kind === "last") {
    const dateStr = formatDateEuropean(data.date);
    const durationStr = formatDurationMinutes(data.durationMinutes);
    const modelsLabel = data.modelNames.length > 0 ? data.modelNames.join(", ") : "—";
    return (
      <motion.a
        href={ROUTES.chatter.shift}
        whileHover={hoverLift}
        className="glass-card flex h-full min-h-[140px] flex-col rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.06] to-black/65 p-5 transition-shadow duration-300 hover:border-pink-500/25 hover:shadow-[0_18px_44px_-14px_hsl(330_80%_55%/0.2)]"
      >
        <div className="flex items-center gap-3">
          {iconWrap}
          <p className="text-sm font-medium text-white/65">Shift</p>
        </div>
        <p className="mt-2 text-lg font-semibold text-white/90">Last shift</p>
        <div className="mt-2 space-y-1 text-sm text-white/80">
          <p>{dateStr}</p>
          <p>Duration {durationStr}</p>
          <p>Models: {modelsLabel}</p>
        </div>
      </motion.a>
    );
  }
  return (
    <motion.a
      href={ROUTES.chatter.shift}
      whileHover={hoverLift}
      className="glass-card flex h-full min-h-[140px] flex-col rounded-2xl border border-dashed border-white/15 bg-gradient-to-br from-white/[0.04] to-black/60 p-5 transition-shadow duration-300 hover:border-pink-500/30 hover:shadow-[0_18px_44px_-14px_hsl(330_80%_55%/0.15)]"
    >
      <div className="flex items-center gap-3">
        {iconWrap}
        <p className="text-sm font-medium text-white/65">Shift</p>
      </div>
      <p className="mt-2 text-2xl font-semibold text-white/70">No shifts yet</p>
    </motion.a>
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
            ? "font-semibold text-[hsl(330,90%,68%)]"
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
