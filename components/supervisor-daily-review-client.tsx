"use client";

import * as React from "react";
import {
  AlertTriangle,
  CalendarCheck,
  Flag,
  MessageSquare,
  Paperclip,
} from "lucide-react";
import {
  DailyReviewChecklistPanel,
  DailyReviewVaSummaryChips,
} from "@/components/daily-review-checklist-panel";
import { DailyReviewMessagesForAllPanel } from "@/components/daily-review-flag-message-panel";
import { DailyReviewFiltersBar } from "@/components/daily-review-filters";
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
  ManagerReviewTextarea,
  ReviewEmptyState,
  ReviewFieldLabel,
  ReviewLoadingState,
  ReviewPageEyebrow,
  ReviewSectionHeader,
  VA_BTN_PRIMARY,
  VA_BTN_SECONDARY,
  VA_CARD,
  VA_FILTER_INPUT,
  VA_MODEL_TAG,
} from "@/components/manager-review-ui";
import { useToast } from "@/contexts/toast-context";
import { dailyReviewFiltersToQueryString, emptyDailyReviewFilters } from "@/lib/daily-review-filters";
import { useDailyReviewFilters } from "@/lib/hooks/use-daily-review-filters";
import { useSupabaseRealtimeRefresh } from "@/lib/hooks/use-supabase-realtime";
import { formatReviewDate, isoDateDaysAgo, todayReviewIso } from "@/lib/marketing-reviews-helpers";
import { cn } from "@/lib/utils";
import type {
  DailyReviewChecklistItem,
  DailyReviewChecklistPayload,
  DailyReviewChecklistVa,
  DailyReviewChecklistVaShared,
} from "@/services/daily-review-checklist";
import type { MarketingDailyReview } from "@/services/marketing-reviews";

const API_BASE = "/api/daily-reviews";
const INFORMED_API = "/api/daily-reviews/flag-informed";
const HISTORY_PAGE_SIZE = 12;

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
  initialSubmissions: MarketingDailyReview[];
  initialChecklist: DailyReviewChecklistPayload;
  initialReview: MarketingDailyReview | null;
  senderFullName: string;
};

