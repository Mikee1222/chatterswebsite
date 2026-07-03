"use client";

import * as React from "react";
import Link from "next/link";
import {
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  ExternalLink,
  Loader2,
  MessageSquarePlus,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { ConfirmDeleteModal } from "@/components/confirm-delete-modal";
import { SpotCheckForm, type SpotCheckFormValues } from "@/components/spot-check-form";
import { useToast } from "@/contexts/toast-context";
import { formatDateTimeAthens } from "@/lib/format";
import { ROUTES } from "@/lib/routes";
import {
  SPOT_CHECK_STATUSES,
  SPOT_CHECK_STATUS_STYLES,
  SPOT_CHECK_TYPES,
  SPOT_CHECK_TYPE_STYLES,
  type SpotCheckStatus,
  type SpotCheckType,
} from "@/lib/marketing-reviews-helpers";
import {
  VA_BTN_PRIMARY,
  VA_CARD,
  VA_CHAMPAGNE_DIVIDER,
  VA_FILTER_INPUT,
  VA_STATUS_BADGE,
} from "@/lib/va-tasks-tokens";
import { cn } from "@/lib/utils";
import type { MarketingSpotCheck } from "@/services/marketing-reviews";
import type { ModelRecord, UserRecord } from "@/types";

type DateRange = "all" | "7d" | "30d" | "custom";

const ADMIN_SELECT = cn(VA_FILTER_INPUT, "min-w-[9rem]");

function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-[#D4AF8C]/30 bg-[#D4AF8C]/8 px-2.5 py-1 text-xs text-[#D4AF8C]">
      {label}
      <button type="button" onClick={onRemove} className="rounded-full p-0.5 hover:bg-[#D4AF8C]/15" aria-label={`Remove ${label}`}>
        <X className="h-3 w-3" aria-hidden />
      </button>
    </span>
  );
}

function isoDateDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

function localToast(id: string, title: string, body: string, priority: "normal" | "high") {
  return {
    id,
    notification_id: id,
    user_id: "local",
    category: "system" as const,
    event_type: "system_alert" as const,
    priority,
    title,
    body,
    entity_type: "system",
    entity_id: "",
    read_at: null,
    created_at: new Date().toISOString(),
  };
}

type Props = {
  initialSpotChecks: MarketingSpotCheck[];
  vaUsers: UserRecord[];
  models: ModelRecord[];
};

