"use client";

import * as React from "react";
import { CheckSquare, Keyboard, Pencil, Search, Trash2, X } from "lucide-react";
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

type StatusTab = "to_review" | "approved" | "rejected" | "all";
type MethodFilter = "all" | FineBonusPaymentMethod;
type SourceFilter = "all" | "manual" | "spin_wheel" | "chatter_submission";

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

function paymentMethodLabel(entry: FineBonusRecord) {
  if (entry.payment_method === "Other" && entry.payment_source?.trim()) {
    return entry.payment_source.trim();
  }
  return entry.payment_method || "—";
}

function displayScreenshotUrl(entry: FineBonusRecord | null | undefined): string | null {
  if (!entry) return null;
  const signed = entry.screenshot_signed_url?.trim();
  if (signed && !signed.startsWith("sb://")) return signed;
  const raw = entry.screenshot_url?.trim();
  if (raw && raw.startsWith("http")) return raw;
  return null;
}

function hasScreenshotToken(entry: FineBonusRecord): boolean {
  return Boolean(entry.screenshot_url?.trim() || entry.screenshot_signed_url?.trim());
}

function isTypingTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (el.isContentEditable) return true;
  return Boolean(el.closest("[contenteditable='true']"));
}

function preloadImage(url: string | null | undefined) {
  if (!url || url.startsWith("sb://")) return;
  const img = new Image();
  img.src = url;
}

function mergeReviewedEntry(prev: FineBonusRecord, next: FineBonusRecord): FineBonusRecord {
  return {
    ...next,
    screenshot_signed_url: next.screenshot_signed_url || prev.screenshot_signed_url,
    screenshot_url: next.screenshot_url || prev.screenshot_url,
  };
}

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

