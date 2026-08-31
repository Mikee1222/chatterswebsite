/**
 * Shortlist approval copy for admin → candidate outreach.
 * Edit templates here — no rebuild of business logic required.
 */

import type {
  ApplicationFormAnswer,
  ApplicationFormQuestion,
  ApplicationResponseStatus,
} from "@/lib/application-forms-types";
import type { PipelineLanguage } from "@/lib/application-pipeline-i18n";

/** Pipeline status that unlocks the "Copy Approval Message" action. */
export const APPROVAL_MESSAGE_STATUS: ApplicationResponseStatus = "shortlisted";

export type ApplicationPositionType = "chatter" | "va";

const POSITION_LABELS: Record<PipelineLanguage, Record<ApplicationPositionType, string>> = {
  en: { chatter: "Chatter", va: "VA" },
  el: { chatter: "Chatter", va: "VA" },
};

/** English templates — {name} and {position} are replaced at runtime. */
export const APPLICATION_APPROVAL_TEMPLATES_EN: Record<ApplicationPositionType, string> = {
  chatter: `Hi {name}! 🎉 Great news — you've been shortlisted for the {position} position at Gunzo Agency!

We were really impressed with your application and we'd love to move forward with the next steps. Someone from our team will reach out shortly with more details.

If you have any questions in the meantime, feel free to reply here.

Best regards,
The Gunzo Agency Team`,
  va: `Hi {name}! 🎉 Great news — you've been shortlisted for the {position} position at Gunzo Agency!

We were really impressed with your application and we'd love to move forward with the next steps. Someone from our team will reach out shortly with more details.

If you have any questions in the meantime, feel free to reply here.

Best regards,
The Gunzo Agency Team`,
};

/** Greek templates — warm, natural phrasing (not literal translation). */
export const APPLICATION_APPROVAL_TEMPLATES_EL: Record<ApplicationPositionType, string> = {
  chatter: `Γεια σου {name}! 🎉 Έχουμε πολύ καλά νέα — προκριθήκες για τη θέση {position} στο Gunzo Agency!

Μας εντυπωσίασε η αίτησή σου και θα θέλαμε να προχωρήσουμε στο επόμενο βήμα. Σύντομα κάποιος από την ομάδα μας θα επικοινωνήσει μαζί σου με περισσότερες λεπτομέρειες.

Αν έχεις οποιαδήποτε απορία μέχρι τότε, μη διστάσεις να μας γράψεις.

Με εκτίμηση,
Η ομάδα του Gunzo Agency`,
  va: `Γεια σου {name}! 🎉 Έχουμε πολύ καλά νέα — προκριθήκες για τη θέση {position} στο Gunzo Agency!

Μας εντυπωσίασε η αίτησή σου και θα θέλαμε να προχωρήσουμε στο επόμενο βήμα. Σύντομα κάποιος από την ομάδα μας θα επικοινωνήσει μαζί σου με περισσότερες λεπτομέρειες.

Αν έχεις οποιαδήποτε απορία μέχρι τότε, μη διστάσεις να μας γράψεις.

Με εκτίμηση,
Η ομάδα του Gunzo Agency`,
};

export function resolveApplicationPositionType(formTitle: string): ApplicationPositionType {
  const t = formTitle.toLowerCase();
  if (/\bva\b|virtual\s*assistant/.test(t)) return "va";
  if (/chatter/.test(t)) return "chatter";
  return "chatter";
}

export function extractCandidateFullName(
  questions: ApplicationFormQuestion[],
  answers: ApplicationFormAnswer[],
): string {
  const fullNameQ = questions.find(
    (q) =>
      q.question_text.trim().toLowerCase() === "full name" ||
      q.question_text_el.trim() === "Ονοματεπώνυμο",
  );
  if (fullNameQ) {
    const answer = answers.find((a) => a.question_id === fullNameQ.id);
    const name = (answer?.answer_text ?? "").trim();
    if (name) return name;
  }
  const first = answers.find((a) => (a.answer_text ?? "").trim());
  return first?.answer_text?.trim() || "there";
}

function fillTemplate(
  template: string,
  name: string,
  positionLabel: string,
): string {
  return template.replace(/\{name\}/g, name).replace(/\{position\}/g, positionLabel);
}

export type BuildApprovalMessageInput = {
  fullName: string;
  formTitle: string;
  preferredLanguage: PipelineLanguage | null | undefined;
};

export function buildApplicationApprovalMessage(input: BuildApprovalMessageInput): string {
  const lang: PipelineLanguage = input.preferredLanguage === "el" ? "el" : "en";
  const positionType = resolveApplicationPositionType(input.formTitle);
  const positionLabel = POSITION_LABELS[lang][positionType];
  const templates =
    lang === "el" ? APPLICATION_APPROVAL_TEMPLATES_EL : APPLICATION_APPROVAL_TEMPLATES_EN;
  return fillTemplate(templates[positionType], input.fullName, positionLabel);
}

export function shouldShowApprovalMessage(status: ApplicationResponseStatus): boolean {
  return status === APPROVAL_MESSAGE_STATUS;
}
