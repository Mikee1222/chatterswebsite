"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useSWRConfig } from "swr";
import {
  CalendarClock,
  CheckCircle2,
  Download,
  ListChecks,
  MessageSquare,
  Pencil,
  Search,
  Trash2,
  X,
  XCircle,
} from "lucide-react";
import { useToast } from "@/contexts/toast-context";
import { CustomRequestDetailModal } from "@/components/custom-request-detail-modal";
import { FormInput } from "@/components/ui/form-input";
import { Label, Textarea } from "@/components/ui/form";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { GlassModal } from "@/components/ui/glass-modal";
import {
  adminApproveCustomRequest,
  adminDeclineCustomRequest,
  adminEditCustomRequest,
  adminLoadMoreCustomRequests,
} from "@/app/actions/admin-custom-requests";
import { formatDateEuropean } from "@/lib/format";
import { dashboardSwrKeys } from "@/lib/hooks/use-dashboard-data";
import { cn } from "@/lib/utils";
import type { AppNotification, CustomRequest, CustomRequestModelStatus, CustomRequestType } from "@/types";

type StatusTab = "all" | "pending" | "accepted" | "rejected" | "completed" | "uploaded";

const cardClass = cn(
  "rounded-xl border border-white/[0.08] bg-zinc-950/80",
  "shadow-[0_4px_24px_-8px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.04)]"
);

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

function formatCardDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const date = d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  const time = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });
  return `${date} at ${time}`;
}

function formatPrice(price: string | null | undefined): string {
  const raw = (price ?? "").trim();
  if (!raw) return "—";
  if (raw.startsWith("$")) return raw;
  return `$${raw}`;
}

function resolveType(req: CustomRequest): CustomRequestType | "other" {
  const raw = (req.custom_type ?? req.request_title ?? "").toLowerCase();
  if (raw.includes("video")) return "video";
  if (raw.includes("photo")) return "photo_set";
  if (
    raw.includes("voice") ||
    raw.includes("rating") ||
    raw.includes("special") ||
    req.custom_type === "voice_note" ||
    req.custom_type === "rating" ||
    req.custom_type === "special_request"
  ) {
    return req.custom_type ?? "special_request";
  }
  return req.custom_type ?? "other";
}

function typeLabel(type: ReturnType<typeof resolveType>): string {
  if (type === "video") return "Video";
  if (type === "photo_set") return "Photo";
  if (type === "voice_note") return "Voice note";
  if (type === "rating") return "Rating";
  if (type === "special_request") return "Special";
  return "Other";
}

