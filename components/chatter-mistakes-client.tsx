"use client";

import * as React from "react";
import { Search, Users, UserRound } from "lucide-react";
import { formatDateTimeAthens } from "@/lib/format";
import type { MistakeReasonCategory, MistakeRecord } from "@/services/chatter-mistakes";

type Props = {
  initialMistakes: MistakeRecord[];
};

const filterFieldClass =
  "min-h-10 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-white/20 focus:border-pink-500/50 focus:outline-none [color-scheme:dark]";

const SEVERITY_CONFIG = {
  High: {
    emoji: "",
    label: "High severity",
    weight: "Major mistake",
    description: "Serious impact on performance and client experience",
    barColor: "bg-red-500",
    barWidth: "w-full",
  },
  Medium: {
    emoji: "",
    label: "Medium severity",
    weight: "Moderate mistake",
    description: "Notable impact on quality and client satisfaction",
    barColor: "bg-amber-500",
    barWidth: "w-2/3",
  },
  Low: {
    emoji: "",
    label: "Low severity",
    weight: "Minor mistake",
    description: "Small impact, easy to improve",
    barColor: "bg-yellow-500",
    barWidth: "w-1/3",
  },
} as const satisfies Record<
  MistakeReasonCategory,
  { emoji: string; label: string; weight: string; description: string; barColor: string; barWidth: string }
>;

const SEVERITY_LEGEND_ITEMS = [
  { cat: "Low" as const, emoji: "", pts: "5 pts", bar: "w-1/3 bg-yellow-500" },
  { cat: "Medium" as const, emoji: "", pts: "10 pts", bar: "w-2/3 bg-amber-500" },
  { cat: "High" as const, emoji: "", pts: "20 pts", bar: "w-full bg-red-500" },
];

