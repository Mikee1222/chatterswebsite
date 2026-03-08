"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Select, Label, Input, Textarea, ButtonPrimary, ButtonSecondary, selectOptionClass } from "@/components/ui/form";
import { adminHomeUrl } from "@/lib/routes";
import { upsertMonthlyTargetAction } from "@/app/actions/monthly-targets";

type ChatterOption = { id: string; full_name: string };

type Props = {
  chatters: ChatterOption[];
  yearMonth: string;
  totalRevenue: number;
  sessionCount: number;
  avgRevenuePerSession: number;
  topModelName: string;
  topModelRevenue: number;
  topChatterName: string;
  topChatterRevenue: number;
  byModel: [string, number][];
  byChatter: [string, number][];
  byDay: [string, number][];
  activeChatterShifts: number;
  activeVaShifts: number;
  chatterHoursThisMonth: number;
  vaHoursThisMonth: number;
  freeModelsCount: number;
  takenModelsCount: number;
  pendingCustomsCount: number;
};

const MONTH_OPTIONS = (() => {
  const out: string[] = [];
  const now = new Date();
  for (let i = 0; i < 24; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return out;
})();

function formatMonth(ym: string): string {
  const [y, m] = ym.split("-");
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const month = monthNames[parseInt(m ?? "1", 10) - 1] ?? m;
  return `${month} ${y}`;
}

function BarRow({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-3 py-1.5">
      <span className="w-32 shrink-0 truncate text-sm text-white/80" title={label}>
        {label}
      </span>
      <div className="min-w-0 flex-1 rounded-full bg-white/10">
        <div
          className="h-2 rounded-full bg-[hsl(330,80%,55%)]/80 transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-20 shrink-0 text-right text-sm font-medium text-white/90">
        ${value.toLocaleString("en-US", { minimumFractionDigits: 2 })}
      </span>
    </div>
  );
}

export function AdminHomeClient(props: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [month, setMonth] = React.useState(props.yearMonth);
  const [targetModalOpen, setTargetModalOpen] = React.useState(false);
  const [targetTeamMember, setTargetTeamMember] = React.useState("");
  const [targetMonthKey, setTargetMonthKey] = React.useState(props.yearMonth);
  const [targetAmountUsd, setTargetAmountUsd] = React.useState("");
  const [targetNotes, setTargetNotes] = React.useState("");
  const [targetActive, setTargetActive] = React.useState(true);
  const [targetError, setTargetError] = React.useState<string | null>(null);
  const [targetSaving, setTargetSaving] = React.useState(false);

  React.useEffect(() => {
    setMonth(props.yearMonth);
  }, [props.yearMonth]);

  React.useEffect(() => {
    setTargetMonthKey(props.yearMonth);
  }, [props.yearMonth]);

  const handleMonthChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const v = e.target.value;
    setMonth(v);
    const params = new URLSearchParams(searchParams.toString());
    params.set("month", v);
    router.push(adminHomeUrl(Object.fromEntries(params.entries())));
  };

  const handleOpenTargetModal = () => {
    setTargetError(null);
    setTargetTeamMember("");
    setTargetMonthKey(props.yearMonth);
    setTargetAmountUsd("");
    setTargetNotes("");
    setTargetActive(true);
    setTargetModalOpen(true);
  };

  const handleSubmitMonthlyTarget = async (e: React.FormEvent) => {
    e.preventDefault();
    setTargetError(null);
    const teamMember = targetTeamMember.trim();
    const chatter = props.chatters.find((c) => c.id === teamMember);
    if (!teamMember || !chatter) {
      setTargetError("Please select a team member");
      return;
    }
    const amount = parseFloat(targetAmountUsd);
    if (Number.isNaN(amount) || amount < 0) {
      setTargetError("Enter a valid target amount (USD)");
      return;
    }
    setTargetSaving(true);
    const res = await upsertMonthlyTargetAction(
      teamMember,
      chatter.full_name,
      targetMonthKey,
      amount,
      { notes: targetNotes.trim() || undefined, is_active: targetActive }
    );
    setTargetSaving(false);
    if (res.success) {
      setTargetModalOpen(false);
      router.refresh();
    } else {
      setTargetError(res.error ?? "Failed to save");
    }
  };

  const maxModel = Math.max(1, ...props.byModel.map(([, v]) => v));
  const maxChatter = Math.max(1, ...props.byChatter.map(([, v]) => v));
  const maxDay = Math.max(1, ...props.byDay.map(([, v]) => v));

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white md:text-3xl">Admin control center</h1>
          <p className="mt-1 text-sm text-white/60">Whale earnings and operations overview</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleOpenTargetModal}
            className="rounded-2xl border border-[hsl(330,80%,55%)]/40 bg-[hsl(330,80%,55%)]/15 px-4 py-2.5 text-sm font-medium text-[hsl(330,90%,75%)] shadow-[0_0_20px_-6px_rgba(236,72,153,0.25)] transition-all hover:border-[hsl(330,80%,55%)]/60 hover:bg-[hsl(330,80%,55%)]/25 hover:shadow-[0_0_24px_-4px_rgba(236,72,153,0.3)]"
          >
            Set monthly target
          </button>
          <span className="text-sm text-white/55">Month</span>
          <Select
            value={month}
            onChange={handleMonthChange}
            className="min-w-[160px]"
          >
            {MONTH_OPTIONS.map((ym) => (
              <option key={ym} value={ym} className={selectOptionClass}>
                {formatMonth(ym)}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {/* Set monthly target modal */}
      {targetModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="monthly-target-title">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            aria-hidden
            onClick={() => !targetSaving && setTargetModalOpen(false)}
          />
          <div
            className="relative w-full max-w-md rounded-2xl border border-white/10 bg-black/95 shadow-2xl shadow-black/50 backdrop-blur-xl"
            style={{ boxShadow: "0 0 0 1px rgba(255,255,255,0.06), 0 24px 48px -12px rgba(0,0,0,0.6)" }}
          >
            <div className="border-b border-white/10 px-6 py-4">
              <h2 id="monthly-target-title" className="text-lg font-semibold text-white">Set monthly target</h2>
              <p className="mt-0.5 text-sm text-white/55">Target amount in USD for a chatter this month</p>
            </div>
            <form onSubmit={handleSubmitMonthlyTarget} className="p-6 space-y-4">
              {targetError && (
                <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200/95">
                  {targetError}
                </div>
              )}
              <div>
                <Label className="text-white/70">Team member</Label>
                <Select
                  value={targetTeamMember}
                  onChange={(e) => setTargetTeamMember(e.target.value)}
                  required
                  className="mt-1.5"
                >
                  <option value="" className={selectOptionClass}>Select chatter…</option>
                  {props.chatters.map((c) => (
                    <option key={c.id} value={c.id} className={selectOptionClass}>
                      {c.full_name || c.id}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label className="text-white/70">Month</Label>
                <Select
                  value={targetMonthKey}
                  onChange={(e) => setTargetMonthKey(e.target.value)}
                  className="mt-1.5"
                >
                  {MONTH_OPTIONS.map((ym) => (
                    <option key={ym} value={ym} className={selectOptionClass}>
                      {formatMonth(ym)}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label className="text-white/70">Target amount (USD)</Label>
                <Input
                  type="number"
                  min={0}
                  step={0.01}
                  value={targetAmountUsd}
                  onChange={(e) => setTargetAmountUsd(e.target.value)}
                  placeholder="5000"
                  className="mt-1.5"
                  required
                />
              </div>
              <div>
                <Label className="text-white/70">Notes (optional)</Label>
                <Textarea
                  value={targetNotes}
                  onChange={(e) => setTargetNotes(e.target.value)}
                  placeholder="Optional notes…"
                  rows={2}
                  className="mt-1.5"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="target-active"
                  checked={targetActive}
                  onChange={(e) => setTargetActive(e.target.checked)}
                  className="h-4 w-4 rounded border-white/20 bg-white/5 text-[hsl(330,80%,55%)] focus:ring-[hsl(330,80%,55%)]/40"
                />
                <Label htmlFor="target-active" className="text-white/70 font-normal">Active</Label>
              </div>
              <div className="flex gap-3 pt-2">
                <ButtonPrimary type="submit" disabled={targetSaving} className="flex-1">
                  {targetSaving ? "Saving…" : "Save"}
                </ButtonPrimary>
                <ButtonSecondary type="button" onClick={() => !targetSaving && setTargetModalOpen(false)}>
                  Cancel
                </ButtonSecondary>
              </div>
            </form>
          </div>
        </div>
      )}


      {/* Earnings section */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-white/50">Earnings (whale_transactions)</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="glass-card p-5">
            <p className="text-xs font-medium uppercase tracking-wider text-white/50">Total whale revenue</p>
            <p className="mt-2 text-2xl font-semibold text-[hsl(330,90%,75%)]">
              {typeof props.totalRevenue !== "number" || Number.isNaN(props.totalRevenue) || (props.sessionCount === 0 && props.totalRevenue === 0)
                ? "—"
                : `$${props.totalRevenue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            </p>
            <p className="mt-0.5 text-xs text-white/50">{formatMonth(month)}</p>
          </div>
          <div className="glass-card p-5">
            <p className="text-xs font-medium uppercase tracking-wider text-white/50">Whale sessions</p>
            <p className="mt-2 text-2xl font-semibold text-white">
              {typeof props.sessionCount !== "number" ? "—" : props.sessionCount}
            </p>
            <p className="mt-0.5 text-xs text-white/50">{formatMonth(month)}</p>
          </div>
          <div className="glass-card p-5">
            <p className="text-xs font-medium uppercase tracking-wider text-white/50">Avg revenue per session</p>
            <p className="mt-2 text-2xl font-semibold text-white/95">
              {props.sessionCount === 0 ? "—" : `$${props.avgRevenuePerSession.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            </p>
            <p className="mt-0.5 text-xs text-white/50">{formatMonth(month)}</p>
          </div>
          <div className="glass-card p-5">
            <p className="text-xs font-medium uppercase tracking-wider text-white/50">Top model by revenue</p>
            <p className="mt-2 truncate text-lg font-medium text-white/95" title={props.topModelName}>
              {props.sessionCount === 0 ? "—" : props.topModelName}
            </p>
            <p className="text-sm text-white/60">
              {props.sessionCount === 0 ? "—" : `$${(props.topModelRevenue ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            </p>
          </div>
          <div className="glass-card p-5">
            <p className="text-xs font-medium uppercase tracking-wider text-white/50">Top chatter by revenue</p>
            <p className="mt-2 truncate text-lg font-medium text-white/95" title={props.topChatterName}>
              {props.sessionCount === 0 ? "—" : props.topChatterName}
            </p>
            <p className="text-sm text-white/60">
              {props.sessionCount === 0 ? "—" : `$${(props.topChatterRevenue ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            </p>
          </div>
        </div>
      </section>

      {/* Charts */}
      <section className="grid gap-8 lg:grid-cols-3">
        <div className="glass-card overflow-hidden p-5 lg:col-span-2">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-white/60">Revenue by model</h3>
          <div className="mt-4 max-h-64 space-y-0 overflow-y-auto pr-2">
            {props.byModel.length === 0 ? (
              <p className="py-6 text-center text-sm text-white/50">No data for this month</p>
            ) : (
              props.byModel.slice(0, 12).map(([name, value]) => (
                <BarRow key={name} label={name} value={value} max={maxModel} />
              ))
            )}
          </div>
        </div>
        <div className="glass-card overflow-hidden p-5">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-white/60">Revenue by chatter</h3>
          <div className="mt-4 max-h-64 space-y-0 overflow-y-auto pr-2">
            {props.byChatter.length === 0 ? (
              <p className="py-6 text-center text-sm text-white/50">No data for this month</p>
            ) : (
              props.byChatter.slice(0, 10).map(([name, value]) => (
                <BarRow key={name} label={name} value={value} max={maxChatter} />
              ))
            )}
          </div>
        </div>
      </section>

      {/* Revenue trend within month */}
      <div className="glass-card overflow-hidden p-5">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-white/60">Revenue trend ({formatMonth(month)})</h3>
        <div className="mt-4 flex flex-wrap gap-4">
          {props.byDay.length === 0 ? (
            <p className="py-4 text-sm text-white/50">No daily data</p>
          ) : (
            props.byDay.slice(-14).map(([day, value]) => (
              <div key={day} className="flex flex-col items-center gap-1">
                <span className="text-xs text-white/50">
                  {day.slice(8)}/{day.slice(5, 7)}
                </span>
                <div
                  className="h-16 w-8 min-w-[2rem] rounded-t bg-[hsl(330,80%,55%)]/70 transition-all"
                  style={{ height: `${Math.max(4, maxDay > 0 ? (value / maxDay) * 64 : 0)}px` }}
                  title={`${day}: $${value.toFixed(2)}`}
                />
              </div>
            ))
          )}
        </div>
      </div>

      {/* Operations overview */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-white/50">Operations overview</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
          <div className="glass-card flex items-center gap-4 p-5">
            <div className="rounded-xl bg-emerald-500/20 p-3">
              <span className="text-2xl font-bold text-emerald-300">{props.activeChatterShifts}</span>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-white/50">Active chatter shifts</p>
              <p className="mt-0.5 text-sm text-white/90">Now</p>
            </div>
          </div>
          <div className="glass-card flex items-center gap-4 p-5">
            <div className="rounded-xl bg-[hsl(330,80%,55%)]/20 p-3">
              <span className="text-2xl font-bold text-[hsl(330,90%,75%)]">{props.activeVaShifts}</span>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-white/50">Active VA shifts</p>
              <p className="mt-0.5 text-sm text-white/90">Now</p>
            </div>
          </div>
          <div className="glass-card flex items-center gap-4 p-5">
            <div className="rounded-xl bg-white/10 p-3">
              <span className="text-2xl font-bold text-white/95">{props.chatterHoursThisMonth.toFixed(1)}</span>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-white/50">Chatter hours</p>
              <p className="mt-0.5 text-sm text-white/90">{formatMonth(month)}</p>
            </div>
          </div>
          <div className="glass-card flex items-center gap-4 p-5">
            <div className="rounded-xl bg-white/10 p-3">
              <span className="text-2xl font-bold text-white/95">{props.vaHoursThisMonth.toFixed(1)}</span>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-white/50">VA hours</p>
              <p className="mt-0.5 text-sm text-white/90">{formatMonth(month)}</p>
            </div>
          </div>
          <div className="glass-card flex items-center gap-4 p-5">
            <div className="rounded-xl bg-emerald-500/20 p-3">
              <span className="text-2xl font-bold text-emerald-300">{props.freeModelsCount}</span>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-white/50">Free models</p>
              <p className="mt-0.5 text-sm text-white/90">Now</p>
            </div>
          </div>
          <div className="glass-card flex items-center gap-4 p-5">
            <div className="rounded-xl bg-amber-500/20 p-3">
              <span className="text-2xl font-bold text-amber-300">{props.takenModelsCount}</span>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-white/50">Taken models</p>
              <p className="mt-0.5 text-sm text-white/90">Now</p>
            </div>
          </div>
          <div className="glass-card flex items-center gap-4 p-5">
            <div className="rounded-xl bg-sky-500/20 p-3">
              <span className="text-2xl font-bold text-sky-300">{props.pendingCustomsCount}</span>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-white/50">Pending customs</p>
              <p className="mt-0.5 text-sm text-white/90">To process</p>
            </div>
          </div>
        </div>
      </section>

      {/* Leaderboards */}
      <section className="grid gap-6 lg:grid-cols-2">
        <div className="glass-card overflow-hidden p-5">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-white/60">Top 5 chatters by revenue</h3>
          <ul className="mt-4 space-y-2">
            {props.byChatter.length === 0 ? (
              <li className="py-4 text-center text-sm text-white/50">No data for this month</li>
            ) : (
              props.byChatter.slice(0, 5).map(([name, value], i) => (
                <li key={name} className="flex items-center justify-between rounded-xl bg-white/5 px-4 py-2.5">
                  <span className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[hsl(330,80%,55%)]/30 text-xs font-bold text-[hsl(330,90%,75%)]">{i + 1}</span>
                    <span className="font-medium text-white/90">{name}</span>
                  </span>
                  <span className="text-sm font-semibold text-[hsl(330,90%,75%)]">${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </li>
              ))
            )}
          </ul>
        </div>
        <div className="glass-card overflow-hidden p-5">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-white/60">Top 5 models by revenue</h3>
          <ul className="mt-4 space-y-2">
            {props.byModel.length === 0 ? (
              <li className="py-4 text-center text-sm text-white/50">No data for this month</li>
            ) : (
              props.byModel.slice(0, 5).map(([name, value], i) => (
                <li key={name} className="flex items-center justify-between rounded-xl bg-white/5 px-4 py-2.5">
                  <span className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[hsl(330,80%,55%)]/30 text-xs font-bold text-[hsl(330,90%,75%)]">{i + 1}</span>
                    <span className="font-medium text-white/90 truncate" title={name}>{name}</span>
                  </span>
                  <span className="text-sm font-semibold text-[hsl(330,90%,75%)] shrink-0 ml-2">${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </li>
              ))
            )}
          </ul>
        </div>
      </section>
    </div>
  );
}
