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
import { ApplyButton } from "@/components/application-ui-buttons";
import {
  APPLY_INPUT,
  APPLY_SECTION,
} from "@/lib/application-ui-tokens";
import { cn } from "@/lib/utils";

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
      style={style}
      className={cn(
        APPLY_SECTION,
        "p-4 transition",
        isDragging && "border-[#FF1493]/35 shadow-[0_12px_40px_-16px_rgba(255,20,147,0.35)]",
      )}
    >
      <div className="flex items-start gap-2">
        {canManage && (
          <button
            type="button"
            className="mt-2 cursor-grab touch-none rounded-lg p-1 text-white/35 transition hover:bg-white/5 hover:text-white/70"
            aria-label="Drag to reorder"
            {...attributes}
            {...listeners}
          >
            <GripVertical className="h-4 w-4" />
          </button>
        )}
        <div className="min-w-0 flex-1 space-y-3">
          <div className="inline-flex rounded-xl border border-white/10 bg-white/[0.03] p-0.5 text-[11px]">
            <button
              type="button"
              onClick={() => setLangTab("en")}
              className={cn(
                "rounded-lg px-2.5 py-1.5 font-semibold transition",
                langTab === "en"
                  ? "bg-gradient-to-br from-[#FF1493] to-[#DB2777] text-white shadow-[0_4px_12px_-4px_rgba(255,20,147,0.5)]"
                  : "text-white/45 hover:text-white/70",
              )}
            >
              EN *
            </button>
            <button
              type="button"
              onClick={() => setLangTab("el")}
              className={cn(
                "rounded-lg px-2.5 py-1.5 font-semibold transition",
                langTab === "el"
                  ? "bg-gradient-to-br from-[#D4AF8C] to-[#B8956A] text-[#0D0B0D]"
                  : "text-white/45 hover:text-white/70",
              )}
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
              className={cn(APPLY_INPUT, "min-h-[48px] py-2.5 disabled:opacity-60")}
            />
          ) : (
            <input
              value={question.question_text_el}
              disabled={!canManage}
              onChange={(e) => onChange({ question_text_el: e.target.value })}
              onBlur={() => canManage && onSave()}
              placeholder="Ελληνικό κείμενο (optional — fallback EN)"
              className={cn(APPLY_INPUT, "min-h-[48px] py-2.5 disabled:opacity-60")}
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
                className="appearance-none rounded-xl border border-white/10 bg-[#1a1a1a] py-2.5 pl-3 pr-8 text-xs text-white/85 disabled:opacity-60"
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
                className="rounded border-white/20 accent-[#FF1493]"
              />
              Required
            </label>
            {canManage && (
              <button
                type="button"
                onClick={onDelete}
                className="ml-auto rounded-xl border border-red-500/20 p-2 text-red-300/70 transition hover:bg-red-500/10"
                aria-label="Delete question"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          {needsOptions && (
            <div className="space-y-2 rounded-xl border border-white/8 bg-black/20 p-3">
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
                    className={cn(APPLY_INPUT, "h-10 min-h-0 flex-1 py-2 text-sm")}
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
                  className="text-xs font-medium text-[#D4AF8C] transition hover:text-[#E8D0B0]"
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
            className="inline-flex items-center rounded-xl border border-white/12 bg-white/[0.03] px-3 py-2 text-xs text-white/70 transition hover:border-[#D4AF8C]/35 hover:text-[#D4AF8C]"
          >
            Responses ({form.response_count ?? 0})
          </Link>
          {canManage && form.status !== "published" && (
            <ApplyButton
              variant="adminChampagne"
              loading={statusBusy}
              disabled={form.questions.length === 0}
              onClick={() => void setStatus("published")}
            >
              Publish
            </ApplyButton>
          )}
          {canManage && form.status === "published" && (
            <>
              <ApplyButton
                variant="adminSecondary"
                loading={statusBusy}
                onClick={() => void setStatus("draft")}
              >
                Unpublish
              </ApplyButton>
              <button
                type="button"
                disabled={statusBusy}
                onClick={() => void setStatus("closed")}
                className="inline-flex items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-xs font-semibold text-amber-200 transition hover:bg-amber-500/15 disabled:opacity-40"
              >
                Close
              </button>
            </>
          )}
          {canManage && form.status === "closed" && (
            <ApplyButton
              variant="adminChampagne"
              loading={statusBusy}
              onClick={() => void setStatus("published")}
            >
              Reopen
            </ApplyButton>
          )}
        </div>
      </div>

      <div className={cn(APPLY_SECTION, "mt-6 p-4 sm:p-5")}>
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
          <div className={cn(APPLY_SECTION, "space-y-3 p-4")}>
            <label className="block text-[11px] uppercase tracking-wider text-white/35">Title</label>
            <input
              defaultValue={form.title}
              disabled={!canManage}
              onBlur={(e) => {
                if (canManage && e.target.value.trim() !== form.title) {
                  void saveMeta({ title: e.target.value });
                }
              }}
              className={cn(APPLY_INPUT, "h-11 min-h-0 py-2.5 disabled:opacity-60")}
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
              className={cn(APPLY_INPUT, "min-h-[96px] resize-y py-3 disabled:opacity-60")}
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
              className={cn(APPLY_INPUT, "min-h-[96px] resize-y py-3 disabled:opacity-60")}
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
              className={cn(APPLY_INPUT, "h-10 min-h-0 py-2 disabled:opacity-60")}
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
              className={cn(APPLY_INPUT, "h-10 min-h-0 py-2 disabled:opacity-60")}
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
                className={cn(APPLY_INPUT, "h-10 min-h-0 flex-1 py-2 disabled:opacity-60")}
              />
              <ApplyButton variant="adminSecondary" onClick={copyPublicLink} iconLeft={<Copy className="h-3.5 w-3.5" />}>
                Copy
              </ApplyButton>
              {form.status === "published" && (
                <a
                  href={ROUTES.applyForm(form.slug)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center rounded-xl border border-white/12 bg-white/[0.03] px-3 text-white/70 transition hover:border-[#D4AF8C]/35 hover:text-[#D4AF8C]"
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
              <ApplyButton
                variant="adminChampagne"
                iconLeft={<Plus className="h-3.5 w-3.5" />}
                onClick={() => void addQuestion()}
              >
                Add question
              </ApplyButton>
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
            <p className="rounded-2xl border border-dashed border-white/10 px-4 py-10 text-center text-sm text-white/40">
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
