"use client";

import * as React from "react";
import { formatDateTimeEuropean } from "@/lib/format";
import { Input, Select, selectOptionClass } from "@/components/ui/form";
import type { ModelRecord } from "@/types";

type Props = {
  modelss: ModelRecord[];
  modelIdToVaNames: Record<string, string[]>;
};

export function AdminModelsClient({ modelss, modelIdToVaNames }: Props) {
  const [filterPlatform, setFilterPlatform] = React.useState("");
  const [filterStatus, setFilterStatus] = React.useState("");
  const [filterPriority, setFilterPriority] = React.useState("");
  const [filterChatter, setFilterChatter] = React.useState("");
  const [viewFilter, setViewFilter] = React.useState<"all" | "free" | "taken">("all");

  const filtered = React.useMemo(() => {
    let list = modelss;
    if (filterPlatform) list = list.filter((m) => m.platform === filterPlatform);
    if (filterStatus) list = list.filter((m) => (m.status ?? "") === filterStatus);
    if (filterPriority) list = list.filter((m) => (m.priority ?? "") === filterPriority);
    if (filterChatter) list = list.filter((m) => (m.current_chatter_name ?? "").toLowerCase().includes(filterChatter.toLowerCase()));
    if (viewFilter === "free") list = list.filter((m) => m.current_status === "free");
    if (viewFilter === "taken") list = list.filter((m) => m.current_status === "occupied");
    return list;
  }, [modelss, filterPlatform, filterStatus, filterPriority, filterChatter, viewFilter]);

  const platforms = React.useMemo(() => [...new Set(modelss.map((m) => m.platform).filter(Boolean))].sort(), [modelss]);
  const statuses = React.useMemo(() => [...new Set(modelss.map((m) => m.status).filter(Boolean))].sort(), [modelss]);
  const priorities = React.useMemo(() => [...new Set(modelss.map((m) => m.priority).filter(Boolean))].sort(), [modelss]);

  const freeCount = modelss.filter((m) => m.current_status === "free").length;
  const takenCount = modelss.length - freeCount;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-white">Models</h1>
        <p className="mt-1 text-sm text-white/60">
          Model availability and current ownership. Table: modelss. Chatter occupancy vs VA presence.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <div className="inline-flex rounded-xl border border-white/10 bg-white/5 p-1">
          {(["all", "free", "taken"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setViewFilter(v)}
              className={`rounded-lg px-4 py-2 text-sm font-medium capitalize ${
                viewFilter === v
                  ? "bg-[hsl(330,80%,55%)]/20 text-[hsl(330,90%,65%)]"
                  : "text-white/70 hover:bg-white/5 hover:text-white"
              }`}
            >
              {v} {v === "free" && `(${freeCount})`} {v === "taken" && `(${takenCount})`}
            </button>
          ))}
        </div>
        <Select
          value={filterPlatform}
          onChange={(e) => setFilterPlatform(e.target.value)}
          className="w-36"
        >
          <option value="" className={selectOptionClass}>Platform</option>
          {platforms.map((p) => (
            <option key={p} value={p} className={selectOptionClass}>{p}</option>
          ))}
        </Select>
        <Select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="w-36"
        >
          <option value="" className={selectOptionClass}>Status</option>
          {statuses.map((s) => (
            <option key={s} value={s} className={selectOptionClass}>{s}</option>
          ))}
        </Select>
        <Select
          value={filterPriority}
          onChange={(e) => setFilterPriority(e.target.value)}
          className="w-36"
        >
          <option value="" className={selectOptionClass}>Priority</option>
          {priorities.map((p) => (
            <option key={p} value={p} className={selectOptionClass}>{p}</option>
          ))}
        </Select>
        <Input
          type="text"
          placeholder="Current chatter"
          value={filterChatter}
          onChange={(e) => setFilterChatter(e.target.value)}
          className="w-40"
        />
      </div>

      {/* Mobile: stacked cards */}
      <div className="space-y-4 md:hidden">
        {filtered.length === 0 ? (
          <p className="rounded-2xl border border-white/10 bg-white/5 p-6 text-center text-white/50">No models match</p>
        ) : (
          filtered.map((m) => {
            const vaNames = modelIdToVaNames[m.id] ?? [];
            return (
              <div
                key={m.id}
                className="rounded-2xl border border-white/10 bg-white/[0.06] p-4"
                style={{ boxShadow: "0 0 0 1px rgba(255,255,255,0.04)" }}
              >
                <p className="text-base font-semibold text-white/95">{m.model_name}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span
                    className={
                      m.current_status === "occupied"
                        ? "rounded-full border border-amber-500/30 bg-amber-500/15 px-2.5 py-1 text-xs font-medium text-amber-300"
                        : "rounded-full border border-emerald-500/30 bg-emerald-500/15 px-2.5 py-1 text-xs font-medium text-emerald-300"
                    }
                  >
                    {m.current_status === "occupied" ? (m.current_chatter_name || "Occupied") : "Free"}
                  </span>
                  {vaNames.length > 0 && (
                    <span className="rounded-full border border-[hsl(330,80%,55%)]/30 bg-[hsl(330,80%,55%)]/15 px-2.5 py-1 text-xs text-[hsl(330,90%,75%)]">
                      VA: {vaNames.join(", ")}
                    </span>
                  )}
                </div>
                <div className="mt-3 space-y-1 text-sm text-white/70">
                  {m.entered_at && <p>Entered: {formatDateTimeEuropean(m.entered_at)}</p>}
                  {m.last_chatter_name && <p>Last chatter: {m.last_chatter_name}</p>}
                  {m.last_exit_at && <p>Last exit: {formatDateTimeEuropean(m.last_exit_at)}</p>}
                  {m.priority && <p>Priority: {m.priority}</p>}
                </div>
              </div>
            );
          })
        )}
      </div>
      {/* Desktop: table */}
      <div className="glass-card overflow-hidden hidden md:block">
        <table className="w-full text-sm">
          <thead className="border-b border-white/10 bg-black/40 text-left text-xs font-medium uppercase tracking-wider text-white/50">
            <tr>
              <th className="p-3 font-medium">Model</th>
              <th className="p-3 font-medium">Chatter</th>
              <th className="p-3 font-medium">VA in model</th>
              <th className="p-3 font-medium">Entered at</th>
              <th className="p-3 font-medium">Last chatter</th>
              <th className="p-3 font-medium">Last exit</th>
              <th className="p-3 font-medium">Priority</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-white/50">No models match</td>
              </tr>
            ) : (
              filtered.map((m) => {
                const vaNames = modelIdToVaNames[m.id] ?? [];
                return (
                  <tr key={m.id} className="hover:bg-white/[0.03]">
                    <td className="p-3 font-medium text-white/90">{m.model_name}</td>
                    <td className="p-3">
                      <span
                        className={
                          m.current_status === "occupied"
                            ? "rounded-full border border-amber-500/30 bg-amber-500/15 px-2 py-0.5 text-amber-300"
                            : "rounded-full border border-emerald-500/30 bg-emerald-500/15 px-2 py-0.5 text-emerald-300"
                        }
                      >
                        {m.current_status === "occupied" ? (m.current_chatter_name || "Occupied") : "Free"}
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
                    <td className="p-3 text-white/70">{m.entered_at ? formatDateTimeEuropean(m.entered_at) : "—"}</td>
                    <td className="p-3 text-white/70">{m.last_chatter_name || "—"}</td>
                    <td className="p-3 text-white/70">{m.last_exit_at ? formatDateTimeEuropean(m.last_exit_at) : "—"}</td>
                    <td className="p-3 text-white/60">{m.priority || "—"}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
