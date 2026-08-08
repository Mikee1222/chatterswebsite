"use client";

import * as React from "react";
import { ClipboardList, Paperclip } from "lucide-react";
import { ContentPipelineHero } from "@/components/content-pipeline-ui";
import { ListPagination, useClientPagination } from "@/components/earnings-filter-list";
import {
  CountUp,
  InflowwCustomDateRange,
  LuxuryStatCard,
} from "@/components/infloww-performance-ui";
import {
  AttachmentLinks,
  FilterBar,
  FilterChip,
  FindingCard,
  ManagerReviewSelect,
  ReviewEmptyState,
  ReviewFormSection,
  ReviewLoadingState,
  SpotCheckStatusBadge,
  SpotCheckTypeBadge,
  displayOrDash,
  type CustomSelectOption,
} from "@/components/manager-review-ui";
import { SpotCheckForm, type SpotCheckFormValues } from "@/components/spot-check-form";
import { staffDisplayName, type StaffUserOption } from "@/components/staff-assignee-picker";
import { useToast } from "@/contexts/toast-context";
import { useIsSupabaseBackend } from "@/contexts/data-backend-context";
import { getTodayYmdAthens } from "@/lib/airtable-datetime";
import { uploadFilesToSupabaseStorage } from "@/lib/client-direct-storage-upload";
import { formatDateTimeAthens, formatRelativeTime } from "@/lib/format";
import { useSupabaseRealtimeRefresh } from "@/lib/hooks/use-supabase-realtime";
import {
  SPOT_CHECK_STATUSES,
  isoDateDaysAgo,
  type SpotCheckStatus,
} from "@/lib/marketing-reviews-helpers";
import { cn } from "@/lib/utils";
import { VA_CARD, VA_CARD_GLOW } from "@/lib/va-tasks-tokens";
import type { MarketingSpotCheck } from "@/services/marketing-reviews";
import type { ModelRecord } from "@/types";

type DateRange = "all" | "7d" | "30d" | "custom";

