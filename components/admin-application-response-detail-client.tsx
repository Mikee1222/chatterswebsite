"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { AdminRowAvatar } from "@/components/admin-list-primitives";
import { StatInfoTooltip } from "@/components/infloww-performance-ui";
import { ApplicationFlagBadges } from "@/components/application-flag-badges";
import {
  ApplicationHireCredentialsModal,
  hireCandidateRequest,
  type HireCredentialsPayload,
} from "@/components/application-hire-credentials-modal";
import { ROUTES } from "@/lib/routes";
import {
  APPLICATION_RESPONSE_STATUSES,
  RESPONSE_STATUS_LABELS,
  type ApplicationFormQuestion,
  type ApplicationFormResponseWithAnswers,
  type ApplicationResponseStatus,
} from "@/lib/application-forms-types";
import {
  RESPONSE_STATUS_STYLE,
  APPLY_SECTION,
  APPLY_INPUT,
  APPLY_EYEBROW,
} from "@/lib/application-ui-tokens";
import { ApplyButton } from "@/components/application-ui-buttons";
import { VA_CARD, VA_STATUS_BADGE } from "@/lib/va-tasks-tokens";
import { cn } from "@/lib/utils";
import { Check, Languages, PartyPopper, Sparkles } from "lucide-react";
import { translationLangLabel } from "@/lib/application-ai-display";
import type { ApplicationFormAnswer } from "@/lib/application-forms-types";

const COGNITIVE_SCORE_TIP =
  "Cognitive percentile shows how this candidate compares to others who took the screening — this becomes more meaningful as more candidates apply";
const EQ_SCORE_TIP = "EQ score (0-100) from situational judgment scenarios";

type Props = {
  formId: string;
  formTitle: string;
  questions: ApplicationFormQuestion[];
  initialResponse: ApplicationFormResponseWithAnswers;
  canManage: boolean;
};

const HIRE_CONFETTI = ["#FF1493", "#D4AF8C", "#E8D0B0", "#ec4899", "#f9a8d4"];

function HireConfetti({ seed }: { seed: number }) {
  const particles = useMemo(() => {
    let s = seed;
    const rnd = () => {
      s = (s * 16807) % 2147483647;
      return (s - 1) / 2147483646;
    };
    return Array.from({ length: 24 }, () => ({
      left: rnd() * 100,
      delay: rnd() * 0.5,
      duration: 0.6 + rnd() * 0.5,
      color: HIRE_CONFETTI[Math.floor(rnd() * HIRE_CONFETTI.length)]!,
      size: 4 + rnd() * 6,
    }));
  }, [seed]);

  return (
    <div className="pointer-events-none fixed inset-0 z-[200] overflow-hidden" aria-hidden>
      {particles.map((p, i) => (
        <span
          key={i}
          className="hire-confetti-particle absolute top-0 rounded-sm opacity-90"
          style={{
            left: `${p.left}%`,
            width: p.size,
            height: p.size * 0.6,
            background: p.color,
            animationDuration: `${p.duration}s`,
            animationDelay: `${p.delay}s`,
          }}
        />
      ))}
    </div>
  );
}

function ScoreCard({
  eyebrow,
  accent,
  tooltip,
  children,
}: {
  eyebrow: string;
  accent: "pink" | "champagne" | "muted";
  tooltip?: string;
  children: React.ReactNode;
}) {
  const border =
    accent === "pink"
      ? "border-[#FF1493]/25"
      : accent === "champagne"
        ? "border-[#D4AF8C]/30"
        : "border-white/10";
  const glow =
    accent === "pink"
      ? "from-[#FF1493]/12"
      : accent === "champagne"
        ? "from-[#D4AF8C]/12"
        : "from-white/[0.04]";
  const eye =
    accent === "pink"
      ? "text-[#FF1493]/85"
      : accent === "champagne"
        ? "text-[#D4AF8C]/85"
        : "text-white/50";
  return (
    <div className={cn(VA_CARD, "border bg-gradient-to-br to-transparent p-4", border, glow)}>
      <p
        className={cn(
          "inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.16em]",
          eye,
        )}
      >
        {eyebrow}
        {tooltip ? <StatInfoTooltip text={tooltip} /> : null}
      </p>
      {children}
    </div>
  );
}

