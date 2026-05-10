"use client";

import * as React from "react";
import { Search } from "lucide-react";
import { formatDateTimeAthens } from "@/lib/format";
import { FormInput } from "@/components/ui/form-input";
import type { MistakeReasonCategory, MistakeRecord } from "@/services/chatter-mistakes";

type Props = {
  initialMistakes: MistakeRecord[];
};

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
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-white">My mistakes</h1>
        <p className="mt-1 text-sm text-white/50">Approved mistake records and point deductions.</p>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
        <div className="relative min-w-[160px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
          <FormInput
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search sub…"
            className="!pl-9"
          />
        </div>
        <select
          value={model}
          onChange={(e) => setModel(e.target.value)}
          className="min-h-10 rounded-xl border border-white/10 bg-white/[0.04] px-3 text-sm text-white"
        >
          <option value="all">All models</option>
          {modelOptions.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
        <select
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="min-h-10 min-w-[140px] rounded-xl border border-white/10 bg-white/[0.04] px-3 text-sm text-white"
        >
          <option value="all">All reasons</option>
          {reasonOptions.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as typeof category)}
          className="min-h-10 rounded-xl border border-white/10 bg-white/[0.04] px-3 text-sm text-white"
        >
          <option value="all">All categories</option>
          <option value="Low">Low</option>
          <option value="Medium">Medium</option>
          <option value="High">High</option>
        </select>
        <FormInput type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="min-h-10 w-[140px]" />
        <FormInput type="date" value={to} onChange={(e) => setTo(e.target.value)} className="min-h-10 w-[140px]" />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {[
          { label: "Total", value: stats.total, cls: "border-white/10" },
          { label: "Low", value: stats.low, cls: "border-yellow-500/20 bg-yellow-500/5" },
          { label: "Medium", value: stats.med, cls: "border-amber-500/20 bg-amber-500/5" },
          { label: "High", value: stats.high, cls: "border-red-500/20 bg-red-500/5" },
          { label: "Points lost", value: stats.pts, cls: "border-pink-500/25 bg-pink-500/5" },
        ].map((c) => (
          <div key={c.label} className={`rounded-2xl border p-3 ${c.cls}`}>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-white/40">{c.label}</p>
            <p className="mt-1 text-xl font-bold text-white">{c.value}</p>
          </div>
        ))}
      </div>

      <div className="space-y-3">
        {filtered.length === 0 ? (
          <p className="text-sm text-white/45">No mistakes match your filters.</p>
        ) : (
          filtered.map((m) => (
            <div
              key={m.id}
              className={`rounded-2xl border p-4 ${
                m.reason_category === "High"
                  ? "border-red-500/25 bg-red-500/5"
                  : m.reason_category === "Medium"
                    ? "border-amber-500/25 bg-amber-500/5"
                    : "border-yellow-500/25 bg-yellow-500/5"
              }`}
            >
              <span
                className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${
                  m.reason_category === "High"
                    ? "border-red-500/25 bg-red-500/15 text-red-400"
                    : m.reason_category === "Medium"
                      ? "border-amber-500/25 bg-amber-500/15 text-amber-400"
                      : "border-yellow-500/25 bg-yellow-500/15 text-yellow-400"
                }`}
              >
                {m.reason_category}
              </span>
              <h3 className="mt-2 font-semibold text-white">{m.reason_label}</h3>
              <div className="mt-1 space-y-0.5 text-xs text-white/40">
                <p>📅 {formatDateTimeAthens(m.mistake_date)}</p>
                <p>
                  🎭 {m.model_name} · @{m.sub_username}
                </p>
                <p>📉 {m.points_deducted} points deducted</p>
              </div>
              {m.admin_notes ? <p className="mt-2 text-sm italic text-white/50">&ldquo;{m.admin_notes}&rdquo;</p> : null}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
