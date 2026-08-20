"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Check, Languages, Play } from "lucide-react";
import { ApplicationFormPreview } from "@/components/application-form-preview";
import {
  ApplyFooter,
  ApplyHeader,
  ApplyStepShell,
} from "@/components/application-public-chrome";
import { ApplyButton } from "@/components/application-ui-buttons";
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
  questionProgressLabel,
  type PipelineLanguage,
} from "@/lib/application-pipeline-i18n";
import {
  APPLY_CHOICE,
  APPLY_CHOICE_ACTIVE,
  APPLY_CHOICE_ACTIVE_CHAMPAGNE,
  APPLY_CHOICE_IDLE,
  APPLY_EYEBROW,
  APPLY_GLASS,
  APPLY_PROGRESS_FILL,
  APPLY_PROGRESS_TRACK,
  APPLY_SURFACE,
} from "@/lib/application-ui-tokens";
import { cn } from "@/lib/utils";

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

const PIPELINE_UI_CHOOSE = "Choose your language / Επίλεξε γλώσσα";

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

  // Restore an in-progress apply session id only — never auto-select language or
  // skip the picker. Candidates must explicitly click EN/EL every fresh visit.
  useEffect(() => {
    try {
      const existing = localStorage.getItem(`apply_session:${slug}`);
      if (existing) setSessionId(existing);
    } catch {
      /* ignore */
    }
  }, [slug]);

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
      <>
        <ApplyHeader showLang={false} />
        <ApplyStepShell className="flex-1">
          <div className="relative overflow-hidden px-8 py-14 text-center sm:py-16">
            <div
              className="pointer-events-none absolute inset-0 opacity-80"
              aria-hidden
              style={{
                background:
                  "radial-gradient(ellipse 60% 50% at 50% 20%, rgba(255,20,147,0.2), transparent), radial-gradient(ellipse 50% 40% at 50% 80%, rgba(212,175,140,0.15), transparent)",
              }}
            />
            <div className="relative">
              <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-[#D4AF8C]/35 bg-[#D4AF8C]/10 shadow-[0_0_40px_-8px_rgba(212,175,140,0.5)]">
                <Check className="h-7 w-7 text-[#D4AF8C]" aria-hidden />
              </div>
              <p className={APPLY_EYEBROW}>{ui.thankYou}</p>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white">
                {ui.applicationReceived}
              </h1>
              <p className="mx-auto mt-4 max-w-sm text-sm leading-relaxed text-white/50">
                {ui.applicationReceivedBody}
              </p>
            </div>
          </div>
        </ApplyStepShell>
        <ApplyFooter />
      </>
    );
  }

  if (phase === "language" || !lang) {
    return (
      <>
        <ApplyHeader showLang={false} />
        <ApplyStepShell className="flex-1">
          <div className="border-b border-white/8 bg-gradient-to-br from-[#151315] via-[#0D0B0D] to-[#120810] px-6 py-9">
            <p className={cn(APPLY_EYEBROW, "inline-flex items-center gap-2")}>
              <Languages className="h-3.5 w-3.5" aria-hidden />
              Welcome
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">{title}</h1>
            <p className="mt-3 text-sm text-white/50">{PIPELINE_UI_CHOOSE}</p>
          </div>
          <div className="space-y-4 px-6 py-7">
            <p className="text-sm leading-relaxed text-white/50">
              {pipelineUi("en").chooseLanguageHint}
            </p>
            {error && <p className="text-sm text-rose-400">{error}</p>}
            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                disabled={starting}
                onClick={() => void onPickLanguage("en")}
                className={cn(
                  APPLY_CHOICE,
                  "group border-white/10 bg-white/[0.04] px-5 py-6 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] hover:border-[#FF1493]/45 hover:bg-[#FF1493]/10 hover:shadow-[0_0_28px_-10px_rgba(255,20,147,0.45)] disabled:opacity-50",
                )}
              >
                <span className="block text-lg font-semibold text-white">English</span>
                <span className="mt-1.5 block text-xs text-white/40 group-hover:text-white/55">
                  {pipelineUi("en").continueInEnglish}
                </span>
              </button>
              <button
                type="button"
                disabled={starting}
                onClick={() => void onPickLanguage("el")}
                className={cn(
                  APPLY_CHOICE,
                  "group border-white/10 bg-white/[0.04] px-5 py-6 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] hover:border-[#D4AF8C]/45 hover:bg-[#D4AF8C]/10 hover:shadow-[0_0_28px_-10px_rgba(212,175,140,0.4)] disabled:opacity-50",
                )}
              >
                <span className="block text-lg font-semibold text-white">Ελληνικά</span>
                <span className="mt-1.5 block text-xs text-white/40 group-hover:text-white/55">
                  {pipelineUi("el").continueInGreek}
                </span>
              </button>
            </div>
          </div>
        </ApplyStepShell>
        <ApplyFooter />
      </>
    );
  }

  const chrome = (
    <ApplyHeader lang={lang} onLangChange={(l) => void onSwitchLanguage(l)} />
  );

  if (phase === "intro") {
    return (
      <>
        {chrome}
        <ApplyStepShell className="flex-1">
          <div className="border-b border-white/8 bg-gradient-to-br from-[#151315] via-[#0D0B0D] to-[#120810] px-6 py-8">
            <p className={APPLY_EYEBROW}>
              {ui.cognitiveTitle} · {ui.eqTitle}
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">{title}</h1>
            {desc ? (
              <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-white/50">
                {desc}
              </p>
            ) : null}
          </div>
          <div className="space-y-5 px-6 py-7">
            <h2 className="text-base font-medium text-white">{ui.screeningIntroHeadline}</h2>
            <p className="text-sm leading-relaxed text-white/50">{ui.screeningIntroBody}</p>
            <ol className="space-y-2.5">
              {enabled.map((s, i) => (
                <li
                  key={s}
                  className={cn(APPLY_SURFACE, "flex items-center gap-3 px-3.5 py-3")}
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-[#FF1493]/25 bg-[#FF1493]/15 text-xs font-bold text-[#FF1493]">
                    {i + 1}
                  </span>
                  <span className="text-sm text-white/80">
                    {s === "cognitive_screening" && ui.cognitiveTitle}
                    {s === "eq_screening" && ui.eqTitle}
                    {s === "typing_speed_test" && ui.typingTitle}
                    {s === "application_form" && ui.applicationQuestions}
                  </span>
                </li>
              ))}
            </ol>
            {error && <p className="text-sm text-rose-400">{error}</p>}
            <ApplyButton
              variant="primary"
              loading={starting}
              iconLeft={<Play className="h-4 w-4" aria-hidden />}
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
            >
              {starting ? ui.starting : ui.begin}
            </ApplyButton>
          </div>
        </ApplyStepShell>
        <ApplyFooter text={footer} />
      </>
    );
  }

  if (phase === "cognitive_screening" && cognitiveQuestions) {
    return (
      <>
        {chrome}
        <CognitiveStep
          slug={slug}
          lang={lang}
          questions={cognitiveQuestions}
          timeLimit={cognitiveTimeLimit}
          ensureSession={ensureSession}
          onComplete={() => advanceFrom("cognitive_screening")}
        />
        <ApplyFooter />
      </>
    );
  }

  if (phase === "eq_screening" && eqScenarios) {
    return (
      <>
        {chrome}
        <EqStep
          slug={slug}
          lang={lang}
          scenarios={eqScenarios}
          ensureSession={ensureSession}
          onComplete={() => advanceFrom("eq_screening")}
        />
        <ApplyFooter />
      </>
    );
  }

  if (phase === "typing_speed_test") {
    return (
      <>
        {chrome}
        <TypingSpeedTestStep
          slug={slug}
          preferredLanguage={lang}
          ensureSession={ensureSession}
          onComplete={() => advanceFrom("typing_speed_test")}
        />
        <ApplyFooter />
      </>
    );
  }

  return (
    <>
      {chrome}
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
    <ApplyStepShell className="flex-1">
      <div className="border-b border-white/8 px-5 py-4 sm:px-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className={APPLY_EYEBROW}>{ui.cognitiveTitle}</p>
            <p className="mt-1 text-xs font-medium tabular-nums text-[#D4AF8C]/90">
              {questionProgressLabel(lang, idx + 1, questions.length)}
            </p>
          </div>
          <div
            className={cn(
              "rounded-full px-3.5 py-1.5 font-mono text-sm tabular-nums",
              urgent
                ? "border border-rose-500/40 bg-rose-500/15 text-rose-300"
                : "border border-[#D4AF8C]/30 bg-[#D4AF8C]/10 text-[#D4AF8C]",
            )}
          >
            {mm}:{ss}
          </div>
        </div>
        <div className={cn(APPLY_PROGRESS_TRACK, "mt-4")}>
          <div
            className={APPLY_PROGRESS_FILL}
            style={{ width: `${((idx + 1) / questions.length) * 100}%` }}
          />
        </div>
      </div>
      <div className="px-5 py-6 sm:px-6">
        <p className="text-base font-medium leading-relaxed text-white">{q.prompt}</p>
        <div className="mt-5 space-y-2.5">
          {q.options.map((opt, i) => {
            const selected = answers[q.id] === i;
            return (
              <button
                key={i}
                type="button"
                onClick={() => setAnswers((prev) => ({ ...prev, [q.id]: i }))}
                className={cn(
                  APPLY_CHOICE,
                  selected ? APPLY_CHOICE_ACTIVE : APPLY_CHOICE_IDLE,
                )}
              >
                {opt}
              </button>
            );
          })}
        </div>
        {error && <p className="mt-3 text-sm text-rose-400">{error}</p>}
        <div className="mt-7 flex justify-between gap-3">
          <ApplyButton
            variant="ghost"
            disabled={idx === 0}
            iconLeft={<ArrowLeft className="h-4 w-4" aria-hidden />}
            onClick={() => setIdx((i) => i - 1)}
            className="w-auto"
          >
            {ui.back}
          </ApplyButton>
          {idx < questions.length - 1 ? (
            <ApplyButton
              variant="primaryInline"
              iconRight={<ArrowRight className="h-4 w-4" aria-hidden />}
              onClick={() => setIdx((i) => i + 1)}
            >
              {ui.next}
            </ApplyButton>
          ) : (
            <ApplyButton
              variant="primaryInline"
              loading={submitting}
              iconRight={<Check className="h-4 w-4" aria-hidden />}
              onClick={() => void submit()}
            >
              {submitting ? ui.submitting : ui.finishSection}
            </ApplyButton>
          )}
        </div>
      </div>
      <p className="border-t border-white/8 px-5 py-3 text-center text-[11px] text-white/30 sm:px-6">
        {ui.cognitiveBody}
      </p>
    </ApplyStepShell>
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
    <ApplyStepShell className="flex-1">
      <div className="border-b border-white/8 px-5 py-4 sm:px-6">
        <p className={APPLY_EYEBROW}>{ui.eqTitle}</p>
        <p className="mt-1 text-xs font-medium tabular-nums text-[#D4AF8C]/90">
          {questionProgressLabel(lang, idx + 1, scenarios.length)}
        </p>
        <div className={cn(APPLY_PROGRESS_TRACK, "mt-4")}>
          <div
            className={APPLY_PROGRESS_FILL}
            style={{ width: `${((idx + 1) / scenarios.length) * 100}%` }}
          />
        </div>
      </div>
      <div className="px-5 py-6 sm:px-6">
        <div className={cn(APPLY_SURFACE, "p-4 sm:p-5")}>
          <p className="text-base font-medium leading-relaxed text-white">{s.prompt}</p>
        </div>
        <div className="mt-4 space-y-2.5">
          {s.options.map((opt, i) => {
            const selected = answers[s.id] === i;
            return (
              <button
                key={i}
                type="button"
                onClick={() => setAnswers((prev) => ({ ...prev, [s.id]: i }))}
                className={cn(
                  APPLY_CHOICE,
                  selected ? APPLY_CHOICE_ACTIVE_CHAMPAGNE : APPLY_CHOICE_IDLE,
                )}
              >
                {opt}
              </button>
            );
          })}
        </div>
        {error && <p className="mt-3 text-sm text-rose-400">{error}</p>}
        <div className="mt-7 flex justify-between gap-3">
          <ApplyButton
            variant="ghost"
            disabled={idx === 0}
            iconLeft={<ArrowLeft className="h-4 w-4" aria-hidden />}
            onClick={() => setIdx((i) => i - 1)}
            className="w-auto"
          >
            {ui.back}
          </ApplyButton>
          {idx < scenarios.length - 1 ? (
            <ApplyButton
              variant="primaryInline"
              disabled={answers[s.id] == null}
              iconRight={<ArrowRight className="h-4 w-4" aria-hidden />}
              onClick={() => setIdx((i) => i + 1)}
            >
              {ui.next}
            </ApplyButton>
          ) : (
            <ApplyButton
              variant="primaryInline"
              loading={submitting}
              disabled={answers[s.id] == null}
              iconRight={<Check className="h-4 w-4" aria-hidden />}
              onClick={() => void submit()}
            >
              {submitting ? ui.submitting : ui.finishSection}
            </ApplyButton>
          )}
        </div>
      </div>
      <p className="border-t border-white/8 px-5 py-3 text-center text-[11px] text-white/30 sm:px-6">
        {ui.eqBody}
      </p>
    </ApplyStepShell>
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
  const [idx, setIdx] = useState(0);

  const localizedQuestions = useMemo(
    () =>
      questions.map((q) => {
        const loc = localizeQuestion(q, lang);
        return { ...q, question_text: loc.question_text, options: loc.options };
      }),
    [questions, lang],
  );

  const total = localizedQuestions.length;
  const current = localizedQuestions[idx];
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
          current.question_type === "checkboxes" ? ui.selectOne : ui.required,
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
        next[q.id] = q.question_type === "checkboxes" ? ui.selectOne : ui.required;
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

  function goNext() {
    if (!validateCurrent()) return;
    if (idx < total - 1) setIdx((i) => i + 1);
    else void onSubmit();
  }

  return (
    <div className="relative mx-auto flex w-full max-w-xl flex-1 flex-col px-4 py-6 sm:py-8">
      <div className={cn(APPLY_GLASS, "flex flex-1 flex-col")}>
        <div className="border-b border-white/8 bg-gradient-to-br from-[#151315] via-[#0D0B0D] to-[#120810] px-6 py-7">
          <p className={APPLY_EYEBROW}>{ui.applicationQuestions}</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
            {title}
          </h1>
          {description ? (
            <p className="mt-3 max-w-prose whitespace-pre-line text-sm leading-relaxed text-white/50">
              {description}
            </p>
          ) : null}
          {total > 0 ? (
            <div className="mt-6">
              <div className="mb-2 flex items-center justify-between text-xs">
                <span className="font-medium tabular-nums text-[#D4AF8C]">
                  {questionProgressLabel(lang, Math.min(idx + 1, total), total)}
                </span>
                <span className="tabular-nums text-white/35">{progressPct}%</span>
              </div>
              <div className={APPLY_PROGRESS_TRACK}>
                <div className={APPLY_PROGRESS_FILL} style={{ width: `${progressPct}%` }} />
              </div>
            </div>
          ) : null}
        </div>

        <div className="flex flex-1 flex-col px-5 py-6 sm:px-6">
          {current ? (
            <ApplicationFormPreview
              title={title}
              questions={localizedQuestions}
              interactive
              lang={lang}
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
          ) : (
            <p className="text-center text-sm text-white/40">No questions yet</p>
          )}

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
              {ui.back}
            </ApplyButton>
            {idx < total - 1 ? (
              <ApplyButton
                variant="primaryInline"
                iconRight={<ArrowRight className="h-4 w-4" aria-hidden />}
                onClick={goNext}
              >
                {ui.next}
              </ApplyButton>
            ) : (
              <ApplyButton
                variant="primaryInline"
                loading={submitting}
                iconRight={<Check className="h-4 w-4" aria-hidden />}
                onClick={() => void onSubmit()}
              >
                {submitting ? ui.submitting : ui.submit}
              </ApplyButton>
            )}
          </div>
        </div>
      </div>

      <ApplyFooter text={footer} />
    </div>
  );
}
