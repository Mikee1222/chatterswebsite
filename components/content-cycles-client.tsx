"use client";

/**
 * Content Cycles — 2 per month per model. Each cycle = Proven bunch (researcher, 30)
 * + Experimental bunch (Head of Marketing, 15); counters for fill, grid, trials, urgent slots.
 */

import * as React from "react";
import Link from "next/link";
import { CalendarDays, Loader2, Play, Settings2, Trophy, FlaskConical, Flame } from "lucide-react";
import { ROUTES } from "@/lib/routes";
import type { ContentCycleWithStats, ContentCycleSettings, CycleStatus } from "@/services/content-cycles";
import { VA_BTN_PRIMARY, VA_BTN_SECONDARY, VA_CARD, VA_FILTER_INPUT } from "@/lib/va-tasks-tokens";
import { cn } from "@/lib/utils";
import { PsPageHeader } from "@/components/personas-studio/shared";

type ModelOpt = { id: string; model_name: string };

type Props = {
  models: ModelOpt[];
  initialCycles: ContentCycleWithStats[];
};

const STATUS_LABEL: Record<CycleStatus, string> = {
  planning: "Planning",
  filling: "Filling",
  briefing: "Briefing",
  shooting: "Shooting",
  posting: "Posting",
  done: "Done",
};

