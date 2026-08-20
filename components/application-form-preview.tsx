"use client";

import type { ApplicationFormQuestion } from "@/lib/application-forms-types";
import { QUESTION_TYPE_LABELS } from "@/lib/application-forms-types";
import { pipelineUi, type PipelineLanguage } from "@/lib/application-pipeline-i18n";
import {
  APPLY_EYEBROW,
  APPLY_GLASS,
  APPLY_INPUT,
  APPLY_LABEL,
} from "@/lib/application-ui-tokens";
import { cn } from "@/lib/utils";

type AnswerState = Record<string, { text?: string; options?: string[] }>;

type Props = {
  title: string;
  description?: string;
  questions: ApplicationFormQuestion[];
  interactive?: boolean;
  values?: AnswerState;
  errors?: Record<string, string>;
  onChange?: (questionId: string, value: { text?: string; options?: string[] }) => void;
  className?: string;
  lang?: PipelineLanguage;
  /** When embedded in the public flow shell, skip outer glass chrome. */
  bare?: boolean;
};

const choiceBase =
  "flex items-center gap-3 rounded-xl border px-3.5 py-3 text-sm transition cursor-pointer";
const choiceIdle = "border-white/10 bg-white/[0.03] text-white/75 hover:border-white/20 hover:bg-white/[0.05]";
const choiceActive =
  "border-[#FF1493]/45 bg-[#FF1493]/10 text-white shadow-[0_0_24px_-12px_rgba(255,20,147,0.5)]";

export function ApplicationFormPreview({
  title,
  description,
  questions,
  interactive = false,
  values = {},
  errors = {},
  onChange,
  className = "",
  lang = "en",
  bare = false,
}: Props) {
  const ui = pipelineUi(lang);
  const body = (
    <>
      <div className="border-b border-white/8 bg-gradient-to-br from-[#151315] via-[#0D0B0D] to-[#120810] px-6 py-8">
        <p className={APPLY_EYEBROW}>Application</p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
          {title || "Untitled form"}
        </h2>
        {description ? (
          <p className="mt-3 max-w-prose whitespace-pre-line text-sm leading-relaxed text-white/55">
            {description}
          </p>
        ) : null}
      </div>
      <div className="space-y-5 px-5 py-6 sm:px-6">
        {questions.length === 0 ? (
          <p className="text-center text-sm text-white/40">No questions yet</p>
        ) : (
          questions.map((q, idx) => {
            const val = values[q.id] ?? {};
            const err = errors[q.id];
            return (
              <div
                key={q.id}
                className={cn(
                  "space-y-2.5 p-0 md:rounded-xl md:border md:border-white/10 md:bg-[#1a1a1a] md:p-4 md:shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] md:focus-within:border-[#FF1493]/40 md:focus-within:ring-1 md:focus-within:ring-[#FF1493]/20",
                )}
              >
                <label className={cn("block", APPLY_LABEL)}>
                  <span className="mr-2 text-xs font-normal text-white/35">{idx + 1}.</span>
                  {q.question_text || "Untitled question"}
                  {q.is_required ? (
                    <span className="ml-1 text-[#FF1493]/80">{ui.fieldRequiredMark}</span>
                  ) : null}
                </label>
                {!interactive && (
                  <p className="text-[11px] text-white/35">
                    {QUESTION_TYPE_LABELS[q.question_type]}
                  </p>
                )}
                {renderField(q, interactive, val, onChange, ui)}
                {err ? <p className="text-xs text-rose-400">{err}</p> : null}
              </div>
            );
          })
        )}
      </div>
    </>
  );

  if (bare) {
    return <div className={className}>{body}</div>;
  }

  return <div className={cn(APPLY_GLASS, className)}>{body}</div>;
}

