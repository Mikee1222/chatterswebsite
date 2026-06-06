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
  Download,
  ListChecks,
  Pencil,
  Search,
  Upload,
  User,
  Users,
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
import {
  adminApproveCustomRequest,
  adminDeclineCustomRequest,
  adminEditCustomRequest,
  adminLoadMoreCustomRequests,
} from "@/app/actions/admin-custom-requests";
import { formatDateEuropean, formatDateTimeEuropean } from "@/lib/format";
import { dashboardSwrKeys } from "@/lib/hooks/use-dashboard-data";
import { usePagination } from "@/lib/use-pagination";
import { cn } from "@/lib/utils";
import type { AppNotification, CustomRequest, CustomRequestModelStatus } from "@/types";

type StatusTab = "all" | "pending" | "accepted" | "rejected" | "completed" | "uploaded";

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

function chatterName(req: CustomRequest): string {
  return (req.requested_by_chatter_name ?? req.chatter_name ?? "").trim() || "—";
}

function StatusBadge({
  req,
}: {
  req: CustomRequest;
}) {
  if (req.admin_status === "pending") {
    return (
      <span className="inline-flex rounded-full border border-amber-500/30 bg-amber-500/15 px-2.5 py-0.5 text-[11px] font-medium text-amber-300">
        Pending
      </span>
    );
  }
  if (req.admin_status === "rejected") {
    return (
      <span className="inline-flex rounded-full border border-rose-500/35 bg-rose-500/15 px-2.5 py-0.5 text-[11px] font-medium text-rose-300">
        Rejected
      </span>
    );
  }
  const k = statusKey(req.model_status);
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
              : "border-pink-500/30 bg-pink-500/15 text-pink-300";

  return (
    <span className={cn("inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-medium capitalize", variant)}>
      {k === "waiting_schedule" || k === "scheduled" || k === "in_progress" || k === "uploaded" || k === "completed"
        ? modelStatusLabel(req.model_status)
        : "Accepted"}
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

const STATUS_TABS: StatusTab[] = ["pending", "accepted", "rejected", "completed", "uploaded"];

const CSV_FIELDS: Array<keyof CustomRequest> = [
  "id",
  "request_id",
  "fan_username",
  "requested_by_chatter_id",
  "requested_by_chatter_name",
  "assigned_model_id",
  "assigned_model_name",
  "request_title",
  "request_details",
  "price",
  "deadline_requested",
  "admin_status",
  "model_status",
  "model_scheduled_date",
  "decline_reason",
  "created_at",
];

function toCsvValue(v: unknown): string {
  const raw = v == null ? "" : String(v);
  return `"${raw.replace(/"/g, '""')}"`;
}

function matchesStatusTab(req: CustomRequest, tab: StatusTab): boolean {
  if (tab === "all") return true;
  if (tab === "pending") return req.admin_status === "pending";
  if (tab === "rejected") return req.admin_status === "rejected";
  if (tab === "uploaded") return req.admin_status === "accepted" && statusKey(req.model_status) === "uploaded";
  if (tab === "completed") return req.admin_status === "accepted" && statusKey(req.model_status) === "completed";
  if (tab === "accepted") {
    return (
      req.admin_status === "accepted" &&
      statusKey(req.model_status) !== "uploaded" &&
      statusKey(req.model_status) !== "completed"
    );
  }
  return true;
}

type Props = {
  initialRequests: CustomRequest[];
  initialNextOffset: string | null;
  initialHasMore: boolean;
};

export function AdminCustomRequestsClient({ initialRequests: initial, initialNextOffset, initialHasMore }: Props) {
  const router = useRouter();
  const { mutate } = useSWRConfig();
  const { addToast } = useToast();
  const [requests, setRequests] = React.useState<CustomRequest[]>(initial);
  const [nextOffset, setNextOffset] = React.useState<string | null>(initialNextOffset);
  const [hasMore, setHasMore] = React.useState(initialHasMore);
  const [loadingMore, setLoadingMore] = React.useState(false);

  const [filter, setFilter] = React.useState<StatusTab>("pending");
  const [search, setSearch] = React.useState("");
  const [modelId, setModelId] = React.useState("all");
  const [chatterId, setChatterId] = React.useState("all");
  const [dateFrom, setDateFrom] = React.useState("");
  const [dateTo, setDateTo] = React.useState("");

  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = React.useState(false);
  const [bulkDeclineOpen, setBulkDeclineOpen] = React.useState(false);
  const bulkDeclineReasonRef = React.useRef("");

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

  React.useEffect(() => {
    setRequests(initial);
    setNextOffset(initialNextOffset);
    setHasMore(initialHasMore);
  }, [initial, initialNextOffset, initialHasMore]);

  React.useEffect(() => {
    if (!editFor) return;
    setEditDesc(editFor.request_details ?? "");
    setEditPrice(editFor.price ?? "");
    setEditDeadline(editFor.deadline_requested?.trim().slice(0, 16) ?? "");
  }, [editFor]);

  const modelLabelById = React.useMemo(
    () =>
      Object.fromEntries(
        requests
          .filter((r) => r.assigned_model_id)
          .map((r) => [r.assigned_model_id, r.assigned_model_name || r.assigned_model_id])
      ),
    [requests]
  );

  const patchRow = React.useCallback((id: string, patch: Partial<CustomRequest>) => {
    setRequests((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    setDetail((prev) => (prev?.id === id ? { ...prev, ...patch } : prev));
  }, []);

  const toast = (kind: "success" | "error", title: string, body: string) => {
    addToast(localToast(`acr-${kind}-${Date.now()}`, title, body, kind === "error" ? "high" : "normal"));
  };

  const loadMore = React.useCallback(async () => {
    if (!nextOffset || loadingMore) return;
    setLoadingMore(true);
    try {
      const res = await adminLoadMoreCustomRequests(nextOffset);
      if (!res.ok) {
        toast("error", "Could not load more", res.error);
        return;
      }
      setRequests((prev) => {
        const seen = new Set(prev.map((r) => r.id));
        const appended = res.records.filter((r) => !seen.has(r.id));
        return [...prev, ...appended];
      });
      setNextOffset(res.nextOffset);
      setHasMore(res.hasMore);
    } finally {
      setLoadingMore(false);
    }
  }, [nextOffset, loadingMore, addToast]);

  const modelOptions = React.useMemo(() => {
    const byId = new Map<string, string>();
    for (const row of requests) {
      if (!row.assigned_model_id) continue;
      const label = row.assigned_model_name || modelLabelById[row.assigned_model_id] || row.assigned_model_id;
      byId.set(row.assigned_model_id, label);
    }
    return [...byId.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [requests, modelLabelById]);

  const chatterOptions = React.useMemo(() => {
    const byId = new Map<string, string>();
    for (const row of requests) {
      if (!row.requested_by_chatter_id) continue;
      const label = row.requested_by_chatter_name || row.requested_by_chatter_id;
      byId.set(row.requested_by_chatter_id, label);
    }
    return [...byId.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [requests]);

  const counts = React.useMemo(() => {
    const c = {
      total: requests.length,
      pending: 0,
      accepted: 0,
      rejected: 0,
      completed: 0,
      uploaded: 0,
    };
    for (const r of requests) {
      if (r.admin_status === "pending") c.pending += 1;
      else if (r.admin_status === "rejected") c.rejected += 1;
      else if (statusKey(r.model_status) === "uploaded") c.uploaded += 1;
      else if (statusKey(r.model_status) === "completed") c.completed += 1;
      else if (r.admin_status === "accepted") c.accepted += 1;
    }
    return c;
  }, [requests]);

  const filtered = React.useMemo(() => {
    let list = requests.filter((r) => matchesStatusTab(r, filter));
    if (modelId !== "all") list = list.filter((r) => r.assigned_model_id === modelId);
    if (chatterId !== "all") list = list.filter((r) => r.requested_by_chatter_id === chatterId);
    if (dateFrom.trim()) list = list.filter((r) => (r.created_at ?? "").slice(0, 10) >= dateFrom.trim());
    if (dateTo.trim()) list = list.filter((r) => (r.created_at ?? "").slice(0, 10) <= dateTo.trim());
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((r) => {
        const blob = `${r.fan_username ?? ""} ${r.request_title ?? ""} ${chatterName(r)}`.toLowerCase();
        return blob.includes(q);
      });
    }
    const createdMs = (r: CustomRequest) => Date.parse(r.created_at || "") || 0;
    return [...list].sort((a, b) => createdMs(b) - createdMs(a));
  }, [requests, filter, modelId, chatterId, dateFrom, dateTo, search]);

  const { page, setPage, totalPages, paginated, reset } = usePagination(filtered, 20);

  React.useEffect(() => {
    reset();
  }, [filter, search, modelId, chatterId, dateFrom, dateTo, reset]);

  React.useEffect(() => {
    setSelectedIds((prev) => {
      const allowed = new Set(filtered.map((r) => r.id));
      return new Set([...prev].filter((id) => allowed.has(id)));
    });
  }, [filtered]);

  const clearFilters = () => {
    setSearch("");
    setModelId("all");
    setChatterId("all");
    setDateFrom("");
    setDateTo("");
    setFilter("pending");
  };

  const activeFilterCount =
    (search.trim() ? 1 : 0) +
    (modelId !== "all" ? 1 : 0) +
    (chatterId !== "all" ? 1 : 0) +
    (dateFrom ? 1 : 0) +
    (dateTo ? 1 : 0) +
    (filter !== "pending" ? 1 : 0);

  const tabLabel = (key: StatusTab): string => {
    if (key === "all") return "All";
    if (key === "pending") return "Pending";
    if (key === "accepted") return "Accepted";
    if (key === "rejected") return "Rejected";
    if (key === "completed") return "Completed";
    return "Uploaded";
  };

  const tabCount = (key: StatusTab): number => {
    if (key === "all") return counts.total;
    return (counts as Record<string, number>)[key] ?? 0;
  };

  const modelName = (r: CustomRequest) =>
    r.assigned_model_name || modelLabelById[r.assigned_model_id] || "—";

  const onApproveOne = async (id: string) => {
    setBusyId(id);
    try {
      const res = await adminApproveCustomRequest(id);
      if (!res.ok) {
        toast("error", "Could not approve", res.error);
        return;
      }
      patchRow(id, { admin_status: "accepted" });
      await mutate(dashboardSwrKeys.notificationsUnreadCount);
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
      const res = await adminDeclineCustomRequest({ recordId: declineFor.id, decline_reason: reasonText });
      if (!res.ok) {
        toast("error", "Could not decline", res.error);
        return;
      }
      patchRow(declineFor.id, { admin_status: "rejected", decline_reason: reasonText });
      await mutate(dashboardSwrKeys.notificationsUnreadCount);
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
      const res = await adminEditCustomRequest({
        recordId: editFor.id,
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
      await mutate(dashboardSwrKeys.notificationsUnreadCount);
      setEditFor(null);
      toast("success", "Updated", "Request changes were saved.");
      router.refresh();
    } finally {
      setEditBusy(false);
    }
  };

  const runBulkApprove = async () => {
    const ids = filtered.filter((r) => selectedIds.has(r.id) && r.admin_status === "pending").map((r) => r.id);
    if (ids.length === 0) {
      toast("error", "No eligible requests", "Select pending requests to bulk approve.");
      return;
    }
    setBulkBusy(true);
    let ok = 0;
    for (const id of ids) {
      const res = await adminApproveCustomRequest(id);
      if (res.ok) {
        ok += 1;
        patchRow(id, { admin_status: "accepted" });
      }
    }
    await mutate(dashboardSwrKeys.notificationsUnreadCount);
    setBulkBusy(false);
    toast("success", "Bulk approve finished", `${ok}/${ids.length} requests approved.`);
    router.refresh();
  };

  const runBulkDeclineWithReason = async (declineReasonText: string) => {
    const reason = declineReasonText.trim();
    if (!reason) {
      toast("error", "Reason required", "Enter a decline reason for bulk decline.");
      return;
    }
    const ids = filtered.filter((r) => selectedIds.has(r.id) && r.admin_status === "pending").map((r) => r.id);
    if (ids.length === 0) {
      toast("error", "No eligible requests", "Select pending requests to bulk decline.");
      return;
    }
    setBulkBusy(true);
    let ok = 0;
    for (const id of ids) {
      const res = await adminDeclineCustomRequest({ recordId: id, decline_reason: reason });
      if (res.ok) {
        ok += 1;
        patchRow(id, { admin_status: "rejected", decline_reason: reason });
      }
    }
    await mutate(dashboardSwrKeys.notificationsUnreadCount);
    setBulkBusy(false);
    setBulkDeclineOpen(false);
    bulkDeclineReasonRef.current = "";
    toast("success", "Bulk decline finished", `${ok}/${ids.length} requests declined.`);
    router.refresh();
  };

  const bulkPendingDeclineCount = filtered.filter(
    (r) => selectedIds.has(r.id) && r.admin_status === "pending"
  ).length;

  const exportCsv = () => {
    const header = CSV_FIELDS.join(",");
    const lines = filtered.map((row) => CSV_FIELDS.map((field) => toCsvValue(row[field])).join(","));
    const csv = [header, ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `custom-requests-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast("success", "Export ready", `Exported ${filtered.length} filtered requests.`);
  };

  const allFilteredSelected = filtered.length > 0 && filtered.every((r) => selectedIds.has(r.id));

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/40">Administration</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-white">Custom requests</h1>
          <p className="mt-2 max-w-2xl text-sm text-white/60">
            Review fan custom content requests from chatters, approve or reject, and track model progress across your
            agency queue.
          </p>
        </div>
        {counts.pending > 0 ? (
          <div className="shrink-0 rounded-2xl border border-pink-400/30 bg-pink-500/10 px-4 py-3 text-right">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-white/45">Pending queue</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-white">{counts.pending}</p>
            <p className="text-[11px] text-white/50">awaiting review</p>
          </div>
        ) : null}
      </header>

      <div className="-mx-1 overflow-x-auto px-1 pb-1 snap-x snap-mandatory">
        <div className="flex min-w-min gap-3">
          <StatCard label="Total" value={counts.total} icon={ListChecks} accentClass="border-white/10 ring-white/[0.06]" />
          <StatCard
            label="Pending"
            value={counts.pending}
            icon={Clock}
            accentClass="border-amber-500/25 bg-amber-500/5 ring-amber-500/10"
          />
          <StatCard
            label="Accepted"
            value={counts.accepted}
            icon={CheckCircle2}
            accentClass="border-pink-500/25 bg-pink-500/5 ring-pink-500/10"
          />
          <StatCard
            label="Rejected"
            value={counts.rejected}
            icon={XCircle}
            accentClass="border-rose-500/25 bg-rose-500/5 ring-rose-500/10"
          />
          <StatCard
            label="Completed"
            value={counts.completed}
            icon={Calendar}
            accentClass="border-green-500/25 bg-green-500/5 ring-green-500/10"
          />
          <StatCard
            label="Uploaded"
            value={counts.uploaded}
            icon={Upload}
            accentClass="border-emerald-500/25 bg-emerald-500/5 ring-emerald-500/10"
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
                  ? "border-pink-400/55 bg-pink-500/20 text-pink-100"
                  : "border-white/12 bg-white/[0.04] text-white/70 hover:bg-white/[0.08]"
              )}
            >
              {tabLabel(key)}
              <span className="ml-1 text-white/45">{tabCount(key)}</span>
            </button>
          ))}
        </div>

        <div className="mt-3 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          <div className="relative md:col-span-2 lg:col-span-3">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
            <FormInput
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search fan, title, or chatter…"
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
          <div>
            <label className="mb-1 block text-[11px] font-medium text-white/50">Chatter</label>
            <select
              value={chatterId}
              onChange={(e) => setChatterId(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-white"
            >
              <option value="all">All chatters</option>
              {chatterOptions.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block text-[11px] font-medium text-white/50">From</label>
              <FormInput
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="border-white/10 bg-zinc-950/80 [color-scheme:dark]"
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-white/50">To</label>
              <FormInput
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="border-white/10 bg-zinc-950/80 [color-scheme:dark]"
              />
            </div>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          {activeFilterCount > 0 ? (
            <span className="rounded-full border border-pink-500/35 bg-pink-500/10 px-2 py-0.5 text-[11px] font-medium text-pink-100">
              {activeFilterCount} filter{activeFilterCount === 1 ? "" : "s"}
            </span>
          ) : null}
          <button
            type="button"
            onClick={clearFilters}
            disabled={activeFilterCount === 0}
            className="inline-flex items-center gap-1 text-xs font-medium text-pink-300/90 underline-offset-4 hover:text-pink-200 hover:underline disabled:opacity-40"
          >
            <X className="h-3 w-3" aria-hidden />
            Clear filters
          </button>
          <span className="ml-auto text-xs text-white/45">
            {filtered.length} shown · {requests.length} loaded
          </span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
        <button
          type="button"
          disabled={bulkBusy}
          onClick={() => void runBulkApprove()}
          className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/35 bg-emerald-500/15 px-3 py-2 text-xs font-medium text-emerald-200 hover:bg-emerald-500/25 disabled:opacity-50"
        >
          <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
          Bulk approve
        </button>
        <button
          type="button"
          disabled={bulkBusy}
          onClick={() => {
            if (bulkPendingDeclineCount === 0) {
              toast("error", "No eligible requests", "Select pending requests to bulk decline.");
              return;
            }
            setBulkDeclineOpen(true);
          }}
          className="inline-flex items-center gap-1.5 rounded-lg border border-rose-500/35 bg-rose-500/15 px-3 py-2 text-xs font-medium text-rose-200 hover:bg-rose-500/25 disabled:opacity-50"
        >
          <XCircle className="h-3.5 w-3.5" aria-hidden />
          Bulk decline
        </button>
        <button
          type="button"
          onClick={exportCsv}
          className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-xs font-medium text-white/80 hover:bg-white/10"
        >
          <Download className="h-3.5 w-3.5" aria-hidden />
          Export CSV
        </button>
        <span className="ml-auto text-xs text-white/45">{selectedIds.size} selected</span>
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
              className="mt-4 inline-flex items-center gap-1.5 rounded-xl border border-pink-500/35 bg-pink-500/15 px-4 py-2 text-xs font-semibold text-pink-200 hover:bg-pink-500/25"
            >
              <X className="h-3.5 w-3.5" aria-hidden />
              Clear filters
            </button>
          ) : null}
        </div>
      ) : (
        <>
          <label className="inline-flex items-center gap-2 text-xs text-white/60">
            <input
              type="checkbox"
              checked={allFilteredSelected}
              onChange={(e) => {
                if (e.target.checked) setSelectedIds(new Set(filtered.map((r) => r.id)));
                else setSelectedIds(new Set());
              }}
            />
            Select all filtered ({filtered.length})
          </label>

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
                  <div className="w-1 shrink-0 bg-gradient-to-b from-pink-500/80 to-rose-600/60" aria-hidden />
                  <div className="min-w-0 flex-1 p-4 text-left">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 flex-1 items-start gap-2">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(r.id)}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => {
                            setSelectedIds((prev) => {
                              const next = new Set(prev);
                              if (e.target.checked) next.add(r.id);
                              else next.delete(r.id);
                              return next;
                            });
                          }}
                          className="mt-1 shrink-0"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium text-white" title={displayTitle(r)}>
                            {displayTitle(r)}
                          </p>
                          <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-white/55">
                            <User className="h-3 w-3 shrink-0" aria-hidden />@{r.fan_username?.trim() || "—"}
                          </p>
                          <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-white/45">
                            <Users className="h-3 w-3 shrink-0" aria-hidden />
                            {chatterName(r)}
                          </p>
                          <p className="mt-0.5 text-xs text-white/45">{modelName(r)}</p>
                        </div>
                      </div>
                      <StatusBadge req={r} />
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1 rounded-md border border-pink-500/25 bg-pink-500/10 px-2 py-0.5 text-sm font-semibold text-pink-100">
                        <DollarSign className="h-3.5 w-3.5" aria-hidden />
                        {r.price?.trim() || "—"}
                      </span>
                      <span className="inline-flex items-center gap-1 text-[11px] text-white/45">
                        <Clock className="h-3 w-3" aria-hidden />
                        Due {displayDeadline(r)}
                      </span>
                      <span className="text-[11px] text-white/35">{formatDateTimeEuropean(r.created_at)}</span>
                      {r.model_scheduled_date ? (
                        <span className="inline-flex items-center gap-1 text-[11px] text-white/45">
                          <CalendarClock className="h-3 w-3" aria-hidden />
                          {formatDateEuropean(r.model_scheduled_date)}
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
                            Accept
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
                            Reject
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

          {hasMore ? (
            <div className="flex justify-center pt-2">
              <button
                type="button"
                disabled={loadingMore}
                onClick={() => void loadMore()}
                className="rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-medium text-white/80 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-45"
              >
                {loadingMore ? "Loading…" : "Load more from server"}
              </button>
            </div>
          ) : (
            <p className="text-center text-xs text-white/40">All requests loaded ({requests.length} total).</p>
          )}
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

      <ConfirmDialog
        open={bulkDeclineOpen}
        onClose={() => {
          if (bulkBusy) return;
          setBulkDeclineOpen(false);
          bulkDeclineReasonRef.current = "";
        }}
        onConfirm={() => runBulkDeclineWithReason(bulkDeclineReasonRef.current)}
        title="Bulk decline requests"
        description={`Decline ${bulkPendingDeclineCount} pending request${bulkPendingDeclineCount === 1 ? "" : "s"}? One reason will be applied to all selected rows.`}
        confirmLabel="Decline all selected"
        confirmVariant="danger"
        loading={bulkBusy}
        requireReason
        reasonPlaceholder="Enter the decline reason for all selected requests…"
        onReasonChange={(reason) => {
          bulkDeclineReasonRef.current = reason;
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
              <Label htmlFor="admin-edit-desc">Description</Label>
              <Textarea
                id="admin-edit-desc"
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
                className="mt-1 min-h-[110px] border-white/10 bg-zinc-950/80 text-white"
              />
            </div>
            <div>
              <Label htmlFor="admin-edit-price">Price</Label>
              <FormInput
                id="admin-edit-price"
                value={editPrice}
                onChange={(e) => setEditPrice(e.target.value)}
                className="mt-1 border-white/10 bg-zinc-950/80"
              />
            </div>
            <div>
              <Label htmlFor="admin-edit-deadline">Deadline</Label>
              <FormInput
                id="admin-edit-deadline"
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
                className="rounded-xl border border-pink-500/40 bg-pink-500/20 px-4 py-2 text-sm font-semibold text-pink-100 hover:bg-pink-500/30 disabled:opacity-45"
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