const PAGE_SIZE = 10;
const DATE_PRESETS: { id: DateRange; label: string }[] = [
  { id: "all", label: "All dates" },
  { id: "7d", label: "Last 7d" },
  { id: "30d", label: "Last 30d" },
  { id: "custom", label: "Custom" },
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

type Props = {
  initialSubmissions: MarketingSpotCheck[];
  staffUsers: StaffUserOption[];
  roleLabels: Record<string, string>;
  models: ModelRecord[];
};

export function SupervisorSpotChecksClient({
  initialSubmissions,
  staffUsers,
  roleLabels,
  models,
}: Props) {
  const { addToast } = useToast();
  const isSupabase = useIsSupabaseBackend();
  const todayYmd = React.useMemo(() => getTodayYmdAthens(), []);

  const [submissions, setSubmissions] = React.useState(initialSubmissions);
  const [loading, setLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  const [filterStatus, setFilterStatus] = React.useState<SpotCheckStatus | "">("");
  const [filterDateRange, setFilterDateRange] = React.useState<DateRange>("all");
  const [filterDateFrom, setFilterDateFrom] = React.useState(todayYmd);
  const [filterDateTo, setFilterDateTo] = React.useState(todayYmd);

  const statusFilterOptions = React.useMemo<CustomSelectOption[]>(
    () => [{ value: "", label: "All statuses" }, ...SPOT_CHECK_STATUSES.map((s) => ({ value: s, label: s }))],
    [],
  );

  const stats = React.useMemo(() => {
    const total = submissions.length;
    const pending = submissions.filter((s) => s.status === "Pending").length;
    const fixed = submissions.filter((s) => s.status === "Fixed").length;
    const escalated = submissions.filter((s) => s.status === "Escalated").length;
    return { total, pending, fixed, escalated };
  }, [submissions]);

  const pagination = useClientPagination(submissions, PAGE_SIZE);
  React.useEffect(() => {
    pagination.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterStatus, filterDateRange, filterDateFrom, filterDateTo, submissions.length]);

  async function reload() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterStatus) params.set("status", filterStatus);
      if (filterDateRange === "7d") params.set("date_from", isoDateDaysAgo(7));
      if (filterDateRange === "30d") params.set("date_from", isoDateDaysAgo(30));
      if (filterDateRange === "custom") {
        if (filterDateFrom) params.set("date_from", filterDateFrom);
        if (filterDateTo) params.set("date_to", filterDateTo);
      }
      const qs = params.toString();
      const res = await fetch(qs ? `/api/spot-checks?${qs}` : "/api/spot-checks");
      const data = (await res.json()) as { spotChecks?: MarketingSpotCheck[] };
      if (res.ok) setSubmissions(data.spotChecks ?? []);
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterStatus, filterDateRange, filterDateFrom, filterDateTo]);

  const reloadRef = React.useRef(reload);
  reloadRef.current = reload;
  useSupabaseRealtimeRefresh(
    ["marketing_spot_checks"],
    () => void reloadRef.current(),
    { debounceMs: 700 },
  );

  const hasFilters = Boolean(filterStatus) || filterDateRange !== "all";

  function clearFilters() {
    setFilterStatus("");
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
      const res = await fetch(`/api/spot-checks/${spotCheckId}/attachments`, {
        method: "POST",
        body: fd,
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  async function handleSubmit(values: SpotCheckFormValues) {
    setSaving(true);
    try {
      const member = staffUsers.find((v) => v.id === values.exec_va_id);
      const model = models.find((m) => m.id === values.creator_id);
      const res = await fetch("/api/spot-checks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: values.type,
          exec_va_id: values.exec_va_id,
          exec_va_name: member ? staffDisplayName(member) : "",
          creator_id: values.creator_id,
          creator_name: model?.model_name ?? "",
          what_was_wrong: values.what_was_wrong,
          action_taken: values.action_taken,
          status: "Pending",
        }),
      });
      const data = (await res.json()) as { spotCheck?: MarketingSpotCheck; error?: string };
      if (!res.ok || !data.spotCheck) {
        addToast(localToast(`sc-err-${Date.now()}`, "Failed", data.error ?? "Could not submit finding", "high"));
        return false;
      }

      let attachmentOk = true;
      if (values.files.length > 0) {
        attachmentOk = await uploadAttachments(data.spotCheck.id, values.files);
      }

      await reload();

      if (!attachmentOk) {
        addToast(
          localToast(
            `sc-att-err-${Date.now()}`,
            "Attachments failed",
            "Finding was submitted, but one or more attachments failed to upload.",
            "high",
          ),
        );
        return true;
      }

      addToast(localToast(`sc-ok-${Date.now()}`, "Submitted", "Your finding was logged successfully.", "normal"));
      return true;
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 md:space-y-8">
      <ContentPipelineHero
        eyebrow="QA"
        title="Spot Checks"
        description="Log marketing QA findings for your team and track what you’ve submitted."
        orb="champagne"
        stats={
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <LuxuryStatCard
              label="Total"
              value={<CountUp value={stats.total} />}
              accent="white"
              tooltip="Your submissions in the current filter"
              className="!p-3"
            />
            <LuxuryStatCard
              label="Pending"
              value={<CountUp value={stats.pending} />}
              accent="champagne"
              className="!p-3"
            />
            <LuxuryStatCard
              label="Fixed"
              value={<CountUp value={stats.fixed} />}
              accent="emerald"
              className="!p-3"
            />
            <LuxuryStatCard
              label="Escalated"
              value={<CountUp value={stats.escalated} />}
              accent="pink"
              className="!p-3"
            />
          </div>
        }
      />

      <ReviewFormSection
        title="Log a finding"
        description="New submissions start as Pending for admin review."
      >
        <SpotCheckForm
          staffUsers={staffUsers}
          roleLabels={roleLabels}
          models={models}
          saving={saving}
          submitLabel="Submit finding"
          lockStatusToPending
          onSubmit={handleSubmit}
        />
      </ReviewFormSection>

      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#D4AF8C]/75">
              History
            </p>
            <h2 className="mt-1 text-lg font-semibold text-white">My submissions</h2>
          </div>
        </div>

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

          <ManagerReviewSelect
            value={filterStatus}
            onChange={(v) => setFilterStatus(v as SpotCheckStatus | "")}
            options={statusFilterOptions}
            triggerClassName="min-w-[9rem]"
            aria-label="Filter by status"
          />

          {hasFilters ? (
            <div className="flex flex-wrap items-center gap-2 border-t border-white/6 pt-3">
              {filterStatus ? (
                <FilterChip label={`Status: ${filterStatus}`} onRemove={() => setFilterStatus("")} />
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
              <button
                type="button"
                onClick={clearFilters}
                className="text-xs text-[#D4AF8C]/70 hover:text-[#D4AF8C]"
              >
                Clear all
              </button>
            </div>
          ) : null}
        </FilterBar>

        {loading ? (
          <ReviewLoadingState />
        ) : submissions.length === 0 ? (
          <ReviewEmptyState
            icon={ClipboardList}
            title={hasFilters ? "No submissions match your filters" : "No submissions yet"}
            description={
              hasFilters
                ? "Try adjusting date or status filters."
                : "Your logged findings will appear here with their status."
            }
          />
        ) : (
          <div className={cn(VA_CARD, "overflow-hidden border border-white/10")}>
            <div className="divide-y divide-white/6">
              {pagination.pageItems.map((sc) => {
                const resolutionLabel = formatResolutionTime(sc.resolution_time);
                return (
                  <FindingCard
                    key={sc.id}
                    className="rounded-none border-0 bg-transparent shadow-none p-4 md:p-5"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <SpotCheckStatusBadge status={sc.status} />
                      <SpotCheckTypeBadge type={sc.type} />
                      {sc.attachments.length > 0 ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-white/45">
                          <Paperclip className="h-3 w-3" aria-hidden />
                          {sc.attachments.length}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-2 font-semibold text-white">
                      {sc.subject || sc.what_was_wrong.slice(0, 80)}
                    </p>
                    <p className="mt-1 text-sm text-[#B8B4B8]/55">
                      {displayOrDash(sc.exec_va_name)} · {displayOrDash(sc.creator_name)}
                    </p>
                    {sc.what_was_wrong ? (
                      <p className="mt-3 text-sm text-[#B8B4B8]/70">{sc.what_was_wrong}</p>
                    ) : null}
                    {sc.action_taken ? (
                      <p className="mt-2 text-sm text-[#D4AF8C]/70">
                        <span className="text-[#B8B4B8]/45">Action: </span>
                        {sc.action_taken}
                      </p>
                    ) : null}
                    {sc.attachments.length > 0 ? (
                      <div className="mt-3">
                        <AttachmentLinks attachments={sc.attachments} />
                      </div>
                    ) : null}
                    <p className="mt-3 text-xs text-[#B8B4B8]/40">
                      {formatDateTimeAthens(sc.timestamp)}
                      {" · "}
                      <span className="text-white/30">{formatRelativeTime(sc.timestamp)}</span>
                    </p>
                    {resolutionLabel ? (
                      <p className="mt-1 text-xs text-emerald-400/80">Fixed {resolutionLabel}</p>
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
      </section>
    </div>
  );
}
