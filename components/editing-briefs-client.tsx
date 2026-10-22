"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Archive,
  Check,
  MessageSquare,
  Plus,
  RotateCcw,
  Send,
} from "lucide-react";
import { EditingBriefView } from "@/components/editing-brief-view";
import { useToast } from "@/contexts/toast-context";
import { winnerVideoLocalToast } from "@/components/winner-videos-shared";
import { ROUTES } from "@/lib/routes";
import { cn } from "@/lib/utils";
import type { EditingBrief, EditingBriefStatus } from "@/services/editing-briefs";
import {
  BriefBoardColumn,
  BriefCard,
  BriefCardSkeleton,
  BriefConfirmAction,
  BriefEmptyState,
  BriefFilterToolbar,
  BriefPageHeader,
  BriefStatsRow,
  BriefStickyActionBar,
  BriefTextArea,
  computeBriefListStats,
  filterByDeadlineWindow,
  sortBriefsByUrgencyThenDeadline,
  VA_BTN_PRIMARY,
  VA_BTN_SECONDARY,
  VA_CARD,
  VA_FILTER_INPUT,
} from "@/components/briefs/shared";

type ModelOption = { id: string; model_name: string };
type EditorOption = { id: string; full_name: string };

type Props = {
  initialBriefs: EditingBrief[];
  canManage: boolean;
  canViewAssigned: boolean;
  canReview: boolean;
  models: ModelOption[];
  editors: EditorOption[];
  modelNameById: Record<string, string>;
  editorNameById: Record<string, string>;
};

type DeadlineFilter = "" | "today" | "week" | "overdue";
type SortMode = "urgency_deadline" | "deadline" | "title";

