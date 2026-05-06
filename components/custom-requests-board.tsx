"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { formatDateTimeEuropean } from "@/lib/format";
import { Label, Textarea } from "@/components/ui/form";
import { FormInput } from "@/components/ui/form-input";
import { CustomRequestDetailModal } from "@/components/custom-request-detail-modal";
import type { CustomRequest } from "@/types";

type StatusFilterValue = "pending" | "approved" | "declined" | "scheduled" | "uploaded";
type TypeFilterValue = "video" | "photo" | "custom" | "other";
type ViewTab = "all" | StatusFilterValue;
type SortOption =
  | "date_desc"
  | "date_asc"
  | "priority_desc"
  | "priority_asc"
  | "price_desc"
  | "price_asc"
  | "status";

type ActionResult = { ok: true } | { ok: false; error: string };

type EditInput = {
  request_details: string;
  price: string;
  deadline_requested: string | null;
};

type Props = {
  requests: CustomRequest[];
  modelLabelById?: Record<string, string>;
  canAssignModel?: boolean;
  assignModelDisabledReason?: string;
  /** Admin (pink) vs VA (sky) chrome; board behavior is identical. */
  variant?: "admin" | "va";
  hubTitle?: string;
  hubSubtitle?: string;
  /** When set (e.g. VA page), show agency-wide pending count from server in the hero. */
  agencyWidePendingCount?: number;
  onApprove: (id: string) => Promise<ActionResult>;
  onDecline: (input: { id: string; decline_reason: string }) => Promise<ActionResult>;
  onEdit: (input: { id: string } & EditInput) => Promise<ActionResult>;
  onToast: (kind: "success" | "error", title: string, body: string) => void;
};

function normalizeStatusValue(req: CustomRequest): StatusFilterValue {
  if (req.admin_status === "pending") return "pending";
  if (req.admin_status === "rejected") return "declined";
  if (req.model_status === "scheduled") return "scheduled";
  if (req.model_status === "uploaded" || req.model_status === "completed") return "uploaded";
  return "approved";
}

function normalizeTypeValue(req: CustomRequest): TypeFilterValue {
  const raw = (req.custom_type || req.request_title || "").toLowerCase();
  if (raw.includes("video")) return "video";
  if (raw.includes("photo")) return "photo";
  if (
    raw.includes("special") ||
    raw.includes("voice") ||
    raw.includes("rating") ||
    raw.includes("custom")
  ) {
    return "custom";
  }
  return "other";
}

function priorityWeight(priority?: string): number {
  const p = (priority ?? "normal").toLowerCase();
  if (p === "urgent") return 4;
  if (p === "high") return 3;
  if (p === "normal") return 2;
  return 1;
}

function statusSortWeight(req: CustomRequest): number {
  if (req.admin_status === "pending") return 0;
  if (req.admin_status === "rejected") return 4;
  if (req.model_status === "waiting_schedule") return 1;
  if (req.model_status === "scheduled") return 2;
  if (req.model_status === "uploaded" || req.model_status === "completed") return 3;
  return 2;
}

