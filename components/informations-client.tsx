"use client";

import { motion } from "framer-motion";
import type { MassListRecord } from "@/services/mass-lists";

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.06, delayChildren: 0.04 },
  },
};

const itemMotion = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.28, ease: [0.22, 1, 0.36, 1] } },
};

function MassListCard({ list }: { list: MassListRecord }) {
  const isInclude = list.type === "include";
  return (
    <div
      className={`group relative overflow-hidden rounded-2xl border p-4 backdrop-blur-xl transition-colors duration-300 ${
        isInclude
          ? "border-emerald-500/20 bg-emerald-500/[0.04] hover:border-emerald-400/35"
          : "border-rose-500/20 bg-rose-500/[0.04] hover:border-rose-400/35"
      }`}
      style={{
        boxShadow:
          "0 0 0 1px rgba(255,255,255,0.05), 0 0 24px -10px rgba(0,0,0,0.5), 0 0 40px -16px hsl(330 80% 55% / 0.06)",
      }}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
      <div className="relative flex gap-3">
        <div
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border text-xl ${
            isInclude
              ? "border-emerald-500/25 bg-emerald-500/10"
              : "border-rose-500/25 bg-rose-500/10"
          }`}
        >
          {list.emoji || "•"}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-white">{list.name}</p>
          <p className="mt-1 text-sm leading-relaxed text-white/50">{list.description}</p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <span
            className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${
              isInclude
                ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-300"
                : "border-rose-500/30 bg-rose-500/15 text-rose-300"
            }`}
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

function SectionColumn({
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
  const titleClass =
    accent === "include" ? "text-emerald-300/95" : "text-rose-300/95";

  return (
    <section
      className={`rounded-3xl border p-5 backdrop-blur-xl ${border}`}
      style={{
        boxShadow: "0 0 0 1px rgba(255,255,255,0.06), 0 12px 40px -16px rgba(0,0,0,0.45)",
      }}
    >
      <h2 className={`mb-4 text-lg font-bold tracking-tight ${titleClass}`}>{title}</h2>
      {lists.length === 0 ? (
        <p className="py-8 text-center text-sm text-white/35">No lists in this category.</p>
      ) : (
        <motion.ul className="space-y-3" variants={container} initial="hidden" animate="show">
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

export function InformationsClient({ lists }: { lists: MassListRecord[] }) {
  const include = lists.filter((l) => l.type === "include");
  const exclude = lists.filter((l) => l.type === "exclude");

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-8 md:px-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-white">Informations</h1>
        <p className="mt-1 text-sm text-white/55">Λίστες mass message για τα models</p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <SectionColumn title="✅ Include" accent="include" lists={include} />
        <SectionColumn title="❌ Exclude" accent="exclude" lists={exclude} />
      </div>
    </div>
  );
}
