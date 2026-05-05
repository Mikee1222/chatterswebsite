"use client";

import { motion } from "framer-motion";
import { formatDateTimeEuropean } from "@/lib/format";

type Row = {
  id: string;
  chatter_name: string | null;
  start_time: string | null;
  modelNames: string[];
  models_count?: number | null;
  status: string;
};

type Props = {
  chatterRows: Row[];
  vaRows: Row[];
};

/** Staggered list items for live-shifts server page. */
export function LiveShiftsPageLists({ chatterRows, vaRows }: Props) {
  return (
    <>
      <div className="glass-card overflow-hidden">
        <h2 className="border-b border-white/10 px-5 py-4 text-sm font-semibold uppercase tracking-wider text-white/70">
          Chatter shifts
        </h2>
        <ul className="divide-y divide-white/5">
          {chatterRows.length === 0 ? (
            <li className="px-5 py-8 text-center text-sm text-white/50">No live chatter shifts</li>
          ) : (
            chatterRows.map((s, index) => {
              const running = s.status !== "on_break";
              return (
                <motion.li
                  key={s.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, delay: index * 0.04, ease: "easeOut" }}
                  className="px-5 py-4"
                >
                  <p className="font-medium text-white/95">{s.chatter_name || "—"}</p>
                  <p className="mt-0.5 text-xs text-white/50">
                    Started {s.start_time ? formatDateTimeEuropean(s.start_time) : "—"}
                  </p>
                  <p className="mt-1 text-xs text-white/60">
                    Models: {s.modelNames.length > 0 ? s.modelNames.join(", ") : s.models_count ?? 0}
                  </p>
                  <span
                    className={`mt-2 inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs ${
                      s.status === "on_break"
                        ? "border-amber-500/30 bg-amber-500/20 text-amber-300"
                        : "border-emerald-500/30 bg-emerald-500/20 text-emerald-300"
                    }`}
                  >
                    <span
                      className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                        running ? "bg-emerald-400 animate-pulse" : "bg-amber-400 animate-pulse"
                      }`}
                      aria-hidden
                    />
                    {s.status === "on_break" ? "On break" : "Running"}
                  </span>
                </motion.li>
              );
            })
          )}
        </ul>
      </div>
      <div className="glass-card overflow-hidden">
        <h2 className="border-b border-white/10 px-5 py-4 text-sm font-semibold uppercase tracking-wider text-white/70">
          Virtual assistant shifts
        </h2>
        <ul className="divide-y divide-white/5">
          {vaRows.length === 0 ? (
            <li className="px-5 py-8 text-center text-sm text-white/50">No live VA mistake shifts</li>
          ) : (
            vaRows.map((s, index) => {
              const running = s.status !== "on_break";
              return (
                <motion.li
                  key={s.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, delay: index * 0.04, ease: "easeOut" }}
                  className="px-5 py-4"
                >
                  <p className="font-medium text-white/95">{s.chatter_name || "—"}</p>
                  <p className="mt-0.5 text-xs text-white/50">
                    Started {s.start_time ? formatDateTimeEuropean(s.start_time) : "—"}
                  </p>
                  <p className="mt-1 text-xs text-white/60">
                    Models: {s.modelNames.length > 0 ? s.modelNames.join(", ") : s.models_count ?? 0}
                  </p>
                  <span
                    className={`mt-2 inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs ${
                      s.status === "on_break"
                        ? "border-amber-500/30 bg-amber-500/20 text-amber-300"
                        : "border-emerald-500/30 bg-emerald-500/20 text-emerald-300"
                    }`}
                  >
                    <span
                      className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                        running ? "bg-emerald-400 animate-pulse" : "bg-amber-400 animate-pulse"
                      }`}
                      aria-hidden
                    />
                    {s.status === "on_break" ? "On break" : "Running"}
                  </span>
                </motion.li>
              );
            })
          )}
        </ul>
      </div>
    </>
  );
}
