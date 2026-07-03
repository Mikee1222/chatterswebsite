"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ClipboardList, ImageIcon, Plus, Trash2, X, Zap } from "lucide-react";
import { ConfirmDeleteModal } from "@/components/confirm-delete-modal";
import { useToast } from "@/contexts/toast-context";
import { cn } from "@/lib/utils";
import { DEFAULT_TASK_STEP_TYPE, TASK_STEP_TYPES, type TaskStepType } from "@/lib/task-step-types";
import type {
  TaskTemplateCategory,
  TaskTemplateRecord,
} from "@/services/task-templates";

const CATEGORIES: TaskTemplateCategory[] = ["marketing", "chatting", "content", "other"];

const CATEGORY_COLORS: Record<TaskTemplateCategory, string> = {
  marketing: "border-pink-500/30 bg-pink-500/15 text-pink-300",
  chatting: "border-blue-500/30 bg-blue-500/15 text-blue-300",
  content: "border-purple-500/30 bg-purple-500/15 text-purple-300",
  other: "border-white/15 bg-white/10 text-white/60",
};

interface DraftItem {
  tempId: string;
  title: string;
  description: string;
  requires_screenshot: boolean;
  step_type: TaskStepType;
}

interface DraftPhase {
  tempId: string;
  title: string;
  description: string;
  items: DraftItem[];
}

type Props = {
  initialTemplates: TaskTemplateRecord[];
};

const ADMIN_FILTER_INPUT =
  "h-11 rounded-xl border border-[#1f1f1f] bg-[#0d0d0d] px-4 text-sm text-white outline-none placeholder:text-white/25 focus:border-pink-500/50 focus:ring-1 focus:ring-pink-500/20";

const ADMIN_MODAL_INPUT =
  "w-full rounded-xl border border-[#1f1f1f] bg-[#141414] px-4 py-3 text-sm text-white placeholder:text-white/25 outline-none transition focus:border-pink-500/50 focus:ring-1 focus:ring-pink-500/20";

