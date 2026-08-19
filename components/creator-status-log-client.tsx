"use client";

import { useState, useMemo } from "react";
import type { CreatorStatusLogRow } from "@/services/infloww-creator-status-log";

const STATUS_COLORS: Record<string, string> = {
  connected: "text-emerald-400",
  active: "text-emerald-400",
  disconnected: "text-red-400",
  unbound: "text-red-400",
  inactive: "text-amber-400",
  pending: "text-amber-400",
};

function statusColor(s: string): string {
  const lower = s.toLowerCase();
  for (const [k, v] of Object.entries(STATUS_COLORS)) {
    if (lower.includes(k)) return v;
  }
  return "text-white/70";
}

function isDisconnect(row: CreatorStatusLogRow): boolean {
  const after = row.status_after.toLowerCase();
  return (
    after.includes("disconnect") ||
    after.includes("unbound") ||
    after.includes("inactive") ||
    after.includes("revoked")
  );
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  } catch {
    return iso.slice(0, 16).replace("T", " ");
  }
}

type Props = {
  entries: CreatorStatusLogRow[];
  modelNameById: Record<string, string>;
};

export function CreatorStatusLogClient({ entries, modelNameById }: Props) {
  const [search, setSearch] = useState("");
  const [onlyDisconnects, setOnlyDisconnects] = useState(false);

  const creatorOptions = useMemo(() => {
    const seen = new Set<string>();
    const opts: { label: string; value: string }[] = [];
    for (const e of entries) {
      if (seen.has(e.creator_infloww_id)) continue;
      seen.add(e.creator_infloww_id);
      const name = e.model_id ? (modelNameById[e.model_id] ?? e.creator_infloww_id) : e.creator_infloww_id;
      opts.push({ label: name, value: e.creator_infloww_id });
    }
    return opts.sort((a, b) => a.label.localeCompare(b.label));
  }, [entries, modelNameById]);

  const [selectedCreator, setSelectedCreator] = useState<string>("all");

  const filtered = useMemo(() => {
    return entries.filter((e) => {
      if (selectedCreator !== "all" && e.creator_infloww_id !== selectedCreator) return false;
      if (onlyDisconnects && !isDisconnect(e)) return false;
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const name = e.model_id ? (modelNameById[e.model_id] ?? "").toLowerCase() : "";
        const emp = (e.operation_employee_name ?? "").toLowerCase();
        if (!name.includes(q) && !emp.includes(q) && !e.status_after.toLowerCase().includes(q) && !e.status_before.toLowerCase().includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [entries, selectedCreator, onlyDisconnects, search, modelNameById]);

  // Group by model for timeline display
  const byModel = useMemo(() => {
    const map = new Map<string, CreatorStatusLogRow[]>();
    for (const e of filtered) {
      const key = e.creator_infloww_id;
      const list = map.get(key) ?? [];
      list.push(e);
      map.set(key, list);
    }
    // Sort groups by most recent event
    return [...map.entries()].sort((a, b) => {
      const aLatest = a[1][0]?.operation_time ?? "";
      const bLatest = b[1][0]?.operation_time ?? "";
      return bLatest.localeCompare(aLatest);
    });
  }, [filtered]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-white">Creator Status Log</h1>
        <p className="mt-1 text-sm text-white/55">
          Connection, bind, and 2FA status change history from Infloww · {entries.length} entries
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="text"
          placeholder="Search model, employee, status…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-9 w-60 rounded-lg border border-white/15 bg-white/[0.06] px-3 text-sm text-white placeholder:text-white/35 focus:border-white/30 focus:outline-none"
        />
        <select
          value={selectedCreator}
          onChange={(e) => setSelectedCreator(e.target.value)}
          className="h-9 rounded-lg border border-white/15 bg-white/[0.06] px-3 text-sm text-white focus:border-white/30 focus:outline-none"
        >
          <option value="all">All models</option>
          {creatorOptions.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <label className="flex cursor-pointer items-center gap-2 text-sm text-white/60">
          <input
            type="checkbox"
            checked={onlyDisconnects}
            onChange={(e) => setOnlyDisconnects(e.target.checked)}
            className="accent-red-400"
          />
          Disconnects only
        </label>
        <span className="ml-auto text-sm text-white/40">
          {filtered.length} event{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>

      {byModel.length === 0 && (
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-8 text-center text-sm text-white/40">
          No status change events found.
          {entries.length === 0 && (
            <p className="mt-2 text-white/30">
              Trigger a backfill via the API route <code className="text-white/50">/api/admin/infloww-backfill-status-log</code>.
            </p>
          )}
        </div>
      )}

      {/* Per-model timelines */}
      <div className="space-y-5">
        {byModel.map(([creatorId, events]) => {
          const modelId = events[0]?.model_id ?? null;
          const modelName = modelId ? (modelNameById[modelId] ?? creatorId) : creatorId;
          return (
            <div
              key={creatorId}
              className="rounded-2xl border border-white/10 bg-white/[0.04] p-5"
              style={{ boxShadow: "0 0 0 1px rgba(255,255,255,0.03)" }}
            >
              <div className="mb-4 flex items-center gap-2">
                <span className="text-sm font-semibold text-white">{modelName}</span>
                <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs text-white/50">
                  {events.length} event{events.length !== 1 ? "s" : ""}
                </span>
                <span className="ml-auto text-xs text-white/30">creator id: {creatorId}</span>
              </div>
              {/* Timeline */}
              <ol className="relative border-l border-white/10 pl-5 space-y-4">
                {events.map((e) => (
                  <li key={e.id} className="relative">
                    {/* dot */}
                    <span
                      className={`absolute -left-[1.125rem] mt-[3px] h-3 w-3 rounded-full border-2 border-[#1a1a2e] ${
                        isDisconnect(e) ? "bg-red-500" : "bg-emerald-500"
                      }`}
                    />
                    <div className="flex flex-wrap items-start gap-x-3 gap-y-0.5">
                      <span className="text-xs text-white/40 tabular-nums whitespace-nowrap">
                        {formatDate(e.operation_time)}
                      </span>
                      <div className="flex flex-wrap items-center gap-1 text-sm">
                        <span className={`font-medium ${statusColor(e.status_before)}`}>
                          {e.status_before || "—"}
                        </span>
                        <span className="text-white/30">→</span>
                        <span className={`font-medium ${statusColor(e.status_after)}`}>
                          {e.status_after || "—"}
                        </span>
                      </div>
                      {e.operation_employee_name && (
                        <span className="text-xs text-white/40">
                          by{" "}
                          <span className="text-white/60">{e.operation_employee_name}</span>
                        </span>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          );
        })}
      </div>
    </div>
  );
}
