"use client";

import * as React from "react";
import { Copy, Search, X } from "lucide-react";
import { useToast } from "@/contexts/toast-context";
import type { AppNotification } from "@/types";
import { formatDateTimeAthens } from "@/lib/format";
import type { MistakeReasonCategory, MistakeReasonRecord, MistakeRecord } from "@/services/chatter-mistakes";
import { FormInput } from "@/components/ui/form-input";

function localToast(id: string, title: string, body: string, priority: "normal" | "high"): AppNotification {
  return {
    id,
    notification_id: id,
    user_id: "local",
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

function timeAgo(iso: string): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "—";
  const sec = Math.max(0, Math.floor((Date.now() - t) / 1000));
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} min ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return `${Math.floor(hr / 24)}d ago`;
}

function categoryBadgeClass(cat: MistakeReasonCategory): string {
  if (cat === "High") return "bg-red-500/15 border-red-500/25 text-red-400";
  if (cat === "Medium") return "bg-amber-500/15 border-amber-500/25 text-amber-400";
  return "bg-yellow-500/15 border-yellow-500/25 text-yellow-400";
}

function statusBadgeClass(st: string): string {
  if (st === "approved") return "bg-green-500/15 border-green-500/25 text-green-400";
  if (st === "rejected") return "bg-red-500/15 border-red-500/25 text-red-400";
  return "bg-amber-500/15 border-amber-500/25 text-amber-400";
}

type Props = {
  initialMistakes: MistakeRecord[];
  reasons: MistakeReasonRecord[];
  chatterOptions: { id: string; name: string }[];
  modelOptions: { id: string; name: string }[];
};

