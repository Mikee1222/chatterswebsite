"use client";

import * as React from "react";
import { Pencil, Search, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { GlassModal } from "@/components/ui/form";
import { FormTextarea } from "@/components/ui/form-textarea";
import { formatDateTimeEuropean, formatMonthYyyyMm, formatRelativeTime } from "@/lib/format";
import { usePagination } from "@/lib/use-pagination";
import { FormInput } from "@/components/ui/form-input";
import {
  isChatterExtraRevenueSubmission,
  isPendingExtraRevenueReview,
  isSpinWheelFineBonus,
  type FineBonusPaymentMethod,
  type FineBonusRecord,
  type FineBonusType,
  type FineBonusUserRole,
} from "@/services/fines-bonuses";

type UserOpt = { id: string; name: string; user_role: FineBonusUserRole };
type ModelOpt = { id: string; name: string };

type Props = {
  initialEntries: FineBonusRecord[];
  userOptions: UserOpt[];
  modelOptions?: ModelOpt[];
  isAdmin?: boolean;
};

function RoleBadge({ role }: { role: FineBonusUserRole }) {
  const isVa = role === "va";
  return (
    <span
      className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${
        isVa ? "border-purple-500/30 bg-purple-500/15 text-purple-300" : "border-sky-500/30 bg-sky-500/15 text-sky-300"
      }`}
    >
      {isVa ? "VA" : "Chatter"}
    </span>
  );
}

function TypeBadge({ type }: { type: FineBonusType }) {
  return (
    <span
      className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${
        type === "bonus" ? "border-green-500/30 bg-green-500/15 text-green-400" : "border-red-500/30 bg-red-500/15 text-red-400"
      }`}
    >
      {type}
    </span>
  );
}

function StatusBadge({ status }: { status?: string }) {
  if (status === "pending_review") {
    return (
      <span className="inline-flex rounded-full border border-yellow-500/30 bg-yellow-500/15 px-2 py-0.5 text-xs font-medium text-yellow-300">
        Pending
      </span>
    );
  }
  if (status === "approved") {
    return (
      <span className="inline-flex rounded-full border border-green-500/30 bg-green-500/15 px-2 py-0.5 text-xs font-medium text-green-400">
        Approved
      </span>
    );
  }
  if (status === "rejected") {
    return (
      <span className="inline-flex rounded-full border border-red-500/30 bg-red-500/15 px-2 py-0.5 text-xs font-medium text-red-400">
        Rejected
      </span>
    );
  }
  return null;
}

function SpinWheelBadge() {
  return (
    <span className="inline-flex rounded-full border border-amber-500/30 bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-300">
      Spin Wheel
    </span>
  );
}

function ManualBadge() {
  return (
    <span className="inline-flex rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-xs font-medium text-white/50">
      Manual
    </span>
  );
}

function ChatterSubmissionBadge() {
  return (
    <span className="inline-flex rounded-full border border-pink-500/30 bg-pink-500/15 px-2 py-0.5 text-xs font-medium text-pink-300">
      Chatter submission
    </span>
  );
}

function entrySourceBadge(entry: FineBonusRecord) {
  if (isChatterExtraRevenueSubmission(entry)) return <ChatterSubmissionBadge />;
  if (isSpinWheelFineBonus(entry)) return <SpinWheelBadge />;
  return <ManualBadge />;
}

type SourceFilter = "all" | "manual" | "spin_wheel" | "chatter_submission";
type MethodFilter = "all" | FineBonusPaymentMethod;

type MonthGroup = {
  month: string;
  entries: FineBonusRecord[];
};

function groupByMonth(entries: FineBonusRecord[]): MonthGroup[] {
  const map = new Map<string, FineBonusRecord[]>();
  for (const e of entries) {
    const m = e.month && /^\d{4}-\d{2}$/.test(e.month) ? e.month : "unknown";
    if (!map.has(m)) map.set(m, []);
    map.get(m)!.push(e);
  }
  return [...map.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([month, items]) => ({
      month,
      entries: items.sort((a, b) => b.created_at.localeCompare(a.created_at)),
    }));
}

