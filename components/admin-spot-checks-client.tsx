"use client";

import * as React from "react";
import Link from "next/link";
import {
  ChevronDown,
  ClipboardList,
  Loader2,
  MessageSquarePlus,
  Plus,
  Trash2,
} from "lucide-react";
import { ConfirmDeleteModal } from "@/components/confirm-delete-modal";
import {
  AttachmentLinks,
  DashPlaceholder,
  FilterBar,
  FilterChip,
  FindingCard,
  ManagerReviewSelect,
  ManagerReviewTextarea,
  QuickActionAdd,
  QuickActionDelete,
  QuickActionEscalate,
  QuickActionMarkFixed,
  ReviewEmptyState,
  ReviewFieldLabel,
  ReviewLoadingState,
  ReviewModalShell,
  ReviewPageEyebrow,
  ReviewSectionHeader,
  SpotCheckStatusBadge,
  SpotCheckTypeBadge,
  VA_BTN_PRIMARY,
  VA_BTN_SECONDARY,
  VA_CHAMPAGNE_DIVIDER,
  VA_FILTER_INPUT,
  displayOrDash,
  type CustomSelectOption,
} from "@/components/manager-review-ui";
import { SpotCheckForm, type SpotCheckFormValues } from "@/components/spot-check-form";
import { StaffAssigneePicker, staffDisplayName, type StaffUserOption } from "@/components/staff-assignee-picker";
import { useToast } from "@/contexts/toast-context";
import { useIsSupabaseBackend } from "@/contexts/data-backend-context";
import { uploadFilesToSupabaseStorage } from "@/lib/client-direct-storage-upload";
import { formatDateTimeAthens } from "@/lib/format";
import { ROUTES } from "@/lib/routes";
import {
  SPOT_CHECK_STATUSES,
  SPOT_CHECK_TYPES,
  type SpotCheckStatus,
  type SpotCheckType,
} from "@/lib/marketing-reviews-helpers";
import { cn } from "@/lib/utils";
import type { MarketingSpotCheck } from "@/services/marketing-reviews";
import type { ModelRecord, UserRecord } from "@/types";
import { useSupabaseRealtimeRefresh } from "@/lib/hooks/use-supabase-realtime";

type DateRange = "all" | "7d" | "30d" | "custom";

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
  staffUsers: StaffUserOption[];
  roleLabels: Record<string, string>;
  models: ModelRecord[];
};

