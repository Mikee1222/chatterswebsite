"use client";

import * as React from "react";
import Link from "next/link";
import {
  ChevronDown,
  ClipboardList,
  Loader2,
  MessageSquarePlus,
  Paperclip,
  Plus,
  Trash2,
} from "lucide-react";
import { ConfirmDeleteModal } from "@/components/confirm-delete-modal";
import { ContentPipelineHero } from "@/components/content-pipeline-ui";
import { ListPagination, useClientPagination } from "@/components/earnings-filter-list";
import {
  CountUp,
  InflowwCustomDateRange,
  LuxuryStatCard,
} from "@/components/infloww-performance-ui";
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
import { getTodayYmdAthens } from "@/lib/airtable-datetime";
import { uploadFilesToSupabaseStorage } from "@/lib/client-direct-storage-upload";
import { formatDateTimeAthens, formatRelativeTime } from "@/lib/format";
import { useSupabaseRealtimeRefresh } from "@/lib/hooks/use-supabase-realtime";
import {
  SPOT_CHECK_STATUSES,
  SPOT_CHECK_TYPES,
  isoDateDaysAgo,
  type SpotCheckStatus,
  type SpotCheckType,
} from "@/lib/marketing-reviews-helpers";
import { ROUTES } from "@/lib/routes";
import { cn } from "@/lib/utils";
import { VA_CARD, VA_CARD_GLOW } from "@/lib/va-tasks-tokens";
import type { MarketingSpotCheck } from "@/services/marketing-reviews";
import type { ModelRecord, UserRecord } from "@/types";

type DateRange = "all" | "7d" | "30d" | "custom";
type AttachmentFilter = "" | "true" | "false";
type UnresolvedAgeChip = "" | "unresolved" | "24" | "72" | "168";

const PAGE_SIZE = 12;
const DATE_PRESETS: { id: DateRange; label: string }[] = [
  { id: "all", label: "All dates" },
  { id: "7d", label: "Last 7d" },
  { id: "30d", label: "Last 30d" },
  { id: "custom", label: "Custom" },
];
const UNRESOLVED_AGE_CHIPS: { id: UnresolvedAgeChip; label: string }[] = [
  { id: "", label: "Any age" },
  { id: "unresolved", label: "Unresolved" },
  { id: "24", label: "≥24h" },
  { id: "72", label: "≥72h" },
  { id: "168", label: "≥7d" },
];

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

function formatResolutionTime(ms: number | null | undefined): string | null {
  if (ms == null || !Number.isFinite(ms) || ms <= 0) return null;
  const iso = new Date(ms).toISOString();
  return `${formatDateTimeAthens(iso)} · ${formatRelativeTime(iso)}`;
}

