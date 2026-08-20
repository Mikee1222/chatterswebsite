"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { AdminRowAvatar } from "@/components/admin-list-primitives";
import { SectionLabel } from "@/components/infloww-performance-ui";
import { ROUTES } from "@/lib/routes";
import {
  APPLICATION_RESPONSE_STATUSES,
  RESPONSE_STATUS_LABELS,
  type ApplicationFormQuestion,
  type ApplicationFormResponseWithAnswers,
  type ApplicationResponseStatus,
} from "@/lib/application-forms-types";
import { RESPONSE_STATUS_STYLE } from "@/lib/application-ui-tokens";
import { VA_BTN_PRIMARY, VA_CARD, VA_FILTER_INPUT, VA_STATUS_BADGE } from "@/lib/va-tasks-tokens";
import { cn } from "@/lib/utils";

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
  children,
}: {
  eyebrow: string;
  accent: "pink" | "champagne" | "muted";
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
    <div
      className={cn(
        VA_CARD,
        "border bg-gradient-to-br to-transparent p-4",
        border,
        glow,
      )}
    >
      <p className={cn("text-[11px] font-semibold uppercase tracking-[0.16em]", eye)}>
        {eyebrow}
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
  const prevStatus = useRef(initialResponse.status);

  useEffect(() => setMounted(true), []);

  const answersByQ = useMemo(() => {
    const m = new Map(response.answers.map((a) => [a.question_id, a]));
    return m;
  }, [response.answers]);

  const displayName = useMemo(() => {
    const first = response.answers.find((a) => (a.answer_text ?? "").trim());
    return first?.answer_text?.trim() || "Candidate";
  }, [response.answers]);

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
      }));
      toast.success(nextStatus === "hired" ? "Hired — congratulations!" : "Updated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed");
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

      <div className="mt-4 flex items-start gap-4">
        <AdminRowAvatar name={displayName} className="h-12 w-12 text-sm" />
        <div className="min-w-0 flex-1">
          <SectionLabel>Candidate</SectionLabel>
          <h1 className="mt-1 truncate text-2xl font-semibold tracking-tight text-white">
            {displayName}
          </h1>
          <p className="mt-1 text-sm text-white/45">{formTitle}</p>
          <p className="mt-1 text-xs text-white/35">
            Submitted {new Date(response.submitted_at).toLocaleString()}
            {response.respondent_ip ? ` · ${response.respondent_ip}` : ""}
          </p>
        </div>
        <span
          className={cn(
            VA_STATUS_BADGE,
            RESPONSE_STATUS_STYLE[response.status],
            response.status === "hired" && "hire-status-glow",
          )}
        >
          {RESPONSE_STATUS_LABELS[response.status]}
        </span>
      </div>

      {(response.cognitive || response.eq || response.typing) && (
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {response.cognitive && (
            <ScoreCard eyebrow="Cognitive screening" accent="pink">
              <p className="mt-2 text-2xl font-semibold text-white">
                {response.cognitive.raw_score}/{response.cognitive.total_questions}
              </p>
              <p className="mt-1 text-sm text-white/55">
                {response.cognitive.percentile_at_time_of_completion != null
                  ? `${response.cognitive.percentile_at_time_of_completion}th percentile`
                  : "Percentile n/a"}{" "}
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
            <ScoreCard eyebrow="EQ — situational judgment" accent="champagne">
              <p className="mt-2 text-2xl font-semibold text-white">
                {response.eq.overall_score}/100
              </p>
              <p className="mt-1 text-sm text-white/55">
                {Math.round(response.eq.time_taken_seconds / 60)}m{" "}
                {response.eq.time_taken_seconds % 60}s
              </p>
              <div className="mt-3 space-y-1.5">
                {Object.entries(response.eq.dimension_breakdown).map(([dim, v]) => (
                  <div key={dim} className="flex items-center justify-between text-xs text-white/55">
                    <span className="capitalize">{dim.replace(/_/g, " ")}</span>
                    <span>
                      {v.points}/{v.max}
                    </span>
                  </div>
                ))}
              </div>
            </ScoreCard>
          )}
          {response.typing && (
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
          )}
        </div>
      )}
      <p className="mt-3 text-[11px] text-white/35">
        Screening scores are relative practical comparisons among candidates — not clinically
        validated IQ/EQ measures.
      </p>

      {canManage && (
        <div
          className={cn(
            VA_CARD,
            "mt-6 space-y-3 border border-white/10 bg-white/[0.03] p-4",
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
            className={cn(VA_FILTER_INPUT, "min-h-[100px] w-full py-3")}
            placeholder="Private notes for hiring team…"
          />
        </div>
      )}

      {!canManage && (
        <p className="mt-4 text-sm text-white/50">
          Status: {RESPONSE_STATUS_LABELS[response.status]}
        </p>
      )}

      <div className="mt-8 space-y-3">
        <h2 className="text-sm font-medium text-white/80">Answers</h2>
        {questions.map((q, idx) => {
          const a = answersByQ.get(q.id);
          const display =
            q.question_type === "checkboxes" && a?.answer_options.length
              ? a.answer_options.join(", ")
              : a?.answer_text || a?.answer_options.join(", ") || "—";
          return (
            <div
              key={q.id}
              className={cn(
                VA_CARD,
                "border border-white/10 bg-[#0D0B0D]/80 p-4",
              )}
            >
              <p className="text-xs text-[#FF1493]/80">
                {idx + 1}. {q.question_text}
              </p>
              <p className="mt-2 whitespace-pre-wrap text-sm text-white/90">{display}</p>
            </div>
          );
        })}
      </div>

      {canManage && (
        <div className="mt-6 flex justify-end">
          <button
            type="button"
            disabled={busy}
            onClick={() => void save({ internal_notes: notes })}
            className={cn(VA_BTN_PRIMARY, "disabled:opacity-50")}
          >
            Save notes
          </button>
        </div>
      )}
    </div>
  );
}
