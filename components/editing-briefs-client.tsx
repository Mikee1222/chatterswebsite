"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Archive,
  Check,
  Filter,
  Loader2,
  MessageSquare,
  Plus,
  RotateCcw,
  Send,
} from "lucide-react";
import { EditingBriefView } from "@/components/editing-brief-view";
import { useToast } from "@/contexts/toast-context";
import { winnerVideoLocalToast } from "@/components/winner-videos-shared";
import { ROUTES } from "@/lib/routes";
import {
  VA_BTN_PRIMARY,
  VA_BTN_SECONDARY,
  VA_CARD,
  VA_FILTER_INPUT,
} from "@/lib/va-tasks-tokens";
import { cn } from "@/lib/utils";
import type { EditingBrief, EditingBriefStatus } from "@/services/editing-briefs";
import { formatCountdown } from "@/lib/brief-deadlines";
import { BriefTextArea } from "@/components/brief-shared-ui";

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
  const [status, setStatus] = React.useState(
    canManage || canReview ? "all" : "active",
  );
  const [modelFilter, setModelFilter] = React.useState("");
  const [urgentOnly, setUrgentOnly] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [selectedId, setSelectedId] = React.useState<string | null>(
    initialBriefs[0]?.id ?? null,
  );
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [reviewComment, setReviewComment] = React.useState("");
  const [showChangesForm, setShowChangesForm] = React.useState(false);

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
        winnerVideoLocalToast(`eb-status-${Date.now()}`, "Updated", next.replace(/_/g, " "), "normal"),
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white">Editing Briefs</h1>
          <p className="mt-1 text-sm text-white/50">
            {canManage
              ? "Create and assign structured edit briefs"
              : canReview
                ? "Review delivered edits"
                : "Your assigned editing briefs"}
          </p>
        </div>
        {canManage ? (
          <Link
            href={ROUTES.editingBriefNew}
            className={cn(VA_BTN_PRIMARY, "inline-flex min-h-12 items-center gap-2 px-5")}
          >
            <Plus className="h-4 w-4" /> New brief
          </Link>
        ) : null}
      </div>

      <div className={cn(VA_CARD, "flex flex-wrap items-end gap-3 p-4")}>
        <Filter className="mb-2 h-4 w-4 text-white/40" aria-hidden />
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
        <label className="inline-flex min-h-11 items-center gap-2 text-sm text-white/70">
          <input
            type="checkbox"
            checked={urgentOnly}
            onChange={(e) => setUrgentOnly(e.target.checked)}
            className="h-5 w-5 rounded border-white/20"
          />
          Urgent only
        </label>
        {loading ? <Loader2 className="h-5 w-5 animate-spin text-white/40" /> : null}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,22rem)_1fr]">
        <ul className="space-y-2">
          {briefs.length === 0 ? (
            <li className="rounded-2xl border border-dashed border-white/15 px-4 py-8 text-center text-sm text-white/40">
              No briefs
            </li>
          ) : (
            briefs.map((b) => {
              const cd = formatCountdown(b.deadline_at);
              return (
                <li key={b.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedId(b.id);
                      setShowChangesForm(false);
                    }}
                    className={cn(
                      "w-full rounded-2xl border px-4 py-3 text-left transition",
                      selectedId === b.id
                        ? "border-[#D4AF8C]/45 bg-[#D4AF8C]/10"
                        : "border-white/[0.08] bg-white/[0.02] hover:border-white/20",
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-medium text-white/90">{b.title || "Untitled"}</p>
                      {b.priority === "urgent" ? (
                        <span className="shrink-0 rounded-md bg-rose-500/20 px-1.5 py-0.5 text-[10px] font-bold uppercase text-rose-200">
                          Urgent
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-xs text-white/45">
                      {modelNameById[b.model_id] || b.model_id} · {b.status.replace(/_/g, " ")}
                    </p>
                    {b.deadline_at ? (
                      <p
                        className={cn(
                          "mt-1 text-xs",
                          cd.overdue ? "text-rose-300" : "text-white/40",
                        )}
                      >
                        {cd.label}
                      </p>
                    ) : null}
                  </button>
                </li>
              );
            })
          )}
        </ul>

        <div className={cn(VA_CARD, "p-4 md:p-6")}>
          {!selected ? (
            <p className="text-sm text-white/40">Select a brief</p>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {canManage ? (
                  <>
                    <Link
                      href={ROUTES.editingBriefEdit(selected.id)}
                      className={cn(VA_BTN_SECONDARY, "min-h-11 px-4")}
                    >
                      Edit
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
                  </>
                ) : null}

                {canViewAssigned &&
                (selected.status === "published" || selected.status === "changes_needed") ? (
                  <button
                    type="button"
                    disabled={busyId === selected.id}
                    className={cn(
                      VA_BTN_PRIMARY,
                      "inline-flex min-h-12 items-center gap-2 px-5",
                    )}
                    onClick={() => void setStatusFor(selected.id, "delivered")}
                  >
                    <Send className="h-4 w-4" /> Delivered
                  </button>
                ) : null}

                {canReview && selected.status === "delivered" ? (
                  <>
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
                  </>
                ) : null}
              </div>

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
      {/* keep editors list referenced for future filter */}
      {editors.length === 0 ? null : null}
    </div>
  );
}