function Meter({ label, value, max, tone }: { label: string; value: number; max: number; tone?: "pink" | "gold" | "green" | "amber" }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  const bar =
    tone === "gold" ? "bg-[#D4AF8C]" : tone === "green" ? "bg-emerald-400" : tone === "amber" ? "bg-amber-400" : "bg-[#FF1493]";
  return (
    <div>
      <div className="flex items-baseline justify-between text-[11px]">
        <span className="uppercase tracking-wider text-white/40">{label}</span>
        <span className="font-semibold text-white/85">
          {value}/{max}
        </span>
      </div>
      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
        <div className={cn("h-full rounded-full", bar)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function fmtDate(d: string): string {
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y?.slice(2)}`;
}

export function ContentCyclesClient({ models, initialCycles }: Props) {
  const [cycles, setCycles] = React.useState(initialCycles);
  const [modelId, setModelId] = React.useState<string>(models[0]?.id ?? "");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [settings, setSettings] = React.useState<ContentCycleSettings | null>(null);
  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const [savingSettings, setSavingSettings] = React.useState(false);

  const visible = cycles.filter((c) => !modelId || c.model_id === modelId);

  React.useEffect(() => {
    if (!modelId) return;
    void fetch(`/api/admin/content-cycles/settings?model_id=${encodeURIComponent(modelId)}`)
      .then((r) => r.json())
      .then((d: { settings?: ContentCycleSettings }) => setSettings(d.settings ?? null))
      .catch(() => null);
  }, [modelId]);

  async function reload() {
    const res = await fetch(`/api/admin/content-cycles${modelId ? `?model_id=${encodeURIComponent(modelId)}` : ""}`);
    const data = (await res.json().catch(() => ({}))) as { cycles?: ContentCycleWithStats[] };
    if (Array.isArray(data.cycles)) {
      setCycles((prev) => {
        const others = prev.filter((c) => modelId && c.model_id !== modelId);
        return [...data.cycles!, ...others];
      });
    }
  }

  async function startCycle() {
    if (!modelId || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/content-cycles", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ model_id: modelId }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Could not start cycle");
        return;
      }
      await reload();
    } finally {
      setBusy(false);
    }
  }

  async function setStatus(id: string, status: CycleStatus) {
    const res = await fetch(`/api/admin/content-cycles/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status }),
    });
    const data = (await res.json().catch(() => ({}))) as { cycle?: ContentCycleWithStats };
    if (data.cycle) setCycles((list) => list.map((c) => (c.id === data.cycle!.id ? data.cycle! : c)));
  }

  async function saveSettings() {
    if (!settings) return;
    setSavingSettings(true);
    try {
      const res = await fetch("/api/admin/content-cycles/settings", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(settings),
      });
      const data = (await res.json().catch(() => ({}))) as { settings?: ContentCycleSettings; error?: string };
      if (data.settings) setSettings(data.settings);
      else setError(data.error ?? "Could not save settings");
    } finally {
      setSavingSettings(false);
    }
  }

  const modelName = models.find((m) => m.id === modelId)?.model_name ?? "";

  return (
    <div className="mx-auto w-full max-w-6xl">
      <PsPageHeader
        eyebrow="Content Pipeline"
        title="Content Cycles"
        description="Two 15-day cycles a month per creator. Each cycle: a Proven bunch (researcher) + an Experimental bunch (Head of Marketing). Originals go to the grid (2 proven + 1 experimental a day), variations go to trials."
        icon={CalendarDays}
      />

      <div className={cn(VA_CARD, "mb-5 flex flex-wrap items-end gap-3 p-4")}>
        <div className="min-w-[220px]">
          <label className="mb-1 block text-[10px] uppercase tracking-wider text-white/40">Creator</label>
          <select className={cn(VA_FILTER_INPUT, "min-h-11 w-full")} value={modelId} onChange={(e) => setModelId(e.target.value)}>
            {models.map((m) => (
              <option key={m.id} value={m.id}>
                {m.model_name}
              </option>
            ))}
          </select>
        </div>
        <button type="button" className={cn(VA_BTN_PRIMARY, "min-h-11 px-4")} disabled={busy || !modelId} onClick={() => void startCycle()}>
          {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Play className="mr-1.5 h-4 w-4" />}
          Start next cycle
        </button>
        <button type="button" className={cn(VA_BTN_SECONDARY, "min-h-11 px-4")} onClick={() => setSettingsOpen((o) => !o)}>
          <Settings2 className="mr-1.5 h-4 w-4" />
          Caps & rules
        </button>
        {error ? <p className="w-full text-sm text-rose-300/90">{error}</p> : null}
      </div>

      {settingsOpen && settings ? (
        <div className={cn(VA_CARD, "mb-5 p-4")}>
          <p className="mb-3 text-sm text-white/70">
            Settings for <span className="text-white">{modelName}</span>. They apply to the next cycle you start.
            Experimental cap should be about half the proven cap — the grid uses them 2:1.
          </p>
          <div className="grid gap-3 sm:grid-cols-4">
            {(
              [
                ["proven_cap", "Proven cap / cycle"],
                ["experimental_cap", "Experimental cap / cycle"],
                ["grid_per_day", "Grid posts / day"],
                ["trials_per_day", "Trials / day"],
                ["urgent_slots_per_month", "Urgent slots / month"],
                ["outlier_multiple", "Outlier ≥ × average"],
                ["hot_multiple", "Hot ≥ × average"],
                ["baseline_posts", "Average of last N posts"],
                ["outlier_scan_days", "Scan last N days"],
              ] as Array<[keyof ContentCycleSettings, string]>
            ).map(([key, label]) => (
              <div key={key}>
                <label className="mb-1 block text-[10px] uppercase tracking-wider text-white/40">{label}</label>
                <input
                  type="number"
                  step={key === "outlier_multiple" || key === "hot_multiple" ? 0.1 : 1}
                  className={cn(VA_FILTER_INPUT, "min-h-11 w-full")}
                  value={settings[key] as number}
                  onChange={(e) => setSettings({ ...settings, [key]: Number(e.target.value) })}
                />
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-white/50">
            Outlier rule (ClarioSuite auto-detect, grid): a Winner is a Reel of the last {settings.outlier_scan_days} days
            with ≥ {settings.outlier_multiple}× the average views of the account&apos;s latest {settings.baseline_posts} Reels;
            ≥ {settings.hot_multiple}× is a Super Winner. Same rule for every model — there are no absolute view thresholds.
            Preview what the next sync would classify: <code className="text-white/60">/api/winner-sourcing/auto-detect-preview</code>
          </p>
          <div className="mt-3">
            <button type="button" className={cn(VA_BTN_PRIMARY, "min-h-10 px-4 text-xs")} disabled={savingSettings} onClick={() => void saveSettings()}>
              {savingSettings ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
              Save
            </button>
          </div>
        </div>
      ) : null}

      {visible.length === 0 ? (
        <div className={cn(VA_CARD, "p-8 text-center text-sm text-white/45")}>
          No cycles yet for {modelName || "this creator"}. Start the first one — it creates the Proven and Experimental bunches for the current half-month.
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map((c) => {
            const s = c.stats;
            const gridDone = s.posted.grid_proven + s.posted.grid_experimental + s.posted.grid_other;
            return (
              <div key={c.id} className={cn(VA_CARD, "p-4 md:p-5")}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-base font-semibold text-white">
                      {c.model_name} · Cycle {c.number}
                    </p>
                    <p className="text-[12px] text-white/45">
                      {fmtDate(c.start_date)} → {fmtDate(c.end_date)} · day {s.days_elapsed}/{s.days_total}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      className={cn(VA_FILTER_INPUT, "min-h-10 text-xs")}
                      value={c.status}
                      onChange={(e) => void setStatus(c.id, e.target.value as CycleStatus)}
                    >
                      {(Object.keys(STATUS_LABEL) as CycleStatus[]).map((k) => (
                        <option key={k} value={k}>
                          {STATUS_LABEL[k]}
                        </option>
                      ))}
                    </select>
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[11px] font-semibold",
                        s.urgent.used >= s.urgent.total
                          ? "border-rose-400/35 bg-rose-500/12 text-rose-100"
                          : "border-amber-400/35 bg-amber-500/12 text-amber-100",
                      )}
                      title="Urgent slots used this month"
                    >
                      <Flame className="h-3 w-3" /> Urgent {s.urgent.used}/{s.urgent.total}
                    </span>
                  </div>
                </div>

                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <div className="rounded-xl border border-white/[0.06] bg-black/20 p-3">
                    <p className="mb-2 inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#D4AF8C]/80">
                      <Trophy className="h-3.5 w-3.5" /> Proven bunch
                    </p>
                    <Meter label="Filled" value={s.proven.provided} max={s.proven.cap} tone="gold" />
                    <p className="mt-1 text-[11px] text-white/40">{s.proven.pending} pending review</p>
                    {c.proven_bunch_id ? (
                      <Link href={`${ROUTES.admin.bunches}?id=${encodeURIComponent(c.proven_bunch_id)}`} className="mt-2 inline-block text-[12px] text-[#D4AF8C] underline-offset-2 hover:underline">
                        Open bunch
                      </Link>
                    ) : null}
                  </div>
                  <div className="rounded-xl border border-white/[0.06] bg-black/20 p-3">
                    <p className="mb-2 inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#FF1493]/90">
                      <FlaskConical className="h-3.5 w-3.5" /> Experimental bunch
                    </p>
                    <Meter label="Filled" value={s.experimental.provided} max={s.experimental.cap} tone="pink" />
                    <p className="mt-1 text-[11px] text-white/40">{s.experimental.pending} pending review</p>
                    {c.experimental_bunch_id ? (
                      <Link href={`${ROUTES.admin.bunches}?id=${encodeURIComponent(c.experimental_bunch_id)}`} className="mt-2 inline-block text-[12px] text-[#D4AF8C] underline-offset-2 hover:underline">
                        Open bunch
                      </Link>
                    ) : null}
                  </div>
                </div>

                <div className="mt-4 grid gap-4 sm:grid-cols-3">
                  <Meter label={`Grid (${s.posted.grid_proven} proven · ${s.posted.grid_experimental} exp · ${s.posted.grid_other} other)`} value={gridDone} max={s.posted.grid_target} tone="green" />
                  <Meter label="Trials" value={s.posted.trials} max={s.posted.trials_target} tone="green" />
                  <div>
                    <div className="flex items-baseline justify-between text-[11px]">
                      <span className="uppercase tracking-wider text-white/40">Outliers (24h check)</span>
                      <span className="font-semibold text-white/85">{s.outliers}</span>
                    </div>
                    <Link href={ROUTES.admin.winnerVideosHub} className="mt-1 inline-block text-[12px] text-[#D4AF8C] underline-offset-2 hover:underline">
                      Recreation queue
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
