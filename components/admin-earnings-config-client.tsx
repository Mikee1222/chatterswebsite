"use client";

import * as React from "react";
import { useToast } from "@/contexts/toast-context";
import { saveEarningsAgencyCutPercentsAction } from "@/app/actions/earnings-config";
import type { AppNotification } from "@/types";
import type { InflowwModel } from "@/types/infloww";

function localToast(
  id: string,
  title: string,
  body: string,
  priority: "normal" | "high"
): AppNotification {
  return {
    id,
    notification_id: id,
    user_id: "local-user",
    category: "system",
    event_type: "system_alert",
    priority,
    title,
    body,
    entity_type: "system",
    entity_id: "",
    read_at: null,
    created_at: new Date().toISOString(),
  };
}

type Row = { model_id: string; model_name: string; agency_cut_percent: string };

export function AdminEarningsConfigClient({
  models,
  initialPercents,
}: {
  models: InflowwModel[];
  initialPercents: Record<string, number>;
}) {
  const { addToast } = useToast();
  const [rows, setRows] = React.useState<Row[]>(() =>
    models.map((m) => ({
      model_id: m.id,
      model_name: m.name,
      agency_cut_percent: String(initialPercents[m.id] ?? 0),
    }))
  );
  const [saving, setSaving] = React.useState(false);

  async function save() {
    setSaving(true);
    try {
      const payload = rows.map((r) => ({
        model_id: r.model_id,
        agency_cut_percent: Math.max(0, Math.min(100, Number.parseFloat(r.agency_cut_percent) || 0)),
      }));
      const res = await saveEarningsAgencyCutPercentsAction(payload);
      if (!res.ok) {
        addToast(localToast(`earn-cfg-${Date.now()}`, "Save failed", res.error, "high"));
        return;
      }
      addToast(localToast(`earn-cfg-${Date.now()}`, "Saved", "Agency cut % updated for all models.", "normal"));
    } finally {
      setSaving(false);
    }
  }

  if (!models.length) {
    return (
      <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
        No creators returned from Infloww. Check API credentials, then reload.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/40 shadow-lg shadow-black/20">
        <div className="border-b border-white/10 bg-white/[0.04] px-5 py-4">
          <p className="text-sm text-white/60">
            Agency cut is calculated as <strong className="text-white/85">net × (percent ÷ 100)</strong>, where net is after
            OnlyFans 20% (same as the earnings dashboard).
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm text-white/90">
            <thead className="border-b border-white/10 bg-black/30 text-left text-xs font-medium uppercase tracking-wider text-white/50">
              <tr>
                <th className="px-4 py-3">Model</th>
                <th className="px-4 py-3">Infloww ID</th>
                <th className="px-4 py-3">Agency cut %</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.model_id} className="border-t border-white/10">
                  <td className="px-4 py-3 font-medium text-white/90">{r.model_name}</td>
                  <td className="px-4 py-3 font-mono text-xs text-white/55">{r.model_id}</td>
                  <td className="px-4 py-3">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step={0.5}
                      value={r.agency_cut_percent}
                      onChange={(e) => {
                        const v = e.target.value;
                        setRows((prev) => {
                          const next = [...prev];
                          next[i] = { ...next[i], agency_cut_percent: v };
                          return next;
                        });
                      }}
                      className="w-28 rounded-lg border border-white/15 bg-black/50 px-3 py-2 text-white focus:border-[hsl(330,80%,55%)]/50 focus:outline-none focus:ring-1 focus:ring-[hsl(330,80%,55%)]/40"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <button
        type="button"
        onClick={() => void save()}
        disabled={saving}
        className="rounded-xl bg-gradient-to-r from-[hsl(330,75%,52%)] to-[hsl(280,55%,48%)] px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-pink-950/30 transition-opacity hover:opacity-95 disabled:opacity-50"
      >
        {saving ? "Saving…" : "Save all"}
      </button>
    </div>
  );
}