export function AdminSpotChecksClient({
  initialSpotChecks,
  vaUsers,
  staffUsers,
  roleLabels,
  models,
}: Props) {
  const { addToast } = useToast();
  const isSupabase = useIsSupabaseBackend();
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
  const [reassigningId, setReassigningId] = React.useState<string | null>(null);

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

  const vaFilterOptions = React.useMemo<CustomSelectOption[]>(
    () => [
      { value: "", label: "All VAs" },
      ...marketingVas.map((v) => ({ value: v.id, label: v.full_name || v.email || "—" })),
    ],
    [marketingVas],
  );
  const creatorFilterOptions = React.useMemo<CustomSelectOption[]>(
    () => [
      { value: "", label: "All creators" },
      ...models.map((m) => ({ value: m.id, label: m.model_name })),
    ],
    [models],
  );
  const typeFilterOptions = React.useMemo<CustomSelectOption[]>(
    () => [{ value: "", label: "All types" }, ...SPOT_CHECK_TYPES.map((t) => ({ value: t, label: t }))],
    [],
  );
  const statusFilterOptions = React.useMemo<CustomSelectOption[]>(
    () => [{ value: "", label: "All statuses" }, ...SPOT_CHECK_STATUSES.map((s) => ({ value: s, label: s }))],
    [],
  );
  const dateRangeOptions = React.useMemo<CustomSelectOption[]>(
    () => [
      { value: "all", label: "All dates" },
      { value: "7d", label: "Last 7 days" },
      { value: "30d", label: "Last 30 days" },
      { value: "custom", label: "Custom range" },
    ],
    [],
  );

  function memberName(id: string | undefined): string {
    if (!id) return "";
    const member = staffUsers.find((u) => u.id === id);
    return member ? staffDisplayName(member) : "";
  }

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

  const reloadRef = React.useRef(reload);
  reloadRef.current = reload;
  useSupabaseRealtimeRefresh(
    ["marketing_spot_checks"],
    () => void reloadRef.current(),
    { debounceMs: 700 },
  );

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
      const execName = memberName(values.exec_va_id);
      const model = models.find((m) => m.id === values.creator_id);
      const res = await fetch("/api/admin/marketing-reviews/spot-checks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: values.type,
          exec_va_id: values.exec_va_id,
          exec_va_name: execName,
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
        if (isSupabase) {
          const uploaded = await uploadFilesToSupabaseStorage(values.files, "spot-check", {
            itemId: data.spotCheck.id,
          });
          for (const u of uploaded) fd.append("attachment_url", u.sbUrl);
        } else {
          for (const f of values.files) fd.append("attachments", f);
        }
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

  async function handleReassign(id: string, memberId: string) {
    if (!memberId) return;
    const name = memberName(memberId);
    const ok = await patchSpotCheck(
      id,
      { exec_va_id: memberId, exec_va_name: name },
      { exec_va_id: memberId, exec_va_name: name },
    );
    if (ok) {
      setReassigningId(null);
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
      const execName = memberName(editDraft.exec_va_id);
      const model = models.find((m) => m.id === editDraft.creator_id);
      const res = await fetch(`/api/admin/marketing-reviews/spot-checks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...editDraft,
          exec_va_name: execName || editDraft.exec_va_name,
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

  const editTypeOptions = React.useMemo<CustomSelectOption[]>(
    () => SPOT_CHECK_TYPES.map((t) => ({ value: t, label: t })),
    [],
  );
  const editStatusOptions = React.useMemo<CustomSelectOption[]>(
    () => SPOT_CHECK_STATUSES.map((s) => ({ value: s, label: s })),
    [],
  );
  const editModelOptions = React.useMemo<CustomSelectOption[]>(
    () => [
      { value: "", label: "—" },
      ...models.map((m) => ({ value: m.id, label: m.model_name })),
    ],
    [models],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <ReviewPageEyebrow>Manager review</ReviewPageEyebrow>
          <h1 className="mt-1 text-2xl font-bold text-white">Spot checks</h1>
          <p className="mt-1 text-sm text-[#B8B4B8]/60">Manage and resolve marketing QA findings</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={ROUTES.admin.dailyReview} className={cn(VA_BTN_SECONDARY, "px-4 py-2.5 text-sm")}>
            Daily review →
          </Link>
          <button type="button" onClick={() => setModalOpen(true)} className={cn(VA_BTN_PRIMARY, "inline-flex items-center gap-2")}>
            <Plus className="h-4 w-4" aria-hidden />
            Log finding
          </button>
        </div>
      </div>

      <FilterBar>
        <div className="flex flex-wrap gap-2">
          <ManagerReviewSelect
            value={filterVa}
            onChange={setFilterVa}
            options={vaFilterOptions}
            triggerClassName="min-w-[9rem]"
            aria-label="Filter by VA"
          />
          <ManagerReviewSelect
            value={filterCreator}
            onChange={setFilterCreator}
            options={creatorFilterOptions}
            triggerClassName="min-w-[9rem]"
            aria-label="Filter by creator"
          />
          <ManagerReviewSelect
            value={filterType}
            onChange={(v) => setFilterType(v as SpotCheckType | "")}
            options={typeFilterOptions}
            triggerClassName="min-w-[9rem]"
            aria-label="Filter by type"
          />
          <ManagerReviewSelect
            value={filterStatus}
            onChange={(v) => setFilterStatus(v as SpotCheckStatus | "")}
            options={statusFilterOptions}
            triggerClassName="min-w-[9rem]"
            aria-label="Filter by status"
          />
          <ManagerReviewSelect
            value={filterDateRange}
            onChange={(v) => setFilterDateRange(v as DateRange)}
            options={dateRangeOptions}
            triggerClassName="min-w-[9rem]"
            aria-label="Date range"
          />
          {filterDateRange === "custom" ? (
            <>
              <input
                type="date"
                value={filterDateFrom}
                onChange={(e) => setFilterDateFrom(e.target.value)}
                className={cn(VA_FILTER_INPUT, "min-w-[9rem]")}
                aria-label="From date"
              />
              <input
                type="date"
                value={filterDateTo}
                onChange={(e) => setFilterDateTo(e.target.value)}
                className={cn(VA_FILTER_INPUT, "min-w-[9rem]")}
                aria-label="To date"
              />
            </>
          ) : null}
        </div>
        {hasFilters ? (
          <div className="flex flex-wrap items-center gap-2">
            {filterVa ? (
              <FilterChip
                label={`VA: ${marketingVas.find((v) => v.id === filterVa)?.full_name ?? filterVa}`}
                onRemove={() => setFilterVa("")}
              />
            ) : null}
            {filterCreator ? (
              <FilterChip
                label={`Creator: ${models.find((m) => m.id === filterCreator)?.model_name ?? filterCreator}`}
                onRemove={() => setFilterCreator("")}
              />
            ) : null}
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
      </FilterBar>

      {loading ? (
        <ReviewLoadingState />
      ) : spotChecks.length === 0 ? (
        <ReviewEmptyState
          icon={ClipboardList}
          title={hasFilters ? "No spot checks match your filters" : "All clear — no spot checks yet"}
          description={
            hasFilters
              ? "Try adjusting filters or clear them to see everything."
              : "Log a finding when you spot a QA issue."
          }
        />
      ) : (
        <div className="space-y-3">
          {spotChecks.map((sc) => {
            const expanded = expandedId === sc.id;
            const isPending = pendingIds.has(sc.id);
            return (
              <FindingCard key={sc.id} pending={isPending} className="p-0">
                <div className="p-4 md:p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <SpotCheckStatusBadge status={sc.status} />
                        <SpotCheckTypeBadge type={sc.type} />
                        {isPending ? <Loader2 className="h-3.5 w-3.5 motion-safe:animate-spin text-[#D4AF8C]/50" aria-hidden /> : null}
                      </div>
                      <p className="font-semibold text-white">{sc.subject || sc.what_was_wrong.slice(0, 100)}</p>
                      <p className="text-sm text-[#B8B4B8]/55">
                        {displayOrDash(sc.exec_va_name)} · {displayOrDash(sc.creator_name)}
                      </p>
                      <p className="text-xs text-[#D4AF8C]/60">
                        Submitted by{" "}
                        <span className="text-[#D4AF8C]/90">{sc.manager_name?.trim() ? sc.manager_name : <DashPlaceholder />}</span>
                        {" · "}
                        {formatDateTimeAthens(sc.timestamp)}
                      </p>
                    </div>
                    <button
                      type="button"
                      className="shrink-0 rounded-lg p-1.5 text-[#D4AF8C]/50 transition hover:bg-white/5"
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
                      <QuickActionMarkFixed
                        disabled={isPending}
                        onClick={() => void handleQuickStatus(sc.id, "Fixed")}
                      />
                    ) : null}
                    {sc.status !== "Escalated" ? (
                      <QuickActionEscalate
                        disabled={isPending}
                        onClick={() => void handleQuickStatus(sc.id, "Escalated")}
                      />
                    ) : null}
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => setReassigningId(reassigningId === sc.id ? null : sc.id)}
                      className={cn(VA_BTN_SECONDARY, "h-8 px-3 py-0 text-xs")}
                    >
                      Reassign
                    </button>
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
                      <QuickActionAdd
                        disabled={isPending || !(noteDrafts[sc.id] ?? "").trim()}
                        onClick={() => void handleAddNote(sc.id)}
                      >
                        <MessageSquarePlus className="h-3.5 w-3.5" aria-hidden />
                        Add
                      </QuickActionAdd>
                    </div>
                    <QuickActionDelete onClick={() => setDeleteId(sc.id)}>
                      <Trash2 className="h-3.5 w-3.5" aria-hidden />
                      Delete
                    </QuickActionDelete>
                  </div>

                  {reassigningId === sc.id ? (
                    <div className="mt-4 border-t border-white/6 pt-4">
                      <ReviewFieldLabel className="mb-2 block">Reassign exec / VA</ReviewFieldLabel>
                      <StaffAssigneePicker
                        users={staffUsers}
                        roleLabels={roleLabels}
                        selectedIds={sc.exec_va_id ? [sc.exec_va_id] : []}
                        onChange={(ids) => {
                          const id = ids[0];
                          if (id) void handleReassign(sc.id, id);
                        }}
                        singleSelect
                      />
                    </div>
                  ) : null}
                </div>

                {expanded ? (
                  <div className="border-t border-white/6 px-4 pb-5 pt-4 md:px-5">
                    <div className={VA_CHAMPAGNE_DIVIDER} />
                    <div className="mt-4 grid gap-4 md:grid-cols-2">
                      <label className="block space-y-1.5 text-sm">
                        <ReviewFieldLabel>Type</ReviewFieldLabel>
                        <ManagerReviewSelect
                          value={editDraft.type ?? sc.type}
                          onChange={(v) => setEditDraft((d) => ({ ...d, type: v as SpotCheckType }))}
                          options={editTypeOptions}
                          className="w-full"
                        />
                      </label>
                      <label className="block space-y-1.5 text-sm">
                        <ReviewFieldLabel>Status</ReviewFieldLabel>
                        <ManagerReviewSelect
                          value={editDraft.status ?? sc.status}
                          onChange={(v) => setEditDraft((d) => ({ ...d, status: v as SpotCheckStatus }))}
                          options={editStatusOptions}
                          className="w-full"
                        />
                      </label>
                      <div className="block space-y-1.5 text-sm md:col-span-2">
                        <ReviewFieldLabel>Exec / VA</ReviewFieldLabel>
                        <StaffAssigneePicker
                          users={staffUsers}
                          roleLabels={roleLabels}
                          selectedIds={(editDraft.exec_va_id ?? sc.exec_va_id) ? [editDraft.exec_va_id ?? sc.exec_va_id] : []}
                          onChange={(ids) => {
                            const id = ids[0] ?? "";
                            const member = staffUsers.find((u) => u.id === id);
                            setEditDraft((d) => ({
                              ...d,
                              exec_va_id: id,
                              exec_va_name: member ? staffDisplayName(member) : "",
                            }));
                          }}
                          singleSelect
                        />
                      </div>
                      <label className="block space-y-1.5 text-sm">
                        <ReviewFieldLabel>Creator</ReviewFieldLabel>
                        <ManagerReviewSelect
                          value={editDraft.creator_id ?? sc.creator_id}
                          onChange={(v) => setEditDraft((d) => ({ ...d, creator_id: v }))}
                          options={editModelOptions}
                          className="w-full"
                        />
                      </label>
                    </div>
                    <label className="mt-4 block space-y-1.5 text-sm">
                      <ReviewFieldLabel>What was wrong</ReviewFieldLabel>
                      <ManagerReviewTextarea
                        value={editDraft.what_was_wrong ?? sc.what_was_wrong}
                        onChange={(e) => setEditDraft((d) => ({ ...d, what_was_wrong: e.target.value }))}
                        rows={3}
                      />
                    </label>
                    <label className="mt-4 block space-y-1.5 text-sm">
                      <ReviewFieldLabel>Action taken</ReviewFieldLabel>
                      <ManagerReviewTextarea
                        value={editDraft.action_taken ?? sc.action_taken}
                        onChange={(e) => setEditDraft((d) => ({ ...d, action_taken: e.target.value }))}
                        rows={2}
                      />
                    </label>
                    {sc.attachments.length > 0 ? (
                      <div className="mt-4">
                        <AttachmentLinks attachments={sc.attachments} />
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
              </FindingCard>
            );
          })}
        </div>
      )}

      {modalOpen ? (
        <ReviewModalShell title="Log finding" onClose={() => setModalOpen(false)} saving={saving}>
          <SpotCheckForm
            staffUsers={staffUsers}
            roleLabels={roleLabels}
            models={models}
            saving={saving}
            submitLabel="Save finding"
            onCancel={() => setModalOpen(false)}
            onSubmit={handleCreate}
          />
        </ReviewModalShell>
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
