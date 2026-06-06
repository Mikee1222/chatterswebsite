"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useSWRConfig } from "swr";
import {
  Calendar,
  CalendarClock,
  CheckCircle2,
  Clock,
  DollarSign,
  ListChecks,
  Pencil,
  Search,
  Upload,
  User,
  X,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { useToast } from "@/contexts/toast-context";
import { CustomRequestDetailModal } from "@/components/custom-request-detail-modal";
import { MobileCard } from "@/components/mobile-card";
import { FormInput } from "@/components/ui/form-input";
import { Label, Textarea } from "@/components/ui/form";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { GlassModal } from "@/components/ui/glass-modal";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { formatDateEuropean } from "@/lib/format";
import { dashboardSwrKeys } from "@/lib/hooks/use-dashboard-data";
import { usePagination } from "@/lib/use-pagination";
import { cn } from "@/lib/utils";
import type { AppNotification, CustomRequest, CustomRequestModelStatus } from "@/types";

type StatusTab = "all" | CustomRequestModelStatus | "pending_review";

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

function statusKey(s: string): string {
  return (s || "").trim().toLowerCase();
}

function displayTitle(req: CustomRequest): string {
  return (req.request_title ?? req.custom_type ?? "").trim() || "—";
}

function displayDescription(req: CustomRequest): string {
  return (req.request_details ?? req.description ?? "").trim();
}

function displayDeadline(req: CustomRequest): string {
  const raw = (req.deadline_requested ?? "").trim();
  if (raw) return formatDateEuropean(raw);
  return "—";
}

function displayScheduled(req: CustomRequest): string {
  const raw = (req.model_scheduled_date ?? "").trim();
  if (!raw) return "—";
  return formatDateEuropean(raw);
}

function modelStatusLabel(s: CustomRequestModelStatus): string {
  const map: Record<CustomRequestModelStatus, string> = {
    waiting_schedule: "Waiting schedule",
    scheduled: "Scheduled",
    in_progress: "In progress",
    completed: "Completed",
    uploaded: "Uploaded",
    declined: "Declined",
  };
  return map[s] ?? s;
}

function StatusBadge({ status, adminPending }: { status: CustomRequestModelStatus; adminPending?: boolean }) {
  if (adminPending) {
    return (
      <span className="inline-flex rounded-full border border-amber-500/30 bg-amber-500/15 px-2.5 py-0.5 text-[11px] font-medium text-amber-300">
        Pending review
      </span>
    );
  }
  const k = statusKey(status);
  const variant =
    k === "waiting_schedule"
      ? "border-amber-500/30 bg-amber-500/15 text-amber-300"
      : k === "scheduled"
        ? "border-sky-500/30 bg-sky-500/15 text-sky-300"
        : k === "in_progress"
          ? "border-violet-500/30 bg-violet-500/15 text-violet-300"
          : k === "uploaded"
            ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-300"
            : k === "completed"
              ? "border-green-500/30 bg-green-500/15 text-green-300"
              : k === "declined"
                ? "border-rose-500/35 bg-rose-500/15 text-rose-300"
                : "border-white/15 bg-white/[0.06] text-white/70";

  return (
    <span className={cn("inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-medium capitalize", variant)}>
      {modelStatusLabel(status)}
    </span>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  accentClass,
}: {
  label: string;
  value: number;
  icon: LucideIcon;
  accentClass: string;
}) {
  return (
    <MobileCard
      padding="md"
      className={cn("min-w-[140px] shrink-0 snap-start border-white/10 bg-white/[0.04]", accentClass)}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wide text-white/45">{label}</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-white">{value}</p>
        </div>
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.06] text-white/55">
          <Icon className="h-4 w-4" aria-hidden />
        </div>
      </div>
    </MobileCard>
  );
}

const STATUS_TABS: StatusTab[] = [
  "pending_review",
  "waiting_schedule",
  "scheduled",
  "in_progress",
  "uploaded",
  "completed",
  "declined",
];

type Props = {
  initialRows: CustomRequest[];
  pendingCount: number;
  assignedModelIds: string[];
  modelLabelById: Record<string, string>;
};

