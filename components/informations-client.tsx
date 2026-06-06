"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import type { MassListRecord } from "@/services/mass-lists";
import type { ModelTier, ModelTierRecord } from "@/services/model-tiers";
import type { PricingRow, PricingSpecial, SpenderTier } from "@/services/pricing";

const sectionReveal = {
  hidden: { opacity: 0, y: 16 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] as const },
  },
};

const stagger = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.06, delayChildren: 0.05 },
  },
};

const itemMotion = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.26, ease: [0.22, 1, 0.36, 1] as const } },
};

type MtFilter = "all" | ModelTier;
type StFilter = "all" | SpenderTier;

const SPENDER_LABELS: Record<SpenderTier, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
  medium_low: "Medium-Low",
};

const MT_ORDER: ModelTier[] = ["high", "medium", "low"];
const ST_ORDER: SpenderTier[] = ["high", "medium", "low", "medium_low"];

function MassListCard({ list }: { list: MassListRecord }) {
  const isInclude = list.type === "include";
  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-2xl border p-4 backdrop-blur-xl transition-colors duration-300",
        isInclude
          ? "border-emerald-500/20 bg-emerald-500/[0.04] hover:border-emerald-400/35"
          : "border-rose-500/20 bg-rose-500/[0.04] hover:border-rose-400/35",
      )}
      style={{
        boxShadow:
          "0 0 0 1px rgba(255,255,255,0.05), 0 0 24px -10px rgba(0,0,0,0.5), 0 0 40px -16px hsl(330 80% 55% / 0.06)",
      }}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
      <div className="relative flex gap-3">
        <div
          className={cn(
            "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border text-xl",
            isInclude ? "border-emerald-500/25 bg-emerald-500/10" : "border-rose-500/25 bg-rose-500/10",
          )}
        >
          {list.emoji || "•"}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-white">{list.name}</p>
          <p className="mt-1 text-sm leading-relaxed text-white/50">{list.description}</p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <span
            className={cn(
              "rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide",
              isInclude
                ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-300"
                : "border-rose-500/30 bg-rose-500/15 text-rose-300",
            )}
          >
            {isInclude ? "Include" : "Exclude"}
          </span>
          {list.is_different_mass ? (
            <span className="rounded-full border border-violet-500/30 bg-violet-500/15 px-2 py-0.5 text-[10px] font-semibold text-violet-200">
              Different Mass
            </span>
          ) : null}
          {!list.applies_to_all_models ? (
            <span className="rounded-full border border-amber-500/30 bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-200">
              Specific models
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function MassListSection({
  title,
  accent,
  lists,
}: {
  title: string;
  accent: "include" | "exclude";
  lists: MassListRecord[];
}) {
  const border =
    accent === "include"
      ? "border-emerald-500/15 bg-emerald-500/[0.03]"
      : "border-rose-500/15 bg-rose-500/[0.03]";
  const titleClass = accent === "include" ? "text-emerald-300/95" : "text-rose-300/95";
  return (
    <section
      className={cn("rounded-3xl border p-5 backdrop-blur-xl", border)}
      style={{
        boxShadow: "0 0 0 1px rgba(255,255,255,0.06), 0 12px 40px -16px rgba(0,0,0,0.45)",
      }}
    >
      <h2 className={cn("mb-4 text-lg font-bold tracking-tight", titleClass)}>{title}</h2>
      {lists.length === 0 ? (
        <p className="py-8 text-center text-sm text-white/35">No lists in this category.</p>
      ) : (
        <motion.ul className="space-y-3" variants={stagger} initial="hidden" animate="show">
          {lists.map((list) => (
            <motion.li key={list.id} variants={itemMotion}>
              <MassListCard list={list} />
            </motion.li>
          ))}
        </motion.ul>
      )}
    </section>
  );
}

function ModelTiersSection({ tiers }: { tiers: ModelTierRecord[] }) {
  const byTier = React.useMemo(() => {
    const m: Record<ModelTier, ModelTierRecord[]> = { high: [], medium: [], low: [] };
    for (const t of tiers) {
      m[t.tier].push(t);
    }
    for (const k of MT_ORDER) m[k].sort((a, b) => a.sort_order - b.sort_order || a.model_name.localeCompare(b.model_name));
    return m;
  }, [tiers]);

  const cols: { tier: ModelTier; title: string; emoji: string; accent: string }[] = [
    { tier: "high", title: "High", emoji: "", accent: "border-amber-500/25 bg-amber-500/[0.06]" },
    { tier: "medium", title: "Medium", emoji: "◼", accent: "border-sky-500/25 bg-sky-500/[0.05]" },
    { tier: "low", title: "Low", emoji: "", accent: "border-white/15 bg-white/[0.04]" },
  ];

  return (
    <motion.section variants={sectionReveal} initial="hidden" animate="show" className="space-y-4">
      <h2 className="text-xl font-bold tracking-tight text-white">Model Tiers</h2>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {cols.map((c) => (
          <div
            key={c.tier}
            className={cn("rounded-3xl border p-5 backdrop-blur-xl", c.accent)}
            style={{
              boxShadow: "0 0 0 1px rgba(255,255,255,0.06), 0 12px 40px -16px rgba(0,0,0,0.45)",
            }}
          >
            <h3 className="mb-3 text-base font-bold text-white">
              {c.emoji} {c.title}
            </h3>
            <div className="flex flex-wrap gap-2">
              {byTier[c.tier].length === 0 ? (
                <span className="text-sm text-white/35">—</span>
              ) : (
                byTier[c.tier].map((t) => (
                  <span
                    key={t.id}
                    className="rounded-full border border-white/12 bg-white/5 px-2.5 py-1 text-xs font-medium text-white/85"
                  >
                    {t.model_name}
                  </span>
                ))
              )}
            </div>
          </div>
        ))}
      </div>
    </motion.section>
  );
}

function NegotCell({ value }: { value: string }) {
  const tw = value.trim().toUpperCase() === "TW";
  if (tw) {
    return (
      <span className="inline-flex rounded-md border border-white/15 bg-white/8 px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-white/45">
        TW
      </span>
    );
  }
  return <span className="text-white/80">{value}</span>;
}

function PricingSection({
  rows,
  specials,
}: {
  rows: PricingRow[];
  specials: PricingSpecial[];
}) {
  const [mt, setMt] = React.useState<MtFilter>("all");
  const [st, setSt] = React.useState<StFilter>("all");

  const filtered = React.useMemo(() => {
    return rows.filter((r) => {
      if (mt !== "all" && r.model_tier !== mt) return false;
      if (st !== "all" && r.spender_tier !== st) return false;
      return true;
    });
  }, [rows, mt, st]);

  const grouped = React.useMemo(() => {
    const out: { mt: ModelTier; st: SpenderTier; rows: PricingRow[] }[] = [];
    for (const m of MT_ORDER) {
      for (const s of ST_ORDER) {
        const slice = filtered.filter((r) => r.model_tier === m && r.spender_tier === s).sort((a, b) => a.video_number - b.video_number);
        if (slice.length) out.push({ mt: m, st: s, rows: slice });
      }
    }
    return out;
  }, [filtered]);

  const pill = (active: boolean) =>
    cn(
      "rounded-full border px-3 py-1.5 text-xs font-semibold transition",
      active
        ? "border-pink-500/50 bg-pink-500/20 text-pink-100"
        : "border-white/10 bg-white/5 text-white/50 hover:border-white/20 hover:text-white/80",
    );

  return (
    <motion.section variants={sectionReveal} initial="hidden" animate="show" className="space-y-4">
      <h2 className="text-xl font-bold tracking-tight text-white">Pricing Guide</h2>

      <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4 backdrop-blur-xl md:flex-row md:flex-wrap md:items-center">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-white/40">Model</span>
          {(["all", "high", "medium", "low"] as const).map((k) => (
            <button key={k} type="button" className={pill(mt === k)} onClick={() => setMt(k)}>
              {k === "all" ? "All" : k === "high" ? "High" : k === "medium" ? "◼ Medium" : "Low"}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2 md:ml-4">
          <span className="text-[11px] font-bold uppercase tracking-wider text-white/40">Spender</span>
          {(["all", "high", "medium", "low", "medium_low"] as const).map((k) => (
            <button key={k} type="button" className={pill(st === k)} onClick={() => setSt(k)}>
              {k === "all" ? "All" : SPENDER_LABELS[k]}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-white/10 bg-black/30">
        <table className="w-full min-w-[720px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-white/10 bg-white/[0.04] text-[11px] font-bold uppercase tracking-wider text-white/45">
              <th className="px-3 py-3">Video #</th>
              <th className="px-3 py-3">Κανονική Τιμή</th>
              <th className="px-3 py-3">Negotiation</th>
              <th className="px-3 py-3">Περιγραφή</th>
              <th className="px-3 py-3">Σχόλια</th>
            </tr>
          </thead>
          <tbody>
            {grouped.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-white/40">
                  No rows for this filter.
                </td>
              </tr>
            ) : (
              grouped.flatMap((g) => [
                <tr key={`h-${g.mt}-${g.st}`} className="bg-pink-500/10">
                  <td colSpan={5} className="px-3 py-2 text-xs font-bold uppercase tracking-wide text-pink-200/90">
                    {g.mt.toUpperCase()} · {SPENDER_LABELS[g.st]}
                  </td>
                </tr>,
                ...g.rows.map((r) => (
                  <tr key={r.id} className="border-b border-white/[0.06] hover:bg-white/[0.02]">
                    <td className="px-3 py-2.5 font-mono text-white/70">{r.video_number}</td>
                    <td className="px-3 py-2.5 text-white/90">{r.price_normal}</td>
                    <td className="px-3 py-2.5">
                      <NegotCell value={r.price_negotiation} />
                    </td>
                    <td className="max-w-xs px-3 py-2.5 text-white/65">{r.description}</td>
                    <td className="px-3 py-2.5 text-white/50">
                      {r.notes?.trim() ? (
                        <span className="inline-flex cursor-help items-center gap-1" title={r.notes}>
                          <span className="text-base leading-none text-sky-300/90">ⓘ</span>
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                )),
              ])
            )}
          </tbody>
        </table>
      </div>

      <div>
        <h3 className="mb-3 text-lg font-bold text-white">Special Prices</h3>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {specials.map((s) => (
            <div
              key={s.id}
              className="rounded-2xl border border-violet-500/20 bg-violet-500/[0.06] p-4 backdrop-blur-xl"
              style={{
                boxShadow: "0 0 0 1px rgba(255,255,255,0.05), 0 8px 32px -12px rgba(0,0,0,0.5)",
              }}
            >
              <p className="font-bold text-white">{s.label}</p>
              <p className="mt-2 text-sm text-white/70">
                <span className="text-white/45">Normal:</span> {s.price_normal}
              </p>
              <p className="text-sm text-white/70">
                <span className="text-white/45">Negotiation:</span> <NegotCell value={s.price_negotiation} />
              </p>
              <p className="mt-2 text-sm leading-relaxed text-white/55">{s.description}</p>
              <span className="mt-3 inline-flex rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white/50">
                {s.models_applicable}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div
        className="rounded-2xl border border-amber-500/25 bg-amber-500/[0.08] p-4 text-sm leading-relaxed text-amber-100/90 backdrop-blur-xl"
        style={{ boxShadow: "0 0 0 1px rgba(251,191,36,0.12)" }}
      >
        Προφανώς αν σε models low tier τύχει ένας sub που με βάση την κριτική σας σκέψη μπορεί να πάει σε higher
        prices (π.χ. job ναυτιλιακά, 31 χρονών) θα βάζετε άλλες τιμές, απλά μπορείτε πλέον και σε άτομα που δεν
        έχουν να πουλάτε πιο κάτω. Στους new subs ξεκινάμε από το medium tier subscriber σε όλα τα μοντέλα.
      </div>
    </motion.section>
  );
}

export function InformationsClient({
  lists,
  tiers,
  pricingRows,
  pricingSpecials,
}: {
  lists: MassListRecord[];
  tiers: ModelTierRecord[];
  pricingRows: PricingRow[];
  pricingSpecials: PricingSpecial[];
}) {
  const include = lists.filter((l) => l.type === "include");
  const exclude = lists.filter((l) => l.type === "exclude");

  return (
    <motion.div
      className="mx-auto max-w-6xl space-y-10 px-4 py-8 md:px-6"
      initial="hidden"
      animate="show"
      variants={stagger}
    >
      <motion.div variants={sectionReveal}>
        <h1 className="text-2xl font-semibold tracking-tight text-white">Informations</h1>
        <p className="mt-1 text-sm text-white/55">Λίστες mass message, tiers & τιμολόγηση για τα models</p>
      </motion.div>

      <motion.div variants={sectionReveal}>
        <ModelTiersSection tiers={tiers} />
      </motion.div>

      <motion.div variants={sectionReveal}>
        <PricingSection rows={pricingRows} specials={pricingSpecials} />
      </motion.div>

      <motion.div variants={sectionReveal} className="space-y-4">
        <h2 className="text-xl font-bold tracking-tight text-white">Mass lists</h2>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <MassListSection title="Include" accent="include" lists={include} />
          <MassListSection title="Exclude" accent="exclude" lists={exclude} />
        </div>
      </motion.div>
    </motion.div>
  );
}
