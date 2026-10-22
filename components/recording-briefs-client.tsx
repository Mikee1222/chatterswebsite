"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Archive, Filter, Loader2, Plus, RotateCcw, Upload } from "lucide-react";
import { RecordingBriefView } from "@/components/recording-brief-view";
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
import type { RecordingBrief, RecordingBriefStatus } from "@/services/recording-briefs";
import { formatCountdown } from "@/lib/brief-deadlines";

type ModelOption = { id: string; model_name: string };

type Props = {
  initialBriefs: RecordingBrief[];
  canManage: boolean;
  canViewOwn: boolean;
  models: ModelOption[];
  modelNameById: Record<string, string>;
  reminderLeadHours?: number;
};

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
  const [loading, setLoading] = React.useState(false);
  const [selectedId, setSelectedId] = React.useState<string | null>(
    initialBriefs[0]?.id ?? null,
  );
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [leadHours, setLeadHours] = React.useState(String(reminderLeadHours));

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
      addToast(winnerVideoLocalToast(`rb-lead-${Date.now()}`, "Reminder updated", `${data.lead_hours}h before deadline`, "normal"));
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white">Recording Briefs</h1>
          <p className="mt-1 text-sm text-white/50">
            {canManage
              ? "Create and publish filming briefs for creators"
              : "Your published filming briefs — urgent first"}
          </p>
        </div>
        {canManage ? (
          <Link href={ROUTES.recordingBriefNew} className={cn(VA_BTN_PRIMARY, "inline-flex min-h-12 items-center gap-2 px-5")}>
            <Plus className="h-4 w-4" /> New brief
          </Link>
        ) : null}
      </div>

      <div className={cn(VA_CARD, "flex flex-wrap items-end gap-3 p-4")}>
        <Filter className="mb-2 h-4 w-4 text-white/40" aria-hidden />
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
          <button type="button" className={cn(VA_BTN_SECONDARY, "min-h-11")} onClick={() => void saveLead()}>
            Save reminder
          </button>
        </div>
      ) : null}

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
                    onClick={() => setSelectedId(b.id)}
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
                      {modelNameById[b.model_id] || b.model_id} · {b.status}
                    </p>
                    {b.deadline_at ? (
                      <p className={cn("mt-1 text-xs", cd.overdue ? "text-rose-300" : "text-white/40")}>
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
                      href={ROUTES.recordingBriefEdit(selected.id)}
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
                        className={cn(VA_BTN_SECONDARY, "inline-flex min-h-11 items-center gap-2 px-4")}
                        onClick={() => void setStatusFor(selected.id, "archived")}
                      >
                        <Archive className="h-4 w-4" /> Archive
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={busyId === selected.id}
                        className={cn(VA_BTN_SECONDARY, "inline-flex min-h-11 items-center gap-2 px-4")}
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
                  </>
                ) : null}
                {canViewOwn && selected.status === "published" ? (
                  <button
                    type="button"
                    disabled={busyId === selected.id}
                    className={cn(VA_BTN_PRIMARY, "inline-flex min-h-12 items-center gap-2 px-5")}
                    onClick={() => void setStatusFor(selected.id, "uploaded")}
                  >
                    <Upload className="h-4 w-4" /> Uploaded
                  </button>
                ) : null}
              </div>
              <RecordingBriefView
                brief={selected}
                modelName={modelNameById[selected.model_id]}
                viewerMode={!canManage}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