function newTempId() {
  return `tmp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function emptyDraftPhase(): DraftPhase {
  return { tempId: newTempId(), title: "", description: "", items: [] };
}

export function AdminTaskTemplatesClient({ initialTemplates }: Props) {
  const router = useRouter();
  const { addToast } = useToast();
  const [templates, setTemplates] = React.useState(initialTemplates);
  const [search, setSearch] = React.useState("");
  const [filterCategory, setFilterCategory] = React.useState("");
  const [modalOpen, setModalOpen] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [category, setCategory] = React.useState<TaskTemplateCategory>("marketing");
  const [draftPhases, setDraftPhases] = React.useState<DraftPhase[]>([]);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = React.useState<TaskTemplateRecord | null>(null);
  const [deleting, setDeleting] = React.useState(false);

  React.useEffect(() => setTemplates(initialTemplates), [initialTemplates]);

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return templates.filter((t) => {
      if (!t.is_active) return false;
      if (filterCategory && t.category !== filterCategory) return false;
      if (q) {
        const blob = `${t.name} ${t.description}`.toLowerCase();
        if (!blob.includes(q)) return false;
      }
      return true;
    });
  }, [templates, search, filterCategory]);

  function resetModal() {
    setEditingId(null);
    setName("");
    setDescription("");
    setCategory("marketing");
    setDraftPhases([]);
    setError(null);
  }

  function openCreate() {
    resetModal();
    setModalOpen(true);
  }

  async function openEdit(t: TaskTemplateRecord) {
    setEditingId(t.id);
    setName(t.name);
    setDescription(t.description);
    setCategory(t.category);
    setDraftPhases([]);
    setError(null);
    setModalOpen(true);
    try {
      const res = await fetch(`/api/admin/task-templates/${encodeURIComponent(t.id)}`, { credentials: "include" });
      const data = (await res.json().catch(() => ({}))) as {
        template?: {
          phases?: Array<{
            title: string;
            description: string;
            items?: Array<{
              title: string;
              description: string;
              requires_screenshot: boolean;
              step_type?: TaskStepType;
            }>;
          }>;
        };
      };
      const phases = data.template?.phases ?? [];
      setDraftPhases(
        phases.map((p) => ({
          tempId: newTempId(),
          title: p.title,
          description: p.description,
          items: (p.items ?? []).map((i) => ({
            tempId: newTempId(),
            title: i.title,
            description: i.description,
            requires_screenshot: i.requires_screenshot,
            step_type: i.step_type ?? DEFAULT_TASK_STEP_TYPE,
          })),
        })),
      );
    } catch {
      setDraftPhases([]);
    }
  }

  function closeModal() {
    setModalOpen(false);
    resetModal();
  }

  function addPhase() {
    setDraftPhases((prev) => [...prev, emptyDraftPhase()]);
  }

  function updatePhase(tempId: string, patch: Partial<DraftPhase>) {
    setDraftPhases((prev) => prev.map((p) => (p.tempId === tempId ? { ...p, ...patch } : p)));
  }

  function removePhase(tempId: string) {
    setDraftPhases((prev) => prev.filter((p) => p.tempId !== tempId));
  }

  function addItem(phaseTempId: string) {
    setDraftPhases((prev) =>
      prev.map((p) =>
        p.tempId === phaseTempId
          ? {
              ...p,
              items: [
                ...p.items,
                { tempId: newTempId(), title: "", description: "", requires_screenshot: false, step_type: DEFAULT_TASK_STEP_TYPE },
              ],
            }
          : p,
      ),
    );
  }

  function updateItem(phaseTempId: string, itemTempId: string, patch: Partial<DraftItem>) {
    setDraftPhases((prev) =>
      prev.map((p) =>
        p.tempId === phaseTempId
          ? { ...p, items: p.items.map((i) => (i.tempId === itemTempId ? { ...i, ...patch } : i)) }
          : p,
      ),
    );
  }

  function removeItem(phaseTempId: string, itemTempId: string) {
    setDraftPhases((prev) =>
      prev.map((p) =>
        p.tempId === phaseTempId ? { ...p, items: p.items.filter((i) => i.tempId !== itemTempId) } : p,
      ),
    );
  }

  async function handleSave() {
    if (!name.trim()) {
      setError("Name is required");
      return;
    }
    setSaving(true);
    setError(null);
    const phasesPayload = draftPhases.map((p, idx) => ({
      phase_number: idx + 1,
      title: p.title.trim() || `Phase ${idx + 1}`,
      description: p.description.trim(),
      items: p.items.map((it, i) => ({
        title: it.title.trim(),
        description: it.description.trim(),
        requires_screenshot: it.requires_screenshot,
        sort_order: i,
        step_type: it.step_type || DEFAULT_TASK_STEP_TYPE,
      })),
    }));

    try {
      const url = editingId
        ? `/api/admin/task-templates/${encodeURIComponent(editingId)}`
        : "/api/admin/task-templates";
      const res = await fetch(url, {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim(),
          category,
          phases: phasesPayload,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error?.trim() || "Save failed");
        return;
      }
      closeModal();
      router.refresh();
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/task-templates/${encodeURIComponent(pendingDelete.id)}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        addToast({
          id: `tpl-del-err-${Date.now()}`,
          notification_id: `tpl-del-err-${Date.now()}`,
          user_id: "local",
          category: "system",
          event_type: "system_alert",
          priority: "high",
          title: "Delete failed",
          body: "Could not delete template.",
          entity_type: "system",
          entity_id: "",
          read_at: null,
          created_at: new Date().toISOString(),
        });
        return;
      }
      setTemplates((prev) => prev.filter((t) => t.id !== pendingDelete.id));
      setPendingDelete(null);
      router.refresh();
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-pink-400">Administration</p>
          <h1 className="mt-2 text-[36px] font-bold leading-tight tracking-tight text-white">Task Templates</h1>
          <p className="mt-2 text-sm text-white/40">Reusable VA task structures with phases and checklist items</p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-pink-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-pink-500/25 transition hover:bg-pink-400"
        >
          <Plus className="h-4 w-4" strokeWidth={2.5} aria-hidden />
          New template
        </button>
      </div>

      <div className="flex flex-wrap gap-3 rounded-2xl border border-[#1f1f1f] bg-[#0d0d0d] p-4">
        <input
          type="search"
          placeholder="Search templates…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className={cn(ADMIN_FILTER_INPUT, "min-w-[10rem] flex-1")}
        />
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          className={cn(ADMIN_FILTER_INPUT, "min-w-[9rem]")}
        >
          <option value="">All categories</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-[#1f1f1f] bg-[#0d0d0d] px-6 py-16 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.06] text-white/35">
            <ClipboardList className="h-7 w-7" aria-hidden />
          </div>
          <p className="mt-5 text-base font-semibold text-white/90">No templates yet</p>
          <p className="mt-2 max-w-sm text-sm text-white/50">Create a template to speed up VA task assignment.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((t) => (
            <article
              key={t.id}
              className="flex flex-col rounded-2xl border border-[#1f1f1f] bg-[#0d0d0d] p-5 transition hover:border-pink-500/30"
            >
              <div className="mb-3 flex items-start justify-between gap-2">
                <span
                  className={cn(
                    "rounded-full border px-2.5 py-0.5 text-[11px] font-medium capitalize",
                    CATEGORY_COLORS[t.category],
                  )}
                >
                  {t.category}
                </span>
                <button
                  type="button"
                  onClick={() => setPendingDelete(t)}
                  className="rounded-lg p-1.5 text-white/25 transition hover:bg-red-500/10 hover:text-red-400"
                  aria-label="Delete template"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <h2 className="text-lg font-bold text-white">{t.name}</h2>
              {t.description ? <p className="mt-2 line-clamp-3 text-sm text-white/45">{t.description}</p> : null}
              <button
                type="button"
                onClick={() => void openEdit(t)}
                className="mt-5 w-full rounded-xl border border-white/10 bg-white/5 py-2.5 text-sm font-medium text-white/70 transition hover:bg-white/10 hover:text-white"
              >
                Edit template
              </button>
            </article>
          ))}
        </div>
      )}

      {modalOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 backdrop-blur-sm md:items-center">
          <div className="max-h-[92vh] w-full overflow-y-auto rounded-t-[20px] border border-[#1f1f1f] bg-[#0d0d0d] shadow-2xl md:max-w-2xl md:rounded-[20px]">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[#1f1f1f] bg-[#0d0d0d]/95 px-6 py-5 backdrop-blur-sm">
              <div>
                <p className="mb-1 text-xs font-semibold text-pink-400">Task templates</p>
                <h2 className="text-xl font-bold text-white">{editingId ? "Edit template" : "New template"}</h2>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#1f1f1f] bg-[#141414] text-white/50 transition hover:border-white/20 hover:text-white"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-6 px-6 py-5">
              {error ? <p className="text-sm text-red-400">{error}</p> : null}

              <div className="space-y-3">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-white/40">Name</label>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className={ADMIN_MODAL_INPUT}
                    placeholder="e.g. Daily Marketing Routine"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-white/40">Description</label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={2}
                    className={cn(ADMIN_MODAL_INPUT, "resize-none")}
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-white/40">Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as TaskTemplateCategory)}
                    className={ADMIN_MODAL_INPUT}
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Zap className="h-4 w-4 text-amber-400" aria-hidden />
                    <p className="text-xs font-semibold text-pink-400">Phases</p>
                  </div>
                  <button
                    type="button"
                    onClick={addPhase}
                    className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/40 transition hover:bg-white/10 hover:text-white"
                  >
                    <Plus className="h-3.5 w-3.5" /> Add phase
                  </button>
                </div>

                <div className="space-y-3">
                  {draftPhases.map((phase, phaseIndex) => (
                    <div key={phase.tempId} className="overflow-hidden rounded-xl border border-[#1f1f1f] bg-[#0a0a0a]">
                      <div className="flex items-center gap-3 border-b border-white/8 px-4 py-3">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl border border-pink-500/20 bg-pink-500/15 text-xs font-bold text-pink-400">
                          {phaseIndex + 1}
                        </div>
                        <input
                          value={phase.title}
                          onChange={(e) => updatePhase(phase.tempId, { title: e.target.value })}
                          placeholder={`Phase ${phaseIndex + 1} title`}
                          className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-white placeholder:text-white/20 focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => removePhase(phase.tempId)}
                          className="rounded-lg p-1 text-white/20 transition hover:bg-red-500/10 hover:text-red-400"
                          aria-label="Remove phase"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <div className="px-4 py-3">
                        <div className="mb-2 space-y-2">
                          {phase.items.map((item, itemIdx) => (
                            <div key={item.tempId} className="group flex items-center gap-2.5">
                              <div className="h-4 w-4 shrink-0 rounded border border-white/20 bg-white/5" />
                              <select
                                value={item.step_type}
                                onChange={(e) =>
                                  updateItem(phase.tempId, item.tempId, {
                                    step_type: e.target.value as TaskStepType,
                                  })
                                }
                                className="w-[7.5rem] shrink-0 rounded-lg border border-white/10 bg-[#141414] px-2 py-1 text-[10px] text-white/70 focus:border-pink-500/40 focus:outline-none"
                                aria-label="Step type"
                              >
                                {TASK_STEP_TYPES.map((t) => (
                                  <option key={t} value={t}>
                                    {t}
                                  </option>
                                ))}
                              </select>
                              <input
                                value={item.title}
                                onChange={(e) =>
                                  updateItem(phase.tempId, item.tempId, { title: e.target.value })
                                }
                                placeholder={`Item ${itemIdx + 1}…`}
                                className="min-w-0 flex-1 border-b border-transparent bg-transparent py-0.5 text-xs text-white/80 focus:border-white/20 focus:outline-none"
                              />
                              <button
                                type="button"
                                onClick={() =>
                                  updateItem(phase.tempId, item.tempId, {
                                    requires_screenshot: !item.requires_screenshot,
                                  })
                                }
                                title="Requires screenshot"
                                className={cn(
                                  "flex h-6 w-6 shrink-0 items-center justify-center rounded-md border transition",
                                  item.requires_screenshot
                                    ? "border-amber-500/40 bg-amber-500/20 text-amber-400"
                                    : "border-white/10 bg-white/5 text-white/25",
                                )}
                              >
                                <ImageIcon className="h-3 w-3" />
                              </button>
                              <button
                                type="button"
                                onClick={() => removeItem(phase.tempId, item.tempId)}
                                className="rounded p-1 text-white/15 opacity-0 transition group-hover:opacity-100 hover:text-red-400"
                                aria-label="Remove item"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                        <button
                          type="button"
                          onClick={() => addItem(phase.tempId)}
                          className="text-xs text-white/30 transition hover:text-pink-400"
                        >
                          + Add item
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-3 border-t border-[#1f1f1f] pt-5">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 rounded-xl border border-white/10 py-3 text-sm font-medium text-white/50 transition hover:bg-white/5"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void handleSave()}
                  disabled={saving}
                  className="flex-1 rounded-xl bg-pink-500 py-3 text-sm font-semibold text-white transition hover:bg-pink-400 disabled:opacity-50"
                >
                  {saving ? "Saving…" : editingId ? "Save changes" : "Create template"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <ConfirmDeleteModal
        open={!!pendingDelete}
        title="Delete template?"
        description={`"${pendingDelete?.name ?? ""}" will be deactivated and hidden from the list.`}
        confirmLabel="Delete"
        confirming={deleting}
        onClose={() => setPendingDelete(null)}
        onConfirm={() => void confirmDelete()}
      />
    </div>
  );
}
