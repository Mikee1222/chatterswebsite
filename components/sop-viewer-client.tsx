"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  BookOpen,
  CheckCircle2,
  Circle,
  GraduationCap,
  Lock,
  RefreshCw,
  Target,
} from "lucide-react";
import { SopRoleIcon } from "@/components/sop/sop-icons";
import { Markdown } from "@/components/ui/markdown";
import { FilePreview } from "@/components/ui/file-preview";
import { LoomEmbed } from "@/components/ui/loom-embed";
import { Spinner } from "@/components/ui/spinner";
import { Checkbox } from "@/components/ui/form";
import { SopShell } from "@/components/sop/sop-shell";
import { SopEmptyState } from "@/components/sop/sop-empty-state";
import { SopGlowBadge } from "@/components/sop/sop-glow-badge";
import { SopFeedbackPanel } from "@/components/sop-feedback-panel";
import { SopCertificationShelf } from "@/components/sop-certification-shelf";
import {
  formatEstimatedMinutes,
  hasTimeEstimates,
  remainingEstimatedMinutes,
  sumEstimatedMinutes,
} from "@/lib/sop-academy";
import { CADENCE_STYLES, SOP_COLOR_STYLES } from "@/components/sop/sop-colors";
import { useSopMotion } from "@/components/sop/sop-motion";
import { cn } from "@/lib/utils";

const SIGNOFF_STATEMENT =
  "I confirm I have read, understood, and will follow all SOPs for this role.";
import type {
  SopCertificationBadge,
  SopDepartment,
  SopFunction,
  SopRole,
  SopColor,
  CadenceType,
  SopQuizCorrectOption,
} from "@/types";

const CADENCE_LABELS: Record<CadenceType, string> = {
  daily: "Daily",
  per_shift: "Per shift",
  weekly: "Weekly",
  biweekly: "Biweekly",
  monthly: "Monthly",
  ad_hoc: "Ad hoc",
};

export type SopRoleBundle = {
  role: SopRole;
  functions: SopFunction[];
};

type SafeQuizQuestion = {
  id: string;
  question_id: string;
  question: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  sort_order: number;
};

type RoleProgressState = {
  completed: Set<string>;
  stale: Set<string>;
  signoff: { signed_at: string; statement: string } | null;
};

function sortFunctions(items: SopFunction[]): SopFunction[] {
  return [...items].sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));
}

type StepStatus = "completed" | "current" | "locked" | "stale";

function getStepStatus(
  fnId: string,
  sorted: SopFunction[],
  completed: Set<string>,
  stale: Set<string>
): StepStatus {
  if (stale.has(fnId)) return "stale";
  if (completed.has(fnId)) return "completed";
  const firstIncompleteIdx = sorted.findIndex((f) => !completed.has(f.id) || stale.has(f.id));
  if (firstIncompleteIdx < 0) return "completed";
  const idx = sorted.findIndex((f) => f.id === fnId);
  if (idx === firstIncompleteIdx) return "current";
  return "locked";
}

function RoleTabs({
  roles,
  activeId,
  onChange,
}: {
  roles: SopRole[];
  activeId: string;
  onChange: (id: string) => void;
}) {
  const motionCfg = useSopMotion();

  return (
    <div className="flex flex-wrap gap-2.5">
      {roles.map((role) => {
        const active = activeId === role.id;
        const cfg = SOP_COLOR_STYLES[role.color];
        return (
          <motion.button
            key={role.id}
            type="button"
            layout
            whileHover={motionCfg.hoverScale}
            whileTap={active ? undefined : { scale: 0.97 }}
            onClick={() => onChange(role.id)}
            className={cn(
              "relative rounded-full border px-4 py-2 text-xs font-semibold transition-colors duration-300",
              active
                ? cn(cfg.badge, cfg.glow, "border-opacity-40")
                : "border-white/10 bg-white/[0.04] text-white/50 hover:border-white/18 hover:bg-white/[0.07] hover:text-white/85"
            )}
          >
            {active ? (
              <motion.span
                layoutId="sop-role-pill-glow"
                className="pointer-events-none absolute inset-0 rounded-full opacity-60"
                style={{
                  boxShadow: "0 0 24px -4px hsl(330 80% 55% / 0.2)",
                }}
                transition={motionCfg.tabTransition}
              />
            ) : null}
            <span className="relative inline-flex items-center gap-1.5">
              <SopRoleIcon name={role.icon} size="sm" className="opacity-70" />
              {role.name}
              {role.academy_mode ? (
                <GraduationCap className="h-3 w-3 opacity-60" aria-hidden />
              ) : null}
            </span>
          </motion.button>
        );
      })}
    </div>
  );
}