export function ChatterMistakesClient({ initialMistakes }: Props) {
  const [mistakes] = React.useState(initialMistakes);
  const [q, setQ] = React.useState("");
  const [model, setModel] = React.useState("all");
  const [reason, setReason] = React.useState("all");
  const [category, setCategory] = React.useState<"all" | MistakeReasonCategory>("all");
  const [from, setFrom] = React.useState("");
  const [to, setTo] = React.useState("");

  const modelOptions = React.useMemo(() => {
    const s = new Set<string>();
    mistakes.forEach((m) => {
      if (m.model_name?.trim()) s.add(m.model_name.trim());
    });
    return [...s].sort((a, b) => a.localeCompare(b));
  }, [mistakes]);

  const reasonOptions = React.useMemo(() => {
    const s = new Set<string>();
    mistakes.forEach((m) => {
      if (m.reason_label?.trim()) s.add(m.reason_label.trim());
    });
    return [...s].sort((a, b) => a.localeCompare(b));
  }, [mistakes]);

  const filtered = React.useMemo(() => {
    const qq = q.trim().toLowerCase();
    return mistakes.filter((m) => {
      if (category !== "all" && m.reason_category !== category) return false;
      if (model !== "all" && (m.model_name ?? "").trim() !== model) return false;
      if (reason !== "all" && (m.reason_label ?? "").trim() !== reason) return false;
      if (from) {
        const d = (m.mistake_date || "").slice(0, 10);
        if (!d || d < from) return false;
      }
      if (to) {
        const d = (m.mistake_date || "").slice(0, 10);
        if (!d || d > to) return false;
      }
      if (!qq) return true;
      const sub = (m.sub_username ?? "").toLowerCase();
      return sub.includes(qq);
    });
  }, [mistakes, q, model, reason, category, from, to]);

  const stats = React.useMemo(() => {
    const rows = filtered;
    let low = 0;
    let med = 0;
    let high = 0;
    let pts = 0;
    for (const m of rows) {
      pts += m.points_deducted ?? 0;
      if (m.reason_category === "High") high += 1;
      else if (m.reason_category === "Medium") med += 1;
      else low += 1;
    }
    return { total: rows.length, low, med, high, pts };
  }, [filtered]);

  return (
    <div className="space-y-8">
      <div>
        <p className="mb-1 text-xs font-bold uppercase tracking-widest text-red-400/60">My performance</p>
        <h1 className="text-3xl font-bold tracking-tight text-white">My mistakes</h1>
        <p className="mt-1 text-sm text-white/40">Approved mistake records and point deductions.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {[
          { label: "Total", value: stats.total, border: "border-white/20", text: "text-white" },
          { label: "Low", value: stats.low, border: "border-yellow-500/30", text: "text-yellow-400" },
          { label: "Medium", value: stats.med, border: "border-amber-500/30", text: "text-amber-400" },
          { label: "High", value: stats.high, border: "border-red-500/30", text: "text-red-400" },
          { label: "Points lost", value: stats.pts, border: "border-red-500/40", text: "text-red-400" },
        ].map((stat) => (
          <div
            key={stat.label}
            className={`rounded-2xl border ${stat.border} bg-white/[0.03] p-4 backdrop-blur-sm`}
          >
            <p className="mb-2 text-xs uppercase tracking-widest text-white/30">{stat.label}</p>
            <p className={`text-2xl font-bold tabular-nums sm:text-3xl ${stat.text}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-x-6 gap-y-2 px-1">
        <p className="text-xs uppercase tracking-widest text-white/30">Severity:</p>
        {SEVERITY_LEGEND_ITEMS.map((item) => (
          <div key={item.cat} className="flex items-center gap-2">
            <span className="text-sm">{item.emoji}</span>
            <div className="h-1 w-12 rounded-full bg-white/10">
              <div className={`h-1 rounded-full ${item.bar}`} />
            </div>
            <span className="text-xs text-white/40">
              {item.cat} · {item.pts}
            </span>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative min-w-[12rem] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search sub username…"
            className={`${filterFieldClass} w-full pl-9`}
          />
        </div>
        <select
          value={model}
          onChange={(e) => setModel(e.target.value)}
          className={`${filterFieldClass} min-w-[10rem] cursor-pointer appearance-none bg-neutral-950/60`}
        >
          <option value="all" className="bg-neutral-900">
            All models
          </option>
          {modelOptions.map((name) => (
            <option key={name} value={name} className="bg-neutral-900">
              {name}
            </option>
          ))}
        </select>
        <select
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className={`${filterFieldClass} min-w-[10rem] cursor-pointer appearance-none bg-neutral-950/60`}
        >
          <option value="all" className="bg-neutral-900">
            All reasons
          </option>
          {reasonOptions.map((r) => (
            <option key={r} value={r} className="bg-neutral-900">
              {r}
            </option>
          ))}
        </select>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as typeof category)}
          className={`${filterFieldClass} min-w-[9rem] cursor-pointer appearance-none bg-neutral-950/60`}
        >
          <option value="all" className="bg-neutral-900">
            All categories
          </option>
          <option value="Low" className="bg-neutral-900">
            Low
          </option>
          <option value="Medium" className="bg-neutral-900">
            Medium
          </option>
          <option value="High" className="bg-neutral-900">
            High
          </option>
        </select>
        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={filterFieldClass} />
        <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={filterFieldClass} />
      </div>

      <div className="space-y-3">
        {filtered.length === 0 ? (
          <p className="text-sm text-white/45">No mistakes match your filters.</p>
        ) : (
          filtered.map((m) => (
            <div
              key={m.id}
              className={`relative mb-3 overflow-hidden rounded-2xl border p-5 backdrop-blur-sm transition-transform hover:scale-[1.005] ${
                m.reason_category === "High"
                  ? "border-red-500/20 bg-red-500/[0.04]"
                  : m.reason_category === "Medium"
                    ? "border-amber-500/20 bg-amber-500/[0.04]"
                    : "border-yellow-500/20 bg-yellow-500/[0.04]"
              }`}
            >
              <div
                className={`absolute bottom-0 left-0 top-0 w-1 rounded-l-2xl ${
                  m.reason_category === "High" ? "bg-red-500" : m.reason_category === "Medium" ? "bg-amber-500" : "bg-yellow-500"
                }`}
              />

              <div className="flex items-start justify-between gap-4 pl-3">
                <div className="min-w-0 flex-1">
                  <span
                    className={`mb-2 inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-bold ${
                      m.reason_category === "High"
                        ? "border-red-500/25 bg-red-500/15 text-red-400"
                        : m.reason_category === "Medium"
                          ? "border-amber-500/25 bg-amber-500/15 text-amber-400"
                          : "border-yellow-500/25 bg-yellow-500/15 text-yellow-400"
                    }`}
                  >
                    {m.reason_category === "High" ? "" : m.reason_category === "Medium" ? "" : ""}
                    {m.reason_category}
                  </span>

                  <h3 className="mb-2 text-base font-semibold text-white">{m.reason_label}</h3>

                  {(() => {
                    const sev = SEVERITY_CONFIG[m.reason_category];
                    return (
                      <div
                        className={`mt-3 rounded-xl border p-3 ${
                          m.reason_category === "High"
                            ? "border-red-500/15 bg-red-500/5"
                            : m.reason_category === "Medium"
                              ? "border-amber-500/15 bg-amber-500/5"
                              : "border-yellow-500/15 bg-yellow-500/5"
                        }`}
                      >
                        <div className="mb-2 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-sm">{sev.emoji}</span>
                            <span className="text-xs font-semibold uppercase tracking-widest text-white/70">
                              {sev.label}
                            </span>
                          </div>
                          <span className="text-xs text-white/40">{sev.weight}</span>
                        </div>

                        <div className="mb-2 h-1.5 w-full rounded-full bg-white/10">
                          <div
                            className={`h-1.5 rounded-full ${sev.barColor} ${sev.barWidth} transition-all`}
                          />
                        </div>

                        <p className="text-xs text-white/30">{sev.description}</p>
                      </div>
                    );
                  })()}

                  <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-white/40">
                    <span>{formatDateTimeAthens(m.mistake_date)}</span>
                    <span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5" aria-hidden />{m.model_name}</span>
                    <span className="inline-flex items-center gap-1"><UserRound className="h-3.5 w-3.5" aria-hidden />@{m.sub_username}</span>
                  </div>

                  {m.admin_notes ? (
                    <div className="mt-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                      <p className="mb-1 text-xs uppercase tracking-widest text-white/30">Admin note</p>
                      <p className="text-sm italic text-white/60">&ldquo;{m.admin_notes}&rdquo;</p>
                    </div>
                  ) : null}

                  {m.screenshot?.[0]?.url ? (
                    <div className="mt-3 rounded-xl border border-white/10 bg-white/5 p-3">
                      <p className="mb-2 text-xs uppercase tracking-widest text-white/30">Screenshot evidence</p>
                      <a href={m.screenshot?.[0]?.url} target="_blank" rel="noreferrer">
                        <img
                          src={m.screenshot?.[0]?.url}
                          alt="Mistake evidence screenshot"
                          className="max-h-80 w-full rounded-lg border border-white/10 object-contain transition-opacity hover:opacity-80"
                        />
                      </a>
                    </div>
                  ) : null}
                </div>

                <div className="ml-2 shrink-0 text-right">
                  <div className="flex items-baseline justify-end gap-0.5 text-lg font-bold text-red-400">
                    <span>-{m.points_deducted ?? 0}</span>
                    <span className="text-sm font-normal text-red-400/60">pts</span>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
