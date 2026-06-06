"use client";

import * as React from "react";
import { CheckCircle2, Clock, Image, Trophy, X, XCircle } from "lucide-react";
import { RankBadge } from "@/components/rank-badge";

type Rebill = {
  id: string;
  rebill_id: string;
  model_name: string;
  sub_username: string;
  screenshot: Array<{ url?: string; filename?: string }>;
  status: "pending" | "verified" | "rejected";
  admin_notes: string;
  created_at: string;
};

type Standing = {
  rank: number;
  chatter_id: string;
  chatter_name: string;
  count: number;
};

type StatusFilter = "all" | "pending" | "verified" | "rejected";

function statusLabel(status: Rebill["status"]): string {
  if (status === "verified") return "Approved";
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export function MyRebillsClient({
  rebills,
  standings,
  currentChatterId,
  rebillPointsById = {},
}: {
  rebills: Rebill[];
  standings: Standing[];
  currentChatterId: string;
  rebillPointsById?: Record<string, number>;
}) {
  const [tab, setTab] = React.useState<"rebills" | "standings">("rebills");
  const [filter, setFilter] = React.useState<StatusFilter>("all");
  const [selectedRebill, setSelectedRebill] = React.useState<Rebill | null>(null);

  const filtered = rebills.filter((r) => filter === "all" || r.status === filter);

  const myRank = standings.find((s) => s.chatter_id === currentChatterId)?.rank;
  const myCount = standings.find((s) => s.chatter_id === currentChatterId)?.count ?? 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white">My Rebills</h1>
        <p className="mt-1 text-white/50">Track your rebill submissions and standings</p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="glass-card p-4 text-center">
          <p className="text-2xl font-bold text-white">{rebills.length}</p>
          <p className="mt-1 text-xs text-white/50">Total Submitted</p>
        </div>
        <div className="glass-card p-4 text-center">
          <p className="text-2xl font-bold text-emerald-400">
            {rebills.filter((r) => r.status === "verified").length}
          </p>
          <p className="mt-1 text-xs text-white/50">Approved</p>
        </div>
        <div className="glass-card p-4 text-center">
          <p className="text-2xl font-bold text-pink-400">#{myRank ?? "—"}</p>
          <p className="mt-1 text-xs text-white/50">Your Rank ({myCount})</p>
        </div>
      </div>

      <div className="flex w-fit gap-1 rounded-xl border border-white/10 bg-white/5 p-1">
        {[
          { key: "rebills", label: "My Rebills" },
          { key: "standings", label: "Standings", icon: Trophy },
        ].map((t) => {
          const Icon = "icon" in t ? t.icon : undefined;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key as typeof tab)}
              className={
                tab === t.key
                  ? "rounded-lg bg-pink-500/20 px-4 py-1.5 text-sm font-medium text-pink-300"
                  : "px-4 py-1.5 text-sm text-white/50 hover:text-white"
              }
            >
              <span className="inline-flex items-center gap-1.5">
                {Icon ? <Icon className="h-4 w-4" aria-hidden /> : null}
                {t.label}
              </span>
            </button>
          );
        })}
      </div>

      {tab === "rebills" && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {(["all", "pending", "verified", "rejected"] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className={
                  filter === f
                    ? "rounded-full border border-pink-500/30 bg-pink-500/20 px-3 py-1 text-xs font-medium text-pink-300"
                    : "rounded-full border border-white/10 px-3 py-1 text-xs text-white/50 hover:text-white"
                }
              >
                {f === "all" ? "All" : statusLabel(f)}{""}
                ({f === "all" ? rebills.length : rebills.filter((r) => r.status === f).length})
              </button>
            ))}
          </div>

          {filtered.length === 0 ? (
            <div className="glass-card p-8 text-center text-white/40">No rebills in this category.</div>
          ) : (
            <div className="space-y-3">
              {filtered.map((rebill) => (
                <div
                  key={rebill.id}
                  onClick={() => setSelectedRebill(rebill)}
                  className="glass-card cursor-pointer p-4 transition-colors hover:bg-white/5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 flex-1 items-start gap-3">
                      {rebill.screenshot[0]?.url ? (
                        <img
                          src={rebill.screenshot[0].url}
                          alt="screenshot"
                          className="h-12 w-12 flex-shrink-0 rounded-lg border border-white/10 object-cover"
                        />
                      ) : (
                        <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5">
                          <Image className="h-5 w-5 text-white/20" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="truncate font-medium text-white">@{rebill.sub_username}</p>
                        <p className="text-sm text-white/50">{rebill.model_name}</p>
                        <p className="mt-1 text-xs text-white/30">
                          {rebill.created_at ? new Date(rebill.created_at).toLocaleDateString("el-GR") : "—"}
                        </p>
                      </div>
                    </div>
                    <div className="flex-shrink-0 text-right">
                      {rebill.status === "verified" && rebillPointsById[rebill.id] ? (
                        <p className="mb-1 text-xs font-semibold tabular-nums text-emerald-400">
                          +{rebillPointsById[rebill.id]} pts
                        </p>
                      ) : null}
                      {rebill.status === "verified" && (
                        <span className="flex items-center gap-1 text-xs font-medium text-emerald-400">
                          <CheckCircle2 className="h-4 w-4" /> Approved
                        </span>
                      )}
                      {rebill.status === "pending" && (
                        <span className="flex items-center gap-1 text-xs font-medium text-yellow-400">
                          <Clock className="h-4 w-4" /> Pending
                        </span>
                      )}
                      {rebill.status === "rejected" && (
                        <span className="flex items-center gap-1 text-xs font-medium text-red-400">
                          <XCircle className="h-4 w-4" /> Rejected
                        </span>
                      )}
                    </div>
                  </div>
                  {rebill.admin_notes ? (
                    <p className="mt-2 border-t border-white/5 pt-2 text-xs text-white/40">
                      Note: {rebill.admin_notes}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "standings" && (
        <div className="space-y-3">
          <p className="text-sm text-white/50">Ranked by approved paid rebills</p>
          {standings.map((s) => (
            <div
              key={s.chatter_id}
              className={`glass-card flex items-center gap-4 p-4 ${
                s.chatter_id === currentChatterId ? "border-pink-500/30 bg-pink-500/5" : ""
              }`}
            >
              <div className="w-8 flex-shrink-0 text-center">
                <RankBadge rank={s.rank} />
              </div>
              <div className="flex-1">
                <p
                  className={`font-medium ${
                    s.chatter_id === currentChatterId ? "text-pink-300" : "text-white"
                  }`}
                >
                  {s.chatter_name}
                  {s.chatter_id === currentChatterId ? "(You)" : ""}
                </p>
              </div>
              <div className="text-right">
                <p className="font-bold text-white">{s.count}</p>
                <p className="text-xs text-white/40">approved rebills</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedRebill ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 md:items-center"
          onClick={() => setSelectedRebill(null)}
        >
          <div className="glass-card w-full max-w-md space-y-4 p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-white">Rebill Details</h3>
              <button
                type="button"
                onClick={() => setSelectedRebill(null)}
                className="text-white/40 hover:text-white"
              >
                <X className="h-5 w-5" aria-hidden />
              </button>
            </div>
            {selectedRebill.screenshot[0]?.url ? (
              <img
                src={selectedRebill.screenshot[0].url}
                alt="proof"
                className="max-h-64 w-full rounded-xl border border-white/10 object-contain"
              />
            ) : null}
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-white/50">Subscriber</span>
                <span className="text-white">@{selectedRebill.sub_username}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/50">Model</span>
                <span className="text-white">{selectedRebill.model_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/50">Date</span>
                <span className="text-white">
                  {selectedRebill.created_at
                    ? new Date(selectedRebill.created_at).toLocaleDateString("el-GR")
                    : "—"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/50">Status</span>
                <span
                  className={
                    selectedRebill.status === "verified"
                      ? "text-emerald-400"
                      : selectedRebill.status === "rejected"
                        ? "text-red-400"
                        : "text-yellow-400"
                  }
                >
                  {statusLabel(selectedRebill.status)}
                </span>
              </div>
              {selectedRebill.status === "verified" && rebillPointsById[selectedRebill.id] ? (
                <div className="flex justify-between">
                  <span className="text-white/50">Points earned</span>
                  <span className="font-semibold tabular-nums text-emerald-400">
                    +{rebillPointsById[selectedRebill.id]} pts
                  </span>
                </div>
              ) : null}
              {selectedRebill.admin_notes ? (
                <div className="border-t border-white/10 pt-2">
                  <p className="text-xs text-white/50">Admin note</p>
                  <p className="mt-1 text-sm text-white">{selectedRebill.admin_notes}</p>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
