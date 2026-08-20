"use client";

import { useMemo, useState } from "react";
import { ApplicationFormPreview } from "@/components/application-form-preview";
import {
  CHOICE_QUESTION_TYPES,
  type ApplicationFormQuestion,
} from "@/lib/application-forms-types";

type AnswerState = Record<string, { text?: string; options?: string[] }>;

type Props = {
  slug: string;
  title: string;
  description: string;
  questions: ApplicationFormQuestion[];
};

export function PublicApplicationFormClient({ slug, title, description, questions }: Props) {
  const [values, setValues] = useState<AnswerState>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [honeypot, setHoneypot] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const answeredCount = useMemo(() => {
    return questions.filter((q) => {
      const v = values[q.id];
      if (!v) return false;
      if (q.question_type === "checkboxes") return (v.options ?? []).length > 0;
      return !!(v.text ?? "").trim() || (v.options ?? []).length > 0;
    }).length;
  }, [questions, values]);

  const progress = questions.length === 0 ? 0 : Math.round((answeredCount / questions.length) * 100);

  function validate(): boolean {
    const next: Record<string, string> = {};
    for (const q of questions) {
      if (!q.is_required) continue;
      const v = values[q.id];
      if (q.question_type === "checkboxes") {
        if (!v?.options?.length) next[q.id] = "Please select at least one option";
      } else if (!(v?.text ?? "").trim() && !(v?.options ?? []).length) {
        next[q.id] = "This field is required";
      }
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);
    if (!validate()) return;
    setSubmitting(true);
    try {
      const answers = questions.map((q) => {
        const v = values[q.id] ?? {};
        const opts = v.options ?? [];
        let text = (v.text ?? "").trim() || null;
        if (q.question_type === "checkboxes") {
          text = opts.join(", ") || null;
        } else if (CHOICE_QUESTION_TYPES.has(q.question_type) && opts.length && !text) {
          text = opts[0] ?? null;
        }
        return {
          question_id: q.id,
          answer_text: text,
          answer_options: opts,
        };
      });

      const res = await fetch(`/api/apply/${encodeURIComponent(slug)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          answers,
          website: honeypot,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Submission failed");
      setDone(true);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Submission failed");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="mx-auto max-w-lg px-4 py-20 text-center">
        <div className="rounded-3xl border border-black/5 bg-gradient-to-b from-[#F7F3EE] to-[#EFE8DF] px-8 py-12 shadow-xl">
          <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-[#8B6914]">
            Thank you
          </p>
          <h1 className="mt-3 font-serif text-3xl text-[#1a1512]">Application received</h1>
          <p className="mt-4 text-sm leading-relaxed text-zinc-600">
            We’ve received your submission. Our team will review it and get in touch if there’s a fit.
          </p>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="relative mx-auto max-w-xl px-4 py-10 sm:py-14">
      {questions.length > 3 && (
        <div className="mb-6">
          <div className="mb-2 flex items-center justify-between text-xs text-zinc-500">
            <span>Progress</span>
            <span>
              {answeredCount}/{questions.length}
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-black/10">
            <div
              className="h-full rounded-full bg-[#C4A484] transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      <ApplicationFormPreview
        title={title}
        description={description}
        questions={questions}
        interactive
        values={values}
        errors={errors}
        onChange={(qid, value) => {
          setValues((prev) => ({ ...prev, [qid]: value }));
          setErrors((prev) => {
            if (!prev[qid]) return prev;
            const next = { ...prev };
            delete next[qid];
            return next;
          });
        }}
      />

      {/* Honeypot */}
      <div className="absolute -left-[9999px] h-0 w-0 overflow-hidden opacity-0" aria-hidden>
        <label>
          Website
          <input
            tabIndex={-1}
            autoComplete="off"
            value={honeypot}
            onChange={(e) => setHoneypot(e.target.value)}
          />
        </label>
      </div>

      {submitError && (
        <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {submitError}
        </p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="mt-6 w-full rounded-2xl bg-[#1a1512] py-3.5 text-sm font-medium text-white shadow-lg transition hover:bg-[#2a221c] disabled:opacity-60"
      >
        {submitting ? "Submitting…" : "Submit application"}
      </button>
      <p className="mt-3 text-center text-[11px] text-zinc-500">
        Required fields are marked with *
      </p>
    </form>
  );
}