function renderField(
  q: ApplicationFormQuestion,
  interactive: boolean,
  val: { text?: string; options?: string[] },
  onChange: Props["onChange"],
  ui: ReturnType<typeof pipelineUi>,
) {
  const disabled = !interactive;
  const setText = (text: string) => onChange?.(q.id, { text, options: val.options });
  const setOptions = (options: string[]) => onChange?.(q.id, { text: val.text, options });

  switch (q.question_type) {
    case "long_text":
      return (
        <textarea
          disabled={disabled}
          rows={4}
          value={val.text ?? ""}
          onChange={(e) => setText(e.target.value)}
          className={cn(APPLY_INPUT, "min-h-[120px] resize-y")}
          placeholder={interactive ? ui.yourAnswer : "Long text answer"}
        />
      );
    case "date":
      return (
        <input
          type="date"
          disabled={disabled}
          value={val.text ?? ""}
          onChange={(e) => setText(e.target.value)}
          className={APPLY_INPUT}
        />
      );
    case "multiple_choice":
    case "dropdown":
      if (q.question_type === "dropdown") {
        return (
          <select
            disabled={disabled}
            value={val.text ?? ""}
            onChange={(e) => setText(e.target.value)}
            className={APPLY_INPUT}
          >
            <option value="">{ui.select}</option>
            {q.options.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        );
      }
      return (
        <div className="space-y-2">
          {q.options.map((o) => {
            const active = (val.text ?? "") === o;
            return (
              <label key={o} className={cn(choiceBase, active ? choiceActive : choiceIdle)}>
                <input
                  type="radio"
                  name={q.id}
                  disabled={disabled}
                  checked={active}
                  onChange={() => setText(o)}
                  className="accent-[#FF1493]"
                />
                {o}
              </label>
            );
          })}
        </div>
      );
    case "checkboxes":
      return (
        <div className="space-y-2">
          {q.options.map((o) => {
            const selected = (val.options ?? []).includes(o);
            return (
              <label
                key={o}
                className={cn(choiceBase, selected ? choiceActive : choiceIdle)}
              >
                <input
                  type="checkbox"
                  disabled={disabled}
                  checked={selected}
                  onChange={() => {
                    const next = selected
                      ? (val.options ?? []).filter((x) => x !== o)
                      : [...(val.options ?? []), o];
                    setOptions(next);
                  }}
                  className="accent-[#FF1493]"
                />
                {o}
              </label>
            );
          })}
        </div>
      );
    case "rating":
      return (
        <div className="flex flex-wrap gap-2">
          {[1, 2, 3, 4, 5].map((n) => {
            const active = (val.text ?? "") === String(n);
            return (
              <button
                key={n}
                type="button"
                disabled={disabled}
                onClick={() => setText(String(n))}
                className={cn(
                  "h-11 w-11 rounded-xl border text-sm font-semibold transition",
                  active
                    ? "border-[#D4AF8C]/50 bg-[#D4AF8C]/20 text-[#E8D0B0] shadow-[0_0_20px_-8px_rgba(212,175,140,0.5)]"
                    : "border-white/10 bg-white/[0.04] text-white/60 hover:border-white/20",
                )}
              >
                {n}
              </button>
            );
          })}
        </div>
      );
    case "yes_no":
      return (
        <div className="flex gap-2">
          {[ui.yes, ui.no].map((o, i) => {
            const canonical = i === 0 ? "Yes" : "No";
            const active = (val.text ?? "") === canonical || (val.text ?? "") === o;
            return (
              <button
                key={canonical}
                type="button"
                disabled={disabled}
                onClick={() => setText(canonical)}
                className={cn(
                  "flex-1 rounded-2xl border px-5 py-3 text-sm font-medium transition",
                  active
                    ? i === 0
                      ? "border-[#FF1493]/45 bg-[#FF1493]/15 text-white"
                      : "border-white/20 bg-white/10 text-white"
                    : "border-white/10 bg-white/[0.03] text-white/60 hover:border-white/20",
                )}
              >
                {o}
              </button>
            );
          })}
        </div>
      );
    default:
      return (
        <input
          disabled={disabled}
          value={val.text ?? ""}
          onChange={(e) => setText(e.target.value)}
          className={APPLY_INPUT}
          placeholder={interactive ? ui.yourAnswer : "Short text answer"}
        />
      );
  }
}