export function VaCustomRequestsClient({ initialRows, modelLabelById, pendingCount }: Props) {
  const router = useRouter();
  const { addToast } = useToast();
  const { mutate } = useSWRConfig();
  const [rows, setRows] = React.useState(initialRows);
  const [filter, setFilter] = React.useState<StatusTab>("pending_review");
  const [search, setSearch] = React.useState("");
  const [modelId, setModelId] = React.useState("all");
  const [detail, setDetail] = React.useState<CustomRequest | null>(null);
  const [declineFor, setDeclineFor] = React.useState<CustomRequest | null>(null);
  const declineReasonRef = React.useRef("");
  const [declineBusy, setDeclineBusy] = React.useState(false);
  const [editFor, setEditFor] = React.useState<CustomRequest | null>(null);
  const [editDesc, setEditDesc] = React.useState("");
  const [editPrice, setEditPrice] = React.useState("");
  const [editDeadline, setEditDeadline] = React.useState("");
  const [editBusy, setEditBusy] = React.useState(false);
  const [busyId, setBusyId] = React.useState<string | null>(null);

  React.useEffect(() => setRows(initialRows), [initialRows]);

  React.useEffect(() => {
    if (!editFor) return;
    setEditDesc(editFor.request_details ?? "");
    setEditPrice(editFor.price ?? "");
    setEditDeadline(editFor.deadline_requested?.trim().slice(0, 16) ?? "");
  }, [editFor]);

  const patchRow = React.useCallback((id: string, patch: Partial<CustomRequest>) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    setDetail((prev) => (prev?.id === id ? { ...prev, ...patch } : prev));
  }, []);

  const modelOptions = React.useMemo(() => {
    const byId = new Map<string, string>();
    for (const row of rows) {
      if (!row.assigned_model_id) continue;
      const label = row.assigned_model_name || modelLabelById[row.assigned_model_id] || row.assigned_model_id;
      byId.set(row.assigned_model_id, label);
    }
    return [...byId.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [rows, modelLabelById]);

  const counts = React.useMemo(() => {
    const c = {
      total: rows.length,
      pending_review: 0,
      waiting_schedule: 0,
      scheduled: 0,
      in_progress: 0,
      uploaded: 0,
      completed: 0,
      declined: 0,
    };
    for (const r of rows) {
      if (r.admin_status === "pending") c.pending_review += 1;
      else if (r.admin_status === "rejected") c.declined += 1;
      else {
        const k = statusKey(r.model_status);
        if (k in c) (c as Record<string, number>)[k] += 1;
      }
    }
    return c;
  }, [rows]);

  const filtered = React.useMemo(() => {
    let list = [...rows];
    if (filter === "pending_review") {
      list = list.filter((r) => r.admin_status === "pending");
    } else if (filter === "declined") {
      list = list.filter((r) => r.admin_status === "rejected");
    } else if (filter !== "all") {
      list = list.filter((r) => r.admin_status === "accepted" && statusKey(r.model_status) === filter);
    }
    if (modelId !== "all") list = list.filter((r) => r.assigned_model_id === modelId);
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((r) => {
        const blob = `${r.fan_username ?? ""} ${r.request_title ?? ""}`.toLowerCase();
        return blob.includes(q);
      });
    }
    const createdMs = (r: CustomRequest) => Date.parse(r.created_at || "") || 0;
    return [...list].sort((a, b) => createdMs(b) - createdMs(a));
  }, [rows, filter, modelId, search]);

  const { page, setPage, totalPages, paginated, reset } = usePagination(filtered, 20);

  React.useEffect(() => {
    reset();
  }, [filter, search, modelId, reset]);

  const clearFilters = () => {
    setSearch("");
    setModelId("all");
    setFilter("pending_review");
  };

  const activeFilterCount = (search.trim() ? 1 : 0) + (modelId !== "all" ? 1 : 0) + (filter !== "pending_review" ? 1 : 0);

  const toast = (kind: "success" | "error", title: string, body: string) => {
    addToast(localToast(`vcr-${kind}-${Date.now()}`, title, body, kind === "error" ? "high" : "normal"));
  };

  const approve = async (id: string) => {
    const res = await fetch("/api/va/custom/approve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ request_id: id }),
      credentials: "include",
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) return { ok: false as const, error: data.error ?? res.statusText };
    await mutate(dashboardSwrKeys.notificationsUnreadCount);
    return { ok: true as const };
  };

  const decline = async (input: { id: string; decline_reason: string }) => {
    const res = await fetch("/api/va/custom/decline", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ request_id: input.id, decline_reason: input.decline_reason }),
      credentials: "include",
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) return { ok: false as const, error: data.error ?? res.statusText };
    await mutate(dashboardSwrKeys.notificationsUnreadCount);
    return { ok: true as const };
  };

  const edit = async (input: { id: string; request_details: string; price: string; deadline_requested: string | null }) => {
    const res = await fetch("/api/va/custom/edit", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        request_id: input.id,
        request_details: input.request_details,
        price: input.price,
        deadline_requested: input.deadline_requested,
      }),
      credentials: "include",
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) return { ok: false as const, error: data.error ?? res.statusText };
    await mutate(dashboardSwrKeys.notificationsUnreadCount);
    return { ok: true as const };
  };

  const onApproveOne = async (id: string) => {
    setBusyId(id);
    try {
      const res = await approve(id);
      if (!res.ok) {
        toast("error", "Could not approve", res.error);
        return;
      }
      patchRow(id, { admin_status: "accepted" });
      toast("success", "Approved", "Request moved to approved.");
      router.refresh();
    } finally {
      setBusyId(null);
    }
  };

  const submitDecline = async () => {
    if (!declineFor) return;
    const reasonText = declineReasonRef.current.trim();
    if (!reasonText) return;
    setDeclineBusy(true);
    try {
      const res = await decline({ id: declineFor.id, decline_reason: reasonText });
      if (!res.ok) {
        toast("error", "Could not decline", res.error);
        return;
      }
      patchRow(declineFor.id, { admin_status: "rejected", decline_reason: reasonText });
      setDeclineFor(null);
      declineReasonRef.current = "";
      toast("success", "Declined", "Request was declined successfully.");
      router.refresh();
    } finally {
      setDeclineBusy(false);
    }
  };

  const submitEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editFor) return;
    setEditBusy(true);
    try {
      const res = await edit({
        id: editFor.id,
        request_details: editDesc,
        price: editPrice,
        deadline_requested: editDeadline.trim() ? editDeadline : null,
      });
      if (!res.ok) {
        toast("error", "Could not update", res.error);
        return;
      }
      patchRow(editFor.id, {
        request_details: editDesc,
        price: editPrice,
        deadline_requested: editDeadline.trim() ? editDeadline : null,
      });
      setEditFor(null);
      toast("success", "Updated", "Request changes were saved.");
      router.refresh();
    } finally {
      setEditBusy(false);
    }
  };

  const tabLabel = (key: StatusTab): string => {
    if (key === "all") return "All";
    if (key === "pending_review") return "Pending review";
    return modelStatusLabel(key);
  };

  const tabCount = (key: StatusTab): number => {
    if (key === "all") return counts.total;
    return (counts as Record<string, number>)[key] ?? 0;
  };

  const modelName = (r: CustomRequest) =>
    r.assigned_model_name || modelLabelById[r.assigned_model_id] || "—";

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/40">Virtual assistant</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-white">Custom requests</h1>
          <p className="mt-2 max-w-2xl text-sm text-white/60">
            Review pending items, edit details, and track model progress across your agency queue.
          </p>
        </div>
        {pendingCount > 0 ? (
          <div className="shrink-0 rounded-2xl border border-sky-400/30 bg-sky-500/10 px-4 py-3 text-right">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-white/45">Agency pending queue</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-white">{pendingCount}</p>
            <p className="text-[11px] text-white/50">awaiting first review</p>
          </div>
        ) : null}
      </header>

      <div className="-mx-1 overflow-x-auto px-1 pb-1 snap-x snap-mandatory">
        <div className="flex min-w-min gap-3">
          <StatCard label="Total" value={counts.total} icon={ListChecks} accentClass="border-white/10 ring-white/[0.06]" />
          <StatCard
            label="Waiting schedule"
            value={counts.waiting_schedule}
            icon={Clock}
            accentClass="border-amber-500/25 bg-amber-500/5 ring-amber-500/10"
          />
          <StatCard
            label="Scheduled"
            value={counts.scheduled}
            icon={CalendarClock}
            accentClass="border-sky-500/25 bg-sky-500/5 ring-sky-500/10"
          />
          <StatCard
            label="In progress"
            value={counts.in_progress}
            icon={Calendar}
            accentClass="border-violet-500/25 bg-violet-500/5 ring-violet-500/10"
          />
          <StatCard
            label="Uploaded"
            value={counts.uploaded}
            icon={Upload}
            accentClass="border-emerald-500/25 bg-emerald-500/5 ring-emerald-500/10"
          />
          <StatCard
            label="Completed"
            value={counts.completed}
            icon={CheckCircle2}
            accentClass="border-green-500/25 bg-green-500/5 ring-green-500/10"
          />
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
        <div className="flex flex-wrap items-center gap-2 border-b border-white/10 pb-3">
          <span className="text-xs font-semibold uppercase tracking-wide text-white/45">Status</span>
          {(["all", ...STATUS_TABS] as StatusTab[]).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                filter === key
                  ? "border-sky-400/55 bg-sky-500/20 text-sky-100"
                  : "border-white/12 bg-white/[0.04] text-white/70 hover:bg-white/[0.08]"
              )}
            >
              {tabLabel(key)}
              <span className="ml-1 text-white/45">{tabCount(key)}</span>
            </button>
          ))}
        </div>

        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <div className="relative md:col-span-2">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
            <FormInput
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search fan or title…"
              className="border-white/10 bg-zinc-950/80 pl-9"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-medium text-white/50">Model</label>
            <select
              value={modelId}
              onChange={(e) => setModelId(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-white"
            >
              <option value="all">All models</option>
              {modelOptions.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          {activeFilterCount > 0 ? (
            <span className="rounded-full border border-sky-500/35 bg-sky-500/10 px-2 py-0.5 text-[11px] font-medium text-sky-100">
              {activeFilterCount} filter{activeFilterCount === 1 ? "" : "s"}
            </span>
          ) : null}
          <button
            type="button"
            onClick={clearFilters}
            disabled={activeFilterCount === 0}
            className="inline-flex items-center gap-1 text-xs font-medium text-sky-300/90 underline-offset-4 hover:text-sky-200 hover:underline disabled:opacity-40"
          >
            <X className="h-3 w-3" aria-hidden />
            Clear filters
          </button>
          <span className="ml-auto text-xs text-white/45">{filtered.length} shown</span>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.03] px-4 py-12 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.06] text-white/35">
            <ListChecks className="h-7 w-7" aria-hidden />
          </div>
          <p className="mt-4 text-sm font-medium text-white/75">No matching requests</p>
          <p className="mt-1 text-xs text-white/45">Try a different status tab or clear your filters.</p>
          {activeFilterCount > 0 ? (
            <button
              type="button"
              onClick={clearFilters}
              className="mt-4 inline-flex items-center gap-1.5 rounded-xl border border-sky-500/35 bg-sky-500/15 px-4 py-2 text-xs font-semibold text-sky-200 hover:bg-sky-500/25"
            >
              <X className="h-3.5 w-3.5" aria-hidden />
              Clear filters
            </button>
          ) : null}
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {paginated.map((r) => {
              const isPending = r.admin_status === "pending";
              const isRejected = r.admin_status === "rejected";
              const desc = displayDescription(r);

              return (
                <MobileCard
                  key={r.id}
                  onClick={() => setDetail(r)}
                  padding="none"
                  className="flex overflow-hidden border-white/10 bg-zinc-950/80 ring-white/[0.06] transition hover:bg-white/[0.03]"
                >
                  <div className="w-1 shrink-0 bg-gradient-to-b from-sky-500/80 to-blue-600/60" aria-hidden />
                  <div className="min-w-0 flex-1 p-4 text-left">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-white" title={displayTitle(r)}>
                          {displayTitle(r)}
                        </p>
                        <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-white/55">
                          <User className="h-3 w-3 shrink-0" aria-hidden />@{r.fan_username?.trim() || "—"}
                        </p>
                        <p className="mt-0.5 text-xs text-white/45">{modelName(r)}</p>
                      </div>
                      <StatusBadge status={r.model_status} adminPending={isPending} />
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1 rounded-md border border-sky-500/25 bg-sky-500/10 px-2 py-0.5 text-sm font-semibold text-sky-100">
                        <DollarSign className="h-3.5 w-3.5" aria-hidden />
                        {r.price?.trim() || "—"}
                      </span>
                      <span className="inline-flex items-center gap-1 text-[11px] text-white/45">
                        <Clock className="h-3 w-3" aria-hidden />
                        Due {displayDeadline(r)}
                      </span>
                      {r.model_scheduled_date ? (
                        <span className="inline-flex items-center gap-1 text-[11px] text-white/45">
                          <CalendarClock className="h-3 w-3" aria-hidden />
                          {displayScheduled(r)}
                        </span>
                      ) : null}
                    </div>

                    {desc ? (
                      <p className="mt-3 line-clamp-2 text-xs leading-relaxed text-white/55">{desc}</p>
                    ) : null}

                    {isRejected && r.decline_reason?.trim() ? (
                      <div className="mt-3 rounded-xl border border-rose-500/25 bg-rose-500/10 px-3 py-2">
                        <p className="text-[11px] font-semibold text-rose-300">Declined</p>
                        <p className="mt-0.5 text-[11px] text-white/55">{r.decline_reason}</p>
                      </div>
                    ) : null}

                    <div className="mt-3 flex flex-wrap gap-2 border-t border-white/10 pt-3" onClick={(e) => e.stopPropagation()}>
                      {isPending ? (
                        <>
                          <button
                            type="button"
                            disabled={busyId === r.id}
                            onClick={() => void onApproveOne(r.id)}
                            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-emerald-500/35 bg-emerald-500/15 py-2 text-xs font-medium text-emerald-200 hover:bg-emerald-500/25 disabled:opacity-50"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                            Approve
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setDeclineFor(r);
                              declineReasonRef.current = "";
                            }}
                            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-rose-500/35 bg-rose-500/15 py-2 text-xs font-medium text-rose-200 hover:bg-rose-500/25"
                          >
                            <XCircle className="h-3.5 w-3.5" aria-hidden />
                            Decline
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditFor(r)}
                            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-xs font-medium text-white/80 hover:bg-white/10"
                          >
                            <Pencil className="h-3.5 w-3.5" aria-hidden />
                            Edit
                          </button>
                        </>
                      ) : r.admin_status === "accepted" ? (
                        <button
                          type="button"
                          onClick={() => setEditFor(r)}
                          className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-xs font-medium text-white/80 hover:bg-white/10"
                        >
                          <Pencil className="h-3.5 w-3.5" aria-hidden />
                          Edit
                        </button>
                      ) : null}
                    </div>
                  </div>
                </MobileCard>
              );
            })}
          </div>

          <PaginationControls page={page} totalPages={totalPages} onPage={setPage} totalItems={filtered.length} />
        </>
      )}

      <CustomRequestDetailModal
        open={detail != null}
        onOpenChange={(open) => {
          if (!open) setDetail(null);
        }}
        request={detail}
        language="en"
        variant="agency"
      >
        {detail?.decline_reason?.trim() ? (
          <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-white/45">Decline reason</p>
            <p className="mt-2 text-sm text-white/80">{detail.decline_reason}</p>
          </section>
        ) : null}
      </CustomRequestDetailModal>

      <ConfirmDialog
        open={declineFor != null}
        onClose={() => {
          if (declineBusy) return;
          setDeclineFor(null);
          declineReasonRef.current = "";
        }}
        onConfirm={() => submitDecline()}
        title="Decline custom request"
        description={
          declineFor
            ? `Reject this request from ${declineFor.fan_username || "the fan"}? A reason is required and will be stored with the record.`
            : ""
        }
        confirmLabel="Decline request"
        confirmVariant="danger"
        loading={declineBusy}
        requireReason
        reasonPlaceholder="Explain why this request cannot proceed…"
        onReasonChange={(reason) => {
          declineReasonRef.current = reason;
        }}
      />

      {editFor ? (
        <GlassModal
          onClose={() => !editBusy && setEditFor(null)}
          title="Edit custom request"
          subtitle={displayTitle(editFor)}
          className="md:max-w-lg"
        >
          <form onSubmit={(e) => void submitEdit(e)} className="space-y-4 p-5">
            <div>
              <Label htmlFor="va-edit-desc">Description</Label>
              <Textarea
                id="va-edit-desc"
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
                className="mt-1 min-h-[110px] border-white/10 bg-zinc-950/80 text-white"
              />
            </div>
            <div>
              <Label htmlFor="va-edit-price">Price</Label>
              <FormInput
                id="va-edit-price"
                value={editPrice}
                onChange={(e) => setEditPrice(e.target.value)}
                className="mt-1 border-white/10 bg-zinc-950/80"
              />
            </div>
            <div>
              <Label htmlFor="va-edit-deadline">Deadline</Label>
              <FormInput
                id="va-edit-deadline"
                type="datetime-local"
                value={editDeadline}
                onChange={(e) => setEditDeadline(e.target.value)}
                className="mt-1 border-white/10 bg-zinc-950/80"
              />
            </div>
            <div className="flex flex-wrap justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={editBusy}
                onClick={() => setEditFor(null)}
                className="rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm text-white/80 hover:bg-white/10 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={editBusy}
                className="rounded-xl border border-sky-500/40 bg-sky-500/20 px-4 py-2 text-sm font-semibold text-sky-100 hover:bg-sky-500/30 disabled:opacity-45"
              >
                {editBusy ? "Saving…" : "Save changes"}
              </button>
            </div>
          </form>
        </GlassModal>
      ) : null}
    </div>
  );
}
