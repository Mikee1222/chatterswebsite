"use client";

import { motion } from "framer-motion";
import type { ModelRecord } from "@/types";

type Props = {
  modelss: ModelRecord[];
  modelIdToVaNames: Record<string, string[]>;
};

/** Client table body for models free/taken page — stagger row motion only. */
export function ModelsDirectoryTable({ modelss, modelIdToVaNames }: Props) {
  if (modelss.length === 0) {
    return (
      <tr>
        <td colSpan={3} className="p-8 text-center text-white/50">
          No models
        </td>
      </tr>
    );
  }
  return (
    <>
      {modelss.map((m, index) => {
        const chatterStatus = m.current_status === "occupied" ? m.current_chatter_name || "Occupied" : "Free";
        const vaNames = modelIdToVaNames[m.id] ?? [];
        const isFree = m.current_status !== "occupied";
        return (
          <motion.tr
            key={m.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, delay: index * 0.04, ease: "easeOut" }}
            className="hover:bg-white/[0.03]"
          >
            <td className="p-3 font-medium text-white/90">{m.model_name}</td>
            <td className="p-3">
              <span
                className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 ${
                  m.current_status === "occupied"
                    ? "border-amber-500/30 bg-amber-500/15 text-amber-300"
                    : "border-emerald-500/30 bg-emerald-500/15 text-emerald-300"
                }`}
              >
                <span
                  className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                    isFree ? "bg-emerald-400 animate-pulse" : "bg-amber-400 animate-pulse"
                  }`}
                  aria-hidden
                />
                {chatterStatus}
              </span>
            </td>
            <td className="p-3">
              {vaNames.length > 0 ? (
                <span className="rounded-full border border-[hsl(330,80%,55%)]/30 bg-[hsl(330,80%,55%)]/15 px-2 py-0.5 text-[hsl(330,90%,75%)]">
                  {vaNames.join(", ")}
                </span>
              ) : (
                <span className="text-white/45">—</span>
              )}
            </td>
          </motion.tr>
        );
      })}
    </>
  );
}
