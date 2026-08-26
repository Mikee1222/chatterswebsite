"use client";

import * as React from "react";
import {
  AlertTriangle,
  CalendarCheck,
  Flag,
  Trophy,
  Users,
} from "lucide-react";
import {
  DailyReviewChecklistPanel,
  DailyReviewVaSummaryChips,
} from "@/components/daily-review-checklist-panel";
import {
  ListPagination,
  useClientPagination,
} from "@/components/earnings-filter-list";
import {
  CountUp,
  LuxuryStatCard,
  StatInfoTooltip,
} from "@/components/infloww-performance-ui";
import {
  FilterBar,
  ManagerReviewSelect,
  ReviewEmptyState,
  ReviewLoadingState,
  ReviewPageEyebrow,
  ReviewSectionHeader,
  VA_BTN_SECONDARY,
  VA_CARD,
  VA_CHAMPAGNE_DIVIDER,
  VA_FILTER_INPUT,
  VA_MODEL_TAG,
  type CustomSelectOption,
} from "@/components/manager-review-ui";
import { useToast } from "@/contexts/toast-context";
import { useSupabaseRealtimeRefresh } from "@/lib/hooks/use-supabase-realtime";
import { formatReviewDate, isoDateDaysAgo, todayReviewIso } from "@/lib/marketing-reviews-helpers";
import { cn } from "@/lib/utils";
import type { AdminDailyReviewChecklistPayload } from "@/services/daily-review-checklist";
import type { MarketingDailyReview } from "@/services/marketing-reviews";
import { DailyReviewAiSummary } from "@/components/daily-review-ai-summary";

const API_BASE = "/api/admin/marketing-reviews/daily-reviews";
const HISTORY_PAGE_SIZE = 12;

type ViewMode = "team" | "supervisor" | "va";

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
  initialReviews: MarketingDailyReview[];
  initialChecklist: AdminDailyReviewChecklistPayload;
};

