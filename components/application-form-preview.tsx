"use client";

import type { ApplicationFormQuestion } from "@/lib/application-forms-types";
import { QUESTION_TYPE_LABELS } from "@/lib/application-forms-types";
import { pipelineUi, type PipelineLanguage } from "@/lib/application-pipeline-i18n";

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
};

const fieldClass =
  "w-full rounded-xl border border-black/10 bg-white px-4 py-3 text-sm text-zinc-900 shadow-sm outline-none focus:border-[#C4A484] focus:ring-2 focus:ring-[#C4A484]/25";

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
}: Props) {
  const ui = pipelineUi(lang);
  return (
    <div
      className={`overflow-hidden rounded-3xl border border-black/5 bg-gradient-to-b from-[#F7F3EE] to-[#EFE8DF] shadow-[0_20px_60px_rgba(0,0,0,0.25)] ${className}`}
    >
      <div className="border-b border-black/5 bg-[#1a1512] px-6 py-8 text-white">
        <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-[#D4AF8C]/80">
          Application
        </p>
        <h2 className="mt-2 font-serif text-2xl tracking-tight sm:text-3xl">
          {title || "Untitled form"}
        </h2>
        {description ? (
          <p className="mt-3 max-w-prose whitespace-pre-line text-sm leading-relaxed text-white/65">
            {description}
          </p>
        ) : null}
      </div>
      <div className="space-y-6 px-5 py-6 sm:px-6">
        {questions.length === 0 ? (
          <p className="text-center text-sm text-zinc-500">No questions yet</p>
        ) : (
          questions.map((q, idx) => {
            const val = values[q.id] ?? {};
            const err = errors[q.id];
            return (
              <div key={q.id} className="space-y-2">
                <label className="block text-sm font-medium text-zinc-800">
                  <span className="mr-2 text-xs font-normal text-zinc-400">{idx + 1}.</span>
                  {q.question_text || "Untitled question"}
                  {q.is_required ? (
                    <span className="ml-1 text-[#B45309]">{ui.fieldRequiredMark}</span>
                  ) : null}
                </label>
                {!interactive && (
                  <p className="text-[11px] text-zinc-400">
                    {QUESTION_TYPE_LABELS[q.question_type]}
                  </p>
                )}
                {renderField(q, interactive, val, onChange, ui)}
                {err ? <p className="text-xs text-red-600">{err}</p> : null}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
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
          className={fieldClass}
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
          className={fieldClass}
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
            className={fieldClass}
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
          {q.options.map((o) => (
            <label
              key={o}
              className="flex items-center gap-2 rounded-xl border border-black/8 bg-white/80 px-3 py-2.5 text-sm text-zinc-800"
            >
              <input
                type="radio"
                name={q.id}
                disabled={disabled}
                checked={(val.text ?? "") === o}
                onChange={() => setText(o)}
              />
              {o}
            </label>
          ))}
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
                className="flex items-center gap-2 rounded-xl border border-black/8 bg-white/80 px-3 py-2.5 text-sm text-zinc-800"
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
                className={`h-10 w-10 rounded-full border text-sm font-medium transition ${
                  active
                    ? "border-[#C4A484] bg-[#C4A484] text-white"
                    : "border-black/10 bg-white text-zinc-700"
                }`}
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
                className={`rounded-full border px-5 py-2 text-sm font-medium transition ${
                  active
                    ? "border-[#C4A484] bg-[#C4A484] text-white"
                    : "border-black/10 bg-white text-zinc-700"
                }`}
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
          className={fieldClass}
          placeholder={interactive ? ui.yourAnswer : "Short text answer"}
        />
      );
  }
}
