/**
 * Rule-based candidate flags for application responses.
 * Pattern mirrors Chatter Performance / Instagram Weekly Progress insight tags:
 * quantitative thresholds + answer depth — not LLM-generated.
 */

export type ApplicationFlagSeverity = "positive" | "neutral" | "warning" | "critical";

export type ApplicationAutoFlag = {
  id: string;
  label: string;
  severity: ApplicationFlagSeverity;
};

/** Configurable thresholds (sensible hiring-screen defaults). */
export const APPLICATION_FLAG_THRESHOLDS = {
  cognitiveStrongPercentile: 75,
  cognitiveBelowPercentile: 40,
  eqStrongScore: 75,
  eqBelowScore: 50,
  typingFastWpm: 55,
  typingFastMinAccuracy: 90,
  typingIncompleteMaxAccuracy: 80,
  typingSlowWpm: 25,
  /** Avg chars across non-empty text answers. */
  detailedAnswerMinAvgChars: 140,
  briefAnswerMaxAvgChars: 35,
  /** Prefer long_text when present; else all free-text answers. */
  minAnswersForDepth: 1,
  maxFlags: 3,
} as const;

export const APPLICATION_FLAG_CATALOG: Record<
  string,
  { label: string; severity: ApplicationFlagSeverity }
> = {
  strong_cognitive: { label: "Strong cognitive", severity: "positive" },
  below_cognitive: { label: "Below-average cognitive", severity: "warning" },
  strong_eq: { label: "Strong EQ", severity: "positive" },
  below_eq: { label: "Below-average EQ", severity: "warning" },
  fast_typist: { label: "Fast typist", severity: "positive" },
  slow_typist: { label: "Slow typist", severity: "warning" },
  incomplete_typing: { label: "Incomplete typing", severity: "warning" },
  detailed_answers: { label: "Detailed answers", severity: "positive" },
  brief_answers: { label: "Brief answers", severity: "neutral" },
};

/** Flag ids usable as list filters (stable keys). */
export const APPLICATION_FLAG_FILTER_OPTIONS = Object.entries(APPLICATION_FLAG_CATALOG).map(
  ([id, meta]) => ({ id, label: meta.label }),
);

export type ApplicationFlagInput = {
  cognitivePercentile: number | null | undefined;
  eqScore: number | null | undefined;
  typingWpm: number | null | undefined;
  typingAccuracy: number | null | undefined;
  /** True when typing step was enabled on the form but no result linked. */
  typingExpectedButMissing?: boolean;
  textAnswerLengths: number[];
};

function avg(nums: number[]): number | null {
  if (nums.length === 0) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

type Candidate = ApplicationAutoFlag & { priority: number };

/**
 * Build 1–3 short flags from screening metrics + answer depth.
 * Deterministic — safe to recompute anytime.
 */
export function generateApplicationAutoFlags(input: ApplicationFlagInput): ApplicationAutoFlag[] {
  const t = APPLICATION_FLAG_THRESHOLDS;
  const candidates: Candidate[] = [];

  const cog = input.cognitivePercentile;
  if (cog != null && Number.isFinite(cog)) {
    if (cog >= t.cognitiveStrongPercentile) {
      candidates.push({
        id: "strong_cognitive",
        ...APPLICATION_FLAG_CATALOG.strong_cognitive!,
        priority: 100,
      });
    } else if (cog < t.cognitiveBelowPercentile) {
      candidates.push({
        id: "below_cognitive",
        ...APPLICATION_FLAG_CATALOG.below_cognitive!,
        priority: 95,
      });
    }
  }

  const eq = input.eqScore;
  if (eq != null && Number.isFinite(eq)) {
    if (eq >= t.eqStrongScore) {
      candidates.push({
        id: "strong_eq",
        ...APPLICATION_FLAG_CATALOG.strong_eq!,
        priority: 90,
      });
    } else if (eq < t.eqBelowScore) {
      candidates.push({
        id: "below_eq",
        ...APPLICATION_FLAG_CATALOG.below_eq!,
        priority: 92,
      });
    }
  }

  const wpm = input.typingWpm;
  const acc = input.typingAccuracy;
  if (input.typingExpectedButMissing) {
    candidates.push({
      id: "incomplete_typing",
      ...APPLICATION_FLAG_CATALOG.incomplete_typing!,
      priority: 88,
    });
  } else if (wpm != null && Number.isFinite(wpm)) {
    if (acc != null && Number.isFinite(acc) && acc < t.typingIncompleteMaxAccuracy) {
      candidates.push({
        id: "incomplete_typing",
        ...APPLICATION_FLAG_CATALOG.incomplete_typing!,
        priority: 88,
      });
    } else if (
      wpm >= t.typingFastWpm &&
      (acc == null || !Number.isFinite(acc) || acc >= t.typingFastMinAccuracy)
    ) {
      candidates.push({
        id: "fast_typist",
        ...APPLICATION_FLAG_CATALOG.fast_typist!,
        priority: 80,
      });
    } else if (wpm < t.typingSlowWpm) {
      candidates.push({
        id: "slow_typist",
        ...APPLICATION_FLAG_CATALOG.slow_typist!,
        priority: 78,
      });
    }
  }

  const depths = input.textAnswerLengths.filter((n) => n > 0);
  if (depths.length >= t.minAnswersForDepth) {
    const mean = avg(depths);
    if (mean != null) {
      if (mean >= t.detailedAnswerMinAvgChars) {
        candidates.push({
          id: "detailed_answers",
          ...APPLICATION_FLAG_CATALOG.detailed_answers!,
          priority: 60,
        });
      } else if (mean <= t.briefAnswerMaxAvgChars) {
        candidates.push({
          id: "brief_answers",
          ...APPLICATION_FLAG_CATALOG.brief_answers!,
          priority: 55,
        });
      }
    }
  }

  candidates.sort((a, b) => b.priority - a.priority);
  const seen = new Set<string>();
  const out: ApplicationAutoFlag[] = [];
  for (const c of candidates) {
    if (seen.has(c.id)) continue;
    seen.add(c.id);
    out.push({ id: c.id, label: c.label, severity: c.severity });
    if (out.length >= t.maxFlags) break;
  }
  return out;
}

export function parseAutoFlags(raw: unknown): ApplicationAutoFlag[] {
  if (!Array.isArray(raw)) return [];
  const out: ApplicationAutoFlag[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const id = String((item as { id?: unknown }).id ?? "").trim();
    const label = String((item as { label?: unknown }).label ?? "").trim();
    const severity = (item as { severity?: unknown }).severity;
    if (!id || !label) continue;
    if (
      severity !== "positive" &&
      severity !== "neutral" &&
      severity !== "warning" &&
      severity !== "critical"
    ) {
      continue;
    }
    out.push({ id, label, severity });
  }
  return out;
}

export function autoFlagBadgeClass(severity: ApplicationFlagSeverity): string {
  switch (severity) {
    case "positive":
      return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
    case "warning":
      return "border-amber-500/35 bg-amber-500/10 text-amber-200";
    case "critical":
      return "border-red-500/35 bg-red-500/10 text-red-300";
    default:
      return "border-white/12 bg-white/[0.04] text-white/65";
  }
}
