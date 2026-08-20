"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Check,
  ChevronDown,
  Copy,
  ExternalLink,
  GripVertical,
  Plus,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { SectionLabel } from "@/components/infloww-performance-ui";
import { ROUTES } from "@/lib/routes";
import {
  APPLICATION_QUESTION_TYPES,
  CHOICE_QUESTION_TYPES,
  FORM_STATUS_LABELS,
  QUESTION_TYPE_LABELS,
  type ApplicationFormQuestion,
  type ApplicationFormStatus,
  type ApplicationFormWithQuestions,
  type ApplicationQuestionType,
  type PipelineStepConfig,
} from "@/lib/application-forms-types";
import { ApplicationFormPreview } from "@/components/application-form-preview";
import { ApplicationPipelineBuilder } from "@/components/application-pipeline-builder";

const BORDER = "rgba(255,255,255,0.08)";
const GOLD = "#D4AF8C";

type Props = {
  initialForm: ApplicationFormWithQuestions;
  canManage: boolean;
};

function SortableQuestionCard({
  question,
  canManage,
  onChange,
  onDelete,
  onSave,
}: {
  question: ApplicationFormQuestion;
  canManage: boolean;
  onChange: (patch: Partial<ApplicationFormQuestion>) => void;
  onDelete: () => void;
  onSave: (override?: Partial<ApplicationFormQuestion>) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: question.id,
    disabled: !canManage,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.7 : 1,
  };
  const needsOptions = CHOICE_QUESTION_TYPES.has(question.question_type);
  const [langTab, setLangTab] = useState<"en" | "el">("en");

  return (
    <div
      ref={setNodeRef}
      style={{ ...style, borderColor: BORDER, background: "rgba(13,11,13,0.8)" }}
      className="rounded-2xl border p-4"
    >
      <div className="flex items-start gap-2">
        {canManage && (
          <button
            type="button"
            className="mt-2 cursor-grab touch-none text-white/35 hover:text-white/70"
            aria-label="Drag to reorder"
            {...attributes}
            {...listeners}
          >
            <GripVertical className="h-4 w-4" />
          </button>
        )}
        <div className="min-w-0 flex-1 space-y-3">
          <div className="inline-flex rounded-lg border border-white/10 p-0.5 text-[11px]">
            <button
              type="button"
              onClick={() => setLangTab("en")}
              className={`rounded-md px-2.5 py-1 ${langTab === "en" ? "bg-white/15 text-white" : "text-white/45"}`}
            >
              EN *
            </button>
            <button
              type="button"
              onClick={() => setLangTab("el")}
              className={`rounded-md px-2.5 py-1 ${langTab === "el" ? "bg-white/15 text-white" : "text-white/45"}`}
            >
              EL
            </button>
          </div>
          {langTab === "en" ? (
            <input
              value={question.question_text}
              disabled={!canManage}
              onChange={(e) => onChange({ question_text: e.target.value })}
              onBlur={() => canManage && onSave()}
              placeholder="Question text (English, required)"
              className="w-full rounded-xl border border-[#1f1f1f] bg-[#0d0d0d] px-3 py-2.5 text-sm text-white placeholder:text-white/30 disabled:opacity-60"
            />
          ) : (
            <input
              value={question.question_text_el}
              disabled={!canManage}
              onChange={(e) => onChange({ question_text_el: e.target.value })}
              onBlur={() => canManage && onSave()}
              placeholder="Ελληνικό κείμενο (optional — fallback EN)"
              className="w-full rounded-xl border border-[#1f1f1f] bg-[#0d0d0d] px-3 py-2.5 text-sm text-white placeholder:text-white/30 disabled:opacity-60"
            />
          )}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <select
                value={question.question_type}
                disabled={!canManage}
                onChange={(e) => {
                  const question_type = e.target.value as ApplicationQuestionType;
                  const patch = {
                    question_type,
                    options: CHOICE_QUESTION_TYPES.has(question_type)
                      ? question.options.length
                        ? question.options
                        : ["Option 1", "Option 2"]
                      : [],
                    options_el: CHOICE_QUESTION_TYPES.has(question_type)
                      ? question.options_el.length
                        ? question.options_el
                        : ["", ""]
                      : [],
                  };
                  onChange(patch);
                  onSave(patch);
                }}
                className="appearance-none rounded-lg border border-[#1f1f1f] bg-[#0d0d0d] py-2 pl-3 pr-8 text-xs text-white/85 disabled:opacity-60"
              >
                {APPLICATION_QUESTION_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {QUESTION_TYPE_LABELS[t]}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/35" />
            </div>
            <label className="inline-flex items-center gap-2 text-xs text-white/55">
              <input
                type="checkbox"
                checked={question.is_required}
                disabled={!canManage}
                onChange={(e) => {
                  const patch = { is_required: e.target.checked };
                  onChange(patch);
                  onSave(patch);
                }}
                className="rounded border-white/20"
              />
              Required
            </label>
            {canManage && (
              <button
                type="button"
                onClick={onDelete}
                className="ml-auto rounded-lg border border-red-500/20 p-1.5 text-red-300/70 hover:bg-red-500/10"
                aria-label="Delete question"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          {needsOptions && (
            <div className="space-y-2">
              <p className="text-[11px] uppercase tracking-wider text-white/35">
                Options ({langTab.toUpperCase()})
              </p>
              {question.options.map((opt, idx) => (
                <div key={idx} className="flex gap-2">
                  <input
                    value={langTab === "en" ? opt : question.options_el[idx] ?? ""}
                    disabled={!canManage}
                    onChange={(e) => {
                      if (langTab === "en") {
                        const options = [...question.options];
                        options[idx] = e.target.value;
                        onChange({ options });
                      } else {
                        const options_el = [...question.options_el];
                        while (options_el.length < question.options.length) options_el.push("");
                        options_el[idx] = e.target.value;
                        onChange({ options_el });
                      }
                    }}
                    onBlur={() => canManage && onSave()}
                    placeholder={langTab === "el" ? "Greek option (optional)" : "Option"}
                    className="h-9 flex-1 rounded-lg border border-[#1f1f1f] bg-[#0d0d0d] px-3 text-sm text-white"
                  />
                  {canManage && langTab === "en" && (
                    <button
                      type="button"
                      onClick={() => {
                        const options = question.options.filter((_, i) => i !== idx);
                        const options_el = question.options_el.filter((_, i) => i !== idx);
                        const patch = { options, options_el };
                        onChange(patch);
                        onSave(patch);
                      }}
                      className="rounded-lg px-2 text-white/35 hover:text-white/70"
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
              {canManage && langTab === "en" && (
                <button
                  type="button"
                  onClick={() => {
                    const patch = {
                      options: [...question.options, `Option ${question.options.length + 1}`],
                      options_el: [...question.options_el, ""],
                    };
                    onChange(patch);
                    onSave(patch);
                  }}
                  className="text-xs text-[#D4AF8C] hover:underline"
                >
                  + Add option
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function AdminApplicationFormBuilderClient({ initialForm, canManage }: Props) {
  const [form, setForm] = useState(initialForm);
  const [savingMeta, setSavingMeta] = useState(false);
  const [statusBusy, setStatusBusy] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const publicUrl = useMemo(() => {
    if (typeof window === "undefined") return ROUTES.applyForm(form.slug);
    return `${window.location.origin}${ROUTES.applyForm(form.slug)}`;
  }, [form.slug]);

  async function saveMeta(
    patch: Partial<{
      title: string;
      description: string;
      description_el: string;
      footer_text: string;
      footer_text_el: string;
      slug: string;
      pipeline_config: PipelineStepConfig[];
    }>,
  ) {
    setSavingMeta(true);
    try {
      const res = await fetch(`/api/admin/application-forms/${form.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Save failed");
      setForm((prev) => ({ ...prev, ...data.form, questions: prev.questions }));
      toast.success("Saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSavingMeta(false);
    }
  }

  async function setStatus(status: ApplicationFormStatus) {
    setStatusBusy(true);
    try {
      const res = await fetch(`/api/admin/application-forms/${form.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Status update failed");
      setForm((prev) => ({ ...prev, status: data.form.status }));
      toast.success(`Form ${FORM_STATUS_LABELS[status].toLowerCase()}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Status update failed");
    } finally {
      setStatusBusy(false);
    }
  }

  async function addQuestion() {
    try {
      const res = await fetch(`/api/admin/application-forms/${form.id}/questions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question_text: "Untitled question",
          question_type: "short_text",
          is_required: false,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to add question");
      setForm((prev) => ({ ...prev, questions: [...prev.questions, data.question] }));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to add question");
    }
  }

  function patchLocalQuestion(qid: string, patch: Partial<ApplicationFormQuestion>) {
    setForm((prev) => ({
      ...prev,
      questions: prev.questions.map((q) => (q.id === qid ? { ...q, ...patch } : q)),
    }));
  }

  async function persistQuestion(
    qid: string,
    override?: Partial<ApplicationFormQuestion>,
  ) {
    const q = form.questions.find((x) => x.id === qid);
    if (!q && !override) return;
    const merged = { ...(q ?? ({} as ApplicationFormQuestion)), ...override };
    try {
      const res = await fetch(`/api/admin/application-forms/${form.id}/questions/${qid}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question_text: merged.question_text,
          question_text_el: merged.question_text_el,
          question_type: merged.question_type,
          options: merged.options,
          options_el: merged.options_el,
          is_required: merged.is_required,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Save failed");
      setForm((prev) => ({
        ...prev,
        questions: prev.questions.map((x) => (x.id === qid ? data.question : x)),
      }));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    }
  }

  async function removeQuestion(qid: string) {
    if (!confirm("Delete this question?")) return;
    try {
      const res = await fetch(`/api/admin/application-forms/${form.id}/questions/${qid}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Delete failed");
      setForm((prev) => ({
        ...prev,
        questions: prev.questions.filter((q) => q.id !== qid),
      }));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    }
  }

  async function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = form.questions.findIndex((q) => q.id === active.id);
    const newIndex = form.questions.findIndex((q) => q.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const next = arrayMove(form.questions, oldIndex, newIndex);
    setForm((prev) => ({ ...prev, questions: next }));
    try {
      const res = await fetch(`/api/admin/application-forms/${form.id}/questions/reorder`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ordered_ids: next.map((q) => q.id) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Reorder failed");
      setForm((prev) => ({ ...prev, questions: data.questions }));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Reorder failed");
    }
  }

  function copyPublicLink() {
    void navigator.clipboard.writeText(publicUrl).then(
      () => toast.success("Link copied"),
      () => toast.error("Could not copy"),
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link
            href={ROUTES.admin.applicationForms}
            className="text-xs text-white/40 hover:text-white/70"
          >
            ← Applications
          </Link>
          <div className="mt-3">
            <SectionLabel>Form builder</SectionLabel>
          </div>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
            {form.title}
          </h1>
          <p className="mt-1 text-xs text-white/40">
            Status: {FORM_STATUS_LABELS[form.status]} · /apply/{form.slug}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={ROUTES.admin.applicationFormResponses(form.id)}
            className="rounded-lg border px-3 py-2 text-xs text-white/70 hover:text-white"
            style={{ borderColor: BORDER }}
          >
            Responses ({form.response_count ?? 0})
          </Link>
          {canManage && form.status !== "published" && (
            <button
              type="button"
              disabled={statusBusy || form.questions.length === 0}
              onClick={() => void setStatus("published")}
              className="rounded-lg px-3 py-2 text-xs font-medium text-[#0D0B0D] disabled:opacity-50"
              style={{ background: GOLD }}
            >
              Publish
            </button>
          )}
          {canManage && form.status === "published" && (
            <>
              <button
                type="button"
                disabled={statusBusy}
                onClick={() => void setStatus("draft")}
                className="rounded-lg border px-3 py-2 text-xs text-white/70"
                style={{ borderColor: BORDER }}
              >
                Unpublish
              </button>
              <button
                type="button"
                disabled={statusBusy}
                onClick={() => void setStatus("closed")}
                className="rounded-lg border border-amber-500/30 px-3 py-2 text-xs text-amber-200"
              >
                Close
              </button>
            </>
          )}
          {canManage && form.status === "closed" && (
            <button
              type="button"
              disabled={statusBusy}
              onClick={() => void setStatus("published")}
              className="rounded-lg px-3 py-2 text-xs font-medium text-[#0D0B0D]"
              style={{ background: GOLD }}
            >
              Reopen
            </button>
          )}
        </div>
      </div>

      <div
        className="mt-6 rounded-2xl border p-4 sm:p-5"
        style={{ borderColor: BORDER, background: "rgba(255,255,255,0.02)" }}
      >
        <ApplicationPipelineBuilder
          config={form.pipeline_config}
          canManage={canManage}
          onChange={(next) => {
            setForm((prev) => ({ ...prev, pipeline_config: next }));
            if (canManage) void saveMeta({ pipeline_config: next });
          }}
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          <div
            className="rounded-2xl border p-4 space-y-3"
            style={{ borderColor: BORDER, background: "rgba(255,255,255,0.02)" }}
          >
            <label className="block text-[11px] uppercase tracking-wider text-white/35">Title</label>
            <input
              defaultValue={form.title}
              disabled={!canManage}
              onBlur={(e) => {
                if (canManage && e.target.value.trim() !== form.title) {
                  void saveMeta({ title: e.target.value });
                }
              }}
              className="h-11 w-full rounded-xl border border-[#1f1f1f] bg-[#0d0d0d] px-4 text-sm text-white disabled:opacity-60"
            />
            <label className="block text-[11px] uppercase tracking-wider text-white/35">
              Description (EN)
            </label>
            <textarea
              defaultValue={form.description}
              disabled={!canManage}
              rows={3}
              onBlur={(e) => {
                if (canManage && e.target.value !== form.description) {
                  void saveMeta({ description: e.target.value });
                }
              }}
              className="w-full rounded-xl border border-[#1f1f1f] bg-[#0d0d0d] px-4 py-3 text-sm text-white disabled:opacity-60"
            />
            <label className="block text-[11px] uppercase tracking-wider text-white/35">
              Description (EL)
            </label>
            <textarea
              defaultValue={form.description_el}
              disabled={!canManage}
              rows={3}
              onBlur={(e) => {
                if (canManage && e.target.value !== form.description_el) {
                  void saveMeta({ description_el: e.target.value });
                }
              }}
              className="w-full rounded-xl border border-[#1f1f1f] bg-[#0d0d0d] px-4 py-3 text-sm text-white disabled:opacity-60"
            />
            <label className="block text-[11px] uppercase tracking-wider text-white/35">
              Footer (EN)
            </label>
            <input
              defaultValue={form.footer_text}
              disabled={!canManage}
              onBlur={(e) => {
                if (canManage && e.target.value !== form.footer_text) {
                  void saveMeta({ footer_text: e.target.value });
                }
              }}
              className="h-10 w-full rounded-xl border border-[#1f1f1f] bg-[#0d0d0d] px-3 text-sm text-white disabled:opacity-60"
            />
            <label className="block text-[11px] uppercase tracking-wider text-white/35">
              Footer (EL)
            </label>
            <input
              defaultValue={form.footer_text_el}
              disabled={!canManage}
              onBlur={(e) => {
                if (canManage && e.target.value !== form.footer_text_el) {
                  void saveMeta({ footer_text_el: e.target.value });
                }
              }}
              className="h-10 w-full rounded-xl border border-[#1f1f1f] bg-[#0d0d0d] px-3 text-sm text-white disabled:opacity-60"
            />
            <label className="block text-[11px] uppercase tracking-wider text-white/35">
              Public slug
            </label>
            <div className="flex gap-2">
              <input
                defaultValue={form.slug}
                disabled={!canManage}
                onBlur={(e) => {
                  if (canManage && e.target.value.trim() !== form.slug) {
                    void saveMeta({ slug: e.target.value });
                  }
                }}
                className="h-10 flex-1 rounded-xl border border-[#1f1f1f] bg-[#0d0d0d] px-3 text-sm text-white disabled:opacity-60"
              />
              <button
                type="button"
                onClick={copyPublicLink}
                className="inline-flex items-center gap-1.5 rounded-xl border px-3 text-xs text-white/70"
                style={{ borderColor: BORDER }}
              >
                <Copy className="h-3.5 w-3.5" />
                Copy
              </button>
              {form.status === "published" && (
                <a
                  href={ROUTES.applyForm(form.slug)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center rounded-xl border px-3 text-white/70"
                  style={{ borderColor: BORDER }}
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              )}
            </div>
            {savingMeta && (
              <p className="flex items-center gap-1 text-xs text-white/40">
                <Check className="h-3 w-3" /> Saving…
              </p>
            )}
          </div>

          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-white/80">Questions</h2>
            {canManage && (
              <button
                type="button"
                onClick={() => void addQuestion()}
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-[#0D0B0D]"
                style={{ background: GOLD }}
              >
                <Plus className="h-3.5 w-3.5" />
                Add question
              </button>
            )}
          </div>

          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext
              items={form.questions.map((q) => q.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-3">
                {form.questions.map((q) => (
                  <SortableQuestionCard
                    key={q.id}
                    question={q}
                    canManage={canManage}
                    onChange={(patch) => patchLocalQuestion(q.id, patch)}
                    onDelete={() => void removeQuestion(q.id)}
                    onSave={(override) => void persistQuestion(q.id, override)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>

          {form.questions.length === 0 && (
            <p className="rounded-2xl border border-dashed px-4 py-10 text-center text-sm text-white/40"
              style={{ borderColor: BORDER }}
            >
              Add questions to build your application form.
            </p>
          )}
        </div>

        <div className="lg:sticky lg:top-6 lg:self-start">
          <p className="mb-3 text-[11px] uppercase tracking-wider text-white/35">Live preview</p>
          <ApplicationFormPreview
            title={form.title}
            description={form.description}
            questions={form.questions}
            interactive={false}
          />
        </div>
      </div>
    </div>
  );
}