export function AdminMistakesClient({ initialMistakes, reasons, chatterOptions, modelOptions }: Props) {
  const { addToast } = useToast();
  const [rows, setRows] = React.useState(initialMistakes);
  const [selectedId, setSelectedId] = React.useState<string | null>(initialMistakes[0]?.id ?? null);
  const [search, setSearch] = React.useState("");
  const [chatterFilter, setChatterFilter] = React.useState("all");
  const [modelFilter, setModelFilter] = React.useState("all");
  const [categoryFilter, setCategoryFilter] = React.useState<"all" | MistakeReasonCategory>("all");
  const [statusFilter, setStatusFilter] = React.useState<"all" | "pending" | "approved" | "rejected">("all");
  const [fromDate, setFromDate] = React.useState("");
  const [toDate, setToDate] = React.useState("");
  const [adminNotes, setAdminNotes] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  const reasonPointsByReasonId = React.useMemo(() => {
    const m = new Map<string, number>();
    reasons.forEach((r) => m.set(r.reason_id, r.points_deduction));
    return m;
  }, [reasons]);

  const selected = rows.find((r) => r.id === selectedId) ?? null;
  React.useEffect(() => {
    setAdminNotes(selected?.admin_notes ?? "");
  }, [selectedId, selected?.admin_notes]);

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (chatterFilter !== "all" && r.chatter_id !== chatterFilter) return false;
      if (modelFilter !== "all" && r.model_id !== modelFilter) return false;
      if (categoryFilter !== "all" && r.reason_category !== categoryFilter) return false;
      if (fromDate) {
        const d = (r.mistake_date || "").slice(0, 10);
        if (!d || d < fromDate) return false;
      }
      if (toDate) {
        const d = (r.mistake_date || "").slice(0, 10);
        if (!d || d > toDate) return false;
      }
      if (!q) return true;
      return `${r.sub_username} ${r.chatter_name} ${r.model_name} ${r.reason_label}`.toLowerCase().includes(q);
    });
  }, [rows, search, chatterFilter, modelFilter, categoryFilter, statusFilter, fromDate, toDate]);

  const stats = React.useMemo(() => {
    const pending = rows.filter((r) => r.status === "pending").length;
    const approved = rows.filter((r) => r.status === "approved").length;
    const rejected = rows.filter((r) => r.status === "rejected").length;
    return { total: rows.length, pending, approved, rejected };
  }, [rows]);

  const pointsForSelected = selected
    ? selected.status === "pending"
      ? reasonPointsByReasonId.get(selected.reason_id) ?? selected.points_deducted
      : selected.points_deducted
    : 0;

  const pointsDisplayed = selected
    ? selected.status === "pending"
      ? pointsForSelected
      : selected.points_deducted
    : 0;

  async function handleEasyCopy(m: MistakeRecord) {
    const text = [
      `⚠️ MISTAKE REPORT`,
      `Category: ${m.reason_category} | ${m.reason_label}`,
      `Chatter: ${m.chatter_name}`,
      `Model: ${m.model_name}`,
      `Sub: @${m.sub_username}`,
      `Date: ${formatDateTimeAthens(m.mistake_date)}`,
      `Explanation: ${m.explanation}`,
      m.admin_notes ? `Admin note: ${m.admin_notes}` : "",
      `Points deducted: ${m.points_deducted}`,
    ]
      .filter(Boolean)
      .join("\n");
    try {
      await navigator.clipboard.writeText(text);
      addToast(localToast("mist-copy", "Copied", "Copied to clipboard!", "normal"));
    } catch {
      addToast(localToast("mist-copy-fail", "Copy failed", "Clipboard unavailable.", "high"));
    }
  }

  async function handleApprove(id: string) {
    const row = rows.find((r) => r.id === id);
    const pts = row ? reasonPointsByReasonId.get(row.reason_id) ?? row.points_deducted : 0;
    setSaving(true);
    const prev = rows;
    setRows((p) => p.map((r) => (r.id === id ? { ...r, status: "approved" as const, points_deducted: pts } : r)));
    try {
      const res = await fetch(`/api/admin/mistakes/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "approve", admin_notes: adminNotes }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "fail");
      const mist = data.mistake as MistakeRecord | undefined;
      if (mist) setRows((p) => p.map((r) => (r.id === id ? mist : r)));
      addToast(localToast("mist-appr", "Approved", "Mistake approved and points deducted.", "normal"));
    } catch {
      setRows(prev);
      addToast(localToast("mist-appr-e", "Approve failed", "Could not approve.", "high"));
    } finally {
      setSaving(false);
    }
  }

  async function handleReject(id: string) {
    setSaving(true);
    const prev = rows;
    setRows((p) => p.map((r) => (r.id === id ? { ...r, status: "rejected" as const, admin_notes: adminNotes } : r)));
    try {
      const res = await fetch(`/api/admin/mistakes/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reject", admin_notes: adminNotes }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "fail");
      const mist = data.mistake as MistakeRecord | undefined;
      if (mist) setRows((p) => p.map((r) => (r.id === id ? mist : r)));
      addToast(localToast("mist-rej", "Rejected", "Mistake rejected.", "normal"));
    } catch {
      setRows(prev);
      addToast(localToast("mist-rej-e", "Reject failed", "Could not reject.", "high"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-white">Mistakes</h1>
        <p className="mt-1 text-sm text-white/50">Review VA-submitted chatter mistakes.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Total", v: stats.total },
          { label: "Pending", v: stats.pending },
          { label: "Approved", v: stats.approved },
          { label: "Rejected", v: stats.rejected },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-white/40">{s.label}</p>
            <p className="mt-1 text-2xl font-bold text-white">{s.v}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
        <div className="relative min-w-[180px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
          <FormInput
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search sub username…"
            className="!pl-9"
          />
        </div>
        <select
          value={chatterFilter}
          onChange={(e) => setChatterFilter(e.target.value)}
          className="min-h-10 rounded-xl border border-white/10 bg-white/[0.04] px-3 text-sm text-white"
        >
          <option value="all">All chatters</option>
          {chatterOptions.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          value={modelFilter}
          onChange={(e) => setModelFilter(e.target.value)}
          className="min-h-10 rounded-xl border border-white/10 bg-white/[0.04] px-3 text-sm text-white"
        >
          <option value="all">All models</option>
          {modelOptions.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value as typeof categoryFilter)}
          className="min-h-10 rounded-xl border border-white/10 bg-white/[0.04] px-3 text-sm text-white"
        >
          <option value="all">All categories</option>
          <option value="Low">Low</option>
          <option value="Medium">Medium</option>
          <option value="High">High</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
          className="min-h-10 rounded-xl border border-white/10 bg-white/[0.04] px-3 text-sm text-white"
        >
          <option value="all">All statuses</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
        <FormInput type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="min-h-10 w-[140px]" />
        <FormInput type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="min-h-10 w-[140px]" />
      </div>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        <div className="min-h-[320px] flex-1 space-y-3">
          {filtered.length === 0 ? (
            <p className="text-sm text-white/45">No mistakes match filters.</p>
          ) : (
            filtered.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setSelectedId(m.id)}
                className={`w-full rounded-2xl border p-4 text-left transition-colors ${
                  selectedId === m.id ? "border-pink-500/40 bg-pink-500/10" : "border-white/10 bg-white/5 hover:border-white/20"
                }`}
              >
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${categoryBadgeClass(m.reason_category)}`}>
                    {m.reason_category}
                  </span>
                  <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold capitalize ${statusBadgeClass(m.status)}`}>
                    {m.status}
                  </span>
                  <span className="ml-auto text-xs text-white/30">{timeAgo(m.created_at)}</span>
                </div>
                <p className="font-semibold text-white">{m.reason_label}</p>
                <p className="text-sm text-white/50">
                  {m.chatter_name} → {m.model_name} · @{m.sub_username}
                </p>
                <p className="mt-1 text-xs text-white/30">Submitted by {m.va_name}</p>
              </button>
            ))
          )}
        </div>

        {selected ? (
          <div className="w-full shrink-0 rounded-2xl border border-white/10 bg-white/5 p-5 lg:sticky lg:top-4 lg:w-80">
            <div className="mb-4 flex items-start justify-between">
              <div className="space-y-1">
                <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${categoryBadgeClass(selected.reason_category)}`}>
                  {selected.reason_category}
                </span>
                <h2 className="font-bold text-white">{selected.reason_label}</h2>
              </div>
              <button
                type="button"
                onClick={() => setSelectedId(null)}
                className="rounded-lg p-1 text-white/30 hover:bg-white/10 hover:text-white/60"
                aria-label="Close detail"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mb-4 space-y-2 text-sm">
              <div className="flex gap-2">
                <span className="text-white/40">Chatter:</span>
                <span className="text-white">{selected.chatter_name}</span>
              </div>
              <div className="flex gap-2">
                <span className="text-white/40">Model:</span>
                <span className="text-white">{selected.model_name}</span>
              </div>
              <div className="flex gap-2">
                <span className="text-white/40">Sub:</span>
                <span className="text-white">@{selected.sub_username}</span>
              </div>
              <div className="flex gap-2">
                <span className="text-white/40">Date:</span>
                <span className="text-white">{formatDateTimeAthens(selected.mistake_date)}</span>
              </div>
              <div className="flex gap-2">
                <span className="text-white/40">Points:</span>
                <span className="text-red-400">-{pointsDisplayed}</span>
              </div>
              <div className="flex gap-2">
                <span className="text-white/40">VA:</span>
                <span className="text-white">{selected.va_name}</span>
              </div>
            </div>

            <div className="mb-3 rounded-xl border border-white/8 bg-white/[0.03] p-3">
              <p className="mb-1 text-xs uppercase tracking-widest text-white/40">Explanation</p>
              <p className="text-sm text-white/70">{selected.explanation}</p>
            </div>

            {selected.screenshot?.[0]?.url ? (
              <div className="mb-3">
                <p className="mb-2 text-xs uppercase tracking-widest text-white/40">Screenshot</p>
                <a href={selected.screenshot[0].url} target="_blank" rel="noreferrer">
                  <img
                    src={selected.screenshot[0].url}
                    alt=""
                    className="w-full rounded-xl border border-white/10 transition-opacity hover:opacity-80"
                  />
                </a>
              </div>
            ) : null}

            <button
              type="button"
              onClick={() => void handleEasyCopy(selected)}
              className="mb-3 flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 py-2 text-sm text-white/60 transition-all hover:bg-white/10"
            >
              <Copy className="h-4 w-4" /> Easy copy
            </button>

            <textarea
              value={adminNotes}
              onChange={(e) => setAdminNotes(e.target.value)}
              placeholder="Add note for chatter/VA..."
              rows={3}
              className="mb-3 w-full resize-none rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/20 focus:border-pink-500/50 focus:outline-none"
            />

            {selected.status === "pending" ? (
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void handleApprove(selected.id)}
                  className="w-full rounded-xl border border-green-500/30 bg-green-500/20 py-2.5 font-semibold text-green-400 hover:bg-green-500/30 disabled:opacity-50"
                >
                  ✅ Approve & deduct {pointsForSelected} pts
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void handleReject(selected.id)}
                  className="w-full rounded-xl border border-red-500/30 bg-red-500/20 py-2.5 font-semibold text-red-400 hover:bg-red-500/30 disabled:opacity-50"
                >
                  ❌ Reject
                </button>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
