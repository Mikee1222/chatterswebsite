/**
 * Candidate Legal Agreement — versioned consent + timed-step notice helpers.
 */

import {
  getEnabledPipelineSteps,
  type PipelineStepConfig,
  type PipelineStepType,
} from "@/lib/application-forms-types";
import { COGNITIVE_TIME_LIMIT_SECONDS } from "@/lib/application-screening-banks";
import type { PipelineLanguage } from "@/lib/application-pipeline-i18n";

/** Bump when legal copy changes in a material way. */
export const APPLICATION_AGREEMENT_VERSION = "2026-08-21.1";

/** Pipeline steps that warrant a pre-screening time-limit notice. */
export const TIMED_PIPELINE_STEPS = [
  "cognitive_screening",
  "typing_speed_test",
] as const satisfies readonly PipelineStepType[];

export type TimedPipelineStep = (typeof TIMED_PIPELINE_STEPS)[number];

export type TimedPipelineNotice = {
  step: TimedPipelineStep;
  /** Hard limit in seconds; null = elapsed time is measured with no hard cutoff. */
  timeLimitSeconds: number | null;
};

export function isTimedPipelineStep(step: PipelineStepType): step is TimedPipelineStep {
  return (TIMED_PIPELINE_STEPS as readonly string[]).includes(step);
}

/** Timed steps enabled on this form, in pipeline order. */
export function getTimedPipelineNotices(
  config: PipelineStepConfig[],
): TimedPipelineNotice[] {
  const enabled = getEnabledPipelineSteps(config);
  const notices: TimedPipelineNotice[] = [];
  for (const s of enabled) {
    if (s.step === "cognitive_screening") {
      notices.push({
        step: "cognitive_screening",
        timeLimitSeconds: COGNITIVE_TIME_LIMIT_SECONDS,
      });
    } else if (s.step === "typing_speed_test") {
      notices.push({
        step: "typing_speed_test",
        timeLimitSeconds: null,
      });
    }
  }
  return notices;
}

export function formatAgreementMinutes(
  seconds: number,
  lang: PipelineLanguage,
): string {
  const mins = Math.max(1, Math.round(seconds / 60));
  if (lang === "el") {
    return mins === 1 ? "1 λεπτό" : `${mins} λεπτά`;
  }
  return mins === 1 ? "1 minute" : `${mins} minutes`;
}

export const AGREEMENT_COPY = {
  en: {
    eyebrow: "Before you continue",
    title: "Legal Agreement",
    lead: "Please read this short consent before starting your application.",
    bullets: [
      "We collect and securely store the personal information you provide in this application.",
      "Screening answers and scores are reviewed by our hiring team as part of evaluating your application.",
      "Your data is used only for hiring and recruitment purposes.",
      "We may contact you about this application via Telegram, email, or phone using the details you share.",
    ],
    checkboxLabel: "I Agree to the terms above",
    continue: "Continue",
    recording: "Saving…",
    mustAgree: "Please confirm that you agree to continue.",
  },
  el: {
    eyebrow: "Πριν συνεχίσεις",
    title: "Νομική Συμφωνία",
    lead: "Διάβασε αυτή τη σύντομη συγκατάθεση πριν ξεκινήσεις την αίτησή σου.",
    bullets: [
      "Συλλέγουμε και αποθηκεύουμε με ασφάλεια τα προσωπικά στοιχεία που παρέχεις σε αυτή την αίτηση.",
      "Οι απαντήσεις και οι βαθμολογίες του screening εξετάζονται από την ομάδα πρόσληψης στο πλαίσιο αξιολόγησης της αίτησής σου.",
      "Τα δεδομένα σου χρησιμοποιούνται μόνο για σκοπούς πρόσληψης και στελέχωσης.",
      "Μπορεί να επικοινωνήσουμε μαζί σου σχετικά με αυτή την αίτηση μέσω Telegram, email ή τηλεφώνου με τα στοιχεία που θα μοιραστείς.",
    ],
    checkboxLabel: "Συμφωνώ με τους παραπάνω όρους",
    continue: "Συνέχεια",
    recording: "Αποθήκευση…",
    mustAgree: "Επιβεβαίωσε ότι συμφωνείς για να συνεχίσεις.",
  },
} as const;

export const TIMED_NOTICE_COPY = {
  en: {
    title: "A quick heads-up about time limits",
    body: "This application includes timed steps. Please give yourself a quiet moment so you can focus.",
    cognitiveLabel: "Cognitive ability",
    typingLabel: "Typing speed test",
    cognitiveDetail: (mins: string) =>
      `${mins} total — unanswered items count as incorrect when time ends.`,
    typingDetail:
      "Timed from your first keystroke until you finish the passage (no hard cutoff).",
    cta: "Got it, let's start!",
  },
  el: {
    title: "Σύντομη ενημέρωση για τα χρονικά όρια",
    body: "Αυτή η αίτηση περιλαμβάνει βήματα με χρόνο. Βρες ένα ήσυχο διάστημα ώστε να συγκεντρωθείς.",
    cognitiveLabel: "Γνωστική ικανότητα",
    typingLabel: "Τεστ ταχύτητας πληκτρολόγησης",
    cognitiveDetail: (mins: string) =>
      `${mins} συνολικά — οι αναπάντητες ερωτήσεις μετράνε ως λάθος όταν τελειώσει ο χρόνος.`,
    typingDetail:
      "Ο χρόνος μετράει από το πρώτο πλήκτρο μέχρι να ολοκληρώσεις το κείμενο (χωρίς σκληρό όριο).",
    cta: "Το κατάλαβα, ας ξεκινήσουμε!",
  },
} as const;

export function agreementCopy(lang: PipelineLanguage) {
  return AGREEMENT_COPY[lang] ?? AGREEMENT_COPY.en;
}

export function timedNoticeCopy(lang: PipelineLanguage) {
  return TIMED_NOTICE_COPY[lang] ?? TIMED_NOTICE_COPY.en;
}