export function EditingBriefsClient({
  initialBriefs,
  canManage,
  canViewAssigned,
  canReview,
  models,
  editors,
  modelNameById,
  editorNameById,
}: Props) {
  const router = useRouter();
  const { addToast } = useToast();
  const [briefs, setBriefs] = React.useState(initialBriefs);
  const [status, setStatus] = React.useState(canManage || canReview ? "all" : "active");
  const [modelFilter, setModelFilter] = React.useState("");
  const [editorFilter, setEditorFilter] = React.useState("");
  const [urgentOnly, setUrgentOnly] = React.useState(false);
  const [deadlineFilter, setDeadlineFilter] = React.useState<DeadlineFilter>("");
  const [search, setSearch] = React.useState("");
  const [sortMode, setSortMode] = React.useState<SortMode>("urgency_deadline");
  const [viewMode, setViewMode] = React.useState<"list" | "board">("list");
  const [loading, setLoading] = React.useState(false);
  const [selectedId, setSelectedId] = React.useState<string | null>(
    initialBriefs[0]?.id ?? null,
  );
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [reviewComment, setReviewComment] = React.useState("");
  const [showChangesForm, setShowChangesForm] = React.useState(false);
  const [confirmDeliver, setConfirmDeliver] = React.useState(false);

  const selected = briefs.find((b) => b.id === selectedId) ?? null;

  const reload = React.useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("status", status);
      if (modelFilter) params.set("model_id", modelFilter);
      if (urgentOnly) params.set("priority", "urgent");
      const res = await fetch(`/api/editing-briefs?${params.toString()}`);
      const data = (await res.json()) as { briefs?: EditingBrief[]; error?: string };
      if (!res.ok) throw new Error(data.error || "Failed to load");
      setBriefs(data.briefs ?? []);
      setSelectedId((prev) => {
        const list = data.briefs ?? [];
        if (prev && list.some((b) => b.id === prev)) return prev;
        return list[0]?.id ?? null;
      });
    } catch (e) {
      addToast(
        winnerVideoLocalToast(
          `eb-load-${Date.now()}`,
          "Could not load briefs",
          e instanceof Error ? e.message : "Try again",
          "high",
        ),
      );
    } finally {
      setLoading(false);
    }
  }, [status, modelFilter, urgentOnly, addToast]);

  React.useEffect(() => {
    void reload();
  }, [reload]);

  const filtered = React.useMemo(() => {
    let list = briefs;
    const q = search.trim().toLowerCase();
    if (q) list = list.filter((b) => (b.title || "").toLowerCase().includes(q));
    if (editorFilter) {
      list = list.filter((b) => b.assigned_editor_id === editorFilter);
    }
    list = filterByDeadlineWindow(list, deadlineFilter);
    if (sortMode === "urgency_deadline") list = sortBriefsByUrgencyThenDeadline(list);
    else if (sortMode === "deadline") {
      list = [...list].sort((a, b) => {
        const da = a.deadline_at ? new Date(a.deadline_at).getTime() : Number.POSITIVE_INFINITY;
        const db = b.deadline_at ? new Date(b.deadline_at).getTime() : Number.POSITIVE_INFINITY;
        return da - db;
      });
    } else {
      list = [...list].sort((a, b) => (a.title || "").localeCompare(b.title || ""));
    }
    return list;
  }, [briefs, search, editorFilter, deadlineFilter, sortMode]);

  const stats = React.useMemo(
    () =>
      computeBriefListStats(briefs, {
        isActive: (b) =>
          b.status === "published" ||
          b.status === "delivered" ||
          b.status === "changes_needed",
        awaitingDelivery: (b) =>
          b.status === "published" || b.status === "changes_needed",
        awaitingReview: (b) => b.status === "delivered",
      }),
    [briefs],
  );

  const setStatusFor = async (
    id: string,
    next: EditingBriefStatus,
    reviewer_comment?: string,
  ) => {
    setBusyId(id);
    try {
      const res = await fetch(`/api/editing-briefs/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next, reviewer_comment }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error || "Failed");
      addToast(
        winnerVideoLocalToast(
          `eb-status-${Date.now()}`,
          "Updated",
          next.replace(/_/g, " "),
          "normal",
        ),
      );
      setShowChangesForm(false);
      setReviewComment("");
      await reload();
      router.refresh();
    } catch (e) {
      addToast(
        winnerVideoLocalToast(
          `eb-status-e-${Date.now()}`,
          "Update failed",
          e instanceof Error ? e.message : "Try again",
          "high",
        ),
      );
    } finally {
      setBusyId(null);
      setConfirmDeliver(false);
    }
  };

  const duplicate = async (id: string) => {
    setBusyId(id);
    try {
      const res = await fetch(`/api/editing-briefs/${encodeURIComponent(id)}/duplicate`, {
        method: "POST",
      });
      const data = (await res.json()) as { brief?: EditingBrief; error?: string };
      if (!res.ok || !data.brief) throw new Error(data.error || "Failed");
      addToast(winnerVideoLocalToast(`eb-dup-${Date.now()}`, "Duplicated", "Brief copied", "normal"));
      router.push(ROUTES.editingBriefEdit(data.brief.id));
    } catch (e) {
      addToast(
        winnerVideoLocalToast(
          `eb-dup-e-${Date.now()}`,
          "Duplicate failed",
          e instanceof Error ? e.message : "Try again",
          "high",
        ),
      );
    } finally {
      setBusyId(null);
    }
  };

  const chips = [
    modelFilter
      ? {
          key: "model",
          label: models.find((m) => m.id === modelFilter)?.model_name || "Model",
          clear: () => setModelFilter(""),
        }
      : null,
    editorFilter
      ? {
          key: "editor",
          label: editors.find((e) => e.id === editorFilter)?.full_name || "Editor",
          clear: () => setEditorFilter(""),
        }
      : null,
    status !== (canManage || canReview ? "all" : "active")
      ? {
          key: "status",
          label: `Status: ${status}`,
          clear: () => setStatus(canManage || canReview ? "all" : "active"),
        }
      : null,
    urgentOnly ? { key: "urgent", label: "Urgent", clear: () => setUrgentOnly(false) } : null,
    deadlineFilter
      ? {
          key: "deadline",
          label: `Deadline: ${deadlineFilter}`,
          clear: () => setDeadlineFilter(""),
        }
      : null,
    search.trim()
      ? { key: "search", label: `“${search.trim()}”`, clear: () => setSearch("") }
      : null,
  ].filter(Boolean) as { key: string; label: string; clear: () => void }[];

  const filterControls = (
    <>
      {canManage || canReview ? (
        <div>
          <label className="mb-1 block text-[10px] uppercase tracking-wider text-white/40">
            Status
          </label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className={cn(VA_FILTER_INPUT, "min-h-11")}
          >
            <option value="all">All</option>
            <option value="draft">Draft</option>
            <option value="published">Published</option>
            <option value="delivered">Delivered</option>
            <option value="changes_needed">Changes needed</option>
            <option value="approved">Approved</option>
            <option value="archived">Archived</option>
            <option value="active">Active</option>
          </select>
        </div>
      ) : null}
      {canManage || canReview ? (
        <div>
          <label className="mb-1 block text-[10px] uppercase tracking-wider text-white/40">
            Model
          </label>
          <select
            value={modelFilter}
            onChange={(e) => setModelFilter(e.target.value)}
            className={cn(VA_FILTER_INPUT, "min-h-11")}
          >
            <option value="">All models</option>
            {models.map((m) => (
              <option key={m.id} value={m.id}>
                {m.model_name}
              </option>
            ))}
          </select>
        </div>
      ) : null}
      {canManage || canReview ? (
        <div>
          <label className="mb-1 block text-[10px] uppercase tracking-wider text-white/40">
            Assigned editor
          </label>
          <select
            value={editorFilter}
            onChange={(e) => setEditorFilter(e.target.value)}
            className={cn(VA_FILTER_INPUT, "min-h-11")}
          >
            <option value="">All editors</option>
            {editors.map((e) => (
              <option key={e.id} value={e.id}>
                {e.full_name}
              </option>
            ))}
          </select>
        </div>
      ) : null}
      <div>
        <label className="mb-1 block text-[10px] uppercase tracking-wider text-white/40">
          Deadline
        </label>
        <select
          value={deadlineFilter}
          onChange={(e) => setDeadlineFilter(e.target.value as DeadlineFilter)}
          className={cn(VA_FILTER_INPUT, "min-h-11")}
        >
          <option value="">Any</option>
          <option value="today">Due today</option>
          <option value="week">This week</option>
          <option value="overdue">Overdue</option>
        </select>
      </div>
      <label className="inline-flex min-h-11 items-center gap-2 text-sm text-white/70">
        <input
          type="checkbox"
          checked={urgentOnly}
          onChange={(e) => setUrgentOnly(e.target.checked)}
          className="h-5 w-5 rounded border-white/20"
        />
        Urgent only
      </label>
    </>
  );

  const boardColumns: { id: EditingBriefStatus; label: string }[] = [
    { id: "draft", label: "Draft" },
    { id: "published", label: "Published" },
    { id: "delivered", label: "Delivered" },
    { id: "changes_needed", label: "Changes needed" },
    { id: "approved", label: "Approved" },
    { id: "archived", label: "Archived" },
  ];

  const canMarkDelivered =
    canViewAssigned &&
    selected &&
    (selected.status === "published" || selected.status === "changes_needed");
  const deliverDisabledReason = !canViewAssigned
    ? "Only the assigned editor can mark Delivered"
    : selected &&
        selected.status !== "published" &&
        selected.status !== "changes_needed"
      ? "Delivered is only available from Published or Changes needed"
      : null;

  return (
    <div className="space-y-6">
      <BriefPageHeader
        eyebrow="Content pipeline"
        title="Editing Briefs"
        description={
          canManage
            ? "Create and assign structured edit briefs"
            : canReview
              ? "Review delivered edits"
              : "Your assigned editing briefs"
        }
        action={
          canManage ? (
            <Link
              href={ROUTES.editingBriefNew}
              className={cn(VA_BTN_PRIMARY, "inline-flex min-h-12 items-center gap-2 px-5")}
            >
              <Plus className="h-4 w-4" /> New brief
            </Link>
          ) : null
        }
      />

      <BriefStatsRow
        stats={[
          { label: "Active", value: stats.active, accent: "champagne" },
          { label: "Urgent", value: stats.urgent, accent: "pink" },
          { label: "Due today", value: stats.dueToday, accent: "amber" },
          { label: "Overdue", value: stats.overdue, accent: "pink" },
          {
            label: "Awaiting delivery",
            value: stats.awaitingDelivery,
            accent: "emerald",
          },
          {
            label: "Awaiting review",
            value: stats.awaitingReview,
            accent: "champagne",
          },
        ]}
      />

      <BriefFilterToolbar
        search={search}
        onSearchChange={setSearch}
        chips={chips}
        onClearAll={() => {
          setSearch("");
          setModelFilter("");
          setEditorFilter("");
          setUrgentOnly(false);
          setDeadlineFilter("");
          setStatus(canManage || canReview ? "all" : "active");
        }}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        showBoard={canManage || canReview}
        filterControls={filterControls}
        sortControl={
          <div>
            <label className="mb-1 block text-[10px] uppercase tracking-wider text-white/40">
              Sort
            </label>
            <select
              value={sortMode}
              onChange={(e) => setSortMode(e.target.value as SortMode)}
              className={cn(VA_FILTER_INPUT, "min-h-11")}
            >
              <option value="urgency_deadline">Urgent → deadline</option>
              <option value="deadline">Deadline</option>
              <option value="title">Title</option>
            </select>
          </div>
        }
      />

      {loading && !briefs.length ? (
        <BriefCardSkeleton />
      ) : viewMode === "board" && (canManage || canReview) ? (
        <div className="flex gap-3 overflow-x-auto pb-2">
          {boardColumns.map((col) => {
            const items = filtered.filter((b) => b.status === col.id);
            return (
              <BriefBoardColumn key={col.id} title={col.label} count={items.length}>
                {items.map((b) => (
                  <BriefCard
                    key={b.id}
                    selected={selectedId === b.id}
                    onClick={() => {
                      setSelectedId(b.id);
                      setShowChangesForm(false);
                    }}
                    title={b.title}
                    modelName={modelNameById[b.model_id]}
                    priority={b.priority}
                    status={b.status}
                    deadlineAt={b.deadline_at}
                    progressHint={`${b.videos.length} video${b.videos.length === 1 ? "" : "s"}`}
                  />
                ))}
              </BriefBoardColumn>
            );
          })}
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,22rem)_1fr]">
          <ul className="space-y-2">
            {filtered.length === 0 ? (
              <li>
                <BriefEmptyState title="No briefs match these filters" />
              </li>
            ) : (
              filtered.map((b) => (
                <li key={b.id}>
                  <BriefCard
                    selected={selectedId === b.id}
                    onClick={() => {
                      setSelectedId(b.id);
                      setShowChangesForm(false);
                    }}
                    title={b.title}
                    modelName={modelNameById[b.model_id]}
                    priority={b.priority}
                    status={b.status}
                    deadlineAt={b.deadline_at}
                    progressHint={`${b.videos.length} video${b.videos.length === 1 ? "" : "s"}`}
                  />
                </li>
              ))
            )}
          </ul>

          <div className={cn(VA_CARD, "p-4 md:p-6")}>
            {!selected ? (
              <BriefEmptyState title="Select a brief" />
            ) : (
              <div className="space-y-4">
                {canManage ? (
                  <div className="flex flex-wrap gap-2">
                    <Link
                      href={ROUTES.editingBriefEdit(selected.id)}
                      className={cn(VA_BTN_SECONDARY, "min-h-11 px-4")}
                    >
                      Edit
                    </Link>
                    <Link
                      href={ROUTES.editingBrief(selected.id)}
                      className={cn(VA_BTN_SECONDARY, "min-h-11 px-4")}
                    >
                      Open
                    </Link>
                    <button
                      type="button"
                      disabled={busyId === selected.id}
                      className={cn(VA_BTN_SECONDARY, "min-h-11 px-4")}
                      onClick={() => void duplicate(selected.id)}
                    >
                      Duplicate
                    </button>
                    {selected.status !== "archived" ? (
                      <button
                        type="button"
                        disabled={busyId === selected.id}
                        className={cn(
                          VA_BTN_SECONDARY,
                          "inline-flex min-h-11 items-center gap-2 px-4",
                        )}
                        onClick={() => void setStatusFor(selected.id, "archived")}
                      >
                        <Archive className="h-4 w-4" /> Archive
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={busyId === selected.id}
                        className={cn(
                          VA_BTN_SECONDARY,
                          "inline-flex min-h-11 items-center gap-2 px-4",
                        )}
                        onClick={() => void setStatusFor(selected.id, "draft")}
                      >
                        <RotateCcw className="h-4 w-4" /> Restore draft
                      </button>
                    )}
                    {selected.status === "approved" ? (
                      <Link
                        href={`${ROUTES.postingBriefNew}?from_editing=${encodeURIComponent(selected.id)}`}
                        className={cn(VA_BTN_PRIMARY, "min-h-11 px-4")}
                      >
                        Create Posting Brief
                      </Link>
                    ) : null}
                  </div>
                ) : null}

                {canViewAssigned ? (
                  <BriefStickyActionBar disabledReason={deliverDisabledReason}>
                    <button
                      type="button"
                      disabled={busyId === selected.id || !canMarkDelivered}
                      className={cn(
                        VA_BTN_PRIMARY,
                        "inline-flex min-h-12 flex-1 items-center justify-center gap-2 px-5 disabled:opacity-40",
                      )}
                      onClick={() => setConfirmDeliver(true)}
                    >
                      <Send className="h-4 w-4" /> Delivered
                    </button>
                  </BriefStickyActionBar>
                ) : null}

                {canReview && selected.status === "delivered" ? (
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={busyId === selected.id}
                      className={cn(
                        VA_BTN_PRIMARY,
                        "inline-flex min-h-12 items-center gap-2 px-5",
                      )}
                      onClick={() => void setStatusFor(selected.id, "approved")}
                    >
                      <Check className="h-4 w-4" /> Approved
                    </button>
                    <button
                      type="button"
                      className={cn(
                        VA_BTN_SECONDARY,
                        "inline-flex min-h-12 items-center gap-2 px-5",
                      )}
                      onClick={() => setShowChangesForm(true)}
                    >
                      <MessageSquare className="h-4 w-4" /> Changes needed
                    </button>
                  </div>
                ) : null}

                {showChangesForm ? (
                  <div className="space-y-3 rounded-2xl border border-amber-400/30 bg-amber-500/10 p-4">
                    <p className="text-sm font-medium text-amber-100">
                      Comment required for Changes needed
                    </p>
                    <BriefTextArea
                      value={reviewComment}
                      onChange={(e) => setReviewComment(e.target.value)}
                      placeholder="What needs to change…"
                    />
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={busyId === selected.id || !reviewComment.trim()}
                        className={cn(VA_BTN_PRIMARY, "min-h-11 px-4")}
                        onClick={() =>
                          void setStatusFor(selected.id, "changes_needed", reviewComment)
                        }
                      >
                        Send changes
                      </button>
                      <button
                        type="button"
                        className={cn(VA_BTN_SECONDARY, "min-h-11 px-4")}
                        onClick={() => setShowChangesForm(false)}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : null}

                <EditingBriefView
                  brief={selected}
                  modelName={modelNameById[selected.model_id]}
                  editorName={editorNameById[selected.assigned_editor_id]}
                />
              </div>
            )}
          </div>
        </div>
      )}

      <BriefConfirmAction
        open={confirmDeliver}
        onClose={() => setConfirmDeliver(false)}
        onConfirm={async () => {
          if (selected) await setStatusFor(selected.id, "delivered");
        }}
        title="Mark as Delivered?"
        description="Confirm that finals for this brief have been uploaded for review."
        confirmLabel="Mark Delivered"
        loading={busyId === selected?.id}
      />
    </div>
  );
}
