"use client";

import { useMemo, useState } from "react";
import { ApplicationFormPreview } from "@/components/application-form-preview";
import { ApplyFooter, ApplyHeader } from "@/components/application-public-chrome";
import {
  CHOICE_QUESTION_TYPES,
  type ApplicationFormQuestion,
} from "@/lib/application-forms-types";
import {
  APPLY_BTN_PRIMARY,
  APPLY_PROGRESS_FILL,
  APPLY_PROGRESS_TRACK,
} from "@/lib/application-ui-tokens";
import { cn } from "@/lib/utils";

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
      <>
        <ApplyHeader showLang={false} />
        <div className="mx-auto max-w-lg flex-1 px-4 py-16 text-center">
          <div className="overflow-hidden rounded-3xl border border-white/10 bg-[rgba(20,20,25,0.72)] px-8 py-12 shadow-[0_20px_60px_rgba(0,0,0,0.55)] backdrop-blur-2xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#D4AF8C]/80">
              Thank you
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white">
              Application received
            </h1>
            <p className="mt-4 text-sm leading-relaxed text-white/50">
              We’ve received your submission. Our team will review it and get in touch if there’s a
              fit.
            </p>
          </div>
        </div>
        <ApplyFooter />
      </>
    );
  }

  return (
    <>
      <ApplyHeader showLang={false} />
      <form onSubmit={onSubmit} className="relative mx-auto max-w-xl flex-1 px-4 py-8 sm:py-10">
        {questions.length > 3 && (
          <div className="mb-6">
            <div className="mb-2 flex items-center justify-between text-xs text-white/40">
              <span>Progress</span>
              <span className="tabular-nums text-[#D4AF8C]">
                {answeredCount}/{questions.length}
              </span>
            </div>
            <div className={APPLY_PROGRESS_TRACK}>
              <div className={APPLY_PROGRESS_FILL} style={{ width: `${progress}%` }} />
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
          <p className="mt-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
            {submitError}
          </p>
        )}

        <button type="submit" disabled={submitting} className={cn(APPLY_BTN_PRIMARY, "mt-6")}>
          {submitting ? "Submitting…" : "Submit application"}
        </button>
        <p className="mt-3 text-center text-[11px] text-white/35">
          Required fields are marked with *
        </p>
      </form>
      <ApplyFooter />
    </>
  );
}