export function SupervisorDailyReviewClient({
  initialSubmissions,
  initialChecklist,
  initialReview,
  senderFullName,
}: Props) {
  const { addToast } = useToast();
  const [myReviews, setMyReviews] = React.useState(initialSubmissions);
  const [selectedDate, setSelectedDate] = React.useState(initialChecklist.date || todayReviewIso());
  const [activeReview, setActiveReview] = React.useState<MarketingDailyReview | null>(initialReview);
  const [checklist, setChecklist] = React.useState<DailyReviewChecklistPayload>(initialChecklist);
  const [loading, setLoading] = React.useState(false);
  const [savingNotes, setSavingNotes] = React.useState(false);
  const [busyItemId, setBusyItemId] = React.useState<string | null>(null);
  const [markingInformedVaId, setMarkingInformedVaId] = React.useState<string | null>(null);
  const [messagesForAllOpen, setMessagesForAllOpen] = React.useState(false);
  const [issues, setIssues] = React.useState(initialReview?.issues_found ?? "");
  const [actions, setActions] = React.useState(initialReview?.actions_assigned ?? "");
  const { filters, setFilters } = useDailyReviewFilters(
    "submit",
    initialChecklist.filters ?? emptyDailyReviewFilters(),
  );
  const filtersRef = React.useRef(filters);
  filtersRef.current = filters;

  async function loadDate(date: string, nextFilters = filtersRef.current) {
    setLoading(true);
    try {
      const qs = dailyReviewFiltersToQueryString(nextFilters, date);
      const res = await fetch(`${API_BASE}/checklist?${qs}`);
      const data = (await res.json()) as {
        checklist?: DailyReviewChecklistPayload;
        review?: MarketingDailyReview | null;
        error?: string;
      };
      if (!res.ok || !data.checklist) {
        addToast(localToast(`dr-load-${Date.now()}`, "Failed", data.error ?? "Could not load checklist", "high"));
        return;
      }
      setChecklist(data.checklist);
      setActiveReview(data.review ?? null);
      setIssues(data.review?.issues_found ?? "");
      setActions(data.review?.actions_assigned ?? "");
    } finally {
      setLoading(false);
    }
  }

  const selectedDateRef = React.useRef(selectedDate);
  selectedDateRef.current = selectedDate;

  const skipInitialDateLoad = React.useRef(true);
  React.useEffect(() => {
    if (skipInitialDateLoad.current) {
      skipInitialDateLoad.current = false;
      return;
    }
    void loadDate(selectedDate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate]);

  const filterHydrated = React.useRef(false);
  React.useEffect(() => {
    if (!filterHydrated.current) {
      filterHydrated.current = true;
      const ssrFilters = initialChecklist.filters ?? emptyDailyReviewFilters();
      if (
        dailyReviewFiltersToQueryString(filters) !==
        dailyReviewFiltersToQueryString(ssrFilters)
      ) {
        void loadDate(selectedDateRef.current, filters);
      }
      return;
    }
    void loadDate(selectedDateRef.current, filters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  async function reloadHistory() {
    const res = await fetch(API_BASE);
    const data = (await res.json()) as { reviews?: MarketingDailyReview[] };
    if (res.ok) setMyReviews(data.reviews ?? []);
  }

  const reloadHistoryRef = React.useRef(reloadHistory);
  reloadHistoryRef.current = reloadHistory;

  useSupabaseRealtimeRefresh(
    [
      "marketing_daily_reviews",
      "daily_review_item_verifications",
      "daily_review_flag_informed",
      "va_task_phase_items",
    ],
    () => {
      void reloadHistoryRef.current();
      void loadDate(selectedDateRef.current);
    },
    { debounceMs: 700 },
  );

  const summary = checklist.summary;
  const historyStats = React.useMemo(() => {
    const weekFrom = isoDateDaysAgo(7);
    let withIssues = 0;
    let thisWeek = 0;
    for (const r of myReviews) {
      if (r.issues_found.trim()) withIssues += 1;
      if (r.review_date >= weekFrom) thisWeek += 1;
    }
    return { total: myReviews.length, withIssues, thisWeek };
  }, [myReviews]);

  const pagination = useClientPagination(myReviews, HISTORY_PAGE_SIZE);
  React.useEffect(() => {
    pagination.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myReviews.length]);

  async function ensureReviewAndSet(): Promise<string | null> {
    if (activeReview?.id) return activeReview.id;
    const res = await fetch(`${API_BASE}/checklist`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date: selectedDate, filters }),
    });
    const data = (await res.json()) as {
      review?: MarketingDailyReview;
      checklist?: DailyReviewChecklistPayload;
      error?: string;
    };
    if (!res.ok || !data.review) {
      addToast(localToast(`dr-ens-${Date.now()}`, "Failed", data.error ?? "Could not start review", "high"));
      return null;
    }
    setActiveReview(data.review);
    if (data.checklist) setChecklist(data.checklist);
    await reloadHistory();
    return data.review.id;
  }

  async function setItemStatus(
    item: DailyReviewChecklistItem,
    va: { va_id: string; va_name: string },
    verified_status: "verified" | "flagged_not_done",
  ) {
    setBusyItemId(item.item_id);
    try {
      const reviewId = await ensureReviewAndSet();
      if (!reviewId) return;
      const res = await fetch(`${API_BASE}/verifications`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: selectedDate,
          review_id: reviewId,
          task_phase_item_id: item.item_id,
          verified_status,
          va_id: va.va_id,
          va_name: va.va_name,
          task_id: item.task_id,
          phase_id: item.phase_id,
          item_title: item.title,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        addToast(localToast(`dr-v-${Date.now()}`, "Failed", data.error ?? "Could not save verification", "high"));
        return;
      }
      await loadDate(selectedDate);
    } finally {
      setBusyItemId(null);
    }
  }

  async function clearItem(item: DailyReviewChecklistItem) {
    if (!activeReview) return;
    setBusyItemId(item.item_id);
    try {
      const res = await fetch(`${API_BASE}/verifications`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          review_id: activeReview.id,
          task_phase_item_id: item.item_id,
        }),
      });
      if (!res.ok) {
        addToast(localToast(`dr-c-${Date.now()}`, "Failed", "Could not clear verification", "high"));
        return;
      }
      await loadDate(selectedDate);
    } finally {
      setBusyItemId(null);
    }
  }

  async function saveNotes() {
    setSavingNotes(true);
    try {
      const reviewId = await ensureReviewAndSet();
      if (!reviewId) return;
      const res = await fetch(`${API_BASE}/${reviewId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          issues_found: issues,
          actions_assigned: actions,
        }),
      });
      if (!res.ok) {
        addToast(localToast(`dr-notes-${Date.now()}`, "Failed", "Could not save notes", "high"));
        return;
      }
      await reloadHistory();
      addToast(localToast(`dr-notes-ok-${Date.now()}`, "Saved", "Notes updated.", "normal"));
    } finally {
      setSavingNotes(false);
    }
  }

  async function markInformed(va: DailyReviewChecklistVa | DailyReviewChecklistVaShared) {
    setMarkingInformedVaId(va.va_id);
    try {
      const res = await fetch(INFORMED_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: selectedDate,
          va_id: va.va_id,
          va_name: va.va_name,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        addToast(
          localToast(`dr-inf-${Date.now()}`, "Failed", data.error ?? "Could not mark informed", "high"),
        );
        return;
      }
      await loadDate(selectedDate);
      addToast(localToast(`dr-inf-ok-${Date.now()}`, "Informed", `${va.va_name} marked informed.`, "normal"));
    } finally {
      setMarkingInformedVaId(null);
    }
  }

  const flaggedPeople = checklist.vas.filter((v) => v.stats.flagged > 0).length;

  return (
    <div className="mx-auto max-w-4xl space-y-6 md:space-y-8">
      <div>
        <ReviewPageEyebrow>Supervision</ReviewPageEyebrow>
        <h1 className="mt-1 text-2xl font-bold text-white md:text-3xl">Daily Review</h1>
        <p className="mt-1 text-sm text-[#B8B4B8]/60">
          Live audit of every VA checklist item for the selected day — verify done or flag as not done
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <LuxuryStatCard
          label="Verified"
          value={
            <span className="tabular-nums">
              <CountUp value={summary.verified} />
              <span className="text-sm font-medium text-[#B8B4B8]/45">
                {" "}
                / {summary.total_items}
              </span>
            </span>
          }
          accent="champagne"
          tooltip="Verified of checklist items in the current filtered set"
          className="!p-3"
        />
        <LuxuryStatCard
          label="Flagged"
          value={<CountUp value={summary.flagged} />}
          accent="amber"
          tooltip="Items flagged as not done (filtered set)"
          className="!p-3"
          glow={summary.flagged > 0}
        />
        <LuxuryStatCard
          label="Pending"
          value={<CountUp value={summary.unverified} />}
          accent="pink"
          tooltip="Items still waiting for your verify/flag (filtered set)"
          className="!p-3"
        />
        <LuxuryStatCard
          label="Overdue"
          value={<CountUp value={summary.overdue ?? 0} />}
          accent="white"
          tooltip="Incomplete items in overdue phases (filtered set)"
          className="!p-3"
          glow={(summary.overdue ?? 0) > 0}
        />
      </div>

      <DailyReviewVaSummaryChips vas={checklist.vas} />

      <section className={cn(VA_CARD, "flex flex-wrap items-end gap-3 p-4 md:gap-4 md:p-5")}>
        <label className="min-w-[10rem] flex-1 space-y-1.5 text-sm sm:flex-none">
          <span className="inline-flex items-center gap-1 text-[#B8B4B8]/60">
            Review date
            <StatInfoTooltip text="Athens calendar day. Defaults to today; go back to audit earlier shifts." />
          </span>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className={cn(VA_FILTER_INPUT, "min-h-11 w-full")}
          />
        </label>
        {activeReview ? (
          <span className={cn(VA_MODEL_TAG, "self-center")}>Review open · {activeReview.manager_name}</span>
        ) : (
          <button
            type="button"
            onClick={() => void ensureReviewAndSet()}
            className={cn(VA_BTN_PRIMARY, "min-h-11")}
          >
            Start review for this date
          </button>
        )}
      </section>

      <DailyReviewFiltersBar
        filters={filters}
        facets={checklist.facets ?? { roles: [], people: [], models: [], phases: [], platforms: [], item_types: [] }}
        onChange={setFilters}
      />

      {flaggedPeople > 0 ? (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setMessagesForAllOpen(true)}
            className={cn(VA_BTN_SECONDARY, "inline-flex min-h-10 items-center gap-2 px-3 text-xs")}
          >
            <MessageSquare className="h-3.5 w-3.5" aria-hidden />
            Messages for all ({flaggedPeople})
          </button>
        </div>
      ) : null}

      {loading ? (
        <ReviewLoadingState />
      ) : (
        <>
          <DailyReviewChecklistPanel
            mode="supervisor"
            checklist={checklist}
            busyItemId={busyItemId}
            onVerify={(item, va) => void setItemStatus(item, va, "verified")}
            onFlag={(item, va) => void setItemStatus(item, va, "flagged_not_done")}
            onClear={(item) => void clearItem(item)}
            canMessage
            reviewDate={selectedDate}
            senderFullName={senderFullName}
            markingInformedVaId={markingInformedVaId}
            onMarkInformed={(va) => void markInformed(va)}
          />

          <section className={cn(VA_CARD, "space-y-4 p-4 md:p-5")}>
            <ReviewSectionHeader>Overall notes</ReviewSectionHeader>
            <label className="block space-y-1.5 text-sm">
              <ReviewFieldLabel>Issues found</ReviewFieldLabel>
              <ManagerReviewTextarea
                value={issues}
                onChange={(e) => setIssues(e.target.value)}
                placeholder="Optional free-text notes for the day…"
              />
            </label>
            <label className="block space-y-1.5 text-sm">
              <ReviewFieldLabel>Actions assigned</ReviewFieldLabel>
              <ManagerReviewTextarea
                value={actions}
                onChange={(e) => setActions(e.target.value)}
                placeholder="Optional follow-ups…"
              />
            </label>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => void saveNotes()}
                disabled={savingNotes}
                className={cn(VA_BTN_SECONDARY, "min-h-10")}
              >
                {savingNotes ? "Saving…" : "Save notes"}
              </button>
            </div>
          </section>
        </>
      )}

      <section className="space-y-3">
        <ReviewSectionHeader>My review history</ReviewSectionHeader>
        <div className="grid grid-cols-3 gap-2 text-center text-xs text-[#B8B4B8]/50 sm:hidden">
          <span>{historyStats.total} total</span>
          <span>{historyStats.withIssues} issues</span>
          <span>{historyStats.thisWeek} this week</span>
        </div>
        {myReviews.length === 0 ? (
          <ReviewEmptyState
            icon={CalendarCheck}
            title="No past reviews yet"
            description="Verifying or flagging an item auto-creates your review for that day."
          />
        ) : (
          <div className="space-y-2">
            {pagination.pageItems.map((r) => {
              const selected = r.review_date === selectedDate;
              const hasIssues = Boolean(r.issues_found.trim());
              const hasAtt = r.attachments.length > 0;
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setSelectedDate(r.review_date)}
                  className={cn(
                    "mr-finding-card va-card w-full rounded-2xl p-4 text-left transition duration-200 motion-reduce:transition-none active:bg-white/[0.04]",
                    selected && "ring-1 ring-[#FF1493]/35 shadow-[0_0_20px_rgba(255,20,147,0.08)]",
                  )}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-white">{r.review_label || formatReviewDate(r.review_date)}</p>
                    {hasIssues ? (
                      <span className="inline-flex items-center gap-1 rounded-md border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-300">
                        <AlertTriangle className="h-3 w-3" aria-hidden />
                        Notes
                      </span>
                    ) : null}
                    {hasAtt ? (
                      <span className="inline-flex items-center gap-1 rounded-md border border-[#D4AF8C]/25 bg-[#D4AF8C]/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#D4AF8C]">
                        <Paperclip className="h-3 w-3" aria-hidden />
                        {r.attachments.length}
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

      {summary.flagged > 0 ? (
        <p className="flex items-center justify-center gap-2 text-xs text-red-300/80">
          <Flag className="h-3.5 w-3.5" aria-hidden />
          {summary.flagged} flagged item{summary.flagged === 1 ? "" : "s"} on this day
        </p>
      ) : null}

      <DailyReviewMessagesForAllPanel
        open={messagesForAllOpen}
        onClose={() => setMessagesForAllOpen(false)}
        vas={checklist.vas}
        reviewDate={selectedDate}
        senderFullName={senderFullName}
        markingVaId={markingInformedVaId}
        onMarkInformed={(va) => void markInformed(va)}
      />
    </div>
  );
}
