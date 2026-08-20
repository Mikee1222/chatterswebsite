"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { SectionLabel } from "@/components/infloww-performance-ui";
import { ROUTES } from "@/lib/routes";
import {
  APPLICATION_RESPONSE_STATUSES,
  RESPONSE_STATUS_LABELS,
  type ApplicationFormQuestion,
  type ApplicationFormResponseWithAnswers,
  type ApplicationResponseStatus,
} from "@/lib/application-forms-types";

const BORDER = "rgba(255,255,255,0.08)";
const GOLD = "#D4AF8C";

type Props = {
  formId: string;
  formTitle: string;
  questions: ApplicationFormQuestion[];
  initialResponse: ApplicationFormResponseWithAnswers;
  canManage: boolean;
};

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

  const answersByQ = useMemo(() => {
    const m = new Map(response.answers.map((a) => [a.question_id, a]));
    return m;
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
      setResponse((prev) => ({
        ...prev,
        ...data.response,
        answers: prev.answers,
        cognitive: prev.cognitive,
        eq: prev.eq,
        typing: prev.typing,
      }));
      toast.success("Updated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <Link
        href={ROUTES.admin.applicationFormResponses(formId)}
        className="text-xs text-white/40 hover:text-white/70"
      >
        ← All responses
      </Link>
      <div className="mt-3">
        <SectionLabel>Candidate</SectionLabel>
      </div>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white">{formTitle}</h1>
      <p className="mt-1 text-xs text-white/40">
        Submitted {new Date(response.submitted_at).toLocaleString()}
        {response.respondent_ip ? ` · ${response.respondent_ip}` : ""}
      </p>

      {(response.cognitive || response.eq || response.typing) && (
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {response.cognitive && (
            <div
              className="rounded-2xl border p-4"
              style={{
                borderColor: "rgba(125,211,192,0.25)",
                background: "linear-gradient(135deg, rgba(125,211,192,0.12), transparent)",
              }}
            >
              <p className="text-[11px] uppercase tracking-wider text-[#7DD3C0]/80">
                Cognitive screening
              </p>
              <p className="mt-2 text-2xl font-semibold text-white">
                {response.cognitive.raw_score}/{response.cognitive.total_questions}
              </p>
              <p className="mt-1 text-sm text-white/60">
                {response.cognitive.percentile_at_time_of_completion != null
                  ? `${response.cognitive.percentile_at_time_of_completion}th percentile`
                  : "Percentile n/a"}{" "}
                · {Math.round(response.cognitive.time_taken_seconds / 60)}m{" "}
                {response.cognitive.time_taken_seconds % 60}s
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {Object.entries(response.cognitive.category_breakdown).map(([cat, v]) => (
                  <div key={cat} className="rounded-lg bg-black/20 px-2 py-1.5 text-xs text-white/55">
                    <span className="capitalize">{cat}</span>: {v.correct}/{v.total}
                  </div>
                ))}
              </div>
            </div>
          )}
          {response.eq && (
            <div
              className="rounded-2xl border p-4"
              style={{
                borderColor: "rgba(232,160,191,0.25)",
                background: "linear-gradient(135deg, rgba(232,160,191,0.12), transparent)",
              }}
            >
              <p className="text-[11px] uppercase tracking-wider text-[#E8A0BF]/80">
                EQ — situational judgment
              </p>
              <p className="mt-2 text-2xl font-semibold text-white">{response.eq.overall_score}/100</p>
              <p className="mt-1 text-sm text-white/60">
                {Math.round(response.eq.time_taken_seconds / 60)}m {response.eq.time_taken_seconds % 60}s
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
            </div>
          )}
          {response.typing && (
            <div
              className="rounded-2xl border p-4"
              style={{
                borderColor: "rgba(147,197,253,0.25)",
                background: "linear-gradient(135deg, rgba(147,197,253,0.12), transparent)",
              }}
            >
              <p className="text-[11px] uppercase tracking-wider text-[#93C5FD]/80">
                Typing speed
              </p>
              <p className="mt-2 text-2xl font-semibold text-white">
                {response.typing.wpm}{" "}
                <span className="text-base font-normal text-white/50">WPM</span>
              </p>
              <p className="mt-1 text-sm text-white/60">
                {response.typing.accuracy_percent}% accuracy ·{" "}
                {response.typing.passage_language.toUpperCase()} · {response.typing.device_type}
              </p>
            </div>
          )}
        </div>
      )}
      <p className="mt-3 text-[11px] text-white/35">
        Screening scores are relative practical comparisons among candidates — not clinically
        validated IQ/EQ measures.
      </p>

      {canManage && (
        <div
          className="mt-6 space-y-3 rounded-2xl border p-4"
          style={{ borderColor: BORDER, background: "rgba(255,255,255,0.02)" }}
        >
          <label className="block text-[11px] uppercase tracking-wider text-white/35">
            Pipeline status
          </label>
          <select
            value={response.status}
            disabled={busy}
            onChange={(e) =>
              void save({ status: e.target.value as ApplicationResponseStatus })
            }
            className="h-11 w-full rounded-xl border border-[#1f1f1f] bg-[#0d0d0d] px-3 text-sm text-white"
          >
            {APPLICATION_RESPONSE_STATUSES.map((s) => (
              <option key={s} value={s}>
                {RESPONSE_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
          <label className="block text-[11px] uppercase tracking-wider text-white/35">
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
            className="w-full rounded-xl border border-[#1f1f1f] bg-[#0d0d0d] px-3 py-3 text-sm text-white"
            placeholder="Private notes for hiring team…"
          />
        </div>
      )}

      {!canManage && (
        <p className="mt-4 text-sm text-white/50">
          Status: {RESPONSE_STATUS_LABELS[response.status]}
        </p>
      )}

      <div className="mt-8 space-y-4">
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
              className="rounded-2xl border p-4"
              style={{ borderColor: BORDER, background: "rgba(13,11,13,0.65)" }}
            >
              <p className="text-xs text-white/40">
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
            className="rounded-lg px-4 py-2 text-sm font-medium text-[#0D0B0D] disabled:opacity-50"
            style={{ background: GOLD }}
          >
            Save notes
          </button>
        </div>
      )}
    </div>
  );
}
