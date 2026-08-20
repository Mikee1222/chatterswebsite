"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ApplicationFormPreview } from "@/components/application-form-preview";
import { TypingSpeedTestStep } from "@/components/typing-speed-test-step";
import {
  CHOICE_QUESTION_TYPES,
  getEnabledPipelineSteps,
  localizeQuestion,
  type ApplicationFormQuestion,
  type PipelineStepConfig,
  type PipelineStepType,
} from "@/lib/application-forms-types";
import {
  COGNITIVE_TIME_LIMIT_SECONDS,
  type PublicCognitiveQuestion,
} from "@/lib/application-screening-banks";
import {
  pickLocalized,
  pipelineUi,
  type PipelineLanguage,
} from "@/lib/application-pipeline-i18n";

type AnswerState = Record<string, { text?: string; options?: string[] }>;

type EqScenarioPublic = { id: string; prompt: string; options: string[] };

type Props = {
  slug: string;
  title: string;
  description: string;
  descriptionEl: string;
  footerText: string;
  footerTextEl: string;
  questions: ApplicationFormQuestion[];
  pipelineConfig: PipelineStepConfig[];
  cognitiveQuestionsEn: PublicCognitiveQuestion[] | null;
  cognitiveQuestionsEl: PublicCognitiveQuestion[] | null;
  eqScenariosEn: EqScenarioPublic[] | null;
  eqScenariosEl: EqScenarioPublic[] | null;
  cognitiveTimeLimit?: number;
};

type Phase = "language" | "intro" | PipelineStepType | "done";

function LanguageSwitcher({
  lang,
  onChange,
}: {
  lang: PipelineLanguage;
  onChange: (l: PipelineLanguage) => void;
}) {
  const ui = pipelineUi(lang);
  return (
    <div className="inline-flex items-center gap-1 rounded-full border border-black/10 bg-white/80 p-0.5 text-xs">
      <button
        type="button"
        onClick={() => onChange("en")}
        className={`rounded-full px-2.5 py-1 ${lang === "en" ? "bg-[#1a1512] text-white" : "text-zinc-600"}`}
      >
        EN
      </button>
      <button
        type="button"
        onClick={() => onChange("el")}
        className={`rounded-full px-2.5 py-1 ${lang === "el" ? "bg-[#1a1512] text-white" : "text-zinc-600"}`}
      >
        EL
      </button>
      <span className="sr-only">{ui.language}</span>
    </div>
  );
}