export function AdminFinesBonusesClient({
  initialEntries,
  userOptions,
  modelOptions = [],
  isAdmin = false,
}: Props) {
  const [rows, setRows] = React.useState(initialEntries);
  const [userFilter, setUserFilter] = React.useState("all");
  const [modelFilter, setModelFilter] = React.useState("all");
  const [methodFilter, setMethodFilter] = React.useState<MethodFilter>("all");
  const [roleFilter, setRoleFilter] = React.useState<"all" | FineBonusUserRole>("all");
  const [typeFilter, setTypeFilter] = React.useState<"all" | FineBonusType>("all");
  const [sourceFilter, setSourceFilter] = React.useState<SourceFilter>("all");
  const [monthFilter, setMonthFilter] = React.useState("");
  const [search, setSearch] = React.useState("");
  const [reviewEntry, setReviewEntry] = React.useState<FineBonusRecord | null>(null);
  const [rejectReason, setRejectReason] = React.useState("");
  const [rejectStep, setRejectStep] = React.useState(false);
  const [reviewPending, setReviewPending] = React.useState(false);
  const [lightboxUrl, setLightboxUrl] = React.useState<string | null>(null);
  const [editEntry, setEditEntry] = React.useState<FineBonusRecord | null>(null);
  const [editType, setEditType] = React.useState<FineBonusType>("bonus");
  const [editAmount, setEditAmount] = React.useState("");
  const [editReason, setEditReason] = React.useState("");
  const [editMonth, setEditMonth] = React.useState("");
  const [editNotes, setEditNotes] = React.useState("");
  const [editPending, setEditPending] = React.useState(false);
  const [deleteEntry, setDeleteEntry] = React.useState<FineBonusRecord | null>(null);
  const [deletePending, setDeletePending] = React.useState(false);

  function openReview(entry: FineBonusRecord) {
    setReviewEntry(entry);
    setRejectReason("");
    setRejectStep(false);
  }

  function closeReview() {
    if (reviewPending) return;
    setReviewEntry(null);
    setRejectReason("");
    setRejectStep(false);
  }

  function openEdit(entry: FineBonusRecord) {
    setEditEntry(entry);
    setEditType(entry.type);
    setEditAmount(String(entry.amount));
    setEditReason(entry.reason);
    setEditMonth(entry.month && /^\d{4}-\d{2}$/.test(entry.month) ? entry.month : "");
    setEditNotes(entry.notes ?? "");
  }

  function closeEdit() {
    if (editPending) return;
    setEditEntry(null);
  }

  async function submitEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editEntry) return;
    const amt = Number.parseFloat(editAmount);
    if (!editReason.trim() || !editMonth || !Number.isFinite(amt) || amt < 0) {
      toast.error("Amount, reason, and month are required");
      return;
    }
    setEditPending(true);
    try {
      const res = await fetch(`/api/admin/fines-bonuses/${editEntry.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: editType,
          amount: amt,
          reason: editReason.trim(),
          month: editMonth,
          notes: editNotes.trim(),
        }),
      });
      const data = (await res.json()) as { error?: string; entry?: FineBonusRecord };
      if (!res.ok || !data.entry) {
        toast.error(typeof data.error === "string" ? data.error : "Update failed");
        return;
      }
      setRows((prev) => prev.map((r) => (r.id === data.entry!.id ? data.entry! : r)));
      toast.success("Entry updated");
      closeEdit();
    } finally {
      setEditPending(false);
    }
  }

  async function confirmDelete() {
    if (!deleteEntry) return;
    setDeletePending(true);
    try {
      const res = await fetch(`/api/admin/fines-bonuses/${deleteEntry.id}`, { method: "DELETE" });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        toast.error(typeof data.error === "string" ? data.error : "Delete failed");
        return;
      }
      setRows((prev) => prev.filter((r) => r.id !== deleteEntry.id));
      toast.success("Entry deleted");
      setDeleteEntry(null);
    } finally {
      setDeletePending(false);
    }
  }

  function paymentMethodLabel(entry: FineBonusRecord) {
    if (entry.payment_method === "Other" && entry.payment_source?.trim()) {
      return entry.payment_source.trim();
    }
    return entry.payment_method || "—";
  }

  const pendingSubmissions = React.useMemo(
    () => rows.filter(isPendingExtraRevenueReview).sort((a, b) => b.created_at.localeCompare(a.created_at)),
    [rows]
  );

  const monthOptions = React.useMemo(() => {
    const s = new Set<string>();
    rows.forEach((r) => {
      if (r.month && /^\d{4}-\d{2}$/.test(r.month)) s.add(r.month);
    });
    return [...s].sort((a, b) => b.localeCompare(a));
  }, [rows]);

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows
      .filter((r) => {
        if (userFilter !== "all" && r.user_id !== userFilter) return false;
        if (modelFilter !== "all" && r.model_id !== modelFilter) return false;
        if (methodFilter !== "all" && r.payment_method !== methodFilter) return false;
        if (roleFilter !== "all" && r.user_role !== roleFilter) return false;
        if (typeFilter !== "all" && r.type !== typeFilter) return false;
        if (sourceFilter === "spin_wheel" && !isSpinWheelFineBonus(r)) return false;
        if (sourceFilter === "chatter_submission" && !isChatterExtraRevenueSubmission(r)) return false;
        if (sourceFilter === "manual" && (isSpinWheelFineBonus(r) || isChatterExtraRevenueSubmission(r))) return false;
        if (monthFilter && r.month !== monthFilter) return false;
        if (q && !r.reason.toLowerCase().includes(q) && !r.model_name?.toLowerCase().includes(q)) return false;
        return true;
      })
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  }, [rows, userFilter, modelFilter, methodFilter, roleFilter, typeFilter, sourceFilter, monthFilter, search]);

  const {
    page,
    setPage,
    totalPages,
    paginated: paginatedEntries,
    reset,
  } = usePagination(filtered, 20);

  React.useEffect(() => {
    reset();
  }, [userFilter, modelFilter, methodFilter, roleFilter, typeFilter, sourceFilter, monthFilter, search, reset]);

  const groupedPage = React.useMemo(() => groupByMonth(paginatedEntries), [paginatedEntries]);

  const stats = React.useMemo(() => {
    let bonuses = 0;
    let fines = 0;
    const people = new Set<string>();
    for (const r of filtered) {
      if (r.status === "pending_review") continue;
      people.add(r.user_id);
      if (r.type === "bonus") bonuses += r.amount;
      else fines += r.amount;
    }
    return {
      bonuses,
      fines,
      net: bonuses - fines,
      people: people.size,
    };
  }, [filtered]);

  async function submitReview(action: "approve" | "reject") {
    if (!reviewEntry) return;
    if (action === "reject" && !rejectReason.trim()) {
      toast.error("Reject reason is required");
      return;
    }
    setReviewPending(true);
    try {
      const res = await fetch(`/api/admin/fines-bonuses/${reviewEntry.id}/review`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          ...(action === "reject" ? { reject_reason: rejectReason.trim() } : {}),
        }),
      });
      const data = (await res.json()) as { error?: string; entry?: FineBonusRecord };
      if (!res.ok || !data.entry) {
        toast.error(data.error || "Review failed");
        return;
      }
      setRows((prev) => prev.map((r) => (r.id === data.entry!.id ? data.entry! : r)));
      toast.success(action === "approve" ? "Submission approved" : "Submission rejected");
      closeReview();
    } finally {
      setReviewPending(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-white">Fines &amp; bonuses</h1>
        <p className="mt-1 text-sm text-white/50">All issued entries and chatter extra revenue submissions.</p>
      </div>

      {pendingSubmissions.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-yellow-300/80">
            Pending extra revenue ({pendingSubmissions.length})
          </h2>

          <div className="space-y-3 md:hidden">
            {pendingSubmissions.map((entry) => (
              <div key={entry.id} className="glass-card space-y-3 border-yellow-500/20 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <p className="font-semibold text-white">{entry.user_name}</p>
                    <p className="text-sm text-white/70">{entry.model_name || "—"}</p>
                  </div>
                  <p className="shrink-0 text-lg font-bold tabular-nums text-green-400">€{entry.amount.toFixed(2)}</p>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs text-white/50">
                  <div>
                    <p className="font-semibold uppercase tracking-wider text-white/35">Method</p>
                    <p className="mt-0.5 text-white/75">{paymentMethodLabel(entry)}</p>
                  </div>
                  <div>
                    <p className="font-semibold uppercase tracking-wider text-white/35">Submitted</p>
                    <p className="mt-0.5 text-white/75" title={formatDateTimeEuropean(entry.created_at) || undefined}>
                      {formatRelativeTime(entry.created_at)}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => openReview(entry)}
                  className="w-full rounded-lg border border-pink-500/30 bg-pink-500/15 px-3 py-2.5 text-sm font-medium text-pink-200 hover:bg-pink-500/25"
                >
                  Review
                </button>
              </div>
            ))}
          </div>

          <div className="glass-card hidden overflow-x-auto md:block">
            <table className="w-full min-w-[640px] border-collapse text-left text-sm">
              <thead className="border-b border-white/10">
                <tr className="text-xs uppercase tracking-wider text-white/45">
                  <th className="px-4 py-3 font-semibold">Chatter</th>
                  <th className="px-4 py-3 font-semibold">Model</th>
                  <th className="px-4 py-3 text-right font-semibold">Amount</th>
                  <th className="px-4 py-3 font-semibold">Method</th>
                  <th className="px-4 py-3 font-semibold">Submitted</th>
                  <th className="px-4 py-3 font-semibold" />
                </tr>
              </thead>
              <tbody>
                {pendingSubmissions.map((entry) => (
                  <tr key={entry.id} className="border-b border-white/[0.06] last:border-0 hover:bg-white/[0.04]">
                    <td className="px-4 py-3 font-medium text-white">{entry.user_name}</td>
                    <td className="px-4 py-3 text-white/80">{entry.model_name || "—"}</td>
                    <td className="px-4 py-3 text-right font-bold tabular-nums text-green-400">
                      €{entry.amount.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-white/70">{paymentMethodLabel(entry)}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-white/50" title={formatDateTimeEuropean(entry.created_at) || undefined}>
                      {formatRelativeTime(entry.created_at)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => openReview(entry)}
                        className="rounded-lg border border-pink-500/30 bg-pink-500/15 px-3 py-1.5 text-xs font-medium text-pink-200 hover:bg-pink-500/25"
                      >
                        Review
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "Total bonuses issued", v: `€${stats.bonuses.toFixed(2)}`, cls: "text-green-400" },
          { label: "Total fines issued", v: `€${stats.fines.toFixed(2)}`, cls: "text-red-400" },
          { label: "Net (filtered)", v: `€${stats.net.toFixed(2)}`, cls: stats.net >= 0 ? "text-green-400" : "text-red-400" },
          { label: "People affected", v: String(stats.people), cls: "text-white" },
        ].map((s) => (
          <div key={s.label} className="glass-card p-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-white/40">{s.label}</p>
            <p className={`mt-1 text-xl font-bold ${s.cls}`}>{s.v}</p>
          </div>
        ))}
      </div>

      <div className="glass-card flex flex-wrap gap-2 p-3">
        <select
          value={userFilter}
          onChange={(e) => setUserFilter(e.target.value)}
          className="min-h-10 min-w-[140px] rounded-xl border border-white/10 bg-white/[0.04] px-3 text-sm text-white"
        >
          <option value="all">All chatters</option>
          {userOptions.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>
        <select
          value={modelFilter}
          onChange={(e) => setModelFilter(e.target.value)}
          className="min-h-10 min-w-[140px] rounded-xl border border-white/10 bg-white/[0.04] px-3 text-sm text-white"
        >
          <option value="all">All models</option>
          {modelOptions.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
        <select
          value={methodFilter}
          onChange={(e) => setMethodFilter(e.target.value as MethodFilter)}
          className="min-h-10 rounded-xl border border-white/10 bg-white/[0.04] px-3 text-sm text-white"
        >
          <option value="all">All methods</option>
          <option value="PayPal">PayPal</option>
          <option value="Revolut">Revolut</option>
          <option value="Other">Other</option>
        </select>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value as typeof roleFilter)}
          className="min-h-10 rounded-xl border border-white/10 bg-white/[0.04] px-3 text-sm text-white"
        >
          <option value="all">All roles</option>
          <option value="chatter">Chatter</option>
          <option value="va">VA</option>
        </select>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as typeof typeFilter)}
          className="min-h-10 rounded-xl border border-white/10 bg-white/[0.04] px-3 text-sm text-white"
        >
          <option value="all">All types</option>
          <option value="bonus">Bonus</option>
          <option value="fine">Fine</option>
        </select>
        <select
          value={sourceFilter}
          onChange={(e) => setSourceFilter(e.target.value as SourceFilter)}
          className="min-h-10 rounded-xl border border-white/10 bg-white/[0.04] px-3 text-sm text-white"
        >
          <option value="all">All sources</option>
          <option value="manual">Manual</option>
          <option value="spin_wheel">Spin Wheel</option>
          <option value="chatter_submission">Chatter submissions</option>
        </select>
        <select
          value={monthFilter}
          onChange={(e) => setMonthFilter(e.target.value)}
          className="min-h-10 min-w-[140px] rounded-xl border border-white/10 bg-white/[0.04] px-3 text-sm text-white"
        >
          <option value="">All months</option>
          {monthOptions.map((m) => (
            <option key={m} value={m}>
              {formatMonthYyyyMm(m)}
            </option>
          ))}
        </select>
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
          <FormInput
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search reason…"
            className="!h-10 !pl-9"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="glass-card border-dashed py-12 text-center text-sm text-white/40">No entries match filters.</p>
      ) : (
        <>
          <div className="glass-card overflow-x-auto">
            <table className="w-full min-w-[920px] border-collapse text-left text-sm">
              <thead className="sticky top-0 z-10 border-b border-white/10 bg-zinc-950/95 backdrop-blur-md">
                <tr className="text-xs uppercase tracking-wider text-white/45">
                  <th className="px-4 py-3.5 font-semibold">User</th>
                  <th className="px-4 py-3.5 font-semibold">Role</th>
                  <th className="px-4 py-3.5 font-semibold">Type</th>
                  <th className="px-4 py-3.5 text-right font-semibold">Amount</th>
                  <th className="px-4 py-3.5 font-semibold">Reason</th>
                  <th className="px-4 py-3.5 font-semibold">Source</th>
                  <th className="px-4 py-3.5 font-semibold">Status</th>
                  <th className="px-4 py-3.5 font-semibold">Date</th>
                  {isAdmin ? <th className="px-4 py-3.5 font-semibold">Actions</th> : null}
                </tr>
              </thead>
              <tbody>
                {groupedPage.map(({ month, entries }) => (
                  <React.Fragment key={month}>
                    <tr className="sticky top-[41px] z-[5] bg-zinc-900/95 backdrop-blur-sm">
                      <td colSpan={isAdmin ? 9 : 8} className="border-b border-pink-500/20 px-4 py-2">
                        <span className="text-xs font-semibold uppercase tracking-widest text-pink-300/80">
                          {month === "unknown" ? "Unknown month" : formatMonthYyyyMm(month)}
                        </span>
                      </td>
                    </tr>
                    {entries.map((e, idx) => (
                      <tr
                        key={e.id}
                        className={`border-b border-white/[0.06] transition-colors last:border-0 hover:bg-white/[0.04] ${
                          idx % 2 === 1 ? "bg-white/[0.02]" : ""
                        }`}
                      >
                        <td className="px-4 py-3 font-medium text-white">{e.user_name}</td>
                        <td className="px-4 py-3">
                          <RoleBadge role={e.user_role} />
                        </td>
                        <td className="px-4 py-3">
                          <TypeBadge type={e.type} />
                        </td>
                        <td
                          className={`px-4 py-3 text-right font-bold tabular-nums ${
                            e.type === "bonus" ? "text-green-400" : "text-red-400"
                          }`}
                        >
                          {e.type === "bonus" ? "+" : "-"}€{e.amount.toFixed(2)}
                        </td>
                        <td className="max-w-[220px] truncate px-4 py-3 text-white/80" title={e.reason}>
                          {e.reason}
                        </td>
                        <td className="px-4 py-3">{entrySourceBadge(e)}</td>
                        <td className="px-4 py-3">
                          <StatusBadge status={e.status} />
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span
                            className="text-xs text-white/40"
                            title={formatDateTimeEuropean(e.created_at) || undefined}
                          >
                            {formatRelativeTime(e.created_at)}
                          </span>
                        </td>
                        {isAdmin ? (
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => openEdit(e)}
                                className="rounded-lg p-1.5 text-white/40 transition-colors hover:bg-white/10 hover:text-white"
                                aria-label="Edit entry"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeleteEntry(e)}
                                className="rounded-lg p-1.5 text-white/40 transition-colors hover:bg-red-500/10 hover:text-red-300"
                                aria-label="Delete entry"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </td>
                        ) : null}
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>

          <PaginationControls page={page} totalPages={totalPages} onPage={setPage} totalItems={filtered.length} />
        </>
      )}

      {reviewEntry ? (
        <GlassModal onClose={closeReview} title="Review extra revenue" className="mx-4 w-[calc(100%-2rem)] max-w-lg md:mx-auto">
          <div className="space-y-4 px-4 py-5 md:px-5">
            <dl className="grid gap-3 text-sm">
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wider text-white/40">Model</dt>
                <dd className="mt-0.5 font-medium text-white">{reviewEntry.model_name || "—"}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wider text-white/40">Amount (EUR)</dt>
                <dd className="mt-0.5 text-lg font-bold tabular-nums text-green-400">€{reviewEntry.amount.toFixed(2)}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wider text-white/40">Payment method</dt>
                <dd className="mt-0.5 text-white/80">{paymentMethodLabel(reviewEntry)}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wider text-white/40">Screenshot</dt>
                <dd className="mt-1">
                  {reviewEntry.screenshot_url ? (
                    <button
                      type="button"
                      onClick={() => setLightboxUrl(reviewEntry.screenshot_url!)}
                      className="block w-full overflow-hidden rounded-xl border border-white/10 bg-white/5 transition-colors hover:border-pink-500/30 hover:bg-white/10"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={reviewEntry.screenshot_url}
                        alt="Payment screenshot"
                        className="max-h-64 w-full object-contain"
                      />
                    </button>
                  ) : (
                    <p className="text-white/50">No screenshot provided</p>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wider text-white/40">Chatter</dt>
                <dd className="mt-0.5 font-medium text-white">{reviewEntry.user_name}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wider text-white/40">Submitted</dt>
                <dd className="mt-0.5 text-white/80">{formatDateTimeEuropean(reviewEntry.created_at) || "—"}</dd>
              </div>
              {reviewEntry.notes ? (
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wider text-white/40">Notes</dt>
                  <dd className="mt-0.5 whitespace-pre-wrap text-white/70">{reviewEntry.notes}</dd>
                </div>
              ) : null}
            </dl>

            {rejectStep ? (
              <div className="space-y-3 border-t border-white/10 pt-4">
                <label className="block w-full text-xs font-semibold uppercase tracking-wider text-white/40">
                  Reject reason
                  <FormTextarea
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    rows={3}
                    className="mt-1 w-full"
                    placeholder="Explain why this submission is rejected"
                    autoFocus
                  />
                </label>
                <div className="flex flex-col gap-2 md:flex-row">
                  <button
                    type="button"
                    disabled={reviewPending}
                    onClick={() => setRejectStep(false)}
                    className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-medium text-white/80 transition-colors hover:bg-white/10 disabled:opacity-50 md:flex-1"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    disabled={reviewPending || !rejectReason.trim()}
                    onClick={() => submitReview("reject")}
                    className="w-full rounded-xl border border-red-500/40 bg-red-500/20 px-4 py-2.5 text-sm font-semibold text-red-200 transition-colors hover:bg-red-500/30 disabled:opacity-50 md:flex-1"
                  >
                    Confirm reject
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-2 border-t border-white/10 pt-4 md:flex-row">
                <button
                  type="button"
                  disabled={reviewPending}
                  onClick={() => submitReview("approve")}
                  className="w-full rounded-xl border border-green-500/40 bg-green-500/20 px-4 py-2.5 text-sm font-semibold text-green-200 transition-colors hover:bg-green-500/30 disabled:opacity-50 md:flex-1"
                >
                  Approve
                </button>
                <button
                  type="button"
                  disabled={reviewPending}
                  onClick={() => setRejectStep(true)}
                  className="w-full rounded-xl border border-red-500/40 bg-red-500/20 px-4 py-2.5 text-sm font-semibold text-red-200 transition-colors hover:bg-red-500/30 disabled:opacity-50 md:flex-1"
                >
                  Reject
                </button>
              </div>
            )}
          </div>
        </GlassModal>
      ) : null}

      {editEntry ? (
        <GlassModal onClose={closeEdit} title="Edit fine / bonus" className="mx-4 w-[calc(100%-2rem)] max-w-lg md:mx-auto">
          <form onSubmit={submitEdit} className="space-y-4 px-4 py-5 md:px-5">
            {isSpinWheelFineBonus(editEntry) ? (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
                This entry was auto-created from a spin wheel reward.
              </div>
            ) : null}

            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-white/40">User</p>
              <p className="mt-0.5 font-medium text-white">{editEntry.user_name}</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setEditType("bonus")}
                className={`rounded-xl border py-3 font-semibold transition-all ${
                  editType === "bonus"
                    ? "border-green-500/30 bg-green-500/20 text-green-400"
                    : "border-white/10 bg-white/5 text-white/40"
                }`}
              >
                Bonus
              </button>
              <button
                type="button"
                onClick={() => setEditType("fine")}
                className={`rounded-xl border py-3 font-semibold transition-all ${
                  editType === "fine"
                    ? "border-red-500/30 bg-red-500/20 text-red-400"
                    : "border-white/10 bg-white/5 text-white/40"
                }`}
              >
                Fine
              </button>
            </div>

            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-white/40">Amount</label>
              <div className="relative mt-1">
                <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-white/40">€</span>
                <FormInput
                  type="number"
                  min={0}
                  step="0.01"
                  required
                  value={editAmount}
                  onChange={(e) => setEditAmount(e.target.value)}
                  className="!pl-8"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-white/40">Reason</label>
              <FormInput
                value={editReason}
                onChange={(e) => setEditReason(e.target.value)}
                required
                className="mt-1"
              />
            </div>

            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-white/40">Month</label>
              <input
                type="month"
                value={editMonth}
                onChange={(e) => setEditMonth(e.target.value)}
                required
                className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white focus:border-pink-500/50 focus:outline-none"
              />
            </div>

            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-white/40">Notes (optional)</label>
              <FormTextarea
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                rows={3}
                className="mt-1 w-full"
              />
            </div>

            <div className="flex flex-col gap-2 border-t border-white/10 pt-4 md:flex-row">
              <button
                type="button"
                disabled={editPending}
                onClick={closeEdit}
                className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-medium text-white/80 transition-colors hover:bg-white/10 disabled:opacity-50 md:flex-1"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={editPending}
                className="w-full rounded-xl border border-pink-500/40 bg-pink-500/20 px-4 py-2.5 text-sm font-semibold text-pink-100 transition-colors hover:bg-pink-500/30 disabled:opacity-50 md:flex-1"
              >
                {editPending ? "Saving…" : "Save changes"}
              </button>
            </div>
          </form>
        </GlassModal>
      ) : null}

      <ConfirmDialog
        open={deleteEntry != null}
        onClose={() => !deletePending && setDeleteEntry(null)}
        onConfirm={confirmDelete}
        title="Delete entry?"
        description={
          deleteEntry
            ? `Permanently delete this ${deleteEntry.type} of €${deleteEntry.amount.toFixed(2)} for ${deleteEntry.user_name}? This cannot be undone.`
            : ""
        }
        confirmLabel="Delete"
        confirmVariant="danger"
        loading={deletePending}
      />

      {lightboxUrl ? (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Screenshot preview"
          onClick={() => setLightboxUrl(null)}
        >
          <button
            type="button"
            onClick={() => setLightboxUrl(null)}
            className="absolute right-4 top-4 z-10 rounded-full border border-white/20 bg-black/60 p-2 text-white/80 transition-colors hover:bg-white/10 hover:text-white"
            aria-label="Close screenshot"
          >
            <X className="h-5 w-5" />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightboxUrl}
            alt="Screenshot full size"
            className="max-h-[90vh] max-w-full object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      ) : null}
    </div>
  );
}