function typeBadgeClass(type: ReturnType<typeof resolveType>): string {
  if (type === "video") return "border-violet-500/30 bg-violet-500/15 text-violet-300";
  if (type === "photo_set") return "border-blue-500/30 bg-blue-500/15 text-blue-300";
  return "border-white/15 bg-white/5 text-white/60";
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

function StatusBadge({ req }: { req: CustomRequest }) {
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
      ? "border-sky-500/30 bg-sky-500/15 text-sky-300"
      : k === "scheduled"
        ? "border-indigo-500/30 bg-indigo-500/15 text-indigo-300"
        : k === "in_progress"
          ? "border-violet-500/30 bg-violet-500/15 text-violet-300"
          : k === "uploaded"
            ? "border-purple-500/30 bg-purple-500/15 text-purple-300"
            : k === "completed"
              ? "border-green-500/30 bg-green-500/15 text-green-300"
              : "border-blue-500/30 bg-blue-500/15 text-blue-300";

  return (
    <span className={cn("inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-medium", variant)}>
      {k === "waiting_schedule" ||
      k === "scheduled" ||
      k === "in_progress" ||
      k === "uploaded" ||
      k === "completed"
        ? modelStatusLabel(req.model_status)
        : "Accepted"}
    </span>
  );
}

const STATUS_TABS: StatusTab[] = ["all", "pending", "accepted", "rejected", "completed", "uploaded"];

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

function emptyStateMessage(tab: StatusTab): { title: string; hint: string } {
  if (tab === "pending") return { title: "No pending requests", hint: "New fan requests from chatters will appear here." };
  if (tab === "accepted") return { title: "No accepted requests", hint: "Approved requests waiting on the model will show here." };
  if (tab === "rejected") return { title: "No rejected requests", hint: "Declined requests are listed in this tab." };
  if (tab === "completed") return { title: "No completed requests", hint: "Requests marked completed by the model appear here." };
  if (tab === "uploaded") return { title: "No uploaded requests", hint: "Uploaded customs will appear in this tab." };
  return { title: "No custom requests", hint: "Try a different status tab or clear your filters." };
}

type Props = {
  initialRequests: CustomRequest[];
  initialNextOffset: string | null;
  initialHasMore: boolean;
  modelById: Record<string, string>;
  chatterById: Record<string, string>;
};

function RequestCard({
  req,
  selected,
  busyId,
  deleteBusy,
  pendingDeleteId,
  getModelName,
  getChatterName,
  onToggleSelect,
  onOpenDetail,
  onApprove,
  onReject,
  onEdit,
  onDelete,
}: {
  req: CustomRequest;
  selected: boolean;
  busyId: string | null;
  deleteBusy: boolean;
  pendingDeleteId: string | null;
  getModelName: (r: CustomRequest) => string;
  getChatterName: (r: CustomRequest) => string;
  onToggleSelect: (checked: boolean) => void;
  onOpenDetail: () => void;
  onApprove: () => void;
  onReject: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [expanded, setExpanded] = React.useState(false);
  const desc = displayDescription(req);
  const type = resolveType(req);
  const isPending = req.admin_status === "pending";
  const isRejected = req.admin_status === "rejected";
  const hasAdminNote = Boolean(req.admin_notes?.trim());

  return (
    <article
      className={cn(
        cardClass,
        "cursor-pointer p-4 transition-all duration-200 hover:border-white/15",
        selected && "border-pink-500/45 bg-pink-500/[0.06] ring-1 ring-pink-500/20"
      )}
      onClick={onOpenDetail}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="checkbox"
            checked={selected}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => onToggleSelect(e.target.checked)}
            className="h-4 w-4 rounded border-white/25"
            aria-label={`Select request for @${req.fan_username || "fan"}`}
          />
          <span className={cn("inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-medium", typeBadgeClass(type))}>
            {typeLabel(type)}
          </span>
          <StatusBadge req={req} />
        </div>
        <button
          type="button"
          disabled={deleteBusy && pendingDeleteId === req.id}
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="rounded-lg p-1.5 text-white/40 transition-colors hover:bg-red-500/15 hover:text-red-300 disabled:opacity-50"
          title="Delete request"
        >
          <Trash2 className="h-4 w-4" aria-hidden />
        </button>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1">
        <p className="text-sm font-semibold text-white">@{req.fan_username?.trim() || "—"}</p>
        <span className="inline-flex rounded-full border border-pink-500/30 bg-pink-500/10 px-2 py-0.5 text-[11px] font-medium text-pink-200">
          {getModelName(req)}
        </span>
        <span className="text-xs text-white/45">{getChatterName(req)}</span>
        <span className="text-sm font-medium tabular-nums text-white/90">{formatPrice(req.price)}</span>
      </div>

      {desc ? (
        <div className="mt-3" onClick={(e) => e.stopPropagation()}>
          <p className={cn("text-sm leading-relaxed text-white/60", !expanded && "line-clamp-2")}>{desc}</p>
          {desc.length > 120 ? (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="mt-1 text-xs font-medium text-pink-300/90 hover:text-pink-200"
            >
              {expanded ? "Show less" : "Show more"}
            </button>
          ) : null}
        </div>
      ) : null}

      {isRejected && req.decline_reason?.trim() ? (
        <div
          className="mt-3 rounded-xl border border-rose-500/25 bg-rose-500/10 px-3 py-2"
          onClick={(e) => e.stopPropagation()}
        >
          <p className="text-[11px] font-medium text-rose-300">Decline reason</p>
          <p className="mt-0.5 text-xs text-white/55">{req.decline_reason}</p>
        </div>
      ) : null}

      <div
        className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.06] pt-3"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-white/45">
          <span className="inline-flex items-center gap-1">
            <CalendarClock className="h-3 w-3 shrink-0" aria-hidden />
            Due {displayDeadline(req)}
          </span>
          <span>{formatCardDateTime(req.created_at)}</span>
          {hasAdminNote ? (
            <span className="inline-flex items-center gap-1 text-amber-300/80" title={req.admin_notes}>
              <MessageSquare className="h-3 w-3 shrink-0" aria-hidden />
              Admin note
            </span>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2">
          {isPending ? (
            <>
              <button
                type="button"
                disabled={busyId === req.id}
                onClick={onApprove}
                className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/35 bg-emerald-500/15 px-3 py-1.5 text-xs font-medium text-emerald-200 hover:bg-emerald-500/25 disabled:opacity-50"
              >
                <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                Accept
              </button>
              <button
                type="button"
                onClick={onReject}
                className="inline-flex items-center gap-1.5 rounded-lg border border-rose-500/35 bg-rose-500/15 px-3 py-1.5 text-xs font-medium text-rose-200 hover:bg-rose-500/25"
              >
                <XCircle className="h-3.5 w-3.5" aria-hidden />
                Reject
              </button>
              <button
                type="button"
                onClick={onEdit}
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/80 hover:bg-white/10"
              >
                <Pencil className="h-3.5 w-3.5" aria-hidden />
                Edit
              </button>
            </>
          ) : req.admin_status === "accepted" ? (
            <button
              type="button"
              onClick={onEdit}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/80 hover:bg-white/10"
            >
              <Pencil className="h-3.5 w-3.5" aria-hidden />
              Edit
            </button>
          ) : null}
        </div>
      </div>
    </article>
  );
}

export function AdminCustomRequestsClient({
  initialRequests: initial,
  initialNextOffset,
  initialHasMore,
  modelById,
  chatterById,
}: Props) {
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
  const [pendingDelete, setPendingDelete] = React.useState<CustomRequest | null>(null);
  const [deleteBusy, setDeleteBusy] = React.useState(false);

  const getModelName = React.useCallback(
    (r: CustomRequest) => modelById[r.assigned_model_id] || r.assigned_model_name || "—",
    [modelById]
  );

  const getChatterName = React.useCallback(
    (r: CustomRequest) => chatterById[r.requested_by_chatter_id] || r.requested_by_chatter_name || "—",
    [chatterById]
  );

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

  const modelOptions = React.useMemo(
    () =>
      Object.entries(modelById)
        .map(([id, name]) => [id, name] as const)
        .sort((a, b) => a[1].localeCompare(b[1])),
    [modelById]
  );

  const chatterOptions = React.useMemo(
    () =>
      Object.entries(chatterById)
        .map(([id, name]) => [id, name] as const)
        .sort((a, b) => a[1].localeCompare(b[1])),
    [chatterById]
  );

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
        const blob = `${r.fan_username ?? ""} ${r.request_title ?? ""} ${getChatterName(r)} ${getModelName(r)}`.toLowerCase();
        return blob.includes(q);
      });
    }
    const createdMs = (r: CustomRequest) => Date.parse(r.created_at || "") || 0;
    return [...list].sort((a, b) => createdMs(b) - createdMs(a));
  }, [requests, filter, modelId, chatterId, dateFrom, dateTo, search, getChatterName, getModelName]);

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

  const handleDelete = async () => {
    if (!pendingDelete) return;
    const id = pendingDelete.id;
    setDeleteBusy(true);
    try {
      const res = await fetch(`/api/admin/custom-requests/${encodeURIComponent(id)}`, { method: "DELETE" });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        toast("error", "Could not delete", data.error ?? "Delete failed.");
        return;
      }
      setRequests((prev) => prev.filter((r) => r.id !== id));
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      setDetail((prev) => (prev?.id === id ? null : prev));
      setPendingDelete(null);
      toast("success", "Deleted", "Custom request removed.");
      router.refresh();
    } finally {
      setDeleteBusy(false);
    }
  };

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
  const emptyState = emptyStateMessage(filter);

  const statPills = [
    { label: "Pending", value: counts.pending, className: "border-amber-500/30 bg-amber-500/10 text-amber-300" },
    { label: "Accepted", value: counts.accepted, className: "border-blue-500/30 bg-blue-500/10 text-blue-300" },
    { label: "Completed", value: counts.completed, className: "border-green-500/30 bg-green-500/10 text-green-300" },
    { label: "Uploaded", value: counts.uploaded, className: "border-purple-500/30 bg-purple-500/10 text-purple-300" },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 md:px-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-3">
          <h1 className="text-2xl font-semibold tracking-tight text-white">Custom requests</h1>
          <div className="flex flex-wrap gap-2">
            {statPills.map((pill) => (
              <span
                key={pill.label}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium tabular-nums",
                  pill.className
                )}
              >
                {pill.value} {pill.label.toLowerCase()}
              </span>
            ))}
          </div>
        </div>
        <button
          type="button"
          onClick={exportCsv}
          className="inline-flex shrink-0 items-center gap-1.5 self-start rounded-lg border border-white/15 bg-transparent px-3 py-1.5 text-xs font-medium text-white/70 transition hover:border-white/25 hover:bg-white/5 hover:text-white"
        >
          <Download className="h-3.5 w-3.5" aria-hidden />
          Export CSV
        </button>
      </header>

      <section className={cn(cardClass, "p-4")}>
        <div className="flex flex-wrap gap-2">
          {STATUS_TABS.map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                filter === key
                  ? "border-pink-500/40 bg-pink-500/15 text-pink-100"
                  : "border-white/10 bg-white/[0.03] text-white/60 hover:border-white/20 hover:text-white/80"
              )}
            >
              {tabLabel(key)}
              <span className="ml-1 tabular-nums text-white/45">{tabCount(key)}</span>
            </button>
          ))}
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-5">
          <div className="relative lg:col-span-2">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
            <FormInput
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search fan, title, or chatter…"
              className="border-white/10 bg-white/[0.03] pl-9"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-white/45">Model</label>
            <select
              value={modelId}
              onChange={(e) => setModelId(e.target.value)}
              className="h-10 w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 text-sm text-white"
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
            <label className="mb-1 block text-xs text-white/45">Chatter</label>
            <select
              value={chatterId}
              onChange={(e) => setChatterId(e.target.value)}
              className="h-10 w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 text-sm text-white"
            >
              <option value="all">All chatters</option>
              {chatterOptions.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2 lg:col-span-2">
            <div>
              <label className="mb-1 block text-xs text-white/45">From</label>
              <FormInput
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="border-white/10 bg-white/[0.03] [color-scheme:dark]"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-white/45">To</label>
              <FormInput
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="border-white/10 bg-white/[0.03] [color-scheme:dark]"
              />
            </div>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={clearFilters}
            disabled={activeFilterCount === 0}
            className="inline-flex items-center gap-1 text-xs font-medium text-pink-300/90 underline-offset-4 hover:text-pink-200 hover:underline disabled:opacity-40"
          >
            <X className="h-3 w-3" aria-hidden />
            Clear filters
          </button>
        </div>

        {selectedIds.size > 0 ? (
          <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] p-3">
            <span className="text-xs text-white/55">{selectedIds.size} selected</span>
            <button
              type="button"
              disabled={bulkBusy}
              onClick={() => void runBulkApprove()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/35 bg-emerald-500/15 px-3 py-1.5 text-xs font-medium text-emerald-200 hover:bg-emerald-500/25 disabled:opacity-50"
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
              className="inline-flex items-center gap-1.5 rounded-lg border border-rose-500/35 bg-rose-500/15 px-3 py-1.5 text-xs font-medium text-rose-200 hover:bg-rose-500/25 disabled:opacity-50"
            >
              <XCircle className="h-3.5 w-3.5" aria-hidden />
              Bulk decline
            </button>
          </div>
        ) : null}
      </section>

      {filtered.length === 0 ? (
        <div className={cn(cardClass, "flex flex-col items-center px-6 py-16 text-center")}>
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-white/35">
            <ListChecks className="h-7 w-7" aria-hidden />
          </div>
          <p className="mt-4 text-sm font-medium text-white/75">{emptyState.title}</p>
          <p className="mt-1 max-w-sm text-xs text-white/45">{emptyState.hint}</p>
          {activeFilterCount > 0 ? (
            <button
              type="button"
              onClick={clearFilters}
              className="mt-4 inline-flex items-center gap-1.5 rounded-xl border border-pink-500/35 bg-pink-500/15 px-4 py-2 text-xs font-medium text-pink-200 hover:bg-pink-500/25"
            >
              <X className="h-3.5 w-3.5" aria-hidden />
              Clear filters
            </button>
          ) : null}
        </div>
      ) : (
        <>
          <label className="inline-flex items-center gap-2 text-xs text-white/55">
            <input
              type="checkbox"
              checked={allFilteredSelected}
              onChange={(e) => {
                if (e.target.checked) setSelectedIds(new Set(filtered.map((r) => r.id)));
                else setSelectedIds(new Set());
              }}
              className="h-4 w-4 rounded border-white/25"
            />
            Select all filtered ({filtered.length})
          </label>

          <div className="space-y-3">
            {filtered.map((r) => (
              <RequestCard
                key={r.id}
                req={r}
                selected={selectedIds.has(r.id)}
                busyId={busyId}
                deleteBusy={deleteBusy}
                pendingDeleteId={pendingDelete?.id ?? null}
                getModelName={getModelName}
                getChatterName={getChatterName}
                onToggleSelect={(checked) => {
                  setSelectedIds((prev) => {
                    const next = new Set(prev);
                    if (checked) next.add(r.id);
                    else next.delete(r.id);
                    return next;
                  });
                }}
                onOpenDetail={() => setDetail(r)}
                onApprove={() => void onApproveOne(r.id)}
                onReject={() => {
                  setDeclineFor(r);
                  declineReasonRef.current = "";
                }}
                onEdit={() => setEditFor(r)}
                onDelete={() => setPendingDelete(r)}
              />
            ))}
          </div>

          <div className="flex flex-col items-center gap-2 pt-2 sm:flex-row sm:justify-center sm:gap-4">
            <p className="text-xs text-white/45">
              {filtered.length} shown · {requests.length} total loaded
            </p>
            {hasMore ? (
              <button
                type="button"
                disabled={loadingMore}
                onClick={() => void loadMore()}
                className="rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-medium text-white/80 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-45"
              >
                {loadingMore ? "Loading…" : "Load more"}
              </button>
            ) : null}
          </div>
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
        modelById={modelById}
        chatterById={chatterById}
      >
        {detail?.decline_reason?.trim() ? (
          <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <p className="text-xs font-medium text-white/45">Decline reason</p>
            <p className="mt-2 text-sm text-white/80">{detail.decline_reason}</p>
          </section>
        ) : null}
        {detail?.admin_notes?.trim() ? (
          <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <p className="text-xs font-medium text-white/45">Admin note</p>
            <p className="mt-2 text-sm text-white/80">{detail.admin_notes}</p>
          </section>
        ) : null}
      </CustomRequestDetailModal>

      <ConfirmDialog
        open={pendingDelete != null}
        onClose={() => {
          if (deleteBusy) return;
          setPendingDelete(null);
        }}
        onConfirm={() => void handleDelete()}
        title="Delete custom request?"
        description={
          pendingDelete
            ? `Permanently delete the request for @${pendingDelete.fan_username?.trim() || "the fan"} (${displayTitle(pendingDelete)})? This cannot be undone.`
            : ""
        }
        confirmLabel="Delete request"
        confirmVariant="danger"
        loading={deleteBusy}
      />

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
