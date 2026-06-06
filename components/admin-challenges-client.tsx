"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Pencil, Trash2 } from "lucide-react";
import { CustomSelect } from "@/components/ui/custom-select";
import { Label, Input, Textarea } from "@/components/ui/form";
import { useToast } from "@/contexts/toast-context";
import { createChallengeAction, deleteChallengeAction, updateChallengeAction, type ChallengeData } from "@/app/actions/challenges";
import type { AppNotification } from "@/types";
import type { ChallengeRow } from "@/services/challenges";
import { CHALLENGE_METRICS, type ChallengeMetric, getChallengeStatus, daysRemainingYmd } from "@/lib/challenges";
import { cn } from "@/lib/utils";

function localToast(id: string, title: string, body: string, priority: "normal" | "high"): AppNotification {
  return {
    id,
    notification_id: id,
    user_id: "local",
    category: "system",
    event_type: "system_alert",
    priority,
    title,
    body,
    entity_type: "system",
    entity_id: "",
    read_at: null,
    created_at: new Date().toISOString(),
  };
}

const METRIC_LABELS: Record<ChallengeMetric, string> = {
  transactions: "Transactions",
  whales_added: "Whales Added",
  shift_hours: "Shift Hours",
  customs_completed: "Customs Completed",
  whale_status_upgrades: "Whale Status Upgrades",
  rebills_verified: "Rebills Verified",
};

const METRIC_OPTIONS = CHALLENGE_METRICS.map((m) => ({
  value: m,
  label: METRIC_LABELS[m],
}));

function statusStyles(status: ReturnType<typeof getChallengeStatus>) {
  if (status === "active") return "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30";
  if (status === "upcoming") return "bg-sky-500/15 text-sky-200 ring-sky-500/30";
  return "bg-white/10 text-white/55 ring-white/15";
}

function emptyForm(): ChallengeData {
  return {
    title: "",
    description: "",
    target_metric: "transactions",
    target_value: 1,
    reward_points: 0,
    start_date: new Date().toISOString().slice(0, 10),
    end_date: new Date().toISOString().slice(0, 10),
    active: true,
    assigned_user_ids: [],
  };
}

function rowToForm(c: ChallengeRow): ChallengeData {
  return {
    title: c.title,
    description: c.description,
    target_metric: c.target_metric,
    target_value: c.target_value,
    reward_points: c.reward_points,
    start_date: c.start_date,
    end_date: c.end_date,
    active: c.active,
    assigned_user_ids: parseChallengeAssignedUserIds(c.assigned_users),
  };
}