function ScreenshotBlock({
  entry,
  large,
  onZoom,
  onRetry,
  retrying,
}: {
  entry: FineBonusRecord;
  large?: boolean;
  onZoom: (url: string) => void;
  onRetry: () => void;
  retrying?: boolean;
}) {
  const url = displayScreenshotUrl(entry);
  if (url) {
    return (
      <button
        type="button"
        onClick={() => onZoom(url)}
        className={`block w-full overflow-hidden rounded-xl border border-white/10 bg-black/40 transition-colors hover:border-pink-500/30 ${
          large ? "" : ""
        }`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt="Payment screenshot"
          className={large ? "max-h-[min(70vh,560px)] w-full object-contain" : "max-h-64 w-full object-contain"}
        />
      </button>
    );
  }
  if (hasScreenshotToken(entry)) {
    return (
      <div className="rounded-xl border border-dashed border-white/15 bg-white/[0.03] px-4 py-8 text-center">
        <p className="text-sm text-white/50">Screenshot unavailable</p>
        <button
          type="button"
          disabled={retrying}
          onClick={onRetry}
          className="mt-3 rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/70 hover:bg-white/10 disabled:opacity-50"
        >
          {retrying ? "Retrying…" : "Retry"}
        </button>
      </div>
    );
  }
  return <p className="text-sm text-white/50">No screenshot provided</p>;
}

export function AdminFinesBonusesClient({
  initialEntries,
  userOptions,
  modelOptions = [],
  isAdmin = false,
}: Props) {
  const [rows, setRows] = React.useState(initialEntries);
  const [statusTab, setStatusTab] = React.useState<StatusTab>("to_review");
  const [userFilter, setUserFilter] = React.useState("all");
  const [modelFilter, setModelFilter] = React.useState("all");
  const [methodFilter, setMethodFilter] = React.useState<MethodFilter>("all");
  const [roleFilter, setRoleFilter] = React.useState<"all" | FineBonusUserRole>("all");
  const [typeFilter, setTypeFilter] = React.useState<"all" | FineBonusType>("all");
  const [sourceFilter, setSourceFilter] = React.useState<SourceFilter>("all");
  const [monthFilter, setMonthFilter] = React.useState("");
  const [amountMin, setAmountMin] = React.useState("");
  const [amountMax, setAmountMax] = React.useState("");
  const [search, setSearch] = React.useState("");
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());
  const [rejectReason, setRejectReason] = React.useState("");
  const [showRejectReason, setShowRejectReason] = React.useState(false);
  const [reviewPending, setReviewPending] = React.useState(false);
  const [bulkPending, setBulkPending] = React.useState(false);
  const [signRetryPending, setSignRetryPending] = React.useState(false);
  const [lightboxUrl, setLightboxUrl] = React.useState<string | null>(null);
  const [showShortcuts, setShowShortcuts] = React.useState(false);
  const [editEntry, setEditEntry] = React.useState<FineBonusRecord | null>(null);
  const [editType, setEditType] = React.useState<FineBonusType>("bonus");
  const [editAmount, setEditAmount] = React.useState("");
  const [editReason, setEditReason] = React.useState("");
  const [editMonth, setEditMonth] = React.useState("");
  const [editNotes, setEditNotes] = React.useState("");
  const [editPending, setEditPending] = React.useState(false);
  const [deleteEntry, setDeleteEntry] = React.useState<FineBonusRecord | null>(null);
  const [deletePending, setDeletePending] = React.useState(false);
  const rejectInputRef = React.useRef<HTMLTextAreaElement | null>(null);

  const pendingCount = React.useMemo(
    () => rows.filter(isPendingExtraRevenueReview).length,
    [rows]
  );

  const monthOptions = React.useMemo(() => {
    const s = new Set<string>();
    rows.forEach((r) => {
      if (r.month && /^\d{4}-\d{2}$/.test(r.month)) s.add(r.month);
    });
    return [...s].sort((a, b) => b.localeCompare(a));
  }, [rows]);

  const applyCommonFilters = React.useCallback(
    (list: FineBonusRecord[]) => {
      const q = search.trim().toLowerCase();
      const min = amountMin.trim() === "" ? null : Number.parseFloat(amountMin);
      const max = amountMax.trim() === "" ? null : Number.parseFloat(amountMax);
      return list.filter((r) => {
        if (userFilter !== "all" && r.user_id !== userFilter) return false;
        if (modelFilter !== "all" && r.model_id !== modelFilter) return false;
        if (methodFilter !== "all" && r.payment_method !== methodFilter) return false;
        if (roleFilter !== "all" && r.user_role !== roleFilter) return false;
        if (typeFilter !== "all" && r.type !== typeFilter) return false;
        if (sourceFilter === "spin_wheel" && !isSpinWheelFineBonus(r)) return false;
        if (sourceFilter === "chatter_submission" && !isChatterExtraRevenueSubmission(r)) return false;
        if (sourceFilter === "manual" && (isSpinWheelFineBonus(r) || isChatterExtraRevenueSubmission(r))) {
          return false;
        }
        if (monthFilter && r.month !== monthFilter) return false;
        if (min != null && Number.isFinite(min) && r.amount < min) return false;
        if (max != null && Number.isFinite(max) && r.amount > max) return false;
        if (
          q &&
          !r.reason.toLowerCase().includes(q) &&
          !r.model_name?.toLowerCase().includes(q) &&
          !r.user_name.toLowerCase().includes(q) &&
          !r.sub_username?.toLowerCase().includes(q)
        ) {
          return false;
        }
        return true;
      });
    },
    [
      search,
      amountMin,
      amountMax,
      userFilter,
      modelFilter,
      methodFilter,
      roleFilter,
      typeFilter,
      sourceFilter,
      monthFilter,
    ]
  );

  const toReviewList = React.useMemo(() => {
    return applyCommonFilters(rows.filter(isPendingExtraRevenueReview)).sort((a, b) =>
      a.created_at.localeCompare(b.created_at)
    );
  }, [rows, applyCommonFilters]);

  const approvedList = React.useMemo(() => {
    return applyCommonFilters(
      rows.filter((r) => isChatterExtraRevenueSubmission(r) && r.status === "approved")
    ).sort((a, b) => b.created_at.localeCompare(a.created_at));
  }, [rows, applyCommonFilters]);

  const rejectedList = React.useMemo(() => {
    return applyCommonFilters(
      rows.filter((r) => isChatterExtraRevenueSubmission(r) && r.status === "rejected")
    ).sort((a, b) => b.created_at.localeCompare(a.created_at));
  }, [rows, applyCommonFilters]);

  const allFiltered = React.useMemo(() => {
    return applyCommonFilters(rows).sort((a, b) => b.created_at.localeCompare(a.created_at));
  }, [rows, applyCommonFilters]);

  const reviewQueue = React.useMemo(() => {
    if (statusTab === "to_review") return toReviewList;
    if (statusTab === "approved") return approvedList;
    if (statusTab === "rejected") return rejectedList;
    return [];
  }, [statusTab, toReviewList, approvedList, rejectedList]);

  const selectedEntry = React.useMemo(() => {
    if (!selectedId) return null;
    return reviewQueue.find((r) => r.id === selectedId) ?? rows.find((r) => r.id === selectedId) ?? null;
  }, [selectedId, reviewQueue, rows]);

  const selectedIndex = React.useMemo(() => {
    if (!selectedId) return -1;
    return reviewQueue.findIndex((r) => r.id === selectedId);
  }, [selectedId, reviewQueue]);

  React.useEffect(() => {
    if (statusTab === "all") return;
    if (reviewQueue.length === 0) {
      setSelectedId(null);
      return;
    }
    if (!selectedId || !reviewQueue.some((r) => r.id === selectedId)) {
      setSelectedId(reviewQueue[0]!.id);
    }
  }, [statusTab, reviewQueue, selectedId]);

  React.useEffect(() => {
    setSelectedIds(new Set());
    setShowRejectReason(false);
    setRejectReason("");
  }, [statusTab]);

  // Preload next item's signed screenshot
  React.useEffect(() => {
    if (selectedIndex < 0) return;
    const next = reviewQueue[selectedIndex + 1];
    if (next) preloadImage(displayScreenshotUrl(next));
  }, [selectedIndex, reviewQueue]);

  const {
    page,
    setPage,
    totalPages,
    paginated: paginatedEntries,
    reset,
  } = usePagination(allFiltered, 20);

  React.useEffect(() => {
    reset();
  }, [
    userFilter,
    modelFilter,
    methodFilter,
    roleFilter,
    typeFilter,
    sourceFilter,
    monthFilter,
    amountMin,
    amountMax,
    search,
    reset,
  ]);

  const groupedPage = React.useMemo(() => groupByMonth(paginatedEntries), [paginatedEntries]);

  const stats = React.useMemo(() => {
    let bonuses = 0;
    let fines = 0;
    const people = new Set<string>();
    for (const r of allFiltered) {
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
  }, [allFiltered]);

  function selectAt(index: number) {
    const entry = reviewQueue[index];
    if (!entry) return;
    setSelectedId(entry.id);
    setShowRejectReason(false);
    setRejectReason("");
  }

  function selectNext() {
    if (selectedIndex < 0) {
      if (reviewQueue[0]) selectAt(0);
      return;
    }
    if (selectedIndex < reviewQueue.length - 1) selectAt(selectedIndex + 1);
  }

  function selectPrev() {
    if (selectedIndex <= 0) return;
    selectAt(selectedIndex - 1);
  }

  function advanceAfterReview(reviewedId: string) {
    const idx = toReviewList.findIndex((r) => r.id === reviewedId);
    const remaining = toReviewList.filter((r) => r.id !== reviewedId);
    if (remaining.length === 0) {
      setSelectedId(null);
      return;
    }
    const next = remaining[Math.min(idx, remaining.length - 1)] ?? remaining[0];
    setSelectedId(next!.id);
    setShowRejectReason(false);
    setRejectReason("");
  }

  async function refreshSignedUrls() {
    setSignRetryPending(true);
    try {
      const res = await fetch("/api/admin/fines-bonuses");
      const data = (await res.json()) as { entries?: FineBonusRecord[]; error?: string };
      if (!res.ok || !data.entries) {
        toast.error(typeof data.error === "string" ? data.error : "Could not refresh screenshots");
        return;
      }
      setRows(data.entries);
      toast.success("Screenshots refreshed");
    } catch {
      toast.error("Could not refresh screenshots");
    } finally {
      setSignRetryPending(false);
    }
  }

  async function revertApprovals(ids: string[]) {
    const unique = [...new Set(ids.filter(Boolean))];
    if (unique.length === 0) return;
    const restored: FineBonusRecord[] = [];
    for (const id of unique) {
      try {
        const res = await fetch(`/api/admin/fines-bonuses/${id}/review`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "revert" }),
        });
        const data = (await res.json()) as { error?: string; entry?: FineBonusRecord };
        if (!res.ok || !data.entry) {
          toast.error(typeof data.error === "string" ? data.error : "Undo failed");
          continue;
        }
        restored.push(data.entry);
      } catch {
        toast.error("Undo failed");
      }
    }
    if (restored.length === 0) return;
    setRows((prev) => {
      const byId = new Map(restored.map((e) => [e.id, e]));
      return prev.map((row) => {
        const next = byId.get(row.id);
        return next ? mergeReviewedEntry(row, next) : row;
      });
    });
    if (statusTab === "to_review" && restored[0]) {
      setSelectedId(restored[0].id);
    }
    toast.success(
      restored.length === 1 ? "Approval undone" : `Undid ${restored.length} approvals`
    );
  }

  function showApproveUndoToast(ids: string[], label: string) {
    toast.success(label, {
      duration: 5000,
      description: "Chatter already notified — Undo sends a correction",
      action: {
        label: "Undo",
        onClick: () => {
          void revertApprovals(ids);
        },
      },
    });
  }

  async function submitReview(action: "approve" | "reject", entry?: FineBonusRecord | null) {
    const target = entry ?? selectedEntry;
    if (!target || !isPendingExtraRevenueReview(target)) return;
    if (action === "reject" && !rejectReason.trim()) {
      toast.error("Reject reason is required");
      setShowRejectReason(true);
      queueMicrotask(() => rejectInputRef.current?.focus());
      return;
    }
    setReviewPending(true);
    try {
      const res = await fetch(`/api/admin/fines-bonuses/${target.id}/review`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          ...(action === "reject" ? { reject_reason: rejectReason.trim() } : {}),
        }),
      });
      const data = (await res.json()) as { error?: string; entry?: FineBonusRecord };
      if (!res.ok || !data.entry) {
        toast.error(typeof data.error === "string" ? data.error : "Review failed");
        return;
      }
      const reviewedId = target.id;
      setRows((prev) => prev.map((r) => (r.id === data.entry!.id ? mergeReviewedEntry(r, data.entry!) : r)));
      if (action === "approve") {
        showApproveUndoToast([reviewedId], "Submission approved");
      } else {
        toast.success("Submission rejected");
      }
      if (statusTab === "to_review") {
        advanceAfterReview(reviewedId);
      }
    } finally {
      setReviewPending(false);
    }
  }

  async function bulkApprove() {
    const ids = [...selectedIds].filter((id) => toReviewList.some((r) => r.id === id));
    if (ids.length === 0) {
      toast.error("Select at least one pending item");
      return;
    }
    if (ids.length > 50) {
      toast.error("Max 50 items per bulk approve");
      return;
    }
    setBulkPending(true);
    try {
      const res = await fetch("/api/admin/fines-bonuses/review-bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      const data = (await res.json()) as {
        error?: string | Record<string, unknown>;
        approved?: number;
        failed?: number;
        results?: Array<{ id: string; success: boolean; error?: string; entry?: FineBonusRecord }>;
      };
      if (!res.ok) {
        toast.error(typeof data.error === "string" ? data.error : "Bulk approve failed");
        return;
      }
      const byId = new Map((data.results ?? []).map((r) => [r.id, r]));
      const successIds = (data.results ?? []).filter((r) => r.success).map((r) => r.id);
      setRows((prev) =>
        prev.map((row) => {
          const result = byId.get(row.id);
          if (result?.success && result.entry) return mergeReviewedEntry(row, result.entry);
          return row;
        })
      );
      setSelectedIds(new Set());
      const approved = data.approved ?? 0;
      const failed = data.failed ?? 0;
      if (failed > 0 && approved === 0) {
        toast.error(`Approved 0, failed ${failed}`);
      } else if (failed > 0) {
        showApproveUndoToast(
          successIds,
          `Approved ${approved}, failed ${failed}`
        );
      } else {
        showApproveUndoToast(
          successIds,
          `Approved ${approved} submission${approved === 1 ? "" : "s"}`
        );
      }
      if (selectedId && ids.includes(selectedId)) {
        advanceAfterReview(selectedId);
      }
    } finally {
      setBulkPending(false);
    }
  }

  function toggleSelected(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAllVisible() {
    const ids = toReviewList.map((r) => r.id);
    const allSelected = ids.length > 0 && ids.every((id) => selectedIds.has(id));
    if (allSelected) {
      setSelectedIds(new Set());
      return;
    }
    setSelectedIds(new Set(ids.slice(0, 50)));
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
      setRows((prev) => prev.map((r) => (r.id === data.entry!.id ? mergeReviewedEntry(r, data.entry!) : r)));
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

  React.useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (lightboxUrl) {
        if (e.key === "Escape") {
          e.preventDefault();
          setLightboxUrl(null);
        }
        return;
      }
      if (editEntry || deleteEntry) return;
      if (statusTab === "all") return;
      if (isTypingTarget(e.target) && e.key !== "Escape") return;

      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (key === "j" || key === "ArrowDown") {
        e.preventDefault();
        selectNext();
        return;
      }
      if (key === "k" || key === "ArrowUp") {
        e.preventDefault();
        selectPrev();
        return;
      }
      if (key === "a" && statusTab === "to_review" && selectedEntry && isPendingExtraRevenueReview(selectedEntry)) {
        e.preventDefault();
        if (!reviewPending) void submitReview("approve");
        return;
      }
      if (key === "r" && statusTab === "to_review" && selectedEntry && isPendingExtraRevenueReview(selectedEntry)) {
        e.preventDefault();
        setShowRejectReason(true);
        queueMicrotask(() => rejectInputRef.current?.focus());
        return;
      }
      if ((key === "z" || key === "Enter") && selectedEntry) {
        const url = displayScreenshotUrl(selectedEntry);
        if (url) {
          e.preventDefault();
          setLightboxUrl(url);
        }
        return;
      }
      if (key === "Escape") {
        if (showRejectReason) {
          e.preventDefault();
          setShowRejectReason(false);
        }
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- handlers read latest state via closures on each render
  }, [
    lightboxUrl,
    editEntry,
    deleteEntry,
    statusTab,
    selectedEntry,
    reviewPending,
    showRejectReason,
    reviewQueue,
    selectedIndex,
  ]);

  const tabs: Array<{ id: StatusTab; label: string; count?: number }> = [
    { id: "to_review", label: "To review", count: pendingCount },
    { id: "approved", label: "Approved" },
    { id: "rejected", label: "Rejected" },
    { id: "all", label: "All" },
  ];

  const canReviewSelected =
    statusTab === "to_review" && selectedEntry != null && isPendingExtraRevenueReview(selectedEntry);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white">Fines &amp; bonuses</h1>
          <p className="mt-1 text-sm text-white/50">Review extra revenue and manage issued entries.</p>
        </div>
        <button
          type="button"
          onClick={() => setShowShortcuts((v) => !v)}
          className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-white/60 hover:bg-white/10 hover:text-white/80"
        >
          <Keyboard className="h-3.5 w-3.5" />
          Shortcuts
        </button>
      </div>

      {showShortcuts ? (
        <div className="glass-card flex flex-wrap gap-x-5 gap-y-2 px-4 py-3 text-xs text-white/55">
          <span>
            <kbd className="rounded border border-white/15 bg-white/5 px-1.5 py-0.5 text-white/80">J</kbd>/
            <kbd className="rounded border border-white/15 bg-white/5 px-1.5 py-0.5 text-white/80">↓</kbd> next
          </span>
          <span>
            <kbd className="rounded border border-white/15 bg-white/5 px-1.5 py-0.5 text-white/80">K</kbd>/
            <kbd className="rounded border border-white/15 bg-white/5 px-1.5 py-0.5 text-white/80">↑</kbd> prev
          </span>
          <span>
            <kbd className="rounded border border-white/15 bg-white/5 px-1.5 py-0.5 text-white/80">A</kbd> approve
          </span>
          <span>
            <kbd className="rounded border border-white/15 bg-white/5 px-1.5 py-0.5 text-white/80">R</kbd> reject
          </span>
          <span>
            <kbd className="rounded border border-white/15 bg-white/5 px-1.5 py-0.5 text-white/80">Z</kbd>/
            <kbd className="rounded border border-white/15 bg-white/5 px-1.5 py-0.5 text-white/80">Enter</kbd> zoom
          </span>
          <span>
            <kbd className="rounded border border-white/15 bg-white/5 px-1.5 py-0.5 text-white/80">Esc</kbd> close zoom
          </span>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-1 rounded-xl border border-white/10 bg-white/[0.03] p-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setStatusTab(tab.id)}
            className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${
              statusTab === tab.id ? "bg-white/10 text-white" : "text-white/50 hover:text-white/80"
            }`}
          >
            {tab.label}
            {typeof tab.count === "number" ? (
              <span
                className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums ${
                  tab.count > 0 ? "bg-yellow-500/20 text-yellow-200" : "bg-white/10 text-white/40"
                }`}
              >
                {tab.count}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      <div className="glass-card flex flex-wrap gap-2 p-3">
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
        <FormInput
          type="number"
          min={0}
          step="0.01"
          value={amountMin}
          onChange={(e) => setAmountMin(e.target.value)}
          placeholder="Min €"
          className="!h-10 !w-24"
        />
        <FormInput
          type="number"
          min={0}
          step="0.01"
          value={amountMax}
          onChange={(e) => setAmountMax(e.target.value)}
          placeholder="Max €"
          className="!h-10 !w-24"
        />
        {statusTab === "all" ? (
          <>
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
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value as SourceFilter)}
              className="min-h-10 rounded-xl border border-white/10 bg-white/[0.04] px-3 text-sm text-white"
            >
              <option value="all">All sources</option>
              <option value="manual">Manual</option>
              <option value="spin_wheel">Spin Wheel</option>
              <option value="chatter_submission">Chatter submissions</option>
            </select>
          </>
        ) : null}
        <div className="relative min-w-[180px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
          <FormInput
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search…"
            className="!h-10 !pl-9"
          />
        </div>
      </div>

      {statusTab !== "all" ? (
        <div className="grid gap-4 lg:grid-cols-[minmax(280px,380px)_minmax(0,1fr)]">
          <div className="glass-card flex max-h-[calc(100vh-220px)] flex-col overflow-hidden">
            {statusTab === "to_review" ? (
              <div className="flex items-center gap-2 border-b border-white/10 px-3 py-2">
                <button
                  type="button"
                  onClick={toggleSelectAllVisible}
                  className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[11px] font-medium text-white/60 hover:bg-white/10"
                >
                  {toReviewList.length > 0 && toReviewList.every((r) => selectedIds.has(r.id))
                    ? "Clear"
                    : "Select all"}
                </button>
                <button
                  type="button"
                  disabled={bulkPending || selectedIds.size === 0}
                  onClick={() => void bulkApprove()}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-green-500/30 bg-green-500/15 px-2.5 py-1 text-[11px] font-semibold text-green-200 hover:bg-green-500/25 disabled:opacity-40"
                >
                  <CheckSquare className="h-3 w-3" />
                  Approve selected{selectedIds.size > 0 ? ` (${selectedIds.size})` : ""}
                </button>
              </div>
            ) : null}
            <div className="flex-1 overflow-y-auto">
              {reviewQueue.length === 0 ? (
                <p className="px-4 py-10 text-center text-sm text-white/40">No items in this tab.</p>
              ) : (
                <ul className="divide-y divide-white/[0.06]">
                  {reviewQueue.map((entry) => {
                    const active = entry.id === selectedId;
                    return (
                      <li key={entry.id}>
                        <div
                          className={`flex items-stretch gap-2 px-2 py-2 transition-colors ${
                            active ? "bg-pink-500/10" : "hover:bg-white/[0.04]"
                          }`}
                        >
                          {statusTab === "to_review" ? (
                            <label className="flex items-center px-1">
                              <input
                                type="checkbox"
                                checked={selectedIds.has(entry.id)}
                                onChange={() => toggleSelected(entry.id)}
                                className="h-4 w-4 rounded border-white/20 bg-transparent"
                                aria-label={`Select ${entry.user_name}`}
                              />
                            </label>
                          ) : null}
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedId(entry.id);
                              setShowRejectReason(false);
                              setRejectReason("");
                            }}
                            className="min-w-0 flex-1 px-1 py-1 text-left"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="truncate text-sm font-medium text-white">{entry.user_name}</p>
                                <p className="truncate text-xs text-white/50">{entry.model_name || "—"}</p>
                              </div>
                              <p className="shrink-0 text-sm font-bold tabular-nums text-green-400">
                                €{entry.amount.toFixed(2)}
                              </p>
                            </div>
                            <p className="mt-1 text-[11px] text-white/35" title={formatDateTimeEuropean(entry.created_at) || undefined}>
                              {formatRelativeTime(entry.created_at)} · {paymentMethodLabel(entry)}
                            </p>
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>

          <div className="glass-card min-h-[420px] p-4 md:p-5">
            {!selectedEntry ? (
              <p className="py-16 text-center text-sm text-white/40">Select an item to review.</p>
            ) : (
              <div className="space-y-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-white/40">Screenshot</p>
                  <div className="mt-2">
                    <ScreenshotBlock
                      entry={selectedEntry}
                      large
                      onZoom={setLightboxUrl}
                      onRetry={() => void refreshSignedUrls()}
                      retrying={signRetryPending}
                    />
                  </div>
                </div>

                <dl className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wider text-white/40">Amount</dt>
                    <dd className="mt-0.5 text-xl font-bold tabular-nums text-green-400">
                      €{selectedEntry.amount.toFixed(2)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wider text-white/40">Payment method</dt>
                    <dd className="mt-0.5 text-white/80">{paymentMethodLabel(selectedEntry)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wider text-white/40">Chatter</dt>
                    <dd className="mt-0.5 font-medium text-white">{selectedEntry.user_name}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wider text-white/40">Model</dt>
                    <dd className="mt-0.5 font-medium text-white">{selectedEntry.model_name || "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wider text-white/40">Sub username</dt>
                    <dd className="mt-0.5 font-medium text-white">
                      {selectedEntry.sub_username ? `@${selectedEntry.sub_username}` : "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wider text-white/40">Submitted</dt>
                    <dd className="mt-0.5 text-white/80">
                      {formatDateTimeEuropean(selectedEntry.created_at) || "—"}
                    </dd>
                  </div>
                  {selectedEntry.notes ? (
                    <div className="sm:col-span-2">
                      <dt className="text-xs font-semibold uppercase tracking-wider text-white/40">Notes</dt>
                      <dd className="mt-0.5 whitespace-pre-wrap text-white/70">{selectedEntry.notes}</dd>
                    </div>
                  ) : null}
                  {selectedEntry.status && selectedEntry.status !== "pending_review" ? (
                    <div>
                      <dt className="text-xs font-semibold uppercase tracking-wider text-white/40">Status</dt>
                      <dd className="mt-1">
                        <StatusBadge status={selectedEntry.status} />
                      </dd>
                    </div>
                  ) : null}
                </dl>

                {canReviewSelected ? (
                  <div className="space-y-3 border-t border-white/10 pt-4">
                    {(showRejectReason || rejectReason) && (
                      <label className="block w-full text-xs font-semibold uppercase tracking-wider text-white/40">
                        Reject reason <span className="text-red-300">(required)</span>
                        <FormTextarea
                          ref={rejectInputRef}
                          value={rejectReason}
                          onChange={(e) => setRejectReason(e.target.value)}
                          rows={3}
                          className="mt-1 w-full"
                          placeholder="Explain why this submission is rejected"
                        />
                      </label>
                    )}
                    <div className="flex flex-col gap-2 md:flex-row">
                      <button
                        type="button"
                        disabled={reviewPending}
                        onClick={() => void submitReview("approve")}
                        className="w-full rounded-xl border border-green-500/40 bg-green-500/20 px-4 py-2.5 text-sm font-semibold text-green-200 transition-colors hover:bg-green-500/30 disabled:opacity-50 md:flex-1"
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        disabled={reviewPending || (showRejectReason && !rejectReason.trim())}
                        onClick={() => {
                          if (!showRejectReason) {
                            setShowRejectReason(true);
                            queueMicrotask(() => rejectInputRef.current?.focus());
                            return;
                          }
                          void submitReview("reject");
                        }}
                        className="w-full rounded-xl border border-red-500/40 bg-red-500/20 px-4 py-2.5 text-sm font-semibold text-red-200 transition-colors hover:bg-red-500/30 disabled:opacity-50 md:flex-1"
                      >
                        {showRejectReason ? "Confirm reject" : "Reject"}
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              { label: "Total bonuses issued", v: `€${stats.bonuses.toFixed(2)}`, cls: "text-green-400" },
              { label: "Total fines issued", v: `€${stats.fines.toFixed(2)}`, cls: "text-red-400" },
              {
                label: "Net (filtered)",
                v: `€${stats.net.toFixed(2)}`,
                cls: stats.net >= 0 ? "text-green-400" : "text-red-400",
              },
              { label: "People affected", v: String(stats.people), cls: "text-white" },
            ].map((s) => (
              <div key={s.label} className="glass-card p-4">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-white/40">{s.label}</p>
                <p className={`mt-1 text-xl font-bold ${s.cls}`}>{s.v}</p>
              </div>
            ))}
          </div>

          {allFiltered.length === 0 ? (
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

              <PaginationControls page={page} totalPages={totalPages} onPage={setPage} totalItems={allFiltered.length} />
            </>
          )}
        </>
      )}

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