export function AdminApplicationResponseDetailClient({
  formId,
  formTitle,
  questions,
  initialResponse,
  canManage,
}: Props) {
  const [response, setResponse] = useState(initialResponse);
  const [notes, setNotes] = useState(initialResponse.internal_notes ?? "");
  const [busy, setBusy] = useState(false);
  const [hireBurst, setHireBurst] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [hireCreds, setHireCreds] = useState<HireCredentialsPayload | null>(null);
  /** Answer IDs where the translation panel is expanded (cached or just generated). */
  const [translationOpen, setTranslationOpen] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    for (const a of initialResponse.answers) {
      if (a.translated_text?.trim()) init[a.id] = true;
    }
    return init;
  });
  const [translatingIds, setTranslatingIds] = useState<Record<string, boolean>>({});
  const [translatingAll, setTranslatingAll] = useState(false);
  const prevStatus = useRef(initialResponse.status);

  useEffect(() => setMounted(true), []);

  const answersByQ = useMemo(() => {
    return new Map(response.answers.map((a) => [a.question_id, a]));
  }, [response.answers]);

  const displayName = useMemo(() => {
    const first = response.answers.find((a) => (a.answer_text ?? "").trim());
    return first?.answer_text?.trim() || "Candidate";
  }, [response.answers]);

  const textAnswerQuestions = useMemo(() => {
    return questions.filter(
      (q) =>
        (q.question_type === "short_text" || q.question_type === "long_text") &&
        Boolean(answersByQ.get(q.id)?.answer_text?.trim()),
    );
  }, [questions, answersByQ]);

  function mergeAnswers(updated: ApplicationFormAnswer[]) {
    if (updated.length === 0) return;
    const byId = new Map(updated.map((a) => [a.id, a]));
    setResponse((prev) => ({
      ...prev,
      answers: prev.answers.map((a) => byId.get(a.id) ?? a),
    }));
    setTranslationOpen((prev) => {
      const next = { ...prev };
      for (const a of updated) {
        if (a.translated_text?.trim()) next[a.id] = true;
      }
      return next;
    });
  }

  async function translateAnswers(opts: {
    answerId?: string;
    force?: boolean;
  }) {
    const res = await fetch(
      `/api/admin/application-forms/${formId}/responses/${response.id}/translate`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          answerId: opts.answerId,
          force: opts.force,
        }),
      },
    );
    const data = (await res.json().catch(() => ({}))) as {
      error?: string;
      answer?: ApplicationFormAnswer;
      answers?: ApplicationFormAnswer[];
    };
    if (!res.ok) throw new Error(data.error || "Translation failed");
    const list =
      data.answers ?? (data.answer ? [data.answer] : []);
    mergeAnswers(list);
    return list;
  }

  async function handleTranslateOne(answer: ApplicationFormAnswer, force = false) {
    if (answer.translated_text?.trim() && !force) {
      setTranslationOpen((prev) => ({
        ...prev,
        [answer.id]: !prev[answer.id],
      }));
      return;
    }
    setTranslatingIds((prev) => ({ ...prev, [answer.id]: true }));
    try {
      await translateAnswers({ answerId: answer.id, force });
      toast.success(force ? "Translation regenerated" : "Translated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Translation failed");
    } finally {
      setTranslatingIds((prev) => {
        const next = { ...prev };
        delete next[answer.id];
        return next;
      });
    }
  }

  async function handleTranslateAll(force = false) {
    setTranslatingAll(true);
    try {
      const list = await translateAnswers({ force });
      toast.success(
        force
          ? `Regenerated ${list.length} translation${list.length === 1 ? "" : "s"}`
          : `Translated ${list.length} answer${list.length === 1 ? "" : "s"}`,
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Translation failed");
    } finally {
      setTranslatingAll(false);
    }
  }

  async function save(patch: {
    status?: ApplicationResponseStatus;
    internal_notes?: string | null;
  }) {
    setBusy(true);
    try {
      const res = await fetch(
        `/api/admin/application-forms/${formId}/responses/${response.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Update failed");
      const nextStatus = (data.response?.status ?? patch.status) as
        | ApplicationResponseStatus
        | undefined;
      if (nextStatus === "hired" && prevStatus.current !== "hired") {
        setHireBurst(true);
        window.setTimeout(() => setHireBurst(false), 2200);
      }
      if (nextStatus) prevStatus.current = nextStatus;
      setResponse((prev) => ({
        ...prev,
        ...data.response,
        answers: prev.answers,
        cognitive: prev.cognitive,
        eq: prev.eq,
        typing: prev.typing,
        auto_flags: data.response?.auto_flags ?? prev.auto_flags,
        ai_summary: data.response?.ai_summary ?? prev.ai_summary,
      }));
      toast.success(nextStatus === "hired" ? "Hired — congratulations!" : "Updated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleHire() {
    setBusy(true);
    try {
      const result = await hireCandidateRequest(formId, response.id);
      if (prevStatus.current !== "hired") {
        setHireBurst(true);
        window.setTimeout(() => setHireBurst(false), 2200);
      }
      prevStatus.current = "hired";
      setResponse((prev) => ({
        ...prev,
        status: "hired",
        generated_username: result.username,
        has_hire_password: true,
      }));
      setHireCreds({
        username: result.username,
        password: result.password,
        created: result.created,
      });
      toast.success(result.created ? "Hired — credentials ready" : "Credentials loaded");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Hire failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      {mounted && hireBurst
        ? createPortal(<HireConfetti seed={Date.now()} />, document.body)
        : null}

      <Link
        href={ROUTES.admin.applicationFormResponses(formId)}
        className="text-xs text-white/40 hover:text-white/70"
      >
        ← All responses
      </Link>

      <div className={cn(APPLY_SECTION, "mt-6 p-5")}>
        <p className={APPLY_EYEBROW}>Candidate info</p>
        <div className="mt-4 flex items-start gap-4">
          <AdminRowAvatar name={displayName} className="h-12 w-12 text-sm" />
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-2xl font-semibold tracking-tight text-white">
              {displayName}
            </h1>
            <p className="mt-1 text-sm text-white/45">{formTitle}</p>
            <p className="mt-1 text-xs text-white/35">
              Submitted {new Date(response.submitted_at).toLocaleString()}
              {response.respondent_ip ? ` · ${response.respondent_ip}` : ""}
              {response.preferred_language
                ? ` · ${response.preferred_language.toUpperCase()}`
                : ""}
            </p>
            <ApplicationFlagBadges flags={response.auto_flags} className="mt-3" />
          </div>
          <div className="flex flex-col items-end gap-2">
            <span
              className={cn(
                VA_STATUS_BADGE,
                RESPONSE_STATUS_STYLE[response.status],
                response.status === "hired" && "hire-status-glow",
              )}
            >
              {RESPONSE_STATUS_LABELS[response.status]}
            </span>
            {canManage ? (
              <ApplyButton
                variant="adminPrimary"
                loading={busy}
                iconLeft={<PartyPopper className="h-3.5 w-3.5" aria-hidden />}
                onClick={() => void handleHire()}
                className="!min-h-[40px] !px-3 !text-xs"
              >
                {response.status === "hired" && response.has_hire_password
                  ? "Credentials"
                  : "Hire"}
              </ApplyButton>
            ) : null}
          </div>
        </div>
      </div>

      {response.ai_summary ? (
        <div className={cn(APPLY_SECTION, "mt-6 p-5")}>
          <p className={cn(APPLY_EYEBROW, "inline-flex items-center gap-1.5")}>
            <Sparkles className="h-3.5 w-3.5" aria-hidden />
            AI mini summary
          </p>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-white/80">
            {response.ai_summary}
          </p>
        </div>
      ) : null}

      {(response.cognitive || response.eq || response.typing) && (
        <div className="mt-6">
          <p className={APPLY_EYEBROW}>Screening results</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {response.cognitive && (
              <ScoreCard
                eyebrow="Cognitive screening"
                accent="pink"
                tooltip={COGNITIVE_SCORE_TIP}
              >
                <p className="mt-2 text-2xl font-semibold text-white">
                  {response.cognitive.raw_score}/{response.cognitive.total_questions}
                </p>
                <p className="mt-1 text-sm text-white/55">
                  {response.cognitive.percentile_at_time_of_completion != null
                    ? `${response.cognitive.percentile_at_time_of_completion}th percentile`
                    : "Percentile not available"}{" "}
                  · {Math.round(response.cognitive.time_taken_seconds / 60)}m{" "}
                  {response.cognitive.time_taken_seconds % 60}s
                </p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {Object.entries(response.cognitive.category_breakdown).map(([cat, v]) => (
                    <div
                      key={cat}
                      className="rounded-lg border border-white/8 bg-black/25 px-2 py-1.5 text-xs text-white/55"
                    >
                      <span className="capitalize">{cat}</span>: {v.correct}/{v.total}
                    </div>
                  ))}
                </div>
              </ScoreCard>
            )}
            {response.eq && (
              <ScoreCard
                eyebrow="EQ — situational judgment"
                accent="champagne"
                tooltip={EQ_SCORE_TIP}
              >
                <p className="mt-2 text-2xl font-semibold text-white">
                  {response.eq.overall_score}/100
                </p>
                <p className="mt-1 text-sm text-white/55">
                  {Math.round(response.eq.time_taken_seconds / 60)}m{" "}
                  {response.eq.time_taken_seconds % 60}s
                </p>
                <div className="mt-3 space-y-1.5">
                  {Object.entries(response.eq.dimension_breakdown).map(([dim, v]) => (
                    <div
                      key={dim}
                      className="flex items-center justify-between text-xs text-white/55"
                    >
                      <span className="capitalize">{dim.replace(/_/g, " ")}</span>
                      <span>
                        {v.points}/{v.max}
                      </span>
                    </div>
                  ))}
                </div>
              </ScoreCard>
            )}
            {response.typing ? (
              <ScoreCard eyebrow="Typing speed" accent="muted">
                <p className="mt-2 text-2xl font-semibold text-white">
                  {response.typing.wpm}{" "}
                  <span className="text-base font-normal text-white/45">WPM</span>
                </p>
                <p className="mt-1 text-sm text-white/55">
                  {response.typing.accuracy_percent}% accuracy ·{" "}
                  {response.typing.passage_language.toUpperCase()} · {response.typing.device_type}
                </p>
              </ScoreCard>
            ) : (
              <ScoreCard eyebrow="Typing speed" accent="muted">
                <p className="mt-2 text-lg font-medium text-white/55">Not completed</p>
              </ScoreCard>
            )}
          </div>
          <p className="mt-3 text-[11px] text-white/35">
            Screening scores are relative practical comparisons among candidates — not clinically
            validated IQ/EQ measures.
          </p>
        </div>
      )}

      {canManage && (
        <div
          className={cn(
            APPLY_SECTION,
            "mt-6 space-y-3 p-5",
            response.status === "hired" && "border-[#D4AF8C]/35",
          )}
        >
          <label className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-white/35">
            Pipeline status
          </label>
          <div className="flex flex-wrap gap-2">
            {APPLICATION_RESPONSE_STATUSES.map((s) => {
              const active = response.status === s;
              return (
                <button
                  key={s}
                  type="button"
                  disabled={busy}
                  onClick={() => void save({ status: s })}
                  className={cn(
                    VA_STATUS_BADGE,
                    "cursor-pointer transition",
                    RESPONSE_STATUS_STYLE[s],
                    active
                      ? "ring-2 ring-offset-1 ring-offset-[#0A0A0A] ring-white/30"
                      : "opacity-70 hover:opacity-100",
                    s === "hired" && active && "hire-status-glow",
                  )}
                >
                  {RESPONSE_STATUS_LABELS[s]}
                </button>
              );
            })}
          </div>
          {response.generated_username ? (
            <p className="text-xs text-white/45">
              Hire username:{" "}
              <span className="font-medium text-[#D4AF8C]">{response.generated_username}</span>
            </p>
          ) : null}
          <label className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-white/35">
            Internal notes
          </label>
          <textarea
            value={notes}
            disabled={busy}
            rows={4}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={() => {
              if (notes !== (response.internal_notes ?? "")) {
                void save({ internal_notes: notes });
              }
            }}
            className={cn(APPLY_INPUT, "min-h-[100px] w-full resize-y py-3")}
            placeholder="Private notes for hiring team…"
          />
        </div>
      )}

      {!canManage && (
        <p className="mt-4 text-sm text-white/50">
          Status: {RESPONSE_STATUS_LABELS[response.status]}
        </p>
      )}

      <div className="mt-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className={APPLY_EYEBROW}>Form answers</p>
          {canManage && textAnswerQuestions.length > 0 ? (
            <button
              type="button"
              disabled={busy || translatingAll}
              onClick={() => void handleTranslateAll(false)}
              className="inline-flex items-center gap-1.5 rounded-md border border-white/12 bg-white/[0.04] px-3 py-1.5 text-[11px] font-medium text-white/70 transition hover:border-white/20 hover:bg-white/[0.07] hover:text-white disabled:opacity-50"
            >
              <Languages className="h-3.5 w-3.5" aria-hidden />
              {translatingAll ? "Translating…" : "Translate all answers"}
            </button>
          ) : null}
        </div>
        <div className="mt-3 space-y-3">
          {questions.map((q, idx) => {
            const a = answersByQ.get(q.id);
            const display =
              q.question_type === "checkboxes" && a?.answer_options.length
                ? a.answer_options.join(", ")
                : a?.answer_text || a?.answer_options.join(", ") || "—";
            const isText =
              (q.question_type === "short_text" || q.question_type === "long_text") &&
              Boolean(a?.answer_text?.trim());
            const hasTranslation = Boolean(a?.translated_text?.trim());
            const showTranslation = Boolean(a && translationOpen[a.id] && hasTranslation);
            const translating = Boolean(a && translatingIds[a.id]);
            const sourceLabel = translationLangLabel(a?.source_lang ?? "und");
            const targetLabel = translationLangLabel(a?.translation_lang ?? "el");

            return (
              <div key={q.id} className={cn(APPLY_SECTION, "p-4")}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="text-xs text-[#FF1493]/80">
                    {idx + 1}. {q.question_text}
                  </p>
                  {isText && a && (canManage || hasTranslation) ? (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <button
                        type="button"
                        disabled={translating || translatingAll || (!canManage && !hasTranslation)}
                        onClick={() => {
                          if (canManage) {
                            void handleTranslateOne(a, false);
                          } else {
                            setTranslationOpen((prev) => ({
                              ...prev,
                              [a.id]: !prev[a.id],
                            }));
                          }
                        }}
                        className="inline-flex items-center gap-1 rounded-md border border-white/12 bg-white/[0.04] px-2 py-1 text-[11px] font-medium text-white/70 transition hover:border-white/20 hover:bg-white/[0.07] hover:text-white disabled:opacity-50"
                      >
                        <Languages className="h-3 w-3" aria-hidden />
                        {translating
                          ? "Translating…"
                          : hasTranslation
                            ? showTranslation
                              ? "Hide translation"
                              : "Show translation"
                            : "Translate"}
                      </button>
                      {canManage && hasTranslation ? (
                        <button
                          type="button"
                          disabled={translating || translatingAll}
                          onClick={() => void handleTranslateOne(a, true)}
                          className="rounded-md px-2 py-1 text-[11px] text-white/40 transition hover:text-white/70 disabled:opacity-50"
                        >
                          Regenerate
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                </div>

                {showTranslation && a?.translated_text ? (
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-lg border border-white/10 bg-black/25 p-3">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/40">
                        Original ({sourceLabel})
                      </p>
                      <p className="mt-2 whitespace-pre-wrap text-sm text-white/90">
                        {a.answer_text}
                      </p>
                    </div>
                    <div className="rounded-lg border border-[#D4AF8C]/25 bg-[#D4AF8C]/[0.06] p-3">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#D4AF8C]/80">
                        {targetLabel} translation
                      </p>
                      <p className="mt-2 whitespace-pre-wrap text-sm text-white/90">
                        {a.translated_text}
                      </p>
                    </div>
                  </div>
                ) : (
                  <p className="mt-2 whitespace-pre-wrap text-sm text-white/90">{display}</p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {canManage && (
        <div className="mt-6 flex justify-end">
          <ApplyButton
            variant="adminPrimary"
            loading={busy}
            iconLeft={<Check className="h-3.5 w-3.5" aria-hidden />}
            onClick={() => void save({ internal_notes: notes })}
          >
            Save notes
          </ApplyButton>
        </div>
      )}

      {hireCreds ? (
        <ApplicationHireCredentialsModal
          formId={formId}
          responseId={response.id}
          open
          credentials={hireCreds}
          onClose={() => setHireCreds(null)}
        />
      ) : null}
    </div>
  );
}