function parsePrice(price: string): number {
  const n = Number.parseFloat(String(price ?? "").replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function modelStatusLabelEn(status: string): string {
  const map: Record<string, string> = {
    waiting_schedule: "Waiting schedule",
    scheduled: "Scheduled",
    in_progress: "In progress",
    completed: "Completed",
    uploaded: "Uploaded",
    declined: "Declined",
  };
  return map[status] ?? status;
}

function statusBadgeClass(status: StatusFilterValue): string {
  if (status === "pending") return "border-amber-400/40 bg-amber-400/15 text-amber-100";
  if (status === "approved") return "border-sky-400/40 bg-sky-400/15 text-sky-100";
  if (status === "scheduled") return "border-indigo-400/40 bg-indigo-400/15 text-indigo-100";
  if (status === "uploaded") return "border-emerald-400/40 bg-emerald-400/15 text-emerald-100";
  return "border-rose-400/40 bg-rose-400/15 text-rose-100";
}

function humanStatus(status: StatusFilterValue): string {
  if (status === "approved") return "Approved";
  if (status === "declined") return "Declined";
  if (status === "scheduled") return "Scheduled";
  if (status === "uploaded") return "Uploaded";
  return "Pending";
}

function humanType(type: TypeFilterValue): string {
  if (type === "video") return "Video";
  if (type === "photo") return "Photo";
  if (type === "custom") return "Custom";
  return "Other";
}

function formatScheduleLine(req: CustomRequest): string {
  const date = (req.model_scheduled_date ?? "").trim();
  if (!date) return "—";
  const a = req.model_scheduled_start ? new Date(req.model_scheduled_start) : null;
  const b = req.model_scheduled_end ? new Date(req.model_scheduled_end) : null;
  if (a && b && !Number.isNaN(a.getTime()) && !Number.isNaN(b.getTime())) {
    const ta = a.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
    const tb = b.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
    return `${date} · ${ta}-${tb}`;
  }
  return date;
}

function ModalFrame({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-end justify-center p-4 md:items-center">
      <button type="button" className="absolute inset-0 bg-black/80 backdrop-blur-sm" aria-label="Close" onClick={onClose} />
      <div className="relative w-full max-w-xl rounded-2xl border border-white/10 bg-zinc-950 p-5 shadow-2xl" role="dialog" aria-modal="true">
        <h2 className="text-lg font-semibold text-white">{title}</h2>
        <div className="mt-4 space-y-4">{children}</div>
      </div>
    </div>,
    document.body
  );
}

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
  "model_scheduled_start",
  "model_scheduled_end",
  "admin_notes",
  "model_notes",
  "decline_reason",
  "linked_schedule_item_id",
  "uploaded_at",
  "uploaded_by_model",
  "created_at",
  "updated_at",
  "custom_type",
  "description",
  "priority",
  "status",
  "chatter_id",
  "chatter_name",
  "model_id",
  "model_name",
  "whale_id",
  "whale_name",
  "whale_username",
];

function toCsvValue(v: unknown): string {
  const raw = v == null ? "" : String(v);
  return `"${raw.replace(/"/g, "\"\"")}"`;
}

export function CustomRequestsBoard({
  requests: initial,
  modelLabelById = {},
  canAssignModel = false,
  assignModelDisabledReason,
  variant = "admin",
  hubTitle,
  hubSubtitle,
  agencyWidePendingCount,
  onApprove,
  onDecline,
  onEdit,
  onToast,
}: Props) {
  const isVa = variant === "va";
  const router = useRouter();
  const [rows, setRows] = React.useState(initial);
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());
  const [tab, setTab] = React.useState<ViewTab>("pending");
  const [statusFilter, setStatusFilter] = React.useState<StatusFilterValue[]>([]);
  const [typeFilter, setTypeFilter] = React.useState<TypeFilterValue[]>([]);
  const [modelFilter, setModelFilter] = React.useState("all");
  const [chatterFilter, setChatterFilter] = React.useState("all");
  const [dateFrom, setDateFrom] = React.useState("");
  const [dateTo, setDateTo] = React.useState("");
  const [fanSearch, setFanSearch] = React.useState("");
  const [sortBy, setSortBy] = React.useState<SortOption>("date_desc");
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = React.useState(false);
  const [detail, setDetail] = React.useState<CustomRequest | null>(null);
  const [declineFor, setDeclineFor] = React.useState<CustomRequest | null>(null);
  const [declineReason, setDeclineReason] = React.useState("");
  const [declineBusy, setDeclineBusy] = React.useState(false);
  const [editFor, setEditFor] = React.useState<CustomRequest | null>(null);
  const [editDesc, setEditDesc] = React.useState("");
  const [editPrice, setEditPrice] = React.useState("");
  const [editDeadline, setEditDeadline] = React.useState("");
  const [editBusy, setEditBusy] = React.useState(false);

  React.useEffect(() => setRows(initial), [initial]);

  const patchRow = React.useCallback((id: string, patch: Partial<CustomRequest>) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    setDetail((prev) => (prev?.id === id ? { ...prev, ...patch } : prev));
  }, []);

  React.useEffect(() => {
    if (!editFor) return;
    setEditDesc(editFor.request_details ?? "");
    setEditPrice(editFor.price ?? "");
    setEditDeadline(editFor.deadline_requested?.trim().slice(0, 16) ?? "");
  }, [editFor]);

  const modelOptions = React.useMemo(() => {
    const byId = new Map<string, string>();
    for (const row of rows) {
      if (!row.assigned_model_id) continue;
      const label = row.assigned_model_name || modelLabelById[row.assigned_model_id] || row.assigned_model_id;
      byId.set(row.assigned_model_id, label);
    }
    return [...byId.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [rows, modelLabelById]);

  const chatterOptions = React.useMemo(() => {
    const byId = new Map<string, string>();
    for (const row of rows) {
      if (!row.requested_by_chatter_id) continue;
      const label = row.requested_by_chatter_name || row.requested_by_chatter_id;
      byId.set(row.requested_by_chatter_id, label);
    }
    return [...byId.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [rows]);

  const stats = React.useMemo(() => {
    const typeCounts = { video: 0, photo: 0, custom: 0, other: 0 };
    return rows.reduce(
      (acc, row) => {
        if (row.admin_status === "pending") acc.pending += 1;
        if (row.admin_status === "accepted" && row.model_status === "waiting_schedule") acc.approved += 1;
        if (row.model_status === "scheduled") acc.scheduled += 1;
        if (row.model_status === "uploaded" || row.model_status === "completed") acc.completed += 1;
        const tk = normalizeTypeValue(row);
        acc.typeCounts[tk] += 1;
        return acc;
      },
      { pending: 0, approved: 0, scheduled: 0, completed: 0, typeCounts }
    );
  }, [rows]);

  const filteredRows = React.useMemo(() => {
    let out = [...rows];
    if (tab !== "all") {
      out = out.filter((r) => normalizeStatusValue(r) === tab);
    }
    if (statusFilter.length > 0) {
      const set = new Set(statusFilter);
      out = out.filter((r) => set.has(normalizeStatusValue(r)));
    }
    if (modelFilter !== "all") out = out.filter((r) => r.assigned_model_id === modelFilter);
    if (chatterFilter !== "all") out = out.filter((r) => r.requested_by_chatter_id === chatterFilter);
    if (typeFilter.length > 0) {
      const set = new Set(typeFilter);
      out = out.filter((r) => set.has(normalizeTypeValue(r)));
    }
    if (dateFrom.trim()) {
      out = out.filter((r) => (r.created_at ?? "").slice(0, 10) >= dateFrom.trim());
    }
    if (dateTo.trim()) {
      out = out.filter((r) => (r.created_at ?? "").slice(0, 10) <= dateTo.trim());
    }
    if (fanSearch.trim()) {
      const q = fanSearch.trim().toLowerCase();
      out = out.filter((r) => (r.fan_username || "").toLowerCase().includes(q));
    }
    out.sort((a, b) => {
      if (sortBy === "date_desc" || sortBy === "date_asc") {
        const tA = new Date(a.created_at || 0).getTime();
        const tB = new Date(b.created_at || 0).getTime();
        return sortBy === "date_desc" ? tB - tA : tA - tB;
      }
      if (sortBy === "priority_desc" || sortBy === "priority_asc") {
        const d = priorityWeight(b.priority) - priorityWeight(a.priority);
        return sortBy === "priority_desc" ? d : -d;
      }
      if (sortBy === "price_desc" || sortBy === "price_asc") {
        const d = parsePrice(b.price) - parsePrice(a.price);
        return sortBy === "price_desc" ? d : -d;
      }
      const d = statusSortWeight(a) - statusSortWeight(b);
      if (d !== 0) return d;
      return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
    });
    return out;
  }, [rows, tab, statusFilter, modelFilter, chatterFilter, typeFilter, dateFrom, dateTo, fanSearch, sortBy]);

  React.useEffect(() => {
    setSelectedIds((prev) => {
      const allowed = new Set(filteredRows.map((r) => r.id));
      return new Set([...prev].filter((id) => allowed.has(id)));
    });
  }, [filteredRows]);

  const allFilteredSelected = filteredRows.length > 0 && filteredRows.every((r) => selectedIds.has(r.id));

  const clearFilters = () => {
    setStatusFilter([]);
    setTypeFilter([]);
    setModelFilter("all");
    setChatterFilter("all");
    setDateFrom("");
    setDateTo("");
    setFanSearch("");
    setTab("pending");
  };

  const toggleSelected = (id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const toggleMultiSelect = <T extends string>(
    current: T[],
    value: T,
    set: React.Dispatch<React.SetStateAction<T[]>>
  ) => {
    if (current.includes(value)) set(current.filter((x) => x !== value));
    else set([...current, value]);
  };

  const onApproveOne = async (id: string) => {
    setBusyId(id);
    try {
      const res = await onApprove(id);
      if (!res.ok) {
        onToast("error", "Could not approve", res.error);
        return;
      }
      patchRow(id, { admin_status: "accepted" });
      onToast("success", "Approved", "Request moved to approved.");
      router.refresh();
    } finally {
      setBusyId(null);
    }
  };

  const submitDecline = async () => {
    if (!declineFor) return;
    setDeclineBusy(true);
    try {
      const res = await onDecline({ id: declineFor.id, decline_reason: declineReason });
      if (!res.ok) {
        onToast("error", "Could not decline", res.error);
        return;
      }
      patchRow(declineFor.id, { admin_status: "rejected", decline_reason: declineReason });
      setDeclineFor(null);
      setDeclineReason("");
      onToast("success", "Declined", "Request was declined successfully.");
      router.refresh();
    } finally {
      setDeclineBusy(false);
    }
  };

  const submitEdit = async () => {
    if (!editFor) return;
    setEditBusy(true);
    try {
      const res = await onEdit({
        id: editFor.id,
        request_details: editDesc,
        price: editPrice,
        deadline_requested: editDeadline.trim() ? editDeadline : null,
      });
      if (!res.ok) {
        onToast("error", "Could not update", res.error);
        return;
      }
      patchRow(editFor.id, {
        request_details: editDesc,
        price: editPrice,
        deadline_requested: editDeadline.trim() ? editDeadline : null,
      });
      setEditFor(null);
      onToast("success", "Updated", "Request changes were saved.");
      router.refresh();
    } finally {
      setEditBusy(false);
    }
  };

  const runBulkApprove = async () => {
    const ids = filteredRows.filter((r) => selectedIds.has(r.id) && r.admin_status === "pending").map((r) => r.id);
    if (ids.length === 0) {
      onToast("error", "No eligible requests", "Select pending requests to bulk approve.");
      return;
    }
    setBulkBusy(true);
    let ok = 0;
    for (const id of ids) {
      const res = await onApprove(id);
      if (res.ok) {
        ok += 1;
        patchRow(id, { admin_status: "accepted" });
      }
    }
    setBulkBusy(false);
    onToast("success", "Bulk approve finished", `${ok}/${ids.length} requests approved.`);
    router.refresh();
  };

  const runBulkDecline = async () => {
    const ids = filteredRows.filter((r) => selectedIds.has(r.id) && r.admin_status === "pending").map((r) => r.id);
    if (ids.length === 0) {
      onToast("error", "No eligible requests", "Select pending requests to bulk decline.");
      return;
    }
    const reason = "Bulk declined by agency review";
    setBulkBusy(true);
    let ok = 0;
    for (const id of ids) {
      const res = await onDecline({ id, decline_reason: reason });
      if (res.ok) {
        ok += 1;
        patchRow(id, { admin_status: "rejected", decline_reason: reason });
      }
    }
    setBulkBusy(false);
    onToast("success", "Bulk decline finished", `${ok}/${ids.length} requests declined.`);
    router.refresh();
  };

  const runBulkAssign = () => {
    if (!canAssignModel) {
      onToast(
        "error",
        "Bulk assign unavailable",
        assignModelDisabledReason ?? "No route is currently available for bulk model assignment."
      );
      return;
    }
  };

  const exportCsv = () => {
    const header = CSV_FIELDS.join(",");
    const lines = filteredRows.map((row) => CSV_FIELDS.map((field) => toCsvValue(row[field])).join(","));
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
    onToast("success", "Export ready", `Exported ${filteredRows.length} filtered requests.`);
  };

  const tabs: Array<{ key: ViewTab; label: string }> = [
    { key: "all", label: "All" },
    { key: "pending", label: "Pending" },
    { key: "approved", label: "Approved" },
    { key: "scheduled", label: "Scheduled" },
    { key: "uploaded", label: "Uploaded" },
    { key: "declined", label: "Declined" },
  ];

  const heroBorder = isVa ? "border-sky-400/25" : "border-pink-400/20";
  const heroBg = isVa
    ? "from-zinc-950 via-zinc-950 to-sky-950/25 shadow-[0_10px_40px_rgba(56,189,248,0.12)]"
    : "from-zinc-950 via-zinc-950 to-pink-950/20 shadow-[0_10px_40px_rgba(236,72,153,0.12)]";
  const statHover = isVa ? "hover:border-sky-300/45" : "hover:border-pink-300/40";
  const activeTab = isVa ? "border-sky-400/60 bg-sky-500/20 text-sky-100" : "border-pink-400/60 bg-pink-500/20 text-pink-100";
  const inactiveTab = "border-white/15 bg-white/5 text-white/70 hover:bg-white/10";
  const typeChipOn = isVa ? "border-sky-400/55 bg-sky-500/20 text-sky-100" : "border-pink-400/60 bg-pink-500/20 text-pink-100";
  const exportBtn = isVa ? "border-sky-500/40 bg-sky-500/15 text-sky-100 hover:bg-sky-500/25" : "border-pink-500/40 bg-pink-500/15 text-pink-100 hover:bg-pink-500/25";
  const saveEditBtn = isVa ? "border-sky-500/40 bg-sky-500/15 text-sky-100 hover:bg-sky-500/25" : "border-pink-500/40 bg-pink-500/15 text-pink-100 hover:bg-pink-500/25";
  const cardHover = isVa ? "hover:border-sky-300/40 hover:shadow-[0_0_0_1px_rgba(56,189,248,0.2)]" : "hover:border-pink-300/40 hover:shadow-[0_0_0_1px_rgba(236,72,153,0.2)]";

  return (
    <div className="space-y-6">
      <section className={`rounded-3xl border ${heroBorder} bg-gradient-to-br ${heroBg} p-6 transition-all`}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/40">
              {isVa ? "Virtual assistant" : "Administration"}
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-white">
              {hubTitle ?? "Custom requests"}
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-white/60">
              {hubSubtitle ??
                (isVa
                  ? "Review fan requests with the same tools as admin: filters, bulk actions, CSV export, and detail modals."
                  : "Manage fan custom content requests across models and chatters.")}
            </p>
          </div>
          {agencyWidePendingCount != null ? (
            <div
              className={`shrink-0 rounded-2xl border px-4 py-3 text-right ${
                isVa ? "border-sky-400/30 bg-sky-500/10" : "border-pink-400/30 bg-pink-500/10"
              }`}
            >
              <p className="text-[10px] font-semibold uppercase tracking-wide text-white/45">Agency pending queue</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-white">{agencyWidePendingCount}</p>
              <p className="text-[11px] text-white/50">rows awaiting first review</p>
            </div>
          ) : null}
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className={`rounded-2xl border border-white/10 bg-white/[0.03] p-4 transition ${statHover}`}>
            <p className="text-xs uppercase tracking-wide text-white/45">Pending</p>
            <p className="mt-2 text-2xl font-semibold text-white">{stats.pending}</p>
            <p className="text-xs text-white/50">in this list</p>
          </div>
          <div className={`rounded-2xl border border-white/10 bg-white/[0.03] p-4 transition ${statHover}`}>
            <p className="text-xs uppercase tracking-wide text-white/45">Approved</p>
            <p className="mt-2 text-2xl font-semibold text-white">{stats.approved}</p>
            <p className="text-xs text-white/50">waiting for model</p>
          </div>
          <div className={`rounded-2xl border border-white/10 bg-white/[0.03] p-4 transition ${statHover}`}>
            <p className="text-xs uppercase tracking-wide text-white/45">Scheduled</p>
            <p className="mt-2 text-2xl font-semibold text-white">{stats.scheduled}</p>
            <p className="text-xs text-white/50">model scheduled</p>
          </div>
          <div className={`rounded-2xl border border-white/10 bg-white/[0.03] p-4 transition ${statHover}`}>
            <p className="text-xs uppercase tracking-wide text-white/45">Completed</p>
            <p className="mt-2 text-2xl font-semibold text-white">{stats.completed}</p>
            <p className="text-xs text-white/50">uploaded</p>
          </div>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {(["video", "photo", "custom", "other"] as TypeFilterValue[]).map((t) => (
            <div
              key={t}
              className="flex items-center justify-between rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-sm"
            >
              <span className="text-white/55">{humanType(t)}</span>
              <span className="font-semibold tabular-nums text-white">{stats.typeCounts[t]}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-black/30 p-4">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
          <div>
            <label className="text-xs text-white/50">Status</label>
            <select
              multiple
              value={statusFilter}
              onChange={(e) => {
                const values = [...e.target.selectedOptions].map((o) => o.value as StatusFilterValue);
                setStatusFilter(values);
              }}
              className="mt-1 h-24 w-full rounded-xl border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-white"
            >
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="declined">Declined</option>
              <option value="scheduled">Scheduled</option>
              <option value="uploaded">Uploaded</option>
            </select>
          </div>

          <div>
            <label className="text-xs text-white/50">Model</label>
            <select
              value={modelFilter}
              onChange={(e) => setModelFilter(e.target.value)}
              className="mt-1 w-full rounded-xl border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-white"
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
            <label className="text-xs text-white/50">Chatter</label>
            <select
              value={chatterFilter}
              onChange={(e) => setChatterFilter(e.target.value)}
              className="mt-1 w-full rounded-xl border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-white"
            >
              <option value="all">All chatters</option>
              {chatterOptions.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs text-white/50">Type</label>
            <div className="mt-1 flex flex-wrap gap-2">
              {(["video", "photo", "custom", "other"] as TypeFilterValue[]).map((t) => {
                const active = typeFilter.includes(t);
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => toggleMultiSelect(typeFilter, t, setTypeFilter)}
                    className={`rounded-lg border px-2.5 py-1 text-xs transition ${
                      active ? typeChipOn : "border-white/15 bg-white/5 text-white/70 hover:bg-white/10"
                    }`}
                  >
                    {humanType(t)}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="text-xs text-white/50">Date range</label>
            <div className="mt-1 flex items-center gap-2">
              <FormInput type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-full" />
              <FormInput type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-full" />
            </div>
          </div>

          <div>
            <label className="text-xs text-white/50">Fan username</label>
            <FormInput
              value={fanSearch}
              onChange={(e) => setFanSearch(e.target.value)}
              placeholder="Search fan..."
              className="mt-1 w-full"
            />
            <button
              type="button"
              onClick={clearFilters}
              className="mt-2 rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs text-white/75 hover:bg-white/10"
            >
              Clear filters
            </button>
          </div>
        </div>
      </section>

      <section className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`rounded-xl border px-3 py-2 text-sm transition ${
                tab === t.key
                  ? "border-pink-400/60 bg-pink-500/20 text-pink-100"
                  : "border-white/15 bg-white/5 text-white/70 hover:bg-white/10"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-white/50">Sort</label>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
            className="rounded-xl border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-white"
          >
            <option value="date_desc">Date newest</option>
            <option value="date_asc">Date oldest</option>
            <option value="priority_desc">Priority high-low</option>
            <option value="priority_asc">Priority low-high</option>
            <option value="price_desc">Price high-low</option>
            <option value="price_asc">Price low-high</option>
            <option value="status">Status</option>
          </select>
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={bulkBusy}
            onClick={() => void runBulkApprove()}
            className="rounded-lg border border-emerald-500/40 bg-emerald-500/15 px-3 py-2 text-sm text-emerald-100 hover:bg-emerald-500/25 disabled:opacity-50"
          >
            Bulk approve
          </button>
          <button
            type="button"
            disabled={bulkBusy}
            onClick={() => void runBulkDecline()}
            className="rounded-lg border border-rose-500/40 bg-rose-500/15 px-3 py-2 text-sm text-rose-100 hover:bg-rose-500/25 disabled:opacity-50"
          >
            Bulk decline
          </button>
          <button
            type="button"
            disabled={!canAssignModel}
            onClick={runBulkAssign}
            className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white/80 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
            title={!canAssignModel ? assignModelDisabledReason ?? "Bulk assign not available." : "Assign selected requests"}
          >
            Bulk assign to model
          </button>
          <button
            type="button"
            onClick={exportCsv}
            className={`rounded-lg border px-3 py-2 text-sm ${exportBtn}`}
          >
            Export CSV
          </button>
          <p className="ml-auto text-xs text-white/45">
            {selectedIds.size} selected · {filteredRows.length} shown
          </p>
        </div>

        {filteredRows.length === 0 ? (
          <p className="rounded-xl border border-white/10 bg-black/30 p-8 text-center text-sm text-white/50">
            No matching requests
          </p>
        ) : (
          <div className="space-y-3">
            <label className="mb-2 inline-flex items-center gap-2 text-xs text-white/60">
              <input
                type="checkbox"
                checked={allFilteredSelected}
                onChange={(e) => {
                  const checked = e.target.checked;
                  if (checked) setSelectedIds(new Set(filteredRows.map((r) => r.id)));
                  else setSelectedIds(new Set());
                }}
              />
              Select all filtered
            </label>

            {filteredRows.map((row) => {
              const status = normalizeStatusValue(row);
              const type = normalizeTypeValue(row);
              const isAccepted = row.admin_status === "accepted";
              return (
                <article
                  key={row.id}
                  className="rounded-2xl border border-white/10 bg-zinc-950/70 p-4 transition-all duration-200 hover:border-pink-300/40 hover:shadow-[0_0_0_1px_rgba(236,72,153,0.2)]"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(row.id)}
                        onChange={(e) => toggleSelected(row.id, e.target.checked)}
                      />
                      <span className="rounded-lg border border-white/15 bg-white/5 px-2 py-0.5 text-xs text-white/85">
                        {humanType(type)}
                      </span>
                      <span className="rounded-lg border border-white/15 bg-white/5 px-2 py-0.5 text-xs text-white/85">
                        {row.priority ? row.priority : "normal"} priority
                      </span>
                      <span className={`rounded-lg border px-2 py-0.5 text-xs ${statusBadgeClass(status)}`}>
                        {humanStatus(status)}
                      </span>
                    </div>
                    <p className="text-xs text-white/45">{formatDateTimeEuropean(row.created_at)}</p>
                  </div>

                  <div className="mt-3 grid gap-2 text-sm text-white/80 md:grid-cols-2">
                    <p>
                      <span className="text-white/50">Fan:</span> {row.fan_username || "—"}
                    </p>
                    <p>
                      <span className="text-white/50">Price:</span> {row.price || "—"}
                    </p>
                    <p>
                      <span className="text-white/50">Model:</span>{" "}
                      {row.assigned_model_name || modelLabelById[row.assigned_model_id] || "—"}
                    </p>
                    <p>
                      <span className="text-white/50">Chatter:</span> {row.requested_by_chatter_name || "—"}
                    </p>
                  </div>

                  <p className="mt-3 text-sm text-white/90">{row.request_details || "—"}</p>

                  {isAccepted ? (
                    <div className="mt-3 rounded-xl border border-sky-400/25 bg-sky-500/10 p-3 text-xs text-sky-100">
                      <p>
                        <span className="font-medium">Model status:</span> {modelStatusLabelEn(row.model_status)}
                      </p>
                      {row.model_status === "scheduled" ? (
                        <p className="mt-1">
                          <span className="font-medium">Scheduled:</span> {formatScheduleLine(row)}
                        </p>
                      ) : null}
                    </div>
                  ) : null}

                  <div className="mt-4 flex flex-wrap gap-2">
                    {row.admin_status === "pending" ? (
                      <>
                        <button
                          type="button"
                          disabled={busyId === row.id}
                          onClick={() => void onApproveOne(row.id)}
                          className="rounded-lg border border-emerald-500/40 bg-emerald-500/15 px-3 py-2 text-xs font-medium text-emerald-100 hover:bg-emerald-500/25 disabled:opacity-50"
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setDeclineFor(row);
                            setDeclineReason("");
                          }}
                          className="rounded-lg border border-rose-500/40 bg-rose-500/15 px-3 py-2 text-xs font-medium text-rose-100 hover:bg-rose-500/25"
                        >
                          Decline
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditFor(row)}
                          className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-xs font-medium text-white/80 hover:bg-white/10"
                        >
                          Edit
                        </button>
                      </>
                    ) : row.admin_status === "accepted" ? (
                      <>
                        <button
                          type="button"
                          onClick={() => setEditFor(row)}
                          className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-xs font-medium text-white/80 hover:bg-white/10"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => setDetail(row)}
                          className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-xs font-medium text-white/80 hover:bg-white/10"
                        >
                          View details
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setDetail(row)}
                        className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-xs font-medium text-white/80 hover:bg-white/10"
                      >
                        View details
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

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

      {declineFor ? (
        <ModalFrame title="Decline custom request" onClose={() => !declineBusy && setDeclineFor(null)}>
          <div>
            <Label htmlFor="decline-reason">Decline reason</Label>
            <Textarea
              id="decline-reason"
              value={declineReason}
              onChange={(e) => setDeclineReason(e.target.value)}
              className="mt-1 min-h-[120px] border-white/10 bg-black/30 text-white"
              placeholder="Explain why this request cannot proceed..."
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              disabled={declineBusy}
              onClick={() => setDeclineFor(null)}
              className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white/80 hover:bg-white/10"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={declineBusy || !declineReason.trim()}
              onClick={() => void submitDecline()}
              className="rounded-lg border border-rose-500/40 bg-rose-500/15 px-3 py-2 text-sm font-medium text-rose-100 hover:bg-rose-500/25 disabled:opacity-50"
            >
              {declineBusy ? "Saving..." : "Decline request"}
            </button>
          </div>
        </ModalFrame>
      ) : null}

      {editFor ? (
        <ModalFrame title="Edit custom request" onClose={() => !editBusy && setEditFor(null)}>
          <div>
            <Label htmlFor="edit-desc">Description</Label>
            <Textarea
              id="edit-desc"
              value={editDesc}
              onChange={(e) => setEditDesc(e.target.value)}
              className="mt-1 min-h-[110px] border-white/10 bg-black/30 text-white"
            />
          </div>
          <div>
            <Label htmlFor="edit-price">Price</Label>
            <FormInput id="edit-price" value={editPrice} onChange={(e) => setEditPrice(e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label htmlFor="edit-deadline">Deadline</Label>
            <FormInput
              id="edit-deadline"
              type="datetime-local"
              value={editDeadline}
              onChange={(e) => setEditDeadline(e.target.value)}
              className="mt-1"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              disabled={editBusy}
              onClick={() => setEditFor(null)}
              className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white/80 hover:bg-white/10"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={editBusy}
              onClick={() => void submitEdit()}
              className={`rounded-lg border px-3 py-2 text-sm font-medium disabled:opacity-50 ${saveEditBtn}`}
            >
              {editBusy ? "Saving..." : "Save changes"}
            </button>
          </div>
        </ModalFrame>
      ) : null}
    </div>
  );
}
