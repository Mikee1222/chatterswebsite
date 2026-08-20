"use client";

import { useState } from "react";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { ApplicationFormPreview } from "@/components/application-form-preview";
import { ApplyFooter, ApplyHeader } from "@/components/application-public-chrome";
import { ApplyButton } from "@/components/application-ui-buttons";
import {
  CHOICE_QUESTION_TYPES,
  type ApplicationFormQuestion,
} from "@/lib/application-forms-types";
import {
  APPLY_EYEBROW,
  APPLY_GLASS,
  APPLY_PROGRESS_FILL,
  APPLY_PROGRESS_TRACK,
} from "@/lib/application-ui-tokens";

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
  const [idx, setIdx] = useState(0);

  const total = questions.length;
  const current = questions[idx];
  const progressPct = total === 0 ? 0 : Math.round(((idx + 1) / total) * 100);

  function isAnswered(q: ApplicationFormQuestion): boolean {
    const v = values[q.id];
    if (!v) return false;
    if (q.question_type === "checkboxes") return (v.options ?? []).length > 0;
    return !!(v.text ?? "").trim() || (v.options ?? []).length > 0;
  }

  function validateCurrent(): boolean {
    if (!current || !current.is_required) {
      setErrors({});
      return true;
    }
    if (!isAnswered(current)) {
      setErrors({
        [current.id]:
          current.question_type === "checkboxes"
            ? "Please select at least one option"
            : "This field is required",
      });
      return false;
    }
    setErrors({});
    return true;
  }

  function validateAll(): boolean {
    const next: Record<string, string> = {};
    for (const q of questions) {
      if (!q.is_required) continue;
      if (!isAnswered(q)) {
        next[q.id] =
          q.question_type === "checkboxes"
            ? "Please select at least one option"
            : "This field is required";
      }
    }
    setErrors(next);
    if (Object.keys(next).length > 0) {
      const firstIdx = questions.findIndex((q) => next[q.id]);
      if (firstIdx >= 0) setIdx(firstIdx);
      return false;
    }
    return true;
  }

  async function onSubmit() {
    setSubmitError(null);
    if (!validateAll()) return;
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
            <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-[#D4AF8C]/35 bg-[#D4AF8C]/10">
              <Check className="h-7 w-7 text-[#D4AF8C]" aria-hidden />
            </div>
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
      <div className="relative mx-auto max-w-xl flex-1 px-4 py-8 sm:py-10">
        <div className={APPLY_GLASS}>
          <div className="border-b border-white/8 bg-gradient-to-br from-[#151315] via-[#0D0B0D] to-[#120810] px-6 py-7">
            <p className={APPLY_EYEBROW}>Application</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
              {title}
            </h1>
            {description ? (
              <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-white/50">
                {description}
              </p>
            ) : null}
            {total > 0 ? (
              <div className="mt-6">
                <div className="mb-2 flex items-center justify-between text-xs">
                  <span className="font-medium tabular-nums text-[#D4AF8C]">
                    Question {Math.min(idx + 1, total)} of {total}
                  </span>
                  <span className="tabular-nums text-white/35">{progressPct}%</span>
                </div>
                <div className={APPLY_PROGRESS_TRACK}>
                  <div className={APPLY_PROGRESS_FILL} style={{ width: `${progressPct}%` }} />
                </div>
              </div>
            ) : null}
          </div>

          <div className="px-5 py-6 sm:px-6">
            {current ? (
              <ApplicationFormPreview
                title={title}
                questions={questions}
                interactive
                values={values}
                errors={errors}
                singleQuestionIndex={idx}
                hideHeader
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
            ) : null}

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

            <div className="mt-8 flex justify-between gap-3">
              <ApplyButton
                variant="ghost"
                disabled={idx === 0}
                iconLeft={<ArrowLeft className="h-4 w-4" aria-hidden />}
                onClick={() => setIdx((i) => Math.max(0, i - 1))}
                className="w-auto"
              >
                Back
              </ApplyButton>
              {idx < total - 1 ? (
                <ApplyButton
                  variant="primaryInline"
                  iconRight={<ArrowRight className="h-4 w-4" aria-hidden />}
                  onClick={() => {
                    if (validateCurrent()) setIdx((i) => i + 1);
                  }}
                >
                  Next
                </ApplyButton>
              ) : (
                <ApplyButton
                  variant="primaryInline"
                  loading={submitting}
                  iconRight={<Check className="h-4 w-4" aria-hidden />}
                  onClick={() => void onSubmit()}
                >
                  {submitting ? "Submitting…" : "Submit application"}
                </ApplyButton>
              )}
            </div>
            <p className="mt-4 text-center text-[11px] text-white/35">
              Required fields are marked with *
            </p>
          </div>
        </div>
      </div>
      <ApplyFooter />
    </>
  );
}
