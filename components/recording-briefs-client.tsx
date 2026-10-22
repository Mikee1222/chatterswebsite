"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Archive,
  Plus,
  RotateCcw,
  Upload,
} from "lucide-react";
import { RecordingBriefView } from "@/components/recording-brief-view";
import { useToast } from "@/contexts/toast-context";
import { winnerVideoLocalToast } from "@/components/winner-videos-shared";
import { ROUTES } from "@/lib/routes";
import { cn } from "@/lib/utils";
import type { RecordingBrief, RecordingBriefStatus } from "@/services/recording-briefs";
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
  computeBriefListStats,
  filterByDeadlineWindow,
  sortBriefsByUrgencyThenDeadline,
  VA_BTN_PRIMARY,
  VA_BTN_SECONDARY,
  VA_CARD,
  VA_FILTER_INPUT,
} from "@/components/briefs/shared";

type ModelOption = { id: string; model_name: string };

type Props = {
  initialBriefs: RecordingBrief[];
  canManage: boolean;
  canViewOwn: boolean;
  models: ModelOption[];
  modelNameById: Record<string, string>;
  reminderLeadHours?: number;
};

type DeadlineFilter = "" | "today" | "week" | "overdue";
type SortMode = "urgency_deadline" | "deadline" | "title";

export function RecordingBriefsClient({
  initialBriefs,
  canManage,
  canViewOwn,
  models,
  modelNameById,
  reminderLeadHours = 3,
}: Props) {
  const router = useRouter();
  const { addToast } = useToast();
  const [briefs, setBriefs] = React.useState(initialBriefs);
  const [status, setStatus] = React.useState<string>(canManage ? "all" : "active");
  const [modelFilter, setModelFilter] = React.useState("");
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
  const [leadHours, setLeadHours] = React.useState(String(reminderLeadHours));
  const [confirmUpload, setConfirmUpload] = React.useState(false);

  const selected = briefs.find((b) => b.id === selectedId) ?? null;

  const reload = React.useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("status", status);
      if (modelFilter) params.set("model_id", modelFilter);
      if (urgentOnly) params.set("priority", "urgent");
      const res = await fetch(`/api/recording-briefs?${params.toString()}`);
      const data = (await res.json()) as { briefs?: RecordingBrief[]; error?: string };
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
          `rb-load-${Date.now()}`,
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
  }, [briefs, search, deadlineFilter, sortMode]);

  const stats = React.useMemo(
    () =>
      computeBriefListStats(briefs, {
        isActive: (b) => b.status === "published" || b.status === "uploaded",
        awaitingUpload: (b) => b.status === "published",
      }),
    [briefs],
  );

  const setStatusFor = async (id: string, next: RecordingBriefStatus) => {
    setBusyId(id);
    try {
      const res = await fetch(`/api/recording-briefs/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error || "Failed");
      addToast(
        winnerVideoLocalToast(
          `rb-status-${Date.now()}`,
          next === "uploaded" ? "Marked Uploaded" : next === "archived" ? "Archived" : "Updated",
          "",
          "normal",
        ),
      );
      await reload();
      router.refresh();
    } catch (e) {
      addToast(
        winnerVideoLocalToast(
          `rb-status-e-${Date.now()}`,
          "Update failed",
          e instanceof Error ? e.message : "Try again",
          "high",
        ),
      );
    } finally {
      setBusyId(null);
      setConfirmUpload(false);
    }
  };

  const duplicate = async (id: string) => {
    setBusyId(id);
    try {
      const res = await fetch(`/api/recording-briefs/${encodeURIComponent(id)}/duplicate`, {
        method: "POST",
      });
      const data = (await res.json()) as { brief?: RecordingBrief; error?: string };
      if (!res.ok || !data.brief) throw new Error(data.error || "Failed");
      addToast(winnerVideoLocalToast(`rb-dup-${Date.now()}`, "Duplicated", "Brief copied", "normal"));
      router.push(ROUTES.recordingBriefEdit(data.brief.id));
    } catch (e) {
      addToast(
        winnerVideoLocalToast(
          `rb-dup-e-${Date.now()}`,
          "Duplicate failed",
          e instanceof Error ? e.message : "Try again",
          "high",
        ),
      );
    } finally {
      setBusyId(null);
    }
  };

  const saveLead = async () => {
    try {
      const res = await fetch("/api/brief-reminder-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lead_hours: Number(leadHours) }),
      });
      const data = (await res.json()) as { lead_hours?: number; error?: string };
      if (!res.ok) throw new Error(data.error || "Failed");
      setLeadHours(String(data.lead_hours ?? leadHours));
      addToast(
        winnerVideoLocalToast(
          `rb-lead-${Date.now()}`,
          "Reminder updated",
          `${data.lead_hours}h before deadline`,
          "normal",
        ),
      );
    } catch (e) {
      addToast(
        winnerVideoLocalToast(
          `rb-lead-e-${Date.now()}`,
          "Could not save",
          e instanceof Error ? e.message : "Try again",
          "high",
        ),
      );
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
    status !== (canManage ? "all" : "active")
      ? { key: "status", label: `Status: ${status}`, clear: () => setStatus(canManage ? "all" : "active") }
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
      {canManage ? (
        <div>
          <label className="mb-1 block text-[10px] uppercase tracking-wider text-white/40">Status</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className={cn(VA_FILTER_INPUT, "min-h-11")}
          >
            <option value="all">All</option>
            <option value="draft">Draft</option>
            <option value="published">Published</option>
            <option value="uploaded">Uploaded</option>
            <option value="archived">Archived</option>
            <option value="active">Active (published+uploaded)</option>
          </select>
        </div>
      ) : null}
      {canManage ? (
        <div>
          <label className="mb-1 block text-[10px] uppercase tracking-wider text-white/40">Model</label>
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

  const boardColumns: { id: RecordingBriefStatus; label: string }[] = [
    { id: "draft", label: "Draft" },
    { id: "published", label: "Published" },
    { id: "uploaded", label: "Uploaded" },
    { id: "archived", label: "Archived" },
  ];

  const canMarkUploaded = canViewOwn && selected?.status === "published";
  const uploadDisabledReason = !canViewOwn
    ? "You can only mark Uploaded on your own model briefs"
    : selected && selected.status !== "published"
      ? selected.status === "uploaded"
        ? "Already marked Uploaded"
        : "Only published briefs can be marked Uploaded"
      : null;

  return (
    <div className="space-y-6">
      <BriefPageHeader
        eyebrow="Content pipeline"
        title="Recording Briefs"
        description={
          canManage
            ? "Create and publish filming briefs for creators"
            : "Your published filming briefs — urgent first"
        }
        action={
          canManage ? (
            <Link
              href={ROUTES.recordingBriefNew}
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
            label: "Awaiting upload",
            value: stats.awaitingUpload,
            accent: "emerald",
            tooltip: "Published briefs waiting for creator upload",
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
          setUrgentOnly(false);
          setDeadlineFilter("");
          setStatus(canManage ? "all" : "active");
        }}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        showBoard={canManage}
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

      {canManage ? (
        <div className={cn(VA_CARD, "flex flex-wrap items-end gap-3 p-4")}>
          <div>
            <label className="mb-1 block text-[10px] uppercase tracking-wider text-white/40">
              Reminder lead (hours)
            </label>
            <input
              type="number"
              min={0}
              max={168}
              value={leadHours}
              onChange={(e) => setLeadHours(e.target.value)}
              className={cn(VA_FILTER_INPUT, "min-h-11 w-28")}
            />
          </div>
          <button
            type="button"
            className={cn(VA_BTN_SECONDARY, "min-h-11")}
            onClick={() => void saveLead()}
          >
            Save reminder
          </button>
        </div>
      ) : null}

      {loading && !briefs.length ? (
        <BriefCardSkeleton />
      ) : viewMode === "board" && canManage ? (
        <div className="flex gap-3 overflow-x-auto pb-2">
          {boardColumns.map((col) => {
            const items = filtered.filter((b) => b.status === col.id);
            return (
              <BriefBoardColumn key={col.id} title={col.label} count={items.length}>
                {items.map((b) => (
                  <BriefCard
                    key={b.id}
                    selected={selectedId === b.id}
                    onClick={() => setSelectedId(b.id)}
                    title={b.title}
                    modelName={modelNameById[b.model_id]}
                    priority={b.priority}
                    status={b.status}
                    deadlineAt={b.deadline_at}
                    progressHint={`${b.variations.length} variation${b.variations.length === 1 ? "" : "s"}`}
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
                    onClick={() => setSelectedId(b.id)}
                    title={b.title}
                    modelName={modelNameById[b.model_id]}
                    priority={b.priority}
                    status={b.status}
                    deadlineAt={b.deadline_at}
                    progressHint={`${b.variations.length} variation${b.variations.length === 1 ? "" : "s"}`}
                  />
                </li>
              ))
            )}
          </ul>

          <div className={cn(VA_CARD, "p-4 md:p-6")}>
            {!selected ? (
              <BriefEmptyState title="Select a brief" description="Choose from the list to preview" />
            ) : (
              <div className="space-y-4">
                {canManage ? (
                  <div className="flex flex-wrap gap-2">
                    <Link
                      href={ROUTES.recordingBriefEdit(selected.id)}
                      className={cn(VA_BTN_SECONDARY, "min-h-11 px-4")}
                    >
                      Edit
                    </Link>
                    <Link
                      href={ROUTES.recordingBrief(selected.id)}
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
                    {selected.status === "uploaded" ? (
                      <Link
                        href={`${ROUTES.editingBriefNew}?from_recording=${encodeURIComponent(selected.id)}`}
                        className={cn(VA_BTN_PRIMARY, "min-h-11 px-4")}
                      >
                        Create Editing Brief
                      </Link>
                    ) : null}
                  </div>
                ) : null}

                {canViewOwn ? (
                  <BriefStickyActionBar disabledReason={uploadDisabledReason}>
                    <button
                      type="button"
                      disabled={busyId === selected.id || !canMarkUploaded}
                      className={cn(
                        VA_BTN_PRIMARY,
                        "inline-flex min-h-12 flex-1 items-center justify-center gap-2 px-5 disabled:opacity-40",
                      )}
                      onClick={() => setConfirmUpload(true)}
                    >
                      <Upload className="h-4 w-4" /> Uploaded
                    </button>
                  </BriefStickyActionBar>
                ) : null}

                <RecordingBriefView
                  brief={selected}
                  modelName={modelNameById[selected.model_id]}
                  viewerMode={!canManage}
                />
              </div>
            )}
          </div>
        </div>
      )}

      <BriefConfirmAction
        open={confirmUpload}
        onClose={() => setConfirmUpload(false)}
        onConfirm={async () => {
          if (selected) await setStatusFor(selected.id, "uploaded");
        }}
        title="Mark as Uploaded?"
        description="Confirm that footage for this brief has been uploaded to the path in the brief."
        confirmLabel="Mark Uploaded"
        loading={busyId === selected?.id}
      />
    </div>
  );
}