function FunctionStandardBody({
  fn,
  department,
  showUpdatedBadge,
  roleId,
  showFeedback,
}: {
  fn: SopFunction;
  department: SopDepartment | undefined;
  showUpdatedBadge?: boolean;
  roleId?: string;
  showFeedback?: boolean;
}) {
  const deptStyle = department ? SOP_COLOR_STYLES[department.color] : SOP_COLOR_STYLES.gray;
  const cadenceStyle = CADENCE_STYLES[fn.cadence_type];

  return (
    <>
      <div className="border-b border-white/[0.07] px-5 py-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold tracking-tight text-white">{fn.name}</h3>
            {showUpdatedBadge ? (
              <SopGlowBadge
                className="bg-amber-500/15 text-amber-200"
                glowClassName="shadow-[0_0_16px_-4px_rgba(245,158,11,0.35)]"
              >
                <RefreshCw className="mr-1 inline h-3 w-3" />
                Updated
              </SopGlowBadge>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {department ? (
              <SopGlowBadge className={deptStyle.badge} glowClassName={deptStyle.glow}>
                {department.name}
              </SopGlowBadge>
            ) : null}
            <SopGlowBadge className={cadenceStyle.badge} glowClassName={cadenceStyle.glow}>
              {CADENCE_LABELS[fn.cadence_type]}
              {fn.cadence_note.trim() ? ` · ${fn.cadence_note}` : ""}
            </SopGlowBadge>
          </div>
        </div>
        {fn.kpi.trim() ? (
          <div className="mt-3 flex items-start gap-2.5 rounded-lg bg-white/[0.03] px-1 py-1">
            <Target className="mt-0.5 h-4 w-4 shrink-0 text-pink-300/60" />
            <p className="text-sm text-white/60">
              <span className="font-semibold text-white/75">KPI:</span> {fn.kpi}
            </p>
          </div>
        ) : null}
      </div>

      <div className="space-y-5 px-5 py-5">
        <div>
          <p className="mb-2.5 text-[11px] font-bold uppercase tracking-wider text-white/40">Standard</p>
          {fn.standard_type === "file" ? (
            fn.sop_file_url.trim() ? (
              <FilePreview url={fn.sop_file_url} name={fn.sop_file_name} />
            ) : (
              <p className="text-sm text-white/45">No file uploaded yet.</p>
            )
          ) : (
            <Markdown emptyFallback="No SOP content yet.">{fn.sop_content}</Markdown>
          )}
        </div>
        {fn.loom_url.trim() ? <LoomEmbed url={fn.loom_url} title={`${fn.name} — Loom`} /> : null}
      </div>
      {showFeedback && roleId ? (
        <div className="border-t border-white/[0.07] px-5 py-5">
          <SopFeedbackPanel roleId={roleId} functionId={fn.id} />
        </div>
      ) : null}
    </>
  );
}

function FunctionCard({
  fn,
  department,
  roleId,
}: {
  fn: SopFunction;
  department: SopDepartment | undefined;
  roleId: string;
}) {
  const motionCfg = useSopMotion();

  return (
    <motion.article
      variants={motionCfg.item}
      whileHover={motionCfg.hoverLift}
      className="sop-glass-card group overflow-hidden rounded-2xl transition-[border-color,box-shadow] duration-300 hover:border-white/14 hover:shadow-[0_0_48px_-12px_hsl(330_80%_55%_/_0.12)]"
    >
      <FunctionStandardBody
        fn={fn}
        department={department}
        roleId={roleId}
        showFeedback
      />
    </motion.article>
  );
}

function AcademyQuizPanel({
  questions,
  answers,
  onAnswer,
  wrongIds,
  submitting,
}: {
  questions: SafeQuizQuestion[];
  answers: Record<string, SopQuizCorrectOption | "">;
  onAnswer: (questionId: string, option: SopQuizCorrectOption) => void;
  wrongIds: Set<string>;
  submitting: boolean;
}) {
  return (
    <div className="space-y-4">
      <p className="text-[11px] font-bold uppercase tracking-wider text-white/40">Knowledge check</p>
      {questions.map((q) => (
        <div
          key={q.id}
          className={cn(
            "rounded-xl border p-4",
            wrongIds.has(q.id)
              ? "border-rose-500/30 bg-rose-500/5"
              : "border-white/10 bg-white/[0.02]"
          )}
        >
          <p className="mb-3 text-sm font-medium text-white/90">{q.question}</p>
          <div className="space-y-2">
            {(["a", "b", "c", "d"] as const).map((opt) => {
              const label = q[`option_${opt}`];
              if (!label.trim()) return null;
              const selected = answers[q.id] === opt;
              return (
                <label
                  key={opt}
                  className={cn(
                    "flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2 text-sm transition",
                    selected
                      ? "border-pink-500/35 bg-pink-500/10 text-pink-100"
                      : "border-white/8 bg-white/[0.02] text-white/70 hover:border-white/14",
                    submitting && "pointer-events-none opacity-60"
                  )}
                >
                  <input
                    type="radio"
                    name={`quiz-${q.id}`}
                    checked={selected}
                    onChange={() => onAnswer(q.id, opt)}
                    className="accent-pink-500"
                  />
                  <span className="font-semibold uppercase text-white/40">{opt}.</span>
                  <span>{label}</span>
                </label>
              );
            })}
          </div>
          {wrongIds.has(q.id) ? (
            <p className="mt-2 text-xs text-rose-300/90">Incorrect — try again.</p>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function AcademyStepper({
  sorted,
  completed,
  stale,
  activeId,
  onSelect,
  roleColor,
}: {
  sorted: SopFunction[];
  completed: Set<string>;
  stale: Set<string>;
  activeId: string;
  onSelect: (id: string) => void;
  roleColor: SopColor;
}) {
  const motionCfg = useSopMotion();
  const cfg = SOP_COLOR_STYLES[roleColor];

  return (
    <div className="flex flex-wrap items-center gap-2">
      {sorted.map((fn, i) => {
        const status = getStepStatus(fn.id, sorted, completed, stale);
        const active = fn.id === activeId;
        const clickable = status === "completed" || status === "current" || status === "stale";

        return (
          <React.Fragment key={fn.id}>
            {i > 0 ? (
              <span
                className={cn(
                  "hidden h-px w-4 sm:block",
                  status === "locked" ? "bg-white/10" : "bg-pink-500/35"
                )}
              />
            ) : null}
            <motion.button
              type="button"
              disabled={!clickable}
              whileHover={clickable ? motionCfg.hoverScale : undefined}
              whileTap={clickable ? { scale: 0.97 } : undefined}
              onClick={() => clickable && onSelect(fn.id)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition",
                status === "completed" &&
                  (active
                    ? cn(cfg.badge, cfg.glow, "border-opacity-40")
                    : "border-emerald-500/25 bg-emerald-500/10 text-emerald-200/90"),
                status === "stale" &&
                  "border-amber-500/30 bg-amber-500/10 text-amber-200/90",
                status === "current" && cn(cfg.badge, cfg.glow, "border-opacity-50"),
                status === "locked" &&
                  "cursor-not-allowed border-white/8 bg-white/[0.02] text-white/30",
                !clickable && "pointer-events-none"
              )}
              title={fn.name}
            >
              {status === "completed" ? (
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
              ) : status === "stale" ? (
                <RefreshCw className="h-3.5 w-3.5 shrink-0" />
              ) : status === "current" ? (
                <Circle className="h-3.5 w-3.5 shrink-0 fill-current opacity-60" />
              ) : (
                <Lock className="h-3.5 w-3.5 shrink-0" />
              )}
              <span className="max-w-[8rem] truncate">{fn.name}</span>
              {(fn.estimated_minutes ?? 0) > 0 ? (
                <span className="rounded-full bg-white/10 px-1.5 py-0.5 text-[10px] font-medium text-white/50">
                  {formatEstimatedMinutes(fn.estimated_minutes!)}
                </span>
              ) : null}
            </motion.button>
          </React.Fragment>
        );
      })}
    </div>
  );
}

function AcademyRoleContent({
  bundle,
  departmentById,
  progressState,
  initialStepId,
  onProgressUpdate,
}: {
  bundle: SopRoleBundle;
  departmentById: Map<string, SopDepartment>;
  progressState: RoleProgressState;
  initialStepId?: string;
  onProgressUpdate: (state: RoleProgressState) => void;
}) {
  const motionCfg = useSopMotion();
  const { role, functions } = bundle;
  const roleStyle = SOP_COLOR_STYLES[role.color];
  const sorted = sortFunctions(functions.filter((f) => f.is_active));
  const total = sorted.length;
  const { completed: completedIds, stale: staleIds, signoff } = progressState;
  const completedCount = sorted.filter((f) => completedIds.has(f.id) && !staleIds.has(f.id)).length;
  const percent = total > 0 ? Math.round((completedCount / total) * 100) : 0;
  const allStepsComplete = total > 0 && completedCount >= total;
  const trainingComplete = allStepsComplete && signoff != null;
  const showTimeEstimates = hasTimeEstimates(sorted);
  const totalMinutes = sumEstimatedMinutes(sorted);
  const remainingMinutes = remainingEstimatedMinutes(sorted, completedIds);

  const firstIncomplete = sorted.find(
    (f) => !completedIds.has(f.id) || staleIds.has(f.id)
  );
  const defaultActiveId = firstIncomplete?.id ?? sorted[0]?.id ?? "";

  const [activeFnId, setActiveFnId] = React.useState(() => {
    if (initialStepId && sorted.some((f) => f.id === initialStepId)) {
      return initialStepId;
    }
    return defaultActiveId;
  });
  const [completing, setCompleting] = React.useState(false);
  const [completeError, setCompleteError] = React.useState("");
  const [quizQuestions, setQuizQuestions] = React.useState<SafeQuizQuestion[]>([]);
  const [loadingQuiz, setLoadingQuiz] = React.useState(false);
  const [quizAnswers, setQuizAnswers] = React.useState<Record<string, SopQuizCorrectOption | "">>({});
  const [wrongQuestionIds, setWrongQuestionIds] = React.useState<Set<string>>(new Set());
  const [quizPassed, setQuizPassed] = React.useState(false);
  const [signoffChecked, setSignoffChecked] = React.useState(false);
  const [signingOff, setSigningOff] = React.useState(false);
  const [signoffError, setSignoffError] = React.useState("");

  React.useEffect(() => {
    if (initialStepId && sorted.some((f) => f.id === initialStepId)) {
      setActiveFnId(initialStepId);
    } else {
      setActiveFnId(defaultActiveId);
    }
    setCompleteError("");
    setQuizAnswers({});
    setWrongQuestionIds(new Set());
    setQuizPassed(false);
  }, [role.id, defaultActiveId, initialStepId, sorted]);

  const activeFn = sorted.find((f) => f.id === activeFnId) ?? sorted[0];
  const activeStatus = activeFn
    ? getStepStatus(activeFn.id, sorted, completedIds, staleIds)
    : "locked";
  const canComplete =
    activeFn &&
    (activeStatus === "current" || activeStatus === "stale") &&
    !allStepsComplete;

  React.useEffect(() => {
    if (!activeFn || !canComplete) {
      setQuizQuestions([]);
      return;
    }
    let cancelled = false;
    setLoadingQuiz(true);
    setQuizAnswers({});
    setWrongQuestionIds(new Set());
    setQuizPassed(false);

    fetch(
      `/api/sops/quiz?role_id=${encodeURIComponent(role.id)}&function_id=${encodeURIComponent(activeFn.id)}`
    )
      .then((res) => res.json())
      .then((data: { questions?: SafeQuizQuestion[] }) => {
        if (cancelled) return;
        const qs = Array.isArray(data.questions) ? data.questions : [];
        setQuizQuestions(qs);
        if (qs.length === 0) setQuizPassed(true);
      })
      .catch(() => {
        if (!cancelled) setQuizQuestions([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingQuiz(false);
      });

    return () => {
      cancelled = true;
    };
  }, [activeFn?.id, canComplete, role.id]);

  function handleQuizAnswer(questionId: string, option: SopQuizCorrectOption) {
    setQuizAnswers((prev) => ({ ...prev, [questionId]: option }));
    setWrongQuestionIds((prev) => {
      const next = new Set(prev);
      next.delete(questionId);
      return next;
    });
    setQuizPassed(false);
  }

  async function handleComplete() {
    if (!activeFn || !canComplete) return;

    const hasQuiz = quizQuestions.length > 0;
    if (hasQuiz) {
      const allAnswered = quizQuestions.every((q) => quizAnswers[q.id]);
      if (!allAnswered) {
        setCompleteError("Answer all quiz questions before continuing.");
        return;
      }
    }

    setCompleting(true);
    setCompleteError("");
    setWrongQuestionIds(new Set());

    try {
      if (hasQuiz && !quizPassed) {
        const submitRes = await fetch("/api/sops/quiz/submit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            role_id: role.id,
            function_id: activeFn.id,
            answers: quizQuestions.map((q) => ({
              question_id: q.id,
              selected_option: quizAnswers[q.id] as SopQuizCorrectOption,
            })),
          }),
        });
        const submitData = (await submitRes.json().catch(() => ({}))) as {
          passed?: boolean;
          wrong_question_ids?: string[];
          error?: string;
        };
        if (!submitRes.ok || !submitData.passed) {
          const wrong = new Set(submitData.wrong_question_ids ?? []);
          setWrongQuestionIds(wrong);
          throw new Error(
            typeof submitData.error === "string"
              ? submitData.error
              : "Some answers were incorrect — review and try again."
          );
        }
        setQuizPassed(true);
      }

      const res = await fetch("/api/sops/progress/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role_id: role.id,
          function_id: activeFn.id,
          ...(hasQuiz
            ? {
                answers: quizQuestions.map((q) => ({
                  question_id: q.id,
                  selected_option: quizAnswers[q.id] as SopQuizCorrectOption,
                })),
              }
            : {}),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        throw new Error(typeof data.error === "string" ? data.error : "Could not save progress");
      }

      const nextCompleted = new Set(completedIds);
      nextCompleted.add(activeFn.id);
      const nextStale = new Set(staleIds);
      nextStale.delete(activeFn.id);
      onProgressUpdate({
        ...progressState,
        completed: nextCompleted,
        stale: nextStale,
      });

      const nextIncomplete = sorted.find(
        (f) => !nextCompleted.has(f.id) || nextStale.has(f.id)
      );
      if (nextIncomplete) setActiveFnId(nextIncomplete.id);
    } catch (err) {
      setCompleteError(err instanceof Error ? err.message : "Could not save progress");
    } finally {
      setCompleting(false);
    }
  }

  async function handleSignoff() {
    if (!signoffChecked) {
      setSignoffError("Please confirm the sign-off statement.");
      return;
    }
    setSigningOff(true);
    setSignoffError("");
    try {
      const res = await fetch("/api/sops/signoff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role_id: role.id,
          acknowledged: true,
          statement: SIGNOFF_STATEMENT,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        signoff?: { signed_at: string; statement: string };
        error?: string;
      };
      if (!res.ok || !data.signoff) {
        throw new Error(typeof data.error === "string" ? data.error : "Could not sign off");
      }
      onProgressUpdate({
        ...progressState,
        signoff: {
          signed_at: data.signoff.signed_at,
          statement: data.signoff.statement,
        },
      });
    } catch (err) {
      setSignoffError(err instanceof Error ? err.message : "Could not sign off");
    } finally {
      setSigningOff(false);
    }
  }

  return (
    <motion.div
      key={role.id}
      variants={motionCfg.reveal}
      initial="hidden"
      animate="show"
      exit={{ opacity: 0, y: -8, transition: { duration: 0.18 } }}
      className="space-y-7"
    >
      <header
        className={cn(
          "sop-glass-panel rounded-2xl border p-6",
          roleStyle.border,
          roleStyle.glow
        )}
      >
        <div className="flex items-start gap-4">
          <span className={cn("mt-0.5 shrink-0", roleStyle.text)}>
            <SopRoleIcon name={role.icon} size="lg" className="opacity-80" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className={cn("text-xl font-bold tracking-tight", roleStyle.text)}>{role.name}</h2>
              <SopGlowBadge className="bg-pink-500/15 text-pink-200" glowClassName="shadow-[0_0_16px_-4px_rgba(236,72,153,0.35)]">
                Academy
              </SopGlowBadge>
            </div>
            {role.description.trim() ? (
              <div className="mt-3">
                <Markdown emptyFallback="">{role.description}</Markdown>
              </div>
            ) : null}
          </div>
        </div>

        {total > 0 ? (
          <div className="mt-6 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-semibold text-white/55">
              <span>
                {completedCount} / {total} completed
              </span>
              <div className="flex items-center gap-3">
                {showTimeEstimates ? (
                  <span className="text-white/45">
                    {formatEstimatedMinutes(totalMinutes)} total
                    {remainingMinutes > 0 ? (
                      <>
                        {" "}
                        / {formatEstimatedMinutes(remainingMinutes)} remaining
                      </>
                    ) : null}
                  </span>
                ) : null}
                <span>{percent}%</span>
              </div>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-white/10">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-pink-500/80 to-fuchsia-400/80"
                initial={{ width: 0 }}
                animate={{ width: `${percent}%` }}
                transition={{ duration: 0.45, ease: "easeOut" }}
              />
            </div>
          </div>
        ) : null}
      </header>

      {total === 0 ? (
        <SopEmptyState
          icon={BookOpen}
          title="No functions published for this role yet."
          description="Check back later — your admin may still be building this academy."
        />
      ) : trainingComplete ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="sop-glass-panel rounded-2xl border border-emerald-500/25 p-8 text-center"
        >
          <GraduationCap className="mx-auto mb-4 h-12 w-12 text-emerald-300/80" />
          <h3 className="text-xl font-bold text-white">Training complete</h3>
          <p className="mt-2 text-sm text-white/55">
            Signed off on {new Date(signoff!.signed_at).toLocaleDateString()}. You have finished all{" "}
            {total} steps for {role.name}.
          </p>
          <div className="mt-6">
            <AcademyStepper
              sorted={sorted}
              completed={completedIds}
              stale={staleIds}
              activeId={activeFnId}
              onSelect={setActiveFnId}
              roleColor={role.color}
            />
          </div>
          {activeFn ? (
            <motion.article
              key={activeFn.id}
              layout
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="sop-glass-card mt-6 overflow-hidden rounded-2xl text-left"
            >
              <FunctionStandardBody
                fn={activeFn}
                department={departmentById.get(activeFn.department_id)}
                roleId={role.id}
                showFeedback
              />
            </motion.article>
          ) : null}
        </motion.div>
      ) : allStepsComplete && !signoff ? (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="sop-glass-panel rounded-2xl border border-pink-500/25 p-8"
        >
          <h3 className="text-lg font-bold text-white">Final sign-off</h3>
          <p className="mt-2 text-sm text-white/55">
            You have completed all training steps. Confirm below to finish your academy training.
          </p>
          <div className="mt-6 rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <Checkbox
              checked={signoffChecked}
              onChange={(e) => setSignoffChecked(e.target.checked)}
              label={SIGNOFF_STATEMENT}
            />
          </div>
          {signoffError ? <p className="mt-3 text-sm text-rose-300/90">{signoffError}</p> : null}
          <motion.button
            type="button"
            disabled={signingOff}
            whileHover={signingOff ? undefined : motionCfg.hoverScale}
            whileTap={signingOff ? undefined : { scale: 0.98 }}
            onClick={() => void handleSignoff()}
            className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-500/35 bg-emerald-500/20 px-5 py-3 text-sm font-semibold text-emerald-100 shadow-[0_0_24px_-8px_rgba(16,185,129,0.35)] transition hover:bg-emerald-500/30 disabled:opacity-60 sm:w-auto"
          >
            {signingOff ? (
              <>
                <Spinner className="h-4 w-4 border-white/40 border-t-white" />
                Signing off…
              </>
            ) : (
              "Sign off & complete training"
            )}
          </motion.button>
        </motion.div>
      ) : (
        <>
          <section className="sop-glass-panel rounded-2xl p-4 md:p-5">
            <p className="mb-3 text-[11px] font-bold uppercase tracking-wider text-white/40">Your path</p>
            <AcademyStepper
              sorted={sorted}
              completed={completedIds}
              stale={staleIds}
              activeId={activeFnId}
              onSelect={setActiveFnId}
              roleColor={role.color}
            />
          </section>

          <AnimatePresence mode="wait">
            {activeFn ? (
              <motion.article
                key={activeFn.id}
                layout
                initial={{ opacity: 0, x: 24 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -24 }}
                transition={{ duration: 0.28, ease: "easeOut" }}
                className="sop-glass-card overflow-hidden rounded-2xl"
              >
                <FunctionStandardBody
                  fn={activeFn}
                  department={departmentById.get(activeFn.department_id)}
                  showUpdatedBadge={staleIds.has(activeFn.id)}
                />
                {canComplete ? (
                  <div className="border-t border-white/[0.07] px-5 py-5 space-y-5">
                    {loadingQuiz ? (
                      <div className="flex justify-center py-4">
                        <Spinner className="h-6 w-6 border-white/20 border-t-pink-400" />
                      </div>
                    ) : quizQuestions.length > 0 ? (
                      <AcademyQuizPanel
                        questions={quizQuestions}
                        answers={quizAnswers}
                        onAnswer={handleQuizAnswer}
                        wrongIds={wrongQuestionIds}
                        submitting={completing}
                      />
                    ) : null}
                    {completeError ? (
                      <p className="text-sm text-rose-300/90">{completeError}</p>
                    ) : null}
                    <motion.button
                      type="button"
                      disabled={completing || (quizQuestions.length > 0 && !quizQuestions.every((q) => quizAnswers[q.id]))}
                      whileHover={completing ? undefined : motionCfg.hoverScale}
                      whileTap={completing ? undefined : { scale: 0.98 }}
                      onClick={() => void handleComplete()}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-pink-500/35 bg-pink-500/20 px-5 py-3 text-sm font-semibold text-pink-100 shadow-[0_0_24px_-8px_rgba(236,72,153,0.45)] transition hover:bg-pink-500/30 disabled:opacity-60 sm:w-auto"
                    >
                      {completing ? (
                        <>
                          <Spinner className="h-4 w-4 border-white/40 border-t-white" />
                          Saving…
                        </>
                      ) : quizQuestions.length > 0 ? (
                        "Submit quiz & continue"
                      ) : (
                        "Mark complete → Next"
                      )}
                    </motion.button>
                  </div>
                ) : (
                  <div className="border-t border-white/[0.07] px-5 py-5">
                    <SopFeedbackPanel roleId={role.id} functionId={activeFn.id} />
                  </div>
                )}
              </motion.article>
            ) : null}
          </AnimatePresence>
        </>
      )}
    </motion.div>
  );
}

function RoleContent({
  bundle,
  departmentById,
}: {
  bundle: SopRoleBundle;
  departmentById: Map<string, SopDepartment>;
}) {
  const motionCfg = useSopMotion();
  const { role, functions } = bundle;
  const roleStyle = SOP_COLOR_STYLES[role.color];
  const sorted = sortFunctions(functions);

  return (
    <motion.div
      key={role.id}
      variants={motionCfg.reveal}
      initial="hidden"
      animate="show"
      exit={{ opacity: 0, y: -8, transition: { duration: 0.18 } }}
      className="space-y-7"
    >
      <header
        className={cn(
          "sop-glass-panel rounded-2xl border p-6",
          roleStyle.border,
          roleStyle.glow
        )}
      >
        <div className="flex items-start gap-4">
          <span className={cn("mt-0.5 shrink-0", roleStyle.text)}>
            <SopRoleIcon name={role.icon} size="lg" className="opacity-80" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className={cn("text-xl font-bold tracking-tight", roleStyle.text)}>{role.name}</h2>
            {role.description.trim() ? (
              <div className="mt-3">
                <Markdown emptyFallback="">{role.description}</Markdown>
              </div>
            ) : null}
          </div>
        </div>
      </header>

      <section className="space-y-4">
        <h3 className="text-lg font-bold tracking-tight text-white">Functions</h3>
        {sorted.length === 0 ? (
          <SopEmptyState
            icon={BookOpen}
            title="No functions published for this role yet."
            description="Check back later — your admin may still be building this library."
          />
        ) : (
          <motion.div
            className="grid grid-cols-1 gap-5"
            variants={motionCfg.stagger}
            initial="hidden"
            animate="show"
          >
            {sorted.map((fn) => (
              <FunctionCard
                key={fn.id}
                fn={fn}
                department={departmentById.get(fn.department_id)}
                roleId={role.id}
              />
            ))}
          </motion.div>
        )}
      </section>
    </motion.div>
  );
}

export function SopViewerClient({
  roleBundles,
  departments,
  certificationBadges = [],
}: {
  roleBundles: SopRoleBundle[];
  departments: SopDepartment[];
  certificationBadges?: SopCertificationBadge[];
}) {
  const motionCfg = useSopMotion();
  const searchParams = useSearchParams();
  const departmentById = React.useMemo(
    () => new Map(departments.map((d) => [d.id, d])),
    [departments]
  );

  const deepLinkRole = searchParams.get("role")?.trim() ?? "";
  const deepLinkStep = searchParams.get("step")?.trim() ?? "";

  const [activeRoleId, setActiveRoleId] = React.useState(() => {
    if (deepLinkRole && roleBundles.some((b) => b.role.id === deepLinkRole)) {
      return deepLinkRole;
    }
    return roleBundles[0]?.role.id ?? "";
  });
  const [deepLinkStepId, setDeepLinkStepId] = React.useState(deepLinkStep);
  const [progressByRole, setProgressByRole] = React.useState<Record<string, RoleProgressState>>({});
  const [loadingProgress, setLoadingProgress] = React.useState(false);

  React.useEffect(() => {
    if (!roleBundles.some((b) => b.role.id === activeRoleId)) {
      setActiveRoleId(roleBundles[0]?.role.id ?? "");
    }
  }, [roleBundles, activeRoleId]);

  React.useEffect(() => {
    if (deepLinkRole && roleBundles.some((b) => b.role.id === deepLinkRole)) {
      setActiveRoleId(deepLinkRole);
    }
    if (deepLinkStep) setDeepLinkStepId(deepLinkStep);
  }, [deepLinkRole, deepLinkStep, roleBundles]);

  React.useEffect(() => {
    const academyRoles = roleBundles.filter((b) => b.role.academy_mode);
    if (academyRoles.length === 0) return;

    let cancelled = false;
    setLoadingProgress(true);

    Promise.all(
      academyRoles.map(async (b) => {
        const res = await fetch(`/api/sops/progress?role_id=${encodeURIComponent(b.role.id)}`);
        const data = (await res.json().catch(() => ({}))) as {
          completed_function_ids?: string[];
          stale_function_ids?: string[];
          signoff?: { signed_at: string; statement: string } | null;
        };
        const ids = Array.isArray(data.completed_function_ids) ? data.completed_function_ids : [];
        const stale = Array.isArray(data.stale_function_ids) ? data.stale_function_ids : [];
        return {
          roleId: b.role.id,
          completed: new Set(ids),
          stale: new Set(stale),
          signoff: data.signoff ?? null,
        };
      })
    )
      .then((results) => {
        if (cancelled) return;
        const map: Record<string, RoleProgressState> = {};
        for (const r of results) {
          map[r.roleId] = {
            completed: r.completed,
            stale: r.stale,
            signoff: r.signoff,
          };
        }
        setProgressByRole(map);
      })
      .catch(() => {
        if (!cancelled) setProgressByRole({});
      })
      .finally(() => {
        if (!cancelled) setLoadingProgress(false);
      });

    return () => {
      cancelled = true;
    };
  }, [roleBundles]);

  const activeBundle = roleBundles.find((b) => b.role.id === activeRoleId) ?? roleBundles[0];
  const showTabs = roleBundles.length > 1;
  const activeIsAcademy = activeBundle?.role.academy_mode === true;

  const defaultProgress: RoleProgressState = {
    completed: new Set(),
    stale: new Set(),
    signoff: null,
  };

  return (
    <SopShell>
      <motion.div
        className="mx-auto max-w-4xl space-y-8 px-4 py-8 md:px-6 md:py-10"
        initial="hidden"
        animate="show"
        variants={motionCfg.stagger}
      >
        <motion.div variants={motionCfg.reveal}>
          <p className="mb-1 text-xs font-bold uppercase tracking-widest text-pink-400/55">Training</p>
          <h1 className="text-2xl font-semibold tracking-tight text-white md:text-3xl">SOPs / Training</h1>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-white/55">
            Role-based standards, KPIs, and walkthroughs for your position.
          </p>
        </motion.div>

        {roleBundles.length === 0 ? (
          <SopEmptyState
            icon={BookOpen}
            title="No SOP library assigned yet"
            description="Your account is not linked to any active training role. Ask an admin if you think this is a mistake."
          />
        ) : (
          <>
            {certificationBadges.length > 0 ? (
              <motion.div variants={motionCfg.reveal}>
                <SopCertificationShelf badges={certificationBadges} />
              </motion.div>
            ) : null}
            {showTabs ? (
              <motion.div variants={motionCfg.reveal}>
                <RoleTabs
                  roles={roleBundles.map((b) => b.role)}
                  activeId={activeRoleId}
                  onChange={setActiveRoleId}
                />
              </motion.div>
            ) : null}
            {activeIsAcademy && loadingProgress ? (
              <div className="flex justify-center py-12">
                <Spinner className="h-8 w-8 border-white/20 border-t-pink-400" />
              </div>
            ) : (
              <AnimatePresence mode="wait">
                {activeBundle ? (
                  activeBundle.role.academy_mode ? (
                    <AcademyRoleContent
                      key={activeBundle.role.id}
                      bundle={activeBundle}
                      departmentById={departmentById}
                      progressState={progressByRole[activeBundle.role.id] ?? defaultProgress}
                      initialStepId={
                        activeBundle.role.id === deepLinkRole ? deepLinkStepId : undefined
                      }
                      onProgressUpdate={(state) =>
                        setProgressByRole((prev) => ({
                          ...prev,
                          [activeBundle.role.id]: state,
                        }))
                      }
                    />
                  ) : (
                    <RoleContent
                      key={activeBundle.role.id}
                      bundle={activeBundle}
                      departmentById={departmentById}
                    />
                  )
                ) : null}
              </AnimatePresence>
            )}
          </>
        )}
      </motion.div>
    </SopShell>
  );
}