export function AdminDailyReviewClient({ initialReviews, initialChecklist }: Props) {
  const { addToast } = useToast();
  const [reviews, setReviews] = React.useState(initialReviews);
  const [selectedDate, setSelectedDate] = React.useState(initialChecklist.date || todayReviewIso());
  const [checklist, setChecklist] = React.useState(initialChecklist);
  const [loading, setLoading] = React.useState(false);
  const [viewMode, setViewMode] = React.useState<ViewMode>("team");
  const [focusSupervisorKey, setFocusSupervisorKey] = React.useState("");
  const [focusVaId, setFocusVaId] = React.useState("");
  const [filterSupervisor, setFilterSupervisor] = React.useState("");
  const [filterDateRange, setFilterDateRange] = React.useState<"all" | "7d" | "30d">("all");

  async function loadChecklist(date: string) {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/checklist?date=${encodeURIComponent(date)}`);
      const data = (await res.json()) as {
        checklist?: AdminDailyReviewChecklistPayload;
        error?: string;
      };
      if (!res.ok || !data.checklist) {
        addToast(localToast(`adr-load-${Date.now()}`, "Failed", data.error ?? "Could not load checklist", "high"));
        return;
      }
      setChecklist(data.checklist);
    } finally {
      setLoading(false);
    }
  }

  const selectedDateRef = React.useRef(selectedDate);
  selectedDateRef.current = selectedDate;

  React.useEffect(() => {
    void loadChecklist(selectedDate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate]);

  async function reloadHistory() {
    const params = new URLSearchParams();
    if (filterSupervisor) params.set("manager_name", filterSupervisor);
    if (filterDateRange === "7d") params.set("date_from", isoDateDaysAgo(7));
    if (filterDateRange === "30d") params.set("date_from", isoDateDaysAgo(30));
    const res = await fetch(`${API_BASE}?${params}`);
    const data = (await res.json()) as { reviews?: MarketingDailyReview[] };
    if (res.ok) setReviews(data.reviews ?? []);
  }

  React.useEffect(() => {
    void reloadHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterSupervisor, filterDateRange]);

  const reloadHistoryRef = React.useRef(reloadHistory);
  reloadHistoryRef.current = reloadHistory;

  useSupabaseRealtimeRefresh(
    ["marketing_daily_reviews", "daily_review_item_verifications", "va_task_phase_items"],
    () => {
      void reloadHistoryRef.current();
      void loadChecklist(selectedDateRef.current);
    },
    { debounceMs: 700 },
  );

  const team = checklist.team_summary;
  const supervisorOptions = React.useMemo<CustomSelectOption[]>(() => {
    const names = new Set(reviews.map((r) => r.manager_name).filter(Boolean));
    for (const r of checklist.reviews) names.add(r.review.manager_name);
    return [
      { value: "", label: "All supervisors" },
      ...[...names].sort().map((name) => ({ value: name, label: name })),
    ];
  }, [reviews, checklist.reviews]);

  const focusSupervisorOptions = React.useMemo<CustomSelectOption[]>(() => {
    return [
      { value: "", label: "Select supervisor" },
      ...checklist.reviews.map((r) => ({
        value: r.review.manager_id || r.review.manager_name,
        label: r.review.manager_name || r.review.manager_id,
      })),
    ];
  }, [checklist.reviews]);

  const focusVaOptions = React.useMemo<CustomSelectOption[]>(() => {
    return [
      { value: "", label: "Select VA" },
      ...checklist.shared_vas.map((va) => ({ value: va.va_id, label: va.va_name })),
    ];
  }, [checklist.shared_vas]);

  const pagination = useClientPagination(reviews, HISTORY_PAGE_SIZE);
  React.useEffect(() => {
    pagination.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterSupervisor, filterDateRange, reviews.length]);

  const panelVas = React.useMemo(() => {
    if (viewMode === "supervisor" && focusSupervisorKey) {
      const match = checklist.reviews.find(
        (r) => (r.review.manager_id || r.review.manager_name) === focusSupervisorKey,
      );
      return match?.vas ?? [];
    }
    if (viewMode === "va" && focusVaId) {
      return checklist.shared_vas.filter((va) => va.va_id === focusVaId);
    }
    return checklist.shared_vas;
  }, [viewMode, focusSupervisorKey, focusVaId, checklist]);

  const flaggedItems = React.useMemo(() => {
    const out: Array<{ va_name: string; task_title: string; item_title: string; by: string }> = [];
    for (const va of checklist.shared_vas) {
      for (const task of va.tasks) {
        for (const item of task.items) {
          for (const v of item.verifications) {
            if (v.verified_status !== "flagged_not_done") continue;
            out.push({
              va_name: va.va_name,
              task_title: task.task_title,
              item_title: item.title,
              by: v.verified_by_name || "Supervisor",
            });
          }
        }
      }
    }
    return out;
  }, [checklist.shared_vas]);

  return (
    <div className="mx-auto max-w-5xl space-y-6 md:space-y-8">
      <div>
        <ReviewPageEyebrow>Admin · Marketing</ReviewPageEyebrow>
        <h1 className="mt-1 text-2xl font-bold text-white md:text-3xl">Daily Review Manage</h1>
        <p className="mt-1 text-sm text-[#B8B4B8]/60">
          Team-wide checklist verification overlay — flagged items, supervisor activity, VA leaderboard
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <LuxuryStatCard
          label="Items today"
          value={<CountUp value={team.total_items} />}
          accent="white"
          tooltip="Checklist steps across all VA tasks for this Athens day"
          className="!p-3"
        />
        <LuxuryStatCard
          label="Verified"
          value={<CountUp value={team.verified} />}
          accent="champagne"
          tooltip="Supervisor verify actions for this day"
          className="!p-3"
        />
        <LuxuryStatCard
          label="Flagged"
          value={<CountUp value={team.flagged} />}
          accent="amber"
          tooltip="Items flagged not done"
          className="!p-3"
          glow={team.flagged > 0}
        />
        <LuxuryStatCard
          label="Supervisors"
          value={<CountUp value={team.supervisors} />}
          accent="pink"
          tooltip="Supervisors with a daily review row for this date"
          className="!p-3"
        />
      </div>

      <DailyReviewAiSummary date={selectedDate} />

      <section className={cn(VA_CARD, "flex flex-wrap items-end gap-3 p-4 md:gap-4 md:p-5")}>
        <label className="min-w-[10rem] flex-1 space-y-1.5 text-sm sm:flex-none">
          <span className="inline-flex items-center gap-1 text-[#B8B4B8]/60">
            Audit date
            <StatInfoTooltip text="Athens calendar day for the live VA checklist audit." />
          </span>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className={cn(VA_FILTER_INPUT, "min-h-11 w-full")}
          />
        </label>
        <div className="flex flex-wrap gap-2">
          {(
            [
              { id: "team" as const, label: "Team" },
              { id: "supervisor" as const, label: "By supervisor" },
              { id: "va" as const, label: "By VA" },
            ] as const
          ).map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setViewMode(opt.id)}
              className={cn(
                VA_BTN_SECONDARY,
                "min-h-9 px-3 py-1.5 text-xs",
                viewMode === opt.id && "border-[#FF1493]/45 bg-[#FF1493]/12 text-white",
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
        {viewMode === "supervisor" ? (
          <div className="min-w-[12rem] flex-1">
            <ManagerReviewSelect
              value={focusSupervisorKey}
              onChange={setFocusSupervisorKey}
              options={focusSupervisorOptions}
            />
          </div>
        ) : null}
        {viewMode === "va" ? (
          <div className="min-w-[12rem] flex-1">
            <ManagerReviewSelect value={focusVaId} onChange={setFocusVaId} options={focusVaOptions} />
          </div>
        ) : null}
      </section>

      {flaggedItems.length > 0 ? (
        <section className={cn(VA_CARD, "space-y-3 border-red-500/30 p-4 md:p-5")}>
          <ReviewSectionHeader>
            <span className="inline-flex items-center gap-2 text-red-300">
              <Flag className="h-4 w-4" aria-hidden />
              Flagged items ({flaggedItems.length})
            </span>
          </ReviewSectionHeader>
          <div className="space-y-2">
            {flaggedItems.map((f, i) => (
              <div
                key={`${f.va_name}-${f.item_title}-${i}`}
                className="rounded-xl border border-red-500/25 bg-red-500/[0.07] px-3 py-2.5 text-sm"
              >
                <p className="font-medium text-white">
                  {f.va_name} · {f.item_title}
                </p>
                <p className="mt-0.5 text-xs text-[#B8B4B8]/55">
                  {f.task_title} · flagged by {f.by}
                </p>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <section className={cn(VA_CARD, "space-y-3 p-4 md:p-5")}>
          <ReviewSectionHeader>
            <span className="inline-flex items-center gap-2">
              <Trophy className="h-4 w-4 text-[#D4AF8C]" aria-hidden />
              VAs by flags
            </span>
          </ReviewSectionHeader>
          {checklist.leaderboard.vas_by_flags.length === 0 ? (
            <p className="text-sm text-[#B8B4B8]/45">No verify/flag activity yet for this day.</p>
          ) : (
            <ul className="space-y-2">
              {checklist.leaderboard.vas_by_flags.slice(0, 8).map((va) => (
                <li
                  key={va.va_id}
                  className="flex items-center justify-between gap-2 rounded-lg border border-white/8 bg-white/[0.02] px-3 py-2 text-sm"
                >
                  <button
                    type="button"
                    className="text-left font-medium text-white hover:text-[#FF1493]"
                    onClick={() => {
                      setViewMode("va");
                      setFocusVaId(va.va_id);
                    }}
                  >
                    {va.va_name}
                  </button>
                  <span className="text-xs text-[#B8B4B8]/55">
                    <span className="text-red-300">{va.flagged} flagged</span>
                    {" · "}
                    <span className="text-emerald-300">{va.verified} verified</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className={cn(VA_CARD, "space-y-3 p-4 md:p-5")}>
          <ReviewSectionHeader>
            <span className="inline-flex items-center gap-2">
              <Users className="h-4 w-4 text-[#D4AF8C]" aria-hidden />
              Most active reviewers
            </span>
          </ReviewSectionHeader>
          {checklist.leaderboard.supervisors_by_activity.length === 0 ? (
            <p className="text-sm text-[#B8B4B8]/45">No supervisor reviews for this date yet.</p>
          ) : (
            <ul className="space-y-2">
              {checklist.leaderboard.supervisors_by_activity.map((s) => (
                <li
                  key={s.manager_id || s.manager_name}
                  className="flex items-center justify-between gap-2 rounded-lg border border-white/8 bg-white/[0.02] px-3 py-2 text-sm"
                >
                  <button
                    type="button"
                    className="text-left font-medium text-white hover:text-[#FF1493]"
                    onClick={() => {
                      setViewMode("supervisor");
                      setFocusSupervisorKey(s.manager_id || s.manager_name);
                    }}
                  >
                    {s.manager_name || s.manager_id}
                  </button>
                  <span className="text-xs text-[#B8B4B8]/55">
                    {s.total} reviewed · {s.verified}✓ · {s.flagged}⚑
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <DailyReviewVaSummaryChips vas={checklist.shared_vas} />

      {loading ? (
        <ReviewLoadingState />
      ) : viewMode === "supervisor" && !focusSupervisorKey ? (
        <ReviewEmptyState
          icon={Users}
          title="Pick a supervisor"
          description="See that supervisor’s verify/flag overlay on the day’s VA checklist."
        />
      ) : viewMode === "va" && !focusVaId ? (
        <ReviewEmptyState
          icon={Users}
          title="Pick a VA"
          description="Filter the team checklist down to one VA."
        />
      ) : (
        <DailyReviewChecklistPanel
          mode="admin"
          checklist={null}
          sharedVas={panelVas as AdminDailyReviewChecklistPayload["shared_vas"]}
          readOnly
        />
      )}

      <section className="space-y-3">
        <ReviewSectionHeader>Review submissions</ReviewSectionHeader>
        <FilterBar>
          <div className="min-w-[10rem] flex-1">
            <ManagerReviewSelect
              value={filterSupervisor}
              onChange={setFilterSupervisor}
              options={supervisorOptions}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {(
              [
                { id: "all" as const, label: "All time" },
                { id: "7d" as const, label: "7 days" },
                { id: "30d" as const, label: "30 days" },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setFilterDateRange(opt.id)}
                className={cn(
                  VA_BTN_SECONDARY,
                  "min-h-9 px-3 py-1.5 text-xs",
                  filterDateRange === opt.id && "border-[#FF1493]/45 bg-[#FF1493]/12 text-white",
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </FilterBar>

        {reviews.length === 0 ? (
          <ReviewEmptyState
            icon={CalendarCheck}
            title="No reviews in this filter"
            description="Supervisors create a review when they start verifying checklist items."
          />
        ) : (
          <div className="space-y-2">
            {pagination.pageItems.map((r) => {
              const selected = r.review_date === selectedDate;
              const hasIssues = Boolean(r.issues_found.trim());
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => {
                    setSelectedDate(r.review_date);
                    setViewMode("supervisor");
                    setFocusSupervisorKey(r.manager_id || r.manager_name);
                  }}
                  className={cn(
                    "mr-finding-card va-card w-full rounded-2xl p-4 text-left transition duration-200",
                    selected && "ring-1 ring-[#FF1493]/35 shadow-[0_0_20px_rgba(255,20,147,0.08)]",
                  )}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-white">{r.review_label || formatReviewDate(r.review_date)}</p>
                    <span className={VA_MODEL_TAG}>{r.manager_name}</span>
                    {hasIssues ? (
                      <span className="inline-flex items-center gap-1 rounded-md border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-300">
                        <AlertTriangle className="h-3 w-3" aria-hidden />
                        Notes
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-xs text-[#B8B4B8]/50">{formatReviewDate(r.review_date)}</p>
                  {r.issues_found ? (
                    <p className="mt-3 line-clamp-2 text-sm text-[#B8B4B8]/70">{r.issues_found}</p>
                  ) : null}
                </button>
              );
            })}
            <ListPagination
              page={pagination.page}
              totalPages={pagination.totalPages}
              total={pagination.total}
              pageSize={HISTORY_PAGE_SIZE}
              onPageChange={pagination.setPage}
            />
          </div>
        )}
      </section>

      <div className={VA_CHAMPAGNE_DIVIDER} />
      <p className="text-center text-xs text-[#B8B4B8]/40">
        Checkmarks and flags are supervisor QA overlays — they do not auto-create Mistakes.
      </p>
    </div>
  );
}
