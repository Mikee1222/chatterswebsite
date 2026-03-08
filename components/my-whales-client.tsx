"use client";

import * as React from "react";
import { Select, selectOptionClass } from "@/components/ui/form";
import { RELATIONSHIP_STATUS_OPTIONS, WHALE_STATUS_OPTIONS } from "@/lib/airtable-options";
import { MyWhalesTable } from "@/components/my-whales-table";
import type { Whale } from "@/types";

function displayModelName(whale: Whale, modelNames: Record<string, string>): string {
  const snapshot = whale.assigned_model_name?.trim();
  if (snapshot && !/^rec[A-Za-z0-9]{14}$/.test(snapshot)) return snapshot;
  const resolved = whale.assigned_model_id && modelNames[whale.assigned_model_id]?.trim();
  if (resolved) return resolved;
  return "—";
}

type Props = {
  whales: Whale[];
  modelNames: Record<string, string>;
};

export function MyWhalesClient({ whales, modelNames }: Props) {
  const [filterStatus, setFilterStatus] = React.useState("");
  const [filterRelationship, setFilterRelationship] = React.useState("");
  const [filterModel, setFilterModel] = React.useState("");

  const filtered = React.useMemo(() => {
    let list = whales;
    if (filterStatus) list = list.filter((w) => w.status === filterStatus);
    if (filterRelationship) list = list.filter((w) => w.relationship_status === filterRelationship);
    if (filterModel)
      list = list.filter((w) => displayModelName(w, modelNames) === filterModel);
    return list;
  }, [whales, filterStatus, filterRelationship, filterModel, modelNames]);

  const modelOptions = React.useMemo(() => {
    const names = new Set<string>();
    whales.forEach((w) => {
      const name = displayModelName(w, modelNames);
      if (name && name !== "—") names.add(name);
    });
    return [...names].sort();
  }, [whales, modelNames]);

  const stats = React.useMemo(() => {
    const total = filtered.length;
    const active = filtered.filter((w) => w.status === "Active").length;
    const inactive = filtered.filter((w) => w.status === "Inactive").length;
    const dead = filtered.filter((w) => w.status === "Dead").length;
    const deleted = filtered.filter((w) => w.status === "Deleted Account").length;
    return { total, active, inactive, dead, deleted };
  }, [filtered]);

  return (
    <div className="space-y-6">
      {/* Summary stats */}
      <div className="flex flex-wrap gap-3">
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wider text-white/50">Total</p>
          <p className="mt-0.5 text-xl font-semibold text-white">{stats.total}</p>
        </div>
        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wider text-emerald-300/80">Active</p>
          <p className="mt-0.5 text-xl font-semibold text-emerald-300">{stats.active}</p>
        </div>
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wider text-amber-300/80">Inactive</p>
          <p className="mt-0.5 text-xl font-semibold text-amber-300">{stats.inactive}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wider text-white/50">Dead</p>
          <p className="mt-0.5 text-xl font-semibold text-white/90">{stats.dead}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wider text-white/50">Deleted account</p>
          <p className="mt-0.5 text-xl font-semibold text-white/90">{stats.deleted}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4">
        <Select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="min-w-[140px]"
        >
          <option value="" className={selectOptionClass}>Status</option>
          {WHALE_STATUS_OPTIONS.map((o) => (
            <option key={o} value={o} className={selectOptionClass}>{o}</option>
          ))}
        </Select>
        <Select
          value={filterRelationship}
          onChange={(e) => setFilterRelationship(e.target.value)}
          className="min-w-[140px]"
        >
          <option value="" className={selectOptionClass}>Relationship</option>
          {RELATIONSHIP_STATUS_OPTIONS.map((o) => (
            <option key={o} value={o} className={selectOptionClass}>{o}</option>
          ))}
        </Select>
        <Select
          value={filterModel}
          onChange={(e) => setFilterModel(e.target.value)}
          className="w-48"
        >
          <option value="" className={selectOptionClass}>Model</option>
          {modelOptions.map((o) => (
            <option key={o} value={o} className={selectOptionClass}>{o}</option>
          ))}
        </Select>
      </div>

      <div className="glass-card overflow-hidden">
        <MyWhalesTable whales={filtered} modelNames={modelNames} />
      </div>
    </div>
  );
}