export function PublicApplicationFlowClient({
  slug,
  title,
  description,
  descriptionEl,
  footerText,
  footerTextEl,
  questions,
  pipelineConfig,
  cognitiveQuestionsEn,
  cognitiveQuestionsEl,
  eqScenariosEn,
  eqScenariosEl,
  cognitiveTimeLimit = COGNITIVE_TIME_LIMIT_SECONDS,
}: Props) {
  const enabled = useMemo(
    () => getEnabledPipelineSteps(pipelineConfig).map((s) => s.step),
    [pipelineConfig],
  );
  const needsScreeningIntro = enabled.some(
    (s) =>
      s === "cognitive_screening" || s === "eq_screening" || s === "typing_speed_test",
  );

  const [lang, setLang] = useState<PipelineLanguage | null>(null);
  const [phase, setPhase] = useState<Phase>("language");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ui = pipelineUi(lang ?? "en");
  const desc = pickLocalized(lang ?? "en", description, descriptionEl);
  const footer = pickLocalized(lang ?? "en", footerText, footerTextEl);

  const cognitiveQuestions =
    lang === "el" ? cognitiveQuestionsEl ?? cognitiveQuestionsEn : cognitiveQuestionsEn;
  const eqScenarios = lang === "el" ? eqScenariosEl ?? eqScenariosEn : eqScenariosEn;

  const persistLang = useCallback(
    async (next: PipelineLanguage, sid?: string | null) => {
      const id = sid ?? sessionId;
      if (!id) return;
      try {
        await fetch(`/api/apply/${encodeURIComponent(slug)}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "set_language",
            session_id: id,
            preferred_language: next,
          }),
        });
      } catch {
        /* ignore */
      }
      try {
        localStorage.setItem(`apply_lang:${slug}`, next);
      } catch {
        /* ignore */
      }
    },
    [sessionId, slug],
  );

  const startSession = useCallback(
    async (preferred: PipelineLanguage) => {
      setStarting(true);
      setError(null);
      try {
        const res = await fetch(`/api/apply/${encodeURIComponent(slug)}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "start_session",
            preferred_language: preferred,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || "Could not start");
        setSessionId(data.session_id);
        try {
          localStorage.setItem(`apply_session:${slug}`, data.session_id);
          localStorage.setItem(`apply_lang:${slug}`, preferred);
        } catch {
          /* ignore */
        }
        return data.session_id as string;
      } finally {
        setStarting(false);
      }
    },
    [slug],
  );

  useEffect(() => {
    try {
      const existing = localStorage.getItem(`apply_session:${slug}`);
      const savedLang = localStorage.getItem(`apply_lang:${slug}`);
      if (existing) setSessionId(existing);
      if (savedLang === "en" || savedLang === "el") {
        setLang(savedLang);
        setPhase(needsScreeningIntro ? "intro" : enabled[0] ?? "application_form");
      }
    } catch {
      /* ignore */
    }
  }, [slug, needsScreeningIntro, enabled]);

  function advanceFrom(current: Phase) {
    if (current === "language") {
      setPhase(needsScreeningIntro ? "intro" : enabled[0] ?? "application_form");
      return;
    }
    if (current === "intro") {
      setPhase(enabled[0] ?? "application_form");
      return;
    }
    const idx = enabled.indexOf(current as PipelineStepType);
    if (idx < 0 || idx >= enabled.length - 1) {
      setPhase("done");
      return;
    }
    setPhase(enabled[idx + 1]!);
  }

  async function ensureSession(): Promise<string> {
    if (sessionId) return sessionId;
    return startSession(lang ?? "en");
  }

  async function onPickLanguage(next: PipelineLanguage) {
    setLang(next);
    try {
      const sid = await startSession(next);
      await persistLang(next, sid);
      advanceFrom("language");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start");
    }
  }

  async function onSwitchLanguage(next: PipelineLanguage) {
    setLang(next);
    void persistLang(next);
  }

  if (phase === "done") {
    return (
      <div className="mx-auto max-w-lg px-4 py-20 text-center">
        <div className="rounded-3xl border border-black/5 bg-gradient-to-b from-[#F7F3EE] to-[#EFE8DF] px-8 py-12 shadow-xl">
          <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-[#8B6914]">
            {ui.thankYou}
          </p>
          <h1 className="mt-3 font-serif text-3xl text-[#1a1512]">{ui.applicationReceived}</h1>
          <p className="mt-4 text-sm leading-relaxed text-zinc-600">{ui.applicationReceivedBody}</p>
        </div>
      </div>
    );
  }

  if (phase === "language" || !lang) {
    return (
      <div className="mx-auto max-w-xl px-4 py-12 sm:py-16">
        <div className="overflow-hidden rounded-3xl border border-black/5 bg-gradient-to-b from-[#F7F3EE] to-[#EFE8DF] shadow-xl">
          <div className="bg-[#1a1512] px-6 py-8 text-white">
            <h1 className="font-serif text-3xl tracking-tight">{title}</h1>
            <p className="mt-3 text-sm text-white/65">{PIPELINE_UI_CHOOSE}</p>
          </div>
          <div className="space-y-4 px-6 py-6">
            <p className="text-sm text-zinc-600">{pipelineUi("en").chooseLanguageHint}</p>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                disabled={starting}
                onClick={() => void onPickLanguage("en")}
                className="rounded-2xl border border-black/10 bg-white py-4 text-sm font-medium text-[#1a1512] hover:border-[#C4A484]"
              >
                English
              </button>
              <button
                type="button"
                disabled={starting}
                onClick={() => void onPickLanguage("el")}
                className="rounded-2xl border border-black/10 bg-white py-4 text-sm font-medium text-[#1a1512] hover:border-[#C4A484]"
              >
                Ελληνικά
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const headerBar = (
    <div className="mx-auto flex max-w-xl items-center justify-end px-4 pt-4">
      <LanguageSwitcher lang={lang} onChange={(l) => void onSwitchLanguage(l)} />
    </div>
  );

  if (phase === "intro") {
    return (
      <>
        {headerBar}
        <div className="mx-auto max-w-xl px-4 py-8 sm:py-12">
          <div className="overflow-hidden rounded-3xl border border-black/5 bg-gradient-to-b from-[#F7F3EE] to-[#EFE8DF] shadow-xl">
            <div className="bg-[#1a1512] px-6 py-8 text-white">
              <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-[#D4AF8C]/80">
                {ui.cognitiveTitle} · {ui.eqTitle}
              </p>
              <h1 className="mt-2 font-serif text-3xl tracking-tight">{title}</h1>
              {desc ? <p className="mt-3 text-sm text-white/65 whitespace-pre-line">{desc}</p> : null}
            </div>
            <div className="space-y-4 px-6 py-6 text-sm leading-relaxed text-zinc-700">
              <h2 className="font-medium text-[#1a1512]">{ui.screeningIntroHeadline}</h2>
              <p>{ui.screeningIntroBody}</p>
              <ol className="list-decimal space-y-2 pl-5 text-zinc-600">
                {enabled.map((s) => (
                  <li key={s}>
                    {s === "cognitive_screening" && ui.cognitiveTitle}
                    {s === "eq_screening" && ui.eqTitle}
                    {s === "typing_speed_test" && ui.typingTitle}
                    {s === "application_form" && ui.applicationQuestions}
                  </li>
                ))}
              </ol>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <button
                type="button"
                disabled={starting}
                onClick={() => {
                  void (async () => {
                    try {
                      await ensureSession();
                      advanceFrom("intro");
                    } catch (e) {
                      setError(e instanceof Error ? e.message : "Could not start");
                    }
                  })();
                }}
                className="mt-2 w-full rounded-2xl bg-[#1a1512] py-3.5 text-sm font-medium text-white disabled:opacity-60"
              >
                {starting ? ui.starting : ui.begin}
              </button>
            </div>
          </div>
        </div>
      </>
    );
  }

  if (phase === "cognitive_screening" && cognitiveQuestions) {
    return (
      <>
        {headerBar}
        <CognitiveStep
          slug={slug}
          lang={lang}
          questions={cognitiveQuestions}
          timeLimit={cognitiveTimeLimit}
          ensureSession={ensureSession}
          onComplete={() => advanceFrom("cognitive_screening")}
        />
      </>
    );
  }

  if (phase === "eq_screening" && eqScenarios) {
    return (
      <>
        {headerBar}
        <EqStep
          slug={slug}
          lang={lang}
          scenarios={eqScenarios}
          ensureSession={ensureSession}
          onComplete={() => advanceFrom("eq_screening")}
        />
      </>
    );
  }

  if (phase === "typing_speed_test") {
    return (
      <>
        {headerBar}
        <TypingSpeedTestStep
          slug={slug}
          preferredLanguage={lang}
          ensureSession={ensureSession}
          onComplete={() => advanceFrom("typing_speed_test")}
        />
      </>
    );
  }

  return (
    <>
      {headerBar}
      <ApplicationFormStep
        slug={slug}
        title={title}
        description={desc}
        footer={footer}
        lang={lang}
        questions={questions}
        ensureSession={ensureSession}
        onComplete={() => setPhase("done")}
      />
    </>
  );
}

const PIPELINE_UI_CHOOSE = "Choose your language / Επίλεξε γλώσσα";

function CognitiveStep({
  slug,
  lang,
  questions,
  timeLimit,
  ensureSession,
  onComplete,
}: {
  slug: string;
  lang: PipelineLanguage;
  questions: PublicCognitiveQuestion[];
  timeLimit: number;
  ensureSession: () => Promise<string>;
  onComplete: () => void;
}) {
  const ui = pipelineUi(lang);
  const [answers, setAnswers] = useState<Record<string, number | null>>({});
  const [secondsLeft, setSecondsLeft] = useState(timeLimit);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const startedAt = useRef(Date.now());
  const submitted = useRef(false);
  const [idx, setIdx] = useState(0);

  const submit = useCallback(async () => {
    if (submitted.current) return;
    submitted.current = true;
    setSubmitting(true);
    setError(null);
    try {
      const session_id = await ensureSession();
      const elapsed = Math.round((Date.now() - startedAt.current) / 1000);
      const res = await fetch(`/api/apply/${encodeURIComponent(slug)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "submit_cognitive",
          session_id,
          time_taken_seconds: elapsed,
          answers: questions.map((q) => ({
            question_id: q.id,
            selected_index: answers[q.id] ?? null,
          })),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Submit failed");
      onComplete();
    } catch (e) {
      submitted.current = false;
      setError(e instanceof Error ? e.message : "Submit failed");
      setSubmitting(false);
    }
  }, [answers, ensureSession, onComplete, questions, slug]);

  useEffect(() => {
    const t = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          clearInterval(t);
          void submit();
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [submit]);

  const q = questions[idx]!;
  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const ss = String(secondsLeft % 60).padStart(2, "0");
  const urgent = secondsLeft < 60;

  return (
    <div className="mx-auto max-w-xl px-4 py-10">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-[#8B6914]">{ui.cognitiveTitle}</p>
          <p className="mt-1 text-xs text-zinc-500">
            {idx + 1} / {questions.length}
          </p>
        </div>
        <div
          className={`rounded-full px-3 py-1.5 font-mono text-sm tabular-nums ${
            urgent ? "bg-red-100 text-red-700" : "bg-[#1a1512] text-[#D4AF8C]"
          }`}
        >
          {mm}:{ss}
        </div>
      </div>
      <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-black/10">
        <div
          className="h-full bg-[#C4A484] transition-all"
          style={{ width: `${((idx + 1) / questions.length) * 100}%` }}
        />
      </div>
      <div className="rounded-3xl border border-black/5 bg-[#F7F3EE] p-6 shadow-lg">
        <p className="text-base font-medium text-[#1a1512]">{q.prompt}</p>
        <div className="mt-4 space-y-2">
          {q.options.map((opt, i) => {
            const selected = answers[q.id] === i;
            return (
              <button
                key={i}
                type="button"
                onClick={() => setAnswers((prev) => ({ ...prev, [q.id]: i }))}
                className={`w-full rounded-xl border px-4 py-3 text-left text-sm transition ${
                  selected
                    ? "border-[#C4A484] bg-[#C4A484]/15 text-[#1a1512]"
                    : "border-black/8 bg-white text-zinc-700 hover:border-black/20"
                }`}
              >
                {opt}
              </button>
            );
          })}
        </div>
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        <div className="mt-6 flex justify-between gap-2">
          <button
            type="button"
            disabled={idx === 0}
            onClick={() => setIdx((i) => i - 1)}
            className="rounded-xl border border-black/10 px-4 py-2 text-sm disabled:opacity-40"
          >
            {ui.back}
          </button>
          {idx < questions.length - 1 ? (
            <button
              type="button"
              onClick={() => setIdx((i) => i + 1)}
              className="rounded-xl bg-[#1a1512] px-5 py-2 text-sm text-white"
            >
              {ui.next}
            </button>
          ) : (
            <button
              type="button"
              disabled={submitting}
              onClick={() => void submit()}
              className="rounded-xl bg-[#1a1512] px-5 py-2 text-sm text-white disabled:opacity-60"
            >
              {submitting ? ui.submitting : ui.finishSection}
            </button>
          )}
        </div>
      </div>
      <p className="mt-3 text-center text-[11px] text-zinc-500">{ui.cognitiveBody}</p>
    </div>
  );
}

function EqStep({
  slug,
  lang,
  scenarios,
  ensureSession,
  onComplete,
}: {
  slug: string;
  lang: PipelineLanguage;
  scenarios: EqScenarioPublic[];
  ensureSession: () => Promise<string>;
  onComplete: () => void;
}) {
  const ui = pipelineUi(lang);
  const [answers, setAnswers] = useState<Record<string, number | null>>({});
  const [idx, setIdx] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const startedAt = useRef(Date.now());

  const s = scenarios[idx]!;

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      const session_id = await ensureSession();
      const elapsed = Math.round((Date.now() - startedAt.current) / 1000);
      const res = await fetch(`/api/apply/${encodeURIComponent(slug)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "submit_eq",
          session_id,
          time_taken_seconds: elapsed,
          answers: scenarios.map((sc) => ({
            scenario_id: sc.id,
            selected_index: answers[sc.id] ?? null,
          })),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Submit failed");
      onComplete();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Submit failed");
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-10">
      <p className="text-[11px] uppercase tracking-[0.18em] text-[#8B6914]">{ui.eqTitle}</p>
      <p className="mt-1 text-xs text-zinc-500">
        {idx + 1} / {scenarios.length}
      </p>
      <div className="mt-3 mb-4 h-1.5 overflow-hidden rounded-full bg-black/10">
        <div
          className="h-full bg-[#E8A0BF] transition-all"
          style={{ width: `${((idx + 1) / scenarios.length) * 100}%` }}
        />
      </div>
      <div className="rounded-3xl border border-black/5 bg-[#F7F3EE] p-6 shadow-lg">
        <p className="text-base font-medium leading-relaxed text-[#1a1512]">{s.prompt}</p>
        <div className="mt-4 space-y-2">
          {s.options.map((opt, i) => {
            const selected = answers[s.id] === i;
            return (
              <button
                key={i}
                type="button"
                onClick={() => setAnswers((prev) => ({ ...prev, [s.id]: i }))}
                className={`w-full rounded-xl border px-4 py-3 text-left text-sm transition ${
                  selected
                    ? "border-[#E8A0BF] bg-[#E8A0BF]/20 text-[#1a1512]"
                    : "border-black/8 bg-white text-zinc-700 hover:border-black/20"
                }`}
              >
                {opt}
              </button>
            );
          })}
        </div>
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        <div className="mt-6 flex justify-between gap-2">
          <button
            type="button"
            disabled={idx === 0}
            onClick={() => setIdx((i) => i - 1)}
            className="rounded-xl border border-black/10 px-4 py-2 text-sm disabled:opacity-40"
          >
            {ui.back}
          </button>
          {idx < scenarios.length - 1 ? (
            <button
              type="button"
              disabled={answers[s.id] == null}
              onClick={() => setIdx((i) => i + 1)}
              className="rounded-xl bg-[#1a1512] px-5 py-2 text-sm text-white disabled:opacity-40"
            >
              {ui.next}
            </button>
          ) : (
            <button
              type="button"
              disabled={submitting || answers[s.id] == null}
              onClick={() => void submit()}
              className="rounded-xl bg-[#1a1512] px-5 py-2 text-sm text-white disabled:opacity-60"
            >
              {submitting ? ui.submitting : ui.finishSection}
            </button>
          )}
        </div>
      </div>
      <p className="mt-3 text-center text-[11px] text-zinc-500">{ui.eqBody}</p>
    </div>
  );
}

function ApplicationFormStep({
  slug,
  title,
  description,
  footer,
  lang,
  questions,
  ensureSession,
  onComplete,
}: {
  slug: string;
  title: string;
  description: string;
  footer: string;
  lang: PipelineLanguage;
  questions: ApplicationFormQuestion[];
  ensureSession: () => Promise<string>;
  onComplete: () => void;
}) {
  const ui = pipelineUi(lang);
  const [values, setValues] = useState<AnswerState>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [honeypot, setHoneypot] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const localizedQuestions = useMemo(
    () =>
      questions.map((q) => {
        const loc = localizeQuestion(q, lang);
        return { ...q, question_text: loc.question_text, options: loc.options };
      }),
    [questions, lang],
  );

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
        if (!v?.options?.length) next[q.id] = ui.selectOne;
      } else if (!(v?.text ?? "").trim() && !(v?.options ?? []).length) {
        next[q.id] = ui.required;
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
      const session_id = await ensureSession();
      const answers = questions.map((q) => {
        const v = values[q.id] ?? {};
        const opts = v.options ?? [];
        let text = (v.text ?? "").trim() || null;
        if (q.question_type === "checkboxes") {
          text = opts.join(", ") || null;
        } else if (CHOICE_QUESTION_TYPES.has(q.question_type) && opts.length && !text) {
          text = opts[0] ?? null;
        }
        return { question_id: q.id, answer_text: text, answer_options: opts };
      });

      const res = await fetch(`/api/apply/${encodeURIComponent(slug)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "submit_form",
          session_id,
          preferred_language: lang,
          answers,
          website: honeypot,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Submission failed");
      try {
        localStorage.removeItem(`apply_session:${slug}`);
      } catch {
        /* ignore */
      }
      onComplete();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Submission failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="relative mx-auto max-w-xl px-4 py-10 sm:py-14">
      {questions.length > 3 && (
        <div className="mb-6">
          <div className="mb-2 flex items-center justify-between text-xs text-zinc-500">
            <span>{ui.progress}</span>
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
        questions={localizedQuestions}
        interactive
        lang={lang}
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

      {footer ? (
        <p className="mt-4 text-center text-xs text-zinc-500">{footer}</p>
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
        <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {submitError}
        </p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="mt-6 w-full rounded-2xl bg-[#1a1512] py-3.5 text-sm font-medium text-white shadow-lg transition hover:bg-[#2a221c] disabled:opacity-60"
      >
        {submitting ? ui.submitting : ui.submit}
      </button>
    </form>
  );
}