function parseChallengeAssignedUserIds(raw: string | undefined): string[] {
  if (!raw?.trim()) return [];
  return raw
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

export function AdminChallengesClient({
  challenges,
  completionByChallenge,
  activeChatterDenominator,
  todayYmd,
  chatters,
}: {
  challenges: ChallengeRow[];
  completionByChallenge: Record<string, number>;
  activeChatterDenominator: number;
  todayYmd: string;
  chatters: { id: string; name: string }[];
}) {
  const router = useRouter();
  const { addToast } = useToast();

  const [form, setForm] = React.useState<ChallengeData>(() => emptyForm());
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = React.useState(false);
  const [challengeToDelete, setChallengeToDelete] = React.useState<string | null>(null);
  const [deleting, setDeleting] = React.useState(false);
  const [assignmentScope, setAssignmentScope] = React.useState<"all" | "specific">("all");

  const denom = Math.max(1, activeChatterDenominator);

  const assignScopeOptions = React.useMemo(
    () => [
      { value: "all", label: "All chatters" },
      { value: "specific", label: "Specific chatters" },
    ],
    []
  );

  function chatterName(id: string): string {
    return chatters.find((c) => c.id === id)?.name ?? id;
  }

  function payloadForSave(base: ChallengeData): ChallengeData {
    return {
      ...base,
      assigned_user_ids: assignmentScope === "all" ? [] : base.assigned_user_ids,
    };
  }

  function startEdit(c: ChallengeRow) {
    setEditingId(c.id);
    const next = rowToForm(c);
    setForm(next);
    setAssignmentScope(next.assigned_user_ids.length > 0 ? "specific" : "all");
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(emptyForm());
    setAssignmentScope("all");
  }

  async function onSubmitCreate(e: React.FormEvent) {
    e.preventDefault();
    if (editingId) return;
    setSaving(true);
    try {
      const res = await createChallengeAction(payloadForSave(form));
      if (!res.success) {
        addToast(localToast(`ch-c-${Date.now()}`, "Could not create", res.error, "high"));
        return;
      }
      addToast(localToast(`ch-ok-${Date.now()}`, "Challenge created", "", "normal"));
      setForm(emptyForm());
      setAssignmentScope("all");
      router.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      addToast(localToast(`ch-c-${Date.now()}`, "Could not create", msg, "high"));
    } finally {
      setSaving(false);
    }
  }

  async function onSubmitUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (!editingId) return;
    setSaving(true);
    try {
      const res = await updateChallengeAction(editingId, payloadForSave(form));
      if (!res.success) {
        addToast(localToast(`ch-u-${Date.now()}`, "Could not save", res.error, "high"));
        return;
      }
      addToast(localToast(`ch-uok-${Date.now()}`, "Challenge updated", "", "normal"));
      cancelEdit();
      router.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      addToast(localToast(`ch-u-${Date.now()}`, "Could not save", msg, "high"));
    } finally {
      setSaving(false);
    }
  }

  function openDeleteConfirm(id: string) {
    if (deleting) return;
    setChallengeToDelete(id);
    setDeleteConfirmOpen(true);
  }

  async function handleConfirmDelete() {
    if (!challengeToDelete) return;
    setDeleting(true);
    setDeletingId(challengeToDelete);
    try {
      const res = await deleteChallengeAction(challengeToDelete);
      if (!res.success) {
        addToast(localToast(`ch-d-${Date.now()}`, "Could not delete", res.error, "high"));
        return;
      }
      addToast(localToast(`ch-dok-${Date.now()}`, "Challenge deleted", "", "normal"));
      if (editingId === challengeToDelete) cancelEdit();
      setDeleteConfirmOpen(false);
      setChallengeToDelete(null);
      router.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      addToast(localToast(`ch-d-${Date.now()}`, "Could not delete", msg, "high"));
    } finally {
      setDeleting(false);
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-10">
      <section className="rounded-2xl border border-white/[0.08] bg-zinc-900/50 p-5">
        <h2 className="mb-4 text-sm font-semibold text-white">{editingId ? "Edit challenge" : "Create challenge"}</h2>
        <form onSubmit={editingId ? onSubmitUpdate : onSubmitCreate} className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <Label htmlFor="ch-title">Title</Label>
            <Input
              id="ch-title"
              required
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              className="mt-1"
            />
          </div>
          <div className="md:col-span-2">
            <Label htmlFor="ch-desc">Description</Label>
            <Textarea
              id="ch-desc"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              className="mt-1 min-h-[88px]"
            />
          </div>
          <div>
            <Label>Target metric</Label>
            <div className="mt-1">
              <CustomSelect
                value={form.target_metric}
                onChange={(v) => setForm((f) => ({ ...f, target_metric: v as ChallengeMetric }))}
                options={METRIC_OPTIONS}
                aria-labelledby="ch-metric-l"
              />
            </div>
          </div>
          <div>
            <Label htmlFor="ch-target">Target value</Label>
            <Input
              id="ch-target"
              type="number"
              required
              min={1}
              value={form.target_value}
              onChange={(e) => setForm((f) => ({ ...f, target_value: Number(e.target.value) || 1 }))}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="ch-reward">Reward points</Label>
            <Input
              id="ch-reward"
              type="number"
              required
              min={0}
              value={form.reward_points}
              onChange={(e) => setForm((f) => ({ ...f, reward_points: Number(e.target.value) || 0 }))}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="ch-start">Start date</Label>
            <Input
              id="ch-start"
              type="date"
              required
              value={form.start_date}
              onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="ch-end">End date</Label>
            <Input
              id="ch-end"
              type="date"
              required
              value={form.end_date}
              onChange={(e) => setForm((f) => ({ ...f, end_date: e.target.value }))}
              className="mt-1"
            />
          </div>
          <div className="flex items-center gap-3 md:col-span-2">
            <input
              id="ch-active"
              type="checkbox"
              checked={form.active}
              onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
              className="h-4 w-4 rounded border-white/20"
            />
            <label htmlFor="ch-active" className="text-sm text-white/80">
              Active (only active challenges in the date window count for progress)
            </label>
          </div>
          <div className="md:col-span-2">
            <Label>Assign to</Label>
            <div className="mt-1">
              <CustomSelect
                value={assignmentScope}
                onChange={(v) => {
                  const next = v === "specific" ? "specific" : "all";
                  setAssignmentScope(next);
                  if (next === "all") setForm((f) => ({ ...f, assigned_user_ids: [] }));
                }}
                options={assignScopeOptions}
                aria-labelledby="ch-assign-l"
              />
            </div>
            {assignmentScope === "specific" ? (
              <div className="mt-3 max-h-48 space-y-2 overflow-y-auto rounded-xl border border-white/10 bg-black/25 p-3">
                {chatters.length === 0 ? (
                  <p className="text-xs text-white/45">No chatters found.</p>
                ) : (
                  chatters.map((ch) => {
                    const checked = form.assigned_user_ids.includes(ch.id);
                    return (
                      <label key={ch.id} className="flex cursor-pointer items-center gap-2 text-sm text-white/80">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => {
                            setForm((f) => {
                              const set = new Set(f.assigned_user_ids);
                              if (set.has(ch.id)) set.delete(ch.id);
                              else set.add(ch.id);
                              return { ...f, assigned_user_ids: [...set] };
                            });
                          }}
                          className="h-4 w-4 rounded border-white/25"
                        />
                        <span className="truncate">{ch.name}</span>
                      </label>
                    );
                  })
                )}
              </div>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2 md:col-span-2">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[hsl(330,75%,52%)] to-[hsl(280,55%,48%)] px-5 text-sm font-semibold text-white disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
              {editingId ? "Save changes" : "Create challenge"}
            </button>
            {editingId ? (
              <button
                type="button"
                onClick={cancelEdit}
                className="rounded-xl border border-white/15 px-4 py-2 text-sm text-white/80 hover:bg-white/5"
              >
                Cancel
              </button>
            ) : null}
          </div>
        </form>
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-white/45">All challenges</h2>
        {challenges.length === 0 ? (
          <p className="rounded-xl border border-white/10 bg-black/20 p-8 text-center text-sm text-white/50">No challenges yet.</p>
        ) : (
          <ul className="space-y-4">
            {challenges.map((c) => {
              const status = getChallengeStatus(c, todayYmd);
              const daysLeft = daysRemainingYmd(c.end_date, todayYmd);
              const completedN = completionByChallenge[c.id] ?? 0;
              const aggregatePct = Math.min(100, Math.round((completedN / denom) * 100));
              const assignedIds = parseChallengeAssignedUserIds(c.assigned_users);
              const assignedLabel =
                assignedIds.length === 0
                  ? "All chatters"
                  : assignedIds.map((id) => chatterName(id)).join(", ");
              return (
                <li
                  key={c.id}
                  className="rounded-2xl border border-white/[0.08] bg-gradient-to-b from-zinc-900/90 to-black/80 p-5 shadow-lg shadow-black/30"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-lg font-semibold text-white">{c.title}</h3>
                        <span
                          className={cn(
                            "rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ring-1",
                            statusStyles(status)
                          )}
                        >
                          {status}
                        </span>
                        {!c.active ? (
                          <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-semibold uppercase text-white/50">
                            Inactive
                          </span>
                        ) : null}
                      </div>
                      {c.description ? <p className="mt-2 text-sm text-white/60">{c.description}</p> : null}
                      <p className="mt-2 text-xs text-white/40">
                        {c.start_date} → {c.end_date} · Metric: {c.target_metric.replace(/_/g, "")} · Target:{""}
                        {c.target_value}
                      </p>
                      <p className="mt-1 text-xs text-pink-200/70">
                        <span className="text-white/35">Assigned:</span> {assignedLabel}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <button
                        type="button"
                        onClick={() => startEdit(c)}
                        className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-white/15 px-3 text-sm text-white/85 hover:bg-white/10"
                      >
                        <Pencil className="h-4 w-4" aria-hidden />
                        Edit
                      </button>
                      <button
                        type="button"
                        disabled={deletingId === c.id || deleting}
                        onClick={() => openDeleteConfirm(c.id)}
                        className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-red-500/30 px-3 text-sm text-red-300 hover:bg-red-500/10 disabled:opacity-50"
                      >
                        {deletingId === c.id ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Trash2 className="h-4 w-4" aria-hidden />}
                        Delete
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white/80">
                      {daysLeft === 0 ? "Ends today" : `${daysLeft} day${daysLeft === 1 ? "" : "s"} left`}
                    </span>
                    <span className="rounded-full bg-[hsl(330,70%,45%)]/25 px-3 py-1 text-xs font-semibold text-pink-100">
                      +{c.reward_points} pts
                    </span>
                  </div>

                  <div className="mt-4">
                    <div className="mb-1 flex justify-between text-xs text-white/50">
                      <span>Completion across chatters</span>
                      <span>
                        {completedN} / {denom} finished
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-[hsl(330,80%,55%)] to-[hsl(280,60%,50%)] transition-[width] duration-500"
                        style={{ width: `${aggregatePct}%` }}
                      />
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {deleteConfirmOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-red-500/30 bg-[#1a1a1a] p-6">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-500/20">
                <svg className="h-6 w-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">Delete challenge</h3>
                <p className="text-sm text-white/40">This action cannot be undone</p>
              </div>
            </div>

            <p className="mb-6 text-sm text-white/60">
              Delete this challenge and all progress rows? All chatters will lose their progress.
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  if (deleting) return;
                  setDeleteConfirmOpen(false);
                  setChallengeToDelete(null);
                }}
                className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-white transition-all hover:bg-white/10"
              >
                Cancel
              </button>
              <button
                onClick={() => void handleConfirmDelete()}
                disabled={deleting}
                className="flex-1 rounded-xl bg-red-500 px-4 py-2.5 font-medium text-white transition-all hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {deleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