export function AdminSpotChecksClient({ initialSpotChecks, vaUsers, models }: Props) {
  const { addToast } = useToast();
  const [spotChecks, setSpotChecks] = React.useState(initialSpotChecks);
  const [loading, setLoading] = React.useState(false);
  const [modalOpen, setModalOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [expandedId, setExpandedId] = React.useState<string | null>(null);
  const [deleteId, setDeleteId] = React.useState<string | null>(null);
  const [deleting, setDeleting] = React.useState(false);
  const [noteDrafts, setNoteDrafts] = React.useState<Record<string, string>>({});
  const [pendingIds, setPendingIds] = React.useState<Set<string>>(new Set());

  const [filterVa, setFilterVa] = React.useState("");
  const [filterCreator, setFilterCreator] = React.useState("");
  const [filterType, setFilterType] = React.useState<SpotCheckType | "">("");
  const [filterStatus, setFilterStatus] = React.useState<SpotCheckStatus | "">("");
  const [filterDateRange, setFilterDateRange] = React.useState<DateRange>("all");
  const [filterDateFrom, setFilterDateFrom] = React.useState("");
  const [filterDateTo, setFilterDateTo] = React.useState("");

  const [editDraft, setEditDraft] = React.useState<Partial<MarketingSpotCheck>>({});

  const marketingVas = React.useMemo(
    () =>
      vaUsers.filter(
        (u) =>
          u.va_type === "marketing" ||
          u.va_type === "both" ||
          !u.va_type,
      ),
    [vaUsers],
  );

  function markPending(id: string, on: boolean) {
    setPendingIds((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function patchLocal(id: string, patch: Partial<MarketingSpotCheck>) {
    setSpotChecks((prev) => prev.map((sc) => (sc.id === id ? { ...sc, ...patch } : sc)));
  }

  async function reload() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterVa) params.set("exec_va_id", filterVa);
      if (filterCreator) params.set("creator_id", filterCreator);
      if (filterType) params.set("type", filterType);
      if (filterStatus) params.set("status", filterStatus);
      if (filterDateRange === "7d") params.set("date_from", isoDateDaysAgo(7));
      if (filterDateRange === "30d") params.set("date_from", isoDateDaysAgo(30));
      if (filterDateRange === "custom") {
        if (filterDateFrom) params.set("date_from", filterDateFrom);
        if (filterDateTo) params.set("date_to", filterDateTo);
      }
      const res = await fetch(`/api/admin/marketing-reviews/spot-checks?${params}`);
      const data = (await res.json()) as { spotChecks?: MarketingSpotCheck[] };
      if (res.ok) setSpotChecks(data.spotChecks ?? []);
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterVa, filterCreator, filterType, filterStatus, filterDateRange, filterDateFrom, filterDateTo]);

  const hasFilters =
    Boolean(filterVa || filterCreator || filterType || filterStatus) || filterDateRange !== "all";

  function clearFilters() {
    setFilterVa("");
    setFilterCreator("");
    setFilterType("");
    setFilterStatus("");
    setFilterDateRange("all");
    setFilterDateFrom("");
    setFilterDateTo("");
  }

  async function handleCreate(values: SpotCheckFormValues) {
    setSaving(true);
    try {
      const va = marketingVas.find((v) => v.id === values.exec_va_id);
      const model = models.find((m) => m.id === values.creator_id);
      const res = await fetch("/api/admin/marketing-reviews/spot-checks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: values.type,
          exec_va_id: values.exec_va_id,
          exec_va_name: va?.full_name ?? "",
          creator_id: values.creator_id,
          creator_name: model?.model_name ?? "",
          what_was_wrong: values.what_was_wrong,
          action_taken: values.action_taken,
          status: values.status,
        }),
      });
      const data = (await res.json()) as { spotCheck?: MarketingSpotCheck; error?: string };
      if (!res.ok || !data.spotCheck) {
        addToast(localToast(`sc-err-${Date.now()}`, "Failed", data.error ?? "Could not create spot check", "high"));
        return false;
      }
      if (values.files.length > 0) {
        const fd = new FormData();
        for (const f of values.files) fd.append("attachments", f);
        await fetch(`/api/admin/marketing-reviews/spot-checks/${data.spotCheck.id}/attachments`, {
          method: "POST",
          body: fd,
        });
      }
      setModalOpen(false);
      await reload();
      addToast(localToast(`sc-ok-${Date.now()}`, "Spot check logged", "Finding saved successfully.", "normal"));
    } finally {
      setSaving(false);
    }
  }

  async function patchSpotCheck(
    id: string,
    body: Record<string, unknown>,
    optimistic?: Partial<MarketingSpotCheck>,
  ) {
    const previous = spotChecks.find((sc) => sc.id === id);
    if (optimistic) patchLocal(id, optimistic);
    markPending(id, true);
    try {
      const res = await fetch(`/api/admin/marketing-reviews/spot-checks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        if (previous) patchLocal(id, previous);
        addToast(localToast(`sc-upd-err-${Date.now()}`, "Failed", "Could not update spot check", "high"));
        return false;
      }
      const data = (await res.json()) as { spotCheck?: MarketingSpotCheck };
      if (data.spotCheck) patchLocal(id, data.spotCheck);
      return true;
    } catch {
      if (previous) patchLocal(id, previous);
      addToast(localToast(`sc-upd-err-${Date.now()}`, "Failed", "Could not update spot check", "high"));
      return false;
    } finally {
      markPending(id, false);
    }
  }

  async function handleQuickStatus(id: string, status: SpotCheckStatus) {
    const ok = await patchSpotCheck(id, { status }, { status });
    if (ok) {
      addToast(localToast(`sc-st-${Date.now()}`, "Status updated", `Marked as ${status}.`, "normal"));
    }
  }

  async function handleReassign(id: string, vaId: string) {
    if (!vaId) return;
    const va = marketingVas.find((v) => v.id === vaId);
    const ok = await patchSpotCheck(
      id,
      { exec_va_id: vaId, exec_va_name: va?.full_name ?? "" },
      { exec_va_id: vaId, exec_va_name: va?.full_name ?? "" },
    );
    if (ok) {
      addToast(localToast(`sc-re-${Date.now()}`, "Reassigned", `Exec/VA updated.`, "normal"));
    }
  }

  async function handleAddNote(id: string) {
    const note = (noteDrafts[id] ?? "").trim();
    if (!note) return;
    const sc = spotChecks.find((s) => s.id === id);
    if (!sc) return;
    const action_taken = sc.action_taken.trim() ? `${sc.action_taken.trim()}\n${note}` : note;
    const ok = await patchSpotCheck(id, { action_taken }, { action_taken });
    if (ok) {
      setNoteDrafts((d) => ({ ...d, [id]: "" }));
      addToast(localToast(`sc-note-${Date.now()}`, "Note added", "Action taken updated.", "normal"));
    }
  }

  async function handleSaveEdit(id: string) {
    setSaving(true);
    try {
      const va = marketingVas.find((v) => v.id === editDraft.exec_va_id);
      const model = models.find((m) => m.id === editDraft.creator_id);
      const res = await fetch(`/api/admin/marketing-reviews/spot-checks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...editDraft,
          exec_va_name: va?.full_name ?? editDraft.exec_va_name,
          creator_name: model?.model_name ?? editDraft.creator_name,
        }),
      });
      if (!res.ok) {
        addToast(localToast(`sc-upd-err-${Date.now()}`, "Failed", "Could not update spot check", "high"));
        return;
      }
      setExpandedId(null);
      setEditDraft({});
      await reload();
      addToast(localToast(`sc-upd-ok-${Date.now()}`, "Updated", "Spot check saved.", "normal"));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteId) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/marketing-reviews/spot-checks/${deleteId}`, { method: "DELETE" });
      if (!res.ok) {
        addToast(localToast(`sc-del-err-${Date.now()}`, "Failed", "Could not delete spot check", "high"));
        return;
      }
      setDeleteId(null);
      await reload();
      addToast(localToast(`sc-del-ok-${Date.now()}`, "Deleted", "Spot check removed.", "normal"));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#FF1493]/70">Manager review</p>
          <h1 className="mt-1 text-2xl font-bold text-white">Spot checks</h1>
          <p className="mt-1 text-sm text-[#B8B4B8]/60">Manage and resolve marketing QA findings</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={ROUTES.admin.dailyReview}
            className="rounded-xl border border-[#D4AF8C]/35 px-4 py-2.5 text-sm font-medium text-[#D4AF8C] hover:bg-[#D4AF8C]/6"
          >
            Daily review →
          </Link>
          <button type="button" onClick={() => setModalOpen(true)} className={cn(VA_BTN_PRIMARY, "inline-flex items-center gap-2")}>
            <Plus className="h-4 w-4" aria-hidden />
            Log finding
          </button>
        </div>
      </div>

      <div className={cn(VA_CARD, "space-y-4 p-4 md:p-5")}>
        <div className="flex flex-wrap gap-2">
          <select value={filterVa} onChange={(e) => setFilterVa(e.target.value)} className={ADMIN_SELECT} aria-label="Filter by VA">
            <option value="">All VAs</option>
            {marketingVas.map((v) => (
              <option key={v.id} value={v.id}>
                {v.full_name || v.email}
              </option>
            ))}
          </select>
          <select value={filterCreator} onChange={(e) => setFilterCreator(e.target.value)} className={ADMIN_SELECT} aria-label="Filter by creator">
            <option value="">All creators</option>
            {models.map((m) => (
              <option key={m.id} value={m.id}>
                {m.model_name}
              </option>
            ))}
          </select>
          <select value={filterType} onChange={(e) => setFilterType(e.target.value as SpotCheckType | "")} className={ADMIN_SELECT} aria-label="Filter by type">
            <option value="">All types</option>
            {SPOT_CHECK_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as SpotCheckStatus | "")} className={ADMIN_SELECT} aria-label="Filter by status">
            <option value="">All statuses</option>
            {SPOT_CHECK_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <select value={filterDateRange} onChange={(e) => setFilterDateRange(e.target.value as DateRange)} className={ADMIN_SELECT} aria-label="Date range">
            <option value="all">All dates</option>
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="custom">Custom range</option>
          </select>
          {filterDateRange === "custom" ? (
            <>
              <input type="date" value={filterDateFrom} onChange={(e) => setFilterDateFrom(e.target.value)} className={ADMIN_SELECT} aria-label="From date" />
              <input type="date" value={filterDateTo} onChange={(e) => setFilterDateTo(e.target.value)} className={ADMIN_SELECT} aria-label="To date" />
            </>
          ) : null}
        </div>
        {hasFilters ? (
          <div className="flex flex-wrap items-center gap-2">
            {filterVa ? <FilterChip label={`VA: ${marketingVas.find((v) => v.id === filterVa)?.full_name ?? filterVa}`} onRemove={() => setFilterVa("")} /> : null}
            {filterCreator ? <FilterChip label={`Creator: ${models.find((m) => m.id === filterCreator)?.model_name ?? filterCreator}`} onRemove={() => setFilterCreator("")} /> : null}
            {filterType ? <FilterChip label={`Type: ${filterType}`} onRemove={() => setFilterType("")} /> : null}
            {filterStatus ? <FilterChip label={`Status: ${filterStatus}`} onRemove={() => setFilterStatus("")} /> : null}
            {filterDateRange !== "all" ? (
              <FilterChip
                label={`Date: ${filterDateRange === "custom" ? `${filterDateFrom || "…"} – ${filterDateTo || "…"}` : filterDateRange}`}
                onRemove={() => {
                  setFilterDateRange("all");
                  setFilterDateFrom("");
                  setFilterDateTo("");
                }}
              />
            ) : null}
            <button type="button" onClick={clearFilters} className="text-xs text-[#D4AF8C]/70 hover:text-[#D4AF8C]">
              Clear all
            </button>
          </div>
        ) : null}
      </div>

      {loading ? (
        <div className={cn(VA_CARD, "flex items-center justify-center gap-2 py-16 text-[#B8B4B8]/50")}>
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
          Loading…
        </div>
      ) : spotChecks.length === 0 ? (
        <div className={cn(VA_CARD, "py-16 text-center")}>
          <ClipboardList className="mx-auto mb-3 h-10 w-10 text-[#D4AF8C]/35" aria-hidden />
          <p className="font-medium text-[#B8B4B8]/80">{hasFilters ? "No spot checks match your filters" : "All clear — no spot checks yet"}</p>
          <p className="mt-1 text-sm text-[#B8B4B8]/45">
            {hasFilters ? "Try adjusting filters or clear them to see everything." : "Log a finding when you spot a QA issue."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {spotChecks.map((sc) => {
            const expanded = expandedId === sc.id;
            const statusStyle = SPOT_CHECK_STATUS_STYLES[sc.status];
            const typeStyle = SPOT_CHECK_TYPE_STYLES[sc.type];
            const isPending = pendingIds.has(sc.id);
            return (
              <article key={sc.id} className={cn(VA_CARD, "overflow-hidden", isPending && "opacity-80")}>
                <div className="p-4 md:p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={cn(
                            VA_STATUS_BADGE,
                            statusStyle.className,
                            statusStyle.glowClassName,
                          )}
                        >
                          {statusStyle.label}
                        </span>
                        <span className={cn("rounded-md border px-2 py-0.5 text-xs", typeStyle.className)}>
                          {sc.type}
                        </span>
                        {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin text-[#D4AF8C]/50" aria-hidden /> : null}
                      </div>
                      <p className="font-semibold text-white">{sc.subject || sc.what_was_wrong.slice(0, 100)}</p>
                      <p className="text-sm text-[#B8B4B8]/55">
                        {sc.exec_va_name || "—"} · {sc.creator_name || "—"}
                      </p>
                      <p className="text-xs text-[#D4AF8C]/60">
                        Submitted by <span className="text-[#D4AF8C]/90">{sc.manager_name || "Unknown"}</span>
                        {" · "}
                        {formatDateTimeAthens(sc.timestamp)}
                      </p>
                    </div>
                    <button
                      type="button"
                      className="shrink-0 rounded-lg p-1.5 text-[#D4AF8C]/50 hover:bg-white/5"
                      aria-label={expanded ? "Collapse" : "Expand to edit"}
                      onClick={() => {
                        if (expanded) {
                          setExpandedId(null);
                          setEditDraft({});
                        } else {
                          setExpandedId(sc.id);
                          setEditDraft({ ...sc });
                        }
                      }}
                    >
                      <ChevronDown className={cn("h-5 w-5 transition", expanded && "rotate-180")} aria-hidden />
                    </button>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-white/6 pt-4">
                    {sc.status !== "Fixed" ? (
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => void handleQuickStatus(sc.id, "Fixed")}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/35 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-300 hover:bg-emerald-500/15 disabled:opacity-50"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                        Mark Fixed
                      </button>
                    ) : null}
                    {sc.status !== "Escalated" ? (
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => void handleQuickStatus(sc.id, "Escalated")}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/35 bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-300 hover:bg-red-500/15 disabled:opacity-50"
                      >
                        Escalate
                      </button>
                    ) : null}
                    <select
                      value={sc.exec_va_id}
                      disabled={isPending}
                      onChange={(e) => void handleReassign(sc.id, e.target.value)}
                      className={cn(VA_FILTER_INPUT, "h-8 min-w-0 max-w-[10rem] py-0 text-xs")}
                      aria-label="Reassign VA"
                    >
                      <option value="">Reassign VA…</option>
                      {marketingVas.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.full_name || v.email}
                        </option>
                      ))}
                    </select>
                    <div className="flex min-w-0 flex-1 basis-full items-center gap-2 sm:basis-auto">
                      <input
                        type="text"
                        value={noteDrafts[sc.id] ?? ""}
                        onChange={(e) => setNoteDrafts((d) => ({ ...d, [sc.id]: e.target.value }))}
                        placeholder="Add note to action taken…"
                        className={cn(VA_FILTER_INPUT, "h-8 min-w-0 flex-1 py-0 text-xs")}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            void handleAddNote(sc.id);
                          }
                        }}
                      />
                      <button
                        type="button"
                        disabled={isPending || !(noteDrafts[sc.id] ?? "").trim()}
                        onClick={() => void handleAddNote(sc.id)}
                        className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-[#D4AF8C]/30 px-2.5 py-1.5 text-xs text-[#D4AF8C] hover:bg-[#D4AF8C]/8 disabled:opacity-40"
                      >
                        <MessageSquarePlus className="h-3.5 w-3.5" aria-hidden />
                        Add
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => setDeleteId(sc.id)}
                      className="inline-flex items-center gap-1 rounded-lg border border-red-500/25 px-2.5 py-1.5 text-xs text-red-300/80 hover:bg-red-500/10"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden />
                      Delete
                    </button>
                  </div>
                </div>

                {expanded ? (
                  <div className="border-t border-white/6 px-4 pb-5 pt-4 md:px-5">
                    <div className={VA_CHAMPAGNE_DIVIDER} />
                    <div className="mt-4 grid gap-4 md:grid-cols-2">
                      <label className="block space-y-1.5 text-sm">
                        <span className="text-[#B8B4B8]/60">Type</span>
                        <select
                          value={editDraft.type ?? sc.type}
                          onChange={(e) => setEditDraft((d) => ({ ...d, type: e.target.value as SpotCheckType }))}
                          className={VA_FILTER_INPUT}
                        >
                          {SPOT_CHECK_TYPES.map((t) => (
                            <option key={t} value={t}>
                              {t}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="block space-y-1.5 text-sm">
                        <span className="text-[#B8B4B8]/60">Status</span>
                        <select
                          value={editDraft.status ?? sc.status}
                          onChange={(e) => setEditDraft((d) => ({ ...d, status: e.target.value as SpotCheckStatus }))}
                          className={VA_FILTER_INPUT}
                        >
                          {SPOT_CHECK_STATUSES.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="block space-y-1.5 text-sm">
                        <span className="text-[#B8B4B8]/60">Exec / VA</span>
                        <select
                          value={editDraft.exec_va_id ?? sc.exec_va_id}
                          onChange={(e) => setEditDraft((d) => ({ ...d, exec_va_id: e.target.value }))}
                          className={VA_FILTER_INPUT}
                        >
                          <option value="">—</option>
                          {marketingVas.map((v) => (
                            <option key={v.id} value={v.id}>
                              {v.full_name || v.email}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="block space-y-1.5 text-sm">
                        <span className="text-[#B8B4B8]/60">Creator</span>
                        <select
                          value={editDraft.creator_id ?? sc.creator_id}
                          onChange={(e) => setEditDraft((d) => ({ ...d, creator_id: e.target.value }))}
                          className={VA_FILTER_INPUT}
                        >
                          <option value="">—</option>
                          {models.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.model_name}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                    <label className="mt-4 block space-y-1.5 text-sm">
                      <span className="text-[#B8B4B8]/60">What was wrong</span>
                      <textarea
                        value={editDraft.what_was_wrong ?? sc.what_was_wrong}
                        onChange={(e) => setEditDraft((d) => ({ ...d, what_was_wrong: e.target.value }))}
                        rows={3}
                        className={cn(VA_FILTER_INPUT, "min-h-[80px] w-full resize-y py-2")}
                      />
                    </label>
                    <label className="mt-4 block space-y-1.5 text-sm">
                      <span className="text-[#B8B4B8]/60">Action taken</span>
                      <textarea
                        value={editDraft.action_taken ?? sc.action_taken}
                        onChange={(e) => setEditDraft((d) => ({ ...d, action_taken: e.target.value }))}
                        rows={2}
                        className={cn(VA_FILTER_INPUT, "min-h-[64px] w-full resize-y py-2")}
                      />
                    </label>
                    {sc.attachments.length > 0 ? (
                      <div className="mt-4 flex flex-wrap gap-2">
                        {sc.attachments.map((a, i) => (
                          <a
                            key={i}
                            href={a.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-2 py-1 text-xs text-[#D4AF8C] hover:bg-white/5"
                          >
                            <ExternalLink className="h-3 w-3" aria-hidden />
                            {a.filename ?? `Attachment ${i + 1}`}
                          </a>
                        ))}
                      </div>
                    ) : null}
                    <div className="mt-5 flex flex-wrap justify-end gap-2">
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => void handleSaveEdit(sc.id)}
                        className={VA_BTN_PRIMARY}
                      >
                        {saving ? "Saving…" : "Save changes"}
                      </button>
                    </div>
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      )}

      {modalOpen ? (
        <div className="fixed inset-0 z-[200] flex items-end justify-center p-4 md:items-center">
          <button type="button" className="absolute inset-0 bg-black/75 backdrop-blur-sm" aria-label="Close" onClick={() => !saving && setModalOpen(false)} />
          <div className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-white/10 bg-zinc-950 p-5 shadow-2xl">
            <h2 className="text-lg font-semibold text-white">Log finding</h2>
            <div className="mt-4">
              <SpotCheckForm
                vaUsers={vaUsers}
                models={models}
                saving={saving}
                submitLabel="Save finding"
                onCancel={() => setModalOpen(false)}
                onSubmit={handleCreate}
              />
            </div>
          </div>
        </div>
      ) : null}

      <ConfirmDeleteModal
        open={deleteId != null}
        title="Delete spot check?"
        description="This finding will be permanently removed."
        onClose={() => !deleting && setDeleteId(null)}
        onConfirm={() => void handleDelete()}
        confirming={deleting}
      />
    </div>
  );
}