function formatAvgUnresolvedHours(hours: number): string {
  if (!Number.isFinite(hours) || hours <= 0) return "—";
  if (hours < 24) return `${Math.round(hours)}h`;
  const days = hours / 24;
  if (days < 10) return `${days.toFixed(1)}d`;
  return `${Math.round(days)}d`;
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
  const todayYmd = React.useMemo(() => getTodayYmdAthens(), []);

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
  const [filterSubmitter, setFilterSubmitter] = React.useState("");
  const [filterAttachment, setFilterAttachment] = React.useState<AttachmentFilter>("");
  const [filterUnresolvedAge, setFilterUnresolvedAge] = React.useState<UnresolvedAgeChip>("");
  const [filterDateRange, setFilterDateRange] = React.useState<DateRange>("all");
  const [filterDateFrom, setFilterDateFrom] = React.useState(todayYmd);
  const [filterDateTo, setFilterDateTo] = React.useState(todayYmd);

  const [editDraft, setEditDraft] = React.useState<Partial<MarketingSpotCheck>>({});
  const [reassigningId, setReassigningId] = React.useState<string | null>(null);

  const marketingVas = React.useMemo(
    () =>
      vaUsers.filter(
        (u) => u.va_type === "marketing" || u.va_type === "both" || !u.va_type,
      ),
    [vaUsers],
  );

  const submitterOptions = React.useMemo<CustomSelectOption[]>(() => {
    const map = new Map<string, string>();
    for (const sc of [...initialSpotChecks, ...spotChecks]) {
      const id = sc.manager_id?.trim();
      const name = sc.manager_name?.trim();
      if (id) map.set(id, name || id);
      else if (name) map.set(`name:${name}`, name);
    }
    for (const u of staffUsers) {
      if (u.role === "admin" || u.role === "manager") {
        if (!map.has(u.id)) map.set(u.id, staffDisplayName(u));
      }
    }
    const entries = [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]));
    return [
      { value: "", label: "All submitters" },
      ...entries.map(([value, label]) => ({ value, label })),
    ];
  }, [initialSpotChecks, spotChecks, staffUsers]);

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
  const attachmentFilterOptions = React.useMemo<CustomSelectOption[]>(
    () => [
      { value: "", label: "Attachments: any" },
      { value: "true", label: "Has attachment" },
      { value: "false", label: "No attachment" },
    ],
    [],
  );

  const stats = React.useMemo(() => {
    const total = spotChecks.length;
    const pending = spotChecks.filter((s) => s.status === "Pending").length;
    const fixed = spotChecks.filter((s) => s.status === "Fixed").length;
    const escalated = spotChecks.filter((s) => s.status === "Escalated").length;
    const unresolved = spotChecks.filter((s) => s.status === "Pending" || s.status === "Escalated");
    const now = Date.now();
    const avgUnresolvedHours =
      unresolved.length === 0
        ? 0
        : unresolved.reduce((sum, sc) => {
            const t = new Date(sc.timestamp).getTime();
            if (!Number.isFinite(t)) return sum;
            return sum + Math.max(0, (now - t) / 3_600_000);
          }, 0) / unresolved.length;
    return { total, pending, fixed, escalated, avgUnresolvedHours, unresolvedCount: unresolved.length };
  }, [spotChecks]);

  const pagination = useClientPagination(spotChecks, PAGE_SIZE);
  React.useEffect(() => {
    pagination.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    filterVa,
    filterCreator,
    filterType,
    filterStatus,
    filterSubmitter,
    filterAttachment,
    filterUnresolvedAge,
    filterDateRange,
    filterDateFrom,
    filterDateTo,
    spotChecks.length,
  ]);

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
      if (filterSubmitter) {
        if (filterSubmitter.startsWith("name:")) {
          params.set("manager_name", filterSubmitter.slice(5));
        } else {
          params.set("manager_id", filterSubmitter);
        }
      }
      if (filterAttachment === "true" || filterAttachment === "false") {
        params.set("has_attachment", filterAttachment);
      }
      if (filterUnresolvedAge === "unresolved") {
        params.set("unresolved_only", "true");
      } else if (filterUnresolvedAge === "24" || filterUnresolvedAge === "72" || filterUnresolvedAge === "168") {
        params.set("unresolved_only", "true");
        params.set("min_unresolved_age_hours", filterUnresolvedAge);
      }
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
  }, [
    filterVa,
    filterCreator,
    filterType,
    filterStatus,
    filterSubmitter,
    filterAttachment,
    filterUnresolvedAge,
    filterDateRange,
    filterDateFrom,
    filterDateTo,
  ]);

  const reloadRef = React.useRef(reload);
  reloadRef.current = reload;
  useSupabaseRealtimeRefresh(
    ["marketing_spot_checks"],
    () => void reloadRef.current(),
    { debounceMs: 700 },
  );

  const hasFilters =
    Boolean(filterVa || filterCreator || filterType || filterStatus || filterSubmitter || filterAttachment || filterUnresolvedAge) ||
    filterDateRange !== "all";

  function clearFilters() {
    setFilterVa("");
    setFilterCreator("");
    setFilterType("");
    setFilterStatus("");
    setFilterSubmitter("");
    setFilterAttachment("");
    setFilterUnresolvedAge("");
    setFilterDateRange("all");
    setFilterDateFrom(todayYmd);
    setFilterDateTo(todayYmd);
  }

  async function uploadAttachments(spotCheckId: string, files: File[]): Promise<boolean> {
    if (files.length === 0) return true;
    try {
      const fd = new FormData();
      if (isSupabase) {
        const uploaded = await uploadFilesToSupabaseStorage(files, "spot-check", {
          itemId: spotCheckId,
        });
        for (const u of uploaded) fd.append("attachment_url", u.sbUrl);
      } else {
        for (const f of files) fd.append("attachments", f);
      }
      const res = await fetch(`/api/admin/marketing-reviews/spot-checks/${spotCheckId}/attachments`, {
        method: "POST",
        body: fd,
      });
      return res.ok;
    } catch {
      return false;
    }
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

      let attachmentOk = true;
      if (values.files.length > 0) {
        attachmentOk = await uploadAttachments(data.spotCheck.id, values.files);
      }

      setModalOpen(false);
      await reload();

      if (!attachmentOk) {
        addToast(
          localToast(
            `sc-att-err-${Date.now()}`,
            "Attachments failed",
            "Finding was saved, but one or more attachments failed to upload.",
            "high",
          ),
        );
        return true;
      }

      addToast(localToast(`sc-ok-${Date.now()}`, "Spot check logged", "Finding saved successfully.", "normal"));
      return true;
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

  const submitterChipLabel = React.useMemo(() => {
    if (!filterSubmitter) return "";
    return submitterOptions.find((o) => o.value === filterSubmitter)?.label ?? filterSubmitter;
  }, [filterSubmitter, submitterOptions]);

  return (
    <div className="space-y-6 md:space-y-8">
      <ContentPipelineHero
        eyebrow="Manager review"
        title="Spot checks"
        description="Manage and resolve marketing QA findings — filter, coach, and close the loop."
        orb="both"
        actions={
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap">
            <Link
              href={ROUTES.admin.dailyReview}
              className={cn(VA_BTN_SECONDARY, "inline-flex justify-center px-4 py-2.5 text-sm")}
            >
              Daily review →
            </Link>
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className={cn(VA_BTN_PRIMARY, "inline-flex items-center justify-center gap-2 px-5 py-2.5")}
            >
              <Plus className="h-4 w-4" aria-hidden />
              Log finding
            </button>
          </div>
        }
        stats={
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <LuxuryStatCard
              label="Total"
              value={<CountUp value={stats.total} />}
              accent="white"
              tooltip="Findings in the current filter"
              className="!p-3"
            />
            <LuxuryStatCard
              label="Pending"
              value={<CountUp value={stats.pending} />}
              accent="champagne"
              tooltip="Awaiting resolution"
              className="!p-3"
            />
            <LuxuryStatCard
              label="Fixed"
              value={<CountUp value={stats.fixed} />}
              accent="emerald"
              tooltip="Resolved findings"
              className="!p-3"
            />
            <LuxuryStatCard
              label="Escalated"
              value={<CountUp value={stats.escalated} />}
              accent="pink"
              tooltip="Escalated for follow-up"
              className="!p-3"
            />
            <LuxuryStatCard
              label="Avg open age"
              value={formatAvgUnresolvedHours(stats.avgUnresolvedHours)}
              accent="amber"
              hint={stats.unresolvedCount ? `${stats.unresolvedCount} unresolved` : "No open items"}
              tooltip="Average age of Pending + Escalated findings"
              className="!p-3 col-span-2 sm:col-span-1"
            />
          </div>
        }
      />

      <FilterBar className={cn(VA_CARD, VA_CARD_GLOW, "space-y-4 p-4")}>
        <div className="flex flex-wrap gap-2">
          {DATE_PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setFilterDateRange(p.id)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-semibold transition duration-200",
                filterDateRange === p.id
                  ? "border-[#FF1493]/50 bg-[#FF1493]/15 text-[#FF1493] shadow-[0_0_24px_-8px_rgba(255,20,147,0.55)]"
                  : "border-white/10 bg-white/5 text-white/60 hover:border-white/20 hover:text-white",
              )}
            >
              {p.label}
            </button>
          ))}
        </div>

        {filterDateRange === "custom" ? (
          <InflowwCustomDateRange
            startYmd={filterDateFrom}
            endYmd={filterDateTo}
            loading={loading}
            className="border-0 bg-transparent p-0 shadow-none"
            onChange={(start, end) => {
              setFilterDateFrom(start);
              setFilterDateTo(end);
            }}
            onApply={(start, end) => {
              setFilterDateFrom(start);
              setFilterDateTo(end);
            }}
          />
        ) : null}

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
            value={filterSubmitter}
            onChange={setFilterSubmitter}
            options={submitterOptions}
            triggerClassName="min-w-[10rem]"
            aria-label="Filter by submitter"
          />
          <ManagerReviewSelect
            value={filterAttachment}
            onChange={(v) => setFilterAttachment(v as AttachmentFilter)}
            options={attachmentFilterOptions}
            triggerClassName="min-w-[10rem]"
            aria-label="Filter by attachment"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          {UNRESOLVED_AGE_CHIPS.map((chip) => (
            <button
              key={chip.id || "any"}
              type="button"
              onClick={() => setFilterUnresolvedAge(chip.id)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-[12px] font-medium transition",
                filterUnresolvedAge === chip.id
                  ? "border-[#D4AF8C]/50 bg-[#D4AF8C]/15 text-[#D4AF8C]"
                  : "border-white/10 bg-white/[0.03] text-white/55 hover:border-white/20 hover:text-white/75",
              )}
            >
              {chip.label}
            </button>
          ))}
        </div>

        {hasFilters ? (
          <div className="flex flex-wrap items-center gap-2 border-t border-white/6 pt-3">
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
            {filterSubmitter ? (
              <FilterChip label={`Submitter: ${submitterChipLabel}`} onRemove={() => setFilterSubmitter("")} />
            ) : null}
            {filterAttachment ? (
              <FilterChip
                label={filterAttachment === "true" ? "Has attachment" : "No attachment"}
                onRemove={() => setFilterAttachment("")}
              />
            ) : null}
            {filterUnresolvedAge ? (
              <FilterChip
                label={UNRESOLVED_AGE_CHIPS.find((c) => c.id === filterUnresolvedAge)?.label ?? filterUnresolvedAge}
                onRemove={() => setFilterUnresolvedAge("")}
              />
            ) : null}
            {filterDateRange !== "all" ? (
              <FilterChip
                label={`Date: ${
                  filterDateRange === "custom"
                    ? `${filterDateFrom || "…"} – ${filterDateTo || "…"}`
                    : filterDateRange
                }`}
                onRemove={() => {
                  setFilterDateRange("all");
                  setFilterDateFrom(todayYmd);
                  setFilterDateTo(todayYmd);
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
        <div className={cn(VA_CARD, "overflow-hidden border border-white/10")}>
          <div className="space-y-0 divide-y divide-white/6">
            {pagination.pageItems.map((sc) => {
              const expanded = expandedId === sc.id;
              const isPending = pendingIds.has(sc.id);
              const resolutionLabel = formatResolutionTime(sc.resolution_time);
              return (
                <FindingCard key={sc.id} pending={isPending} className="rounded-none border-0 bg-transparent shadow-none">
                  <div className="p-4 md:p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <SpotCheckStatusBadge status={sc.status} />
                          <SpotCheckTypeBadge type={sc.type} />
                          {sc.attachments.length > 0 ? (
                            <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-white/45">
                              <Paperclip className="h-3 w-3" aria-hidden />
                              {sc.attachments.length}
                            </span>
                          ) : null}
                          {isPending ? (
                            <Loader2 className="h-3.5 w-3.5 text-[#D4AF8C]/50 motion-safe:animate-spin" aria-hidden />
                          ) : null}
                        </div>
                        <p className="font-semibold text-white">{sc.subject || sc.what_was_wrong.slice(0, 100)}</p>
                        <p className="text-sm text-[#B8B4B8]/55">
                          {displayOrDash(sc.exec_va_name)} · {displayOrDash(sc.creator_name)}
                        </p>
                        <p className="text-xs text-[#D4AF8C]/60">
                          Submitted by{" "}
                          <span className="text-[#D4AF8C]/90">
                            {sc.manager_name?.trim() ? sc.manager_name : <DashPlaceholder />}
                          </span>
                          {" · "}
                          {formatDateTimeAthens(sc.timestamp)}
                          {" · "}
                          <span className="text-white/35">{formatRelativeTime(sc.timestamp)}</span>
                        </p>
                        {resolutionLabel ? (
                          <p className="text-xs text-emerald-400/80">Fixed {resolutionLabel}</p>
                        ) : null}
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
                            selectedIds={
                              (editDraft.exec_va_id ?? sc.exec_va_id)
                                ? [editDraft.exec_va_id ?? sc.exec_va_id]
                                : []
                            }
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
          <ListPagination
            page={pagination.page}
            totalPages={pagination.totalPages}
            total={pagination.total}
            pageSize={PAGE_SIZE}
            onPageChange={pagination.setPage}
          />
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
